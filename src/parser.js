// Very small, fast, zero-dependency parser
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
      const source = pathNodes[i].replace(/^"(.*)"$/, '$1'); // Remove quotes if present
      const target = pathNodes[i + 1].replace(/^"(.*)"$/, '$1'); // Remove quotes if present
      
      // Validate numeric value
      const numericValue = parseFloat(val);
      if (isNaN(numericValue) || numericValue < 0) {
        throw new Error(`Invalid value: ${val} (must be a non-negative number)`);
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

module.exports = { parseSankey };
