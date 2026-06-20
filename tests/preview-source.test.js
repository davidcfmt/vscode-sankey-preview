const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function test(name, run) {
  try {
    run();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

const root = path.join(__dirname, '..');
const previewSource = fs.readFileSync(path.join(root, 'src', 'previewRenderer.js'), 'utf8');
const extensionSource = fs.readFileSync(path.join(root, 'src', 'extension.js'), 'utf8');

test('Markdown preview only targets explicit sankey fences', () => {
  assert.match(previewSource, /pre > code\.language-sankey/);
  assert.doesNotMatch(previewSource, /querySelectorAll\(['"`]code['"`]\)/);
  assert.doesNotMatch(previewSource, /textContent\s*\|\|\s*['"`][\s\S]*-->/);
});

test('plain Markdown previews are left untouched when no sankey fence exists', () => {
  assert.match(previewSource, /const blocks = getMarkdownSankeyBlocks\(\);/);
  assert.match(previewSource, /if \(blocks\.length > 0\) \{\s*injectStyles\(\);\s*renderMarkdownBlocks\(blocks\);/);
  assert.doesNotMatch(previewSource, /function start\(\) \{\s*injectStyles\(\);/);
});

test('renderer and extension do not use innerHTML user-content sinks', () => {
  assert.doesNotMatch(previewSource, /\.innerHTML\b/);
  assert.doesNotMatch(extensionSource, /\.innerHTML\b/);
});

test('standalone webview keeps remote content blocked by CSP', () => {
  assert.match(extensionSource, /default-src 'none'/);
  assert.match(extensionSource, /script-src 'nonce-\$\{nonce\}'/);
  assert.match(extensionSource, /localResourceRoots:\s*\[vscode\.Uri\.joinPath\(context\.extensionUri,\s*'media'\)\]/);
});
