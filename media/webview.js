(function () {
  try {
    const vscode = acquireVsCodeApi();

    let parsed;
    
    // Simple parser function - same as before but inline
    function parseSankey(text) {
      if (!text || typeof text !== 'string') {
        throw new Error('No text provided or text is not a string');
      }
      
      const nodes = [];
      const index = new Map();
      const links = [];
      const styles = {};
      const options = {};

      const get = (name) => {
        if (!index.has(name)) {
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
        if (node && colorMatch) styles[node] = { color: colorMatch[1] };
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
        // Sanitize node names (prevent XSS and limit length)
        let source = pathNodes[i].trim();
        let target = pathNodes[i + 1].trim();
        
        // Handle quoted node names
        if (source.startsWith('"') && source.endsWith('"')) {
          source = source.slice(1, -1);
        }
        if (target.startsWith('"') && target.endsWith('"')) {
          target = target.slice(1, -1);
        }
        
        // Validate and sanitize node names
        if (typeof source !== 'string' || source.length === 0) {
          throw new Error(`Invalid source node name: ${pathNodes[i]}`);
        }
        if (typeof target !== 'string' || target.length === 0) {
          throw new Error(`Invalid target node name: ${pathNodes[i + 1]}`);
        }
        
        // Remove potentially dangerous characters and limit length
        source = source.replace(/[<>\"'&]/g, '').substring(0, 100);
        target = target.replace(/[<>\"'&]/g, '').substring(0, 100);
        
        // Validate numeric value
        const numericValue = parseFloat(val);
        if (isNaN(numericValue) || !isFinite(numericValue) || numericValue < 0) {
          throw new Error(`Invalid numeric value: ${val}`);
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
    root.innerHTML = '';    // Handle undefined or null text
    if (!text || typeof text !== 'string') {
      root.innerHTML = '<p style="color: #666; padding: 20px; text-align: center;">No valid text provided for parsing</p>';
      return;
    }
    
    try {
      parsed = parseSankey(text);
    } catch (e) {
      root.innerHTML = '<p style="color: red; padding: 20px;">Parse Error: ' + e.message + '</p>';
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

    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    
    // Clear any existing content
    document.getElementById('root').innerHTML = '';
    
    const svg = d3.select('#root').append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#f8f9fa');

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

    const container = svg.append('g');

    const sankey = d3.sankey()
      .nodeWidth(25)
      .nodePadding(20)
      .extent([[40, 40], [width - 40, height - 40]]);

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

    // Add node labels with enhanced styling
    container.append('g')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', d => d.x0 < width / 2 ? d.x1 + 12 : d.x0 - 12)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
      .style('font-size', '13px')
      .style('font-weight', '500')
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
      .attr('stroke-width', d => Math.max(2, d.width))
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', d => Math.max(3, d.width + 1));
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('stroke-width', d => Math.max(2, d.width));
      })
      .append('title')
      .text(d => `${d.source.id} → ${d.target.id}\n${d.value}`);

    // Enhanced zoom and pan
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (e) => {
        container.attr('transform', e.transform);
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
    if (typeof d3 !== 'undefined' && typeof d3.sankey !== 'undefined') {
      const initialText = window.__INITIAL_TEXT__ || '';
      render(initialText);
    } else {
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
    document.getElementById('root').innerHTML = `<p style="color: red; padding: 20px;">Error: ${error.message}</p>`;
  }
})();
