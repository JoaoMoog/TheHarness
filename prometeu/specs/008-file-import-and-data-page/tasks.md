# Tasks: File import and data page

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | migration `0004_import` with down and data-loss note, Drizzle table, uploads repository, source soft delete with the demo refusal | FR-00822, FR-00823, FR-00831, FR-00832 | `src/server/db/migrations/0004_import.sql`, `0004_import.down.sql`, `src/server/db/schema/imports.ts`, `src/server/db/schema/index.ts`, `src/server/repos/uploads.ts`, `src/server/repos/sources.ts`, `src/server/repos/uploads.test.ts` | migration applied on `DATABASE_URL_TEST`; FR-00822, FR-00823, FR-00831, FR-00832 repository tests | - | | Q4 |
| T2 | delimited reader, content sniffing, column mapping and number parsing, file-name check | FR-00803, FR-00804, FR-00805, FR-00806, FR-00807, FR-00808, FR-00811, FR-00812, FR-00813, FR-00814, FR-00824 | `src/server/import/sniff.ts`, `src/server/import/delimited.ts`, `src/server/import/mapColumns.ts`, `src/server/import/fileName.ts`, `src/server/import/sniff.test.ts`, `delimited.test.ts`, `mapColumns.test.ts`, `fileName.test.ts` | one unit test per requirement id with fixtures | - | P | Q1 |
| T3 | XLSX reader with `exceljs`, row validation with the prototype's messages, source kind type | FR-00809, FR-00810, FR-00815, FR-00816, FR-00817, FR-00818, FR-00819, NFR-00802 | `package.json`, `src/server/import/xlsx.ts`, `src/server/import/validateRows.ts`, `src/core/schema/source.ts`, `src/server/import/xlsx.test.ts`, `validateRows.test.ts` | fixture tests per id, including the absurd-dimension workbook; NFR-00802 timing printed | - | P | Q3 |
| T4 | reader registry, `parseUpload`, sample CSV writer | FR-00801, FR-00829, FR-00830, FR-00834, NFR-00801, NFR-00803 | `src/server/import/readers.ts`, `src/server/import/index.ts`, `src/server/import/sampleCsv.ts`, `src/server/import/index.test.ts`, `sampleCsv.test.ts` | FR-00830 round trip of the sample through `parseUpload`; FR-00834 test adds a fake kind without touching consumers; NFR-00801, NFR-00803 measured | T2, T3 | | Q1 |
| T5 | import preview and confirm routes, sample route, source delete route | FR-00801, FR-00802, FR-00820, FR-00821, FR-00822, FR-00823, FR-00825, FR-00832, NFR-00804 | `src/app/api/imports/route.ts`, `src/app/api/imports/[uploadId]/confirm/route.ts`, `src/app/api/sources/[sourceId]/route.ts`, `src/app/api/sources/sample/route.ts`, `src/app/api/imports/imports.test.ts` | handler tests with multipart `Request`s: 200 preview under 8 KB, 413, 400 messages, 201 twice with the same ids, 410, 403, 409 | T1, T4 | | Q2 |
| T6 | data page with cards, callout and sources table, import dialog with live region, SAP, model and delete dialogs | FR-00826, FR-00827, FR-00828, FR-00831 | `src/app/(shell)/dados/page.tsx`, `src/ui/sources/SourcesPage.tsx`, `src/ui/sources/ImportDialog.tsx`, `src/ui/sources/SourceDialogs.tsx`, `src/ui/sources/sources.module.css`, `src/ui/sources/ImportDialog.test.tsx`, `SourcesPage.test.tsx` | FR-00826, FR-00828 unit tests; FR-00827, FR-00831 e2e in T7 | T5 | | Q1 |
| T7 | explorer `Fontes` block, layout passing sources, end-to-end round trip with the sample file, delete flow, axe | FR-00833, FR-00820, FR-00821, FR-00829, FR-00830, FR-00831, NFR-00805 | `src/ui/shell/Explorer.tsx`, `src/ui/shell/ExplorerSources.tsx`, `src/app/(shell)/layout.tsx`, `tests/e2e/008-file-import-and-data-page.spec.ts` | FR-00833 unit render; e2e green; downloaded file starts with `EF BB BF`; preview reads `30 registros válidos.`; axe zero serious/critical | T6 | | Q1 |

T1 is Q4 because it applies a schema migration and adds a deletion (soft, so the
repository logic itself is reversible). T3 is Q3 because it adds `exceljs` to the
dependency manifest: state the plan, wait for yes. T5 is Q2 because it exposes the
upload boundary and is reviewed before merge. Seven tasks because the two readers
(T2, T3) and the registry (T4) each verify with fixtures alone and must stay under
four files, and the upload boundary (T5) is kept apart from the page (T6); T2 and T3
share no file and both start at once.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no SAP connector (only the
      registry seam), no row editing or appending, no CSV export, no non-UTF-8 text,
      the `Modelos de dados` card still a placeholder, the five open questions and the
      assumptions (limits kept, referenced sources deletable with `Fonte indisponível`,
      duplicate names allowed, non-UTF-8 refused, no cap) the plan took for them.
