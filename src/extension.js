const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { parseSankey } = require('./parser');

const diagCollection = vscode.languages.createDiagnosticCollection('sankey');

function createWebviewHtml(panel, context, text) {
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'preview.js')
  );

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sankey Preview</title>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'self' 'unsafe-inline'; script-src ${panel.webview.cspSource} 'unsafe-inline';">
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
    <div id="sankey-diagram" class="loading">Loading Sankey diagram...</div>
  </div>
  <script>
    // Store the content for the renderer
    window.__SANKEY_CONTENT__ = ${JSON.stringify(text || '')};
    
    // Initialize when script loads
    window.addEventListener('load', function() {
      const container = document.getElementById('sankey-diagram');
      container.className = ''; // Remove loading class
      
      if (window.renderSankeyFromText && window.__SANKEY_CONTENT__) {
        try {
          window.renderSankeyFromText(window.__SANKEY_CONTENT__, container);
        } catch (error) {
          console.error('Error rendering Sankey:', error);
          container.innerHTML = '<div style="color: red; padding: 20px;"><h3>Error rendering Sankey diagram:</h3><pre>' + error.message + '</pre></div>';
        }
      } else {
        container.innerHTML = '<div style="color: orange; padding: 20px;">Sankey renderer not available</div>';
      }
    });
    
    // Handle updates from VS Code
    window.addEventListener('message', function(event) {
      const message = event.data;
      if (message.type === 'update' && message.text) {
        const container = document.getElementById('sankey-diagram');
        window.__SANKEY_CONTENT__ = message.text;
        if (window.renderSankeyFromText) {
          container.innerHTML = '';
          window.renderSankeyFromText(message.text, container);
        }
      }
    });
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function openPreview(doc, context) {
  try {
    const panel = vscode.window.createWebviewPanel(
      'sankeyPreview',
      `Sankey: ${path.basename(doc.uri.fsPath)}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    
    const text = doc.getText();
    console.log('Document text length:', text?.length);
    console.log('Document text preview:', text?.substring(0, 100));
    panel.webview.html = createWebviewHtml(panel, context, text || '');

    // Update on save
    const saveSub = vscode.workspace.onDidSaveTextDocument((d) => {
      if (d === doc) {
        try {
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
    parseSankey(doc.getText());
  } catch (err) {
    const line = err.message.match(/line (\d+)/)?.[1] ?? 0;
    const severity = err.message.includes('too large') || err.message.includes('Too many') 
      ? vscode.DiagnosticSeverity.Warning 
      : vscode.DiagnosticSeverity.Error;
    
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(+line, 0, +line, 1),
        err.message,
        severity
      )
    );
  }
  diagCollection.set(doc.uri, diagnostics);
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
    })
  );
}

function deactivate() {
  diagCollection.dispose();
}

module.exports = { activate, deactivate };
