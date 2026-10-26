import { describe, expect, it } from 'vitest';
import {
  PASTEL_TOKEN_COLORS,
  bucketVisibleOffsets,
  intersectsRange,
  toSubscript,
  visibleMultiTokenChars
} from '../decorations';

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

describe('toSubscript', () => {
  it('renders each digit as a subscript character', () => {
    expect(toSubscript(2)).toBe('₂');
    expect(toSubscript(4)).toBe('₄');
    expect(toSubscript(10)).toBe('₁₀');
  });
});

describe('visibleMultiTokenChars', () => {
  it('keeps only characters that intersect a visible range', () => {
    const chars = [
      { range: [1, 3], tokenCount: 2 },
      { range: [20, 22], tokenCount: 3 },
      { range: [5, 5], tokenCount: 2 }
    ] as const;

    expect(visibleMultiTokenChars([...chars], [[0, 10]])).toEqual([{ range: [1, 3], tokenCount: 2 }]);
  });
});
