import * as vscode from 'vscode';
import { readLocalTokenizerConfig } from './configuration';
import { TokenVisualizerController, DEFAULT_SMALL_FILE_THRESHOLD } from './controller';
import { Debouncer } from './debounce';
import { DecorationManager } from './decorations';
import { StatusBarController } from './statusBar';
import { TokenizerService } from './tokenizerService';

const REFRESH_DELAY_MS = 300;
const TOGGLE_COMMAND = 'local-token-visualizer.toggleHighlighting';
const SELECT_MODEL_PATH_COMMAND = 'local-token-visualizer.selectModelPath';

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarController(TOGGLE_COMMAND);
  const decorations = new DecorationManager();
  const tokenizerService = new TokenizerService();
  const debouncer = new Debouncer(REFRESH_DELAY_MS);
  const controller = new TokenVisualizerController(
    () => readLocalTokenizerConfig(vscode.workspace.getConfiguration('localTokenizer')),
    tokenizerService,
    decorations,
    statusBar,
    DEFAULT_SMALL_FILE_THRESHOLD
  );

  const scheduleRefresh = (editor = vscode.window.activeTextEditor): void => {
    const isSmallFile = editor
      ? editor.document.getText().length < controller.smallFileThreshold
      : false;

    if (isSmallFile) {
      void controller.refresh(editor);
    } else {
      debouncer.schedule(() => {
        void controller.refresh(editor);
      });
    }
  };

  context.subscriptions.push(
    statusBar,
    decorations,
    debouncer,
    vscode.window.onDidChangeActiveTextEditor((editor) => scheduleRefresh(editor)),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => scheduleRefresh(event.textEditor)),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (vscode.window.activeTextEditor?.document === event.document) {
        scheduleRefresh(vscode.window.activeTextEditor);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('localTokenizer')) {
        tokenizerService.reset();
        scheduleRefresh(vscode.window.activeTextEditor);
      }
    }),
    vscode.commands.registerCommand(TOGGLE_COMMAND, () => {
      const config = vscode.workspace.getConfiguration('localTokenizer');
      const current = config.get<boolean>('enableHighlighting', true);
      void config.update('enableHighlighting', !current, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand(SELECT_MODEL_PATH_COMMAND, async () => {
      const folders = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Tokenizer Directory',
        title: 'Local Token Visualizer: Select Tokenizer Directory'
      });

      if (folders && folders.length > 0) {
        const config = vscode.workspace.getConfiguration('localTokenizer');
        await config.update('modelPath', folders[0].fsPath, vscode.ConfigurationTarget.Global);
        tokenizerService.reset();
        scheduleRefresh(vscode.window.activeTextEditor);
      }
    })
  );

  scheduleRefresh(vscode.window.activeTextEditor);
}

export function deactivate(): void {}
