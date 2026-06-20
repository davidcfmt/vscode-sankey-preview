(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/parser.js
  var require_parser = __commonJS({
    "src/parser.js"(exports, module) {
      var DEFAULT_LIMITS2 = {
        maxInputSize: 1e5,
        maxNodes: 1e3,
        maxLinks: 5e3
      };
      var MAX_NODE_NAME_LENGTH = 100;
      var LINK_COLOR_VALUES = /* @__PURE__ */ new Set(["source", "target", "gradient"]);
      var NODE_ALIGN_VALUES = /* @__PURE__ */ new Set(["left", "right", "center", "justify"]);
      var VALUE_FORMAT_VALUES = /* @__PURE__ */ new Set(["raw", "integer", "decimal", "compact"]);
      var METADATA_KEYS = /* @__PURE__ */ new Set(["title", "unit", "valueFormat", "linkColor", "nodeAlign"]);
      function normalizeLimits(limits = {}) {
        return {
          maxInputSize: Number.isFinite(limits.maxInputSize) && limits.maxInputSize > 0 ? limits.maxInputSize : DEFAULT_LIMITS2.maxInputSize,
          maxNodes: Number.isFinite(limits.maxNodes) && limits.maxNodes > 0 ? limits.maxNodes : DEFAULT_LIMITS2.maxNodes,
          maxLinks: Number.isFinite(limits.maxLinks) && limits.maxLinks > 0 ? limits.maxLinks : DEFAULT_LIMITS2.maxLinks
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
        if (key === "linkColor") {
          if (!LINK_COLOR_VALUES.has(value)) {
            validateHexColor(value, lineNumber, "linkColor");
          }
        } else if (key === "nodeAlign") {
          if (!NODE_ALIGN_VALUES.has(value)) {
            throw parserError("nodeAlign must be left, right, center, or justify", lineNumber);
          }
        } else if (key === "valueFormat") {
          if (!VALUE_FORMAT_VALUES.has(value)) {
            throw parserError("valueFormat must be raw, integer, decimal, or compact", lineNumber);
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
        const quotedMatch = line.match(/^class\s+"((?:\\"|[^"])+)"\s+(.+)$/);
        const unquotedMatch = line.match(/^class\s+(\S+)\s+(.+)$/);
        let node;
        let rest;
        if (quotedMatch) {
          [, node, rest] = quotedMatch;
          node = node.replace(/\\"/g, '"');
        } else if (unquotedMatch) {
          [, node, rest] = unquotedMatch;
        } else {
          throw parserError("Invalid class syntax. Use: class NodeName color:#RRGGBB", lineNumber);
        }
        validateNodeName(node, "class", lineNumber);
        const colorMatch = rest.match(/color\s*:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?)/i);
        if (!colorMatch) {
          throw parserError("Class styles currently support color:#RRGGBB only", lineNumber);
        }
        const color = colorMatch[1];
        validateHexColor(color, lineNumber, "color");
        styles[node] = { color };
      }
      function createNodeIndex(nodes, maxNodes) {
        const index = /* @__PURE__ */ new Map();
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
      function parseSankey2(text, limits) {
        const { maxInputSize, maxNodes, maxLinks } = normalizeLimits(limits);
        if (!text || typeof text !== "string") {
          throw new Error("No text provided or text is not a string");
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
          if (!line || line.startsWith("//") || line.startsWith("%%")) {
            return;
          }
          if (line.startsWith("class ")) {
            parseClass(line, styles, lineNumber);
            return;
          }
          if (!line.includes("-->") && line.includes(":") && parseOption(line, options, warnings, lineNumber)) {
            return;
          }
          const match = line.match(/^(.+?):\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:\s+"((?:\\"|[^"])+)")?\s*$/i);
          if (!match) {
            throw parserError(`Syntax error: ${line}`, lineNumber);
          }
          const [, pathString, value, label] = match;
          const pathNodes = pathString.split("-->").map(stripOptionalQuotes);
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
            validateNodeName(source, "source", lineNumber);
            validateNodeName(target, "target", lineNumber);
            links.push({
              source: getNode(source, lineNumber),
              target: getNode(target, lineNumber),
              value: numericValue,
              label: i === pathNodes.length - 2 && label ? label.replace(/\\"/g, '"') : void 0,
              line: lineNumber
            });
          }
        });
        nodes.forEach((node) => Object.assign(node, styles[node.id] || {}));
        return { nodes, links, options, warnings };
      }
      function csvField(value) {
        const text = String(value ?? "");
        return `"${text.replace(/"/g, '""')}"`;
      }
      function formatMermaidNumber(value) {
        return Number.isInteger(value) ? String(value) : String(Number(value));
      }
      function toMermaidSankey2(input, limits, options = {}) {
        const parsed = typeof input === "string" ? parseSankey2(input, limits) : input;
        const lines = ["sankey-beta", "source,target,value"];
        parsed.links.forEach((link) => {
          lines.push([
            csvField(link.source),
            csvField(link.target),
            formatMermaidNumber(link.value)
          ].join(","));
        });
        const body = lines.join("\n");
        if (options.fenced === false) {
          return body;
        }
        return `\`\`\`mermaid
${body}
\`\`\``;
      }
      module.exports = {
        DEFAULT_LIMITS: DEFAULT_LIMITS2,
        LINK_COLOR_VALUES,
        METADATA_KEYS,
        NODE_ALIGN_VALUES,
        VALUE_FORMAT_VALUES,
        normalizeLimits,
        parseSankey: parseSankey2,
        toMermaidSankey: toMermaidSankey2
      };
    }
  });

  // node_modules/d3-array/dist/d3-array.js
  var require_d3_array = __commonJS({
    "node_modules/d3-array/dist/d3-array.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.d3 = global.d3 || {}));
      })(exports, (function(exports2) {
        "use strict";
        function ascending(a, b) {
          return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
        }
        function bisector(f) {
          let delta = f;
          let compare = f;
          if (f.length === 1) {
            delta = (d, x) => f(d) - x;
            compare = ascendingComparator(f);
          }
          function left(a, x, lo, hi) {
            if (lo == null) lo = 0;
            if (hi == null) hi = a.length;
            while (lo < hi) {
              const mid = lo + hi >>> 1;
              if (compare(a[mid], x) < 0) lo = mid + 1;
              else hi = mid;
            }
            return lo;
          }
          function right(a, x, lo, hi) {
            if (lo == null) lo = 0;
            if (hi == null) hi = a.length;
            while (lo < hi) {
              const mid = lo + hi >>> 1;
              if (compare(a[mid], x) > 0) hi = mid;
              else lo = mid + 1;
            }
            return lo;
          }
          function center(a, x, lo, hi) {
            if (lo == null) lo = 0;
            if (hi == null) hi = a.length;
            const i = left(a, x, lo, hi - 1);
            return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
          }
          return { left, center, right };
        }
        function ascendingComparator(f) {
          return (d, x) => ascending(f(d), x);
        }
        function number(x) {
          return x === null ? NaN : +x;
        }
        function* numbers(values, valueof) {
          if (valueof === void 0) {
            for (let value of values) {
              if (value != null && (value = +value) >= value) {
                yield value;
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
                yield value;
              }
            }
          }
        }
        const ascendingBisect = bisector(ascending);
        const bisectRight = ascendingBisect.right;
        const bisectLeft = ascendingBisect.left;
        const bisectCenter = bisector(number).center;
        function count(values, valueof) {
          let count2 = 0;
          if (valueof === void 0) {
            for (let value of values) {
              if (value != null && (value = +value) >= value) {
                ++count2;
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
                ++count2;
              }
            }
          }
          return count2;
        }
        function length$1(array2) {
          return array2.length | 0;
        }
        function empty(length2) {
          return !(length2 > 0);
        }
        function arrayify(values) {
          return typeof values !== "object" || "length" in values ? values : Array.from(values);
        }
        function reducer(reduce2) {
          return (values) => reduce2(...values);
        }
        function cross(...values) {
          const reduce2 = typeof values[values.length - 1] === "function" && reducer(values.pop());
          values = values.map(arrayify);
          const lengths = values.map(length$1);
          const j = values.length - 1;
          const index2 = new Array(j + 1).fill(0);
          const product = [];
          if (j < 0 || lengths.some(empty)) return product;
          while (true) {
            product.push(index2.map((j2, i2) => values[i2][j2]));
            let i = j;
            while (++index2[i] === lengths[i]) {
              if (i === 0) return reduce2 ? product.map(reduce2) : product;
              index2[i--] = 0;
            }
          }
        }
        function cumsum(values, valueof) {
          var sum2 = 0, index2 = 0;
          return Float64Array.from(values, valueof === void 0 ? (v) => sum2 += +v || 0 : (v) => sum2 += +valueof(v, index2++, values) || 0);
        }
        function descending(a, b) {
          return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
        }
        function variance(values, valueof) {
          let count2 = 0;
          let delta;
          let mean2 = 0;
          let sum2 = 0;
          if (valueof === void 0) {
            for (let value of values) {
              if (value != null && (value = +value) >= value) {
                delta = value - mean2;
                mean2 += delta / ++count2;
                sum2 += delta * (value - mean2);
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
                delta = value - mean2;
                mean2 += delta / ++count2;
                sum2 += delta * (value - mean2);
              }
            }
          }
          if (count2 > 1) return sum2 / (count2 - 1);
        }
        function deviation(values, valueof) {
          const v = variance(values, valueof);
          return v ? Math.sqrt(v) : v;
        }
        function extent(values, valueof) {
          let min2;
          let max2;
          if (valueof === void 0) {
            for (const value of values) {
              if (value != null) {
                if (min2 === void 0) {
                  if (value >= value) min2 = max2 = value;
                } else {
                  if (min2 > value) min2 = value;
                  if (max2 < value) max2 = value;
                }
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null) {
                if (min2 === void 0) {
                  if (value >= value) min2 = max2 = value;
                } else {
                  if (min2 > value) min2 = value;
                  if (max2 < value) max2 = value;
                }
              }
            }
          }
          return [min2, max2];
        }
        class Adder {
          constructor() {
            this._partials = new Float64Array(32);
            this._n = 0;
          }
          add(x) {
            const p = this._partials;
            let i = 0;
            for (let j = 0; j < this._n && j < 32; j++) {
              const y = p[j], hi = x + y, lo = Math.abs(x) < Math.abs(y) ? x - (hi - y) : y - (hi - x);
              if (lo) p[i++] = lo;
              x = hi;
            }
            p[i] = x;
            this._n = i + 1;
            return this;
          }
          valueOf() {
            const p = this._partials;
            let n = this._n, x, y, lo, hi = 0;
            if (n > 0) {
              hi = p[--n];
              while (n > 0) {
                x = hi;
                y = p[--n];
                hi = x + y;
                lo = y - (hi - x);
                if (lo) break;
              }
              if (n > 0 && (lo < 0 && p[n - 1] < 0 || lo > 0 && p[n - 1] > 0)) {
                y = lo * 2;
                x = hi + y;
                if (y == x - hi) hi = x;
              }
            }
            return hi;
          }
        }
        function fsum(values, valueof) {
          const adder = new Adder();
          if (valueof === void 0) {
            for (let value of values) {
              if (value = +value) {
                adder.add(value);
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if (value = +valueof(value, ++index2, values)) {
                adder.add(value);
              }
            }
          }
          return +adder;
        }
        function fcumsum(values, valueof) {
          const adder = new Adder();
          let index2 = -1;
          return Float64Array.from(
            values,
            valueof === void 0 ? (v) => adder.add(+v || 0) : (v) => adder.add(+valueof(v, ++index2, values) || 0)
          );
        }
        class InternMap extends Map {
          constructor(entries, key = keyof) {
            super();
            Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
            if (entries != null) for (const [key2, value] of entries) this.set(key2, value);
          }
          get(key) {
            return super.get(intern_get(this, key));
          }
          has(key) {
            return super.has(intern_get(this, key));
          }
          set(key, value) {
            return super.set(intern_set(this, key), value);
          }
          delete(key) {
            return super.delete(intern_delete(this, key));
          }
        }
        class InternSet extends Set {
          constructor(values, key = keyof) {
            super();
            Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
            if (values != null) for (const value of values) this.add(value);
          }
          has(value) {
            return super.has(intern_get(this, value));
          }
          add(value) {
            return super.add(intern_set(this, value));
          }
          delete(value) {
            return super.delete(intern_delete(this, value));
          }
        }
        function intern_get({ _intern, _key }, value) {
          const key = _key(value);
          return _intern.has(key) ? _intern.get(key) : value;
        }
        function intern_set({ _intern, _key }, value) {
          const key = _key(value);
          if (_intern.has(key)) return _intern.get(key);
          _intern.set(key, value);
          return value;
        }
        function intern_delete({ _intern, _key }, value) {
          const key = _key(value);
          if (_intern.has(key)) {
            value = _intern.get(value);
            _intern.delete(key);
          }
          return value;
        }
        function keyof(value) {
          return value !== null && typeof value === "object" ? value.valueOf() : value;
        }
        function identity(x) {
          return x;
        }
        function group(values, ...keys) {
          return nest(values, identity, identity, keys);
        }
        function groups(values, ...keys) {
          return nest(values, Array.from, identity, keys);
        }
        function rollup(values, reduce2, ...keys) {
          return nest(values, identity, reduce2, keys);
        }
        function rollups(values, reduce2, ...keys) {
          return nest(values, Array.from, reduce2, keys);
        }
        function index(values, ...keys) {
          return nest(values, identity, unique, keys);
        }
        function indexes(values, ...keys) {
          return nest(values, Array.from, unique, keys);
        }
        function unique(values) {
          if (values.length !== 1) throw new Error("duplicate key");
          return values[0];
        }
        function nest(values, map2, reduce2, keys) {
          return (function regroup(values2, i) {
            if (i >= keys.length) return reduce2(values2);
            const groups2 = new InternMap();
            const keyof2 = keys[i++];
            let index2 = -1;
            for (const value of values2) {
              const key = keyof2(value, ++index2, values2);
              const group2 = groups2.get(key);
              if (group2) group2.push(value);
              else groups2.set(key, [value]);
            }
            for (const [key, values3] of groups2) {
              groups2.set(key, regroup(values3, i));
            }
            return map2(groups2);
          })(values, 0);
        }
        function permute(source, keys) {
          return Array.from(keys, (key) => source[key]);
        }
        function sort(values, ...F) {
          if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
          values = Array.from(values);
          let [f = ascending] = F;
          if (f.length === 1 || F.length > 1) {
            const index2 = Uint32Array.from(values, (d, i) => i);
            if (F.length > 1) {
              F = F.map((f2) => values.map(f2));
              index2.sort((i, j) => {
                for (const f2 of F) {
                  const c = ascending(f2[i], f2[j]);
                  if (c) return c;
                }
              });
            } else {
              f = values.map(f);
              index2.sort((i, j) => ascending(f[i], f[j]));
            }
            return permute(values, index2);
          }
          return values.sort(f);
        }
        function groupSort(values, reduce2, key) {
          return (reduce2.length === 1 ? sort(rollup(values, reduce2, key), (([ak, av], [bk, bv]) => ascending(av, bv) || ascending(ak, bk))) : sort(group(values, key), (([ak, av], [bk, bv]) => reduce2(av, bv) || ascending(ak, bk)))).map(([key2]) => key2);
        }
        var array = Array.prototype;
        var slice = array.slice;
        function constant(x) {
          return function() {
            return x;
          };
        }
        var e10 = Math.sqrt(50), e5 = Math.sqrt(10), e2 = Math.sqrt(2);
        function ticks(start2, stop, count2) {
          var reverse2, i = -1, n, ticks2, step;
          stop = +stop, start2 = +start2, count2 = +count2;
          if (start2 === stop && count2 > 0) return [start2];
          if (reverse2 = stop < start2) n = start2, start2 = stop, stop = n;
          if ((step = tickIncrement(start2, stop, count2)) === 0 || !isFinite(step)) return [];
          if (step > 0) {
            let r0 = Math.round(start2 / step), r1 = Math.round(stop / step);
            if (r0 * step < start2) ++r0;
            if (r1 * step > stop) --r1;
            ticks2 = new Array(n = r1 - r0 + 1);
            while (++i < n) ticks2[i] = (r0 + i) * step;
          } else {
            step = -step;
            let r0 = Math.round(start2 * step), r1 = Math.round(stop * step);
            if (r0 / step < start2) ++r0;
            if (r1 / step > stop) --r1;
            ticks2 = new Array(n = r1 - r0 + 1);
            while (++i < n) ticks2[i] = (r0 + i) / step;
          }
          if (reverse2) ticks2.reverse();
          return ticks2;
        }
        function tickIncrement(start2, stop, count2) {
          var step = (stop - start2) / Math.max(0, count2), power = Math.floor(Math.log(step) / Math.LN10), error = step / Math.pow(10, power);
          return power >= 0 ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power) : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
        }
        function tickStep(start2, stop, count2) {
          var step0 = Math.abs(stop - start2) / Math.max(0, count2), step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)), error = step0 / step1;
          if (error >= e10) step1 *= 10;
          else if (error >= e5) step1 *= 5;
          else if (error >= e2) step1 *= 2;
          return stop < start2 ? -step1 : step1;
        }
        function nice(start2, stop, count2) {
          let prestep;
          while (true) {
            const step = tickIncrement(start2, stop, count2);
            if (step === prestep || step === 0 || !isFinite(step)) {
              return [start2, stop];
            } else if (step > 0) {
              start2 = Math.floor(start2 / step) * step;
              stop = Math.ceil(stop / step) * step;
            } else if (step < 0) {
              start2 = Math.ceil(start2 * step) / step;
              stop = Math.floor(stop * step) / step;
            }
            prestep = step;
          }
        }
        function sturges(values) {
          return Math.ceil(Math.log(count(values)) / Math.LN2) + 1;
        }
        function bin() {
          var value = identity, domain = extent, threshold = sturges;
          function histogram(data) {
            if (!Array.isArray(data)) data = Array.from(data);
            var i, n = data.length, x, values = new Array(n);
            for (i = 0; i < n; ++i) {
              values[i] = value(data[i], i, data);
            }
            var xz = domain(values), x0 = xz[0], x1 = xz[1], tz = threshold(values, x0, x1);
            if (!Array.isArray(tz)) {
              const max2 = x1, tn = +tz;
              if (domain === extent) [x0, x1] = nice(x0, x1, tn);
              tz = ticks(x0, x1, tn);
              if (tz[tz.length - 1] >= x1) {
                if (max2 >= x1 && domain === extent) {
                  const step = tickIncrement(x0, x1, tn);
                  if (isFinite(step)) {
                    if (step > 0) {
                      x1 = (Math.floor(x1 / step) + 1) * step;
                    } else if (step < 0) {
                      x1 = (Math.ceil(x1 * -step) + 1) / -step;
                    }
                  }
                } else {
                  tz.pop();
                }
              }
            }
            var m = tz.length;
            while (tz[0] <= x0) tz.shift(), --m;
            while (tz[m - 1] > x1) tz.pop(), --m;
            var bins = new Array(m + 1), bin2;
            for (i = 0; i <= m; ++i) {
              bin2 = bins[i] = [];
              bin2.x0 = i > 0 ? tz[i - 1] : x0;
              bin2.x1 = i < m ? tz[i] : x1;
            }
            for (i = 0; i < n; ++i) {
              x = values[i];
              if (x0 <= x && x <= x1) {
                bins[bisectRight(tz, x, 0, m)].push(data[i]);
              }
            }
            return bins;
          }
          histogram.value = function(_) {
            return arguments.length ? (value = typeof _ === "function" ? _ : constant(_), histogram) : value;
          };
          histogram.domain = function(_) {
            return arguments.length ? (domain = typeof _ === "function" ? _ : constant([_[0], _[1]]), histogram) : domain;
          };
          histogram.thresholds = function(_) {
            return arguments.length ? (threshold = typeof _ === "function" ? _ : Array.isArray(_) ? constant(slice.call(_)) : constant(_), histogram) : threshold;
          };
          return histogram;
        }
        function max(values, valueof) {
          let max2;
          if (valueof === void 0) {
            for (const value of values) {
              if (value != null && (max2 < value || max2 === void 0 && value >= value)) {
                max2 = value;
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (max2 < value || max2 === void 0 && value >= value)) {
                max2 = value;
              }
            }
          }
          return max2;
        }
        function min(values, valueof) {
          let min2;
          if (valueof === void 0) {
            for (const value of values) {
              if (value != null && (min2 > value || min2 === void 0 && value >= value)) {
                min2 = value;
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (min2 > value || min2 === void 0 && value >= value)) {
                min2 = value;
              }
            }
          }
          return min2;
        }
        function quickselect(array2, k, left = 0, right = array2.length - 1, compare = ascending) {
          while (right > left) {
            if (right - left > 600) {
              const n = right - left + 1;
              const m = k - left + 1;
              const z = Math.log(n);
              const s = 0.5 * Math.exp(2 * z / 3);
              const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
              const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
              const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
              quickselect(array2, k, newLeft, newRight, compare);
            }
            const t = array2[k];
            let i = left;
            let j = right;
            swap(array2, left, k);
            if (compare(array2[right], t) > 0) swap(array2, left, right);
            while (i < j) {
              swap(array2, i, j), ++i, --j;
              while (compare(array2[i], t) < 0) ++i;
              while (compare(array2[j], t) > 0) --j;
            }
            if (compare(array2[left], t) === 0) swap(array2, left, j);
            else ++j, swap(array2, j, right);
            if (j <= k) left = j + 1;
            if (k <= j) right = j - 1;
          }
          return array2;
        }
        function swap(array2, i, j) {
          const t = array2[i];
          array2[i] = array2[j];
          array2[j] = t;
        }
        function quantile(values, p, valueof) {
          values = Float64Array.from(numbers(values, valueof));
          if (!(n = values.length)) return;
          if ((p = +p) <= 0 || n < 2) return min(values);
          if (p >= 1) return max(values);
          var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = max(quickselect(values, i0).subarray(0, i0 + 1)), value1 = min(values.subarray(i0 + 1));
          return value0 + (value1 - value0) * (i - i0);
        }
        function quantileSorted(values, p, valueof = number) {
          if (!(n = values.length)) return;
          if ((p = +p) <= 0 || n < 2) return +valueof(values[0], 0, values);
          if (p >= 1) return +valueof(values[n - 1], n - 1, values);
          var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = +valueof(values[i0], i0, values), value1 = +valueof(values[i0 + 1], i0 + 1, values);
          return value0 + (value1 - value0) * (i - i0);
        }
        function freedmanDiaconis(values, min2, max2) {
          return Math.ceil((max2 - min2) / (2 * (quantile(values, 0.75) - quantile(values, 0.25)) * Math.pow(count(values), -1 / 3)));
        }
        function scott(values, min2, max2) {
          return Math.ceil((max2 - min2) / (3.5 * deviation(values) * Math.pow(count(values), -1 / 3)));
        }
        function maxIndex(values, valueof) {
          let max2;
          let maxIndex2 = -1;
          let index2 = -1;
          if (valueof === void 0) {
            for (const value of values) {
              ++index2;
              if (value != null && (max2 < value || max2 === void 0 && value >= value)) {
                max2 = value, maxIndex2 = index2;
              }
            }
          } else {
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (max2 < value || max2 === void 0 && value >= value)) {
                max2 = value, maxIndex2 = index2;
              }
            }
          }
          return maxIndex2;
        }
        function mean(values, valueof) {
          let count2 = 0;
          let sum2 = 0;
          if (valueof === void 0) {
            for (let value of values) {
              if (value != null && (value = +value) >= value) {
                ++count2, sum2 += value;
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
                ++count2, sum2 += value;
              }
            }
          }
          if (count2) return sum2 / count2;
        }
        function median(values, valueof) {
          return quantile(values, 0.5, valueof);
        }
        function* flatten(arrays) {
          for (const array2 of arrays) {
            yield* array2;
          }
        }
        function merge(arrays) {
          return Array.from(flatten(arrays));
        }
        function minIndex(values, valueof) {
          let min2;
          let minIndex2 = -1;
          let index2 = -1;
          if (valueof === void 0) {
            for (const value of values) {
              ++index2;
              if (value != null && (min2 > value || min2 === void 0 && value >= value)) {
                min2 = value, minIndex2 = index2;
              }
            }
          } else {
            for (let value of values) {
              if ((value = valueof(value, ++index2, values)) != null && (min2 > value || min2 === void 0 && value >= value)) {
                min2 = value, minIndex2 = index2;
              }
            }
          }
          return minIndex2;
        }
        function pairs(values, pairof = pair) {
          const pairs2 = [];
          let previous;
          let first = false;
          for (const value of values) {
            if (first) pairs2.push(pairof(previous, value));
            previous = value;
            first = true;
          }
          return pairs2;
        }
        function pair(a, b) {
          return [a, b];
        }
        function range(start2, stop, step) {
          start2 = +start2, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start2, start2 = 0, 1) : n < 3 ? 1 : +step;
          var i = -1, n = Math.max(0, Math.ceil((stop - start2) / step)) | 0, range2 = new Array(n);
          while (++i < n) {
            range2[i] = start2 + i * step;
          }
          return range2;
        }
        function least(values, compare = ascending) {
          let min2;
          let defined = false;
          if (compare.length === 1) {
            let minValue;
            for (const element of values) {
              const value = compare(element);
              if (defined ? ascending(value, minValue) < 0 : ascending(value, value) === 0) {
                min2 = element;
                minValue = value;
                defined = true;
              }
            }
          } else {
            for (const value of values) {
              if (defined ? compare(value, min2) < 0 : compare(value, value) === 0) {
                min2 = value;
                defined = true;
              }
            }
          }
          return min2;
        }
        function leastIndex(values, compare = ascending) {
          if (compare.length === 1) return minIndex(values, compare);
          let minValue;
          let min2 = -1;
          let index2 = -1;
          for (const value of values) {
            ++index2;
            if (min2 < 0 ? compare(value, value) === 0 : compare(value, minValue) < 0) {
              minValue = value;
              min2 = index2;
            }
          }
          return min2;
        }
        function greatest(values, compare = ascending) {
          let max2;
          let defined = false;
          if (compare.length === 1) {
            let maxValue;
            for (const element of values) {
              const value = compare(element);
              if (defined ? ascending(value, maxValue) > 0 : ascending(value, value) === 0) {
                max2 = element;
                maxValue = value;
                defined = true;
              }
            }
          } else {
            for (const value of values) {
              if (defined ? compare(value, max2) > 0 : compare(value, value) === 0) {
                max2 = value;
                defined = true;
              }
            }
          }
          return max2;
        }
        function greatestIndex(values, compare = ascending) {
          if (compare.length === 1) return maxIndex(values, compare);
          let maxValue;
          let max2 = -1;
          let index2 = -1;
          for (const value of values) {
            ++index2;
            if (max2 < 0 ? compare(value, value) === 0 : compare(value, maxValue) > 0) {
              maxValue = value;
              max2 = index2;
            }
          }
          return max2;
        }
        function scan(values, compare) {
          const index2 = leastIndex(values, compare);
          return index2 < 0 ? void 0 : index2;
        }
        var shuffle = shuffler(Math.random);
        function shuffler(random) {
          return function shuffle2(array2, i0 = 0, i1 = array2.length) {
            let m = i1 - (i0 = +i0);
            while (m) {
              const i = random() * m-- | 0, t = array2[m + i0];
              array2[m + i0] = array2[i + i0];
              array2[i + i0] = t;
            }
            return array2;
          };
        }
        function sum(values, valueof) {
          let sum2 = 0;
          if (valueof === void 0) {
            for (let value of values) {
              if (value = +value) {
                sum2 += value;
              }
            }
          } else {
            let index2 = -1;
            for (let value of values) {
              if (value = +valueof(value, ++index2, values)) {
                sum2 += value;
              }
            }
          }
          return sum2;
        }
        function transpose(matrix) {
          if (!(n = matrix.length)) return [];
          for (var i = -1, m = min(matrix, length), transpose2 = new Array(m); ++i < m; ) {
            for (var j = -1, n, row = transpose2[i] = new Array(n); ++j < n; ) {
              row[j] = matrix[j][i];
            }
          }
          return transpose2;
        }
        function length(d) {
          return d.length;
        }
        function zip() {
          return transpose(arguments);
        }
        function every(values, test) {
          if (typeof test !== "function") throw new TypeError("test is not a function");
          let index2 = -1;
          for (const value of values) {
            if (!test(value, ++index2, values)) {
              return false;
            }
          }
          return true;
        }
        function some(values, test) {
          if (typeof test !== "function") throw new TypeError("test is not a function");
          let index2 = -1;
          for (const value of values) {
            if (test(value, ++index2, values)) {
              return true;
            }
          }
          return false;
        }
        function filter(values, test) {
          if (typeof test !== "function") throw new TypeError("test is not a function");
          const array2 = [];
          let index2 = -1;
          for (const value of values) {
            if (test(value, ++index2, values)) {
              array2.push(value);
            }
          }
          return array2;
        }
        function map(values, mapper) {
          if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
          if (typeof mapper !== "function") throw new TypeError("mapper is not a function");
          return Array.from(values, (value, index2) => mapper(value, index2, values));
        }
        function reduce(values, reducer2, value) {
          if (typeof reducer2 !== "function") throw new TypeError("reducer is not a function");
          const iterator = values[Symbol.iterator]();
          let done, next, index2 = -1;
          if (arguments.length < 3) {
            ({ done, value } = iterator.next());
            if (done) return;
            ++index2;
          }
          while ({ done, value: next } = iterator.next(), !done) {
            value = reducer2(value, next, ++index2, values);
          }
          return value;
        }
        function reverse(values) {
          if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
          return Array.from(values).reverse();
        }
        function difference(values, ...others) {
          values = new Set(values);
          for (const other of others) {
            for (const value of other) {
              values.delete(value);
            }
          }
          return values;
        }
        function disjoint(values, other) {
          const iterator = other[Symbol.iterator](), set2 = /* @__PURE__ */ new Set();
          for (const v of values) {
            if (set2.has(v)) return false;
            let value, done;
            while ({ value, done } = iterator.next()) {
              if (done) break;
              if (Object.is(v, value)) return false;
              set2.add(value);
            }
          }
          return true;
        }
        function set(values) {
          return values instanceof Set ? values : new Set(values);
        }
        function intersection(values, ...others) {
          values = new Set(values);
          others = others.map(set);
          out: for (const value of values) {
            for (const other of others) {
              if (!other.has(value)) {
                values.delete(value);
                continue out;
              }
            }
          }
          return values;
        }
        function superset(values, other) {
          const iterator = values[Symbol.iterator](), set2 = /* @__PURE__ */ new Set();
          for (const o of other) {
            if (set2.has(o)) continue;
            let value, done;
            while ({ value, done } = iterator.next()) {
              if (done) return false;
              set2.add(value);
              if (Object.is(o, value)) break;
            }
          }
          return true;
        }
        function subset(values, other) {
          return superset(other, values);
        }
        function union(...others) {
          const set2 = /* @__PURE__ */ new Set();
          for (const other of others) {
            for (const o of other) {
              set2.add(o);
            }
          }
          return set2;
        }
        exports2.Adder = Adder;
        exports2.InternMap = InternMap;
        exports2.InternSet = InternSet;
        exports2.ascending = ascending;
        exports2.bin = bin;
        exports2.bisect = bisectRight;
        exports2.bisectCenter = bisectCenter;
        exports2.bisectLeft = bisectLeft;
        exports2.bisectRight = bisectRight;
        exports2.bisector = bisector;
        exports2.count = count;
        exports2.cross = cross;
        exports2.cumsum = cumsum;
        exports2.descending = descending;
        exports2.deviation = deviation;
        exports2.difference = difference;
        exports2.disjoint = disjoint;
        exports2.every = every;
        exports2.extent = extent;
        exports2.fcumsum = fcumsum;
        exports2.filter = filter;
        exports2.fsum = fsum;
        exports2.greatest = greatest;
        exports2.greatestIndex = greatestIndex;
        exports2.group = group;
        exports2.groupSort = groupSort;
        exports2.groups = groups;
        exports2.histogram = bin;
        exports2.index = index;
        exports2.indexes = indexes;
        exports2.intersection = intersection;
        exports2.least = least;
        exports2.leastIndex = leastIndex;
        exports2.map = map;
        exports2.max = max;
        exports2.maxIndex = maxIndex;
        exports2.mean = mean;
        exports2.median = median;
        exports2.merge = merge;
        exports2.min = min;
        exports2.minIndex = minIndex;
        exports2.nice = nice;
        exports2.pairs = pairs;
        exports2.permute = permute;
        exports2.quantile = quantile;
        exports2.quantileSorted = quantileSorted;
        exports2.quickselect = quickselect;
        exports2.range = range;
        exports2.reduce = reduce;
        exports2.reverse = reverse;
        exports2.rollup = rollup;
        exports2.rollups = rollups;
        exports2.scan = scan;
        exports2.shuffle = shuffle;
        exports2.shuffler = shuffler;
        exports2.some = some;
        exports2.sort = sort;
        exports2.subset = subset;
        exports2.sum = sum;
        exports2.superset = superset;
        exports2.thresholdFreedmanDiaconis = freedmanDiaconis;
        exports2.thresholdScott = scott;
        exports2.thresholdSturges = sturges;
        exports2.tickIncrement = tickIncrement;
        exports2.tickStep = tickStep;
        exports2.ticks = ticks;
        exports2.transpose = transpose;
        exports2.union = union;
        exports2.variance = variance;
        exports2.zip = zip;
        Object.defineProperty(exports2, "__esModule", { value: true });
      }));
    }
  });

  // node_modules/d3-path/dist/d3-path.js
  var require_d3_path = __commonJS({
    "node_modules/d3-path/dist/d3-path.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = global || self, factory(global.d3 = global.d3 || {}));
      })(exports, function(exports2) {
        "use strict";
        var pi = Math.PI, tau = 2 * pi, epsilon = 1e-6, tauEpsilon = tau - epsilon;
        function Path() {
          this._x0 = this._y0 = // start of current subpath
          this._x1 = this._y1 = null;
          this._ = "";
        }
        function path() {
          return new Path();
        }
        Path.prototype = path.prototype = {
          constructor: Path,
          moveTo: function(x, y) {
            this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y);
          },
          closePath: function() {
            if (this._x1 !== null) {
              this._x1 = this._x0, this._y1 = this._y0;
              this._ += "Z";
            }
          },
          lineTo: function(x, y) {
            this._ += "L" + (this._x1 = +x) + "," + (this._y1 = +y);
          },
          quadraticCurveTo: function(x1, y1, x, y) {
            this._ += "Q" + +x1 + "," + +y1 + "," + (this._x1 = +x) + "," + (this._y1 = +y);
          },
          bezierCurveTo: function(x1, y1, x2, y2, x, y) {
            this._ += "C" + +x1 + "," + +y1 + "," + +x2 + "," + +y2 + "," + (this._x1 = +x) + "," + (this._y1 = +y);
          },
          arcTo: function(x1, y1, x2, y2, r) {
            x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
            var x0 = this._x1, y0 = this._y1, x21 = x2 - x1, y21 = y2 - y1, x01 = x0 - x1, y01 = y0 - y1, l01_2 = x01 * x01 + y01 * y01;
            if (r < 0) throw new Error("negative radius: " + r);
            if (this._x1 === null) {
              this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
            } else if (!(l01_2 > epsilon)) ;
            else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
              this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
            } else {
              var x20 = x2 - x0, y20 = y2 - y0, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l / l01, t21 = l / l21;
              if (Math.abs(t01 - 1) > epsilon) {
                this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
              }
              this._ += "A" + r + "," + r + ",0,0," + +(y01 * x20 > x01 * y20) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
            }
          },
          arc: function(x, y, r, a0, a1, ccw) {
            x = +x, y = +y, r = +r, ccw = !!ccw;
            var dx = r * Math.cos(a0), dy = r * Math.sin(a0), x0 = x + dx, y0 = y + dy, cw = 1 ^ ccw, da = ccw ? a0 - a1 : a1 - a0;
            if (r < 0) throw new Error("negative radius: " + r);
            if (this._x1 === null) {
              this._ += "M" + x0 + "," + y0;
            } else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
              this._ += "L" + x0 + "," + y0;
            }
            if (!r) return;
            if (da < 0) da = da % tau + tau;
            if (da > tauEpsilon) {
              this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x - dx) + "," + (y - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
            } else if (da > epsilon) {
              this._ += "A" + r + "," + r + ",0," + +(da >= pi) + "," + cw + "," + (this._x1 = x + r * Math.cos(a1)) + "," + (this._y1 = y + r * Math.sin(a1));
            }
          },
          rect: function(x, y, w, h) {
            this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y) + "h" + +w + "v" + +h + "h" + -w + "Z";
          },
          toString: function() {
            return this._;
          }
        };
        exports2.path = path;
        Object.defineProperty(exports2, "__esModule", { value: true });
      });
    }
  });

  // node_modules/d3-shape/dist/d3-shape.js
  var require_d3_shape = __commonJS({
    "node_modules/d3-shape/dist/d3-shape.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require_d3_path()) : typeof define === "function" && define.amd ? define(["exports", "d3-path"], factory) : (global = global || self, factory(global.d3 = global.d3 || {}, global.d3));
      })(exports, function(exports2, d3Path) {
        "use strict";
        function constant(x2) {
          return function constant2() {
            return x2;
          };
        }
        var abs = Math.abs;
        var atan2 = Math.atan2;
        var cos = Math.cos;
        var max = Math.max;
        var min = Math.min;
        var sin = Math.sin;
        var sqrt = Math.sqrt;
        var epsilon = 1e-12;
        var pi = Math.PI;
        var halfPi = pi / 2;
        var tau = 2 * pi;
        function acos(x2) {
          return x2 > 1 ? 0 : x2 < -1 ? pi : Math.acos(x2);
        }
        function asin(x2) {
          return x2 >= 1 ? halfPi : x2 <= -1 ? -halfPi : Math.asin(x2);
        }
        function arcInnerRadius(d) {
          return d.innerRadius;
        }
        function arcOuterRadius(d) {
          return d.outerRadius;
        }
        function arcStartAngle(d) {
          return d.startAngle;
        }
        function arcEndAngle(d) {
          return d.endAngle;
        }
        function arcPadAngle(d) {
          return d && d.padAngle;
        }
        function intersect(x0, y0, x1, y1, x2, y2, x3, y3) {
          var x10 = x1 - x0, y10 = y1 - y0, x32 = x3 - x2, y32 = y3 - y2, t = y32 * x10 - x32 * y10;
          if (t * t < epsilon) return;
          t = (x32 * (y0 - y2) - y32 * (x0 - x2)) / t;
          return [x0 + t * x10, y0 + t * y10];
        }
        function cornerTangents(x0, y0, x1, y1, r1, rc, cw) {
          var x01 = x0 - x1, y01 = y0 - y1, lo = (cw ? rc : -rc) / sqrt(x01 * x01 + y01 * y01), ox = lo * y01, oy = -lo * x01, x11 = x0 + ox, y11 = y0 + oy, x10 = x1 + ox, y10 = y1 + oy, x00 = (x11 + x10) / 2, y00 = (y11 + y10) / 2, dx = x10 - x11, dy = y10 - y11, d2 = dx * dx + dy * dy, r = r1 - rc, D = x11 * y10 - x10 * y11, d = (dy < 0 ? -1 : 1) * sqrt(max(0, r * r * d2 - D * D)), cx0 = (D * dy - dx * d) / d2, cy0 = (-D * dx - dy * d) / d2, cx1 = (D * dy + dx * d) / d2, cy1 = (-D * dx + dy * d) / d2, dx0 = cx0 - x00, dy0 = cy0 - y00, dx1 = cx1 - x00, dy1 = cy1 - y00;
          if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1) cx0 = cx1, cy0 = cy1;
          return {
            cx: cx0,
            cy: cy0,
            x01: -ox,
            y01: -oy,
            x11: cx0 * (r1 / r - 1),
            y11: cy0 * (r1 / r - 1)
          };
        }
        function arc() {
          var innerRadius = arcInnerRadius, outerRadius = arcOuterRadius, cornerRadius = constant(0), padRadius = null, startAngle = arcStartAngle, endAngle = arcEndAngle, padAngle = arcPadAngle, context = null;
          function arc2() {
            var buffer, r, r0 = +innerRadius.apply(this, arguments), r1 = +outerRadius.apply(this, arguments), a0 = startAngle.apply(this, arguments) - halfPi, a1 = endAngle.apply(this, arguments) - halfPi, da = abs(a1 - a0), cw = a1 > a0;
            if (!context) context = buffer = d3Path.path();
            if (r1 < r0) r = r1, r1 = r0, r0 = r;
            if (!(r1 > epsilon)) context.moveTo(0, 0);
            else if (da > tau - epsilon) {
              context.moveTo(r1 * cos(a0), r1 * sin(a0));
              context.arc(0, 0, r1, a0, a1, !cw);
              if (r0 > epsilon) {
                context.moveTo(r0 * cos(a1), r0 * sin(a1));
                context.arc(0, 0, r0, a1, a0, cw);
              }
            } else {
              var a01 = a0, a11 = a1, a00 = a0, a10 = a1, da0 = da, da1 = da, ap = padAngle.apply(this, arguments) / 2, rp = ap > epsilon && (padRadius ? +padRadius.apply(this, arguments) : sqrt(r0 * r0 + r1 * r1)), rc = min(abs(r1 - r0) / 2, +cornerRadius.apply(this, arguments)), rc0 = rc, rc1 = rc, t0, t1;
              if (rp > epsilon) {
                var p0 = asin(rp / r0 * sin(ap)), p1 = asin(rp / r1 * sin(ap));
                if ((da0 -= p0 * 2) > epsilon) p0 *= cw ? 1 : -1, a00 += p0, a10 -= p0;
                else da0 = 0, a00 = a10 = (a0 + a1) / 2;
                if ((da1 -= p1 * 2) > epsilon) p1 *= cw ? 1 : -1, a01 += p1, a11 -= p1;
                else da1 = 0, a01 = a11 = (a0 + a1) / 2;
              }
              var x01 = r1 * cos(a01), y01 = r1 * sin(a01), x10 = r0 * cos(a10), y10 = r0 * sin(a10);
              if (rc > epsilon) {
                var x11 = r1 * cos(a11), y11 = r1 * sin(a11), x00 = r0 * cos(a00), y00 = r0 * sin(a00), oc;
                if (da < pi && (oc = intersect(x01, y01, x00, y00, x11, y11, x10, y10))) {
                  var ax = x01 - oc[0], ay = y01 - oc[1], bx = x11 - oc[0], by = y11 - oc[1], kc = 1 / sin(acos((ax * bx + ay * by) / (sqrt(ax * ax + ay * ay) * sqrt(bx * bx + by * by))) / 2), lc = sqrt(oc[0] * oc[0] + oc[1] * oc[1]);
                  rc0 = min(rc, (r0 - lc) / (kc - 1));
                  rc1 = min(rc, (r1 - lc) / (kc + 1));
                }
              }
              if (!(da1 > epsilon)) context.moveTo(x01, y01);
              else if (rc1 > epsilon) {
                t0 = cornerTangents(x00, y00, x01, y01, r1, rc1, cw);
                t1 = cornerTangents(x11, y11, x10, y10, r1, rc1, cw);
                context.moveTo(t0.cx + t0.x01, t0.cy + t0.y01);
                if (rc1 < rc) context.arc(t0.cx, t0.cy, rc1, atan2(t0.y01, t0.x01), atan2(t1.y01, t1.x01), !cw);
                else {
                  context.arc(t0.cx, t0.cy, rc1, atan2(t0.y01, t0.x01), atan2(t0.y11, t0.x11), !cw);
                  context.arc(0, 0, r1, atan2(t0.cy + t0.y11, t0.cx + t0.x11), atan2(t1.cy + t1.y11, t1.cx + t1.x11), !cw);
                  context.arc(t1.cx, t1.cy, rc1, atan2(t1.y11, t1.x11), atan2(t1.y01, t1.x01), !cw);
                }
              } else context.moveTo(x01, y01), context.arc(0, 0, r1, a01, a11, !cw);
              if (!(r0 > epsilon) || !(da0 > epsilon)) context.lineTo(x10, y10);
              else if (rc0 > epsilon) {
                t0 = cornerTangents(x10, y10, x11, y11, r0, -rc0, cw);
                t1 = cornerTangents(x01, y01, x00, y00, r0, -rc0, cw);
                context.lineTo(t0.cx + t0.x01, t0.cy + t0.y01);
                if (rc0 < rc) context.arc(t0.cx, t0.cy, rc0, atan2(t0.y01, t0.x01), atan2(t1.y01, t1.x01), !cw);
                else {
                  context.arc(t0.cx, t0.cy, rc0, atan2(t0.y01, t0.x01), atan2(t0.y11, t0.x11), !cw);
                  context.arc(0, 0, r0, atan2(t0.cy + t0.y11, t0.cx + t0.x11), atan2(t1.cy + t1.y11, t1.cx + t1.x11), cw);
                  context.arc(t1.cx, t1.cy, rc0, atan2(t1.y11, t1.x11), atan2(t1.y01, t1.x01), !cw);
                }
              } else context.arc(0, 0, r0, a10, a00, cw);
            }
            context.closePath();
            if (buffer) return context = null, buffer + "" || null;
          }
          arc2.centroid = function() {
            var r = (+innerRadius.apply(this, arguments) + +outerRadius.apply(this, arguments)) / 2, a2 = (+startAngle.apply(this, arguments) + +endAngle.apply(this, arguments)) / 2 - pi / 2;
            return [cos(a2) * r, sin(a2) * r];
          };
          arc2.innerRadius = function(_) {
            return arguments.length ? (innerRadius = typeof _ === "function" ? _ : constant(+_), arc2) : innerRadius;
          };
          arc2.outerRadius = function(_) {
            return arguments.length ? (outerRadius = typeof _ === "function" ? _ : constant(+_), arc2) : outerRadius;
          };
          arc2.cornerRadius = function(_) {
            return arguments.length ? (cornerRadius = typeof _ === "function" ? _ : constant(+_), arc2) : cornerRadius;
          };
          arc2.padRadius = function(_) {
            return arguments.length ? (padRadius = _ == null ? null : typeof _ === "function" ? _ : constant(+_), arc2) : padRadius;
          };
          arc2.startAngle = function(_) {
            return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant(+_), arc2) : startAngle;
          };
          arc2.endAngle = function(_) {
            return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant(+_), arc2) : endAngle;
          };
          arc2.padAngle = function(_) {
            return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant(+_), arc2) : padAngle;
          };
          arc2.context = function(_) {
            return arguments.length ? (context = _ == null ? null : _, arc2) : context;
          };
          return arc2;
        }
        function Linear(context) {
          this._context = context;
        }
        Linear.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._point = 0;
          },
          lineEnd: function() {
            if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
                break;
              case 1:
                this._point = 2;
              // proceed
              default:
                this._context.lineTo(x2, y2);
                break;
            }
          }
        };
        function curveLinear(context) {
          return new Linear(context);
        }
        function x(p) {
          return p[0];
        }
        function y(p) {
          return p[1];
        }
        function line() {
          var x$1 = x, y$1 = y, defined = constant(true), context = null, curve = curveLinear, output = null;
          function line2(data) {
            var i, n = data.length, d, defined0 = false, buffer;
            if (context == null) output = curve(buffer = d3Path.path());
            for (i = 0; i <= n; ++i) {
              if (!(i < n && defined(d = data[i], i, data)) === defined0) {
                if (defined0 = !defined0) output.lineStart();
                else output.lineEnd();
              }
              if (defined0) output.point(+x$1(d, i, data), +y$1(d, i, data));
            }
            if (buffer) return output = null, buffer + "" || null;
          }
          line2.x = function(_) {
            return arguments.length ? (x$1 = typeof _ === "function" ? _ : constant(+_), line2) : x$1;
          };
          line2.y = function(_) {
            return arguments.length ? (y$1 = typeof _ === "function" ? _ : constant(+_), line2) : y$1;
          };
          line2.defined = function(_) {
            return arguments.length ? (defined = typeof _ === "function" ? _ : constant(!!_), line2) : defined;
          };
          line2.curve = function(_) {
            return arguments.length ? (curve = _, context != null && (output = curve(context)), line2) : curve;
          };
          line2.context = function(_) {
            return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line2) : context;
          };
          return line2;
        }
        function area() {
          var x0 = x, x1 = null, y0 = constant(0), y1 = y, defined = constant(true), context = null, curve = curveLinear, output = null;
          function area2(data) {
            var i, j, k2, n = data.length, d, defined0 = false, buffer, x0z = new Array(n), y0z = new Array(n);
            if (context == null) output = curve(buffer = d3Path.path());
            for (i = 0; i <= n; ++i) {
              if (!(i < n && defined(d = data[i], i, data)) === defined0) {
                if (defined0 = !defined0) {
                  j = i;
                  output.areaStart();
                  output.lineStart();
                } else {
                  output.lineEnd();
                  output.lineStart();
                  for (k2 = i - 1; k2 >= j; --k2) {
                    output.point(x0z[k2], y0z[k2]);
                  }
                  output.lineEnd();
                  output.areaEnd();
                }
              }
              if (defined0) {
                x0z[i] = +x0(d, i, data), y0z[i] = +y0(d, i, data);
                output.point(x1 ? +x1(d, i, data) : x0z[i], y1 ? +y1(d, i, data) : y0z[i]);
              }
            }
            if (buffer) return output = null, buffer + "" || null;
          }
          function arealine() {
            return line().defined(defined).curve(curve).context(context);
          }
          area2.x = function(_) {
            return arguments.length ? (x0 = typeof _ === "function" ? _ : constant(+_), x1 = null, area2) : x0;
          };
          area2.x0 = function(_) {
            return arguments.length ? (x0 = typeof _ === "function" ? _ : constant(+_), area2) : x0;
          };
          area2.x1 = function(_) {
            return arguments.length ? (x1 = _ == null ? null : typeof _ === "function" ? _ : constant(+_), area2) : x1;
          };
          area2.y = function(_) {
            return arguments.length ? (y0 = typeof _ === "function" ? _ : constant(+_), y1 = null, area2) : y0;
          };
          area2.y0 = function(_) {
            return arguments.length ? (y0 = typeof _ === "function" ? _ : constant(+_), area2) : y0;
          };
          area2.y1 = function(_) {
            return arguments.length ? (y1 = _ == null ? null : typeof _ === "function" ? _ : constant(+_), area2) : y1;
          };
          area2.lineX0 = area2.lineY0 = function() {
            return arealine().x(x0).y(y0);
          };
          area2.lineY1 = function() {
            return arealine().x(x0).y(y1);
          };
          area2.lineX1 = function() {
            return arealine().x(x1).y(y0);
          };
          area2.defined = function(_) {
            return arguments.length ? (defined = typeof _ === "function" ? _ : constant(!!_), area2) : defined;
          };
          area2.curve = function(_) {
            return arguments.length ? (curve = _, context != null && (output = curve(context)), area2) : curve;
          };
          area2.context = function(_) {
            return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), area2) : context;
          };
          return area2;
        }
        function descending(a2, b) {
          return b < a2 ? -1 : b > a2 ? 1 : b >= a2 ? 0 : NaN;
        }
        function identity(d) {
          return d;
        }
        function pie() {
          var value = identity, sortValues = descending, sort = null, startAngle = constant(0), endAngle = constant(tau), padAngle = constant(0);
          function pie2(data) {
            var i, n = data.length, j, k2, sum2 = 0, index = new Array(n), arcs = new Array(n), a0 = +startAngle.apply(this, arguments), da = Math.min(tau, Math.max(-tau, endAngle.apply(this, arguments) - a0)), a1, p = Math.min(Math.abs(da) / n, padAngle.apply(this, arguments)), pa = p * (da < 0 ? -1 : 1), v;
            for (i = 0; i < n; ++i) {
              if ((v = arcs[index[i] = i] = +value(data[i], i, data)) > 0) {
                sum2 += v;
              }
            }
            if (sortValues != null) index.sort(function(i2, j2) {
              return sortValues(arcs[i2], arcs[j2]);
            });
            else if (sort != null) index.sort(function(i2, j2) {
              return sort(data[i2], data[j2]);
            });
            for (i = 0, k2 = sum2 ? (da - n * pa) / sum2 : 0; i < n; ++i, a0 = a1) {
              j = index[i], v = arcs[j], a1 = a0 + (v > 0 ? v * k2 : 0) + pa, arcs[j] = {
                data: data[j],
                index: i,
                value: v,
                startAngle: a0,
                endAngle: a1,
                padAngle: p
              };
            }
            return arcs;
          }
          pie2.value = function(_) {
            return arguments.length ? (value = typeof _ === "function" ? _ : constant(+_), pie2) : value;
          };
          pie2.sortValues = function(_) {
            return arguments.length ? (sortValues = _, sort = null, pie2) : sortValues;
          };
          pie2.sort = function(_) {
            return arguments.length ? (sort = _, sortValues = null, pie2) : sort;
          };
          pie2.startAngle = function(_) {
            return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant(+_), pie2) : startAngle;
          };
          pie2.endAngle = function(_) {
            return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant(+_), pie2) : endAngle;
          };
          pie2.padAngle = function(_) {
            return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant(+_), pie2) : padAngle;
          };
          return pie2;
        }
        var curveRadialLinear = curveRadial(curveLinear);
        function Radial(curve) {
          this._curve = curve;
        }
        Radial.prototype = {
          areaStart: function() {
            this._curve.areaStart();
          },
          areaEnd: function() {
            this._curve.areaEnd();
          },
          lineStart: function() {
            this._curve.lineStart();
          },
          lineEnd: function() {
            this._curve.lineEnd();
          },
          point: function(a2, r) {
            this._curve.point(r * Math.sin(a2), r * -Math.cos(a2));
          }
        };
        function curveRadial(curve) {
          function radial(context) {
            return new Radial(curve(context));
          }
          radial._curve = curve;
          return radial;
        }
        function lineRadial(l) {
          var c2 = l.curve;
          l.angle = l.x, delete l.x;
          l.radius = l.y, delete l.y;
          l.curve = function(_) {
            return arguments.length ? c2(curveRadial(_)) : c2()._curve;
          };
          return l;
        }
        function lineRadial$1() {
          return lineRadial(line().curve(curveRadialLinear));
        }
        function areaRadial() {
          var a2 = area().curve(curveRadialLinear), c2 = a2.curve, x0 = a2.lineX0, x1 = a2.lineX1, y0 = a2.lineY0, y1 = a2.lineY1;
          a2.angle = a2.x, delete a2.x;
          a2.startAngle = a2.x0, delete a2.x0;
          a2.endAngle = a2.x1, delete a2.x1;
          a2.radius = a2.y, delete a2.y;
          a2.innerRadius = a2.y0, delete a2.y0;
          a2.outerRadius = a2.y1, delete a2.y1;
          a2.lineStartAngle = function() {
            return lineRadial(x0());
          }, delete a2.lineX0;
          a2.lineEndAngle = function() {
            return lineRadial(x1());
          }, delete a2.lineX1;
          a2.lineInnerRadius = function() {
            return lineRadial(y0());
          }, delete a2.lineY0;
          a2.lineOuterRadius = function() {
            return lineRadial(y1());
          }, delete a2.lineY1;
          a2.curve = function(_) {
            return arguments.length ? c2(curveRadial(_)) : c2()._curve;
          };
          return a2;
        }
        function pointRadial(x2, y2) {
          return [(y2 = +y2) * Math.cos(x2 -= Math.PI / 2), y2 * Math.sin(x2)];
        }
        var slice = Array.prototype.slice;
        function linkSource(d) {
          return d.source;
        }
        function linkTarget(d) {
          return d.target;
        }
        function link(curve) {
          var source = linkSource, target = linkTarget, x$1 = x, y$1 = y, context = null;
          function link2() {
            var buffer, argv = slice.call(arguments), s2 = source.apply(this, argv), t = target.apply(this, argv);
            if (!context) context = buffer = d3Path.path();
            curve(context, +x$1.apply(this, (argv[0] = s2, argv)), +y$1.apply(this, argv), +x$1.apply(this, (argv[0] = t, argv)), +y$1.apply(this, argv));
            if (buffer) return context = null, buffer + "" || null;
          }
          link2.source = function(_) {
            return arguments.length ? (source = _, link2) : source;
          };
          link2.target = function(_) {
            return arguments.length ? (target = _, link2) : target;
          };
          link2.x = function(_) {
            return arguments.length ? (x$1 = typeof _ === "function" ? _ : constant(+_), link2) : x$1;
          };
          link2.y = function(_) {
            return arguments.length ? (y$1 = typeof _ === "function" ? _ : constant(+_), link2) : y$1;
          };
          link2.context = function(_) {
            return arguments.length ? (context = _ == null ? null : _, link2) : context;
          };
          return link2;
        }
        function curveHorizontal(context, x0, y0, x1, y1) {
          context.moveTo(x0, y0);
          context.bezierCurveTo(x0 = (x0 + x1) / 2, y0, x0, y1, x1, y1);
        }
        function curveVertical(context, x0, y0, x1, y1) {
          context.moveTo(x0, y0);
          context.bezierCurveTo(x0, y0 = (y0 + y1) / 2, x1, y0, x1, y1);
        }
        function curveRadial$1(context, x0, y0, x1, y1) {
          var p0 = pointRadial(x0, y0), p1 = pointRadial(x0, y0 = (y0 + y1) / 2), p2 = pointRadial(x1, y0), p3 = pointRadial(x1, y1);
          context.moveTo(p0[0], p0[1]);
          context.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
        }
        function linkHorizontal() {
          return link(curveHorizontal);
        }
        function linkVertical() {
          return link(curveVertical);
        }
        function linkRadial() {
          var l = link(curveRadial$1);
          l.angle = l.x, delete l.x;
          l.radius = l.y, delete l.y;
          return l;
        }
        var circle = {
          draw: function(context, size) {
            var r = Math.sqrt(size / pi);
            context.moveTo(r, 0);
            context.arc(0, 0, r, 0, tau);
          }
        };
        var cross = {
          draw: function(context, size) {
            var r = Math.sqrt(size / 5) / 2;
            context.moveTo(-3 * r, -r);
            context.lineTo(-r, -r);
            context.lineTo(-r, -3 * r);
            context.lineTo(r, -3 * r);
            context.lineTo(r, -r);
            context.lineTo(3 * r, -r);
            context.lineTo(3 * r, r);
            context.lineTo(r, r);
            context.lineTo(r, 3 * r);
            context.lineTo(-r, 3 * r);
            context.lineTo(-r, r);
            context.lineTo(-3 * r, r);
            context.closePath();
          }
        };
        var tan30 = Math.sqrt(1 / 3), tan30_2 = tan30 * 2;
        var diamond = {
          draw: function(context, size) {
            var y2 = Math.sqrt(size / tan30_2), x2 = y2 * tan30;
            context.moveTo(0, -y2);
            context.lineTo(x2, 0);
            context.lineTo(0, y2);
            context.lineTo(-x2, 0);
            context.closePath();
          }
        };
        var ka = 0.8908130915292852, kr = Math.sin(pi / 10) / Math.sin(7 * pi / 10), kx = Math.sin(tau / 10) * kr, ky = -Math.cos(tau / 10) * kr;
        var star = {
          draw: function(context, size) {
            var r = Math.sqrt(size * ka), x2 = kx * r, y2 = ky * r;
            context.moveTo(0, -r);
            context.lineTo(x2, y2);
            for (var i = 1; i < 5; ++i) {
              var a2 = tau * i / 5, c2 = Math.cos(a2), s2 = Math.sin(a2);
              context.lineTo(s2 * r, -c2 * r);
              context.lineTo(c2 * x2 - s2 * y2, s2 * x2 + c2 * y2);
            }
            context.closePath();
          }
        };
        var square = {
          draw: function(context, size) {
            var w = Math.sqrt(size), x2 = -w / 2;
            context.rect(x2, x2, w, w);
          }
        };
        var sqrt3 = Math.sqrt(3);
        var triangle = {
          draw: function(context, size) {
            var y2 = -Math.sqrt(size / (sqrt3 * 3));
            context.moveTo(0, y2 * 2);
            context.lineTo(-sqrt3 * y2, -y2);
            context.lineTo(sqrt3 * y2, -y2);
            context.closePath();
          }
        };
        var c = -0.5, s = Math.sqrt(3) / 2, k = 1 / Math.sqrt(12), a = (k / 2 + 1) * 3;
        var wye = {
          draw: function(context, size) {
            var r = Math.sqrt(size / a), x0 = r / 2, y0 = r * k, x1 = x0, y1 = r * k + r, x2 = -x1, y2 = y1;
            context.moveTo(x0, y0);
            context.lineTo(x1, y1);
            context.lineTo(x2, y2);
            context.lineTo(c * x0 - s * y0, s * x0 + c * y0);
            context.lineTo(c * x1 - s * y1, s * x1 + c * y1);
            context.lineTo(c * x2 - s * y2, s * x2 + c * y2);
            context.lineTo(c * x0 + s * y0, c * y0 - s * x0);
            context.lineTo(c * x1 + s * y1, c * y1 - s * x1);
            context.lineTo(c * x2 + s * y2, c * y2 - s * x2);
            context.closePath();
          }
        };
        var symbols = [
          circle,
          cross,
          diamond,
          square,
          star,
          triangle,
          wye
        ];
        function symbol() {
          var type = constant(circle), size = constant(64), context = null;
          function symbol2() {
            var buffer;
            if (!context) context = buffer = d3Path.path();
            type.apply(this, arguments).draw(context, +size.apply(this, arguments));
            if (buffer) return context = null, buffer + "" || null;
          }
          symbol2.type = function(_) {
            return arguments.length ? (type = typeof _ === "function" ? _ : constant(_), symbol2) : type;
          };
          symbol2.size = function(_) {
            return arguments.length ? (size = typeof _ === "function" ? _ : constant(+_), symbol2) : size;
          };
          symbol2.context = function(_) {
            return arguments.length ? (context = _ == null ? null : _, symbol2) : context;
          };
          return symbol2;
        }
        function noop() {
        }
        function point(that, x2, y2) {
          that._context.bezierCurveTo(
            (2 * that._x0 + that._x1) / 3,
            (2 * that._y0 + that._y1) / 3,
            (that._x0 + 2 * that._x1) / 3,
            (that._y0 + 2 * that._y1) / 3,
            (that._x0 + 4 * that._x1 + x2) / 6,
            (that._y0 + 4 * that._y1 + y2) / 6
          );
        }
        function Basis(context) {
          this._context = context;
        }
        Basis.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._y0 = this._y1 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 3:
                point(this, this._x1, this._y1);
              // proceed
              case 2:
                this._context.lineTo(this._x1, this._y1);
                break;
            }
            if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
                break;
              case 1:
                this._point = 2;
                break;
              case 2:
                this._point = 3;
                this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
              // proceed
              default:
                point(this, x2, y2);
                break;
            }
            this._x0 = this._x1, this._x1 = x2;
            this._y0 = this._y1, this._y1 = y2;
          }
        };
        function basis(context) {
          return new Basis(context);
        }
        function BasisClosed(context) {
          this._context = context;
        }
        BasisClosed.prototype = {
          areaStart: noop,
          areaEnd: noop,
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 1: {
                this._context.moveTo(this._x2, this._y2);
                this._context.closePath();
                break;
              }
              case 2: {
                this._context.moveTo((this._x2 + 2 * this._x3) / 3, (this._y2 + 2 * this._y3) / 3);
                this._context.lineTo((this._x3 + 2 * this._x2) / 3, (this._y3 + 2 * this._y2) / 3);
                this._context.closePath();
                break;
              }
              case 3: {
                this.point(this._x2, this._y2);
                this.point(this._x3, this._y3);
                this.point(this._x4, this._y4);
                break;
              }
            }
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._x2 = x2, this._y2 = y2;
                break;
              case 1:
                this._point = 2;
                this._x3 = x2, this._y3 = y2;
                break;
              case 2:
                this._point = 3;
                this._x4 = x2, this._y4 = y2;
                this._context.moveTo((this._x0 + 4 * this._x1 + x2) / 6, (this._y0 + 4 * this._y1 + y2) / 6);
                break;
              default:
                point(this, x2, y2);
                break;
            }
            this._x0 = this._x1, this._x1 = x2;
            this._y0 = this._y1, this._y1 = y2;
          }
        };
        function basisClosed(context) {
          return new BasisClosed(context);
        }
        function BasisOpen(context) {
          this._context = context;
        }
        BasisOpen.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._y0 = this._y1 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            if (this._line || this._line !== 0 && this._point === 3) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                break;
              case 1:
                this._point = 2;
                break;
              case 2:
                this._point = 3;
                var x0 = (this._x0 + 4 * this._x1 + x2) / 6, y0 = (this._y0 + 4 * this._y1 + y2) / 6;
                this._line ? this._context.lineTo(x0, y0) : this._context.moveTo(x0, y0);
                break;
              case 3:
                this._point = 4;
              // proceed
              default:
                point(this, x2, y2);
                break;
            }
            this._x0 = this._x1, this._x1 = x2;
            this._y0 = this._y1, this._y1 = y2;
          }
        };
        function basisOpen(context) {
          return new BasisOpen(context);
        }
        function Bundle(context, beta) {
          this._basis = new Basis(context);
          this._beta = beta;
        }
        Bundle.prototype = {
          lineStart: function() {
            this._x = [];
            this._y = [];
            this._basis.lineStart();
          },
          lineEnd: function() {
            var x2 = this._x, y2 = this._y, j = x2.length - 1;
            if (j > 0) {
              var x0 = x2[0], y0 = y2[0], dx = x2[j] - x0, dy = y2[j] - y0, i = -1, t;
              while (++i <= j) {
                t = i / j;
                this._basis.point(
                  this._beta * x2[i] + (1 - this._beta) * (x0 + t * dx),
                  this._beta * y2[i] + (1 - this._beta) * (y0 + t * dy)
                );
              }
            }
            this._x = this._y = null;
            this._basis.lineEnd();
          },
          point: function(x2, y2) {
            this._x.push(+x2);
            this._y.push(+y2);
          }
        };
        var bundle = (function custom(beta) {
          function bundle2(context) {
            return beta === 1 ? new Basis(context) : new Bundle(context, beta);
          }
          bundle2.beta = function(beta2) {
            return custom(+beta2);
          };
          return bundle2;
        })(0.85);
        function point$1(that, x2, y2) {
          that._context.bezierCurveTo(
            that._x1 + that._k * (that._x2 - that._x0),
            that._y1 + that._k * (that._y2 - that._y0),
            that._x2 + that._k * (that._x1 - x2),
            that._y2 + that._k * (that._y1 - y2),
            that._x2,
            that._y2
          );
        }
        function Cardinal(context, tension) {
          this._context = context;
          this._k = (1 - tension) / 6;
        }
        Cardinal.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 2:
                this._context.lineTo(this._x2, this._y2);
                break;
              case 3:
                point$1(this, this._x1, this._y1);
                break;
            }
            if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
                break;
              case 1:
                this._point = 2;
                this._x1 = x2, this._y1 = y2;
                break;
              case 2:
                this._point = 3;
              // proceed
              default:
                point$1(this, x2, y2);
                break;
            }
            this._x0 = this._x1, this._x1 = this._x2, this._x2 = x2;
            this._y0 = this._y1, this._y1 = this._y2, this._y2 = y2;
          }
        };
        var cardinal = (function custom(tension) {
          function cardinal2(context) {
            return new Cardinal(context, tension);
          }
          cardinal2.tension = function(tension2) {
            return custom(+tension2);
          };
          return cardinal2;
        })(0);
        function CardinalClosed(context, tension) {
          this._context = context;
          this._k = (1 - tension) / 6;
        }
        CardinalClosed.prototype = {
          areaStart: noop,
          areaEnd: noop,
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 1: {
                this._context.moveTo(this._x3, this._y3);
                this._context.closePath();
                break;
              }
              case 2: {
                this._context.lineTo(this._x3, this._y3);
                this._context.closePath();
                break;
              }
              case 3: {
                this.point(this._x3, this._y3);
                this.point(this._x4, this._y4);
                this.point(this._x5, this._y5);
                break;
              }
            }
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._x3 = x2, this._y3 = y2;
                break;
              case 1:
                this._point = 2;
                this._context.moveTo(this._x4 = x2, this._y4 = y2);
                break;
              case 2:
                this._point = 3;
                this._x5 = x2, this._y5 = y2;
                break;
              default:
                point$1(this, x2, y2);
                break;
            }
            this._x0 = this._x1, this._x1 = this._x2, this._x2 = x2;
            this._y0 = this._y1, this._y1 = this._y2, this._y2 = y2;
          }
        };
        var cardinalClosed = (function custom(tension) {
          function cardinal2(context) {
            return new CardinalClosed(context, tension);
          }
          cardinal2.tension = function(tension2) {
            return custom(+tension2);
          };
          return cardinal2;
        })(0);
        function CardinalOpen(context, tension) {
          this._context = context;
          this._k = (1 - tension) / 6;
        }
        CardinalOpen.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            if (this._line || this._line !== 0 && this._point === 3) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                break;
              case 1:
                this._point = 2;
                break;
              case 2:
                this._point = 3;
                this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
                break;
              case 3:
                this._point = 4;
              // proceed
              default:
                point$1(this, x2, y2);
                break;
            }
            this._x0 = this._x1, this._x1 = this._x2, this._x2 = x2;
            this._y0 = this._y1, this._y1 = this._y2, this._y2 = y2;
          }
        };
        var cardinalOpen = (function custom(tension) {
          function cardinal2(context) {
            return new CardinalOpen(context, tension);
          }
          cardinal2.tension = function(tension2) {
            return custom(+tension2);
          };
          return cardinal2;
        })(0);
        function point$2(that, x2, y2) {
          var x1 = that._x1, y1 = that._y1, x22 = that._x2, y22 = that._y2;
          if (that._l01_a > epsilon) {
            var a2 = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a, n = 3 * that._l01_a * (that._l01_a + that._l12_a);
            x1 = (x1 * a2 - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
            y1 = (y1 * a2 - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
          }
          if (that._l23_a > epsilon) {
            var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a, m = 3 * that._l23_a * (that._l23_a + that._l12_a);
            x22 = (x22 * b + that._x1 * that._l23_2a - x2 * that._l12_2a) / m;
            y22 = (y22 * b + that._y1 * that._l23_2a - y2 * that._l12_2a) / m;
          }
          that._context.bezierCurveTo(x1, y1, x22, y22, that._x2, that._y2);
        }
        function CatmullRom(context, alpha) {
          this._context = context;
          this._alpha = alpha;
        }
        CatmullRom.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
            this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 2:
                this._context.lineTo(this._x2, this._y2);
                break;
              case 3:
                this.point(this._x2, this._y2);
                break;
            }
            if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            if (this._point) {
              var x23 = this._x2 - x2, y23 = this._y2 - y2;
              this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
            }
            switch (this._point) {
              case 0:
                this._point = 1;
                this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
                break;
              case 1:
                this._point = 2;
                break;
              case 2:
                this._point = 3;
              // proceed
              default:
                point$2(this, x2, y2);
                break;
            }
            this._l01_a = this._l12_a, this._l12_a = this._l23_a;
            this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
            this._x0 = this._x1, this._x1 = this._x2, this._x2 = x2;
            this._y0 = this._y1, this._y1 = this._y2, this._y2 = y2;
          }
        };
        var catmullRom = (function custom(alpha) {
          function catmullRom2(context) {
            return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
          }
          catmullRom2.alpha = function(alpha2) {
            return custom(+alpha2);
          };
          return catmullRom2;
        })(0.5);
        function CatmullRomClosed(context, alpha) {
          this._context = context;
          this._alpha = alpha;
        }
        CatmullRomClosed.prototype = {
          areaStart: noop,
          areaEnd: noop,
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
            this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 1: {
                this._context.moveTo(this._x3, this._y3);
                this._context.closePath();
                break;
              }
              case 2: {
                this._context.lineTo(this._x3, this._y3);
                this._context.closePath();
                break;
              }
              case 3: {
                this.point(this._x3, this._y3);
                this.point(this._x4, this._y4);
                this.point(this._x5, this._y5);
                break;
              }
            }
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            if (this._point) {
              var x23 = this._x2 - x2, y23 = this._y2 - y2;
              this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
            }
            switch (this._point) {
              case 0:
                this._point = 1;
                this._x3 = x2, this._y3 = y2;
                break;
              case 1:
                this._point = 2;
                this._context.moveTo(this._x4 = x2, this._y4 = y2);
                break;
              case 2:
                this._point = 3;
                this._x5 = x2, this._y5 = y2;
                break;
              default:
                point$2(this, x2, y2);
                break;
            }
            this._l01_a = this._l12_a, this._l12_a = this._l23_a;
            this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
            this._x0 = this._x1, this._x1 = this._x2, this._x2 = x2;
            this._y0 = this._y1, this._y1 = this._y2, this._y2 = y2;
          }
        };
        var catmullRomClosed = (function custom(alpha) {
          function catmullRom2(context) {
            return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
          }
          catmullRom2.alpha = function(alpha2) {
            return custom(+alpha2);
          };
          return catmullRom2;
        })(0.5);
        function CatmullRomOpen(context, alpha) {
          this._context = context;
          this._alpha = alpha;
        }
        CatmullRomOpen.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
            this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
          },
          lineEnd: function() {
            if (this._line || this._line !== 0 && this._point === 3) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            if (this._point) {
              var x23 = this._x2 - x2, y23 = this._y2 - y2;
              this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
            }
            switch (this._point) {
              case 0:
                this._point = 1;
                break;
              case 1:
                this._point = 2;
                break;
              case 2:
                this._point = 3;
                this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
                break;
              case 3:
                this._point = 4;
              // proceed
              default:
                point$2(this, x2, y2);
                break;
            }
            this._l01_a = this._l12_a, this._l12_a = this._l23_a;
            this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
            this._x0 = this._x1, this._x1 = this._x2, this._x2 = x2;
            this._y0 = this._y1, this._y1 = this._y2, this._y2 = y2;
          }
        };
        var catmullRomOpen = (function custom(alpha) {
          function catmullRom2(context) {
            return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
          }
          catmullRom2.alpha = function(alpha2) {
            return custom(+alpha2);
          };
          return catmullRom2;
        })(0.5);
        function LinearClosed(context) {
          this._context = context;
        }
        LinearClosed.prototype = {
          areaStart: noop,
          areaEnd: noop,
          lineStart: function() {
            this._point = 0;
          },
          lineEnd: function() {
            if (this._point) this._context.closePath();
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            if (this._point) this._context.lineTo(x2, y2);
            else this._point = 1, this._context.moveTo(x2, y2);
          }
        };
        function linearClosed(context) {
          return new LinearClosed(context);
        }
        function sign(x2) {
          return x2 < 0 ? -1 : 1;
        }
        function slope3(that, x2, y2) {
          var h0 = that._x1 - that._x0, h1 = x2 - that._x1, s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0), s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0), p = (s0 * h1 + s1 * h0) / (h0 + h1);
          return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
        }
        function slope2(that, t) {
          var h = that._x1 - that._x0;
          return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
        }
        function point$3(that, t0, t1) {
          var x0 = that._x0, y0 = that._y0, x1 = that._x1, y1 = that._y1, dx = (x1 - x0) / 3;
          that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
        }
        function MonotoneX(context) {
          this._context = context;
        }
        MonotoneX.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            switch (this._point) {
              case 2:
                this._context.lineTo(this._x1, this._y1);
                break;
              case 3:
                point$3(this, this._t0, slope2(this, this._t0));
                break;
            }
            if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
            this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            var t1 = NaN;
            x2 = +x2, y2 = +y2;
            if (x2 === this._x1 && y2 === this._y1) return;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
                break;
              case 1:
                this._point = 2;
                break;
              case 2:
                this._point = 3;
                point$3(this, slope2(this, t1 = slope3(this, x2, y2)), t1);
                break;
              default:
                point$3(this, this._t0, t1 = slope3(this, x2, y2));
                break;
            }
            this._x0 = this._x1, this._x1 = x2;
            this._y0 = this._y1, this._y1 = y2;
            this._t0 = t1;
          }
        };
        function MonotoneY(context) {
          this._context = new ReflectContext(context);
        }
        (MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x2, y2) {
          MonotoneX.prototype.point.call(this, y2, x2);
        };
        function ReflectContext(context) {
          this._context = context;
        }
        ReflectContext.prototype = {
          moveTo: function(x2, y2) {
            this._context.moveTo(y2, x2);
          },
          closePath: function() {
            this._context.closePath();
          },
          lineTo: function(x2, y2) {
            this._context.lineTo(y2, x2);
          },
          bezierCurveTo: function(x1, y1, x2, y2, x3, y3) {
            this._context.bezierCurveTo(y1, x1, y2, x2, y3, x3);
          }
        };
        function monotoneX(context) {
          return new MonotoneX(context);
        }
        function monotoneY(context) {
          return new MonotoneY(context);
        }
        function Natural(context) {
          this._context = context;
        }
        Natural.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x = [];
            this._y = [];
          },
          lineEnd: function() {
            var x2 = this._x, y2 = this._y, n = x2.length;
            if (n) {
              this._line ? this._context.lineTo(x2[0], y2[0]) : this._context.moveTo(x2[0], y2[0]);
              if (n === 2) {
                this._context.lineTo(x2[1], y2[1]);
              } else {
                var px = controlPoints(x2), py = controlPoints(y2);
                for (var i0 = 0, i1 = 1; i1 < n; ++i0, ++i1) {
                  this._context.bezierCurveTo(px[0][i0], py[0][i0], px[1][i0], py[1][i0], x2[i1], y2[i1]);
                }
              }
            }
            if (this._line || this._line !== 0 && n === 1) this._context.closePath();
            this._line = 1 - this._line;
            this._x = this._y = null;
          },
          point: function(x2, y2) {
            this._x.push(+x2);
            this._y.push(+y2);
          }
        };
        function controlPoints(x2) {
          var i, n = x2.length - 1, m, a2 = new Array(n), b = new Array(n), r = new Array(n);
          a2[0] = 0, b[0] = 2, r[0] = x2[0] + 2 * x2[1];
          for (i = 1; i < n - 1; ++i) a2[i] = 1, b[i] = 4, r[i] = 4 * x2[i] + 2 * x2[i + 1];
          a2[n - 1] = 2, b[n - 1] = 7, r[n - 1] = 8 * x2[n - 1] + x2[n];
          for (i = 1; i < n; ++i) m = a2[i] / b[i - 1], b[i] -= m, r[i] -= m * r[i - 1];
          a2[n - 1] = r[n - 1] / b[n - 1];
          for (i = n - 2; i >= 0; --i) a2[i] = (r[i] - a2[i + 1]) / b[i];
          b[n - 1] = (x2[n] + a2[n - 1]) / 2;
          for (i = 0; i < n - 1; ++i) b[i] = 2 * x2[i + 1] - a2[i + 1];
          return [a2, b];
        }
        function natural(context) {
          return new Natural(context);
        }
        function Step(context, t) {
          this._context = context;
          this._t = t;
        }
        Step.prototype = {
          areaStart: function() {
            this._line = 0;
          },
          areaEnd: function() {
            this._line = NaN;
          },
          lineStart: function() {
            this._x = this._y = NaN;
            this._point = 0;
          },
          lineEnd: function() {
            if (0 < this._t && this._t < 1 && this._point === 2) this._context.lineTo(this._x, this._y);
            if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
            if (this._line >= 0) this._t = 1 - this._t, this._line = 1 - this._line;
          },
          point: function(x2, y2) {
            x2 = +x2, y2 = +y2;
            switch (this._point) {
              case 0:
                this._point = 1;
                this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
                break;
              case 1:
                this._point = 2;
              // proceed
              default: {
                if (this._t <= 0) {
                  this._context.lineTo(this._x, y2);
                  this._context.lineTo(x2, y2);
                } else {
                  var x1 = this._x * (1 - this._t) + x2 * this._t;
                  this._context.lineTo(x1, this._y);
                  this._context.lineTo(x1, y2);
                }
                break;
              }
            }
            this._x = x2, this._y = y2;
          }
        };
        function step(context) {
          return new Step(context, 0.5);
        }
        function stepBefore(context) {
          return new Step(context, 0);
        }
        function stepAfter(context) {
          return new Step(context, 1);
        }
        function none(series, order) {
          if (!((n = series.length) > 1)) return;
          for (var i = 1, j, s0, s1 = series[order[0]], n, m = s1.length; i < n; ++i) {
            s0 = s1, s1 = series[order[i]];
            for (j = 0; j < m; ++j) {
              s1[j][1] += s1[j][0] = isNaN(s0[j][1]) ? s0[j][0] : s0[j][1];
            }
          }
        }
        function none$1(series) {
          var n = series.length, o = new Array(n);
          while (--n >= 0) o[n] = n;
          return o;
        }
        function stackValue(d, key) {
          return d[key];
        }
        function stack() {
          var keys = constant([]), order = none$1, offset = none, value = stackValue;
          function stack2(data) {
            var kz = keys.apply(this, arguments), i, m = data.length, n = kz.length, sz = new Array(n), oz;
            for (i = 0; i < n; ++i) {
              for (var ki = kz[i], si = sz[i] = new Array(m), j = 0, sij; j < m; ++j) {
                si[j] = sij = [0, +value(data[j], ki, j, data)];
                sij.data = data[j];
              }
              si.key = ki;
            }
            for (i = 0, oz = order(sz); i < n; ++i) {
              sz[oz[i]].index = i;
            }
            offset(sz, oz);
            return sz;
          }
          stack2.keys = function(_) {
            return arguments.length ? (keys = typeof _ === "function" ? _ : constant(slice.call(_)), stack2) : keys;
          };
          stack2.value = function(_) {
            return arguments.length ? (value = typeof _ === "function" ? _ : constant(+_), stack2) : value;
          };
          stack2.order = function(_) {
            return arguments.length ? (order = _ == null ? none$1 : typeof _ === "function" ? _ : constant(slice.call(_)), stack2) : order;
          };
          stack2.offset = function(_) {
            return arguments.length ? (offset = _ == null ? none : _, stack2) : offset;
          };
          return stack2;
        }
        function expand(series, order) {
          if (!((n = series.length) > 0)) return;
          for (var i, n, j = 0, m = series[0].length, y2; j < m; ++j) {
            for (y2 = i = 0; i < n; ++i) y2 += series[i][j][1] || 0;
            if (y2) for (i = 0; i < n; ++i) series[i][j][1] /= y2;
          }
          none(series, order);
        }
        function diverging(series, order) {
          if (!((n = series.length) > 0)) return;
          for (var i, j = 0, d, dy, yp, yn, n, m = series[order[0]].length; j < m; ++j) {
            for (yp = yn = 0, i = 0; i < n; ++i) {
              if ((dy = (d = series[order[i]][j])[1] - d[0]) > 0) {
                d[0] = yp, d[1] = yp += dy;
              } else if (dy < 0) {
                d[1] = yn, d[0] = yn += dy;
              } else {
                d[0] = 0, d[1] = dy;
              }
            }
          }
        }
        function silhouette(series, order) {
          if (!((n = series.length) > 0)) return;
          for (var j = 0, s0 = series[order[0]], n, m = s0.length; j < m; ++j) {
            for (var i = 0, y2 = 0; i < n; ++i) y2 += series[i][j][1] || 0;
            s0[j][1] += s0[j][0] = -y2 / 2;
          }
          none(series, order);
        }
        function wiggle(series, order) {
          if (!((n = series.length) > 0) || !((m = (s0 = series[order[0]]).length) > 0)) return;
          for (var y2 = 0, j = 1, s0, m, n; j < m; ++j) {
            for (var i = 0, s1 = 0, s2 = 0; i < n; ++i) {
              var si = series[order[i]], sij0 = si[j][1] || 0, sij1 = si[j - 1][1] || 0, s3 = (sij0 - sij1) / 2;
              for (var k2 = 0; k2 < i; ++k2) {
                var sk = series[order[k2]], skj0 = sk[j][1] || 0, skj1 = sk[j - 1][1] || 0;
                s3 += skj0 - skj1;
              }
              s1 += sij0, s2 += s3 * sij0;
            }
            s0[j - 1][1] += s0[j - 1][0] = y2;
            if (s1) y2 -= s2 / s1;
          }
          s0[j - 1][1] += s0[j - 1][0] = y2;
          none(series, order);
        }
        function appearance(series) {
          var peaks = series.map(peak);
          return none$1(series).sort(function(a2, b) {
            return peaks[a2] - peaks[b];
          });
        }
        function peak(series) {
          var i = -1, j = 0, n = series.length, vi, vj = -Infinity;
          while (++i < n) if ((vi = +series[i][1]) > vj) vj = vi, j = i;
          return j;
        }
        function ascending(series) {
          var sums = series.map(sum);
          return none$1(series).sort(function(a2, b) {
            return sums[a2] - sums[b];
          });
        }
        function sum(series) {
          var s2 = 0, i = -1, n = series.length, v;
          while (++i < n) if (v = +series[i][1]) s2 += v;
          return s2;
        }
        function descending$1(series) {
          return ascending(series).reverse();
        }
        function insideOut(series) {
          var n = series.length, i, j, sums = series.map(sum), order = appearance(series), top = 0, bottom = 0, tops = [], bottoms = [];
          for (i = 0; i < n; ++i) {
            j = order[i];
            if (top < bottom) {
              top += sums[j];
              tops.push(j);
            } else {
              bottom += sums[j];
              bottoms.push(j);
            }
          }
          return bottoms.reverse().concat(tops);
        }
        function reverse(series) {
          return none$1(series).reverse();
        }
        exports2.arc = arc;
        exports2.area = area;
        exports2.areaRadial = areaRadial;
        exports2.curveBasis = basis;
        exports2.curveBasisClosed = basisClosed;
        exports2.curveBasisOpen = basisOpen;
        exports2.curveBundle = bundle;
        exports2.curveCardinal = cardinal;
        exports2.curveCardinalClosed = cardinalClosed;
        exports2.curveCardinalOpen = cardinalOpen;
        exports2.curveCatmullRom = catmullRom;
        exports2.curveCatmullRomClosed = catmullRomClosed;
        exports2.curveCatmullRomOpen = catmullRomOpen;
        exports2.curveLinear = curveLinear;
        exports2.curveLinearClosed = linearClosed;
        exports2.curveMonotoneX = monotoneX;
        exports2.curveMonotoneY = monotoneY;
        exports2.curveNatural = natural;
        exports2.curveStep = step;
        exports2.curveStepAfter = stepAfter;
        exports2.curveStepBefore = stepBefore;
        exports2.line = line;
        exports2.lineRadial = lineRadial$1;
        exports2.linkHorizontal = linkHorizontal;
        exports2.linkRadial = linkRadial;
        exports2.linkVertical = linkVertical;
        exports2.pie = pie;
        exports2.pointRadial = pointRadial;
        exports2.radialArea = areaRadial;
        exports2.radialLine = lineRadial$1;
        exports2.stack = stack;
        exports2.stackOffsetDiverging = diverging;
        exports2.stackOffsetExpand = expand;
        exports2.stackOffsetNone = none;
        exports2.stackOffsetSilhouette = silhouette;
        exports2.stackOffsetWiggle = wiggle;
        exports2.stackOrderAppearance = appearance;
        exports2.stackOrderAscending = ascending;
        exports2.stackOrderDescending = descending$1;
        exports2.stackOrderInsideOut = insideOut;
        exports2.stackOrderNone = none$1;
        exports2.stackOrderReverse = reverse;
        exports2.symbol = symbol;
        exports2.symbolCircle = circle;
        exports2.symbolCross = cross;
        exports2.symbolDiamond = diamond;
        exports2.symbolSquare = square;
        exports2.symbolStar = star;
        exports2.symbolTriangle = triangle;
        exports2.symbolWye = wye;
        exports2.symbols = symbols;
        Object.defineProperty(exports2, "__esModule", { value: true });
      });
    }
  });

  // node_modules/d3-sankey/dist/d3-sankey.js
  var require_d3_sankey = __commonJS({
    "node_modules/d3-sankey/dist/d3-sankey.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require_d3_array(), require_d3_shape()) : typeof define === "function" && define.amd ? define(["exports", "d3-array", "d3-shape"], factory) : (global = global || self, factory(global.d3 = global.d3 || {}, global.d3, global.d3));
      })(exports, function(exports2, d3Array, d3Shape) {
        "use strict";
        function targetDepth(d) {
          return d.target.depth;
        }
        function left(node) {
          return node.depth;
        }
        function right(node, n) {
          return n - 1 - node.height;
        }
        function justify(node, n) {
          return node.sourceLinks.length ? node.depth : n - 1;
        }
        function center(node) {
          return node.targetLinks.length ? node.depth : node.sourceLinks.length ? d3Array.min(node.sourceLinks, targetDepth) - 1 : 0;
        }
        function constant(x) {
          return function() {
            return x;
          };
        }
        function ascendingSourceBreadth(a, b) {
          return ascendingBreadth(a.source, b.source) || a.index - b.index;
        }
        function ascendingTargetBreadth(a, b) {
          return ascendingBreadth(a.target, b.target) || a.index - b.index;
        }
        function ascendingBreadth(a, b) {
          return a.y0 - b.y0;
        }
        function value(d) {
          return d.value;
        }
        function defaultId(d) {
          return d.index;
        }
        function defaultNodes(graph) {
          return graph.nodes;
        }
        function defaultLinks(graph) {
          return graph.links;
        }
        function find(nodeById, id) {
          const node = nodeById.get(id);
          if (!node) throw new Error("missing: " + id);
          return node;
        }
        function computeLinkBreadths({ nodes }) {
          for (const node of nodes) {
            let y0 = node.y0;
            let y1 = y0;
            for (const link of node.sourceLinks) {
              link.y0 = y0 + link.width / 2;
              y0 += link.width;
            }
            for (const link of node.targetLinks) {
              link.y1 = y1 + link.width / 2;
              y1 += link.width;
            }
          }
        }
        function Sankey() {
          let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
          let dx = 24;
          let dy = 8, py;
          let id = defaultId;
          let align = justify;
          let sort;
          let linkSort;
          let nodes = defaultNodes;
          let links = defaultLinks;
          let iterations = 6;
          function sankey2() {
            const graph = { nodes: nodes.apply(null, arguments), links: links.apply(null, arguments) };
            computeNodeLinks(graph);
            computeNodeValues(graph);
            computeNodeDepths(graph);
            computeNodeHeights(graph);
            computeNodeBreadths(graph);
            computeLinkBreadths(graph);
            return graph;
          }
          sankey2.update = function(graph) {
            computeLinkBreadths(graph);
            return graph;
          };
          sankey2.nodeId = function(_) {
            return arguments.length ? (id = typeof _ === "function" ? _ : constant(_), sankey2) : id;
          };
          sankey2.nodeAlign = function(_) {
            return arguments.length ? (align = typeof _ === "function" ? _ : constant(_), sankey2) : align;
          };
          sankey2.nodeSort = function(_) {
            return arguments.length ? (sort = _, sankey2) : sort;
          };
          sankey2.nodeWidth = function(_) {
            return arguments.length ? (dx = +_, sankey2) : dx;
          };
          sankey2.nodePadding = function(_) {
            return arguments.length ? (dy = py = +_, sankey2) : dy;
          };
          sankey2.nodes = function(_) {
            return arguments.length ? (nodes = typeof _ === "function" ? _ : constant(_), sankey2) : nodes;
          };
          sankey2.links = function(_) {
            return arguments.length ? (links = typeof _ === "function" ? _ : constant(_), sankey2) : links;
          };
          sankey2.linkSort = function(_) {
            return arguments.length ? (linkSort = _, sankey2) : linkSort;
          };
          sankey2.size = function(_) {
            return arguments.length ? (x0 = y0 = 0, x1 = +_[0], y1 = +_[1], sankey2) : [x1 - x0, y1 - y0];
          };
          sankey2.extent = function(_) {
            return arguments.length ? (x0 = +_[0][0], x1 = +_[1][0], y0 = +_[0][1], y1 = +_[1][1], sankey2) : [[x0, y0], [x1, y1]];
          };
          sankey2.iterations = function(_) {
            return arguments.length ? (iterations = +_, sankey2) : iterations;
          };
          function computeNodeLinks({ nodes: nodes2, links: links2 }) {
            for (const [i, node] of nodes2.entries()) {
              node.index = i;
              node.sourceLinks = [];
              node.targetLinks = [];
            }
            const nodeById = new Map(nodes2.map((d, i) => [id(d, i, nodes2), d]));
            for (const [i, link] of links2.entries()) {
              link.index = i;
              let { source, target } = link;
              if (typeof source !== "object") source = link.source = find(nodeById, source);
              if (typeof target !== "object") target = link.target = find(nodeById, target);
              source.sourceLinks.push(link);
              target.targetLinks.push(link);
            }
            if (linkSort != null) {
              for (const { sourceLinks, targetLinks } of nodes2) {
                sourceLinks.sort(linkSort);
                targetLinks.sort(linkSort);
              }
            }
          }
          function computeNodeValues({ nodes: nodes2 }) {
            for (const node of nodes2) {
              node.value = node.fixedValue === void 0 ? Math.max(d3Array.sum(node.sourceLinks, value), d3Array.sum(node.targetLinks, value)) : node.fixedValue;
            }
          }
          function computeNodeDepths({ nodes: nodes2 }) {
            const n = nodes2.length;
            let current = new Set(nodes2);
            let next = /* @__PURE__ */ new Set();
            let x = 0;
            while (current.size) {
              for (const node of current) {
                node.depth = x;
                for (const { target } of node.sourceLinks) {
                  next.add(target);
                }
              }
              if (++x > n) throw new Error("circular link");
              current = next;
              next = /* @__PURE__ */ new Set();
            }
          }
          function computeNodeHeights({ nodes: nodes2 }) {
            const n = nodes2.length;
            let current = new Set(nodes2);
            let next = /* @__PURE__ */ new Set();
            let x = 0;
            while (current.size) {
              for (const node of current) {
                node.height = x;
                for (const { source } of node.targetLinks) {
                  next.add(source);
                }
              }
              if (++x > n) throw new Error("circular link");
              current = next;
              next = /* @__PURE__ */ new Set();
            }
          }
          function computeNodeLayers({ nodes: nodes2 }) {
            const x = d3Array.max(nodes2, (d) => d.depth) + 1;
            const kx = (x1 - x0 - dx) / (x - 1);
            const columns = new Array(x);
            for (const node of nodes2) {
              const i = Math.max(0, Math.min(x - 1, Math.floor(align.call(null, node, x))));
              node.layer = i;
              node.x0 = x0 + i * kx;
              node.x1 = node.x0 + dx;
              if (columns[i]) columns[i].push(node);
              else columns[i] = [node];
            }
            if (sort) for (const column of columns) {
              column.sort(sort);
            }
            return columns;
          }
          function initializeNodeBreadths(columns) {
            const ky = d3Array.min(columns, (c) => (y1 - y0 - (c.length - 1) * py) / d3Array.sum(c, value));
            for (const nodes2 of columns) {
              let y = y0;
              for (const node of nodes2) {
                node.y0 = y;
                node.y1 = y + node.value * ky;
                y = node.y1 + py;
                for (const link of node.sourceLinks) {
                  link.width = link.value * ky;
                }
              }
              y = (y1 - y + py) / (nodes2.length + 1);
              for (let i = 0; i < nodes2.length; ++i) {
                const node = nodes2[i];
                node.y0 += y * (i + 1);
                node.y1 += y * (i + 1);
              }
              reorderLinks(nodes2);
            }
          }
          function computeNodeBreadths(graph) {
            const columns = computeNodeLayers(graph);
            py = Math.min(dy, (y1 - y0) / (d3Array.max(columns, (c) => c.length) - 1));
            initializeNodeBreadths(columns);
            for (let i = 0; i < iterations; ++i) {
              const alpha = Math.pow(0.99, i);
              const beta = Math.max(1 - alpha, (i + 1) / iterations);
              relaxRightToLeft(columns, alpha, beta);
              relaxLeftToRight(columns, alpha, beta);
            }
          }
          function relaxLeftToRight(columns, alpha, beta) {
            for (let i = 1, n = columns.length; i < n; ++i) {
              const column = columns[i];
              for (const target of column) {
                let y = 0;
                let w = 0;
                for (const { source, value: value2 } of target.targetLinks) {
                  let v = value2 * (target.layer - source.layer);
                  y += targetTop(source, target) * v;
                  w += v;
                }
                if (!(w > 0)) continue;
                let dy2 = (y / w - target.y0) * alpha;
                target.y0 += dy2;
                target.y1 += dy2;
                reorderNodeLinks(target);
              }
              if (sort === void 0) column.sort(ascendingBreadth);
              resolveCollisions(column, beta);
            }
          }
          function relaxRightToLeft(columns, alpha, beta) {
            for (let n = columns.length, i = n - 2; i >= 0; --i) {
              const column = columns[i];
              for (const source of column) {
                let y = 0;
                let w = 0;
                for (const { target, value: value2 } of source.sourceLinks) {
                  let v = value2 * (target.layer - source.layer);
                  y += sourceTop(source, target) * v;
                  w += v;
                }
                if (!(w > 0)) continue;
                let dy2 = (y / w - source.y0) * alpha;
                source.y0 += dy2;
                source.y1 += dy2;
                reorderNodeLinks(source);
              }
              if (sort === void 0) column.sort(ascendingBreadth);
              resolveCollisions(column, beta);
            }
          }
          function resolveCollisions(nodes2, alpha) {
            const i = nodes2.length >> 1;
            const subject = nodes2[i];
            resolveCollisionsBottomToTop(nodes2, subject.y0 - py, i - 1, alpha);
            resolveCollisionsTopToBottom(nodes2, subject.y1 + py, i + 1, alpha);
            resolveCollisionsBottomToTop(nodes2, y1, nodes2.length - 1, alpha);
            resolveCollisionsTopToBottom(nodes2, y0, 0, alpha);
          }
          function resolveCollisionsTopToBottom(nodes2, y, i, alpha) {
            for (; i < nodes2.length; ++i) {
              const node = nodes2[i];
              const dy2 = (y - node.y0) * alpha;
              if (dy2 > 1e-6) node.y0 += dy2, node.y1 += dy2;
              y = node.y1 + py;
            }
          }
          function resolveCollisionsBottomToTop(nodes2, y, i, alpha) {
            for (; i >= 0; --i) {
              const node = nodes2[i];
              const dy2 = (node.y1 - y) * alpha;
              if (dy2 > 1e-6) node.y0 -= dy2, node.y1 -= dy2;
              y = node.y0 - py;
            }
          }
          function reorderNodeLinks({ sourceLinks, targetLinks }) {
            if (linkSort === void 0) {
              for (const { source: { sourceLinks: sourceLinks2 } } of targetLinks) {
                sourceLinks2.sort(ascendingTargetBreadth);
              }
              for (const { target: { targetLinks: targetLinks2 } } of sourceLinks) {
                targetLinks2.sort(ascendingSourceBreadth);
              }
            }
          }
          function reorderLinks(nodes2) {
            if (linkSort === void 0) {
              for (const { sourceLinks, targetLinks } of nodes2) {
                sourceLinks.sort(ascendingTargetBreadth);
                targetLinks.sort(ascendingSourceBreadth);
              }
            }
          }
          function targetTop(source, target) {
            let y = source.y0 - (source.sourceLinks.length - 1) * py / 2;
            for (const { target: node, width } of source.sourceLinks) {
              if (node === target) break;
              y += width + py;
            }
            for (const { source: node, width } of target.targetLinks) {
              if (node === source) break;
              y -= width;
            }
            return y;
          }
          function sourceTop(source, target) {
            let y = target.y0 - (target.targetLinks.length - 1) * py / 2;
            for (const { source: node, width } of target.targetLinks) {
              if (node === source) break;
              y += width + py;
            }
            for (const { target: node, width } of source.sourceLinks) {
              if (node === target) break;
              y -= width;
            }
            return y;
          }
          return sankey2;
        }
        function horizontalSource(d) {
          return [d.source.x1, d.y0];
        }
        function horizontalTarget(d) {
          return [d.target.x0, d.y1];
        }
        function sankeyLinkHorizontal2() {
          return d3Shape.linkHorizontal().source(horizontalSource).target(horizontalTarget);
        }
        exports2.sankey = Sankey;
        exports2.sankeyCenter = center;
        exports2.sankeyJustify = justify;
        exports2.sankeyLeft = left;
        exports2.sankeyLinkHorizontal = sankeyLinkHorizontal2;
        exports2.sankeyRight = right;
        Object.defineProperty(exports2, "__esModule", { value: true });
      });
    }
  });

  // src/previewRenderer.js
  var {
    DEFAULT_LIMITS,
    parseSankey,
    toMermaidSankey
  } = require_parser();
  var {
    sankey,
    sankeyCenter,
    sankeyJustify,
    sankeyLeft,
    sankeyLinkHorizontal,
    sankeyRight
  } = require_d3_sankey();
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MAX_RENDER_HEIGHT = 4e3;
  var EXPORT_SIZE_LIMIT = 10 * 1024 * 1024;
  var PALETTE = [
    "#4E79A7",
    "#F28E2B",
    "#E15759",
    "#76B7B2",
    "#59A14F",
    "#EDC949",
    "#AF7AA1",
    "#FF9DA7",
    "#9C755F",
    "#BAB0AC"
  ];
  var renderCounter = 0;
  function getVsCodeApi() {
    try {
      if (typeof acquireVsCodeApi === "function") {
        return acquireVsCodeApi();
      }
    } catch (_error) {
      return null;
    }
    return null;
  }
  var vscode = getVsCodeApi();
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
      if (value !== void 0 && value !== null) {
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
    if (document.getElementById("sankey-preview-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "sankey-preview-styles";
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
      mix-blend-mode: multiply;
    }

    .sankey-node-label,
    .sankey-link-label {
      fill: var(--vscode-editor-foreground, #1f2328);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      paint-order: stroke;
      pointer-events: none;
      stroke: var(--vscode-editor-background, #fff);
      stroke-linejoin: round;
      stroke-width: 3px;
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
    const button = document.createElement("button");
    button.type = "button";
    button.title = title;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }
  function makeFormatter(options) {
    const format = options.valueFormat || "raw";
    let numberFormatter;
    if (format === "integer") {
      numberFormatter = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
    } else if (format === "decimal") {
      numberFormatter = new Intl.NumberFormat(void 0, { maximumFractionDigits: 2 });
    } else if (format === "compact") {
      numberFormatter = new Intl.NumberFormat(void 0, {
        maximumFractionDigits: 2,
        notation: "compact"
      });
    }
    return (value) => {
      const formatted = numberFormatter ? numberFormatter.format(value) : String(value);
      return options.unit ? `${formatted} ${options.unit}` : formatted;
    };
  }
  function nodeAlignFactory(value) {
    if (value === "left") {
      return sankeyLeft;
    }
    if (value === "right") {
      return sankeyRight;
    }
    if (value === "center") {
      return sankeyCenter;
    }
    return sankeyJustify;
  }
  function getNodeColor(node, index) {
    return node.color || PALETTE[index % PALETTE.length];
  }
  function getColorMaps(graph) {
    const colors = /* @__PURE__ */ new Map();
    graph.nodes.forEach((node, index) => {
      colors.set(node.id, getNodeColor(node, index));
    });
    return colors;
  }
  function getLinkColor(link, options, colors, defs, renderId, index) {
    const setting = options.linkColor || "source";
    if (setting.startsWith("#")) {
      return setting;
    }
    if (setting === "target") {
      return colors.get(link.target.id) || PALETTE[0];
    }
    if (setting === "gradient") {
      const id = `sankey-gradient-${renderId}-${index}`;
      const gradient = appendSvg(defs, "linearGradient", {
        id,
        gradientUnits: "userSpaceOnUse",
        x1: link.source.x1,
        x2: link.target.x0,
        y1: (link.y0 + link.source.y0 + link.source.y1) / 3,
        y2: (link.y1 + link.target.y0 + link.target.y1) / 3
      });
      appendSvg(gradient, "stop", {
        offset: "0%",
        "stop-color": colors.get(link.source.id) || PALETTE[0],
        "stop-opacity": "0.62"
      });
      appendSvg(gradient, "stop", {
        offset: "100%",
        "stop-color": colors.get(link.target.id) || PALETTE[1],
        "stop-opacity": "0.62"
      });
      return `url(#${id})`;
    }
    return colors.get(link.source.id) || PALETTE[0];
  }
  function balanceWarnings(parsed, formatter) {
    const totals = /* @__PURE__ */ new Map();
    parsed.nodes.forEach((node) => totals.set(node.id, { incoming: 0, outgoing: 0 }));
    parsed.links.forEach((link) => {
      totals.get(link.source).outgoing += link.value;
      totals.get(link.target).incoming += link.value;
    });
    return Array.from(totals.entries()).filter(([_id, total]) => {
      if (total.incoming === 0 || total.outgoing === 0) {
        return false;
      }
      const tolerance = Math.max(1e-6, Math.max(total.incoming, total.outgoing) * 1e-6);
      return Math.abs(total.incoming - total.outgoing) > tolerance;
    }).map(([id, total]) => `${id} (${formatter(total.incoming)} in, ${formatter(total.outgoing)} out)`);
  }
  function renderWarnings(parent, parsed, formatter) {
    const warnings = [];
    parsed.warnings.forEach((warning) => warnings.push(`line ${warning.line}: ${warning.message}`));
    const unbalanced = balanceWarnings(parsed, formatter);
    if (unbalanced.length > 0) {
      warnings.push(`Unbalanced intermediate nodes: ${unbalanced.slice(0, 4).join("; ")}${unbalanced.length > 4 ? "; ..." : ""}`);
    }
    if (warnings.length === 0) {
      return;
    }
    const warningPanel = appendHtml(parent, "div", "sankey-warning");
    warningPanel.textContent = warnings.join(" ");
  }
  function showStatus(statusElement, message) {
    statusElement.textContent = message;
    window.setTimeout(() => {
      if (statusElement.textContent === message) {
        statusElement.textContent = "";
      }
    }, 2500);
  }
  function serializeSvg(svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("version", "1.1");
    const serialized = new XMLSerializer().serializeToString(clone);
    return `<?xml version="1.0" encoding="UTF-8"?>
${serialized}`;
  }
  function downloadText(filename, mimeType, text) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  function downloadDataUrl(filename, dataUrl) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }
  function exportSvg(svg, standalone) {
    const data = serializeSvg(svg);
    if (data.length > EXPORT_SIZE_LIMIT) {
      throw new Error("Export data too large");
    }
    if (standalone && vscode) {
      vscode.postMessage({ type: "export", format: "svg", data });
      return;
    }
    downloadText("sankey.svg", "image/svg+xml;charset=utf-8", data);
  }
  function exportPng(svg, standalone) {
    return new Promise((resolve, reject) => {
      const svgText = serializeSvg(svg);
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      const viewBox = svg.viewBox.baseVal;
      const width = Math.max(1, Math.ceil(viewBox.width || svg.clientWidth || 960));
      const height = Math.max(1, Math.ceil(viewBox.height || svg.clientHeight || 520));
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(url);
          if (dataUrl.length > EXPORT_SIZE_LIMIT) {
            reject(new Error("Export data too large"));
            return;
          }
          if (standalone && vscode) {
            vscode.postMessage({ type: "export", format: "png", data: dataUrl.split(",")[1] });
          } else {
            downloadDataUrl("sankey.png", dataUrl);
          }
          resolve();
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("PNG export failed"));
      };
      image.src = url;
    });
  }
  async function copyMermaid(parsed, standalone, statusElement) {
    const mermaid = toMermaidSankey(parsed, void 0, { fenced: true });
    if (standalone && vscode) {
      vscode.postMessage({ type: "copyMermaid", data: mermaid });
      showStatus(statusElement, "Copied Mermaid");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard is not available in this preview");
    }
    await navigator.clipboard.writeText(mermaid);
    showStatus(statusElement, "Copied Mermaid");
  }
  function enablePanZoom(svg, viewport, statusElement) {
    const state = { scale: 1, x: 0, y: 0, dragging: false, pointerId: null, startX: 0, startY: 0 };
    function apply() {
      viewport.setAttribute("transform", `translate(${state.x} ${state.y}) scale(${state.scale})`);
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
      showStatus(statusElement, "View reset");
    }
    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });
    svg.addEventListener("pointerdown", (event) => {
      state.dragging = true;
      state.pointerId = event.pointerId;
      state.startX = event.clientX - state.x;
      state.startY = event.clientY - state.y;
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener("pointermove", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) {
        return;
      }
      state.x = event.clientX - state.startX;
      state.y = event.clientY - state.startY;
      apply();
    });
    svg.addEventListener("pointerup", (event) => {
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
    const width = 980;
    const calculatedHeight = 260 + parsed.nodes.length * 22 + parsed.links.length * 4;
    const height = Math.min(MAX_RENDER_HEIGHT, Math.max(420, calculatedHeight));
    const margin = { top: 24, right: 160, bottom: 24, left: 160 };
    const graph = sankey().nodeId((node) => node.id).nodeAlign(nodeAlignFactory(parsed.options.nodeAlign)).nodeWidth(18).nodePadding(16).extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])({
      nodes: parsed.nodes.map((node) => ({ ...node })),
      links: parsed.links.map((link) => ({ ...link }))
    });
    const svg = appendSvg(chartArea, "svg", {
      role: "img",
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "xMidYMid meet"
    });
    const defs = appendSvg(svg, "defs");
    const viewport = appendSvg(svg, "g");
    const colors = getColorMaps(graph);
    graph.links.forEach((link, index) => {
      const stroke = getLinkColor(link, parsed.options, colors, defs, renderId, index);
      const path = appendSvg(viewport, "path", {
        class: "sankey-link",
        d: sankeyLinkHorizontal()(link),
        stroke,
        "stroke-opacity": parsed.options.linkColor === "gradient" ? 1 : 0.45,
        "stroke-width": Math.max(1, link.width)
      });
      const title = appendSvg(path, "title");
      title.textContent = link.label ? `${link.source.id} to ${link.target.id}: ${formatter(link.value)} (${link.label})` : `${link.source.id} to ${link.target.id}: ${formatter(link.value)}`;
      if (link.label) {
        const label = appendSvg(viewport, "text", {
          class: "sankey-link-label",
          x: (link.source.x1 + link.target.x0) / 2,
          y: (link.y0 + link.y1) / 2,
          "text-anchor": "middle"
        });
        label.textContent = link.label;
      }
    });
    graph.nodes.forEach((node, index) => {
      const group = appendSvg(viewport, "g", {
        transform: `translate(${node.x0} ${node.y0})`
      });
      const color = getNodeColor(node, index);
      appendSvg(group, "rect", {
        width: Math.max(1, node.x1 - node.x0),
        height: Math.max(1, node.y1 - node.y0),
        fill: color,
        rx: 2
      });
      const title = appendSvg(group, "title");
      title.textContent = `${node.id}: ${formatter(node.value)}`;
      const labelX = node.x0 < width / 2 ? node.x1 - node.x0 + 8 : -8;
      const label = appendSvg(group, "text", {
        class: "sankey-node-label",
        x: labelX,
        y: Math.max(12, (node.y1 - node.y0) / 2),
        dy: "0.35em",
        "text-anchor": node.x0 < width / 2 ? "start" : "end"
      });
      label.textContent = `${node.id} ${formatter(node.value)}`;
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
    container.classList.remove("loading");
    const render = appendHtml(container, "div", "sankey-render");
    const panel = appendHtml(render, "div", "sankey-error");
    const title = appendHtml(panel, "div");
    title.textContent = "Sankey preview failed";
    const message = appendHtml(panel, "div");
    message.textContent = error.message;
    const detail = appendHtml(panel, "div");
    detail.textContent = `Limits: ${limits.maxInputSize} bytes, ${limits.maxNodes} nodes, ${limits.maxLinks} links.`;
  }
  function renderInto(container, text, limits, options = {}) {
    clear(container);
    container.classList.remove("loading");
    const standalone = options.standalone === true;
    let parsed;
    try {
      parsed = parseSankey(text, limits);
    } catch (error) {
      showError(container, error, limits);
      return;
    }
    try {
      const render = appendHtml(container, "div", "sankey-render");
      const header = appendHtml(render, "div", "sankey-header");
      const title = appendHtml(header, "div", "sankey-title");
      title.textContent = parsed.options.title || "Sankey diagram";
      const toolbar = appendHtml(header, "div", "sankey-toolbar");
      const status = appendHtml(toolbar, "span", "sankey-status");
      const chartArea = appendHtml(render, "div", "sankey-chart");
      const chart = renderChart(chartArea, parsed, standalone, status);
      const formatter = makeFormatter(parsed.options);
      toolbar.appendChild(createButton("Mermaid", "Copy as Mermaid Sankey", async () => {
        try {
          await copyMermaid(parsed, standalone, status);
        } catch (error) {
          showStatus(status, error.message);
        }
      }));
      toolbar.appendChild(createButton("SVG", "Export SVG", () => {
        try {
          chart.exportSvg();
          showStatus(status, "SVG export ready");
        } catch (error) {
          showStatus(status, error.message);
        }
      }));
      toolbar.appendChild(createButton("PNG", "Export PNG", async () => {
        try {
          await chart.exportPng();
          showStatus(status, "PNG export ready");
        } catch (error) {
          showStatus(status, error.message);
        }
      }));
      toolbar.appendChild(createButton("+", "Zoom in", () => chart.zoomIn()));
      toolbar.appendChild(createButton("-", "Zoom out", () => chart.zoomOut()));
      toolbar.appendChild(createButton("Reset", "Reset pan and zoom", () => chart.reset()));
      renderWarnings(render, parsed, formatter);
    } catch (error) {
      showError(container, error, limits);
    }
  }
  function renderStandalone() {
    const source = document.getElementById("sankey-source");
    const container = document.getElementById("sankey-diagram");
    if (!source || !container) {
      return false;
    }
    const readText = () => {
      if (source instanceof HTMLTextAreaElement) {
        return source.value;
      }
      return source.textContent || "";
    };
    renderInto(container, readText(), getRenderLimits(container), { standalone: true });
    window.addEventListener("message", (event) => {
      if (event.data?.type === "update" && typeof event.data.text === "string") {
        source.value = event.data.text;
        renderInto(container, readText(), getRenderLimits(container), { standalone: true });
      }
    });
    return true;
  }
  function renderMarkdownBlocks() {
    const blocks = Array.from(document.querySelectorAll("pre > code.language-sankey"));
    blocks.forEach((code) => {
      if (code.dataset.sankeyRendered === "true") {
        return;
      }
      code.dataset.sankeyRendered = "true";
      const pre = code.parentElement;
      const host = document.createElement("div");
      host.className = "sankey-preview-host";
      pre.replaceWith(host);
      renderInto(host, code.textContent || "", DEFAULT_LIMITS, { standalone: false });
    });
  }
  function start() {
    injectStyles();
    if (!renderStandalone()) {
      renderMarkdownBlocks();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
