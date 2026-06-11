import { AutoTokenizer, env } from '@huggingface/transformers';
import type { OffsetRange } from './decorations';

export interface TokenizationResult {
  count: number;
  offsets: OffsetRange[];
}

export type LoadedTokenizer = (
  text: string,
  options: { return_offsets_mapping: true }
) => Promise<{
  input_ids?: unknown[];
  offset_mapping?: OffsetRange[];
}>;

export type TokenizerLoader = (modelPath: string) => Promise<LoadedTokenizer>;

export async function loadLocalTokenizer(modelPath: string): Promise<LoadedTokenizer> {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  return AutoTokenizer.from_pretrained(modelPath, { local_files_only: true }) as Promise<LoadedTokenizer>;
}

export class TokenizerService {
  private cachedPath: string | undefined;
  private cachedTokenizer: LoadedTokenizer | undefined;

  constructor(private readonly loadTokenizer: TokenizerLoader = loadLocalTokenizer) {}

  async tokenize(modelPath: string, text: string): Promise<TokenizationResult> {
    const tokenizer = await this.getTokenizer(modelPath);
    const output = await tokenizer(text, { return_offsets_mapping: true });

    return {
      count: Array.isArray(output.input_ids) ? output.input_ids.length : 0,
      offsets: Array.isArray(output.offset_mapping) ? output.offset_mapping : []
    };
  }

  reset(): void {
    this.cachedPath = undefined;
    this.cachedTokenizer = undefined;
  }

  private async getTokenizer(modelPath: string): Promise<LoadedTokenizer> {
    if (this.cachedPath === modelPath && this.cachedTokenizer) {
      return this.cachedTokenizer;
    }

    this.cachedTokenizer = await this.loadTokenizer(modelPath);
    this.cachedPath = modelPath;
    return this.cachedTokenizer;
  }
}
