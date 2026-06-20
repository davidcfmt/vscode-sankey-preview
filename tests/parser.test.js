const assert = require('node:assert/strict');
const { parseSankey, toMermaidSankey } = require('../src/parser');

function test(name, run) {
  try {
    run();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

test('parses existing syntax, labels, colors, and metadata', () => {
  const parsed = parseSankey(`
title: Energy balance
unit: kWh
valueFormat: compact
linkColor: gradient
nodeAlign: center
"Solar, site" --> Battery --> Load: 123.5 "served demand"
class "Solar, site" color:#ffcc00
class Battery color:#3366ff
`);

  assert.equal(parsed.options.title, 'Energy balance');
  assert.equal(parsed.options.unit, 'kWh');
  assert.equal(parsed.options.valueFormat, 'compact');
  assert.equal(parsed.options.linkColor, 'gradient');
  assert.equal(parsed.options.nodeAlign, 'center');
  assert.deepEqual(parsed.links.map((link) => [link.source, link.target, link.value]), [
    ['Solar, site', 'Battery', 123.5],
    ['Battery', 'Load', 123.5]
  ]);
  assert.equal(parsed.links[1].label, 'served demand');
  assert.equal(parsed.nodes.find((node) => node.id === 'Solar, site').color, '#ffcc00');
  assert.equal(parsed.nodes.find((node) => node.id === 'Battery').color, '#3366ff');
});

test('parses unquoted class names with spaces', () => {
  const parsed = parseSankey(`
Research notes --> Release momentum: 8
class Research notes color:#51cf66
class Release momentum color:#ff8787
`);

  assert.equal(parsed.nodes.find((node) => node.id === 'Research notes').color, '#51cf66');
  assert.equal(parsed.nodes.find((node) => node.id === 'Release momentum').color, '#ff8787');
});

test('rejects invalid metadata values with line numbers', () => {
  assert.throws(
    () => parseSankey('linkColor: blue\nA --> B: 1'),
    (error) => error.line === 1 && /linkColor/.test(error.message)
  );
  assert.throws(
    () => parseSankey('nodeAlign: diagonal\nA --> B: 1'),
    (error) => error.line === 1 && /nodeAlign/.test(error.message)
  );
  assert.throws(
    () => parseSankey('valueFormat: money\nA --> B: 1'),
    (error) => error.line === 1 && /valueFormat/.test(error.message)
  );
});

test('keeps unknown options as warnings for forward compatibility', () => {
  const parsed = parseSankey('futureThing: yes\nA --> B: 1');
  assert.equal(parsed.options.futureThing, 'yes');
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0].message, /Unknown option/);
});

test('enforces resource limits', () => {
  assert.throws(() => parseSankey('A --> B: 1', { maxNodes: 1 }), /Too many nodes/);
  assert.throws(() => parseSankey('A --> B: 1\nB --> C: 1', { maxLinks: 1 }), /Too many links/);
  assert.throws(() => parseSankey('A --> B: 1', { maxInputSize: 5 }), /Input too large/);
});

test('converts custom syntax to Mermaid Sankey CSV with escaping', () => {
  const mermaid = toMermaidSankey('"A, Inc" --> "B \\"Team\\"": 7.25', undefined, { fenced: false });
  assert.equal(mermaid, [
    'sankey-beta',
    'source,target,value',
    '"A, Inc","B ""Team""",7.25'
  ].join('\n'));
});
