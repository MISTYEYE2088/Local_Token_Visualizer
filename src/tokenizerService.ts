import { promises as fs } from 'fs';
import * as path from 'path';
import { Tokenizer } from '@huggingface/tokenizers';
import type { MultiTokenChar, OffsetRange } from './decorations';

export interface TokenizationResult {
  count: number;
  offsets: OffsetRange[];
  // Characters whose UTF-8 bytes were split across several tokens (e.g. most emoji with byte-level BPE).
  multiTokenChars: MultiTokenChar[];
}

// A single character is at most 4 UTF-8 bytes; the cap leaves room for a neighbouring partial character.
const MAX_SPLIT_CHAR_TOKENS = 8;
const REPLACEMENT_CHAR = '\uFFFD';

export type LoadedTokenizer = ((
  text: string,
  options: { return_tensor: false }
) => Promise<{
  input_ids?: Array<number | bigint>;
  offset_mapping?: OffsetRange[];
}>) & {
  decode?: (
    tokenIds: Array<number | bigint>,
    options?: { skip_special_tokens?: boolean; clean_up_tokenization_spaces?: boolean }
  ) => string;
};

export type TokenizerLoader = (modelPath: string) => Promise<LoadedTokenizer>;

export async function loadLocalTokenizer(modelPath: string): Promise<LoadedTokenizer> {
  const tokenizerJson = JSON.parse(await fs.readFile(path.join(modelPath, 'tokenizer.json'), 'utf8'));
  const tokenizerConfig = await readOptionalJson(path.join(modelPath, 'tokenizer_config.json'));
  const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

  return Object.assign(
    // Count only the text's own tokens so the number matches the highlighted ranges
    // (some tokenizers would otherwise add a BOS/EOS token).
    async (text: string) => ({ input_ids: tokenizer.encode(text, { add_special_tokens: false }).ids }),
    {
      decode: (
        tokenIds: Array<number | bigint>,
        options?: { skip_special_tokens?: boolean; clean_up_tokenization_spaces?: boolean }
      ) => tokenizer.decode(tokenIds as number[], options)
    }
  );
}

