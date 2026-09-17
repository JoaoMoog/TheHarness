# Implementation plan: File import and data page

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: the 3 MB and 5,000-row limits stay; deleting a referenced source is allowed
and its analyses show `Fonte indisponível` where the source name appears; duplicate
file names are allowed; non-UTF-8 text is refused as unrecognised; no cap on sources
per workspace. A different answer changes the marked steps only.

## Approach

A two-step upload: `POST /api/imports` receives the multipart file, sniffs, parses
through a reader registry keyed by kind, validates every row with 002's row schema
and stores the validated rows in an `uploads` table with a 30-minute expiry, answering a
preview and an `uploadId`; `POST /api/imports/:id/confirm` creates the source and the
analysis in one transaction and records their ids on the upload row, so a second
confirm returns the same ids (FR-00822). The delimited parser is a hand port of the
prototype's `parseDelimited`/`rowsFromTable`/`validateRows`; XLSX is read with
`exceljs` (first worksheet, dimensions checked before iterating cells). Rejected:
parsing in the browser and posting rows — two validation paths and the prototype's
weakest point (a tampered client could post anything). Rejected: SheetJS — more
common, but its npm release cadence and licence are the maintenance concern recorded
in `_decisions.md`; `exceljs` reads the first sheet and native dates without them.
Rejected: keeping the pending preview in memory — lost on restart and unusable with
more than one instance; a table row with an expiry costs one migration.

## Reuse found

- `requireUser`, `HttpError`, `jsonError` (planned in 005-authentication);
  `assertCan`, `requireWorkspace`, `parseBody` (planned in 006-workspaces-and-roles).
- `createSource`, `listSources`, `getSource`, `getSourceRows` in `src/server/repos/sources.ts`
  and `createAnalysis` in `src/server/repos/analyses.ts` (planned in
  007-analyses-and-sources-persistence): confirm reuses both; `SourceKindSchema` in
  `src/core/schema/source.ts` is widened here.
- `RowSchema` (planned in 002-domain-schema), `money` from `src/core/format`
  (002), the demonstration generator `src/core/demo` (002) for the sample CSV,
  `normalizeText` from `src/core/text/normalize.ts` (007) for header matching.
- `Modal.tsx`, `Toast.tsx`, `Explorer.tsx` (planned in 001-app-skeleton), `dados/page.tsx`
  placeholder (001).
- Genuinely new: everything under `src/server/import`, the `uploads` table, the import
  routes, the sample CSV writer, the data page components and the explorer sources block.

## Files

