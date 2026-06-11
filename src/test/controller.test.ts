import { describe, expect, it, vi } from 'vitest';
import { TokenVisualizerController } from '../controller';

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
      () => ({ modelPath: 'C:\\models\\tokenizer', enableHighlighting: true }),
      tokenizer,
      decorations,
      statusBar
    );

    await controller.refresh(editor as never);

    expect(statusBar.update).toHaveBeenCalledWith({ kind: 'count', count: 1 });
    expect(decorations.apply).toHaveBeenCalledWith(editor, [[0, 5]]);
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
