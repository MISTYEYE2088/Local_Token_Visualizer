# Local Token Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension that counts and visualizes LLM tokens offline using a locally configured Hugging Face tokenizer directory.

**Architecture:** Scaffold a TypeScript VS Code extension, then split behavior into small units: configuration, status text formatting, viewport decoration bucketing, tokenizer loading, and extension event wiring. Unit-test pure logic with Vitest first, then add VS Code integration coverage for activation and package metadata.

**Tech Stack:** TypeScript, VS Code Extension API, `@huggingface/transformers`, Vitest, ESLint, `@vscode/test-electron`, `vsce`, `ovsx`.

---

## File Structure

- Create `package.json`: VS Code extension manifest, scripts, configuration contributions, activation events, and dependencies.
- Create `tsconfig.json`: TypeScript compiler settings for Node 20 and VS Code extension host output.
- Create `.vscodeignore`: Package exclusions for tests, source maps, and dev files.
- Create `.gitignore`: Ignore `node_modules`, `out`, coverage, and generated package files.
- Create `src/extension.ts`: Extension activation/deactivation and event wiring bootstrap.
- Create `src/configuration.ts`: Reads and validates `localTokenizer` settings.
- Create `src/statusBar.ts`: Creates and updates the token count status bar item.
- Create `src/debounce.ts`: Small debounce scheduler used by extension event handlers.
- Create `src/decorations.ts`: Defines palette metadata and converts token offsets into five visible decoration buckets.
- Create `src/tokenizerService.ts`: Loads and caches the local Hugging Face tokenizer and tokenizes documents offline.
- Create `src/controller.ts`: Coordinates active editor refreshes, tokenization, status updates, and decorations.
- Create `src/test/*.test.ts`: Vitest unit tests for pure logic.
- Create `src/test/suite/extension.test.ts`: VS Code integration smoke test.
- Create `src/test/suite/index.ts`: Mocha runner entry point for `@vscode/test-electron`.
- Create `vitest.config.ts`: Vitest configuration.
- Create `.vscode-test.mjs`: VS Code test runner script.
- Create `.eslintrc.cjs`: TypeScript lint configuration.

## Task 1: Scaffold Extension Manifest and Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `vitest.config.ts`
- Create: `.eslintrc.cjs`

- [ ] **Step 1: Create `package.json`**

Use this manifest:

```json
{
  "name": "local-token-visualizer",
  "displayName": "Local Token Visualizer",
  "description": "Visualize and count LLM tokens offline using a local Hugging Face tokenizer.",
  "version": "0.0.1",
  "publisher": "local-token-visualizer",
  "license": "MIT",
  "engines": {
    "vscode": "^1.92.0"
  },
  "categories": [
    "Other"
  ],
  "activationEvents": [
    "onStartupFinished",
    "onLanguage"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "configuration": {
      "title": "Local Token Visualizer",
      "properties": {
        "localTokenizer.modelPath": {
          "type": "string",
          "default": "",
          "description": "Absolute path to a local Hugging Face tokenizer directory containing tokenizer.json."
        },
        "localTokenizer.enableHighlighting": {
          "type": "boolean",
          "default": true,
          "description": "Enable the looping rainbow token overlay in visible editor ranges."
        }
      }
    }
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:vscode": "npm run compile && node .vscode-test.mjs",
    "package": "vsce package",
    "publish:open-vsx": "ovsx publish"
  },
  "dependencies": {
    "@huggingface/transformers": "^3.7.2"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.7",
    "@types/node": "^20.14.15",
    "@types/vscode": "^1.92.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@vscode/test-electron": "^2.4.1",
    "@vscode/vsce": "^3.1.0",
    "eslint": "^8.57.0",
    "mocha": "^10.7.3",
    "ovsx": "^0.10.3",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": [
      "ES2022"
    ],
    "outDir": "out",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "types": [
      "node",
      "vscode",
      "mocha"
    ]
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "out"
  ]
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
out/
coverage/
*.vsix
.vscode-test/
```

- [ ] **Step 4: Create `.vscodeignore`**

```gitignore
src/**
coverage/**
.vscode-test/**
docs/**
*.map
vitest.config.ts
.eslintrc.cjs
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    exclude: ['src/test/suite/**/*.test.ts'],
    globals: false
  }
});
```

- [ ] **Step 6: Create `.eslintrc.cjs`**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
};
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 8: Run compile to confirm empty scaffold needs source**

Run: `npm run compile`

