export interface RefreshSchedulerOptions<Editor> {
  getActiveEditor: () => Editor | undefined;
  getTextLength: (editor: Editor) => number;
  refresh: (editor: Editor | undefined) => void;
  debouncer: { schedule(callback: () => void): void; dispose(): void };
  smallFileThreshold: number;
}

/**
 * Decides when to refresh. Immediate refreshes cancel any pending debounced one: otherwise a
 * debounced refresh scheduled earlier (for a large file, or at startup with no editor) fires
 * later, supersedes the refresh that is already loading, and leaves the status bar stuck.
 */
export function createRefreshScheduler<Editor>(options: RefreshSchedulerOptions<Editor>) {
  const { getActiveEditor, getTextLength, refresh, debouncer, smallFileThreshold } = options;

  return (editor: Editor | undefined = getActiveEditor()): void => {
    if (!editor || getTextLength(editor) < smallFileThreshold) {
      debouncer.dispose();
      refresh(editor);
      return;
    }

    debouncer.schedule(() => refresh(editor));
  };
}
