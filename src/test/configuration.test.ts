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
      enableHighlighting: false,
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