Expected: FAIL with `TS18003: No inputs were found in config file` because `src` files do not exist yet.

- [ ] **Step 9: Commit scaffold files**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .vscodeignore vitest.config.ts .eslintrc.cjs
git commit -m "chore: scaffold extension tooling"
```

## Task 2: Configuration Reader

**Files:**
- Create: `src/configuration.ts`
- Test: `src/test/configuration.test.ts`

- [ ] **Step 1: Write the failing configuration tests**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/configuration.test.ts`

Expected: FAIL with module resolution error for `../configuration`.

- [ ] **Step 3: Implement minimal configuration reader**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/configuration.test.ts`

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit configuration reader**

```bash
git add src/configuration.ts src/test/configuration.test.ts
git commit -m "feat: read tokenizer configuration"
```

## Task 3: Status Bar Formatting

**Files:**
- Create: `src/statusBar.ts`
- Test: `src/test/statusBar.test.ts`

- [ ] **Step 1: Write the failing status formatting tests**

```typescript
import { describe, expect, it } from 'vitest';
import { formatStatusBarText, TOKEN_STATUS_PRIORITY } from '../statusBar';

describe('formatStatusBarText', () => {
  it('formats a token count', () => {
    expect(formatStatusBarText({ kind: 'count', count: 1234 })).toBe('$(symbol-numeric) Tokens: 1,234');
  });

  it('formats missing configuration', () => {
    expect(formatStatusBarText({ kind: 'missingPath' })).toBe('$(symbol-numeric) Tokens: Configure tokenizer');
  });

  it('formats loading state', () => {
    expect(formatStatusBarText({ kind: 'loading' })).toBe('$(sync~spin) Tokens: Loading');
  });

  it('formats disabled state', () => {
    expect(formatStatusBarText({ kind: 'disabled', count: 9 })).toBe('$(symbol-numeric) Tokens: 9');
  });

  it('formats error state', () => {
    expect(formatStatusBarText({ kind: 'error' })).toBe('$(error) Tokens: Error');
  });
});

