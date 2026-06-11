import { describe, expect, it, vi } from 'vitest';
import { TokenVisualizerController } from '../controller';

type TokenizeResult = { count: number; offsets: [number, number][] };

describe('TokenVisualizerController', () => {
  it('does nothing when there is no active editor', async () => {
    const getConfig = vi.fn();
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    const tokenizer = { tokenize: vi.fn() };
    const controller = new TokenVisualizerController(
      getConfig,
      tokenizer,
      decorations,
      statusBar
    );

    await controller.refresh(undefined);

    expect(getConfig).not.toHaveBeenCalled();
    expect(statusBar.update).not.toHaveBeenCalled();
    expect(decorations.apply).not.toHaveBeenCalled();
    expect(decorations.clear).not.toHaveBeenCalled();
    expect(tokenizer.tokenize).not.toHaveBeenCalled();
  });

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
      tokenize: vi.fn().mockImplementation(async () => {
        expect(statusBar.update).toHaveBeenCalledTimes(1);
        expect(statusBar.update).toHaveBeenCalledWith({ kind: 'loading' });
        return { count: 1, offsets: [[0, 5]] };
      })
    };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: '  C:\\models\\tokenizer  ', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    await controller.refresh(editor as never);

    expect(tokenizer.tokenize).toHaveBeenCalledWith('C:\\models\\tokenizer', 'hello');
    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'count', count: 1 });
    expect(decorations.apply).toHaveBeenCalledWith(editor, [[0, 5]]);
  });

  it('ignores stale results when an older refresh finishes after a newer refresh', async () => {
    const editorA = { document: { getText: () => 'old text' } };
    const editorB = { document: { getText: () => 'new text' } };
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    let resolveA!: (result: TokenizeResult) => void;
    let resolveB!: (result: TokenizeResult) => void;
    const resultA = new Promise<TokenizeResult>((resolve) => {
      resolveA = resolve;
    });
    const resultB = new Promise<TokenizeResult>((resolve) => {
      resolveB = resolve;
    });
    const tokenizer = {
      tokenize: vi.fn()
        .mockReturnValueOnce(resultA)
        .mockReturnValueOnce(resultB)
    };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: 'C:\\models\\tokenizer', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    const refreshA = controller.refresh(editorA as never);
    const refreshB = controller.refresh(editorB as never);
    resolveB({ count: 2, offsets: [[10, 20]] });
    await refreshB;
    resolveA({ count: 1, offsets: [[0, 5]] });
    await refreshA;

    expect(decorations.apply).toHaveBeenCalledTimes(1);
    expect(decorations.apply).toHaveBeenCalledWith(editorB, [[10, 20]]);
    expect(statusBar.update).toHaveBeenCalledTimes(3);
    expect(statusBar.update).toHaveBeenLastCalledWith({ kind: 'count', count: 2 });
    expect(statusBar.update).not.toHaveBeenCalledWith({ kind: 'count', count: 1 });
  });

  it('invalidates pending refreshes when there is no active editor', async () => {
    const editor = { document: { getText: () => 'hello' } };
    const getConfig = vi.fn(() => ({ modelPath: 'C:\\models\\tokenizer', enableHighlighting: true }));
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    let resolveTokenize!: (result: TokenizeResult) => void;
    const pendingTokenize = new Promise<TokenizeResult>((resolve) => {
      resolveTokenize = resolve;
    });
    const tokenizer = {
      tokenize: vi.fn().mockReturnValue(pendingTokenize)
    };
    const controller = new TokenVisualizerController(
      getConfig,
      tokenizer,
      decorations,
      statusBar
    );

    const refresh = controller.refresh(editor as never);
    await controller.refresh(undefined);
    resolveTokenize({ count: 1, offsets: [[0, 5]] });
    await refresh;

    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(tokenizer.tokenize).toHaveBeenCalledTimes(1);
    expect(statusBar.update).toHaveBeenCalledTimes(1);
    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'loading' });
    expect(statusBar.update).not.toHaveBeenCalledWith({ kind: 'count', count: 1 });
    expect(statusBar.update).not.toHaveBeenCalledWith({ kind: 'error' });
    expect(decorations.apply).not.toHaveBeenCalled();
    expect(decorations.clear).not.toHaveBeenCalled();
  });

  it('ignores stale failures when an older refresh rejects after a newer refresh completes', async () => {
    const editorA = { document: { getText: () => 'old text' } };
    const editorB = { document: { getText: () => 'new text' } };
    const statusBar = { update: vi.fn() };
    const decorations = { apply: vi.fn(), clear: vi.fn() };
    let rejectA!: (error: Error) => void;
    let resolveB!: (result: TokenizeResult) => void;
    const resultA = new Promise<TokenizeResult>((_, reject) => {
      rejectA = reject;
    });
    const resultB = new Promise<TokenizeResult>((resolve) => {
      resolveB = resolve;
    });
    const tokenizer = {
      tokenize: vi.fn()
        .mockReturnValueOnce(resultA)
        .mockReturnValueOnce(resultB)
    };
    const controller = new TokenVisualizerController(
      () => ({ modelPath: 'C:\\models\\tokenizer', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    const refreshA = controller.refresh(editorA as never);
    const refreshB = controller.refresh(editorB as never);
    resolveB({ count: 2, offsets: [[10, 20]] });
    await refreshB;
    rejectA(new Error('load failed'));
    await refreshA;

    expect(decorations.apply).toHaveBeenCalledTimes(1);
    expect(decorations.apply).toHaveBeenCalledWith(editorB, [[10, 20]]);
    expect(decorations.clear).not.toHaveBeenCalled();
    expect(statusBar.update).toHaveBeenCalledTimes(3);
    expect(statusBar.update).toHaveBeenLastCalledWith({ kind: 'count', count: 2 });
    expect(statusBar.update).not.toHaveBeenCalledWith({ kind: 'error' });
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
