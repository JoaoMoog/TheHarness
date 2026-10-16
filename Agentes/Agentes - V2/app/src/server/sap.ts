import { z } from 'zod';
import { MAX_BYTES, MAX_ROWS, parseFile } from '@/core/import';
import type { ImportSample } from '@/core/types';
import { HttpError } from './auth';

export const sapMappingSchema = z.object({
  name: z.string().trim().min(1).max(100), metricKey: z.string(), groupBy: z.string(),
  dateColumn: z.string().nullable().default(null), budgetMetric: z.string().nullable().default(null),
  unit: z.enum(['BRL', 'number']), operation: z.enum(['sum', 'average', 'count']),
  rule: z.object({ column: z.string(), value: z.string() }).strict().nullable().default(null),
}).strict();
export function sapConfiguration() { return { configured: !!process.env.SAP_READ_URL, mode: process.env.SAP_READ_URL ? 'read-only' : 'demo' }; }
type Options = { url?: string; token?: string; fetcher?: typeof fetch; signal?: AbortSignal };
/** Server-configured endpoint only. UI supplies no URL or credential. All requests are GET and redirects fail closed. */
export async function readSapSample(options: Options = {}): Promise<ImportSample> {
  const endpoint = options.url ?? process.env.SAP_READ_URL;
  if (!endpoint) throw new HttpError(503, 'A conexão SAP de leitura ainda não foi configurada. Os exemplos continuam disponíveis.');
  let base: URL;
  try { base = new URL(endpoint); } catch { throw new HttpError(503, 'A configuração SAP precisa de um endereço válido.'); }
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new HttpError(503, 'Use HTTPS na conexão SAP e configure a credencial separadamente.');
  const token = options.token ?? process.env.SAP_READ_TOKEN;
  const fetcher = options.fetcher ?? fetch;
  const records: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let next: URL | null = base, totalBytes = 0;
  const timeout = AbortSignal.timeout(30000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    while (next) {
      // Follow only the same collection: prevents credential forwarding to another host/path through nextLink.
      if (next.origin !== base.origin || next.pathname !== base.pathname || next.username || next.password || seen.has(next.href) || seen.size >= 25) throw new HttpError(502, 'A paginação SAP está inválida ou excedeu 25 páginas. Reduza o recorte na conexão.');
      seen.add(next.href);
      const response = await fetcher(next.href, { method: 'GET', redirect: 'error', headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal });
      if (!response.ok) throw new HttpError(502, 'O SAP não respondeu à consulta de leitura. Confira a conexão e a permissão do usuário técnico.');
      if (Number(response.headers.get('content-length')) > MAX_BYTES - totalBytes) throw new HttpError(413, 'A resposta SAP excedeu 8 MB. Reduza o recorte na conexão.');
      if (!response.body) throw new HttpError(502, 'O SAP retornou uma resposta vazia.');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          totalBytes += chunk.value.byteLength;
          if (totalBytes > MAX_BYTES) { await reader.cancel(); throw new HttpError(413, 'A resposta SAP excedeu 8 MB. Reduza o recorte na conexão.'); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const text = Buffer.concat(chunks).toString('utf8');
      let payload: unknown;
      try { payload = JSON.parse(text); } catch { throw new HttpError(502, 'O SAP não retornou JSON válido. Confira o endereço da coleção.'); }
      const object = payload as { value?: unknown; '@odata.nextLink'?: unknown; d?: { results?: unknown; __next?: unknown } };
      const rows = Array.isArray(payload) ? payload : object?.value ?? object?.d?.results;
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new HttpError(502, 'Use uma lista JSON ou coleção OData de registros no SAP.');
      for (const row of rows) {
        const clean = Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('@odata.') && key !== '__metadata'));
        if (Object.values(clean).some(value => value !== null && typeof value === 'object')) throw new HttpError(502, 'A coleção SAP contém campos aninhados. Configure uma projeção de colunas simples.');
        records.push(clean);
      }
      if (records.length > MAX_ROWS) throw new HttpError(413, 'A consulta SAP excedeu 20 mil registros. Reduza o recorte na conexão.');
      const link = !Array.isArray(payload) ? object?.['@odata.nextLink'] ?? object?.d?.__next : undefined;
      if (link != null && typeof link !== 'string') throw new HttpError(502, 'O SAP retornou uma paginação inválida.');
      next = typeof link === 'string' && link ? new URL(link, next) : null;
    }
    if (!records.length) throw new HttpError(400, 'Nenhum registro veio do SAP. Ajuste o recorte da conexão.');
    try { return parseFile(Buffer.from(JSON.stringify(records)), 'SAP.json'); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Confira os campos da coleção SAP.'); }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (signal.aborted) throw new HttpError(504, 'A consulta SAP foi cancelada ou excedeu 30 segundos. Tente um recorte menor.');
    throw new HttpError(502, 'Não foi possível consultar o SAP. Confira o endereço, a credencial e a disponibilidade da conexão.');
  }
}
