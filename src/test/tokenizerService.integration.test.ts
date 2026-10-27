import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { TokenizerService } from '../tokenizerService';

// These tests use the real bundled tokenizers, fetched by `npm run fetch-tokenizers`
// (which `npm test` runs first). Expected counts for the OpenAI encoding come from an
// independent tiktoken implementation; the Gemma 4 and DeepSeek counts come from the Rust
// Hugging Face `tokenizers` library, the reference implementation for tokenizer.json files.
const bundledRoot = path.resolve(__dirname, '../../tokenizers');

const SAMPLES = {
  hello: 'Hello World',
  unicode: 'naïve café 日本語 🚀',
  code: 'function add(a, b) { return a + b; }'
};

const EXPECTED_COUNTS: Record<string, Record<keyof typeof SAMPLES, number>> = {
  'o200k-harmony': { hello: 2, unicode: 8, code: 13 },
  'gemma-4': { hello: 2, unicode: 8, code: 14 },
  'deepseek-v4': { hello: 2, unicode: 8, code: 13 }
};

describe('bundled tokenizers', () => {
  it('ships exactly the catalog entries marked as bundled', async () => {
    const bundledIds = CATALOG.filter((entry) => entry.bundled).map((entry) => entry.id).sort();
    const onDisk = (await fs.readdir(bundledRoot)).sort();

    expect(onDisk).toEqual(bundledIds);
  });

  for (const entry of CATALOG.filter((candidate) => candidate.bundled)) {
    describe(entry.id, () => {
      const directory = path.join(bundledRoot, entry.id);

      it('matches the pinned checksum', async () => {
        const digest = createHash('sha256')
          .update(await fs.readFile(path.join(directory, 'tokenizer.json')))
          .digest('hex');

        expect(digest).toBe(entry.sha256);
      });

      it('counts tokens like the reference implementation', async () => {
        const service = new TokenizerService();

        for (const [name, text] of Object.entries(SAMPLES)) {
          const result = await service.tokenize(directory, text);
          expect(result.count, `${entry.id} / ${name}`).toBe(EXPECTED_COUNTS[entry.id][name as keyof typeof SAMPLES]);
        }
      });
    });
  }

  it('derives offsets that cover each token of plain text', async () => {
    const service = new TokenizerService();

    const result = await service.tokenize(path.join(bundledRoot, 'o200k-harmony'), 'Hello World');

    expect(result.offsets).toEqual([[0, 5], [5, 11]]);
  });

  it('handles empty text and keeps offsets well-formed for non-ASCII text', async () => {
    const service = new TokenizerService();
    const directory = path.join(bundledRoot, 'o200k-harmony');

    await expect(service.tokenize(directory, '')).resolves.toEqual({ count: 0, offsets: [], multiTokenChars: [] });

    const result = await service.tokenize(directory, SAMPLES.unicode);
    expect(result.offsets.length).toBeGreaterThan(0);
    for (const [start, end] of result.offsets) {
      expect(start).toBeLessThan(end);
      expect(end).toBeLessThanOrEqual(SAMPLES.unicode.length);
    }
  });

  it('flags emoji that byte-level BPE splits across tokens, with the number of tokens each spans', async () => {
    const service = new TokenizerService();
    const directory = path.join(bundledRoot, 'o200k-harmony');

    // o200k_harmony: "a" + two byte tokens for the rocket + "b".
    await expect(service.tokenize(directory, 'a🚀b')).resolves.toEqual({
      count: 4,
      offsets: [[0, 1], [3, 4]],
      multiTokenChars: [{ range: [1, 3], tokenCount: 2 }]
    });

    // A family emoji is three people joined by zero-width joiners: each person spans two tokens.
    const family = await service.tokenize(directory, '👨‍👩‍👧');
    expect(family.count).toBe(8);
    expect(family.multiTokenChars).toEqual([
      { range: [0, 2], tokenCount: 2 },
      { range: [3, 5], tokenCount: 2 },
      { range: [6, 8], tokenCount: 2 }
    ]);
  });

  it('flags nothing when the tokenizer has a whole token for the character', async () => {
    const service = new TokenizerService();

    // gemma-4 has a single token for the rocket.
    await expect(service.tokenize(path.join(bundledRoot, 'gemma-4'), 'a🚀b')).resolves.toEqual({
      count: 3,
      offsets: [[0, 1], [1, 3], [3, 4]],
      multiTokenChars: []
    });
  });

  it('rejects when the directory has no tokenizer.json', async () => {
    const service = new TokenizerService();

    await expect(service.tokenize(os.tmpdir(), 'hello')).rejects.toThrow(/tokenizer\.json/);
  });
});
