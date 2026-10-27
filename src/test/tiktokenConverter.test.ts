import { Tokenizer } from '@huggingface/tokenizers';
import { describe, expect, it } from 'vitest';
import { convertTiktokenToTokenizerJson, TiktokenFormatError } from '../tiktokenConverter';

const b64 = (text: string): string => Buffer.from(text, 'latin1').toString('base64');

// Ranks 0-255 are the single bytes; "he", "ll" and "hell" are built from them in that order.
function rankFile(extra: Array<[string, number]> = [['he', 256], ['ll', 257], ['hell', 258]]): string {
  const lines = Array.from({ length: 256 }, (_, byte) => `${b64(String.fromCharCode(byte))} ${byte}`);
  return [...lines, ...extra.map(([token, rank]) => `${b64(token)} ${rank}`)].join('\n') + '\n';
}

const PATTERN = String.raw`\p{L}+| ?\p{N}+|\s+`;

async function load(file: string, addedTokens?: Array<{ id: number; content: string; special: boolean }>) {
  const json = await convertTiktokenToTokenizerJson(file, { pattern: PATTERN, addedTokens });
  return new Tokenizer(json as never, {});
}

describe('convertTiktokenToTokenizerJson', () => {
  it('produces a tokenizer that merges bytes in rank order', async () => {
    const tokenizer = await load(rankFile());

    expect(tokenizer.encode('hello', { add_special_tokens: false }).ids).toEqual([258, 'o'.charCodeAt(0)]);
    expect(tokenizer.encode('he', { add_special_tokens: false }).ids).toEqual([256]);
    expect(tokenizer.encode('hel', { add_special_tokens: false }).ids).toEqual([256, 'l'.charCodeAt(0)]);
  });

  it('splits text with the supplied pattern and keeps multi-byte characters as byte tokens', async () => {
    const tokenizer = await load(rankFile());

    expect(tokenizer.encode('a 12', { add_special_tokens: false }).ids).toEqual([97, 32, 49, 50]);
    const rocket = tokenizer.encode('🚀', { add_special_tokens: false }).ids;
    expect(rocket).toEqual([...Buffer.from('🚀', 'utf8')]);
    expect(tokenizer.decode(rocket)).toBe('🚀');
  });

  it('registers added tokens so they count as one token', async () => {
    const tokenizer = await load(rankFile(), [{ id: 300, content: '<|end|>', special: true }]);

    expect(tokenizer.encode('a<|end|>', { add_special_tokens: false }).ids).toEqual([97, 300]);
  });

  it('rejects a rank file that is missing single bytes', async () => {
    const lines = Array.from({ length: 255 }, (_, byte) => `${b64(String.fromCharCode(byte))} ${byte}`).join('\n');

    await expect(convertTiktokenToTokenizerJson(lines, { pattern: PATTERN })).rejects.toThrow(/byte 255/);
  });

  it('rejects malformed and empty files with a clear error', async () => {
    await expect(convertTiktokenToTokenizerJson('not a rank file', { pattern: PATTERN })).rejects.toBeInstanceOf(
      TiktokenFormatError
    );
    await expect(convertTiktokenToTokenizerJson('\n\n', { pattern: PATTERN })).rejects.toThrow(/empty/);
  });

  it('rejects a token that cannot be built from smaller tokens', async () => {
    // "abc" has no "ab" or "bc" ranked below it, so it is not the result of a pairwise merge.
    await expect(convertTiktokenToTokenizerJson(rankFile([['abc', 256]]), { pattern: PATTERN })).rejects.toThrow(
      /not a standard BPE/
    );
  });
});
