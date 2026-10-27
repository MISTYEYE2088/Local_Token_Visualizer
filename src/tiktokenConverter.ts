// Converts a tiktoken rank file (`tiktoken.model`: one `base64-token rank` pair per line) into the
// byte-level BPE `tokenizer.json` layout that @huggingface/tokenizers loads, so tokenizers that only
// publish tiktoken files (for example Kimi) work like every other one. The rank file does not carry the
// regex that splits text into words, so the caller supplies it.

export interface TiktokenAddedToken {
  id: number;
  content: string;
  special: boolean;
}

export interface TiktokenConversionOptions {
  /** The word-splitting regex the model was trained with (tiktoken's `pat_str`). */
  pattern: string;
  addedTokens?: readonly TiktokenAddedToken[];
}

export class TiktokenFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TiktokenFormatError';
  }
}

// The conversion is CPU-bound (a few seconds for a 160k vocabulary), so it hands control back regularly
// to keep the extension host responsive.
const YIELD_EVERY = 4000;

export async function convertTiktokenToTokenizerJson(
  rankFile: string,
  options: TiktokenConversionOptions
): Promise<object> {
  const ranks = parseRankFile(rankFile);
  const byteToChar = byteLevelAlphabet();
  const toByteLevel = (token: string): string => {
    let out = '';
    for (let i = 0; i < token.length; i++) {
      out += byteToChar[token.charCodeAt(i)];
    }
    return out;
  };

  const tokens = [...ranks.entries()].sort((a, b) => a[1] - b[1]);
  const vocab: Record<string, number> = {};
  const merges: string[] = [];

  for (const [index, [token, rank]] of tokens.entries()) {
    vocab[toByteLevel(token)] = rank;
    if (token.length > 1) {
      const [left, right] = splitIntoMerge(ranks, token, rank);
      merges.push(`${toByteLevel(left)} ${toByteLevel(right)}`);
    }
    if (index % YIELD_EVERY === YIELD_EVERY - 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  for (let byte = 0; byte < 256; byte++) {
    if (vocab[byteToChar[byte]] === undefined) {
      throw new TiktokenFormatError(`The rank file has no token for byte ${byte}, so it is not a byte-level BPE.`);
    }
  }

  return {
    version: '1.0',
    truncation: null,
    padding: null,
    added_tokens: (options.addedTokens ?? []).map((token) => ({
      id: token.id,
      content: token.content,
      single_word: false,
      lstrip: false,
      rstrip: false,
      normalized: false,
      special: token.special
    })),
    normalizer: null,
    pre_tokenizer: {
      type: 'Sequence',
      pretokenizers: [
        { type: 'Split', pattern: { Regex: options.pattern }, behavior: 'Isolated', invert: false },
        { type: 'ByteLevel', add_prefix_space: false, trim_offsets: true, use_regex: false }
      ]
    },
    post_processor: null,
    decoder: { type: 'ByteLevel', add_prefix_space: true, trim_offsets: true, use_regex: true },
    model: {
      type: 'BPE',
      dropout: null,
      unk_token: null,
      continuing_subword_prefix: null,
      end_of_word_suffix: null,
      fuse_unk: false,
      byte_fallback: false,
      ignore_merges: true,
      vocab,
      merges
    }
  };
}

/** Token bytes to rank. Bytes are held as latin1 strings (one character per byte) so they work as map keys. */
function parseRankFile(rankFile: string): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const line of rankFile.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    const rank = Number(parts[1]);
    if (parts.length !== 2 || !Number.isInteger(rank) || rank < 0) {
      throw new TiktokenFormatError(`Unexpected line in the tiktoken rank file: "${trimmed.slice(0, 40)}".`);
    }
    ranks.set(Buffer.from(parts[0], 'base64').toString('latin1'), rank);
  }
  if (ranks.size === 0) {
    throw new TiktokenFormatError('The tiktoken rank file is empty.');
  }
  return ranks;
}

/**
 * The pair of tokens that merge into `token`: run BPE on its bytes using only merges that rank below
 * the token itself, which leaves exactly two pieces.
 */
function splitIntoMerge(ranks: Map<string, number>, token: string, tokenRank: number): [string, string] {
  const parts: string[] = token.split('');

  for (;;) {
    let bestIndex = -1;
    let bestRank = Infinity;
    for (let i = 0; i < parts.length - 1; i++) {
      const rank = ranks.get(parts[i] + parts[i + 1]);
      if (rank !== undefined && rank < bestRank) {
        bestIndex = i;
        bestRank = rank;
      }
    }
    if (bestIndex === -1 || bestRank >= tokenRank) {
      break;
    }
    parts.splice(bestIndex, 2, parts[bestIndex] + parts[bestIndex + 1]);
  }

  if (parts.length !== 2) {
    throw new TiktokenFormatError(
      `Could not rebuild token ${tokenRank} from smaller tokens; this rank file is not a standard BPE.`
    );
  }
  return [parts[0], parts[1]];
}

/** GPT-2's byte-to-character table: printable bytes map to themselves, the rest move above U+0100. */
function byteLevelAlphabet(): string[] {
  const printable: number[] = [];
  for (let byte = 0x21; byte <= 0x7e; byte++) printable.push(byte);
  for (let byte = 0xa1; byte <= 0xac; byte++) printable.push(byte);
  for (let byte = 0xae; byte <= 0xff; byte++) printable.push(byte);

  const table: string[] = new Array(256);
  let shifted = 0;
  for (let byte = 0; byte < 256; byte++) {
    table[byte] = String.fromCodePoint(printable.includes(byte) ? byte : 256 + shifted++);
  }
  return table;
}
