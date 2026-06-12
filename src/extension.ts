import * as vscode from 'vscode';
import { readLocalTokenizerConfig } from './configuration';
import { TokenVisualizerController } from './controller';
import { Debouncer } from './debounce';
import { DecorationManager } from './decorations';
import { StatusBarController } from './statusBar';
import { TokenizerService } from './tokenizerService';

const REFRESH_DELAY_MS = 300;

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBarController();
  const decorations = new DecorationManager();
  const tokenizerService = new TokenizerService();
  const debouncer = new Debouncer(REFRESH_DELAY_MS);
  const controller = new TokenVisualizerController(
    () => readLocalTokenizerConfig(vscode.workspace.getConfiguration('localTokenizer')),
    tokenizerService,
    decorations,
    statusBar
  );

  const scheduleRefresh = (editor = vscode.window.activeTextEditor): void => {
    debouncer.schedule(() => {
      void controller.refresh(editor);
    });
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
    })
  );

  scheduleRefresh(vscode.window.activeTextEditor);
}

export function deactivate(): void {}
