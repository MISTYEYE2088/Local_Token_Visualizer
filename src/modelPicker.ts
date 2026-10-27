import type { CatalogEntry } from './catalog';

export type PickerAction =
  | { type: 'model'; model: string }
  | { type: 'customHuggingFace' }
  | { type: 'browseFolder' };

export interface PickerRow {
  separator?: boolean;
  label: string;
  description?: string;
  detail?: string;
  action?: PickerAction;
}

export interface PickerState {
  catalog: readonly CatalogEntry[];
  /** True when the tokenizer files for a model id are already on disk. */
  isAvailable: (model: string) => boolean;
  /** Hugging Face repo ids downloaded earlier that are not in the catalog. */
  customDownloads: readonly string[];
  /** The model id currently selected, if any. */
  current: string | undefined;
  /** True when a custom local folder (localTokenizer.modelPath) overrides the selection. */
  usingCustomFolder: boolean;
}

export function buildPickerRows(state: PickerState): PickerRow[] {
  const rows: PickerRow[] = [];
  const isCurrent = (model: string): boolean => !state.usingCustomFolder && state.current === model;

  const ready = state.catalog.filter((entry) => state.isAvailable(entry.id));
  const downloadable = state.catalog.filter((entry) => !state.isAvailable(entry.id));

  rows.push({ separator: true, label: 'Ready to use' });
  for (const entry of ready) {
    rows.push(catalogRow(entry, isCurrent(entry.id) ? '$(check) ' : '', entry.bundled ? 'built in' : 'downloaded'));
  }
  for (const repo of state.customDownloads) {
    rows.push({
      label: `${isCurrent(repo) ? '$(check) ' : ''}${repo}`,
      description: 'downloaded',
      detail: 'Custom Hugging Face tokenizer',
      action: { type: 'model', model: repo }
    });
  }

  if (downloadable.length > 0) {
    rows.push({ separator: true, label: 'Download from Hugging Face' });
    for (const entry of downloadable) {
      rows.push(catalogRow(entry, isCurrent(entry.id) ? '$(warning) ' : '$(cloud-download) ', 'download'));
    }
  }

  rows.push({ separator: true, label: 'More' });
  rows.push({
    label: '$(search) Enter a Hugging Face model ID…',
    detail: 'Download any public repository that has a tokenizer.json, e.g. mistralai/Ministral-3-3B-Instruct-2512',
    action: { type: 'customHuggingFace' }
  });
  rows.push({
    label: `${state.usingCustomFolder ? '$(check) ' : '$(folder-opened) '}Use a local folder…`,
    detail: 'Pick a folder that already contains tokenizer.json',
    action: { type: 'browseFolder' }
  });

  return rows;
}

function catalogRow(entry: CatalogEntry, icon: string, status: string): PickerRow {
  const detail = [entry.description, entry.note].filter(Boolean).join(' — ');
  return {
    label: `${icon}${entry.label}`,
    description: `${entry.vendor} · ${status}`,
    detail,
    action: { type: 'model', model: entry.id }
  };
}
