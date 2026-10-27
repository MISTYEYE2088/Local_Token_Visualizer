# Local Token Visualizer

Local Token Visualizer is a VS Code extension for counting and visualizing LLM tokens offline with a local Hugging Face tokenizer directory.

![Local Token Visualizer screenshot](screenshot.png)

## What It Does

- Counts tokens for the active editor and highlights each token range with a five-color overlay.
- Works out of the box with built-in OpenAI, Google and DeepSeek tokenizers, and downloads others (Qwen, GLM, MiMo, MiniMax, Mistral) on request.
- Counts tokens locally. Nothing in your editor is ever sent anywhere.
- Updates immediately for smaller files and debounces larger files.

## Choosing a Tokenizer

Click the **Tokens** status bar item when it says *Select tokenizer*, hover it and choose **Change tokenizer…**, or run **Local Token Visualizer: Select Tokenizer** from the Command Palette. Pick from the list; no paths to copy.

| Tokenizer | For | Where it comes from |
| --- | --- | --- |
| OpenAI GPT (`o200k_harmony`) | gpt-oss, GPT-4o, o-series; closest public match for newer GPT models | Built in (default) |
| Gemma 4 | Gemma 4 (closest public match to Gemini) | Built in |
| DeepSeek V4.1 | DeepSeek V4.1 Flash | Built in |
| Qwen 3.8 | Qwen 3.8 family | Download |
| GLM 5.3 | GLM 5.1, 5.2 and 5.3 | Download |
| MiMo V2.6 | MiMo V2.6 Pro and Flash | Download |
| MiniMax M2.7 | MiniMax M2.5 and M2.7 | Download |
| Mistral Small 4 | Mistral Small 4 | Download |
| Any Hugging Face repo | Anything with a `tokenizer.json` | **Enter a Hugging Face model ID…** |
| A folder on disk | Your own tokenizer | **Use a local folder…** |

The list follows the open-weight model families people use today. Older tokenizers (GPT-4 `cl100k_base`, Llama 3, Qwen 2.5, DeepSeek V3, Mistral 7B) are no longer listed, but you can still use them: enter their Hugging Face ID (for example `Xenova/gpt-4`) or point to a folder.

Notes on accuracy:

- **Claude:** Anthropic has not published a tokenizer for current Claude models, and the old Claude 1/2 tokenizer is not close enough to be useful, so none is included. Use Anthropic's token counting API for exact Claude numbers.
- **GPT:** OpenAI's newest public tokenizer is `o200k_harmony` (gpt-oss). Counts for GPT models released since are approximate.
- **Gemini:** Google has not published Gemini's tokenizer. Gemma 4 is the closest public one, so Gemini counts are approximate.
- **Not in the list:** Kimi (Moonshot) publishes `tiktoken.model` instead of `tokenizer.json`, xAI's public Grok tokenizer uses its own file format, and Llama 4 on Hugging Face is gated. If you have a `tokenizer.json` for one of them, use **Use a local folder…**.
- Counts cover the text itself. Special tokens that a model adds on its own, such as a BOS token, are not counted.

### Downloads

Choosing a tokenizer marked *download* fetches `tokenizer.json` (and `tokenizer_config.json` when present) once from huggingface.co, at a pinned commit for the listed ones, and stores it in the extension's storage folder. After that it works offline. This is the only network access the extension makes, and it only happens when you pick a download. Gated repositories (ones that require accepting a license on huggingface.co) cannot be downloaded anonymously; accept the license, download `tokenizer.json` yourself, and use **Use a local folder…**.

## Controls

| Control | Action |
| --- | --- |
| Status bar `Tokens: N` | Click to cycle through three states: highlighting with subscript counts, highlighting without the subscript counts, and highlighting off. Hover for the active tokenizer and a *Change tokenizer…* link. |
| `Local Token Visualizer: Select Tokenizer` | Opens the tokenizer menu. |
| `Local Token Visualizer: Use Local Tokenizer Folder` | Opens a folder picker and saves `localTokenizer.modelPath`. |
| `Local Token Visualizer: Toggle Highlighting` | Same cycle as the status bar click; updates `localTokenizer.enableHighlighting` and `localTokenizer.showSplitCharCount`. |

When highlighting is off, the status bar shows `Tokens: N (highlight off)`. When only the subscript counts are hidden, it shows `Tokens: N (no subscript)`.

### Characters split across tokens

Some tokenizers (byte-level BPE such as GPT-4o) split one character, often an emoji, into several tokens. Those characters get a red box and a subscript number showing how many tokens they span, for example `🚀₂`. Hover the box for the same information. Hide the number with `localTokenizer.showSplitCharCount`; the red box and hover stay.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `localTokenizer.model` | `o200k-harmony` | Tokenizer chosen from the menu: a catalog id (`o200k-harmony`, `gemma-4`, `deepseek-v4`, `qwen-3.8`, `glm-5`, `mimo-v2.6`, `minimax-m2`, `mistral-small-4`) or any Hugging Face repo id such as `Qwen/Qwen3.8-27B`. The old id `gpt-4o` still works and maps to `o200k-harmony`. |
| `localTokenizer.modelPath` | empty | Optional. A local folder containing `tokenizer.json`. Overrides `localTokenizer.model` when set. |
| `localTokenizer.enableHighlighting` | `true` | Enables or disables token overlay highlighting. |
| `localTokenizer.showSplitCharCount` | `true` | Shows the subscript token count next to characters split across several tokens. |
| `localTokenizer.smallFileThreshold` | `50000` | Files below this character count update immediately instead of waiting for debounce. |

## Development

```bash
npm ci
npm run fetch-tokenizers   # downloads the built-in tokenizers (pinned commits, SHA-256 verified)
npm test                   # runs fetch-tokenizers first, then the unit and integration tests
npm run package            # builds the VSIX
```

`src/catalog.json` lists every tokenizer, the Hugging Face commit it is pinned to, and, for built-in ones, a checksum. To change the built-in set, edit that file and run `node scripts/fetch-tokenizers.mjs --all` to try any entry. Only tokenizers with a permissive license (MIT or Apache-2.0) should be built in; others stay download-only so they are fetched by the user directly from Hugging Face.

## Package Size Notes

The extension uses `@huggingface/tokenizers`, a zero-dependency, pure JavaScript tokenizer, and ships as a single esbuild bundle (`dist/extension.js`). No `node_modules` or native runtimes are packaged. Almost all of the VSIX is the three built-in `tokenizer.json` files (about 12 MB compressed in total); everything else is under 0.5 MB.
