# Specification: Presentation and export

Status: draft
Owner: João Moog

## Problem

A finance lead who has built an analysis needs to show it in a meeting, hand it to
someone without the tool, print it, take the numbers to a spreadsheet and send a
colleague to the exact page. The prototype does all five, but each one is tied to the
single-browser build: the presentation overlay re-renders live DOM, the HTML export is
assembled in the browser from the studio's own markup, the PDF is the browser's print
dialog over prototype CSS, the CSV is written client-side, and "sharing" serialises
the rows and the configuration into the URL (`#dashboard?snapshot=…`, refused above
45 000 characters) so that `qualquer pessoa com o link e acesso ao site poderá ler os
dados incluídos` — the README itself says it `não é controle de acesso`.

The rewrite keeps the five flows and their pt-BR wording but changes two things.
Sharing becomes an authenticated deep link to the analysis and its active page; who
can open it is decided by membership of the analysis's workspace and role, exactly
as when navigating there, and the dialog says so (the prototype's `Gerar link de
snapshot` and its warning are gone). The HTML export is rendered on the server as
static markup with the charts as inline SVG and the filters in effect frozen, so the
file carries no application code and makes no network request. The export modal's
note `inclui 3 slides navegáveis` becomes `inclui todas as páginas`.

## Goal

Any member, including a Leitor, can present an analysis page by page, download it as
a self-contained HTML deck, print the active page, download the filtered rows as CSV,
and copy a link that opens the same page for any other member of the workspace and
nobody else.

## Out of scope

- Anonymous or public links, links with an expiry, and per-analysis access lists
  (open question; today visibility is workspace membership).
- Server-side PDF generation; PDF is the browser's print dialog over a print stylesheet.
- Scheduled or e-mailed exports, export of several analyses at once, PowerPoint.
- Exporting unfiltered rows or the whole source; CSV carries the current selection.
- Live data in the exported HTML: the file is a frozen snapshot with no refresh.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01701 | Event | WHEN `Apresentar` is activated, the system SHALL open an overlay with `role="dialog"`, `aria-modal="true"` and the accessible name `Apresentação do dashboard`, showing the active page as the first slide and moving keyboard focus to its `Sair` button. |
| FR-01702 | Ubiquitous | Each slide SHALL show the line `prometeu / {título}`, the page name as its heading, the line `{área} · {período}`, the page's widgets on the 12-column grid with the same values the canvas shows for that page under the dashboard, page, widget and cross filters in effect, and the footer `{fonte} · snapshot dos dados e configurações`. |
| FR-01703 | Ubiquitous | The overlay SHALL render the toolbar `prometeu / apresentação` with the buttons `Baixar HTML` and `Sair`, and the controls `Anterior`, the counter `{n} / {total}` and `Próximo`, with `Anterior` disabled on the first slide and `Próximo` disabled on the last. |
| FR-01704 | Event | WHEN `Próximo`, `Anterior`, the Right arrow or the Left arrow is activated, the system SHALL show the next or previous page as the slide and update the counter, doing nothing at the first or last slide. |
| FR-01705 | Event | WHEN a button widget on a slide targets an existing page, the system SHALL jump to that page's slide. |
| FR-01706 | State | WHILE the overlay is open, keyboard focus SHALL stay inside it: Tab and Shift+Tab cycle only through the overlay's enabled controls and the rest of the application is inert for keyboard and assistive technology. |
| FR-01707 | Event | WHEN Escape is pressed or `Sair` is activated, the system SHALL close the overlay, return focus to `Apresentar`, and leave the canvas on the page and selection it had before presenting. |
| FR-01708 | Event | WHEN `Exportar` is activated, the system SHALL open the dialog `Leve sua análise com você` with the text `A exportação usa o dashboard com os filtros atuais.`, the choices `Dashboard em PDF`, `Apresentação HTML independente` and `Dados filtrados em CSV`, and the note `PDF: abre a impressão do navegador. Escolha “Salvar como PDF”. A apresentação HTML funciona sem internet e inclui todas as páginas.`. |
| FR-01709 | Event | WHEN `Dashboard em PDF` is chosen, the system SHALL close the dialog and open the browser's print dialog for the active page. |
| FR-01710 | Ubiquitous | The print layout of the active page SHALL be A4 landscape with 10 mm margins, with the rail, header, toolbar, explorer, property panel, page bar, context bar, drag and resize handles, toasts and dialogs hidden, every card keeping its column span on the 12-column grid without breaking across pages, and the footer source line printed. |
| FR-01711 | Event | WHEN `Apresentação HTML independente` or `Baixar HTML` is chosen, the system SHALL download a file named `prometeu-apresentacao.html` containing every page of the analysis in order, rendered with the filters in effect at that moment, and show `Todas as páginas foram exportadas em HTML.`. |
| FR-01712 | Ubiquitous | The exported HTML file SHALL be self-contained: `lang="pt-BR"`, the title `{título} · Prometeu`, inline styles only, charts as inline SVG, images as embedded data, and no external script, stylesheet, font, image or other reference that causes a network request when opened from a local file. |
| FR-01713 | Ubiquitous | The exported HTML file SHALL offer the overlay's navigation without the application: a header `prometeu` with `{título} · Snapshot`, one page shown at a time, the controls `Anterior`, `{n} / {total}` and `Próximo`, the Left and Right arrow keys, button widgets jumping to the page they target, and filter-widget controls rendered disabled. |
| FR-01714 | Ubiquitous | Every number in the exported HTML SHALL equal the number the studio shows for the same widget under the same filters at export time, unaffected by any filter change made after the download. |
| FR-01715 | Event | WHEN `Dados filtrados em CSV` is chosen, the system SHALL download a file named `prometeu-dados.csv` holding the rows of the current dashboard-level selection (period, area, categories) and show `Dados do recorte exportados.`. |
| FR-01716 | Ubiquitous | The CSV file SHALL start with a byte-order mark, use `;` as separator and CRLF as line ending, have the header `data;area;categoria;realizado;orcado`, quote every field with `"` doubling inner quotes, and write `realizado` and `orcado` with exactly two decimals and a comma as decimal separator. |
| FR-01717 | Unwanted | IF the current selection holds no rows, THEN the system SHALL download a CSV containing only the header line, showing `Nenhum registro no recorte atual.`. |
| FR-01718 | Event | WHEN `Compartilhar` is activated, the system SHALL open the dialog `Compartilhar uma descoberta` showing the link to the analysis's active page, a `Copiar link` action, and the statement `Quem pode abrir: membros do workspace {nome}. Leitores visualizam, apresentam e exportam; Editores e Administradores também editam.`. |
| FR-01719 | Event | WHEN `Copiar link` is activated, the system SHALL place the link on the clipboard and show `Link copiado.`. |
| FR-01720 | Unwanted | IF the clipboard is unavailable, THEN the system SHALL select the link text and show `Selecione e copie o link com Ctrl+C.`. |
| FR-01721 | Event | WHEN a signed-in member of the analysis's workspace opens a shared link, the system SHALL open the analysis on the page the link names, or on the first page when the named page no longer exists. |
| FR-01722 | Unwanted | IF a signed-in user who is not a member of the analysis's workspace opens a shared link, THEN the system SHALL respond with the not-found page without revealing whether the analysis exists. |
| FR-01723 | Unwanted | IF a visitor who is not signed in opens a shared link, THEN the system SHALL send them to sign in and, once signed in, continue to the same link. |
| FR-01724 | State | WHILE the acting member is a Leitor, `Apresentar`, `Exportar` and `Compartilhar` SHALL remain available with the same behaviour as for an Editor. |
| FR-01725 | Unwanted | IF an HTML or CSV export is requested for an analysis the acting user may not read, THEN the system SHALL refuse as not found and produce no file. |
| FR-01726 | Unwanted | IF the server cannot produce the HTML export, THEN the system SHALL show `Não foi possível gerar a apresentação. Tente novamente.` and leave the export dialog open. |
| FR-01727 | Unwanted | IF the exported HTML would exceed 16 MB, THEN the system SHALL refuse with a message naming the limit and suggesting fewer images, and produce no file. |
| NFR-01701 | Ubiquitous | The HTML export of an analysis at the limits (20 pages, 100 widgets, 5000 rows) SHALL be produced within 5 s at p95 on the CI runner. |
| NFR-01702 | Ubiquitous | The CSV export of 5000 rows SHALL be produced within 1 s at p95. |
| NFR-01703 | Ubiquitous | The presentation overlay SHALL show its first slide within 300 ms of activation for a page of 20 widgets. |
| NFR-01704 | Ubiquitous | Opening the exported HTML file in the e2e browser with network access blocked SHALL record zero failed or attempted requests. |
| NFR-01705 | Ubiquitous | An automated accessibility scan of the overlay, the three dialogs and the exported HTML file SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: anonymous or public links — the prototype's snapshot link worked for anyone with the URL; if that must survive, a token-based read-only route, its expiry and its audit are a new feature and FR-01718, FR-01722 and FR-01723 change.]`

`[NEEDS CLARIFICATION: CSV number format — the prototype writes `1234,50` (pt-BR comma, FR-01716); a spreadsheet in an en-US locale reads that as text; keeping the comma or switching to a dot changes FR-01716 and the import round trip of 008-file-import-and-data-page.]`

`[NEEDS CLARIFICATION: HTML export size cap — images are embedded as data URLs up to 1 MB each and a document may hold 100 widgets; the 16 MB of FR-01727 is a placeholder and decides whether the server streams or buffers the file.]`

`[NEEDS CLARIFICATION: per-analysis access lists — the decision set records this as this specification's question; if a link must reach only named people, visibility stops being workspace membership.]`

`[NEEDS CLARIFICATION: should the shared link also carry the filters in effect (period, area, categories) so the recipient sees the same numbers, or only the page (assumed)?]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/017-presentation-and-export
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
