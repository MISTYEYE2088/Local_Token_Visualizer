import * as vscode from 'vscode';
import { CATALOG, canonicalModelId, isHuggingFaceRepoId, labelForModel, findCatalogEntry } from './catalog';
import { buildPickerRows, type PickerAction } from './modelPicker';
import { TokenizerDownloadError, type TokenizerStore } from './tokenizerStore';

export const SELECT_TOKENIZER_COMMAND = 'local-token-visualizer.selectTokenizer';
export const SELECT_MODEL_PATH_COMMAND = 'local-token-visualizer.selectModelPath';

interface PickItem extends vscode.QuickPickItem {
  action?: PickerAction;
}

export class TokenizerMenu {
  private readonly downloads = new Map<string, Promise<boolean>>();

  constructor(
    private readonly store: TokenizerStore,
    private readonly onChanged: () => void
  ) {}

  /** Opens the tokenizer picker. */
  async show(): Promise<void> {
    const config = vscode.workspace.getConfiguration('localTokenizer');
    const current = canonicalModelId(config.get<string>('model', ''));
    const usingCustomFolder = config.get<string>('modelPath', '').trim().length > 0;

    const availability = new Map<string, boolean>();
    await Promise.all(
      CATALOG.map(async (entry) => availability.set(entry.id, (await this.store.resolve(entry.id)) !== undefined))
    );
    const customDownloads = (await this.store.listCustomDownloads()).filter((repo) => !findCatalogEntry(repo));

    const rows = buildPickerRows({
      catalog: CATALOG,
      isAvailable: (model) => availability.get(model) ?? false,
      customDownloads,
      current,
      usingCustomFolder
    });
    const items: PickItem[] = rows.map((row) => ({
      label: row.label,
      description: row.description,
      detail: row.detail,
      kind: row.separator ? vscode.QuickPickItemKind.Separator : undefined,
      action: row.action
    }));

    const picked = await vscode.window.showQuickPick(items, {
      title: 'Local Token Visualizer: Choose a tokenizer',
      placeHolder: 'Pick the tokenizer that matches your model',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (picked?.action) {
      await this.run(picked.action);
    }
  }

  /** Downloads the tokenizer for the currently configured model, if it is missing. */
  async ensureCurrentModel(): Promise<void> {
    const config = vscode.workspace.getConfiguration('localTokenizer');
    const model = config.get<string>('model', '');
    if (config.get<string>('modelPath', '').trim() || !model || (await this.store.resolve(model))) {
      return;
    }
    if (!findCatalogEntry(model) && !isHuggingFaceRepoId(model)) {
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      `The "${labelForModel(model)}" tokenizer is not on this computer yet.`,
      'Download',
      'Choose another'
    );
    if (choice === 'Download') {
      if (await this.downloadWithProgress(model)) {
        this.onChanged();
      }
    } else if (choice === 'Choose another') {
      await this.show();
    }
  }

  async browseForFolder(): Promise<void> {
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select Tokenizer Directory',
      title: 'Local Token Visualizer: Select a folder containing tokenizer.json'
    });

    if (folders && folders.length > 0) {
      await vscode.workspace
        .getConfiguration('localTokenizer')
        .update('modelPath', folders[0].fsPath, vscode.ConfigurationTarget.Global);
      this.onChanged();
    }
  }

  private async run(action: PickerAction): Promise<void> {
    switch (action.type) {
      case 'browseFolder':
        return this.browseForFolder();
      case 'customHuggingFace': {
        const repo = await vscode.window.showInputBox({
          title: 'Hugging Face model ID',
          prompt: 'Enter owner/name. The repository must contain a tokenizer.json.',
          placeHolder: 'mistralai/Ministral-3-3B-Instruct-2512',
          validateInput: (value) =>
            isHuggingFaceRepoId(value.trim()) ? undefined : 'Use the form owner/name, for example Qwen/Qwen3.8-27B'
        });
        if (repo) {
          return this.select(repo.trim());
        }
        return;
      }
      case 'model':
        return this.select(action.model);
    }
  }

  private async select(model: string): Promise<void> {
    if (!(await this.store.resolve(model)) && !(await this.downloadWithProgress(model))) {
      return;
    }

    const config = vscode.workspace.getConfiguration('localTokenizer');
    await config.update('model', model, vscode.ConfigurationTarget.Global);
    await this.clearFolderOverride(config);
    this.onChanged();
    void vscode.window.setStatusBarMessage(`Local Token Visualizer: using ${labelForModel(model)}`, 4000);
  }

  /** A custom folder wins over the menu choice, so remove it wherever it is set. */
  private async clearFolderOverride(config: vscode.WorkspaceConfiguration): Promise<void> {
    const inspected = config.inspect<string>('modelPath');
    if (inspected?.globalValue) {
      await config.update('modelPath', undefined, vscode.ConfigurationTarget.Global);
    }
    if (inspected?.workspaceValue) {
      await config.update('modelPath', undefined, vscode.ConfigurationTarget.Workspace);
    }
    if (inspected?.workspaceFolderValue) {
      await config.update('modelPath', undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    }
  }

  private downloadWithProgress(model: string): Promise<boolean> {
    const inFlight = this.downloads.get(model);
    if (inFlight) {
      return inFlight;
    }

    const job = this.doDownload(model).finally(() => this.downloads.delete(model));
    this.downloads.set(model, job);
    return job;
  }

  private doDownload(model: string): Promise<boolean> {
    return Promise.resolve(
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Downloading ${labelForModel(model)} tokenizer`,
          cancellable: true
        },
        async (progress, token) => {
          const abort = new AbortController();
          token.onCancellationRequested(() => abort.abort());
          let reported = 0;

          try {
            await this.store.download(
              model,
              ({ file, receivedBytes, totalBytes }) => {
                if (file !== 'tokenizer.json' || !totalBytes) {
                  return;
                }
                const percent = Math.floor((receivedBytes / totalBytes) * 100);
                progress.report({
                  increment: percent - reported,
                  message: `${(receivedBytes / 1048576).toFixed(1)} / ${(totalBytes / 1048576).toFixed(1)} MB`
                });
                reported = percent;
              },
              abort.signal
            );
            return true;
          } catch (error) {
            if (abort.signal.aborted) {
              return false;
            }
            const message =
              error instanceof TokenizerDownloadError ? error.message : `Download failed: ${(error as Error).message}`;
            void vscode.window.showErrorMessage(message);
            return false;
          }
        }
      )
    );
  }
}
