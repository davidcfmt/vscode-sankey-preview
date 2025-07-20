# Testing Instructions

## To test the extension:

1. **Press F5** to launch the Extension Development Host
2. In the new VS Code window, open `demo.sankey` 
3. Press **Ctrl+Shift+P** and run "Open Sankey Preview"
4. You should see a working Sankey diagram

## For Markdown testing:

1. Open `test.md`
2. Press **Ctrl+Shift+V** to open markdown preview
3. The Sankey diagram should render in the preview

## Main fixes applied:

1. Fixed D3 library filename from `d3.min.js` to `d3.v7.min.js`
2. Fixed extension context passing
3. Fixed zoom implementation  
4. Added node labels
5. Added library loading detection with retry logic
