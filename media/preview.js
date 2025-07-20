(function () {
  const scriptPath = document.currentScript.src.replace(/preview\.js$/, '');
  
  // Load D3 libraries using script tags instead of import
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Load D3 libraries sequentially
  Promise.all([
    loadScript(scriptPath + 'd3.v7.min.js'),
    loadScript(scriptPath + 'd3-sankey.min.js')
  ]).then(() => {
    const { parseSankey } = (() => {
      // Same tiny parser as before (inline here for brevity)
      function parse(text) {
        if (!text || typeof text !== 'string') {
          throw new Error('No text provided or text is not a string');
        }
        
        // Basic trim check only
        const trimmedText = text.trim();
        if (!trimmedText) {
          throw new Error('Empty content');
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

        const lines = text.split('\n');
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
            const source = pathNodes[i];
            const target = pathNodes[i + 1];
            
            links.push({
              source: get(source),
              target: get(target),
              value: +val,
              label: i === pathNodes.length - 2 ? lbl : undefined // Only add label to the final link
            });
          }
        }

        // Apply styles
        nodes.forEach((n) => Object.assign(n, styles[n.id] || {}));
        return { nodes, links, options };
      }
      return { parseSankey: parse };
    })();

    function upgrade(code) {
      const pre = code.parentElement;
      const container = document.createElement('div');
      container.className = 'sankey';
      container.style.maxWidth = '100%';
      pre.replaceWith(container);
      
      const text = code.textContent;
      draw(text, container);
    }

    function draw(text, el) {
      try {
        const data = parseSankey(text);
        const width = el.clientWidth || 800;
        const height = Math.max(400, data.nodes.length * 25 + 150);
        
        el.innerHTML = ''; // Clear existing content
        
        const svg = d3.select(el).append('svg')
          .attr('width', width)
          .attr('height', height)
          .style('background', '#f8f9fa');

        // Add definitions for gradients and filters
        const defs = svg.append('defs');
        
        // Add drop shadow filter
        const filter = defs.append('filter')
          .attr('id', 'mdDropshadow')
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

        // More subtle color palette
        const defaultColors = [
          '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', 
          '#1abc9c', '#34495e', '#e67e22', '#8e44ad', '#27ae60',
          '#2980b9', '#c0392b', '#d35400', '#7f8c8d', '#16a085'
        ];

        // Assign colors to nodes if they don't have them
        data.nodes.forEach((node, i) => {
          if (!node.color) {
            node.color = defaultColors[i % defaultColors.length];
          }
        });

        const graph = sankey({
          nodes: data.nodes.map(d => ({ ...d })),
          links: data.links.map(d => ({ ...d }))
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
          .attr('rx', 2)
          .attr('ry', 2)
          .attr('fill', d => d.color || '#444')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .style('filter', 'url(#mdDropshadow)')
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
            .attr('id', `mdLinkGradient${i}`)
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
          .attr('stroke', (d, i) => `url(#mdLinkGradient${i})`)
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

      } catch (err) {
        el.innerHTML = `<p style="color: red; padding: 20px; font-family: monospace;">Error: ${err.message}</p>`;
      }
    }

    // Initial pass - look for both .language-sankey and .sankey
    document.querySelectorAll('code.language-sankey, code.sankey, code[class*="sankey"]').forEach(upgrade);
    
    // Also try a more generic approach for markdown preview - be more permissive
    document.querySelectorAll('code').forEach(code => {
      const className = code.className || '';
      const text = code.textContent || '';
      // Check if it's likely Sankey content but be more permissive
      if (className.includes('sankey') || (text.trim() && text.includes('-->') && !code.processed)) {
        code.processed = true; // Prevent double processing
        upgrade(code);
      }
    });
  }).catch(err => {
    // Silently fail - the code blocks will remain as plain text
  });
})();
