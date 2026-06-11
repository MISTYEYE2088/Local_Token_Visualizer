# Local Token Visualizer Design

## 1. Overview
A premium, model-agnostic VS Code extension that visualizes LLM token boundaries and counts tokens entirely offline using a local Hugging Face tokenizer directory.

## 2. Core Features
*   **Looping Rainbow Overlay:** Uses a 5-color repeating pastel palette inspired by tokenizer visualizers, with separate light and dark theme colors so code remains readable.
*   **Strategic Status Bar Placement:** The token count appears on the bottom-right status bar near VS Code's indentation, encoding, and language controls by using right alignment with priority `100`.
*   **Viewport-Optimized Debouncing:** Tokenization updates run after a 300ms debounce. The extension may tokenize the active document for accurate counts, but it only calculates and applies visual overlay ranges for text currently visible in the editor.
*   **Universal Configuration:** Model-agnostic configuration names let users swap compatible Hugging Face tokenizers, including Qwen, Llama, and Mistral tokenizers.
*   **Offline Operation:** Tokenizer loading must use local files only. The extension should not download model assets at runtime.
*   **Graceful Degradation:** If no tokenizer path is configured, loading fails, or tokenization throws, the extension should keep VS Code usable, clear stale overlays, and show a concise status/error message.

## 3. Technology Stack
*   **Language:** TypeScript
*   **Engine:** `@huggingface/transformers` (NPM package, handles reading `tokenizer.json` offline).
*   **Extension Host:** VS Code extension APIs for status bar items, configuration, editor events, visible ranges, and text decorations.
*   **Publishing:** `vsce` for local `.vsix` packaging and `ovsx` for Open VSX publishing.

## 4. Architecture

### A. Configuration (`package.json`)
Use universal names:
*   `localTokenizer.modelPath`: Absolute path to a local Hugging Face tokenizer directory containing `tokenizer.json` and any supporting tokenizer/config files required by that tokenizer.
*   `localTokenizer.enableHighlighting`: Boolean to toggle the rainbow overlay.

Configuration changes should trigger a reload of the tokenizer and immediately refresh the active editor.

### B. Extension Components
*   **TokenizerService:** Loads the tokenizer from `localTokenizer.modelPath`, caches the loaded tokenizer, exposes a tokenization method, and reports load/tokenization errors without throwing through event handlers.
*   **DecorationManager:** Owns the five decoration types, maps token offset ranges into VS Code ranges, filters them to visible editor ranges, and clears decorations when highlighting is disabled or invalid.
*   **TokenVisualizerController:** Wires VS Code events to debounced refreshes for the active editor, visible range changes, document edits, configuration changes, and editor switches.
*   **StatusBarController:** Owns the token count item and displays normal, loading, disabled, and error states.

### C. Status Bar Placement
In VS Code, status bar items have a `priority` number that influences their position within an alignment group.
```typescript
// Aligns right; priority 100 targets the cluster near Spaces/Tabs and Language Mode.
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
statusBarItem.text = "$(symbol-numeric) Tokens: 0";
statusBarItem.show();
```

### D. The Looping Rainbow Aesthetics
To keep text readable, use low-opacity background colors and define separate light/dark theme values.

```typescript
// Define a 5-color pastel loop with light/dark contrast.
const colors = [
    { dark: 'rgba(102, 194, 165, 0.25)', light: 'rgba(102, 194, 165, 0.4)' }, // Mint
    { dark: 'rgba(252, 141, 98, 0.25)',  light: 'rgba(252, 141, 98, 0.4)' },  // Coral
    { dark: 'rgba(141, 160, 203, 0.25)', light: 'rgba(141, 160, 203, 0.4)' }, // Periwinkle
    { dark: 'rgba(231, 138, 195, 0.25)', light: 'rgba(231, 138, 195, 0.4)' }, // Pink
    { dark: 'rgba(166, 216, 84, 0.25)',  light: 'rgba(166, 216, 84, 0.4)' }   // Lime
];

// Create the VS Code decoration types
const decorationTypes = colors.map(color => 
    vscode.window.createTextEditorDecorationType({
        light: { backgroundColor: color.light },
        dark: { backgroundColor: color.dark },
        borderRadius: '2px' // Smooths out the edges slightly
    })
);
```

### E. Debounce and Viewport Logic
To keep VS Code perfectly smooth:
1.  **Event Listener:** Listen to `vscode.workspace.onDidChangeTextDocument`.
2.  **Other Refresh Events:** Also refresh on active editor changes, visible range changes, and relevant configuration changes.
3.  **Debounce Timer:** Clear and reset a `setTimeout` for `300ms`. If the user is actively typing, nothing happens. When they pause for 1/3 of a second, the function runs.
4.  **Viewport Mapping:** Instead of painting colors across a large file, only paint what the user can see.
    ```typescript
    // Get visible text ranges
    const visibleRanges = editor.visibleRanges;
    const textToTokenize = editor.document.getText();
    
    // Get token offsets using @huggingface/transformers
    const output = await tokenizer(textToTokenize, { return_offsets_mapping: true });
    
    // Sort into our 5 color buckets using a modulo operator
    const decorationBuckets = [[], [], [], [], []];
    
    output.offset_mapping.forEach((offset, index) => {
        const range = new vscode.Range(
            editor.document.positionAt(offset[0]),
            editor.document.positionAt(offset[1])
        );
        // Only add to bucket if the range intersects with the visible viewport
        if (visibleRanges.some(vr => vr.contains(range))) {
            decorationBuckets[index % 5].push(range);
        }
    });

    // Apply the 5 colors
    decorationTypes.forEach((decType, i) => {
        editor.setDecorations(decType, decorationBuckets[i]);
    });
    ```

## 5. Error Handling
*   Missing `localTokenizer.modelPath`: show `$(symbol-numeric) Tokens: Configure tokenizer` and do not attempt tokenization.
*   Invalid tokenizer path or load failure: show an error status item, clear overlays, and expose enough detail via VS Code notifications or logs for the user to fix the path.
*   Tokenization failure: preserve extension-host stability, clear overlays for the active editor, and show a concise error state.
*   Disabled highlighting: keep token counts active, but clear and skip overlay decorations.

## 6. Testing
Use test-first implementation for behavior that can be isolated from VS Code:
*   Configuration reading and validation.
*   Debounce scheduling behavior.
*   Offset-to-range bucketing and visible-range filtering.
*   Status bar text/state formatting.
*   Error handling for missing paths, load failures, and tokenization failures.

Use VS Code extension integration tests or light smoke tests for activation, command/event wiring, and decoration/status-bar behavior that depends directly on the VS Code API.

## 7. Summary of Workflow
1. Download `tokenizer.json` and config files from Hugging Face.
2. Initialize an extension using `npx yo code`.
3. Install `@huggingface/transformers`.
4. Implement the tokenizer service, decoration manager, controller, and status bar controller.
5. Test locally by hitting `F5` in VS Code.
6. Package locally with `vsce` and publish to Open VSX with `ovsx` when ready.
