import { describe, expect, it } from 'vitest';
import {
  highlightModeOf,
  nextHighlightSettings,
  readLocalTokenizerConfig,
  validateModelPath
} from '../configuration';

describe('readLocalTokenizerConfig', () => {
  it('reads model path and highlighting setting from a VS Code-like configuration object', () => {
    const config = {
      get<T>(key: string, fallback: T): T {
        const values: Record<string, unknown> = {
          modelPath: 'C:\\models\\llama-tokenizer',
          enableHighlighting: false
        };
        return (values[key] ?? fallback) as T;
      }
    };

    expect(readLocalTokenizerConfig(config)).toEqual({
      modelPath: 'C:\\models\\llama-tokenizer',
      enableHighlighting: false,
      showSplitCharCount: true,
      model: 'gpt-4o'
    });
  });

  it('trims model paths and defaults highlighting to true', () => {
    const config = {
      get<T>(key: string, fallback: T): T {
        return (key === 'modelPath' ? '  C:\\models\\qwen  ' : fallback) as T;
      }
    };

    expect(readLocalTokenizerConfig(config)).toEqual({
      modelPath: 'C:\\models\\qwen',
      enableHighlighting: true,
      showSplitCharCount: true,
      model: 'gpt-4o'
    });
  });

  it('reads the selected model and falls back to the default when it is blank', () => {
    const withModel = (model: string) => ({
      get<T>(key: string, fallback: T): T {
        return (key === 'model' ? model : fallback) as T;
      }
    });

    expect(readLocalTokenizerConfig(withModel(' Qwen/Qwen2.5-0.5B ')).model).toBe('Qwen/Qwen2.5-0.5B');
    expect(readLocalTokenizerConfig(withModel('   ')).model).toBe('gpt-4o');
  });
});

describe('validateModelPath', () => {
  it('returns configure status when the path is blank', () => {
    expect(validateModelPath('')).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  it('accepts a non-empty path', () => {
    expect(validateModelPath('C:\\models\\mistral')).toEqual({
      ok: true,
      path: 'C:\\models\\mistral'
    });
  });
});

describe('highlight mode cycle', () => {
  it('reads the mode from the two settings', () => {
    expect(highlightModeOf({ enableHighlighting: true, showSplitCharCount: true })).toBe('full');
    expect(highlightModeOf({ enableHighlighting: true, showSplitCharCount: false })).toBe('noSubscript');
    expect(highlightModeOf({ enableHighlighting: false, showSplitCharCount: true })).toBe('off');
    expect(highlightModeOf({ enableHighlighting: false, showSplitCharCount: false })).toBe('off');
  });

  it('cycles full, then no subscript, then off, then full again', () => {
    const full = { enableHighlighting: true, showSplitCharCount: true };
    const noSubscript = nextHighlightSettings(full);
    const off = nextHighlightSettings(noSubscript);

    expect(noSubscript).toEqual({ enableHighlighting: true, showSplitCharCount: false });
    expect(off).toEqual({ enableHighlighting: false, showSplitCharCount: false });
    expect(nextHighlightSettings(off)).toEqual(full);
  });

  it('turns highlighting back on with the subscript shown, even if only highlighting was switched off before', () => {
    expect(nextHighlightSettings({ enableHighlighting: false, showSplitCharCount: true })).toEqual({
      enableHighlighting: true,
      showSplitCharCount: true
    });
  });
});
