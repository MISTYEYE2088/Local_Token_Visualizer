import { describe, expect, it } from 'vitest';
import { readLocalTokenizerConfig, validateModelPath } from '../configuration';

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
      enableHighlighting: false
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
      enableHighlighting: true
    });
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
