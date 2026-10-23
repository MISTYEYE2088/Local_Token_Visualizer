import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
  test('activates local token visualizer extension', async () => {
    const extension = vscode.extensions.getExtension('local-token-visualizer.local-token-visualizer');

    assert.ok(extension, 'extension should be discoverable by id');
    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });

  test('registers select model path command', async () => {
    const extension = vscode.extensions.getExtension('local-token-visualizer.local-token-visualizer');
    assert.ok(extension, 'extension should be discoverable by id');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('local-token-visualizer.selectModelPath'),
      'selectModelPath command should be registered'
    );
  });

  test('registers toggle highlighting command', async () => {
    const extension = vscode.extensions.getExtension('local-token-visualizer.local-token-visualizer');
    assert.ok(extension, 'extension should be discoverable by id');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('local-token-visualizer.toggleHighlighting'),
      'toggleHighlighting command should be registered'
    );
  });

  test('registers select tokenizer command', async () => {
    const extension = vscode.extensions.getExtension('local-token-visualizer.local-token-visualizer');
    assert.ok(extension, 'extension should be discoverable by id');
    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('local-token-visualizer.selectTokenizer'),
      'selectTokenizer command should be registered'
    );
  });

  test('defaults to the bundled GPT-4o tokenizer', () => {
    const config = vscode.workspace.getConfiguration('localTokenizer');

    assert.strictEqual(config.get('model'), 'gpt-4o');
    assert.strictEqual(config.get('modelPath'), '');
  });
});
