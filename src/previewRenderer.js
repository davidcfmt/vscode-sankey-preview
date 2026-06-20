/* global document, window, navigator, acquireVsCodeApi, Image, XMLSerializer, HTMLTextAreaElement */

const {
  DEFAULT_LIMITS,
  parseSankey,
  toMermaidSankey
} = require('./parser');
const {
  sankey,
  sankeyCenter,
  sankeyJustify,
  sankeyLeft,
  sankeyLinkHorizontal,
  sankeyRight
} = require('d3-sankey');

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_RENDER_HEIGHT = 4000;
const EXPORT_SIZE_LIMIT = 10 * 1024 * 1024;
const DENSE_NODE_LABEL_LIMIT = 16;
const DENSE_LINK_LABEL_LIMIT = 18;
const PALETTE = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC949', '#AF7AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
];

let renderCounter = 0;

function getVsCodeApi() {
  try {
    if (typeof acquireVsCodeApi === 'function') {
      return acquireVsCodeApi();
    }
  } catch (_error) {
    return null;
  }
  return null;
}

const vscode = getVsCodeApi();

function clear(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function appendHtml(parent, tagName, className) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  parent.appendChild(element);
  return element;
}

function appendSvg(parent, tagName, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  });
  parent.appendChild(element);
  return element;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getRenderLimits(container) {
  return {
    maxInputSize: positiveNumber(container?.dataset?.maxInputSize, DEFAULT_LIMITS.maxInputSize),
    maxNodes: positiveNumber(container?.dataset?.maxNodes, DEFAULT_LIMITS.maxNodes),
    maxLinks: positiveNumber(container?.dataset?.maxLinks, DEFAULT_LIMITS.maxLinks)
  };
}

function injectStyles() {
  if (document.getElementById('sankey-preview-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'sankey-preview-styles';
  style.textContent = `
    .sankey-render {
      border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.35));
      background: var(--vscode-editor-background, #fff);
      color: var(--vscode-editor-foreground, #1f2328);
      display: flex;
      flex-direction: column;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      min-height: 300px;
      overflow: hidden;
      width: 100%;
    }

    .sankey-preview-host .sankey-render {
      height: min(70vh, 620px);
      max-height: 80vh;
      resize: vertical;
    }

    #sankey-diagram .sankey-render {
      border: 0;
      height: 100%;
      min-height: 100%;
    }

    .sankey-header {
      align-items: center;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.24));
      display: flex;
      gap: 8px;
      justify-content: space-between;
      min-height: 36px;
      padding: 6px 10px;
    }

    .sankey-title {
      font-size: 14px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sankey-toolbar {
      align-items: center;
      display: flex;
      flex: 0 0 auto;
      gap: 4px;
    }

    .sankey-toolbar button {
      background: var(--vscode-button-secondaryBackground, transparent);
      border: 1px solid var(--vscode-button-border, rgba(127, 127, 127, 0.35));
      color: var(--vscode-button-secondaryForeground, currentColor);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      min-height: 26px;
      padding: 2px 8px;
    }

    .sankey-toolbar button:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(127, 127, 127, 0.14));
    }

    .sankey-status {
      color: var(--vscode-descriptionForeground, #6e7781);
      flex: 0 1 auto;
      font-size: 12px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sankey-warning,
    .sankey-error {
      border-top: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.24));
      font-size: 12px;
      line-height: 1.45;
      padding: 8px 10px;
    }

    .sankey-warning {
      background: var(--vscode-inputValidation-warningBackground, rgba(255, 194, 10, 0.12));
      color: var(--vscode-inputValidation-warningForeground, currentColor);
    }

    .sankey-error {
      background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.08));
      color: var(--vscode-inputValidation-errorForeground, currentColor);
    }

    .sankey-chart {
      flex: 1 1 auto;
      min-height: 240px;
      overflow: hidden;
      position: relative;
    }

    .sankey-chart svg {
      display: block;
      height: 100%;
      touch-action: none;
      user-select: none;
      width: 100%;
    }

    .sankey-link {
      fill: none;
      mix-blend-mode: normal;
      stroke-linecap: round;
    }

    .sankey-node-label,
    .sankey-link-label {
      fill: var(--vscode-editor-foreground, #1f2328);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      paint-order: stroke;
      pointer-events: none;
      stroke: var(--vscode-editor-background, #fff);
      stroke-linejoin: round;
      stroke-width: 4px;
    }

    .sankey-node-label {
      font-size: 12px;
      font-weight: 600;
    }

    .sankey-link-label {
      font-size: 11px;
    }
  `;
  document.head.appendChild(style);
}

function createButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = title;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function makeFormatter(options) {
  const format = options.valueFormat || 'raw';
  let numberFormatter;
  if (format === 'integer') {
    numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  } else if (format === 'decimal') {
    numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  } else if (format === 'compact') {
    numberFormatter = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      notation: 'compact'
    });
  }

  return (value) => {
    const formatted = numberFormatter ? numberFormatter.format(value) : String(value);
    return options.unit ? `${formatted} ${options.unit}` : formatted;
  };
}

