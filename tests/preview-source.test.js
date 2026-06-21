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
const packageSource = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

test('Markdown preview only targets explicit sankey fences', () => {
  assert.match(previewSource, /pre > code\.language-sankey/);
  assert.match(previewSource, /data-sankey-pending/);
  assert.doesNotMatch(previewSource, /querySelectorAll\(['"`]code['"`]\)/);
  assert.doesNotMatch(previewSource, /textContent\s*\|\|\s*['"`][\s\S]*-->/);
});

test('plain Markdown previews are left untouched when no sankey fence exists', () => {
  assert.match(previewSource, /function renderMarkdownOnce\(\)/);
  assert.match(previewSource, /if \(blocks\.length === 0\) \{\s*return false;/);
  assert.doesNotMatch(previewSource, /function start\(\) \{\s*injectStyles\(\);/);
});

test('Markdown preview rerenders after VS Code updates preview content', () => {
  assert.match(previewSource, /vscode\.markdown\.updateContent/);
  assert.match(previewSource, /function scheduleMarkdownRender\(\)/);
  assert.match(previewSource, /requestAnimationFrame/);
  assert.doesNotMatch(previewSource, /MutationObserver/);
});

test('Markdown integration uses markdown-it fences and leaves command palette binding alone', () => {
  assert.match(packageSource, /"onLanguage:markdown"/);
  assert.match(packageSource, /"markdown\.markdownItPlugins":\s*true/);
  assert.doesNotMatch(packageSource, /"key":\s*"ctrl\+shift\+p"/);
  assert.match(extensionSource, /function extendMarkdownIt\(md\)/);
  assert.match(extensionSource, /language !== 'sankey'/);
  assert.match(extensionSource, /md\.utils\.escapeHtml\(token\.content\)/);
});

test('renderer avoids rounded capsule links and uses compact sizing helpers', () => {
  assert.match(previewSource, /stroke-linecap:\s*butt/);
  assert.match(previewSource, /function getLayoutMetrics\(parsed\)/);
  assert.match(previewSource, /function nodeLabelPosition\(node, metrics\)/);
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
