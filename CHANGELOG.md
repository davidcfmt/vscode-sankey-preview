# Change Log

All notable changes to the "sankey-markdown-preview" extension will be documented in this file.

## [2.0.2] - 2025-08-04

### 🐛 **Critical Bug Fix**
- **Fixed "layoutSankey is not defined" error**: Resolved undefined function error in .sankey file rendering
- **Simplified rendering pipeline**: Now uses the existing proven `drawSankey` function for consistency
- **Improved error handling**: Better error messages for debugging rendering issues

---

## [2.0.1] - 2025-08-04

### 🐛 **Bug Fixes**
- **Fixed .sankey file preview**: Resolved "loading" issue where .sankey files wouldn't render
- **Unified rendering system**: Both Markdown preview and .sankey files now use the same inline renderer
- **Improved error handling**: Better error messages and fallbacks for rendering issues
- **Enhanced webview integration**: Fixed script loading and message passing between VS Code and webview

### 🔧 **Technical Improvements**
- **Consistent preview experience**: Markdown and .sankey files now have identical rendering behavior
- **Better CSP compliance**: Improved Content Security Policy handling
- **Streamlined dependencies**: Removed references to unused external D3 files

---

## [2.0.0] - 2025-08-04

### 🚀 Major Release - Breaking Changes

#### ⚡ **BREAKING CHANGES**
- **Removed external D3 dependencies**: Extension now uses inline D3 implementation for better security and reliability
- **Enhanced security model**: No longer requires external script loading, fully compliant with VS Code CSP
- **Improved architecture**: Self-contained preview system with no external dependencies

#### ✨ **New Features**
- **Enhanced Markdown Integration**: Significantly improved Sankey diagram rendering in Markdown preview
- **Professional Examples**: Added `demo.sankey` with real-world business scenarios
- **Better Documentation**: Enhanced README with complete usage guide and troubleshooting
- **Comprehensive Test Files**: Updated `test.sankey` and `test.md` with multi-scenario examples

#### 🔧 **Technical Improvements**
- **Inline D3 Implementation**: Self-contained Sankey algorithm with minimal D3 subset
- **Security Compliant**: No external script dependencies, works in all VS Code security modes
- **Performance Optimized**: Faster loading and rendering with reduced overhead
- **Workspace Trust Compatible**: Works seamlessly with VS Code workspace trust requirements

#### 🐛 **Bug Fixes**
- **Fixed Markdown Preview**: Resolved Content Security Policy blocking issues
- **Improved Parser**: Better handling of complex multi-layer flows
- **Enhanced Styling**: Fixed color application and node positioning

#### 🔄 **Migration Guide**
If you're upgrading from 1.x, no action required - your existing `.sankey` files will continue to work with improved performance and reliability.

---

## [1.0.0] - 2025-07-19

### Added
- Initial release of Sankey Markdown Preview extension
- Multi-layer flow support with unlimited depth (A --> B --> C --> D: 123)
- Professional styling with gradients, shadows, and hover effects
- Markdown integration with automatic code block rendering
- Dedicated .sankey file format support
- Custom node styling with color classes
- Interactive tooltips and hover effects
- Live preview with auto-update on save
- Export functionality (SVG and PNG)
- Syntax highlighting for .sankey files
- Code snippets for common patterns
- Comprehensive error handling and validation

### Features
- **Multi-layer flows**: Revenue --> Retail --> Online --> Mobile: 300
- **Professional styling**: Beautiful gradients and visual effects
- **Markdown integration**: Render in markdown preview automatically
- **Custom colors**: class NodeName color:#FF0000
- **Comments support**: // and %% comment styles
- **Quoted node names**: Support for nodes with spaces
- **Security**: Marketplace-ready with proper CSP and input validation