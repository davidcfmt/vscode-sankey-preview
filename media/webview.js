(function () {
  try {
    const vscode = acquireVsCodeApi();

    let parsed;
    
    // HTML escaping function to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Simple parser function - same as parser.js but inline
    function parseSankey(text) {
      if (!text || typeof text !== 'string') {
        throw new Error('No text provided or text is not a string');
      }

      // Add input size limits to prevent DoS attacks
      if (text.length > 100000) { // 100KB limit
        throw new Error('Input too large (maximum 100KB)');
      }
      
      const nodes = [];
      const index = new Map();
      const links = [];
      const styles = {};
      const options = {};

      // Limit number of nodes to prevent memory exhaustion
      const MAX_NODES = 1000;
      const MAX_LINKS = 5000;

      const get = (name) => {
        if (!index.has(name)) {
          if (nodes.length >= MAX_NODES) {
            throw new Error(`Too many nodes (maximum ${MAX_NODES})`);
          }
          index.set(name, nodes.length);
          nodes.push({ id: name });
        }
        return index.get(name);
      };

    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('%%')) continue;

      // class Node color:#RRGGBB (supports quoted names: class "South Africa" color:#FF0000)
      if (line.startsWith('class ')) {
        const quotedMatch = line.match(/^class\s+"([^"]+)"\s+(.+)$/);
        const unquotedMatch = line.match(/^class\s+(\S+)\s+(.+)$/);
        
        let node, rest;
        if (quotedMatch) {
          [, node, rest] = quotedMatch;
        } else if (unquotedMatch) {
          [, node, rest] = unquotedMatch;
        }
        
        const colorMatch = rest?.match(/color\s*:\s*(#[0-9a-f]{3,8})/i);
        if (node && colorMatch) {
          // Validate color format
          const color = colorMatch[1];
          if (color && /^#[0-9a-f]{3,8}$/i.test(color)) {
            styles[node] = { color: color };
          }
        }
        continue;
      }

      // Global option  key: value
      if (!line.includes('-->') && line.includes(':')) {
        const [k, v] = line.split(':', 2);
        options[k.trim()] = v.trim();
        continue;
      }

      // Link  A --> B: 123 "optional label"
      // Multi-layer: A --> B --> C --> D: 123 "optional label"
      const match = line.match(/^(.+?):\s*([\d.]+)(?:\s+"(.+?)")?$/);
      if (!match) throw new Error(`Syntax error: ${line}`);
      const [, pathString, val, lbl] = match;

      // Split the path by --> to get all nodes in the chain
      const pathNodes = pathString.split('-->').map(node => node.trim());
      
      if (pathNodes.length < 2) {
        throw new Error(`Path must have at least 2 nodes: ${line}`);
      }

      // Create links for each step in the chain
      for (let i = 0; i < pathNodes.length - 1; i++) {
        if (links.length >= MAX_LINKS) {
          throw new Error(`Too many links (maximum ${MAX_LINKS})`);
        }
        
        const source = pathNodes[i].replace(/^"(.*)"$/, '$1'); // Remove quotes if present
        const target = pathNodes[i + 1].replace(/^"(.*)"$/, '$1'); // Remove quotes if present
        
        // Validate and sanitize node names
        if (!source || source.length === 0 || source.length > 100) {
          throw new Error(`Invalid source node name: ${source} (must be 1-100 characters)`);
        }
        if (!target || target.length === 0 || target.length > 100) {
          throw new Error(`Invalid target node name: ${target} (must be 1-100 characters)`);
        }
        
        // Validate numeric value
        const numericValue = parseFloat(val);
        if (isNaN(numericValue) || numericValue < 0 || !isFinite(numericValue)) {
          throw new Error(`Invalid value: ${val} (must be a non-negative finite number)`);
        }
        
        links.push({
          source: get(source),
          target: get(target),
          value: numericValue,
          label: i === pathNodes.length - 2 ? lbl : undefined // Only add label to the final link
        });
      }
    }

    // Apply styles
    nodes.forEach((n) => Object.assign(n, styles[n.id] || {}));
    return { nodes, links, options };
  }

  function render(text) {
    // Clear previous content
    const root = document.getElementById('root');
    root.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #666;">Loading diagram...</div>';
    
    console.log('Render called with:', typeof text, text?.length);
    
    // Handle undefined or null text - more lenient check
    if (!text || typeof text !== 'string') {
      console.log('Text validation failed:', {text, type: typeof text});
      root.innerHTML = '<p style="color: #666; padding: 20px; text-align: center;">No valid text provided for parsing</p>';
      return;
    }
    
    // Remove extra whitespace but don't fail on whitespace-only content
    text = text.trim();
    if (text.length === 0) {
      console.log('Text is empty after trim');
      root.innerHTML = '<p style="color: #666; padding: 20px; text-align: center;">File appears to be empty</p>';
      return;
    }
    
    try {
      parsed = parseSankey(text);
    } catch (e) {
      root.innerHTML = '<p style="color: red; padding: 20px;">Parse Error: ' + escapeHtml(e.message) + '</p>';
      return;
    }
    
    // Check if D3 is available
    if (typeof d3 === 'undefined') {
      root.innerHTML = '<p style="color: red; padding: 20px;">D3 library not loaded</p>';
      return;
    }
    
    if (typeof d3.sankey === 'undefined') {
      root.innerHTML = '<p style="color: red; padding: 20px;">D3 sankey library not loaded</p>';
      return;
    }

    // Use proper dimensions with padding
    const width = Math.max(800, document.body.clientWidth);
    const height = Math.max(600, document.body.clientHeight);
    const margin = { top: 50, right: 150, bottom: 50, left: 150 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Clear any existing content
    document.getElementById('root').innerHTML = '';
    
    const svg = d3.select('#root').append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#fff');

    // Add definitions for gradients and filters
    const defs = svg.append('defs');
    
    // Add drop shadow filter
    const filter = defs.append('filter')
      .attr('id', 'dropshadow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    
    filter.append('feDropShadow')
      .attr('dx', 1)
      .attr('dy', 2)
      .attr('stdDeviation', 1)
      .attr('flood-color', 'rgba(0,0,0,0.15)');

    const container = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const sankey = d3.sankey()
      .nodeWidth(20)
      .nodePadding(30)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    const graph = sankey({
      nodes: parsed.nodes.map(d => Object.assign({}, d)),
      links: parsed.links.map(d => Object.assign({}, d))
    });

    // More subtle color palette
    const defaultColors = [
      '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', 
      '#1abc9c', '#34495e', '#e67e22', '#8e44ad', '#27ae60',
      '#2980b9', '#c0392b', '#d35400', '#7f8c8d', '#16a085'
    ];

    // Assign colors to nodes if they don't have them
    graph.nodes.forEach((node, i) => {
      if (!node.color) {
        node.color = defaultColors[i % defaultColors.length];
      }
    });

    // Draw nodes with enhanced styling
    container.append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('height', d => d.y1 - d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('rx', 2) // Slightly rounded corners
      .attr('ry', 2)
      .attr('fill', d => d.color || '#444')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('filter', 'url(#dropshadow)')
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 2);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', 1);
      })
      .append('title')
      .text(d => `${d.id}\n${d.value}`);

    // Add node labels with better positioning and larger font
    container.append('g')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', d => d.x0 < innerWidth / 2 ? d.x1 + 8 : d.x0 - 8)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < innerWidth / 2 ? 'start' : 'end')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#2c3e50')
      .style('pointer-events', 'none')
      .text(d => d.id);

    // Draw links with enhanced styling
    const link = container.append('g')
      .attr('fill', 'none')
      .selectAll('g')
      .data(graph.links)
      .join('g');

    // Add gradients for each link
    link.each(function(d, i) {
      const gradient = defs.append('linearGradient')
        .attr('id', `linkGradient${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', d.source.x1)
        .attr('x2', d.target.x0);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d.source.color || '#888')
        .attr('stop-opacity', 0.6);
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', d.target.color || '#888')
        .attr('stop-opacity', 0.6);
    });

    link.append('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', (d, i) => `url(#linkGradient${i})`)
      .attr('stroke-width', d => Math.max(3, d.width))
      .attr('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.9)
          .attr('stroke-width', d => Math.max(4, d.width + 2));
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.7)
          .attr('stroke-width', d => Math.max(3, d.width));
      })
      .append('title')
      .text(d => `${d.source.id} → ${d.target.id}\n${d.value}`);

    // Add zoom and pan with better bounds
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        container.attr('transform', 
          `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`
        );
      });

    svg.call(zoom);

    // Subtle export buttons
    const buttonContainer = d3.select('#root')
      .append('div')
      .style('position', 'absolute')
      .style('top', '15px')
      .style('right', '15px')
      .style('display', 'flex')
      .style('gap', '8px');

    // SVG Export Button
    buttonContainer.append('button')
      .style('background', '#ffffff')
      .style('color', '#2c3e50')
      .style('border', '1px solid #ddd')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('cursor', 'pointer')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
      .style('font-weight', '500')
      .style('font-size', '12px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
      .style('transition', 'all 0.2s ease')
      .text('SVG')
      .on('mouseover', function() {
        d3.select(this)
          .style('background', '#f8f9fa')
          .style('border-color', '#aaa');
      })
      .on('mouseout', function() {
        d3.select(this)
          .style('background', '#ffffff')
          .style('border-color', '#ddd');
      })
      .on('click', exportSvg);

    // PNG Export Button
    buttonContainer.append('button')
      .style('background', '#ffffff')
      .style('color', '#2c3e50')
      .style('border', '1px solid #ddd')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('cursor', 'pointer')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
      .style('font-weight', '500')
      .style('font-size', '12px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
      .style('transition', 'all 0.2s ease')
      .text('PNG')
      .on('mouseover', function() {
        d3.select(this)
          .style('background', '#f8f9fa')
          .style('border-color', '#aaa');
      })
      .on('mouseout', function() {
        d3.select(this)
          .style('background', '#ffffff')
          .style('border-color', '#ddd');
      })
      .on('click', exportPng);
  }

  function exportSvg() {
    const svgText = new XMLSerializer().serializeToString(document.querySelector('svg'));
    vscode.postMessage({ type: 'export', format: 'svg', data: svgText });
  }

  function exportPng() {
    const svgEl = document.querySelector('svg');
    const svgText = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const b64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.clientWidth;
      canvas.height = svgEl.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      vscode.postMessage({ type: 'export', format: 'png', data: canvas.toDataURL().replace(/^data:image\/png;base64,/, '') });
    };
    img.src = b64;
  }

  // Toolbar
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;top:4px;right:8px;z-index:10;';
  bar.innerHTML = `<button id="expSvg">SVG</button> <button id="expPng">PNG</button>`;
  document.body.append(bar);
  document.getElementById('expSvg').onclick = exportSvg;
  document.getElementById('expPng').onclick = exportPng;

  // Wait for D3 libraries to load, then render
  function checkAndRender() {
    console.log('checkAndRender called');
    console.log('D3 available:', typeof d3 !== 'undefined');
    console.log('D3 sankey available:', typeof d3 !== 'undefined' && typeof d3.sankey !== 'undefined');
    console.log('window.__INITIAL_TEXT__ available:', typeof window.__INITIAL_TEXT__ !== 'undefined');
    console.log('window.__INITIAL_TEXT__ value:', window.__INITIAL_TEXT__);
    
    if (typeof d3 !== 'undefined' && typeof d3.sankey !== 'undefined') {
      const initialText = window.__INITIAL_TEXT__ || '';
      console.log('checkAndRender() - initialText length:', initialText.length);
      console.log('checkAndRender() - initialText preview:', initialText.substring(0, 50));
      render(initialText);
    } else {
      console.log('Waiting for D3 libraries...');
      setTimeout(checkAndRender, 100);
    }
  }

  // Start checking for libraries
  checkAndRender();

  // Receive updates
  window.addEventListener('message', e => {
    if (e.data.type === 'update' && e.data.text) {
      render(e.data.text);
    }
  });
  
  } catch (error) {
    document.getElementById('root').innerHTML = `<p style="color: red; padding: 20px;">Error: ${escapeHtml(error.message)}</p>`;
  }
})();
