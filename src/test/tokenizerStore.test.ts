import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findCatalogEntry } from '../catalog';
import { TokenizerDownloadError, TokenizerStore, type FetchLike } from '../tokenizerStore';

const VALID_TOKENIZER = JSON.stringify({ model: { type: 'BPE', vocab: {}, merges: [] } });

function response(status: number, body?: string, headers: Record<string, string> = {}) {
  const bytes = body === undefined ? null : new TextEncoder().encode(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    body: bytes
      ? (async function* () {
          // Two chunks so progress reporting is exercised.
          yield bytes.slice(0, Math.ceil(bytes.length / 2));
          yield bytes.slice(Math.ceil(bytes.length / 2));
        })()
      : null
  };
}

describe('TokenizerStore', () => {
  let root: string;
  let bundledRoot: string;
  let downloadRoot: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ltv-store-'));
    bundledRoot = path.join(root, 'bundled');
    downloadRoot = path.join(root, 'downloads');
    await fs.mkdir(path.join(bundledRoot, 'o200k-harmony'), { recursive: true });
    await fs.writeFile(path.join(bundledRoot, 'o200k-harmony', 'tokenizer.json'), VALID_TOKENIZER);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  describe('resolve', () => {
    it('finds bundled tokenizers and prefers them over downloads', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, vi.fn());

      await expect(store.resolve('o200k-harmony')).resolves.toEqual({
        path: path.join(bundledRoot, 'o200k-harmony'),
        source: 'bundled'
      });
    });

    it('returns undefined for tokenizers that are not on disk', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, vi.fn());

      await expect(store.resolve('qwen-3.8')).resolves.toBeUndefined();
    });

    it('refuses ids that could escape the storage folders', async () => {
      await fs.mkdir(path.join(root, 'evil'), { recursive: true });
      await fs.writeFile(path.join(root, 'evil', 'tokenizer.json'), VALID_TOKENIZER);
      const store = new TokenizerStore(bundledRoot, downloadRoot, vi.fn());

      await expect(store.resolve('../evil')).resolves.toBeUndefined();
    });
  });

  describe('download', () => {
    it('downloads a catalog entry at its pinned revision and reports progress', async () => {
      const entry = findCatalogEntry('qwen-3.8')!;
      const fetchImpl = vi.fn<FetchLike>(async (url) =>
        url.endsWith('tokenizer.json')
          ? response(200, VALID_TOKENIZER, { 'content-length': String(VALID_TOKENIZER.length) })
          : response(200, '{"a":1}')
      );
      const progress = vi.fn();
      const store = new TokenizerStore(bundledRoot, downloadRoot, fetchImpl);

      const result = await store.download('qwen-3.8', progress);

      expect(fetchImpl.mock.calls[0][0]).toBe(
        `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/tokenizer.json`
      );
      expect(result).toEqual({ path: path.join(downloadRoot, 'qwen-3.8'), source: 'downloaded' });
      expect(await fs.readFile(path.join(result.path, 'tokenizer.json'), 'utf8')).toBe(VALID_TOKENIZER);
      expect(await fs.readFile(path.join(result.path, 'tokenizer_config.json'), 'utf8')).toBe('{"a":1}');
      expect(progress).toHaveBeenCalledWith({
        file: 'tokenizer.json',
        receivedBytes: VALID_TOKENIZER.length,
        totalBytes: VALID_TOKENIZER.length
      });
      await expect(store.resolve('qwen-3.8')).resolves.toMatchObject({ source: 'downloaded' });
    });

    it('downloads an arbitrary Hugging Face repo from main and tolerates a missing tokenizer_config.json', async () => {
      const fetchImpl = vi.fn<FetchLike>(async (url) =>
        url.endsWith('tokenizer.json') ? response(200, VALID_TOKENIZER) : response(404)
      );
      const store = new TokenizerStore(bundledRoot, downloadRoot, fetchImpl);

      const result = await store.download('acme/my-model');

      expect(fetchImpl.mock.calls[0][0]).toBe('https://huggingface.co/acme/my-model/resolve/main/tokenizer.json');
      expect(result.path).toBe(path.join(downloadRoot, 'acme--my-model'));
      await expect(fs.access(path.join(result.path, 'tokenizer_config.json'))).rejects.toThrow();
      await expect(store.listCustomDownloads()).resolves.toEqual(['acme/my-model']);
    });

    it('explains gated repositories', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, async () => response(401));

      await expect(store.download('meta-llama/Llama-4-Scout-17B-16E-Instruct')).rejects.toThrow(/gated or private/);
    });

    it('explains repositories without a tokenizer.json', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, async () => response(404));

      await expect(store.download('acme/sentencepiece-only')).rejects.toThrow(/no tokenizer\.json/);
    });

    it('explains network failures', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, async () => {
        throw new Error('getaddrinfo ENOTFOUND huggingface.co');
      });

      const error = await store.download('acme/model').catch((e) => e);

      expect(error).toBeInstanceOf(TokenizerDownloadError);
      expect(error.message).toMatch(/internet connection/);
    });

    it('rejects files that are not a tokenizer and leaves nothing behind', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, async () => response(200, '<html>not json</html>'));

      await expect(store.download('acme/model')).rejects.toThrow(/not valid JSON/);
      expect(await fs.readdir(downloadRoot)).toEqual([]);
      await expect(store.resolve('acme/model')).resolves.toBeUndefined();
    });

    it('rejects JSON that is not a Hugging Face tokenizer', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, async () => response(200, '{"hello":"world"}'));

      await expect(store.download('acme/model')).rejects.toThrow(/not a Hugging Face tokenizer/);
    });

    it('does not replace an existing download when a re-download fails', async () => {
      const good = new TokenizerStore(bundledRoot, downloadRoot, async () => response(200, VALID_TOKENIZER));
      await good.download('acme/model');

      const failing = new TokenizerStore(bundledRoot, downloadRoot, async () => response(500));
      await expect(failing.download('acme/model')).rejects.toThrow(TokenizerDownloadError);

      await expect(good.resolve('acme/model')).resolves.toMatchObject({ source: 'downloaded' });
    });

    describe('tiktoken-only tokenizers', () => {
      const b64 = (text: string): string => Buffer.from(text, 'latin1').toString('base64');
      const RANK_FILE =
        [...Array.from({ length: 256 }, (_, byte) => `${b64(String.fromCharCode(byte))} ${byte}`), `${b64('he')} 256`].join('\n') +
        '\n';
      const CONFIG = JSON.stringify({
        added_tokens_decoder: { '257': { content: '[EOS]', special: true }, bad: { content: 'x' } }
      });

      it('downloads the rank file at the pinned revision and stores a converted tokenizer.json', async () => {
        const entry = findCatalogEntry('kimi-k3')!;
        const fetchImpl = vi.fn<FetchLike>(async (url) =>
          url.endsWith('tiktoken.model') ? response(200, RANK_FILE) : response(200, CONFIG)
        );
        const progress = vi.fn();
        const store = new TokenizerStore(bundledRoot, downloadRoot, fetchImpl);

        const result = await store.download('kimi-k3', progress);

        expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
          `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/tiktoken.model`,
          `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/tokenizer_config.json`
        ]);
        expect(progress).toHaveBeenCalledWith(expect.objectContaining({ file: 'tiktoken.model' }));
        expect(await fs.readdir(result.path)).toEqual(['tokenizer.json']);

        const converted = JSON.parse(await fs.readFile(path.join(result.path, 'tokenizer.json'), 'utf8'));
        expect(converted.model.vocab['he']).toBe(256);
        expect(converted.model.merges).toEqual(['h e']);
        expect(converted.added_tokens).toEqual([expect.objectContaining({ id: 257, content: '[EOS]', special: true })]);
        await expect(store.resolve('kimi-k3')).resolves.toMatchObject({ source: 'downloaded' });
      });

      it('works without a tokenizer_config.json', async () => {
        const store = new TokenizerStore(bundledRoot, downloadRoot, async (url) =>
          url.endsWith('tiktoken.model') ? response(200, RANK_FILE) : response(404)
        );

        await expect(store.download('kimi-k3')).resolves.toMatchObject({ source: 'downloaded' });
      });

      it('reports an unusable rank file as a download error and leaves nothing behind', async () => {
        const store = new TokenizerStore(bundledRoot, downloadRoot, async (url) =>
          url.endsWith('tiktoken.model') ? response(200, 'garbage') : response(404)
        );

        await expect(store.download('kimi-k3')).rejects.toThrow(/Could not convert the tokenizer/);
        expect(await fs.readdir(downloadRoot)).toEqual([]);
      });
    });

    it('refuses invalid model ids without touching the network', async () => {
      const fetchImpl = vi.fn<FetchLike>();
      const store = new TokenizerStore(bundledRoot, downloadRoot, fetchImpl);

      await expect(store.download('../../etc')).rejects.toThrow(/not a valid Hugging Face model id/);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('listCustomDownloads', () => {
    it('returns an empty list before anything was downloaded', async () => {
      const store = new TokenizerStore(bundledRoot, downloadRoot, vi.fn());

      await expect(store.listCustomDownloads()).resolves.toEqual([]);
    });
  });
});
