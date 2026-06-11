export interface ConfigurationLike {
  get<T>(key: string, fallback: T): T;
}

export interface LocalTokenizerConfig {
  modelPath: string;
  enableHighlighting: boolean;
}

export type ModelPathValidation =
  | { ok: true; path: string }
  | { ok: false; reason: 'missing' };

export function readLocalTokenizerConfig(config: ConfigurationLike): LocalTokenizerConfig {
  return {
    modelPath: config.get('modelPath', '').trim(),
    enableHighlighting: config.get('enableHighlighting', true)
  };
}

export function validateModelPath(modelPath: string): ModelPathValidation {
  const trimmed = modelPath.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: 'missing' };
  }

  return { ok: true, path: trimmed };
}
