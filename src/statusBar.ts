import type * as vscode from 'vscode';

export const TOKEN_STATUS_PRIORITY = 100;

export type TokenStatus =
  | { kind: 'count'; count: number }
  | { kind: 'missingPath' }
  | { kind: 'loading' }
  | { kind: 'disabled'; count: number }
  | { kind: 'error' };

export function formatStatusBarText(status: TokenStatus): string {
  switch (status.kind) {
    case 'count':
      return `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')}`;
    case 'missingPath':
      return '$(symbol-numeric) Tokens: Configure tokenizer';
    case 'loading':
      return '$(sync~spin) Tokens: Loading';
    case 'disabled':
      return `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')}`;
    case 'error':
      return '$(error) Tokens: Error';
  }
}

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    const vscodeApi = loadVscode();
    this.item = vscodeApi.window.createStatusBarItem(vscodeApi.StatusBarAlignment.Right, TOKEN_STATUS_PRIORITY);
    this.item.name = 'Local Token Visualizer';
    this.item.show();
  }

  update(status: TokenStatus): void {
    this.item.text = formatStatusBarText(status);
    this.item.tooltip = this.tooltipFor(status);
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }

  private tooltipFor(status: TokenStatus): string {
    switch (status.kind) {
      case 'missingPath':
        return 'Set localTokenizer.modelPath to a local Hugging Face tokenizer directory.';
      case 'loading':
        return 'Loading local tokenizer.';
      case 'error':
        return 'Tokenization failed. Check the configured local tokenizer path.';
      case 'disabled':
        return 'Highlighting is disabled; token counting is still active.';
      case 'count':
        return 'Current document token count.';
    }
  }
}

function loadVscode(): typeof vscode {
  return require('vscode') as typeof vscode;
}
