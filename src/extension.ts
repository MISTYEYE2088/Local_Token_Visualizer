import * as vscode from 'vscode';
import * as path from 'path';
import { labelForModel } from './catalog';
import { readLocalTokenizerConfig, type LocalTokenizerConfig } from './configuration';
import { TokenVisualizerController, DEFAULT_SMALL_FILE_THRESHOLD } from './controller';
import { Debouncer } from './debounce';
import { DecorationManager } from './decorations';
import { createRefreshScheduler } from './refreshScheduler';
import { StatusBarController } from './statusBar';
import { TokenizerMenu, SELECT_MODEL_PATH_COMMAND, SELECT_TOKENIZER_COMMAND } from './tokenizerMenu';
import { TokenizerService } from './tokenizerService';
import { TokenizerStore } from './tokenizerStore';

const REFRESH_DELAY_MS = 300;
const TOGGLE_COMMAND = 'local-token-visualizer.toggleHighlighting';

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarController(TOGGLE_COMMAND, SELECT_TOKENIZER_COMMAND);
  const decorations = new DecorationManager();
  const tokenizerService = new TokenizerService();
  const debouncer = new Debouncer(REFRESH_DELAY_MS);
  const store = new TokenizerStore(
    vscode.Uri.joinPath(context.extensionUri, 'tokenizers').fsPath,
    vscode.Uri.joinPath(context.globalStorageUri, 'tokenizers').fsPath
  );
  const controller = new TokenVisualizerController(
    async (): Promise<LocalTokenizerConfig> => {
      const config = readLocalTokenizerConfig(vscode.workspace.getConfiguration('localTokenizer'));
      if (config.modelPath) {
        return { ...config, modelLabel: `Custom folder (${path.basename(config.modelPath)})` };
      }

      const resolved = await store.resolve(config.model);
      return { ...config, modelPath: resolved?.path ?? '', modelLabel: labelForModel(config.model) };
    },
    tokenizerService,
    decorations,
    statusBar,
    DEFAULT_SMALL_FILE_THRESHOLD
  );

  const menu = new TokenizerMenu(store, () => {
    tokenizerService.reset();
    scheduleRefresh(vscode.window.activeTextEditor);
  });

  const scheduleRefresh = createRefreshScheduler<vscode.TextEditor>({
    getActiveEditor: () => vscode.window.activeTextEditor,
    getTextLength: (editor) => editor.document.getText().length,
    refresh: (editor) => void controller.refresh(editor),
    debouncer,
    smallFileThreshold: controller.smallFileThreshold
  });

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
    vscode.commands.registerCommand(SELECT_TOKENIZER_COMMAND, () => menu.show()),
    vscode.commands.registerCommand(SELECT_MODEL_PATH_COMMAND, () => menu.browseForFolder())
  );

  scheduleRefresh(vscode.window.activeTextEditor);
  void menu.ensureCurrentModel();
}

export function deactivate(): void {}
