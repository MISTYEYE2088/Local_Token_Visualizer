import type * as vscode from 'vscode';

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
  private readonly decorationTypes: vscode.TextEditorDecorationType[];

  constructor() {
    const vscodeApi = loadVscode();
    this.decorationTypes = PASTEL_TOKEN_COLORS.map((color) =>
      vscodeApi.window.createTextEditorDecorationType({
        light: { backgroundColor: color.light },
        dark: { backgroundColor: color.dark },
        borderRadius: '2px'
      })
    );
  }

  apply(editor: vscode.TextEditor, offsets: OffsetRange[]): void {
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

function loadVscode(): typeof vscode {
  // Lazy-load the extension-host API so pure bucketing tests can import this module in Vitest.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('vscode') as typeof vscode;
}