describe('TOKEN_STATUS_PRIORITY', () => {
  it('targets the indentation and language status cluster', () => {
    expect(TOKEN_STATUS_PRIORITY).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/statusBar.test.ts`

Expected: FAIL with module resolution error for `../statusBar`.

- [ ] **Step 3: Implement status formatting and VS Code wrapper**

```typescript
import * as vscode from 'vscode';

export const TOKEN_STATUS_PRIORITY = 100;

export type TokenStatus =
  | { kind: 'count'; count: number }
  | { kind: 'missingPath' }
  | { kind: 'loading' }
  | { kind: 'disabled'; count: number }
  | { kind: 'error' };

export function formatStatusBarText(status: TokenStatus): string {
  switch (status.kind) {
    case 'count':
      return `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')}`;
    case 'missingPath':
      return '$(symbol-numeric) Tokens: Configure tokenizer';
    case 'loading':
      return '$(sync~spin) Tokens: Loading';
    case 'disabled':
      return `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')}`;
    case 'error':
      return '$(error) Tokens: Error';
  }
}

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, TOKEN_STATUS_PRIORITY);
    this.item.name = 'Local Token Visualizer';
    this.item.show();
  }

  update(status: TokenStatus): void {
    this.item.text = formatStatusBarText(status);
    this.item.tooltip = this.tooltipFor(status);
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }

  private tooltipFor(status: TokenStatus): string {
    switch (status.kind) {
      case 'missingPath':
        return 'Set localTokenizer.modelPath to a local Hugging Face tokenizer directory.';
      case 'loading':
        return 'Loading local tokenizer.';
      case 'error':
        return 'Tokenization failed. Check the configured local tokenizer path.';
      case 'disabled':
        return 'Highlighting is disabled; token counting is still active.';
      case 'count':
        return 'Current document token count.';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/statusBar.test.ts`

Expected: PASS with 6 tests passing.

- [ ] **Step 5: Commit status formatting**

```bash
git add src/statusBar.ts src/test/statusBar.test.ts
git commit -m "feat: format token status bar states"
```

## Task 4: Decoration Bucketing

**Files:**
- Create: `src/decorations.ts`
- Test: `src/test/decorations.test.ts`

- [ ] **Step 1: Write the failing decoration bucketing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { PASTEL_TOKEN_COLORS, bucketVisibleOffsets, intersectsRange } from '../decorations';

describe('PASTEL_TOKEN_COLORS', () => {
  it('defines five looping colors', () => {
    expect(PASTEL_TOKEN_COLORS).toHaveLength(5);
  });
});

describe('intersectsRange', () => {
  it('detects overlapping offsets', () => {
    expect(intersectsRange([5, 10], [0, 5])).toBe(false);
    expect(intersectsRange([5, 10], [0, 6])).toBe(true);
    expect(intersectsRange([5, 10], [10, 12])).toBe(false);
    expect(intersectsRange([5, 10], [9, 12])).toBe(true);
  });
});

describe('bucketVisibleOffsets', () => {
  it('places visible token offsets into modulo color buckets', () => {
    const buckets = bucketVisibleOffsets(
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6]
      ],
      [[1, 5]]
    );

    expect(buckets).toEqual([
      [],
      [[1, 2]],
      [[2, 3]],
      [[3, 4]],
      [[4, 5]]
    ]);
  });

  it('skips zero-length and invalid offsets', () => {
    const buckets = bucketVisibleOffsets(
      [
        [0, 0],
        [3, 2],
        [2, 4]
      ],
      [[0, 10]]
    );

    expect(buckets).toEqual([[], [], [[2, 4]], [], []]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/decorations.test.ts`

Expected: FAIL with module resolution error for `../decorations`.

- [ ] **Step 3: Implement palette and offset bucketing**

```typescript
import * as vscode from 'vscode';

export type OffsetRange = readonly [number, number];

export const PASTEL_TOKEN_COLORS = [
  { dark: 'rgba(102, 194, 165, 0.25)', light: 'rgba(102, 194, 165, 0.4)' },
  { dark: 'rgba(252, 141, 98, 0.25)', light: 'rgba(252, 141, 98, 0.4)' },
  { dark: 'rgba(141, 160, 203, 0.25)', light: 'rgba(141, 160, 203, 0.4)' },
  { dark: 'rgba(231, 138, 195, 0.25)', light: 'rgba(231, 138, 195, 0.4)' },
  { dark: 'rgba(166, 216, 84, 0.25)', light: 'rgba(166, 216, 84, 0.4)' }
] as const;

export function intersectsRange(token: OffsetRange, visible: OffsetRange): boolean {
  return token[0] < visible[1] && token[1] > visible[0];
}

export function bucketVisibleOffsets(offsets: OffsetRange[], visibleOffsets: OffsetRange[]): OffsetRange[][] {
  const buckets: OffsetRange[][] = [[], [], [], [], []];

  offsets.forEach((offset, index) => {
    if (offset[0] >= offset[1]) {
      return;
    }

    if (visibleOffsets.some((visible) => intersectsRange(offset, visible))) {
      buckets[index % buckets.length].push(offset);
    }
  });

  return buckets;
}

export class DecorationManager implements vscode.Disposable {
  private readonly decorationTypes = PASTEL_TOKEN_COLORS.map((color) =>
    vscode.window.createTextEditorDecorationType({
      light: { backgroundColor: color.light },
      dark: { backgroundColor: color.dark },
      borderRadius: '2px'
    })
  );

  apply(editor: vscode.TextEditor, offsets: OffsetRange[]): void {
    const visibleOffsets = editor.visibleRanges.map((range) => [
      editor.document.offsetAt(range.start),
      editor.document.offsetAt(range.end)
    ] as OffsetRange);
    const buckets = bucketVisibleOffsets(offsets, visibleOffsets);

    this.decorationTypes.forEach((decorationType, index) => {
      const ranges = buckets[index].map((offset) => new vscode.Range(
        editor.document.positionAt(offset[0]),
        editor.document.positionAt(offset[1])
      ));
      editor.setDecorations(decorationType, ranges);
    });
  }

  clear(editor: vscode.TextEditor): void {
    this.decorationTypes.forEach((decorationType) => {
      editor.setDecorations(decorationType, []);
    });
  }

  dispose(): void {
    this.decorationTypes.forEach((decorationType) => decorationType.dispose());
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/decorations.test.ts`

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit decoration bucketing**

```bash
git add src/decorations.ts src/test/decorations.test.ts
git commit -m "feat: bucket visible token decorations"
```

## Task 5: Debounce Scheduler

**Files:**
- Create: `src/debounce.ts`
- Test: `src/test/debounce.test.ts`

- [ ] **Step 1: Write the failing debounce tests**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Debouncer } from '../debounce';

describe('Debouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the latest callback after the delay', () => {
    const first = vi.fn();
    const second = vi.fn();
    const debouncer = new Debouncer(300);

    debouncer.schedule(first);
    debouncer.schedule(second);
    vi.advanceTimersByTime(299);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancels pending callbacks', () => {
    const callback = vi.fn();
    const debouncer = new Debouncer(300);

    debouncer.schedule(callback);
    debouncer.dispose();
    vi.advanceTimersByTime(300);

    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/debounce.test.ts`

Expected: FAIL with module resolution error for `../debounce`.

- [ ] **Step 3: Implement debouncer**

```typescript
export class Debouncer {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly delayMs: number) {}

  schedule(callback: () => void): void {
    this.dispose();
    this.timer = setTimeout(callback, this.delayMs);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/debounce.test.ts`

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit debounce scheduler**

```bash
git add src/debounce.ts src/test/debounce.test.ts
git commit -m "feat: debounce token refreshes"
```

## Task 6: Tokenizer Service

**Files:**
- Create: `src/tokenizerService.ts`
- Test: `src/test/tokenizerService.test.ts`

- [ ] **Step 1: Write the failing tokenizer service tests**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { TokenizerService } from '../tokenizerService';

describe('TokenizerService', () => {
  it('loads a tokenizer once per path and returns token count with offsets', async () => {
    const tokenizer = vi.fn().mockResolvedValue({
      input_ids: [101, 102],
      offset_mapping: [[0, 5], [6, 11]]
    });
    const load = vi.fn().mockResolvedValue(tokenizer);
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\tokenizer', 'hello world')).resolves.toEqual({
      count: 2,
      offsets: [[0, 5], [6, 11]]
    });
    await service.tokenize('C:\\models\\tokenizer', 'again');

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('C:\\models\\tokenizer');
  });

  it('reloads when the model path changes', async () => {
    const load = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      input_ids: [1],
      offset_mapping: [[0, 1]]
    }));
    const service = new TokenizerService(load);

    await service.tokenize('C:\\models\\one', 'a');
    await service.tokenize('C:\\models\\two', 'b');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('normalizes missing offset mappings to an empty array', async () => {
    const load = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      input_ids: [1, 2, 3]
    }));
    const service = new TokenizerService(load);

    await expect(service.tokenize('C:\\models\\tokenizer', 'abc')).resolves.toEqual({
      count: 3,
      offsets: []
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/tokenizerService.test.ts`

Expected: FAIL with module resolution error for `../tokenizerService`.

- [ ] **Step 3: Implement tokenizer service**

```typescript
import { AutoTokenizer, env } from '@huggingface/transformers';
import type { OffsetRange } from './decorations';

export interface TokenizationResult {
  count: number;
  offsets: OffsetRange[];
}

export type LoadedTokenizer = (text: string, options: { return_offsets_mapping: true }) => Promise<{
  input_ids?: unknown[];
  offset_mapping?: Array<[number, number]>;
}>;

export type TokenizerLoader = (modelPath: string) => Promise<LoadedTokenizer>;

export async function loadLocalTokenizer(modelPath: string): Promise<LoadedTokenizer> {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  return AutoTokenizer.from_pretrained(modelPath, { local_files_only: true }) as Promise<LoadedTokenizer>;
}

export class TokenizerService {
  private cachedPath: string | undefined;
  private cachedTokenizer: LoadedTokenizer | undefined;

  constructor(private readonly loadTokenizer: TokenizerLoader = loadLocalTokenizer) {}

  async tokenize(modelPath: string, text: string): Promise<TokenizationResult> {
    const tokenizer = await this.getTokenizer(modelPath);
    const output = await tokenizer(text, { return_offsets_mapping: true });

    return {
      count: Array.isArray(output.input_ids) ? output.input_ids.length : 0,
      offsets: Array.isArray(output.offset_mapping) ? output.offset_mapping : []
    };
  }

  reset(): void {
    this.cachedPath = undefined;
    this.cachedTokenizer = undefined;
  }

  private async getTokenizer(modelPath: string): Promise<LoadedTokenizer> {
    if (this.cachedPath === modelPath && this.cachedTokenizer) {
      return this.cachedTokenizer;
    }

    this.cachedTokenizer = await this.loadTokenizer(modelPath);
    this.cachedPath = modelPath;
    return this.cachedTokenizer;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/tokenizerService.test.ts`

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit tokenizer service**

```bash
git add src/tokenizerService.ts src/test/tokenizerService.test.ts
git commit -m "feat: load local tokenizer offline"
```

## Task 7: Controller Wiring

**Files:**
- Create: `src/controller.ts`
- Test: `src/test/controller.test.ts`

- [ ] **Step 1: Write the failing controller tests**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { TokenVisualizerController } from '../controller';

describe('TokenVisualizerController', () => {
  it('shows configure status and clears decorations when model path is missing', async () => {
    const editor = { document: { getText: () => 'hello' } };
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    const tokenizer = { tokenize: vi.fn() };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: '', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    await controller.refresh(editor as never);

    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'missingPath' });
    expect(decorations.clear).toHaveBeenCalledWith(editor);
    expect(tokenizer.tokenize).not.toHaveBeenCalled();
  });

  it('updates count and applies decorations when highlighting is enabled', async () => {
    const editor = { document: { getText: () => 'hello' } };
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    const tokenizer = {
      tokenize: vi.fn().mockResolvedValue({ count: 1, offsets: [[0, 5]] })
    };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: 'C:\\models\\tokenizer', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    await controller.refresh(editor as never);

    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'count', count: 1 });
    expect(decorations.apply).toHaveBeenCalledWith(editor, [[0, 5]]);
  });

  it('updates count and clears decorations when highlighting is disabled', async () => {
    const editor = { document: { getText: () => 'hello' } };
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    const tokenizer = {
      tokenize: vi.fn().mockResolvedValue({ count: 1, offsets: [[0, 5]] })
    };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: 'C:\\models\\tokenizer', enableHighlighting: false }),
      tokenizer,
      decorations,
      statusBar
    );

    await controller.refresh(editor as never);

    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'disabled', count: 1 });
    expect(decorations.clear).toHaveBeenCalledWith(editor);
    expect(decorations.apply).not.toHaveBeenCalled();
  });

  it('handles tokenizer failures without throwing', async () => {
    const editor = { document: { getText: () => 'hello' } };
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    const tokenizer = {
      tokenize: vi.fn().mockRejectedValue(new Error('load failed'))
    };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: 'C:\\models\\bad', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    await expect(controller.refresh(editor as never)).resolves.toBeUndefined();

    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'error' });
    expect(decorations.clear).toHaveBeenCalledWith(editor);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/controller.test.ts`

Expected: FAIL with module resolution error for `../controller`.

- [ ] **Step 3: Implement controller**

```typescript
import type * as vscode from 'vscode';
import type { LocalTokenizerConfig } from './configuration';
import { validateModelPath } from './configuration';
import type { DecorationManager } from './decorations';
import type { StatusBarController } from './statusBar';
import type { TokenizerService } from './tokenizerService';

