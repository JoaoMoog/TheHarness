/**
 * Minimal YAML-subset front matter parser. The harness owns every file it
 * parses, so supporting scalars, inline lists and block lists is enough; a full
 * YAML dependency would buy nothing here.
 */
const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SPLIT_LINES = /\r?\n/;
// A heading inside a fenced block is example output, not a section. Without
// this the four-section contract is satisfied by a code sample.
const FENCE_RE = /^\s*(```|~~~)/;

/** Splits on commas that are outside quotes and outside braces. */
function splitInline(text) {
  const parts = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '{' || ch === '[') {
      depth += 1;
      current += ch;
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

function coerce(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^\[.*\]$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : splitInline(inner).map((x) => coerce(x));
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseFrontmatter(text) {
  const match = FENCE.exec(text);
  if (!match) return { data: {}, body: text, hasFrontmatter: false };

  const data = {};
  let currentKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(coerce(item[1]));
      continue;
    }
    const pair = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    currentKey = pair[1];
    const raw = pair[2].trim();
    if (raw === '') data[currentKey] = [];
    else if (currentKey === 'version') data[currentKey] = raw.replace(/^['"]|['"]$/g, '');
    else data[currentKey] = coerce(raw);
  }
  return { data, body: text.slice(match[0].length), hasFrontmatter: true };
}

/** Headings used to validate the mandatory section contracts. */
export function headings(body, level = 2) {
  const prefix = '#'.repeat(level) + ' ';
  const found = [];
  let inFence = false;
  for (const line of body.split(SPLIT_LINES)) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.startsWith(prefix)) found.push(line.slice(prefix.length).trim());
  }
  return found;
}
