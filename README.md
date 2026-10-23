# Local Token Visualizer

Local Token Visualizer is a VS Code extension for counting and visualizing LLM tokens offline with a local Hugging Face tokenizer directory.

![Local Token Visualizer screenshot](screenshot.png)

## What It Does

- Counts tokens for the active editor using a local tokenizer.
- Highlights visible token ranges with a five-color overlay.
- Runs offline after the tokenizer files are present locally.
- Updates immediately for smaller files and debounces larger files.
- Lets you toggle highlighting from the status bar.

## Setup

The extension needs a Hugging Face tokenizer directory containing `tokenizer.json`.

For local development in this repository, the default path points to:

```text
C:\GIT_REPO\Local_Token_Visualizer\tokenizer
```

To choose another tokenizer:

1. Open the Command Palette with `Ctrl+Shift+P`.
2. Run `Local Token Visualizer: Select Tokenizer Directory`.
3. Pick a folder that contains `tokenizer.json`.

You can also set the path manually in VS Code settings:

```json
"localTokenizer.modelPath": "C:/path/to/tokenizer"
```

## Controls

| Control | Action |
| --- | --- |
| Status bar `Tokens: N` | Click to toggle token highlighting on or off. |
| `Local Token Visualizer: Select Tokenizer Directory` | Opens a folder picker and saves `localTokenizer.modelPath`. |
| `Local Token Visualizer: Toggle Highlighting` | Toggles `localTokenizer.enableHighlighting`. |

When highlighting is off, the status bar shows `Tokens: N (highlight off)`.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `localTokenizer.modelPath` | bundled dev tokenizer path | Absolute path to a tokenizer directory containing `tokenizer.json`. |
| `localTokenizer.enableHighlighting` | `true` | Enables or disables token overlay highlighting. |
| `localTokenizer.smallFileThreshold` | `50000` | Files at or below this character count update immediately instead of waiting for debounce. |

## Package Size Notes

The extension uses `@huggingface/tokenizers`, a zero-dependency, pure JavaScript tokenizer, and ships as a single esbuild bundle (`dist/extension.js`). No `node_modules`, native ONNX runtime, or `onnxruntime-node` binaries are packaged, which keeps the VSIX at roughly 3.7 MB instead of roughly 51 MB.

Almost all of what remains is the bundled default `tokenizer/tokenizer.json` (about 3.5 MB compressed). Users who set `localTokenizer.modelPath` to their own tokenizer directory do not need it.

Build the package with `npm run package` (this runs `npm run bundle` automatically).
