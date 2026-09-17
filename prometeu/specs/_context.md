# Repository context

Planned inventory for the Prometeu Studio application repository. It is written
before the repository exists, from the approved cross-cutting decisions in
`_decisions.md`, so that twenty plans written in parallel name the same files.
Regenerate it with the `codebase-inventory` skill once `001-app-skeleton` has
landed, and again whenever the structure changes.

generated: 2026-09-17
commit: none (planned; regenerate after 001-app-skeleton)

## What this repository is

Prometeu Studio: a web studio where finance teams explore cost and budget data,
build dashboards from charts, tables, indicators and text on a 12-column canvas,
simulate cost scenarios and present or export the result. Single Next.js
application serving the React front end and the HTTP API. If it stops, nobody
can open, edit or present an analysis.

## Stack

| layer | technology | version |
|---|---|---|
| runtime | Node.js | LTS line chosen in 001-app-skeleton (open question) |
| framework | Next.js, App Router, React | current stable at scaffold time |
| language | TypeScript, `strict` | current stable |
| validation | zod, schemas in `src/core/schema`, types via `z.infer` | current stable |
| database | PostgreSQL | 16 |
| data access | Drizzle ORM, SQL migrations committed | current stable |
| auth | Auth.js, database sessions | current stable |
| client state | zustand, one store per open analysis | current stable |
| styling | CSS Modules + `src/styles/tokens.css`, fonts via `next/font` | – |
| charts | custom SVG React components, no chart library | – |
| unit tests | Vitest (node for core/server, jsdom + Testing Library for UI) | current stable |
| e2e | Playwright + `@axe-core/playwright` | current stable |
| LLM | provider abstraction in `src/server/llm`; adapters `bedrock`, `fake`, `copilot` | – |

## Entry points

| entry point | file | notes |
|---|---|---|
| web app | `src/app/layout.tsx` | root layout, fonts, tokens |
| shell routes | `src/app/(shell)/*/page.tsx` | pt-BR paths: `/inicio`, `/dashboard/[analysisId]`, `/dashboards`, `/dados`, `/planejamento`, `/governanca`, `/produto` |
| auth routes | `src/app/(auth)/entrar/page.tsx`, `src/app/api/auth/[...nextauth]/route.ts` | 005-authentication |
| HTTP API | `src/app/api/**/route.ts` | Route Handlers, JSON envelope |
| health | `src/app/api/health/route.ts` | 200/503 with database reachability |
| migrations | `src/server/db/migrations/NNNN_name.sql` (+ `.down.sql`) | run by `npm run db:migrate` |
| env validation | `src/server/env.ts` | fails startup naming the missing variable |

## Commands

The commands an agent may run. If a command is not here, it has not been
sanctioned.

| purpose | command |
|---|---|
| install | `npm ci` |
| build | `npm run build` |
| test | `npm test` (all unit tests, `vitest run`) |
| test one file | `npx vitest run <path>` |
| lint | `npm run lint` (eslint + `tsc --noEmit`) |
| e2e | `npm run test:e2e` |
| database (local) | `docker compose up -d db` |
| migrate | `npm run db:migrate` |
| run locally | `npm run dev` |
| traceability | `node .github/tools/spec/traceability.mjs --spec=specs/<id>-<slug>` |

Not sanctioned: `npm run db:generate` (writes files; a plan step, not a check),
`npm run db:rollback` (Q3, confirm first), any deploy command.

## Module map

