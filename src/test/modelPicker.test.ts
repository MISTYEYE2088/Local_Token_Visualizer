import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { buildPickerRows, type PickerState } from '../modelPicker';

function state(overrides: Partial<PickerState> = {}): PickerState {
  return {
    catalog: CATALOG,
    isAvailable: (model) => CATALOG.find((entry) => entry.id === model)?.bundled ?? false,
    customDownloads: [],
    current: 'gpt-4o',
    usingCustomFolder: false,
    ...overrides
  };
}

describe('buildPickerRows', () => {
  it('groups ready tokenizers, downloads, and the custom options', () => {
    const rows = buildPickerRows(state());

    expect(rows.filter((row) => row.separator).map((row) => row.label)).toEqual([
      'Ready to use',
      'Download from Hugging Face',
      'More'
    ]);
    expect(rows.filter((row) => row.action?.type === 'customHuggingFace')).toHaveLength(1);
    expect(rows.filter((row) => row.action?.type === 'browseFolder')).toHaveLength(1);
  });

  it('lists every catalog entry exactly once', () => {
    const models = buildPickerRows(state())
      .filter((row) => row.action?.type === 'model')
      .map((row) => (row.action as { model: string }).model);

    expect(models.sort()).toEqual(CATALOG.map((entry) => entry.id).sort());
  });

  it('marks the current tokenizer and labels download rows', () => {
    const rows = buildPickerRows(state());
    const current = rows.find((row) => row.action?.type === 'model' && row.action.model === 'gpt-4o')!;
    const llama = rows.find((row) => row.action?.type === 'model' && row.action.model === 'llama-3')!;
    const gemma = rows.find((row) => row.action?.type === 'model' && row.action.model === 'gemma-4')!;

    expect(current.label).toContain('$(check)');
    expect(current.description).toContain('built in');
    expect(llama.label).toContain('$(cloud-download)');
    expect(llama.description).toContain('Meta');
    expect(gemma.description).toContain('built in');
    expect(gemma.detail).toContain('Gemini');
  });

  it('moves downloaded tokenizers into the ready section', () => {
    const rows = buildPickerRows(state({ isAvailable: () => true }));

    expect(rows.some((row) => row.separator && row.label === 'Download from Hugging Face')).toBe(false);
    expect(rows.find((row) => row.action?.type === 'model' && row.action.model === 'llama-3')?.description).toContain(
      'downloaded'
    );
  });

  it('includes custom Hugging Face downloads', () => {
    const rows = buildPickerRows(state({ customDownloads: ['acme/model'], current: 'acme/model' }));
    const custom = rows.find((row) => row.action?.type === 'model' && row.action.model === 'acme/model')!;

    expect(custom.label).toBe('$(check) acme/model');
  });

  it('shows the folder option as selected instead of a catalog entry when a folder override is active', () => {
    const rows = buildPickerRows(state({ usingCustomFolder: true }));

    expect(rows.filter((row) => row.label.includes('$(check)')).map((row) => row.action?.type)).toEqual(['browseFolder']);
  });
});
