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
      offsets: [[0, 5], [6, 11]],
      multiTokenChars: []
    });
    await service.tokenize('C:\\models\\tokenizer', 'again');

    expect(tokenizer).toHaveBeenCalledWith('hello world', { return_tensor: false });
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

  it('clears the cached tokenizer on reset', async () => {
    const load = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      input_ids: [1],
      offset_mapping: [[0, 1]]
    }));
    const service = new TokenizerService(load);

    await service.tokenize('C:\\models\\one', 'a');
    service.reset();
    await service.tokenize('C:\\models\\one', 'b');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('normalizes missing offset mappings to an empty array', async () => {
    const load = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      input_ids: [1, 2, 3]
    }));
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\tokenizer', 'abc')).resolves.toEqual({
      count: 3,
      offsets: [],
      multiTokenChars: []
    });
  });

  it('derives best-effort offsets from decoded token ids when offset mappings are unavailable', async () => {
    const tokenizer = Object.assign(
      vi.fn().mockResolvedValue({
        input_ids: [101, 7592, 2088, 102, 2088]
      }),
      {
        decode: vi.fn((ids: number[]) => {
          const decoded: Record<number, string> = {
            101: '',
            7592: 'hello',
            2088: ' world',
            102: ''
          };
          return decoded[ids[0]] ?? '';
        })
      }
    );
    const load = vi.fn().mockResolvedValue(tokenizer);
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\tokenizer', 'hello world world')).resolves.toEqual({
      count: 5,
      offsets: [[0, 5], [5, 11], [11, 17]],
      multiTokenChars: []
    });
  });

  describe('characters split across several tokens', () => {
    // Mimics byte-level BPE: a rocket (4 UTF-8 bytes) is two tokens that each decode alone to U+FFFD.
    function byteTokenizer(decodeTable: Record<string, string>, inputIds: number[]) {
      return Object.assign(vi.fn().mockResolvedValue({ input_ids: inputIds }), {
        decode: vi.fn((ids: number[]) => decodeTable[ids.join(',')] ?? '\uFFFD')
      });
    }

    it('reports a split character once, with its token count, and skips it in the plain offsets', async () => {
      const tokenizer = byteTokenizer(
        { '1': 'a', '2': '\uFFFD', '3': '\uFFFD', '2,3': '🚀', '4': 'b' },
        [1, 2, 3, 4]
      );
      const service = new TokenizerService(vi.fn().mockResolvedValue(tokenizer));

      await expect(service.tokenize('m', 'a🚀b')).resolves.toEqual({
        count: 4,
        offsets: [[0, 1], [3, 4]],
        multiTokenChars: [{ range: [1, 3], tokenCount: 2 }]
      });
    });

    it('counts every token of a character split into three or four pieces', async () => {
      const tokenizer = byteTokenizer(
        { '1': '\uFFFD', '2': '\uFFFD', '3': '\uFFFD', '1,2': '\uFFFD', '1,2,3': '👨', '4': 'x' },
        [1, 2, 3, 4]
      );
      const service = new TokenizerService(vi.fn().mockResolvedValue(tokenizer));

      const result = await service.tokenize('m', '👨x');

      expect(result.multiTokenChars).toEqual([{ range: [0, 2], tokenCount: 3 }]);
      expect(result.offsets).toEqual([[2, 3]]);
    });

    it('keeps valid text carried by the first and last token of the group as normal highlights', async () => {
      const tokenizer = byteTokenizer(
        { '1': 'hi\uFFFD', '2': '\uFFFD!', '1,2': 'hi🚀!' },
        [1, 2]
      );
      const service = new TokenizerService(vi.fn().mockResolvedValue(tokenizer));

      await expect(service.tokenize('m', 'hi🚀!')).resolves.toEqual({
        count: 2,
        offsets: [[0, 2], [4, 5]],
        multiTokenChars: [{ range: [2, 4], tokenCount: 2 }]
      });
    });

    it('treats a real U+FFFD in the text as an ordinary token', async () => {
      const tokenizer = byteTokenizer({ '1': '\uFFFD', '2': ' x', '1,2': '\uFFFD x' }, [1, 2]);
      const service = new TokenizerService(vi.fn().mockResolvedValue(tokenizer));

      await expect(service.tokenize('m', '\uFFFD x')).resolves.toEqual({
        count: 2,
        offsets: [[0, 1], [1, 3]],
        multiTokenChars: []
      });
    });

    it('does not report split characters when the tokenizer supplies real offsets', async () => {
      const tokenizer = vi.fn().mockResolvedValue({ input_ids: [1, 2], offset_mapping: [[0, 2], [0, 2]] });
      const service = new TokenizerService(vi.fn().mockResolvedValue(tokenizer));

      await expect(service.tokenize('m', '🚀')).resolves.toMatchObject({ multiTokenChars: [] });
    });
  });

  it('shares one in-flight load between overlapping tokenize calls', async () => {
    let finishLoading!: (tokenizer: ReturnType<typeof vi.fn>) => void;
    const load = vi.fn(
      () => new Promise<never>((resolve) => { finishLoading = resolve as never; })
    );
    const service = new TokenizerService(load);

    const first = service.tokenize('C:\\models\\big', 'a');
    const second = service.tokenize('C:\\models\\big', 'b');
    finishLoading(vi.fn().mockResolvedValue({ input_ids: [1], offset_mapping: [[0, 1]] }));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries loading after a failed load instead of caching the failure', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('disk hiccup'))
      .mockResolvedValue(vi.fn().mockResolvedValue({ input_ids: [1], offset_mapping: [[0, 1]] }));
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\one', 'a')).rejects.toThrow('disk hiccup');
    await expect(service.tokenize('C:\\models\\one', 'a')).resolves.toMatchObject({ count: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