function nodeAlignFactory(value) {
  if (value === 'left') {
    return sankeyLeft;
  }
  if (value === 'right') {
    return sankeyRight;
  }
  if (value === 'center') {
    return sankeyCenter;
  }
  return sankeyJustify;
}

function getNodeColor(node, index) {
  return node.color || PALETTE[index % PALETTE.length];
}

function getColorMaps(graph) {
  const colors = new Map();
  graph.nodes.forEach((node, index) => {
    colors.set(node.id, getNodeColor(node, index));
  });
  return colors;
}

function isDenseDiagram(parsed) {
  return parsed.nodes.length > DENSE_NODE_LABEL_LIMIT || parsed.links.length > DENSE_LINK_LABEL_LIMIT;
}

function getLinkOpacity(parsed) {
  const dense = isDenseDiagram(parsed);
  if (parsed.options.linkColor === 'gradient') {
    return dense ? 0.36 : 0.52;
  }
  return dense ? 0.32 : 0.45;
}

function getLinkColor(link, options, colors, defs, renderId, index) {
  const setting = options.linkColor || 'source';
  if (setting.startsWith('#')) {
    return setting;
  }
  if (setting === 'target') {
    return colors.get(link.target.id) || PALETTE[0];
  }
  if (setting === 'gradient') {
    const id = `sankey-gradient-${renderId}-${index}`;
    const gradient = appendSvg(defs, 'linearGradient', {
      id,
      gradientUnits: 'userSpaceOnUse',
      x1: link.source.x1,
      x2: link.target.x0,
      y1: (link.y0 + link.source.y0 + link.source.y1) / 3,
      y2: (link.y1 + link.target.y0 + link.target.y1) / 3
    });
    appendSvg(gradient, 'stop', {
      offset: '0%',
      'stop-color': colors.get(link.source.id) || PALETTE[0],
      'stop-opacity': '1'
    });
    appendSvg(gradient, 'stop', {
      offset: '100%',
      'stop-color': colors.get(link.target.id) || PALETTE[1],
      'stop-opacity': '1'
    });
    return `url(#${id})`;
  }
  return colors.get(link.source.id) || PALETTE[0];
}

function balanceWarnings(parsed, formatter) {
  const totals = new Map();
  parsed.nodes.forEach((node) => totals.set(node.id, { incoming: 0, outgoing: 0 }));
  parsed.links.forEach((link) => {
    totals.get(link.source).outgoing += link.value;
    totals.get(link.target).incoming += link.value;
  });

  return Array.from(totals.entries())
    .filter(([_id, total]) => {
      if (total.incoming === 0 || total.outgoing === 0) {
        return false;
      }
      const tolerance = Math.max(0.000001, Math.max(total.incoming, total.outgoing) * 0.000001);
      return Math.abs(total.incoming - total.outgoing) > tolerance;
    })
    .map(([id, total]) => `${id} (${formatter(total.incoming)} in, ${formatter(total.outgoing)} out)`);
}

function renderWarnings(parent, parsed, formatter) {
  const warnings = [];
  parsed.warnings.forEach((warning) => warnings.push(`line ${warning.line}: ${warning.message}`));
  const unbalanced = balanceWarnings(parsed, formatter);
  if (unbalanced.length > 0) {
    warnings.push(`Unbalanced intermediate nodes: ${unbalanced.slice(0, 4).join('; ')}${unbalanced.length > 4 ? '; ...' : ''}`);
  }

  if (warnings.length === 0) {
    return;
  }

  const warningPanel = appendHtml(parent, 'div', 'sankey-warning');
  warningPanel.textContent = warnings.join(' ');
}

function showStatus(statusElement, message) {
  statusElement.textContent = message;
  window.setTimeout(() => {
    if (statusElement.textContent === message) {
      statusElement.textContent = '';
    }
  }, 2500);
}

function serializeSvg(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('version', '1.1');
  const serialized = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
}

