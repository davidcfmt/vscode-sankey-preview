# Sankey Markdown Preview

A VS Code extension that renders text-based Sankey diagrams in Markdown preview and standalone `.sankey` files.

## Features

✅ **Markdown Integration** - Render Sankey diagrams directly in Markdown preview using fenced code blocks  
✅ **Multi-Layer Flows** - Support for complex flows like `A → B → C → D`  
✅ **Custom Styling** - Color nodes with `class NodeName color:#RRGGBB`  
✅ **Standalone Files** - Full preview support for `.sankey` files  
✅ **Export Options** - Export diagrams as SVG or PNG  
✅ **Syntax Highlighting** - Code highlighting for `.sankey` files  

## Quick Start

### In Markdown Files

Create a fenced code block with `sankey` language:

````markdown
```sankey
Revenue --> Retail: 500
Revenue --> Cloud: 1000
class Retail color:#FFDD00
class Cloud color:#0099FF
```
````

### Multi-Layer Flows

Chain multiple nodes with arrows:

````markdown
```sankey
// Multi-layer flows
Revenue --> Retail --> Online --> Mobile: 300
Revenue --> Retail --> Store --> Cash: 200
Revenue --> Cloud --> AWS --> Compute: 600
Revenue --> Cloud --> Azure --> Storage: 400

// Styling
class Revenue color:#2ECC71
class Retail color:#FFDD00
class Cloud color:#0099FF
class Online color:#FF6B6B
class Mobile color:#4ECDC4
class Store color:#FFE66D
class AWS color:#FF9F43
class Azure color:#6C5CE7
```
````

### Standalone .sankey Files

Create a `.sankey` file and use **Ctrl+Shift+P** → **"Open Sankey Preview"** for a dedicated preview pane.

## Syntax

### Flow Syntax
```
Source --> Target: Value
Source --> Intermediate --> Target: Value
```

### Styling Syntax
```
class NodeName color:#RRGGBB
```

### Comments
```
// This is a comment
%% This is also a comment
```

## Commands

- **Sankey Preview: Show** - Open preview for `.sankey` files
- **Sankey: Export SVG** - Export current diagram as SVG
- **Sankey: Export PNG** - Export current diagram as PNG

## Requirements

- VS Code 1.91.0 or later
- No external dependencies required

## Installation

1. Download the `.vsix` file from [Releases](https://github.com/davidcfmt/vscode-sankey-preview/releases)
2. Run `code --install-extension sankey-markdown-preview-1.0.0.vsix`
3. Reload VS Code

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Issues and pull requests welcome at [GitHub](https://github.com/davidcfmt/vscode-sankey-preview).
