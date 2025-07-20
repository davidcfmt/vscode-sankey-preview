const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { parseSankey } = require('./parser');

const diagCollection = vscode.languages.createDiagnosticCollection('sankey');

function createWebviewHtml(panel, context, text) {
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'webview.js')
  );
  const d3Uri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'd3.v7.min.js')
  );
  const sankeyUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'd3-sankey.min.js')
  );

  // Pass initial text via script tag
  return /* html */ `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src ${panel.webview.cspSource} 'unsafe-eval' 'unsafe-inline';">
  <style>html,body{padding:0;margin:0;overflow:hidden;height:100%;}</style>
</head>
<body>
  <div id="root" style="width:100%;height:100%;">Loading...</div>
  <script>
    window.__INITIAL_TEXT__ = ${JSON.stringify(text || '')};
  </script>
  <script src="${d3Uri}"></script>
  <script src="${sankeyUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function openPreview(doc, context) {
  const panel = vscode.window.createWebviewPanel(
    'sankeyPreview',
    `Sankey: ${path.basename(doc.uri.fsPath)}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  
  const text = doc.getText();
  panel.webview.html = createWebviewHtml(panel, context, text || '');

  // Update on save
  const saveSub = vscode.workspace.onDidSaveTextDocument((d) => {
    if (d === doc) {
      const newText = d.getText();
      panel.webview.postMessage({ type: 'update', text: newText });
    }
  });

  // Handle export requests coming from the webview
  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.type === 'export' && msg.format && msg.data) {
      const uri = await vscode.window.showSaveDialog({
        filters: { [msg.format.toUpperCase()]: [msg.format] },
        defaultUri: doc.uri.with({ path: doc.uri.path + '.' + msg.format })
      });
      if (uri) {
        await fs.promises.writeFile(uri.fsPath, msg.data, msg.format === 'svg' ? 'utf8' : 'base64');
        vscode.window.showInformationMessage(`Exported ${uri.fsPath}`);
      }
    }
  });

  panel.onDidDispose(() => saveSub.dispose());
}

function validateDocument(doc) {
  if (doc.languageId !== 'sankey') return;
  const diagnostics = [];
  try {
    parseSankey(doc.getText());
  } catch (err) {
    const line = err.message.match(/line (\d+)/)?.[1] ?? 0;
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(+line, 0, +line, 1),
        err.message,
        vscode.DiagnosticSeverity.Error
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
          vscode.window.showInformationMessage('Use the export button in preview.'))
    }),
    vscode.commands.registerCommand('sankeyPreview.exportPng', () => {
      vscode.window.activeTextEditor?.document &&
        vscode.commands.executeCommand('sankeyPreview.show').then(() =>
          vscode.window.showInformationMessage('Use the export button in preview.'))
    })
  );
}

function deactivate() {
  diagCollection.dispose();
}

module.exports = { activate, deactivate };
