#!/usr/bin/env node
// Downloads tokenizer files from Hugging Face into ./tokenizers/<id>/.
//
//   node scripts/fetch-tokenizers.mjs            fetch every bundled tokenizer in src/catalog.json
//   node scripts/fetch-tokenizers.mjs --all      fetch every catalog entry
//   node scripts/fetch-tokenizers.mjs gpt-4o     fetch specific catalog ids
//
// Each entry is pinned to a commit in src/catalog.json. Bundled entries are also
// verified against a SHA-256 checksum, so a changed upstream file fails the build.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'src', 'catalog.json'), 'utf8'));
const outRoot = path.join(root, 'tokenizers');

const args = process.argv.slice(2);
const wanted = args.includes('--all')
  ? catalog.tokenizers
  : args.filter((a) => !a.startsWith('--')).length > 0
    ? args.filter((a) => !a.startsWith('--')).map((id) => {
        const entry = catalog.tokenizers.find((t) => t.id === id);
        if (!entry) {
          throw new Error(`Unknown tokenizer id "${id}". Known ids: ${catalog.tokenizers.map((t) => t.id).join(', ')}`);
        }
        return entry;
      })
    : catalog.tokenizers.filter((t) => t.bundled);

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function download(entry, file, optional) {
  const url = `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/${file}`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.status === 404 && optional) {
        return undefined;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
      }
    }
  }
  throw lastError;
}

async function isUpToDate(entry, dir) {
  try {
    const existing = await fs.readFile(path.join(dir, 'tokenizer.json'));
    return entry.sha256 ? sha256(existing) === entry.sha256 : true;
  } catch {
    return false;
  }
}

for (const entry of wanted) {
  const dir = path.join(outRoot, entry.id);
  if (await isUpToDate(entry, dir)) {
    console.log(`ok       ${entry.id} (already present)`);
    continue;
  }

  const tokenizerJson = await download(entry, 'tokenizer.json', false);
  if (entry.sha256 && sha256(tokenizerJson) !== entry.sha256) {
    throw new Error(
      `Checksum mismatch for ${entry.id} (${entry.repo}@${entry.revision.slice(0, 8)}). ` +
        'Refusing to continue; update src/catalog.json only if you reviewed the upstream change.'
    );
  }
  const tokenizerConfig = await download(entry, 'tokenizer_config.json', true);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'tokenizer.json'), tokenizerJson);
  if (tokenizerConfig) {
    await fs.writeFile(path.join(dir, 'tokenizer_config.json'), tokenizerConfig);
  }
  console.log(`fetched  ${entry.id} (${(tokenizerJson.length / 1048576).toFixed(1)} MB) from ${entry.repo}`);
}