function downloadText(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function exportSvg(svg, standalone) {
  const data = serializeSvg(svg);
  if (data.length > EXPORT_SIZE_LIMIT) {
    throw new Error('Export data too large');
  }
  if (standalone && vscode) {
    vscode.postMessage({ type: 'export', format: 'svg', data });
    return;
  }
  downloadText('sankey.svg', 'image/svg+xml;charset=utf-8', data);
}

function exportPng(svg, standalone) {
  return new Promise((resolve, reject) => {
    const svgText = serializeSvg(svg);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const viewBox = svg.viewBox.baseVal;
    const width = Math.max(1, Math.ceil(viewBox.width || svg.clientWidth || 960));
    const height = Math.max(1, Math.ceil(viewBox.height || svg.clientHeight || 520));

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        if (dataUrl.length > EXPORT_SIZE_LIMIT) {
          reject(new Error('Export data too large'));
          return;
        }
        if (standalone && vscode) {
          vscode.postMessage({ type: 'export', format: 'png', data: dataUrl.split(',')[1] });
        } else {
          downloadDataUrl('sankey.png', dataUrl);
        }
        resolve();
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG export failed'));
    };
    image.src = url;
  });
}

async function copyMermaid(parsed, standalone, statusElement) {
  const mermaid = toMermaidSankey(parsed, undefined, { fenced: true });
  if (standalone && vscode) {
    vscode.postMessage({ type: 'copyMermaid', data: mermaid });
    showStatus(statusElement, 'Copied Mermaid');
    return;
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard is not available in this preview');
  }
  await navigator.clipboard.writeText(mermaid);
  showStatus(statusElement, 'Copied Mermaid');
}

