const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { DEFAULT_LIMITS, parseSankey, toMermaidSankey } = require('./parser');

const diagCollection = vscode.languages.createDiagnosticCollection('sankey');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getPositiveNumberConfig(config, key, fallback) {
  const value = config.get(key, fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getParserLimits() {
  const config = vscode.workspace.getConfiguration('sankeyPreview');
  return {
    maxInputSize: getPositiveNumberConfig(config, 'maxInputSize', DEFAULT_LIMITS.maxInputSize),
    maxNodes: getPositiveNumberConfig(config, 'maxNodes', DEFAULT_LIMITS.maxNodes),
    maxLinks: getPositiveNumberConfig(config, 'maxLinks', DEFAULT_LIMITS.maxLinks)
  };
}

function createWebviewHtml(panel, context, text, limits = DEFAULT_LIMITS) {
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.js')
  );
  const nonce = getNonce();
  const initialText = escapeHtml(text || '');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sankey Preview</title>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src data: blob: ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      overflow: hidden;
    }
    .sankey-container {
      width: 100%;
      height: calc(100vh - 40px);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-editor-background);
      overflow: hidden;
      position: relative;
    }
    #sankey-diagram {
      width: 100%;
      height: 100%;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="sankey-container">
    <div id="sankey-diagram" class="loading"
         data-max-input-size="${limits.maxInputSize}"
         data-max-nodes="${limits.maxNodes}"
         data-max-links="${limits.maxLinks}">Loading Sankey diagram...</div>
    <textarea id="sankey-source" hidden readonly>${initialText}</textarea>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function openPreview(doc, context) {
  try {
    const panel = vscode.window.createWebviewPanel(
      'sankeyPreview',
      `Sankey: ${path.basename(doc.uri.fsPath)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );
    
    const text = doc.getText();
    const limits = getParserLimits();
    panel.webview.html = createWebviewHtml(panel, context, text || '', limits);

    // Update on save
    const saveSub = vscode.workspace.onDidSaveTextDocument((d) => {
      if (d === doc) {
        try {
          if (vscode.workspace.getConfiguration('sankeyPreview').get('autoRefresh', true) === false) {
            return;
          }
          const newText = d.getText();
          panel.webview.postMessage({ type: 'update', text: newText });
        } catch (error) {
          console.error('Failed to update preview:', error);
        }
      }
    });

    // Handle export requests coming from the webview
    panel.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.type === 'export' && msg.format && msg.data) {
          // Validate format
          if (!['svg', 'png'].includes(msg.format)) {
            vscode.window.showErrorMessage('Invalid export format');
            return;
          }
          
          // Validate data size
          if (msg.data.length > 10 * 1024 * 1024) { // 10MB limit
            vscode.window.showErrorMessage('Export data too large');
            return;
          }
          
          const uri = await vscode.window.showSaveDialog({
            filters: { [msg.format.toUpperCase()]: [msg.format] },
            defaultUri: doc.uri.with({ path: doc.uri.path + '.' + msg.format })
          });
          if (uri) {
            try {
              await fs.promises.writeFile(uri.fsPath, msg.data, msg.format === 'svg' ? 'utf8' : 'base64');
              vscode.window.showInformationMessage(`Exported ${uri.fsPath}`);
            } catch (error) {
              vscode.window.showErrorMessage(`Export failed: ${error.message}`);
            }
          }
        } else if (msg.type === 'copyMermaid' && typeof msg.data === 'string') {
          if (msg.data.length > 1024 * 1024) {
            vscode.window.showErrorMessage('Mermaid export too large');
            return;
          }
          await vscode.env.clipboard.writeText(msg.data);
          vscode.window.showInformationMessage('Copied Mermaid Sankey to clipboard');
        }
      } catch (error) {
        console.error('Error handling webview message:', error);
        vscode.window.showErrorMessage('An error occurred while processing the request');
      }
    });

    panel.onDidDispose(() => saveSub.dispose());
  } catch (error) {
    console.error('Failed to open preview:', error);
    vscode.window.showErrorMessage('Failed to open Sankey preview');
  }
}

function validateDocument(doc) {
  if (doc.languageId !== 'sankey') return;
  const diagnostics = [];
  try {
    parseSankey(doc.getText(), getParserLimits());
  } catch (err) {
    const messageLine = err.message.match(/line (\d+)/)?.[1];
    const line = Math.max(0, Number(err.line || messageLine || 1) - 1);
    const severity = err.message.includes('too large') || err.message.includes('Too many') 
      ? vscode.DiagnosticSeverity.Warning 
      : vscode.DiagnosticSeverity.Error;
    
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(line, 0, line, 1),
        err.message,
        severity
      )
    );
  }
  diagCollection.set(doc.uri, diagnostics);
}

async function copyActiveDocumentAsMermaid() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Open a .sankey file or select Sankey source in Markdown first.');
    return;
  }

  const doc = editor.document;
  const hasSelection = !editor.selection.isEmpty;
  if (doc.languageId !== 'sankey' && !hasSelection) {
    vscode.window.showErrorMessage('Select Sankey source in Markdown, or open a .sankey file first.');
    return;
  }

  const text = hasSelection ? doc.getText(editor.selection) : doc.getText();
  try {
    const mermaid = toMermaidSankey(text, getParserLimits(), { fenced: true });
    await vscode.env.clipboard.writeText(mermaid);
    vscode.window.showInformationMessage('Copied Mermaid Sankey to clipboard');
  } catch (error) {
    vscode.window.showErrorMessage(`Could not convert Sankey diagram: ${error.message}`);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validateDocument),
    vscode.workspace.onDidChangeTextDocument((e) => validateDocument(e.document)),
    vscode.workspace.onDidSaveTextDocument(validateDocument),
    vscode.commands.registerCommand('sankeyPreview.show', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc) {
        openPreview(doc, context);
      } else {
        vscode.window.showErrorMessage('Please open a .sankey file first, then run this command.');
      }
    }),
    vscode.commands.registerCommand('sankeyPreview.exportSvg', () => {
      vscode.window.activeTextEditor?.document &&
        vscode.commands.executeCommand('sankeyPreview.show').then(() =>
          vscode.window.showInformationMessage('Use the export button in preview.'));
    }),
    vscode.commands.registerCommand('sankeyPreview.exportPng', () => {
      vscode.window.activeTextEditor?.document &&
        vscode.commands.executeCommand('sankeyPreview.show').then(() =>
          vscode.window.showInformationMessage('Use the export button in preview.'));
    }),
    vscode.commands.registerCommand('sankeyPreview.copyMermaid', copyActiveDocumentAsMermaid)
  );
}

function deactivate() {
  diagCollection.dispose();
}

module.exports = { activate, deactivate };
