import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOGGLE_COMMAND = 'local-token-visualizer.toggleHighlighting';

const fakeItem = {
  name: '' as string,
  text: '' as string,
  tooltip: '' as string,
  command: undefined as string | undefined,
  show: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('vscode', () => ({
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

  it('formats missing configuration', () => {
    expect(formatStatusBarText({ kind: 'missingPath' })).toBe('$(symbol-numeric) Tokens: Configure tokenizer');
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

describe('TOKEN_STATUS_PRIORITY', () => {
  it('targets the indentation and language status cluster', () => {
    expect(TOKEN_STATUS_PRIORITY).toBe(100);
  });
});
