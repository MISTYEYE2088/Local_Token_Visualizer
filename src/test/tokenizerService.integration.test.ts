import * as path from 'path';
import * as os from 'os';
import { describe, expect, it } from 'vitest';
import { TokenizerService } from '../tokenizerService';

const bundledTokenizerPath = path.resolve(__dirname, '../../tokenizer');

describe('TokenizerService with the bundled tokenizer', () => {
  it('tokenizes real text and derives offsets that cover each token', async () => {
    const service = new TokenizerService();
    const text = 'Hello World';

    const result = await service.tokenize(bundledTokenizerPath, text);

    expect(result.count).toBe(2);
    expect(result.offsets).toEqual([[0, 5], [5, 11]]);
  });

  it('handles empty and non-ASCII text', async () => {
    const service = new TokenizerService();

    await expect(service.tokenize(bundledTokenizerPath, '')).resolves.toEqual({ count: 0, offsets: [] });

    const result = await service.tokenize(bundledTokenizerPath, 'naïve café 日本語 🚀');
    expect(result.count).toBeGreaterThan(0);
    for (const [start, end] of result.offsets) {
      expect(start).toBeLessThan(end);
    }
  });

  it('rejects when the directory has no tokenizer.json', async () => {
    const service = new TokenizerService();

    await expect(service.tokenize(os.tmpdir(), 'hello')).rejects.toThrow(/tokenizer\.json/);
  });
});
