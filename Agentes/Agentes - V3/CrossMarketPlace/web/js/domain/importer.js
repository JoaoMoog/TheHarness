// Structured import of a solution from JSON or a simple YAML subset (key: value, key: [a, b], "- item" lists).
import { ACCESS, CATEGORY_IDS, LIFECYCLES } from "./constants.js";

const NAME = { min: 3, max: 80 };
const SUMMARY = { min: 10, max: 300 };

const unquote = (v) => v.replace(/^["']|["']$/g, "").trim();

function parseYaml(text) {
  const out = {};
  let listKey = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { out[listKey] = [...out[listKey], unquote(item[1])]; continue; }
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!pair) throw new Error(`Linha não reconhecida: "${line.trim()}"`);
    const [, key, value] = pair;
    if (value === "") { out[key] = []; listKey = key; continue; }
    listKey = null;
    const inline = /^\[(.*)\]$/.exec(value);
    out[key] = inline ? inline[1].split(",").map(unquote).filter(Boolean) : unquote(value);
  }
  return out;
}

function readDocument(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return parseYaml(trimmed);
}

function validate(doc) {
  const errors = {};
  const name = String(doc.name ?? "").trim();
  const summary = String(doc.summary ?? "").trim();
  if (name.length < NAME.min || name.length > NAME.max) errors.name = `O nome deve ter entre ${NAME.min} e ${NAME.max} caracteres.`;
  if (!summary) errors.summary = "A descrição é obrigatória.";
  else if (summary.length < SUMMARY.min || summary.length > SUMMARY.max) errors.summary = `A descrição deve ter entre ${SUMMARY.min} e ${SUMMARY.max} caracteres.`;
  if (!CATEGORY_IDS.includes(doc.category)) errors.category = `Use uma categoria válida: ${CATEGORY_IDS.join(", ")}.`;
  const tags = Array.isArray(doc.tags) ? doc.tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean) : [];
  if (!tags.length) errors.tags = "Informe ao menos uma tag.";
  if (doc.access !== undefined && !(doc.access in ACCESS)) errors.access = "Acesso deve ser direto ou autorizacao.";
  if (doc.lifecycle !== undefined && !(doc.lifecycle in LIFECYCLES)) errors.lifecycle = `Ciclo de vida deve ser: ${Object.keys(LIFECYCLES).join(", ")}.`;
  return { errors, value: { ...doc, name, summary, tags } };
}

/**
 * Returns { ok: true, value } or { ok: false, errors } with messages in Portuguese.
 * @param {string} text
 * @returns {{ ok: boolean, value?: any, errors?: Record<string, string> }}
 */
export function parseImport(text) {
  if (!String(text ?? "").trim()) return { ok: false, errors: { _: "Cole o conteúdo em JSON ou YAML." } };
  let doc;
  try {
    doc = readDocument(String(text));
  } catch (error) {
    return { ok: false, errors: { _: `Não foi possível ler o arquivo: ${error.message}` } };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, errors: { _: "O conteúdo deve descrever uma única solução." } };
  const { errors, value } = validate(doc);
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
