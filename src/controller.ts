import type * as vscode from 'vscode';
import type { LocalTokenizerConfig } from './configuration';
import { validateModelPath } from './configuration';
import type { DecorationManager } from './decorations';
import type { StatusBarController } from './statusBar';
import type { TokenizerService } from './tokenizerService';

export class TokenVisualizerController {
  private refreshSequence = 0;

  constructor(
    private readonly getConfig: () => LocalTokenizerConfig,
    private readonly tokenizerService: Pick<TokenizerService, 'tokenize'>,
    private readonly decorationManager: Pick<DecorationManager, 'apply' | 'clear'>,
    private readonly statusBar: Pick<StatusBarController, 'update'>
  ) {}

  async refresh(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor) {
      return;
    }

    const refreshId = ++this.refreshSequence;
    const config = this.getConfig();
    const validation = validateModelPath(config.modelPath);

    if (!validation.ok) {
      this.statusBar.update({ kind: 'missingPath' });
      this.decorationManager.clear(editor);
      return;
    }

    this.statusBar.update({ kind: 'loading' });

    try {
      const result = await this.tokenizerService.tokenize(validation.path, editor.document.getText());

      if (refreshId !== this.refreshSequence) {
        return;
      }

      if (config.enableHighlighting) {
        this.decorationManager.apply(editor, result.offsets);
        this.statusBar.update({ kind: 'count', count: result.count });
      } else {
        this.decorationManager.clear(editor);
        this.statusBar.update({ kind: 'disabled', count: result.count });
      }
    } catch {
      if (refreshId !== this.refreshSequence) {
        return;
      }

      this.decorationManager.clear(editor);
      this.statusBar.update({ kind: 'error' });
    }
  }
}
