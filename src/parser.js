const DEFAULT_LIMITS = {
  maxInputSize: 100000,
  maxNodes: 1000,
  maxLinks: 5000
};

const MAX_NODE_NAME_LENGTH = 100;
const LINK_COLOR_VALUES = new Set(['source', 'target', 'gradient']);
const NODE_ALIGN_VALUES = new Set(['left', 'right', 'center', 'justify']);
const VALUE_FORMAT_VALUES = new Set(['raw', 'integer', 'decimal', 'compact']);
const METADATA_KEYS = new Set(['title', 'unit', 'valueFormat', 'linkColor', 'nodeAlign']);

function normalizeLimits(limits = {}) {
  return {
    maxInputSize: Number.isFinite(limits.maxInputSize) && limits.maxInputSize > 0
      ? limits.maxInputSize
      : DEFAULT_LIMITS.maxInputSize,
    maxNodes: Number.isFinite(limits.maxNodes) && limits.maxNodes > 0
      ? limits.maxNodes
      : DEFAULT_LIMITS.maxNodes,
    maxLinks: Number.isFinite(limits.maxLinks) && limits.maxLinks > 0
      ? limits.maxLinks
      : DEFAULT_LIMITS.maxLinks
  };
}

function parserError(message, lineNumber) {
  const error = new Error(lineNumber ? `line ${lineNumber}: ${message}` : message);
  if (lineNumber) {
    error.line = lineNumber;
  }
  return error;
}

function stripOptionalQuotes(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^"(.*)"$/);
  return match ? match[1].replace(/\\"/g, '"') : trimmed;
}

function validateNodeName(name, role, lineNumber) {
  if (!name || name.length > MAX_NODE_NAME_LENGTH) {
    throw parserError(
      `Invalid ${role} node name (must be 1-${MAX_NODE_NAME_LENGTH} characters)`,
      lineNumber
    );
  }
}

function parseNumber(value, lineNumber) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw parserError(`Invalid value: ${value} (must be a non-negative finite number)`, lineNumber);
  }
  return numericValue;
}

function validateHexColor(value, lineNumber, fieldName) {
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(value)) {
    throw parserError(`${fieldName} must be source, target, gradient, or a #RRGGBB color`, lineNumber);
  }
}

function parseOption(line, options, warnings, lineNumber) {
  const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
  if (!match) {
    return false;
  }

  const key = match[1];
  const value = match[2];
  if (key === 'linkColor') {
    if (!LINK_COLOR_VALUES.has(value)) {
      validateHexColor(value, lineNumber, 'linkColor');
    }
  } else if (key === 'nodeAlign') {
    if (!NODE_ALIGN_VALUES.has(value)) {
      throw parserError('nodeAlign must be left, right, center, or justify', lineNumber);
    }
  } else if (key === 'valueFormat') {
    if (!VALUE_FORMAT_VALUES.has(value)) {
      throw parserError('valueFormat must be raw, integer, decimal, or compact', lineNumber);
    }
  } else if (!METADATA_KEYS.has(key)) {
    warnings.push({
      line: lineNumber,
      message: `Unknown option "${key}" will be ignored by the preview renderer`
    });
  }

  options[key] = value;
  return true;
}

function parseClass(line, styles, lineNumber) {
  const match = line.match(/^class\s+(?:"((?:\\"|[^"])+)"|(.+?))\s+color\s*:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?)\s*$/i);
  if (!match) {
    throw parserError('Invalid class syntax. Use: class NodeName color:#RRGGBB', lineNumber);
  }

  const node = (match[1] ? match[1].replace(/\\"/g, '"') : match[2]).trim();
  validateNodeName(node, 'class', lineNumber);

  const color = match[3];
  validateHexColor(color, lineNumber, 'color');
  styles[node] = { color };
}

function createNodeIndex(nodes, maxNodes) {
  const index = new Map();
  return (name, lineNumber) => {
    if (!index.has(name)) {
      if (nodes.length >= maxNodes) {
        throw parserError(`Too many nodes (maximum ${maxNodes})`, lineNumber);
      }
      index.set(name, nodes.length);
      nodes.push({ id: name });
    }
    return name;
  };
}

function parseSankey(text, limits) {
  const { maxInputSize, maxNodes, maxLinks } = normalizeLimits(limits);

  if (!text || typeof text !== 'string') {
    throw new Error('No text provided or text is not a string');
  }

  if (text.length > maxInputSize) {
    throw new Error(`Input too large (maximum ${maxInputSize} bytes)`);
  }

  const nodes = [];
  const links = [];
  const styles = {};
  const options = {};
  const warnings = [];
  const getNode = createNodeIndex(nodes, maxNodes);

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('%%')) {
      return;
    }

    if (line.startsWith('class ')) {
      parseClass(line, styles, lineNumber);
      return;
    }

    if (!line.includes('-->') && line.includes(':') && parseOption(line, options, warnings, lineNumber)) {
      return;
    }

    const match = line.match(/^(.+?):\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:\s+"((?:\\"|[^"])+)")?\s*$/i);
    if (!match) {
      throw parserError(`Syntax error: ${line}`, lineNumber);
    }

    const [, pathString, value, label] = match;
    const pathNodes = pathString.split('-->').map(stripOptionalQuotes);
    if (pathNodes.length < 2) {
      throw parserError(`Path must have at least 2 nodes: ${line}`, lineNumber);
    }

    const numericValue = parseNumber(value, lineNumber);
    for (let i = 0; i < pathNodes.length - 1; i++) {
      if (links.length >= maxLinks) {
        throw parserError(`Too many links (maximum ${maxLinks})`, lineNumber);
      }

      const source = pathNodes[i];
      const target = pathNodes[i + 1];
      validateNodeName(source, 'source', lineNumber);
      validateNodeName(target, 'target', lineNumber);

      links.push({
        source: getNode(source, lineNumber),
        target: getNode(target, lineNumber),
        value: numericValue,
        label: i === pathNodes.length - 2 && label ? label.replace(/\\"/g, '"') : undefined,
        line: lineNumber
      });
    }
  });

  nodes.forEach((node) => Object.assign(node, styles[node.id] || {}));
  return { nodes, links, options, warnings };
}

function csvField(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function formatMermaidNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value));
}

function toMermaidSankey(input, limits, options = {}) {
  const parsed = typeof input === 'string' ? parseSankey(input, limits) : input;
  const lines = ['sankey-beta', 'source,target,value'];
  parsed.links.forEach((link) => {
    lines.push([
      csvField(link.source),
      csvField(link.target),
      formatMermaidNumber(link.value)
    ].join(','));
  });

  const body = lines.join('\n');
  if (options.fenced === false) {
    return body;
  }
  return `\`\`\`mermaid\n${body}\n\`\`\``;
}

module.exports = {
  DEFAULT_LIMITS,
  LINK_COLOR_VALUES,
  METADATA_KEYS,
  NODE_ALIGN_VALUES,
  VALUE_FORMAT_VALUES,
  normalizeLimits,
  parseSankey,
  toMermaidSankey
};
