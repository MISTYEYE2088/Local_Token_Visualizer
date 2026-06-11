import { describe, expect, it, vi } from 'vitest';
import { TokenizerService } from '../tokenizerService';

describe('TokenizerService', () => {
  it('loads a tokenizer once per path and returns token count with offsets', async () => {
    const tokenizer = vi.fn().mockResolvedValue({
      input_ids: [101, 102],
      offset_mapping: [[0, 5], [6, 11]]
    });
    const load = vi.fn().mockResolvedValue(tokenizer);
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\tokenizer', 'hello world')).resolves.toEqual({
      count: 2,
      offsets: [[0, 5], [6, 11]]
    });
    await service.tokenize('C:\\models\\tokenizer', 'again');

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('C:\\models\\tokenizer');
  });

  it('reloads when the model path changes', async () => {
    const load = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      input_ids: [1],
      offset_mapping: [[0, 1]]
    }));
    const service = new TokenizerService(load);

    await service.tokenize('C:\\models\\one', 'a');
    await service.tokenize('C:\\models\\two', 'b');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('normalizes missing offset mappings to an empty array', async () => {
    const load = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      input_ids: [1, 2, 3]
    }));
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\tokenizer', 'abc')).resolves.toEqual({
      count: 3,
      offsets: []
    });
  });
});
