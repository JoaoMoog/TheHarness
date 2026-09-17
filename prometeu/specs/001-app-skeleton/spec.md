# Specification: App skeleton

Status: draft
Owner: João Moog

## Problem

Nothing of Prometeu Studio exists as an application yet. The prototype is a set of
static files with hand-rolled routing, string templates and localStorage; it cannot
be deployed, tested, authenticated or extended. Every later feature needs a place to
land that already builds, lints, tests and reaches a database, and needs the studio's
visual shell (rail, header, toolbar, explorer, property panel, footer) to exist so
pages can be added without re-deciding layout. Without this, the first feature
session pays for tooling instead of behaviour, and every session after it
re-decides the same things.

## Goal

A deployable application shell with the prototype's chrome and design tokens, a
reachable database, quality gates and continuous integration, so every later
specification adds behaviour to a repository that is already green.

## Out of scope

- Any domain data, charts, analyses, import, authentication or roles. Every route
  renders placeholder content, except the product page, whose content is static.
- The behaviour of the explorer sidebar, toolbar buttons and property panel. They
  render as chrome and do nothing.
- Database tables beyond an empty migration baseline.
- Hosting and deployment pipelines beyond a container-friendly build.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00101 | Ubiquitous | The application SHALL serve the routes `/inicio`, `/dashboard`, `/dashboards`, `/dados`, `/planejamento`, `/governanca` and `/produto`, each rendering inside the shared shell with the page title in the document `<title>` in pt-BR. |
| FR-00102 | Event | WHEN a visitor requests `/`, the application SHALL redirect to `/dashboard`. |
| FR-00103 | Ubiquitous | The shell SHALL render, on every shell route, a skip link to the main content, a left navigation rail with the entries Início, Explorar, Planejar, Dados, IA and Ajustes, a header with the wordmark, a workspace button, undo and redo buttons, a save indicator, a help button and a profile area, a main landmark, and a footer with a source line. |
| FR-00104 | State | WHILE the route is `/dashboard`, the shell SHALL also render the toolbar with the buttons Inserir, Gráfico, Texto, Filtros, Organizar, Propriedades, Apresentar, Exportar and Compartilhar, the explorer sidebar and the property panel; on every other shell route these three regions SHALL be absent from the accessibility tree. |
| FR-00105 | Ubiquitous | The rail entry matching the current route SHALL be marked as the current page with `aria-current="page"`. |
| FR-00106 | Event | WHEN a toast is shown, the shell SHALL announce its text through a live region with `role="status"` and hide it after 3.6 seconds. |
| FR-00107 | Event | WHEN a modal dialog is open, the shell SHALL keep keyboard focus inside the dialog, return focus to the opener on close, and close the dialog on the Escape key. |
| FR-00108 | Unwanted | IF a visitor requests a path that no route serves, THEN the application SHALL respond with HTTP 404 and a pt-BR page inside the shell that links back to `/dashboard`. |
| FR-00109 | Event | WHEN `GET /api/health` is requested and the database answers a trivial query, the application SHALL respond 200 with a JSON body stating `ok: true`. |
| FR-00110 | Unwanted | IF the database does not answer within 2 seconds, THEN `GET /api/health` SHALL respond 503 with `ok: false` and a reason code, without an unhandled exception in the server log. |
| FR-00111 | Unwanted | IF a required environment variable is missing or empty at startup, THEN the application SHALL refuse to start and print the name of the variable, never its value. |
| FR-00112 | Ubiquitous | The repository SHALL provide a migration runner that applies committed SQL migration files in order exactly once, records each applied file, and starts from an empty baseline migration. |
| FR-00113 | Ubiquitous | The repository SHALL provide the scripts `build`, `lint`, `test`, `test:e2e`, `db:migrate` and `dev`, and a continuous-integration workflow that runs lint, unit tests, build and the end-to-end smoke against a PostgreSQL service on every push and pull request. |
| FR-00114 | State | WHILE the viewport is 1300 px wide or narrower, the shell SHALL hide toolbar button labels and the save indicator and keep their accessible names; WHILE it is 1100 px or narrower, the explorer SHALL become an off-canvas drawer opened by a menu button; WHILE it is 760 px or narrower, the property panel SHALL be hidden unless explicitly opened. |
| FR-00115 | Ubiquitous | The product page `/produto` SHALL render the prototype's static content: the three-step roadmap, the SAP Analytics Cloud reference table and the four product decisions, in pt-BR. |
| NFR-00101 | Ubiquitous | An automated accessibility scan of every shell route SHALL report zero violations of impact `serious` or `critical`. |
| NFR-00102 | Ubiquitous | `tsc --noEmit` under `strict` and the lint script SHALL exit 0 with zero warnings on the committed tree. |
| NFR-00103 | Ubiquitous | The continuous-integration job SHALL complete in under 10 minutes on the provider's default runner. |
| NFR-00104 | Ubiquitous | The first contentful paint of `/dashboard` with an empty main area SHALL occur within 1.5 seconds on a throttled "Fast 3G" profile in the e2e runner. |
| NFR-00105 | Ubiquitous | The design tokens SHALL reproduce the prototype's values: navy `#0b1354`, blue `#1643db`, rail 64 px, header 52 px, explorer 212 px, property panel 284 px, toolbar 48 px, fonts DM Sans and Manrope with local fallbacks. |

## Open questions

`[NEEDS CLARIFICATION: hosting target — container (standalone output) or Vercel? It decides the Next.js output mode, the health check consumer and whether rate limits can stay in memory.]`

`[NEEDS CLARIFICATION: which Node.js LTS line is pinned in engines and CI?]`

`[NEEDS CLARIFICATION: package manager — npm is assumed; pnpm or yarn changes the lockfile, the CI cache step and every sanctioned command.]`

`[NEEDS CLARIFICATION: must the Playwright smoke run in CI from day one, or only locally until the first authenticated flow exists?]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/001-app-skeleton
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
