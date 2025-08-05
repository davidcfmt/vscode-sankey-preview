# Change Log

All notable changes to the "sankey-markdown-preview" extension will be documented in this file.

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