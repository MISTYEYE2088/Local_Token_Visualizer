import type * as vscode from 'vscode';
import type { LocalTokenizerConfig } from './configuration';
import { validateModelPath } from './configuration';
import type { DecorationManager } from './decorations';
import type { StatusBarController } from './statusBar';
import type { TokenizerService } from './tokenizerService';

export const DEFAULT_SMALL_FILE_THRESHOLD = 50000;

export type ControllerConfig = Pick<LocalTokenizerConfig, 'modelPath' | 'enableHighlighting' | 'modelLabel'>;

export class TokenVisualizerController {
  private refreshSequence = 0;
  readonly smallFileThreshold: number;

  constructor(
    private readonly getConfig: () => ControllerConfig | Promise<ControllerConfig>,
    private readonly tokenizerService: Pick<TokenizerService, 'tokenize'>,
    private readonly decorationManager: Pick<DecorationManager, 'apply' | 'clear'>,
    private readonly statusBar: Pick<StatusBarController, 'update'>,
    smallFileThreshold: number = DEFAULT_SMALL_FILE_THRESHOLD
  ) {
    this.smallFileThreshold = smallFileThreshold;
  }

  async refresh(editor: vscode.TextEditor | undefined): Promise<void> {
    const refreshId = ++this.refreshSequence;

    if (!editor) {
      return;
    }

    const config = await this.getConfig();
    const tokenizer = config.modelLabel ? { tokenizer: config.modelLabel } : {};
    const validation = validateModelPath(config.modelPath);

    if (!validation.ok) {
      if (refreshId !== this.refreshSequence) {
        return;
      }

      this.statusBar.update({ kind: 'missingPath', ...tokenizer });
      this.decorationManager.clear(editor);
      return;
    }

    this.statusBar.update({ kind: 'loading', ...tokenizer });

    try {
      const result = await this.tokenizerService.tokenize(validation.path, editor.document.getText());

      if (refreshId !== this.refreshSequence) {
        return;
      }

      if (config.enableHighlighting) {
        this.decorationManager.apply(editor, result.offsets);
        this.statusBar.update({ kind: 'count', count: result.count, ...tokenizer });
      } else {
        this.decorationManager.clear(editor);
        this.statusBar.update({ kind: 'disabled', count: result.count, highlightOff: true, ...tokenizer });
      }
    } catch (error) {
      if (refreshId !== this.refreshSequence) {
        return;
      }

      this.decorationManager.clear(editor);
      this.statusBar.update({
        kind: 'error',
        ...(error instanceof Error && error.message ? { message: error.message } : {}),
        ...tokenizer
      });
    }
  }
}
