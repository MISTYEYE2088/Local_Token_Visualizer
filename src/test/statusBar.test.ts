import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOGGLE_COMMAND = 'local-token-visualizer.toggleHighlighting';

const fakeItem = {
  name: '' as string,
  text: '' as string,
  tooltip: '' as unknown,
  command: undefined as string | undefined,
  show: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('vscode', () => ({
  MarkdownString: class {
    isTrusted: unknown;
    constructor(public value: string) {}
  },
  StatusBarAlignment: { Right: 2 },
  window: {
    createStatusBarItem: vi.fn(() => fakeItem),
  },
}));

import { formatStatusBarText, StatusBarController, TOKEN_STATUS_PRIORITY } from '../statusBar';

describe('formatStatusBarText', () => {
  it('formats a token count', () => {
    expect(formatStatusBarText({ kind: 'count', count: 1234 })).toBe('$(symbol-numeric) Tokens: 1,234');
  });

  it('appends (no subscript) when the split-character counts are hidden', () => {
    expect(formatStatusBarText({ kind: 'count', count: 9, splitCountHidden: true })).toBe(
      '$(symbol-numeric) Tokens: 9 (no subscript)'
    );
  });

  it('formats missing configuration', () => {
    expect(formatStatusBarText({ kind: 'missingPath' })).toBe('$(symbol-numeric) Tokens: Select tokenizer');
  });

  it('formats loading state', () => {
    expect(formatStatusBarText({ kind: 'loading' })).toBe('$(sync~spin) Tokens: Loading');
  });

  it('formats disabled state', () => {
    expect(formatStatusBarText({ kind: 'disabled', count: 9 })).toBe('$(symbol-numeric) Tokens: 9');
  });

  it('appends (highlight off) when disabled with highlightOff', () => {
    expect(formatStatusBarText({ kind: 'disabled', count: 9, highlightOff: true })).toBe('$(symbol-numeric) Tokens: 9 (highlight off)');
  });

  it('formats error state', () => {
    expect(formatStatusBarText({ kind: 'error' })).toBe('$(error) Tokens: Error');
  });
});

describe('StatusBarController', () => {
  beforeEach(() => {
    fakeItem.command = undefined;
  });

  it('sets the status bar item command when a commandId is provided', () => {
    new StatusBarController(TOGGLE_COMMAND);
    expect(fakeItem.command).toBe(TOGGLE_COMMAND);
  });

  it('does not set the status bar item command when no commandId is provided', () => {
    new StatusBarController();
    expect(fakeItem.command).toBeUndefined();
  });
});

describe('StatusBarController tokenizer menu', () => {
  const SELECT_COMMAND = 'local-token-visualizer.selectTokenizer';
  const markdown = () => fakeItem.tooltip as { value: string; isTrusted: { enabledCommands: string[] } };

  it('toggles highlighting on click while a tokenizer is working', () => {
    const controller = new StatusBarController(TOGGLE_COMMAND, SELECT_COMMAND);

    controller.update({ kind: 'count', count: 5, tokenizer: 'GPT-4o' });

    expect(fakeItem.command).toBe(TOGGLE_COMMAND);
  });

  it('opens the tokenizer picker on click when no tokenizer is ready or loading failed', () => {
    const controller = new StatusBarController(TOGGLE_COMMAND, SELECT_COMMAND);

    controller.update({ kind: 'missingPath' });
    expect(fakeItem.command).toBe(SELECT_COMMAND);

    controller.update({ kind: 'error', message: 'boom' });
    expect(fakeItem.command).toBe(SELECT_COMMAND);

    controller.update({ kind: 'count', count: 1 });
    expect(fakeItem.command).toBe(TOGGLE_COMMAND);
  });

  it('names the tokenizer and links to the picker in the tooltip', () => {
    const controller = new StatusBarController(TOGGLE_COMMAND, SELECT_COMMAND);

    controller.update({ kind: 'count', count: 5, tokenizer: 'OpenAI GPT (o200k_harmony)' });

    expect(markdown().value).toContain('**Tokenizer:** OpenAI GPT \\(o200k\\_harmony\\)');
    expect(markdown().value).toContain(`(command:${SELECT_COMMAND})`);
    expect(markdown().value).toContain(`(command:${TOGGLE_COMMAND})`);
    expect(markdown().isTrusted.enabledCommands).toEqual([TOGGLE_COMMAND, SELECT_COMMAND]);
  });

  it('offers the next step of the click cycle in the tooltip', () => {
    const controller = new StatusBarController(TOGGLE_COMMAND, SELECT_COMMAND);

    controller.update({ kind: 'count', count: 5 });
    expect(markdown().value).toContain('[Hide subscript counts]');

    controller.update({ kind: 'count', count: 5, splitCountHidden: true });
    expect(markdown().value).toContain('[Turn highlighting off]');

    controller.update({ kind: 'disabled', count: 5, highlightOff: true });
    expect(markdown().value).toContain('[Turn highlighting on]');
  });

  it('shows the failure reason in the tooltip', () => {
    const controller = new StatusBarController(TOGGLE_COMMAND, SELECT_COMMAND);

    controller.update({ kind: 'error', message: 'Unsupported pre-tokenizer' });

    expect(markdown().value).toContain('Tokenization failed: Unsupported pre\\-tokenizer');
  });

  it('falls back to a plain tooltip when constructed without the picker command', () => {
    const controller = new StatusBarController(TOGGLE_COMMAND);

    controller.update({ kind: 'loading' });

    expect(fakeItem.tooltip).toBe('Loading tokenizer.');
  });
});

describe('TOKEN_STATUS_PRIORITY', () => {
  it('targets the indentation and language status cluster', () => {
    expect(TOKEN_STATUS_PRIORITY).toBe(100);
  });
});