| module | owns | depends on |
|---|---|---|
| `src/core/schema` | zod schemas and types for Row, Widget, Page, Measure, Params, Document, Analysis, Version, Template, Scenario; widget defaults; limits | nothing |
| `src/core/format` | pt-BR number, currency, percent and unit formatting | schema |
| `src/core/demo` | deterministic demo dataset generator (90 rows) | schema |
| `src/core/engine` | row selection, grouping, trend, metrics, filter inheritance, cross-filter, aggregation, chart data, waterfall, conditional colour, narrative and insight text | schema, format |
| `src/core/formula` | tokenizer, parser and evaluator for measure expressions; pt-BR error catalogue | nothing |
| `src/core/scenario` | scenario bucketing and arithmetic | schema |
| `src/server/env.ts` | environment validation at startup | nothing |
| `src/server/db` | Drizzle client, table definitions (`db/schema/*.ts`, one file per spec), migrations | env |
| `src/server/auth` | Auth.js configuration, `requireUser` | db |
| `src/server/authz` | permission matrix, `assertCan(actor, action, resource)` | db, auth |
| `src/server/repos` | repository functions per aggregate (workspaces, members, sources, analyses, versions, templates, scenarios) | db, schema |
| `src/server/http` | JSON envelope helpers, request validation, error mapping | schema |
| `src/server/import` | CSV/TXT/XLSX parsing and row validation | schema |
| `src/server/export` | server-rendered HTML export, CSV writer | engine, charts (SSR) |
| `src/server/llm` | `LlmProvider` interface and adapters, tool definitions, rate limit | env, schema |
| `src/server/log.ts` | JSON-lines logger | nothing |
| `src/ui/shell` | rail, header, explorer sidebar, toolbar, footer, toast, modal, skip link | tokens |
| `src/ui/charts` | SVG renderers: column, bar, line, area, donut, waterfall, kpi, table | engine, format |
| `src/ui/studio` | canvas, page tabs, property panel, store, autosave, drag/resize, filters, measures | charts, engine, schema |
| `src/ui/library`, `src/ui/sources`, `src/ui/planning`, `src/ui/governance`, `src/ui/home`, `src/ui/assistant` | one directory per page family | shell, schema |
| `tests/e2e` | Playwright specs, one file per spec directory | running app |

`src/core` imports nothing from `react`, `next`, `node:*`, `src/server` or `src/ui`;
an ESLint `no-restricted-imports` rule enforces it.

## Conventions this repository already follows

Planned, to be confirmed against the code after 001-app-skeleton:

- HTTP errors are `{ error: { code, message, field? } }` with stable snake_case
  codes and pt-BR messages; collections are `{ data, nextCursor }` with `limit ≤ 100`.
- Boundary input is parsed with the `src/core/schema` zod schema and rejected
  with the field path; nothing is clamped or coerced on the server.
- Every handler and every server page calls `requireUser` and `assertCan`.
- Optimistic concurrency: documents carry an integer `revision`; a stale write is
  refused with 409 and the current revision.
- Soft delete via `deleted_at`; lists filter it, opens return 404.
- Test names start with the requirement id; one behaviour per test; Arrange /
  Act / Assert separated by blank lines.
- pt-BR strings are inline constants; no i18n framework.
- Logs never contain tokens, session ids, document contents or prompts.

## Landmines

- **Traceability planned-file regex.** `core/tools/spec/traceability.mjs` captures
  planned paths with `` `([\w./-]+\.[a-z0-9]{1,6})` ``; Next.js paths containing
  `(shell)` or `[analysisId]` are not captured, so `--base` reports every route file
  as "changed, and no requirement asked for it". Until the tool is widened, plans
  expect that line and the PR body explains it.
- **Requirement ids are global.** Coverage is one repository-wide id → test map.
  A `spec.md` that mentions another spec's id acquires a phantom requirement.
  Use the `FR-NNNSS` scheme and cross-reference by directory name.
- **Never name a source directory `spec/`.** The tool treats anything under
  `spec/`, `tests/`, `__tests__/` as a test file.
- **Budget reading.** `loops/budgets.json` caps implement at 60k tokens per task
  and a feature session at 220k. Specs here are sized at 4–6 tasks, each ≤4 files
  and roughly ≤400 changed lines including tests. If the session cap is summed
  across task invocations instead, no useful spec fits; whoever runs the sessions
  confirms the reading before the first one.
- **Sanitizer semantics changed.** The prototype clamped invalid widget values;
  here the API rejects them. UI controls clamp before sending. A client that sends
  out-of-range values gets a 400, not a silently corrected document.
- **Dashboard KPI strip ignores page and widget filters** on purpose (prototype
  behaviour, explained by a scope note in the UI). Do not "fix" it.
- **Rate limiting is per instance** (in memory). Multi-instance hosting needs a
  shared store; tied to the hosting open question in 001-app-skeleton.