function enablePanZoom(svg, viewport, statusElement) {
  const state = { scale: 1, x: 0, y: 0, dragging: false, pointerId: null, startX: 0, startY: 0 };

  function apply() {
    viewport.setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.scale})`);
  }

  function zoomBy(factor) {
    state.scale = Math.min(4, Math.max(0.35, state.scale * factor));
    apply();
  }

  function reset() {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    apply();
    showStatus(statusElement, 'View reset');
  }

  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.1 : 0.9);
  }, { passive: false });

  svg.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.startX = event.clientX - state.x;
    state.startY = event.clientY - state.y;
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener('pointermove', (event) => {
    if (!state.dragging || state.pointerId !== event.pointerId) {
      return;
    }
    state.x = event.clientX - state.startX;
    state.y = event.clientY - state.startY;
    apply();
  });

  svg.addEventListener('pointerup', (event) => {
    if (state.pointerId === event.pointerId) {
      state.dragging = false;
      state.pointerId = null;
      svg.releasePointerCapture(event.pointerId);
    }
  });

  apply();
  return { zoomBy, reset };
}

function renderChart(chartArea, parsed, standalone, statusElement) {
  const renderId = renderCounter++;
  const formatter = makeFormatter(parsed.options);
  const dense = isDenseDiagram(parsed);
  const linkOpacity = getLinkOpacity(parsed);
  const width = dense ? 1180 : 980;
  const calculatedHeight = 260 + (parsed.nodes.length * 22) + (parsed.links.length * 4);
  const height = Math.min(MAX_RENDER_HEIGHT, Math.max(420, calculatedHeight));
  const margin = dense
    ? { top: 32, right: 190, bottom: 32, left: 190 }
    : { top: 24, right: 160, bottom: 24, left: 160 };

  const graph = sankey()
    .nodeId((node) => node.id)
    .nodeAlign(nodeAlignFactory(parsed.options.nodeAlign))
    .nodeWidth(18)
    .nodePadding(16)
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])({
      nodes: parsed.nodes.map((node) => ({ ...node })),
      links: parsed.links.map((link) => ({ ...link }))
    });

  const svg = appendSvg(chartArea, 'svg', {
    role: 'img',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet'
  });
  const defs = appendSvg(svg, 'defs');
  const viewport = appendSvg(svg, 'g');
  const colors = getColorMaps(graph);

  graph.links.forEach((link, index) => {
    const stroke = getLinkColor(link, parsed.options, colors, defs, renderId, index);
    const path = appendSvg(viewport, 'path', {
      class: 'sankey-link',
      d: sankeyLinkHorizontal()(link),
      stroke,
      'stroke-opacity': linkOpacity,
      'stroke-width': Math.max(1, link.width)
    });
    const title = appendSvg(path, 'title');
    title.textContent = link.label
      ? `${link.source.id} to ${link.target.id}: ${formatter(link.value)} (${link.label})`
      : `${link.source.id} to ${link.target.id}: ${formatter(link.value)}`;

    if (link.label) {
      const label = appendSvg(viewport, 'text', {
        class: 'sankey-link-label',
        x: (link.source.x1 + link.target.x0) / 2,
        y: (link.y0 + link.y1) / 2,
        'text-anchor': 'middle'
      });
      label.textContent = link.label;
    }
  });

  graph.nodes.forEach((node, index) => {
    const group = appendSvg(viewport, 'g', {
      transform: `translate(${node.x0} ${node.y0})`
    });
    const color = getNodeColor(node, index);
    appendSvg(group, 'rect', {
      width: Math.max(1, node.x1 - node.x0),
      height: Math.max(1, node.y1 - node.y0),
      fill: color,
      rx: 2
    });
    const title = appendSvg(group, 'title');
    title.textContent = `${node.id}: ${formatter(node.value)}`;

    const labelX = node.x0 < width / 2 ? node.x1 - node.x0 + 8 : -8;
    const label = appendSvg(group, 'text', {
      class: 'sankey-node-label',
      x: labelX,
      y: Math.max(12, (node.y1 - node.y0) / 2),
      dy: '0.35em',
      'text-anchor': node.x0 < width / 2 ? 'start' : 'end'
    });
    label.textContent = dense ? node.id : `${node.id} ${formatter(node.value)}`;
  });

  const controls = enablePanZoom(svg, viewport, statusElement);
  return {
    svg,
    zoomIn: () => controls.zoomBy(1.2),
    zoomOut: () => controls.zoomBy(0.84),
    reset: controls.reset,
    exportSvg: () => exportSvg(svg, standalone),
    exportPng: () => exportPng(svg, standalone)
  };
}

function showError(container, error, limits) {
  clear(container);
  container.classList.remove('loading');
  const render = appendHtml(container, 'div', 'sankey-render');
  const panel = appendHtml(render, 'div', 'sankey-error');
  const title = appendHtml(panel, 'div');
  title.textContent = 'Sankey preview failed';
  const message = appendHtml(panel, 'div');
  message.textContent = error.message;
  const detail = appendHtml(panel, 'div');
  detail.textContent = `Limits: ${limits.maxInputSize} bytes, ${limits.maxNodes} nodes, ${limits.maxLinks} links.`;
}

function renderInto(container, text, limits, options = {}) {
  clear(container);
  container.classList.remove('loading');
  const standalone = options.standalone === true;

  let parsed;
  try {
    parsed = parseSankey(text, limits);
  } catch (error) {
    showError(container, error, limits);
    return;
  }

  try {
    const render = appendHtml(container, 'div', 'sankey-render');
    const header = appendHtml(render, 'div', 'sankey-header');
    const title = appendHtml(header, 'div', 'sankey-title');
    title.textContent = parsed.options.title || 'Sankey diagram';
    const toolbar = appendHtml(header, 'div', 'sankey-toolbar');
    const status = appendHtml(toolbar, 'span', 'sankey-status');
    const chartArea = appendHtml(render, 'div', 'sankey-chart');
    const chart = renderChart(chartArea, parsed, standalone, status);
    const formatter = makeFormatter(parsed.options);

    toolbar.appendChild(createButton('Mermaid', 'Copy as Mermaid Sankey', async () => {
      try {
        await copyMermaid(parsed, standalone, status);
      } catch (error) {
        showStatus(status, error.message);
      }
    }));
    toolbar.appendChild(createButton('SVG', 'Export SVG', () => {
      try {
        chart.exportSvg();
        showStatus(status, 'SVG export ready');
      } catch (error) {
        showStatus(status, error.message);
      }
    }));
    toolbar.appendChild(createButton('PNG', 'Export PNG', async () => {
      try {
        await chart.exportPng();
        showStatus(status, 'PNG export ready');
      } catch (error) {
        showStatus(status, error.message);
      }
    }));
    toolbar.appendChild(createButton('+', 'Zoom in', () => chart.zoomIn()));
    toolbar.appendChild(createButton('-', 'Zoom out', () => chart.zoomOut()));
    toolbar.appendChild(createButton('Reset', 'Reset pan and zoom', () => chart.reset()));
    renderWarnings(render, parsed, formatter);
  } catch (error) {
    showError(container, error, limits);
  }
}

function renderStandalone() {
  const source = document.getElementById('sankey-source');
  const container = document.getElementById('sankey-diagram');
  if (!source || !container) {
    return false;
  }

  const readText = () => {
    if (source instanceof HTMLTextAreaElement) {
      return source.value;
    }
    return source.textContent || '';
  };

  renderInto(container, readText(), getRenderLimits(container), { standalone: true });
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'update' && typeof event.data.text === 'string') {
      source.value = event.data.text;
      renderInto(container, readText(), getRenderLimits(container), { standalone: true });
    }
  });
  return true;
}

function renderMarkdownBlocks() {
  const blocks = Array.from(document.querySelectorAll('pre > code.language-sankey'));
  blocks.forEach((code) => {
    if (code.dataset.sankeyRendered === 'true') {
      return;
    }
    code.dataset.sankeyRendered = 'true';
    const pre = code.parentElement;
    const host = document.createElement('div');
    host.className = 'sankey-preview-host';
    pre.replaceWith(host);
    renderInto(host, code.textContent || '', DEFAULT_LIMITS, { standalone: false });
  });
}

function start() {
  injectStyles();
  if (!renderStandalone()) {
    renderMarkdownBlocks();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
