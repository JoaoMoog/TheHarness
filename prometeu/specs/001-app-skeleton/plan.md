# Implementation plan: App skeleton

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: container hosting with `output: "standalone"`, Node 22 LTS, npm, and
the Playwright smoke in CI from day one. A different answer changes the marked
steps only.

## Approach

Scaffold one Next.js application with the App Router and TypeScript `strict`,
port the prototype's CSS variables into `tokens.css`, and build the shell as
server components with three small client islands (toast, modal, explorer
drawer). The database is reached through one Drizzle client and a tiny SQL
migration runner committed to the repository, so 005–008 add tables by adding
files. Rejected: `create-next-app` defaults with Tailwind and a UI kit — every
prototype rule would be re-expressed, and the studio's fixed-chrome layout is
easier as plain CSS on the tokens. Rejected: Drizzle Kit's own migrator as the
runtime — it writes a journal we would have to commit and reason about; a
20-line runner over ordered `.sql` files is simpler to review.

## Reuse found

Nothing exists yet; this is the first spec. The prototype supplies the values,
not code: `dist/styles.css` and `dist/studio.css` `:root` blocks for tokens and
breakpoints, `dist/index.html` for the shell markup order and pt-BR labels,
`dist/app.js` `product()` for the static product page content.

## Files

| File | Change |
|---|---|
| `package.json` | created: scripts `dev`, `build`, `start`, `lint`, `test`, `test:e2e`, `db:migrate`; engines |
| `tsconfig.json` | created: `strict`, path alias `@/*` → `src/*` |
| `next.config.ts` | created: `output: "standalone"` (hosting assumption) |
| `eslint.config.mjs` | created: next + typescript rules; `no-restricted-imports` for `src/core` |
| `vitest.config.ts` | created: node environment by default, jsdom for `src/ui/**` |
| `playwright.config.ts` | created: chromium, base URL, web server command |
| `docker-compose.yml` | created: `db` service, PostgreSQL 16 |
| `.env.example` | created: every variable, empty values |
| `.github/workflows/ci.yml` | created: lint, test, build, e2e with a postgres service |
| `src/styles/tokens.css` | created: prototype variables and breakpoint overrides |
| `src/styles/globals.css` | created: reset, focus ring, `.app` layout maths, print base |
| `src/app/layout.tsx` | created: fonts via `next/font`, tokens, skip link, shell |
| `src/app/page.tsx` | created: redirect to `/dashboard` |
| `src/app/not-found.tsx` | created: pt-BR 404 inside the shell |
| `src/app/(shell)/layout.tsx` | created: rail, header, footer; conditional toolbar/explorer/panel by segment |
| `src/app/(shell)/inicio/page.tsx`, `dashboard/page.tsx`, `dashboards/page.tsx`, `dados/page.tsx`, `planejamento/page.tsx`, `governanca/page.tsx` | created: placeholder pages with pt-BR titles |
| `src/app/(shell)/produto/page.tsx` | created: static product content |
| `src/app/api/health/route.ts` | created: database ping with 2 s timeout |
| `src/ui/shell/Rail.tsx`, `Header.tsx`, `Toolbar.tsx`, `Explorer.tsx`, `PropertyPanel.tsx`, `Footer.tsx`, `SkipLink.tsx` | created: chrome components, server-rendered |
| `src/ui/shell/Toast.tsx`, `ToastProvider.tsx` | created: client island, `role="status"`, 3600 ms |
| `src/ui/shell/Modal.tsx` | created: client island over `<dialog>`, focus trap, Esc |
| `src/ui/shell/ExplorerDrawer.tsx` | created: client island for the ≤1100 px drawer |
| `src/ui/shell/*.module.css` | created: one per component |
| `src/server/env.ts` | created: zod-validated environment, fails startup naming the variable |
| `src/server/db/client.ts` | created: Drizzle client over `DATABASE_URL` |
| `src/server/db/schema/index.ts` | created: empty barrel that later specs extend |
| `src/server/db/migrate.ts` | created: ordered `.sql` runner with an applied-migrations table |
| `src/server/db/migrations/0000_baseline.sql`, `0000_baseline.down.sql` | created: the applied-migrations table only |
| `src/server/log.ts` | created: JSON-lines logger |
| `tests/e2e/001-app-skeleton.spec.ts` | created: routes, redirect, 404, health, breakpoints, axe |
| `README.md` | created: the sanctioned commands and how to run locally |

## Contracts

- `GET /api/health` → `200 { ok: true }` or `503 { ok: false, reason: "database_unreachable" | "database_timeout" }`.
- Environment schema in `src/server/env.ts`: `DATABASE_URL` (required), `DATABASE_URL_TEST`
  (required in test), `AUTH_SECRET`, `LLM_PROVIDER`, `AWS_REGION`, `BEDROCK_MODEL_ID`
  (declared now as optional, made required by 005 and 018).
- Shell composition: `(shell)/layout.tsx` decides toolbar/explorer/panel presence from the
  route segment; later specs replace the placeholder children, not the layout.
- Toast API: `useToast().show(text: string)`; Modal API: `<Modal open title onClose>`.
- Migration runner: files `NNNN_name.sql` applied in lexical order, each recorded in
  `schema_migrations(name, applied_at)`.

## Order of work

1. Scaffold, tooling and empty test suites (`package.json`, `tsconfig`, eslint, vitest,
   playwright). Green: `npm run lint && npm test && npm run build` pass on an empty app.
2. Tokens, globals, fonts, root layout with skip link. Green: build passes, a unit test
   asserts the token file contains the five prototype values (NFR-00105).
3. Shell components, `(shell)` layout, placeholder routes, redirect, 404, product page.
   Green: unit tests for Rail (`aria-current`), Toast (live region + timer), Modal (focus
   trap, Esc) pass.
4. Env validation, Drizzle client, migration runner, baseline migration, health route,
   docker-compose. Green: repository test applies the baseline twice and records it once;
   health returns 503 with the database stopped and 200 with it up.
5. CI workflow with a postgres service and the e2e smoke (routes, redirect, 404, health,
   three breakpoints, axe). Green: the workflow passes on the branch.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Fixed-position chrome (rail, header, toolbar, panels) fights App Router streaming and nested layouts | layout jumps, duplicated chrome | one `(shell)/layout.tsx` owns all chrome; pages render only into `main` |
| `next/font` blocks on Google Fonts in CI without network | flaky build | fonts declared with `display: "swap"` and local fallbacks; build does not fail on fetch |
| Health check leaking connection strings in the reason | secret in logs | reason is a fixed code; the caught error is logged only through `log.ts`, which redacts `DATABASE_URL` |
| Playwright e2e in CI doubles the job time | NFR-00103 breached | one smoke file, chromium only, web server reused; measured in step 5 |
| Route-group paths are not captured by the traceability planned-file regex | false "unrequested change" lines | known landmine in `_context.md`; explained once in the PR body |

## Human approval required

Step 1 writes the dependency manifest and step 5 the CI workflow and
docker-compose; both are Q3 (confirm before running). No authentication,
cryptography, payment or data destruction in this spec.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
npm run test:e2e
curl -s localhost:3000/api/health          # {"ok":true}
docker compose stop db && curl -si localhost:3000/api/health | head -1   # HTTP/1.1 503
node .github/tools/spec/traceability.mjs --spec=specs/001-app-skeleton
```

A pass: every command exits 0 except the deliberate 503, the CI run is green
under 10 minutes, and the matrix shows every FR/NFR with at least one test.
