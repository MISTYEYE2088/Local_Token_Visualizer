import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { TokenizerService } from '../tokenizerService';

// These tests use the real bundled tokenizers, fetched by `npm run fetch-tokenizers`
// (which `npm test` runs first). Expected counts for the OpenAI encodings come from an
// independent tiktoken implementation; the Gemma 4 counts come from the Rust Hugging Face
// `tokenizers` library, the reference implementation for tokenizer.json files.
const bundledRoot = path.resolve(__dirname, '../../tokenizers');

const SAMPLES = {
  hello: 'Hello World',
  unicode: 'naïve café 日本語 🚀',
  code: 'function add(a, b) { return a + b; }'
};

const EXPECTED_COUNTS: Record<string, Record<keyof typeof SAMPLES, number>> = {
  'gpt-4o': { hello: 2, unicode: 8, code: 13 },
  'o200k-harmony': { hello: 2, unicode: 8, code: 13 },
  'gemma-4': { hello: 2, unicode: 8, code: 14 }
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

    const result = await service.tokenize(path.join(bundledRoot, 'gpt-4o'), 'Hello World');

    expect(result.offsets).toEqual([[0, 5], [5, 11]]);
  });

  it('handles empty text and keeps offsets well-formed for non-ASCII text', async () => {
    const service = new TokenizerService();
    const directory = path.join(bundledRoot, 'gpt-4o');

    await expect(service.tokenize(directory, '')).resolves.toEqual({ count: 0, offsets: [] });

    const result = await service.tokenize(directory, SAMPLES.unicode);
    expect(result.offsets.length).toBeGreaterThan(0);
    for (const [start, end] of result.offsets) {
      expect(start).toBeLessThan(end);
      expect(end).toBeLessThanOrEqual(SAMPLES.unicode.length);
    }
  });

  it('rejects when the directory has no tokenizer.json', async () => {
    const service = new TokenizerService();

    await expect(service.tokenize(os.tmpdir(), 'hello')).rejects.toThrow(/tokenizer\.json/);
  });
});
