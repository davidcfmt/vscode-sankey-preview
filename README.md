

# A VS Code extension for creating and previewing beautiful Sankey diagrams directly in Markdown files and .sankey files with multi-layer support and professional styling.

## Features

- ✨ **Multi-layer flows**: Support for unlimited depth chains like Revenue --> Retail --> Online --> Mobile: 300
- 🎨 **Professional styling**: Beautiful gradients, shadows, and hover effects
- - 📝 **Markdown integration**: Render Sankey diagrams in markdown preview
- 🎯 **Dedicated .sankey files**: Full support for .sankey file format
- 🌈 **Custom styling**: Color nodes with class NodeName color:#FF0000
- 📊 **Interactive**: Hover effects and tooltips
- 🔄 **Live preview**: Auto-updates on save

## Usage

### In Markdown Files
Create a code block with sankey language:

\`\`\`sankey
Revenue --> Retail: 500
Revenue --> Online: 300
Retail --> Mobile: 200
Online --> Mobile: 150
class Revenue color:#2ecc71
class Retail color:#3498db
\`\`\`

### In .sankey Files
Open any .sankey file and use the command 'Open Sankey Preview'.

## Syntax

### Basic Flow
NodeA --> NodeB: 100

### Multi-layer Flow
Revenue --> Retail --> Store --> Cash: 300
Revenue --> Online --> Mobile --> Apps: 200

### Styling Nodes
class NodeName color:#FF6B6B
class \"Node With Spaces\" color:#4ECDC4

### Comments
// This is a comment
%% This is also a comment

## Installation

1. Install from the VS Code Marketplace
2. Open a markdown file or create a .sankey file
3. Start creating beautiful flow diagrams!

## Commands

- Sankey: Open Preview - Open preview for .sankey files
- Sankey: Export SVG - Export diagram as SVG
- Sankey: Export PNG - Export diagram as PNG

## Requirements

- VS Code 1.91.0 or higher

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT - see LICENSE file for details."
