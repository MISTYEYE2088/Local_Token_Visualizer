import { runTests } from '@vscode/test-electron';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionDevelopmentPath = dirname(fileURLToPath(import.meta.url));
const extensionTestsPath = resolve(extensionDevelopmentPath, './out/test/suite/index.js');

await runTests({
  extensionDevelopmentPath,
  extensionTestsPath
});
