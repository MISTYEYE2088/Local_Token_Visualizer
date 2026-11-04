import { describe, expect, it } from 'vitest';
import { resolveEditor } from '../editorResolver';

describe('resolveEditor', () => {
  const a = { name: 'a' };
  const b = { name: 'b' };

  it('prefers the active editor', () => {
    expect(resolveEditor(a, b, [a, b])).toBe(a);
  });

  it('falls back to the last active editor while a preview has focus', () => {
    expect(resolveEditor(undefined, b, [a, b])).toBe(b);
  });

  it('ignores a last active editor that is no longer visible', () => {
    expect(resolveEditor(undefined, b, [a])).toBe(a);
  });

  it('uses the first visible editor when none was active before', () => {
    expect(resolveEditor(undefined, undefined, [a, b])).toBe(a);
  });

  it('returns undefined when no editor is visible', () => {
    expect(resolveEditor(undefined, a, [])).toBeUndefined();
  });
});