async function readOptionalJson(filePath: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export class TokenizerService {
  private cachedPath: string | undefined;
  private cachedTokenizer: Promise<LoadedTokenizer> | undefined;

  constructor(private readonly loadTokenizer: TokenizerLoader = loadLocalTokenizer) {}

  async tokenize(modelPath: string, text: string): Promise<TokenizationResult> {
    const tokenizer = await this.getTokenizer(modelPath);
    const output = await tokenizer(text, { return_tensor: false });
    const inputIds = Array.isArray(output.input_ids) ? output.input_ids : [];
    const offsetMapping = normalizeOffsetMapping(output.offset_mapping);

    if (offsetMapping) {
      return { count: inputIds.length, offsets: offsetMapping, multiTokenChars: [] };
    }

    return { count: inputIds.length, ...deriveOffsetsFromDecodedTokens(text, inputIds, tokenizer) };
  }

  reset(): void {
    this.cachedPath = undefined;
    this.cachedTokenizer = undefined;
  }

  // Overlapping refreshes share one in-flight load instead of each parsing the same large file.
  private getTokenizer(modelPath: string): Promise<LoadedTokenizer> {
    if (this.cachedPath === modelPath && this.cachedTokenizer) {
      return this.cachedTokenizer;
    }

    const loading = this.loadTokenizer(modelPath);
    this.cachedPath = modelPath;
    this.cachedTokenizer = loading;
    loading.catch(() => {
      if (this.cachedTokenizer === loading) {
        this.reset();
      }
    });
    return loading;
  }
}

function normalizeOffsetMapping(offsetMapping: OffsetRange[] | undefined): OffsetRange[] | undefined {
  if (!Array.isArray(offsetMapping)) {
    return undefined;
  }

  return offsetMapping.filter(
    (offset): offset is OffsetRange =>
      Array.isArray(offset) &&
      offset.length === 2 &&
      typeof offset[0] === 'number' &&
      typeof offset[1] === 'number' &&
      offset[0] < offset[1]
  );
}

function deriveOffsetsFromDecodedTokens(
  text: string,
  inputIds: Array<number | bigint>,
  tokenizer: LoadedTokenizer
): Pick<TokenizationResult, 'offsets' | 'multiTokenChars'> {
  const offsets: OffsetRange[] = [];
  const multiTokenChars: MultiTokenChar[] = [];

  if (!tokenizer.decode) {
    return { offsets, multiTokenChars };
  }

  const decodeIds = (ids: Array<number | bigint>): string =>
    tokenizer.decode!(ids, { skip_special_tokens: true, clean_up_tokenization_spaces: false });
  let searchStart = 0;
  let index = 0;

  while (index < inputIds.length) {
    const decoded = decodeIds([inputIds[index]]);
    const group = decoded.includes(REPLACEMENT_CHAR) ? findSplitCharGroup(inputIds, index, decoded, decodeIds) : undefined;

    if (group) {
      const groupStart = text.indexOf(group.decoded, searchStart);
      index += group.tokenCount;

      if (groupStart === -1) {
        continue;
      }

      const charStart = groupStart + group.prefix.length;
      const charEnd = groupStart + group.decoded.length - group.suffix.length;
      if (group.prefix.length > 0) {
        offsets.push([groupStart, charStart]);
      }
      multiTokenChars.push({ range: [charStart, charEnd], tokenCount: group.tokenCount });
      if (group.suffix.length > 0) {
        offsets.push([charEnd, charEnd + group.suffix.length]);
      }
      searchStart = charEnd + group.suffix.length;
      continue;
    }

    index += 1;
    const offset = findNextTokenOffset(text, decoded, searchStart);

    if (!offset) {
      continue;
    }

    offsets.push(offset);
    searchStart = offset[1];
  }

  return { offsets, multiTokenChars };
}

interface SplitCharGroup {
  tokenCount: number;
  decoded: string;
  // Valid text the first token carries before the partial character, and the last token after it.
  prefix: string;
  suffix: string;
}

// A token that decodes to U+FFFD holds only part of a character's UTF-8 bytes. Grow the group with the
// following tokens until they decode cleanly together. A real U+FFFD in the text never decodes cleanly,
// so it yields no group and falls back to the plain per-token lookup.
function findSplitCharGroup(
  inputIds: Array<number | bigint>,
  firstIndex: number,
  firstDecoded: string,
  decodeIds: (ids: Array<number | bigint>) => string
): SplitCharGroup | undefined {
  const prefix = firstDecoded.slice(0, firstDecoded.indexOf(REPLACEMENT_CHAR));
  const lastAllowed = Math.min(firstIndex + MAX_SPLIT_CHAR_TOKENS, inputIds.length) - 1;

  for (let lastIndex = firstIndex + 1; lastIndex <= lastAllowed; lastIndex++) {
    const decoded = decodeIds(inputIds.slice(firstIndex, lastIndex + 1));

    if (decoded.includes(REPLACEMENT_CHAR)) {
      continue;
    }

    const lastDecoded = decodeIds([inputIds[lastIndex]]);
    const lastReplacement = lastDecoded.lastIndexOf(REPLACEMENT_CHAR);
    const suffix = lastReplacement === -1 ? '' : lastDecoded.slice(lastReplacement + 1);

    if (decoded.length <= prefix.length + suffix.length) {
      return undefined;
    }

    return { tokenCount: lastIndex - firstIndex + 1, decoded, prefix, suffix };
  }

  return undefined;
}

function findNextTokenOffset(text: string, decoded: string, searchStart: number): OffsetRange | undefined {
  if (decoded.length === 0) {
    return undefined;
  }

  const exactStart = text.indexOf(decoded, searchStart);
  if (exactStart !== -1) {
    return [exactStart, exactStart + decoded.length];
  }

  const trimmed = decoded.trim();
  if (trimmed.length === 0 || trimmed === decoded) {
    return undefined;
  }

  const trimmedStart = text.indexOf(trimmed, searchStart);
  if (trimmedStart === -1) {
    return undefined;
  }

  return [trimmedStart, trimmedStart + trimmed.length];
}
