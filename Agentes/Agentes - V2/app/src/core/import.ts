import * as XLSX from 'xlsx';
import type { Cell, ImportSample } from './types';

export const MAX_ROWS = 20000;
export const MAX_BYTES = 8 * 1024 * 1024;
export const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function cell(value: unknown): Cell {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(+value) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim();
  const brazilianDate = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const isoDate = brazilianDate ? `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}` : str;
  if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(isoDate)) {
    const full = isoDate.length === 7 ? `${isoDate}-01` : isoDate;
    const date = new Date(`${full}T00:00:00Z`);
    if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== full) throw new Error(`A data “${str}” não é válida. Corrija o arquivo e importe novamente.`);
    return isoDate;
  }
  // Brazilian and plain numeric values; identifiers with leading zeros remain text.
  if (/^0\d+$/.test(str)) return str;
  if (/^-?\d+(?:\.\d+)?$/.test(str)) return Number(str);
  if (/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d+$/.test(str)) return Number(str.replace(/\./g, '').replace(',', '.'));
  if (str.length > 1000) throw new Error('Uma célula contém mais de mil caracteres. Reduza o texto e importe novamente.');
  return str;
}

export function parseFile(bytes: Uint8Array, name: string): ImportSample {
  if (bytes.length > MAX_BYTES) throw new Error('O arquivo deve ter no máximo 8 MB. Divida a planilha e tente novamente.');
  const ext = name.toLowerCase().split('.').pop();
  if (!['csv', 'xlsx', 'json'].includes(ext || '')) throw new Error('Use um arquivo CSV, XLSX ou JSON.');
  let records: unknown[][];
  if (ext === 'json') {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(data) || !data.length || data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('O JSON precisa ser uma lista de registros com colunas e valores.');
    }
    const keys = [...new Set(data.flatMap(row => Object.keys(row)))];
    records = [keys, ...data.map(row => keys.map(key => row[key]))];
  } else {
    let content: string | Uint8Array = bytes;
    if (ext === 'csv') {
      // UTF-8 is the default; legacy Excel exports commonly use Windows-1252.
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { content = new TextDecoder('windows-1252').decode(bytes); }
    }
    const book = XLSX.read(content, { type: ext === 'csv' ? 'string' : 'array', cellDates: true, raw: ext === 'csv', sheetRows: MAX_ROWS + 2 });
    if (book.SheetNames.length !== 1) throw new Error('Selecione uma única aba: salve a aba desejada em um novo arquivo e importe novamente.');
    records = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
  }
  if (records.length < 2) throw new Error('O arquivo está vazio. Inclua uma linha de cabeçalhos e ao menos um registro.');
  if (records.length > MAX_ROWS + 1) throw new Error('O limite desta demonstração é de 20 mil registros por arquivo.');
  const headers = records[0].map(v => String(v ?? '').trim());
  if (!headers.length || headers.length > 256 || headers.some(h => !h || h.length > 100)) {
    throw new Error('Use até 256 colunas, todas com um nome de até 100 caracteres.');
  }
  if (new Set(headers.map(normalized)).size !== headers.length) throw new Error('Existem colunas com o mesmo nome. Renomeie-as antes de importar.');
  if (records.slice(1).some(row => row.length > headers.length && row.slice(headers.length).some(v => v != null && v !== ''))) throw new Error('Algumas linhas têm mais valores que os cabeçalhos. Confira os separadores do arquivo.');
  const rows = records.slice(1).map(row => Object.fromEntries(headers.map((_, i) => [`field${i}`, cell(row[i])])));
  const columns = headers.map((label, i) => {
    const key = `field${i}`;
    const values = rows.map(row => row[key]).filter(v => v != null);
    const type = values.length && values.every(v => typeof v === 'number') ? 'number'
      : values.length && values.every(v => typeof v === 'string' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(v)) ? 'date' : 'text';
    return { key, label, type: type as 'number' | 'date' | 'text' };
  });
  if (columns.every(c => c.type === 'number')) {
    columns.push({ key: 'record', label: 'Registro', type: 'text' });
    rows.forEach((row, i) => { row.record = String(i + 1); });
  }
  return { name: name.replace(/\.[^.]+$/, ''), columns, rows };
}
