import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Debouncer } from '../debounce';
import { createRefreshScheduler } from '../refreshScheduler';

interface FakeEditor {
  name: string;
  length: number;
}

describe('createRefreshScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(active?: FakeEditor) {
    const refresh = vi.fn();
    const state = { active };
    const schedule = createRefreshScheduler<FakeEditor>({
      getActiveEditor: () => state.active,
      getTextLength: (editor) => editor.length,
      refresh,
      debouncer: new Debouncer(300),
      smallFileThreshold: 1000
    });
    return { schedule, refresh, state };
  }

  it('refreshes small files immediately', () => {
    const small = { name: 'small', length: 10 };
    const { schedule, refresh } = setup();

    schedule(small);

    expect(refresh).toHaveBeenCalledExactlyOnceWith(small);
  });

  it('debounces large files', () => {
    const large = { name: 'large', length: 5000 };
    const { schedule, refresh } = setup();

    schedule(large);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(refresh).toHaveBeenCalledExactlyOnceWith(large);
  });

  it('defaults to the active editor', () => {
    const active = { name: 'active', length: 10 };
    const { schedule, refresh } = setup(active);

    schedule();

    expect(refresh).toHaveBeenCalledExactlyOnceWith(active);
  });

  it('refreshes right away, not later, when there is no editor', () => {
    const { schedule, refresh } = setup();

    schedule();
    expect(refresh).toHaveBeenCalledExactlyOnceWith(undefined);

    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not let a startup no-editor refresh fire after a real refresh has begun', () => {
    const editor = { name: 'sample.txt', length: 100 };
    const { schedule, refresh } = setup();

    schedule();
    schedule(editor);
    vi.advanceTimersByTime(1000);

    expect(refresh.mock.calls).toEqual([[undefined], [editor]]);
  });

  it('cancels a pending large-file refresh when a small file becomes active', () => {
    const large = { name: 'large', length: 5000 };
    const small = { name: 'small', length: 10 };
    const { schedule, refresh } = setup();

    schedule(large);
    schedule(small);
    vi.advanceTimersByTime(1000);

    expect(refresh).toHaveBeenCalledExactlyOnceWith(small);
  });

  it('cancels a pending large-file refresh when the editor closes', () => {
    const large = { name: 'large', length: 5000 };
    const { schedule, refresh } = setup();

    schedule(large);
    schedule(undefined);
    vi.advanceTimersByTime(1000);

    expect(refresh.mock.calls).toEqual([[undefined]]);
  });
});
