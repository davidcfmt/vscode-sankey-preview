(function () {
  console.log('Sankey D3 inline renderer loading...');
  
  // Minimal D3 selection and SVG functionality
  const d3 = {
    select: function(selector) {
      const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
      return {
        append: function(tagName) {
          const child = document.createElementNS('http://www.w3.org/2000/svg', tagName);
          element.appendChild(child);
          return d3.select(child);
        },
        attr: function(name, value) {
          if (arguments.length === 1) return element.getAttribute(name);
          element.setAttribute(name, typeof value === 'function' ? value(element.__data__) : value);
          return this;
        },
        style: function(name, value) {
          if (arguments.length === 1) return element.style[name];
          element.style[name] = typeof value === 'function' ? value(element.__data__) : value;
          return this;
        },
        selectAll: function(selector) {
          const elements = Array.from(element.querySelectorAll(selector));
          return {
            data: function(data) {
              elements.forEach((el, i) => el.__data__ = data[i]);
              return {
                join: function(tagName) {
                  // Simple join - create missing elements
                  while (elements.length < data.length) {
                    const newEl = document.createElementNS('http://www.w3.org/2000/svg', tagName);
                    element.appendChild(newEl);
                    elements.push(newEl);
                  }
                  elements.forEach((el, i) => el.__data__ = data[i]);
                  return {
                    attr: function(name, value) {
                      elements.forEach(el => {
                        const val = typeof value === 'function' ? value(el.__data__, elements.indexOf(el)) : value;
                        el.setAttribute(name, val);
                      });
                      return this;
                    },
                    style: function(name, value) {
                      elements.forEach(el => {
                        const val = typeof value === 'function' ? value(el.__data__, elements.indexOf(el)) : value;
                        el.style[name] = val;
                      });
                      return this;
                    },
                    text: function(value) {
                      elements.forEach(el => {
                        const val = typeof value === 'function' ? value(el.__data__, elements.indexOf(el)) : value;
                        el.textContent = val;
                      });
                      return this;
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    
    // Sankey layout algorithm (simplified from D3-Sankey)
    sankey: function() {
      let nodeWidth = 24;
      let nodePadding = 8;
      let extent = [[0, 0], [1, 1]];
      
      function sankey(graph) {
        const nodes = graph.nodes.map(d => ({ ...d }));
        const links = graph.links.map(d => ({ ...d }));
        
        // Convert string references to object references
        links.forEach(link => {
          if (typeof link.source === 'string') {
            link.source = nodes.find(n => n.id === link.source);
          }
          if (typeof link.target === 'string') {
            link.target = nodes.find(n => n.id === link.target);
          }
        });
        
        // Calculate node values
        nodes.forEach(node => {
          node.sourceLinks = links.filter(l => l.source === node);
          node.targetLinks = links.filter(l => l.target === node);
          node.value = Math.max(
            node.sourceLinks.reduce((sum, l) => sum + l.value, 0),
            node.targetLinks.reduce((sum, l) => sum + l.value, 0)
          );
        });
        
        // Position nodes using simplified algorithm
        const columns = [];
        const visited = new Set();
        
        // Find source nodes
        const sources = nodes.filter(n => n.targetLinks.length === 0);
        let currentLevel = sources;
        
        while (currentLevel.length > 0) {
          columns.push([...currentLevel]);
          currentLevel.forEach(node => visited.add(node));
          
          const nextLevel = [];
          currentLevel.forEach(node => {
            node.sourceLinks.forEach(link => {
              if (!visited.has(link.target) && !nextLevel.includes(link.target)) {
                // Check if all targets of this node are visited
                const allTargetsVisited = link.target.targetLinks.every(l => visited.has(l.source));
                if (allTargetsVisited) {
                  nextLevel.push(link.target);
                }
              }
            });
          });
          currentLevel = nextLevel;
        }
        
        // Add any remaining nodes
        nodes.forEach(node => {
          if (!visited.has(node)) {
            if (columns.length === 0) columns.push([]);
            columns[columns.length - 1].push(node);
          }
        });
        
        const x0 = extent[0][0], x1 = extent[1][0];
        const y0 = extent[0][1], y1 = extent[1][1];
        
        const dx = (x1 - x0 - nodeWidth) / Math.max(1, columns.length - 1);
        
        // Position nodes
        columns.forEach((column, i) => {
          const x = x0 + i * dx;
          let y = y0;
          const totalValue = column.reduce((sum, n) => sum + n.value, 0);
          const scale = (y1 - y0 - nodePadding * (column.length - 1)) / Math.max(1, totalValue);
          
          column.forEach(node => {
            node.x0 = x;
            node.x1 = x + nodeWidth;
            node.y0 = y;
            node.y1 = y + node.value * scale;
            y = node.y1 + nodePadding;
          });
        });
        
        // Position links
        links.forEach(link => {
          link.width = link.value * (y1 - y0) / Math.max(1, 
            Math.max(...nodes.map(n => n.value))
          );
          link.y0 = link.source.y0;
          link.y1 = link.target.y0;
        });
        
        return { nodes, links };
      }
      
      sankey.nodeWidth = function(x) {
        if (!arguments.length) return nodeWidth;
        nodeWidth = x;
        return sankey;
      };
      
      sankey.nodePadding = function(x) {
        if (!arguments.length) return nodePadding;
        nodePadding = x;
        return sankey;
      };
      
      sankey.extent = function(x) {
        if (!arguments.length) return extent;
        extent = x;
        return sankey;
      };
      
      return sankey;
    },
    
    // Sankey link path generator
    sankeyLinkHorizontal: function() {
      return function(d) {
        const x0 = d.source.x1;
        const x1 = d.target.x0;
        const y0 = d.y0 + d.width / 2;
        const y1 = d.y1 + d.width / 2;
        const xi = (x0 + x1) / 2;
        
        return `M${x0},${y0}C${xi},${y0} ${xi},${y1} ${x1},${y1}`;
      };
    }
  };
  
  // Parser (reuse from before)
  function parseSankey(text) {
    const nodes = new Map();
    const links = [];
    const styles = {};
    
    const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    
    lines.forEach(line => {
      if (line.includes('-->') && line.includes(':')) {
        const match = line.match(/^(.+?):\s*([\d.]+)/);
        if (match) {
          const [, pathString, val] = match;
          const pathNodes = pathString.split('-->').map(n => n.trim());
          const value = parseFloat(val);
          
          for (let i = 0; i < pathNodes.length - 1; i++) {
            const source = pathNodes[i];
            const target = pathNodes[i + 1];
            
            if (!nodes.has(source)) nodes.set(source, { id: source });
            if (!nodes.has(target)) nodes.set(target, { id: target });
            
            links.push({ source, target, value });
          }
        }
      } else if (line.startsWith('class ')) {
        const match = line.match(/class\s+(\w+)\s+color:(#[0-9a-f]{6})/i);
        if (match) {
          styles[match[1]] = match[2];
        }
      }
    });
    
    return { nodes: Array.from(nodes.values()), links, styles };
  }
  
  function drawSankey(text, container) {
    try {
      const data = parseSankey(text);
      if (data.nodes.length === 0) {
        container.innerHTML = '<p style="color: #666; padding: 20px;">No valid Sankey data found</p>';
        return;
      }
      
      const width = 800;
      const height = Math.max(400, data.nodes.length * 60);
      
      container.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 10px 0;">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">📊 Sankey Diagram</h3>
          <svg width="${width}" height="${height}" style="background: #f8f9fa; border-radius: 8px;"></svg>
        </div>
      `;
      
      const svg = d3.select(container.querySelector('svg'));
      
      // Create Sankey layout
      const sankey = d3.sankey()
        .nodeWidth(24)
        .nodePadding(20)
        .extent([[40, 40], [width - 40, height - 40]]);
      
      const graph = sankey(data);
      
      // Color scale
      const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'];
      graph.nodes.forEach((node, i) => {
        if (!node.color) {
          node.color = data.styles[node.id] || colors[i % colors.length];
        }
      });
      
      // Add gradients
      const defs = svg.append('defs');
      graph.links.forEach((link, i) => {
        const gradient = defs.append('linearGradient')
          .attr('id', `gradient${i}`)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', link.source.x1)
          .attr('x2', link.target.x0);
        
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', link.source.color || '#888')
          .attr('stop-opacity', 0.6);
        
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', link.target.color || '#888')
          .attr('stop-opacity', 0.6);
      });
      
      // Draw links
      svg.append('g')
        .selectAll('path')
        .data(graph.links)
        .join('path')
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('stroke', (d, i) => `url(#gradient${i})`)
        .attr('stroke-width', d => Math.max(1, d.width))
        .style('fill', 'none');
      
      // Draw nodes
      svg.append('g')
        .selectAll('rect')
        .data(graph.nodes)
        .join('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('height', d => d.y1 - d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('fill', d => d.color || '#888')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
      
      // Add labels
      svg.append('g')
        .selectAll('text')
        .data(graph.nodes)
        .join('text')
        .attr('x', d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8)
        .attr('y', d => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .style('font-family', 'system-ui, sans-serif')
        .style('font-size', '14px')
        .style('fill', '#2c3e50')
        .text(d => d.id);
        
    } catch (err) {
      container.innerHTML = `<p style="color: red; padding: 20px;">Error: ${err.message}</p>`;
    }
  }
  
  function upgrade(code) {
    const pre = code.parentElement;
    const container = document.createElement('div');
    container.className = 'sankey';
    container.style.maxWidth = '100%';
    pre.replaceWith(container);
    
    const text = code.textContent;
    drawSankey(text, container);
  }
  
  function processBlocks() {
    document.querySelectorAll('code.language-sankey, code[class*="language-sankey"]').forEach(upgrade);
    
    document.querySelectorAll('code').forEach(code => {
      const className = code.className || '';
      const text = code.textContent || '';
      
      if ((className.includes('sankey') || (text.trim() && text.includes('-->') && text.includes(':'))) && !code.processed) {
        code.processed = true;
        upgrade(code);
      }
    });
  }
  
  processBlocks();
  document.addEventListener('DOMContentLoaded', processBlocks);
  setTimeout(processBlocks, 100);
  setTimeout(processBlocks, 500);
})();
