import * as vscode from 'vscode';

export const TOKEN_STATUS_PRIORITY = 100;

/** Name of the active tokenizer, shown in the tooltip. */
interface WithTokenizer {
  tokenizer?: string;
}

export type TokenStatus =
  | ({ kind: 'count'; count: number; splitCountHidden?: boolean } & WithTokenizer)
  | ({ kind: 'missingPath' } & WithTokenizer)
  | ({ kind: 'loading' } & WithTokenizer)
  | ({ kind: 'disabled'; count: number; highlightOff?: boolean } & WithTokenizer)
  | ({ kind: 'error'; message?: string } & WithTokenizer);

export interface StatusBarCommands {
  toggle: string;
  selectTokenizer: string;
}

export function formatStatusBarText(status: TokenStatus): string {
  switch (status.kind) {
    case 'count':
      return status.splitCountHidden
        ? `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')} (no subscript)`
        : `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')}`;
    case 'missingPath':
      return '$(symbol-numeric) Tokens: Select tokenizer';
    case 'loading':
      return '$(sync~spin) Tokens: Loading';
    case 'disabled':
      return status.highlightOff
        ? `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')} (highlight off)`
        : `$(symbol-numeric) Tokens: ${status.count.toLocaleString('en-US')}`;
    case 'error':
      return '$(error) Tokens: Error';
  }
}

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(
    private readonly commandId?: string,
    private readonly selectTokenizerCommandId?: string
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, TOKEN_STATUS_PRIORITY);
    this.item.name = 'Local Token Visualizer';
    if (commandId) {
      this.item.command = commandId;
    }
    this.item.show();
  }

  update(status: TokenStatus): void {
    this.item.text = formatStatusBarText(status);
    this.item.tooltip = this.tooltipFor(status);
    // With no usable tokenizer, a click should open the picker rather than toggle highlighting.
    const needsTokenizer = status.kind === 'missingPath' || status.kind === 'error';
    this.item.command = (needsTokenizer && this.selectTokenizerCommandId) || this.commandId;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }

  private tooltipFor(status: TokenStatus): string | vscode.MarkdownString {
    const headline = this.headlineFor(status);
    if (!this.commandId || !this.selectTokenizerCommandId) {
      return headline;
    }

    const lines: string[] = [];
    if (status.tokenizer) {
      lines.push(`**Tokenizer:** ${escapeMarkdown(status.tokenizer)}`);
    }
    lines.push(escapeMarkdown(headline));

    const links = [`[Change tokenizer…](command:${this.selectTokenizerCommandId})`];
    if (status.kind === 'count' || status.kind === 'disabled') {
      links.unshift(`[${this.nextActionFor(status)}](command:${this.commandId})`);
    }

    const markdown = new vscode.MarkdownString(`${lines.join('\n\n')}\n\n${links.join(' · ')}`);
    markdown.isTrusted = { enabledCommands: [this.commandId, this.selectTokenizerCommandId] };
    return markdown;
  }

  private headlineFor(status: TokenStatus): string {
    switch (status.kind) {
      case 'missingPath':
        return 'No tokenizer is ready yet. Click to choose one.';
      case 'loading':
        return 'Loading tokenizer.';
      case 'error':
        return status.message
          ? `Tokenization failed: ${status.message}`
          : 'Tokenization failed. Click to choose a different tokenizer.';
      case 'disabled':
        return 'Highlighting is off; token counting is still active. Click to turn it on.';
      case 'count':
        return status.splitCountHidden
          ? 'Token count for the current document. Subscript counts on split characters are hidden. Click to turn highlighting off.'
          : 'Token count for the current document. Click to hide the subscript counts on split characters.';
    }
  }

  private nextActionFor(status: TokenStatus): string {
    if (status.kind === 'disabled') {
      return 'Turn highlighting on';
    }

    return status.kind === 'count' && !status.splitCountHidden ? 'Hide subscript counts' : 'Turn highlighting off';
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+!|<>~-]/g, '\\$&');
}
