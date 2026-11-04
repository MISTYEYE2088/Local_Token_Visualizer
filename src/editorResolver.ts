/**
 * Picks the editor the extension should work on. A Markdown preview (or any webview) has no text
 * editor, so `activeTextEditor` is undefined while it has focus. Falling back to the last editor
 * that is still visible keeps the status bar button and settings changes working in that case.
 */
export function resolveEditor<Editor>(
  active: Editor | undefined,
  lastActive: Editor | undefined,
  visible: readonly Editor[]
): Editor | undefined {
  if (active) {
    return active;
  }

  if (lastActive && visible.includes(lastActive)) {
    return lastActive;
  }

  return visible[0];
}
