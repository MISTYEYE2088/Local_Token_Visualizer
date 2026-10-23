import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DEFAULT_MODEL_ID,
  findCatalogEntry,
  isHuggingFaceRepoId,
  isValidModelId,
  labelForModel,
  slugForModel
} from '../catalog';

describe('catalog', () => {
  it('has unique ids and a default that is bundled so it works offline', () => {
    const ids = CATALOG.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(findCatalogEntry(DEFAULT_MODEL_ID)?.bundled).toBe(true);
  });

  it('pins every entry to a full commit and every bundled entry to a checksum', () => {
    for (const entry of CATALOG) {
      expect(entry.revision, entry.id).toMatch(/^[0-9a-f]{40}$/);
      if (entry.bundled) {
        expect(entry.sha256, entry.id).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it('only bundles tokenizers with a permissive license', () => {
    for (const entry of CATALOG.filter((candidate) => candidate.bundled)) {
      expect(entry.license, entry.id).toMatch(/MIT|Apache/);
    }
  });

  it('warns that Gemini counts are approximate and ships no outdated Claude tokenizer', () => {
    expect(findCatalogEntry('gemma-4')?.note).toMatch(/Gemini/);
    expect(CATALOG.some((entry) => /claude/i.test(entry.id))).toBe(false);
  });

  it('bundles the current OpenAI and Google tokenizers', () => {
    expect(CATALOG.filter((entry) => entry.bundled).map((entry) => entry.id)).toEqual([
      'gpt-4o',
      'o200k-harmony',
      'gemma-4'
    ]);
  });
});

describe('model ids', () => {
  it('accepts catalog ids and owner/name repository ids', () => {
    expect(isValidModelId('gpt-4o')).toBe(true);
    expect(isValidModelId('Qwen/Qwen2.5-0.5B')).toBe(true);
    expect(isHuggingFaceRepoId('mistralai/Mistral-7B-v0.1')).toBe(true);
  });

  it.each(['', 'nonsense', '../etc/passwd', 'a/../b', '/abs/path', 'a/b/c', 'a b/c', '.hidden/x', 'C:\\models\\x'])(
    'rejects %j so it can never escape the storage folder',
    (value) => {
      expect(isValidModelId(value)).toBe(false);
    }
  );

  it('builds a flat folder name and a friendly label', () => {
    expect(slugForModel('Qwen/Qwen2.5-0.5B')).toBe('Qwen--Qwen2.5-0.5B');
    expect(slugForModel('gpt-4o')).toBe('gpt-4o');
    expect(labelForModel('gpt-4o')).toBe('GPT-4o / o-series (o200k_base)');
    expect(labelForModel('Qwen/Qwen2.5-0.5B')).toBe('Qwen/Qwen2.5-0.5B');
  });
});
