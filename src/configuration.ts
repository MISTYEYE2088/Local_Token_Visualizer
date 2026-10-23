import { DEFAULT_MODEL_ID } from './catalog';

export interface ConfigurationLike {
  get<T>(key: string, fallback: T): T;
}

export interface LocalTokenizerConfig {
  modelPath: string;
  enableHighlighting: boolean;
  /** Catalog id or Hugging Face repo id chosen from the tokenizer menu. */
  model: string;
  /** Human-readable name of the active tokenizer, filled in once it is resolved. */
  modelLabel?: string;
}

export type ModelPathValidation =
  | { ok: true; path: string }
  | { ok: false; reason: 'missing' };

export function readLocalTokenizerConfig(config: ConfigurationLike): LocalTokenizerConfig {
  return {
    modelPath: config.get('modelPath', '').trim(),
    enableHighlighting: config.get('enableHighlighting', true),
    model: config.get('model', DEFAULT_MODEL_ID).trim() || DEFAULT_MODEL_ID
  };
}

export function validateModelPath(modelPath: string): ModelPathValidation {
  const trimmed = modelPath.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: 'missing' };
  }

  return { ok: true, path: trimmed };
}
