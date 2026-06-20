# Security Review Report

## VS Code Marketplace Security Compliance

This extension implements the following security controls for Sankey previews in
Markdown and `.sankey` files.

### Input Validation & Resource Limits
- Input size is limited to 100KB before rendering.
- Node names are limited to 100 characters.
- Diagram rendering is limited to 1000 nodes and 5000 links.
- Numeric values must be finite, non-negative numbers.
- Renderer height is capped to reduce accidental UI exhaustion.

### Content Security Policy (CSP)
- The custom `.sankey` webview uses `default-src 'none'`.
- Executable scripts are loaded from the extension bundle with a nonce.
- Inline executable scripts are not allowed in the custom webview.
- `style-src 'unsafe-inline'` is retained for local renderer styles only.
- Image sources are limited to extension resources, `data:` URLs, and local `blob:` URLs used during PNG export.

### XSS Prevention
- Initial document content is stored as inert textarea text, not executable script.
- Dynamic user-controlled labels and errors are written with `textContent`.
- SVG nodes, links, and labels are created through DOM APIs.
- Error messages no longer flow through `innerHTML`.

### File Security
- The extension only writes export files after a VS Code save dialog.
- Export format is limited to SVG and PNG.
- Export payload size is limited to 10MB.

### Information Disclosure
- Document content preview logging has been removed.
- Renderer debug logging that included user content has been removed.

### Dependency Posture
- `d3-sankey` is bundled into `media/preview.js` at build time.
- Preview rendering does not load remote scripts, images, CDN assets, or Kroki-style network renderers.
- Development and packaging dependencies should be audited before publication.

## Verification

Run these checks before publishing:

```powershell
npm run lint
npm test
npm audit --omit=dev
npm audit
npm run package
```

## Version Information
- Extension Version: 2.1.0
- VS Code API Version: ^1.91.0