export class TokenVisualizerController {
  constructor(
    private readonly getConfig: () => LocalTokenizerConfig,
    private readonly tokenizerService: Pick<TokenizerService, 'tokenize'>,
    private readonly decorationManager: Pick<DecorationManager, 'apply' | 'clear'>,
    private readonly statusBar: Pick<StatusBarController, 'update'>
  ) {}

  async refresh(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor) {
      return;
    }

    const config = this.getConfig();
    const validation = validateModelPath(config.modelPath);

    if (!validation.ok) {
      this.statusBar.update({ kind: 'missingPath' });
      this.decorationManager.clear(editor);
      return;
    }

    this.statusBar.update({ kind: 'loading' });

    try {
      const result = await this.tokenizerService.tokenize(validation.path, editor.document.getText());

      if (config.enableHighlighting) {
        this.decorationManager.apply(editor, result.offsets);
        this.statusBar.update({ kind: 'count', count: result.count });
      } else {
        this.decorationManager.clear(editor);
        this.statusBar.update({ kind: 'disabled', count: result.count });
      }
    } catch {
      this.decorationManager.clear(editor);
      this.statusBar.update({ kind: 'error' });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/controller.test.ts`

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit controller**

```bash
git add src/controller.ts src/test/controller.test.ts
git commit -m "feat: coordinate token visualization refreshes"
```

## Task 8: Extension Activation and Event Wiring

**Files:**
- Create: `src/extension.ts`
- Create: `.vscode-test.mjs`
- Create: `src/test/suite/index.ts`
- Test: `src/test/suite/extension.test.ts`

- [ ] **Step 1: Write the failing VS Code activation smoke test**

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
  test('activates local token visualizer extension', async () => {
    const extension = vscode.extensions.getExtension('local-token-visualizer.local-token-visualizer');

    assert.ok(extension, 'extension should be discoverable by id');
    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });
});
```

- [ ] **Step 2: Create `src/test/suite/index.ts`**

```typescript
import * as path from 'node:path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  mocha.addFile(path.resolve(__dirname, './extension.test.js'));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} VS Code integration test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
```

- [ ] **Step 3: Create `.vscode-test.mjs`**

```javascript
import { runTests } from '@vscode/test-electron';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionDevelopmentPath = dirname(fileURLToPath(import.meta.url));
const extensionTestsPath = resolve(extensionDevelopmentPath, './out/test/suite/index.js');

await runTests({
  extensionDevelopmentPath,
  extensionTestsPath
});
```

- [ ] **Step 4: Run VS Code test to verify it fails**

Run: `npm run test:vscode`

Expected: FAIL because `src/extension.ts` does not exist and compile cannot produce the extension entry point.

- [ ] **Step 5: Implement extension activation and event wiring**

```typescript
import * as vscode from 'vscode';
import { readLocalTokenizerConfig } from './configuration';
import { TokenVisualizerController } from './controller';
import { Debouncer } from './debounce';
import { DecorationManager } from './decorations';
import { StatusBarController } from './statusBar';
import { TokenizerService } from './tokenizerService';

const REFRESH_DELAY_MS = 300;

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarController();
  const decorations = new DecorationManager();
  const tokenizerService = new TokenizerService();
  const debouncer = new Debouncer(REFRESH_DELAY_MS);
  const controller = new TokenVisualizerController(
    () => readLocalTokenizerConfig(vscode.workspace.getConfiguration('localTokenizer')),
    tokenizerService,
    decorations,
    statusBar
  );

  const scheduleRefresh = (editor = vscode.window.activeTextEditor): void => {
    debouncer.schedule(() => {
      void controller.refresh(editor);
    });
  };

  context.subscriptions.push(
    statusBar,
    decorations,
    debouncer,
    vscode.window.onDidChangeActiveTextEditor((editor) => scheduleRefresh(editor)),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => scheduleRefresh(event.textEditor)),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (vscode.window.activeTextEditor?.document === event.document) {
        scheduleRefresh(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('localTokenizer')) {
        tokenizerService.reset();
        scheduleRefresh(vscode.window.activeTextEditor);
      }
    })
  );

  scheduleRefresh(vscode.window.activeTextEditor);
}

export function deactivate(): void {}
```

- [ ] **Step 6: Run VS Code test to verify it passes**

Run: `npm run test:vscode`

Expected: PASS with the activation test passing.

- [ ] **Step 7: Run unit tests after activation wiring**

Run: `npm test`

Expected: PASS with all Vitest unit tests passing.

- [ ] **Step 8: Commit activation wiring**

```bash
git add src/extension.ts src/test/suite/index.ts src/test/suite/extension.test.ts .vscode-test.mjs
git commit -m "feat: activate token visualizer extension"
```

## Task 9: Final Verification and Packaging

**Files:**
- Modify as needed only if verification exposes defects.

- [ ] **Step 1: Run TypeScript compile**

Run: `npm run compile`

Expected: PASS with exit code 0 and no TypeScript errors.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: PASS with all Vitest tests passing.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS with no ESLint errors.

- [ ] **Step 4: Run VS Code smoke test**

Run: `npm run test:vscode`

Expected: PASS with the extension activation test passing.

- [ ] **Step 5: Build local VSIX package**

Run: `npm run package`

Expected: PASS and creates `local-token-visualizer-0.0.1.vsix`.

- [ ] **Step 6: Review git diff**

Run: `git status --short` and `git diff --stat`

Expected: Only intended extension, tests, docs, and package files are changed.

- [ ] **Step 7: Commit final verification fixes if any were needed**

If verification required edits, commit them:

```bash
git add .
git commit -m "chore: finalize token visualizer verification"
```

If no verification edits were needed, skip this commit because the previous task commits already captured the implementation.

## Self-Review

- Spec coverage: The plan covers local tokenizer configuration, offline tokenizer loading, status bar placement priority, 5-color light/dark overlay palette, 300ms debouncing, visible-range decoration filtering, graceful missing-path/load/tokenization error states, tests, VS Code activation, and packaging.
- Placeholder scan: The plan contains no placeholder tasks; every implementation task includes concrete files, code, commands, and expected outcomes.
- Type consistency: `LocalTokenizerConfig`, `OffsetRange`, `TokenizerService`, `DecorationManager`, `StatusBarController`, `TokenVisualizerController`, and `Debouncer` names are defined before use in later tasks.
