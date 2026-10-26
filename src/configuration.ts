import { DEFAULT_MODEL_ID } from './catalog';

export interface ConfigurationLike {
  get<T>(key: string, fallback: T): T;
}

export interface LocalTokenizerConfig {
  modelPath: string;
  enableHighlighting: boolean;
  /** Show the subscript token count next to characters that are split across several tokens. */
  showSplitCharCount: boolean;
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
    showSplitCharCount: config.get('showSplitCharCount', true),
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

/** What a click on the status bar cycles through: everything, no subscript digits, nothing. */
export type HighlightMode = 'full' | 'noSubscript' | 'off';

export type HighlightSettings = Pick<LocalTokenizerConfig, 'enableHighlighting' | 'showSplitCharCount'>;

export function highlightModeOf(settings: HighlightSettings): HighlightMode {
  if (!settings.enableHighlighting) {
    return 'off';
  }

  return settings.showSplitCharCount ? 'full' : 'noSubscript';
}

export function nextHighlightSettings(settings: HighlightSettings): HighlightSettings {
  switch (highlightModeOf(settings)) {
    case 'full':
      return { enableHighlighting: true, showSplitCharCount: false };
    case 'noSubscript':
      return { enableHighlighting: false, showSplitCharCount: false };
    case 'off':
      return { enableHighlighting: true, showSplitCharCount: true };
  }
}
