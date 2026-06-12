import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
  test('activates local token visualizer extension', async () => {
    const extension = vscode.extensions.getExtension('local-token-visualizer.local-token-visualizer');

    assert.ok(extension, 'extension should be discoverable by id');
    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });
});
