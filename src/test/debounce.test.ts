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
