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
