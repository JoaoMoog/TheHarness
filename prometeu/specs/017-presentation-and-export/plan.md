# Implementation plan: Presentation and export

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: no anonymous links; CSV numbers keep the prototype's pt-BR comma; the
HTML export is refused above 16 MB and is buffered, not streamed; visibility is
workspace membership with no per-analysis list; the shared link carries the page
only, not the filters. A different answer changes the marked steps only.

## Approach

One React component, `Slide`, renders a page as a deck slide from a document, the
rows and the filters in effect, using 009's SVG renderers with an explicit width; the
overlay renders it in the browser and the HTML export route renders the same component
on the server with `renderToStaticMarkup`, wraps the pages in a fixed shell (inline
styles, a 20-line inline navigation script, no external references) and returns the
file as an attachment. The client sends the filters in effect (dashboard, page,
widget, cross-filter) with the request so that the server's 003 engine computes the
same numbers the canvas shows. CSV is written on the server from the same selection.
Sharing is a plain URL to `/dashboard/{analysisId}?pagina={pageId}`; the dashboard
page (planned in 010) already enforces membership, so the share dialog adds no rule.
Rejected: serialising the client's rendered DOM into the export as the prototype did —
it would bundle the studio's markup and CSS modules, depend on the viewer's viewport
and break the "no application code in the file" goal. Rejected: server-side PDF via a
headless browser — a heavy dependency for a flow the print stylesheet already serves.

## Reuse found

- `src/ui/charts/*` (planned in 009-svg-charts): every renderer takes `width` and data
  and is renderable with `renderToStaticMarkup`; the export passes a fixed slide width.
- `src/core/engine` (planned in 003-query-engine): `resolveFilters`, `chartData`,
  `selectRows`; the export computes on the server with the client's filters.
- `src/core/format` (planned in 002): pt-BR number formatting shared by canvas and export.
- `src/ui/studio/store.ts`, `Canvas.tsx`, `WidgetCard.tsx` (planned in 010): `Slide`
  composes `WidgetCard` in a `presentation` mode that hides selection chrome and handles.
- `src/ui/studio/filters` (planned in 013): the effective-filter resolution and the
  cross-filter state the export request carries; `ButtonWidget` navigation.
- `src/ui/shell/Toolbar.tsx` (planned in 001, wired by 010/011): the buttons
  `Apresentar`, `Exportar`, `Compartilhar` exist; this plan wires their handlers.
- `src/ui/shell/Modal.tsx`, `ToastProvider.tsx` (001); `src/styles/globals.css` (001)
  holds a print base that this plan extends in a separate file.
- `src/server/auth/requireUser.ts` (005), `src/server/authz/assertCan.ts` (006) with the
  `analysis:read` action for members; `src/server/repos/analyses.ts`, `sources.ts`
  (007) for the document and rows; `src/server/http` for the envelope.
- `src/app/(shell)/dashboard/[analysisId]/page.tsx` (planned in 010): already 404s
  non-members and redirects anonymous visitors preserving the return path (005); this
  plan adds the `pagina` search parameter.
- Genuinely new: `Slide`, the overlay, the export shell and CSV writer, the two export
  routes, the three dialogs, the print stylesheet and the e2e file.

## Files

| File | Change |
|---|---|
| `src/ui/studio/Slide.tsx`, `Slide.module.css` | created: deck title, page heading, `{área} · {período}`, 12-column grid of `WidgetCard` in presentation mode, footer source line; pure props, no store |
| `src/ui/studio/Presentation.tsx`, `Presentation.module.css` | created: overlay with `role="dialog"`, `aria-modal`, focus trap, `inert` on the shell, arrows, Escape, counter, `Baixar HTML`, `Sair`, button-widget jumps |
| `src/ui/studio/ExportDialog.tsx` | created: `Leve sua análise com você` with the three choices, print trigger, download calls, error toast |
| `src/ui/studio/ShareDialog.tsx` | created: `Compartilhar uma descoberta`, link, `Copiar link`, clipboard fallback, visibility statement with the workspace name |
| `src/ui/shell/Toolbar.tsx` | modified: `Apresentar`, `Exportar`, `Compartilhar` open the overlay and dialogs (shared file planned in 001) |
| `src/styles/print.css` | created: `@page A4 landscape 10mm`, hidden chrome, 12-column grid with `break-inside: avoid`, footer shown |
| `src/app/layout.tsx` | modified: imports `print.css` (shared file planned in 001) |
| `src/app/(shell)/dashboard/[analysisId]/page.tsx` | modified: reads `pagina` and passes the initial active page, falling back to the first page (shared file planned in 010) |
| `src/server/export/html.ts`, `html.test.ts` | created: `renderPresentation(analysis, rows, filters)` → string; `renderToStaticMarkup` of `Slide` per page, shell with inline styles and navigation script, size check |
| `src/server/export/presentationStyles.ts` | created: the export's CSS as a string constant (ported from the prototype's `proPresentationCSS`) |
| `src/server/export/csv.ts`, `csv.test.ts` | created: `writeCsv(rows)` → string with BOM, `;`, CRLF, quoting, two decimals with comma |
| `src/app/api/analyses/[analysisId]/export/html/route.ts` | created: POST `{ filters }` → `text/html` attachment `prometeu-apresentacao.html` |
| `src/app/api/analyses/[analysisId]/export/csv/route.ts` | created: POST `{ selection }` → `text/csv` attachment `prometeu-dados.csv` |
| `tests/e2e/017-presentation-and-export.spec.ts` | created: overlay navigation and trap, exports and their files, offline open of the HTML with request counting, print media emulation, share link as member, non-member and anonymous, axe |

