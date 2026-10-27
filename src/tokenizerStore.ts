import { promises as fs } from 'fs';
import * as path from 'path';
import { isValidModelId, findCatalogEntry, isHuggingFaceRepoId, slugForModel, type CatalogEntry } from './catalog';
import { convertTiktokenToTokenizerJson, TiktokenFormatError, type TiktokenAddedToken } from './tiktokenConverter';

export type TokenizerSource = 'bundled' | 'downloaded';

export interface ResolvedTokenizer {
  path: string;
  source: TokenizerSource;
}

export interface DownloadProgress {
  file: string;
  receivedBytes: number;
  totalBytes: number | undefined;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; redirect?: 'follow' }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: AsyncIterable<Uint8Array> | null;
}>;

export class TokenizerDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenizerDownloadError';
  }
}

const HF_BASE_URL = 'https://huggingface.co';

export class TokenizerStore {
  constructor(
    private readonly bundledRoot: string,
    private readonly downloadRoot: string,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike
  ) {}

  async resolve(model: string): Promise<ResolvedTokenizer | undefined> {
    if (!isValidModelId(model)) {
      return undefined;
    }

    const slug = slugForModel(model);
    const candidates: ResolvedTokenizer[] = [
      { path: path.join(this.bundledRoot, slug), source: 'bundled' },
      { path: path.join(this.downloadRoot, slug), source: 'downloaded' }
    ];

    for (const candidate of candidates) {
      if (await fileExists(path.join(candidate.path, 'tokenizer.json'))) {
        return candidate;
      }
    }
    return undefined;
  }

  /** Hugging Face repo ids the user has downloaded that are not in the catalog. */
  async listCustomDownloads(): Promise<string[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.downloadRoot);
    } catch {
      return [];
    }

    const found: string[] = [];
    for (const name of names) {
      const repoId = name.replace('--', '/');
      if (isHuggingFaceRepoId(repoId) && (await fileExists(path.join(this.downloadRoot, name, 'tokenizer.json')))) {
        found.push(repoId);
      }
    }
    return found.sort();
  }

  async download(
    model: string,
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal
  ): Promise<ResolvedTokenizer> {
    const entry = findCatalogEntry(model);
    const repo = entry?.repo ?? model;
    const revision = entry?.revision ?? 'main';

    if (!entry && !isHuggingFaceRepoId(model)) {
      throw new TokenizerDownloadError(`"${model}" is not a valid Hugging Face model id (expected "owner/name").`);
    }

    const destination = path.join(this.downloadRoot, slugForModel(model));
    const staging = `${destination}.partial-${process.pid}`;
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(staging, { recursive: true });

    try {
      if (entry?.tiktokenPattern) {
        await this.downloadTiktoken(entry, entry.tiktokenPattern, staging, onProgress, signal);
      } else {
        await this.fetchToFile(repo, revision, 'tokenizer.json', staging, false, onProgress, signal);
        await this.assertLooksLikeTokenizer(path.join(staging, 'tokenizer.json'), repo);
        await this.fetchToFile(repo, revision, 'tokenizer_config.json', staging, true, onProgress, signal);
      }

      await fs.rm(destination, { recursive: true, force: true });
      await fs.rename(staging, destination);
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }

    return { path: destination, source: 'downloaded' };
  }

  /** Fetches a tiktoken rank file and stores it as the tokenizer.json the rest of the extension reads. */
  private async downloadTiktoken(
    entry: CatalogEntry,
    pattern: string,
    directory: string,
    onProgress: ((progress: DownloadProgress) => void) | undefined,
    signal: AbortSignal | undefined
  ): Promise<void> {
    const { repo, revision } = entry;
    await this.fetchToFile(repo, revision, 'tiktoken.model', directory, false, onProgress, signal);
    await this.fetchToFile(repo, revision, 'tokenizer_config.json', directory, true, onProgress, signal);

    const rankFile = await fs.readFile(path.join(directory, 'tiktoken.model'), 'utf8');
    const config = await readOptionalJson(path.join(directory, 'tokenizer_config.json'));
    try {
      const converted = await convertTiktokenToTokenizerJson(rankFile, {
        pattern,
        addedTokens: addedTokensOf(config)
      });
      await fs.writeFile(path.join(directory, 'tokenizer.json'), JSON.stringify(converted));
    } catch (error) {
      if (error instanceof TiktokenFormatError) {
        throw new TokenizerDownloadError(`Could not convert the tokenizer from "${repo}": ${error.message}`);
      }
      throw error;
    }

    // The converted tokenizer.json is self-contained; the originals are not needed once it exists.
    await fs.rm(path.join(directory, 'tiktoken.model'), { force: true });
    await fs.rm(path.join(directory, 'tokenizer_config.json'), { force: true });
  }

  private async fetchToFile(
    repo: string,
    revision: string,
    file: string,
    directory: string,
    optional: boolean,
    onProgress: ((progress: DownloadProgress) => void) | undefined,
    signal: AbortSignal | undefined
  ): Promise<void> {
    const url = `${HF_BASE_URL}/${repo}/resolve/${revision}/${file}`;
    let response;
    try {
      response = await this.fetchImpl(url, { signal, redirect: 'follow' });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      throw new TokenizerDownloadError(
        `Could not reach Hugging Face (${(error as Error).message}). Check your internet connection.`
      );
    }

    if (response.status === 404 && optional) {
      return;
    }
    if (response.status === 401 || response.status === 403) {
      throw new TokenizerDownloadError(
        `"${repo}" is gated or private on Hugging Face, so it cannot be downloaded anonymously. ` +
          'Accept its license on huggingface.co and download tokenizer.json yourself, or choose an ungated mirror.'
      );
    }
    if (response.status === 404) {
      throw new TokenizerDownloadError(
        `"${repo}" has no tokenizer.json. Only repositories that publish a tokenizer.json are supported ` +
          '(SentencePiece-only repositories with just tokenizer.model are not).'
      );
    }
    if (!response.ok || !response.body) {
      throw new TokenizerDownloadError(`Hugging Face returned HTTP ${response.status} for ${repo}/${file}.`);
    }

    const length = Number(response.headers.get('content-length'));
    const totalBytes = Number.isFinite(length) && length > 0 ? length : undefined;
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    for await (const chunk of response.body) {
      chunks.push(chunk);
      receivedBytes += chunk.byteLength;
      onProgress?.({ file, receivedBytes, totalBytes });
    }

    await fs.writeFile(path.join(directory, file), Buffer.concat(chunks));
  }

  private async assertLooksLikeTokenizer(filePath: string, repo: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      throw new TokenizerDownloadError(`The tokenizer.json downloaded from "${repo}" is not valid JSON.`);
    }
    if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { model?: unknown }).model !== 'object') {
      throw new TokenizerDownloadError(`The tokenizer.json downloaded from "${repo}" is not a Hugging Face tokenizer.`);
    }
  }
}

async function readOptionalJson(filePath: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Special tokens listed in a Hugging Face tokenizer_config.json (`added_tokens_decoder`). */
function addedTokensOf(config: Record<string, unknown>): TiktokenAddedToken[] {
  const decoder = config.added_tokens_decoder;
  if (typeof decoder !== 'object' || decoder === null) {
    return [];
  }

  const tokens: TiktokenAddedToken[] = [];
  for (const [id, value] of Object.entries(decoder as Record<string, { content?: unknown; special?: unknown }>)) {
    if (Number.isInteger(Number(id)) && typeof value?.content === 'string') {
      tokens.push({ id: Number(id), content: value.content, special: value.special === true });
    }
  }
  return tokens;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
