import catalogJson from './catalog.json';

export interface CatalogEntry {
  id: string;
  label: string;
  vendor: string;
  repo: string;
  revision: string;
  bundled: boolean;
  description: string;
  license: string;
  note?: string;
  sha256?: string;
}

export const CATALOG: readonly CatalogEntry[] = catalogJson.tokenizers;
export const DEFAULT_MODEL_ID: string = catalogJson.defaultModel;

const HF_REPO_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function findCatalogEntry(model: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.id === model);
}

export function isHuggingFaceRepoId(value: string): boolean {
  return HF_REPO_ID.test(value) && !value.includes('..');
}

export function isValidModelId(value: string): boolean {
  return findCatalogEntry(value) !== undefined || isHuggingFaceRepoId(value);
}

/** Folder name used on disk for a catalog id or Hugging Face repo id. */
export function slugForModel(model: string): string {
  return model.replace('/', '--');
}

export function labelForModel(model: string): string {
  return findCatalogEntry(model)?.label ?? model;
}