| File | Change |
|---|---|
| `package.json` | modified: dependency `exceljs` |
| `src/server/db/migrations/0004_import.sql`, `0004_import.down.sql` | created: `uploads(id, workspace_id, user_id, file_name, row_count, rows jsonb, created_at, expires_at, source_id, analysis_id)` with a unique constraint on `source_id`; down drops the table — data loss: pending previews only |
| `src/server/db/schema/imports.ts` | created: Drizzle definition |
| `src/server/db/schema/index.ts` | modified: export `imports` |
| `src/core/schema/source.ts` | modified: `SourceKindSchema` declared as the registry's key type (`"demo" \| "file"`, later `"sap"`) |
| `src/server/import/sniff.ts` | created: `sniffKind(buffer)` → `"xlsx" \| "text"` (ZIP local-file-header signature `PK` followed by bytes 3 and 4, plus an `xl/workbook.xml` entry; text decoded as UTF-8 with `fatal: true`) |
| `src/server/import/delimited.ts` | created: `parseDelimited(text)` — BOM strip, delimiter sniff, quotes, line endings, blank lines, unterminated-quote error |
| `src/server/import/xlsx.ts` | created: `readFirstSheet(buffer)` — dimension guard, first worksheet, native dates → `AAAA-MM-DD`, numbers as numbers |
| `src/server/import/mapColumns.ts` | created: header matching with `normalizeText`, number parsing (`R$`, spaces, comma decimal) |
| `src/server/import/validateRows.ts` | created: prototype's row rules through `RowSchema`, line-numbered messages, empty and cap checks in the prototype's order |
| `src/server/import/readers.ts` | created: `readers: Partial<Record<SourceKind, Reader>>` where `Reader = (buffer) => Table`; `"demo"` has no reader (seeded); adding a kind means adding an entry |
| `src/server/import/index.ts` | created: `parseUpload(buffer, fileName) → { rows, rowCount, totalActual, sample }` or throws `ImportError(message)`; `ImportError` maps to 400 `code: "import_invalid"` |
| `src/server/import/sampleCsv.ts` | created: `sampleCsv()` — BOM, `;`, CRLF, quoted fields, comma decimals, Tecnologia rows |
| `src/server/import/fileName.ts` | created: `validateFileName(name)` — separators, control characters, length |
| `src/server/repos/uploads.ts` | created: `createUpload`, `getUpload`, `confirmUpload(tx, id, { sourceId, analysisId })` |
| `src/server/repos/sources.ts` | modified: `softDeleteSource(id)` refusing kind `demo`; `getSource` and `getSourceRows` return 404 for deleted |
| `src/app/api/imports/route.ts` | created: `POST` multipart → 200 preview `{ data: { uploadId, rowCount, totalActual, sample } }` or 400 with the pt-BR message; size checked from `content-length` and the buffer before parsing |
| `src/app/api/imports/[uploadId]/confirm/route.ts` | created: `POST` → 201 `{ data: { sourceId, analysisId } }`, idempotent, 410 when expired |
| `src/app/api/sources/[sourceId]/route.ts` | created: `DELETE` → 204; 409 `demo_source` for the demonstration source |
| `src/app/api/sources/sample/route.ts` | created: `GET` → `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="prometeu-exemplo.csv"` |
| `src/app/(shell)/dados/page.tsx` | modified: loads sources and renders `SourcesPage` |
| `src/app/(shell)/layout.tsx` | modified: passes the workspace's sources to the explorer |
| `src/ui/sources/SourcesPage.tsx` | created: heading, the three cards, the privacy callout and the `Biblioteca de fontes` table |
| `src/ui/sources/ImportDialog.tsx` | created: client island posting `FormData`, preview and error states in a polite live region, confirm and navigate |
| `src/ui/sources/SourceDialogs.tsx`, `sources.module.css` | created: `Conexão SAP · demonstração` and `Modelo de custos` dialogs ported from the prototype, `Excluir fonte?` dialog; styles |
| `src/ui/shell/Explorer.tsx` | modified: renders `ExplorerSources` |
| `src/ui/shell/ExplorerSources.tsx` | created: `Fontes` block, `Adicionar fonte` opening the import dialog |
| `src/server/import/delimited.test.ts`, `xlsx.test.ts`, `mapColumns.test.ts`, `validateRows.test.ts`, `sniff.test.ts`, `sampleCsv.test.ts`, `fileName.test.ts`, `index.test.ts` | created: one test per error string and rule; fixtures under `src/server/import/__fixtures__/` (small CSV/TXT/XLSX files, a 5,001-row CSV generated in the test) |
| `src/server/repos/uploads.test.ts` | created: expiry, idempotent confirm, unique source per upload |
| `src/app/api/imports/imports.test.ts` | created: preview, confirm, idempotent confirm, expiry, Leitor 403, size refusal |
| `src/ui/sources/ImportDialog.test.tsx`, `SourcesPage.test.tsx` | created: dialog strings and states, table rows and delete visibility |
| `tests/e2e/008-file-import-and-data-page.spec.ts` | created: download sample, import it, preview of 30 rows, confirm lands on the analysis, delete a source, axe |

## Contracts

- `POST /api/imports` (multipart, field `file`) → `200 { data: { uploadId, rowCount, totalActual, sample: [{ area, category, actual }] (3) } }`;
  `400 { error: { code: "import_invalid", message: <one of the spec's pt-BR messages> } }`;
  `413 { error: { code: "too_large", message: "O arquivo excede 3 MB." } }`.
- `POST /api/imports/:uploadId/confirm` → `201 { data: { sourceId, analysisId } }` on
  first call and on every repeat; `410 { error: { code: "upload_expired", message: "A prévia expirou. Envie o arquivo novamente." } }`.
