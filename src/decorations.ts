import type * as vscode from 'vscode';

export type OffsetRange = readonly [number, number];

export interface MultiTokenChar {
  range: OffsetRange;
  tokenCount: number;
}

export const PASTEL_TOKEN_COLORS = [
  { dark: 'rgba(102, 194, 165, 0.25)', light: 'rgba(102, 194, 165, 0.4)' },
  { dark: 'rgba(252, 141, 98, 0.25)', light: 'rgba(252, 141, 98, 0.4)' },
  { dark: 'rgba(141, 160, 203, 0.25)', light: 'rgba(141, 160, 203, 0.4)' },
  { dark: 'rgba(231, 138, 195, 0.25)', light: 'rgba(231, 138, 195, 0.4)' },
  { dark: 'rgba(166, 216, 84, 0.25)', light: 'rgba(166, 216, 84, 0.4)' }
] as const;

// Distinct from the pastel cycle so characters split across tokens stand out.
export const MULTI_TOKEN_COLOR = {
  dark: { background: 'rgba(255, 70, 70, 0.35)', border: 'rgba(255, 110, 110, 0.9)' },
  light: { background: 'rgba(255, 70, 70, 0.3)', border: 'rgba(200, 30, 30, 0.8)' }
} as const;

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

export function toSubscript(value: number): string {
  return String(Math.trunc(value))
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)] ?? digit)
    .join('');
}

export function visibleMultiTokenChars(chars: MultiTokenChar[], visibleOffsets: OffsetRange[]): MultiTokenChar[] {
  return chars.filter(
    (char) =>
      char.range[0] < char.range[1] && visibleOffsets.some((visible) => intersectsRange(char.range, visible))
  );
}

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
  private readonly decorationTypes: vscode.TextEditorDecorationType[];
  private readonly multiTokenType: vscode.TextEditorDecorationType;

  constructor() {
    const vscodeApi = loadVscode();
    this.decorationTypes = PASTEL_TOKEN_COLORS.map((color) =>
      vscodeApi.window.createTextEditorDecorationType({
        light: { backgroundColor: color.light },
        dark: { backgroundColor: color.dark },
        borderRadius: '2px'
      })
    );
    this.multiTokenType = vscodeApi.window.createTextEditorDecorationType({
      light: {
        backgroundColor: MULTI_TOKEN_COLOR.light.background,
        border: `1px solid ${MULTI_TOKEN_COLOR.light.border}`
      },
      dark: {
        backgroundColor: MULTI_TOKEN_COLOR.dark.background,
        border: `1px solid ${MULTI_TOKEN_COLOR.dark.border}`
      },
      borderRadius: '2px'
    });
  }

  apply(editor: vscode.TextEditor, offsets: OffsetRange[], multiTokenChars: MultiTokenChar[] = []): void {
    const vscodeApi = loadVscode();
    const visibleOffsets = editor.visibleRanges.map(
      (range) =>
        [
          editor.document.offsetAt(range.start),
          editor.document.offsetAt(range.end)
        ] as OffsetRange
    );
    const buckets = bucketVisibleOffsets(offsets, visibleOffsets);

    this.decorationTypes.forEach((decorationType, index) => {
      const ranges = buckets[index].map(
        (offset) =>
          new vscodeApi.Range(
            editor.document.positionAt(offset[0]),
            editor.document.positionAt(offset[1])
          )
      );
      editor.setDecorations(decorationType, ranges);
    });

    editor.setDecorations(
      this.multiTokenType,
      visibleMultiTokenChars(multiTokenChars, visibleOffsets).map((char) => ({
        range: new vscodeApi.Range(
          editor.document.positionAt(char.range[0]),
          editor.document.positionAt(char.range[1])
        ),
        hoverMessage: `This character is split across ${char.tokenCount} tokens`,
        renderOptions: { after: { contentText: toSubscript(char.tokenCount) } }
      }))
    );
  }

  clear(editor: vscode.TextEditor): void {
    this.decorationTypes.forEach((decorationType) => {
      editor.setDecorations(decorationType, []);
    });
    editor.setDecorations(this.multiTokenType, []);
  }

  dispose(): void {
    this.decorationTypes.forEach((decorationType) => decorationType.dispose());
    this.multiTokenType.dispose();
  }
}

function loadVscode(): typeof vscode {
  // Lazy-load the extension-host API so pure bucketing tests can import this module in Vitest.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('vscode') as typeof vscode;
}
