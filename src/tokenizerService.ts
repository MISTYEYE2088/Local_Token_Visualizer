import { promises as fs } from 'fs';
import * as path from 'path';
import { Tokenizer } from '@huggingface/tokenizers';
import type { OffsetRange } from './decorations';

export interface TokenizationResult {
  count: number;
  offsets: OffsetRange[];
}

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

    return {
      count: inputIds.length,
      offsets: offsetMapping ?? deriveOffsetsFromDecodedTokens(text, inputIds, tokenizer)
    };
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
): OffsetRange[] {
  if (!tokenizer.decode) {
    return [];
  }

  const offsets: OffsetRange[] = [];
  let searchStart = 0;

  for (const inputId of inputIds) {
    const decoded = tokenizer.decode([inputId], {
      skip_special_tokens: true,
      clean_up_tokenization_spaces: false
    });
    const offset = findNextTokenOffset(text, decoded, searchStart);

    if (!offset) {
      continue;
    }

    offsets.push(offset);
    searchStart = offset[1];
  }

  return offsets;
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