- `DELETE /api/sources/:id` → 204; `409 { error: { code: "demo_source", message: "A fonte de demonstração não pode ser removida." } }`.
- `GET /api/sources/sample` → the CSV file (FR-00829).
- `Reader = (buffer: Uint8Array) => string[][]`; `readers` keyed by `SourceKind`; the
  rows endpoint and analysis creation of 007 never read `kind` except for labels
  (FR-00834); a SAP kind later adds a reader and a `kind` value only.
- `ImportError` carries the pt-BR message and, for row errors, `line`.
- `Explorer.tsx` gains a `sources` prop (breaking for 006's call site in
  `(shell)/layout.tsx`, updated in the same task).
- The privacy callout text (new): `Os arquivos são processados no servidor, dentro do seu workspace. Nada é enviado ao SAP nem a um serviço de IA.`

## Order of work

1. Confirm the reused files exist as described (`repos/sources.ts`, `repos/analyses.ts`,
   `src/core/schema/source.ts`, `RowSchema`, `src/core/demo`, `normalizeText`,
   `Explorer.tsx`, `dados/page.tsx`); if not, return blocked. Green: tree unchanged.
2. Migration `0004_import`, `imports.ts` definition, `uploads` repository, `softDelete`
   on sources. Green: migration applied; repository tests for expiry and idempotent
   confirm.
3. Delimited reader, sniffing, column mapping, file-name check. Green: unit tests for
   every delimiter, BOM, quotes, CRLF, unterminated quote, missing column, number forms.
4. XLSX reader with `exceljs` (dependency added here) and row validation with the
   prototype's messages and order; then the registry, `parseUpload` and the sample CSV.
   Green: fixture tests for FR-00809–FR-00819, FR-00829; NFR-00801–NFR-00803 measured
   in a timing test. (Marked: limits depend on the first open question.)
5. Import routes, sample CSV route, source delete route. Green: handler tests for
   preview, confirm twice, expiry, 413, 403, demo delete refusal; contract test from
   005 still green.
6. Data page, dialogs, explorer sources block, e2e round trip with the sample file and
   axe. Green: `npm run test:e2e`; NFR-00805 zero serious/critical.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A 3 MB file read fully into memory per request under concurrency | memory pressure | size checked from `content-length` first; body read once into one buffer; NFR-00803 measured; at most 2 concurrent imports per instance via the in-memory limiter from `_decisions.md` |
| `exceljs` loads the whole workbook before the dimension guard | a crafted 3 MB XLSX expands to hundreds of MB | read the sheet's `dimension` from the streamed reader first; refuse above 10,000 × 100 before cell iteration; a fixture with an absurd declared range |
| Extension/content mismatch: a `.csv` that is a ZIP | parser confusion | FR-00803 sniffs content; the dialog's `accept` is a hint only |
| Line numbers in messages drift from the prototype (header counted as line 1) | users cannot find the row | golden test with the prototype's `i + 2` rule on a fixture with a blank line |
| Two confirms race and create two sources | duplicate source | confirm runs in a transaction with `SELECT … FOR UPDATE` on the upload row; unique constraint on `uploads.source_id` |
| Sample CSV differs from the prototype's byte for byte | round-trip test breaks, users diff files | golden test compares the first bytes (BOM), header, one row and CRLF |

## Human approval required

Step 2 applies a schema migration and adds source deletion (soft); step 4 adds a
dependency to the manifest; step 5 exposes the upload boundary. A human runs step 2
with the agent assisting, confirms step 4 before it runs, and reviews step 5 before
merge. No authentication or cryptography changes.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
AUTH_TEST_LOGIN=1 npm run test:e2e
curl -s -o exemplo.csv localhost:3000/api/sources/sample && head -c 3 exemplo.csv | xxd   # ef bb bf
node .github/tools/spec/traceability.mjs --spec=specs/008-file-import-and-data-page
```

A pass: every command exits 0; importing `prometeu-exemplo.csv` shows
`30 registros válidos.`, confirming opens `/dashboard/<new id>` titled
`Análise · prometeu-exemplo.csv` with the toast; confirming again returns the same
ids; a file with a bad date on line 4 shows `Linha 4: use uma data válida no formato
AAAA-MM-DD.`; the demo source's delete answers 409; `/dados` lists the new source
under `Biblioteca de fontes`.
