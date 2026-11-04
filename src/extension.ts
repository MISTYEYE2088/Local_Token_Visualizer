import * as vscode from 'vscode';
import * as path from 'path';
import { labelForModel } from './catalog';
import { nextHighlightSettings, readLocalTokenizerConfig, type LocalTokenizerConfig } from './configuration';
import { TokenVisualizerController, DEFAULT_SMALL_FILE_THRESHOLD } from './controller';
import { Debouncer } from './debounce';
import { DecorationManager } from './decorations';
import { resolveEditor } from './editorResolver';
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

  // A Markdown preview has no text editor, so activeTextEditor is undefined while it has focus.
  let lastActiveEditor = vscode.window.activeTextEditor;
  const currentEditor = (): vscode.TextEditor | undefined =>
    resolveEditor(vscode.window.activeTextEditor, lastActiveEditor, vscode.window.visibleTextEditors);

  const menu = new TokenizerMenu(store, () => {
    tokenizerService.reset();
    scheduleRefresh(currentEditor());
  });

  const scheduleRefresh = createRefreshScheduler<vscode.TextEditor>({
    getActiveEditor: currentEditor,
    getTextLength: (editor) => editor.document.getText().length,
    refresh: (editor) => void controller.refresh(editor),
    debouncer,
    smallFileThreshold: controller.smallFileThreshold
  });

  context.subscriptions.push(
    statusBar,
    decorations,
    debouncer,
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        lastActiveEditor = editor;
      }
      scheduleRefresh(editor ?? currentEditor());
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => scheduleRefresh(event.textEditor)),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = currentEditor();
      if (editor?.document === event.document) {
        scheduleRefresh(editor);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('localTokenizer')) {
        tokenizerService.reset();
        scheduleRefresh(currentEditor());
      }
    }),
    vscode.commands.registerCommand(TOGGLE_COMMAND, async () => {
      const config = vscode.workspace.getConfiguration('localTokenizer');
      const next = nextHighlightSettings(readLocalTokenizerConfig(config));
      await config.update('enableHighlighting', next.enableHighlighting, vscode.ConfigurationTarget.Global);
      await config.update('showSplitCharCount', next.showSplitCharCount, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand(SELECT_TOKENIZER_COMMAND, () => menu.show()),
    vscode.commands.registerCommand(SELECT_MODEL_PATH_COMMAND, () => menu.browseForFolder())
  );

  scheduleRefresh(currentEditor());
  void menu.ensureCurrentModel();
}

export function deactivate(): void {}