## Contracts

- `Slide` props: `{ analysis: { title, area, period, sourceName }, page, document, rows, filters, width, mode: 'overlay' | 'export' }`; in `export` mode filter controls render `disabled` and button widgets carry `data-slide-jump="{pageId}"`.
- `POST /api/analyses/{analysisId}/export/html` body `{ filters: { dashboard, pages: { [pageId]: … }, widgets: { [widgetId]: … }, crossFilter? } }` (shapes from 013's filter schema in 002) → `200` `Content-Type: text/html; charset=utf-8`, `Content-Disposition: attachment; filename="prometeu-apresentacao.html"`; `413 export_too_large` with `A apresentação excede 16 MB. Reduza as imagens e tente novamente.`; `404 not_found`; `500 export_failed`.
- `POST /api/analyses/{analysisId}/export/csv` body `{ selection: { period, area, categories } }` → `200` `text/csv; charset=utf-8`, attachment `prometeu-dados.csv`; an empty selection returns the header only with `200` and the client shows the toast.
- Share link: `{origin}/dashboard/{analysisId}?pagina={pageId}`; unknown `pagina` falls back to the first page; membership and sign-in redirect are 010's and 005's existing behaviour.
- Export file: sections `<section class="slide" id="{pageId}" hidden>` in page order, nav `#prev`, `#count`, `#next`, `[data-slide-jump]`; `<select>` rendered `disabled`.
- Nothing breaking; the dashboard page gains an optional search parameter.

## Order of work

1. Confirm the reused files exist as described (009 renderers take `width` and render
   statically, `WidgetCard` accepts a presentation mode or can be given one, 013's filter
   resolution and schema, `Toolbar.tsx` buttons, the dashboard page's membership check
   and return-path redirect, `analysis:read` in the matrix); if not, return blocked.
   Green: nothing changes.
2. `Slide` with a component test rendering a page in both modes, then the overlay
   (wired to the toolbar in step 6). Green: FR-01701 to FR-01707, FR-01724 (overlay for a
   reader) and NFR-01703 tests pass.
3. CSV writer and HTML renderer in `src/server/export` with unit tests (golden CSV,
   static markup containing no `http` reference, size check). Green: FR-01712,
   FR-01713 (markup), FR-01714 (numbers equal engine output), FR-01716, FR-01717,
   FR-01727 tests pass.
4. Export routes with `requireUser` + `assertCan(analysis:read)`, filters parsed with
   the schema. Green: FR-01711 (response headers), FR-01715, FR-01725, FR-01726
   (500 path), NFR-01701, NFR-01702 route tests pass.
5. Export dialog, print stylesheet and layout import. Green: FR-01708, FR-01709, FR-01710 (print media test), FR-01711 and FR-01715
   (download and toast) component tests pass.
6. Share dialog, `pagina` parameter on the dashboard page, toolbar wiring of
   `Apresentar`, `Exportar` and `Compartilhar`. Green: FR-01718 to FR-01723 and
   FR-01724 tests pass.
7. e2e file: overlay by keyboard, both downloads opened from disk with network
   blocked, print emulation, share link as three actors, axe. Green: `npm run test:e2e`
   passes; NFR-01704, NFR-01705 covered; traceability shows every id.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 009 renderers read width from a ResizeObserver only, with no `width` prop | server render produces zero-width SVG | step 1 checks; if so, the plan adds a `width` prop to the shared frame in 009's file and records it as a shared-file change |
| Client and server compute different numbers because the export request omits a filter level (cross-filter, inherited page filters) | FR-01714 fails | the request carries the resolved filter object 013 already keeps in the store; a test exports with all four levels set and compares to `chartData` |
| Data-URL images push the file past the cap | FR-01727 refusals on image-heavy analyses | size is measured on the rendered string before responding; the message names the limit; cap is an open question |
| `inert` on the shell is unsupported in an older browser | focus escapes the overlay | the overlay keeps its own Tab handler (first/last cycling) regardless of `inert`, as the prototype did |
| `window.print()` fires before the print stylesheet applies after closing the dialog | blank or chrome-filled PDF | print is called after the dialog's close transition (the prototype waited 120 ms); the e2e test emulates `print` media instead of timing |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; explained once in the PR body |

## Human approval required

Step 4 and step 6 depend on authorization: the export routes call
`assertCan(analysis:read)` and the share link's visibility relies on 010's membership
check. Neither adds a rule, so they run as Q2 with review before merge, with this
written reason. No schema migration, cryptography, payment or deletion.

## Verification

```
npm ci && docker compose up -d db && npm run db:migrate
npm run lint && npm test
npx vitest run src/server/export
npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/017-presentation-and-export
```

Observable behaviour: open an analysis with three pages, press `Apresentar`, move
with the arrow keys to `3 / 3`, press Escape and see focus back on `Apresentar`; export
the HTML, open the file from disk with the network disabled and page through it with
buttons and arrows; export the CSV and see `"2026-09";"Tecnologia";"Pessoas";"1234,50";"1200,00"`-shaped
lines; print and see only cards; copy the link, open it as a Leitor of the workspace
on the same page, as a member of another workspace and see the 404 page, and signed
out and be sent to `/entrar` and back. A pass: every command exits 0, the offline
open records zero requests, and the matrix shows every FR/NFR with at least one test.
