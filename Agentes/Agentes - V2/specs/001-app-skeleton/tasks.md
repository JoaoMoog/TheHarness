# Tasks: App skeleton

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | scaffold Next.js + TypeScript strict, eslint with the `src/core` import restriction, vitest, playwright, scripts | FR-00113, NFR-00102 | `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts` | `npm run lint && npm test && npm run build` exit 0 on the empty app | - | | Q3 |
| T2 | tokens, globals, fonts and root layout with skip link | NFR-00105, FR-00103 | `src/styles/tokens.css`, `src/styles/globals.css`, `src/app/layout.tsx` | NFR-00105 test reads the token values; build passes | T1 | | Q1 |
| T3 | shell chrome: rail with `aria-current`, header, footer, toolbar, explorer, property panel, `(shell)` layout deciding presence by segment | FR-00103, FR-00104, FR-00105, FR-00114 | `src/ui/shell/Rail.tsx`, `Header.tsx`, `Toolbar.tsx`, `Explorer.tsx`, `PropertyPanel.tsx`, `Footer.tsx`, `src/app/(shell)/layout.tsx`, `*.module.css` | FR-00103, FR-00104, FR-00105 unit tests; FR-00114 e2e in T7 | T2 | | Q1 |
| T4 | toast and modal client islands, explorer drawer | FR-00106, FR-00107, FR-00114 | `src/ui/shell/Toast.tsx`, `ToastProvider.tsx`, `Modal.tsx`, `ExplorerDrawer.tsx` | FR-00106, FR-00107 unit tests with fake timers and Testing Library | T2 | P | Q1 |
| T5 | placeholder routes, root redirect, 404 page, static product page | FR-00101, FR-00102, FR-00108, FR-00115 | `src/app/page.tsx`, `src/app/not-found.tsx`, `src/app/(shell)/*/page.tsx` | FR-00101, FR-00102, FR-00108, FR-00115 e2e assertions in T7; unit test for product page content | T3 | | Q1 |
| T6 | env validation, Drizzle client, migration runner, baseline, health route, docker-compose, logger | FR-00109, FR-00110, FR-00111, FR-00112 | `src/server/env.ts`, `src/server/db/client.ts`, `src/server/db/schema/index.ts`, `src/server/db/migrate.ts`, `src/server/db/migrations/0000_baseline.sql`, `0000_baseline.down.sql`, `src/server/log.ts`, `src/app/api/health/route.ts`, `docker-compose.yml`, `.env.example` | FR-00109..FR-00112 tests against `DATABASE_URL_TEST`; runner applied twice records once | T1 | P | Q3 |
| T7 | CI workflow and e2e smoke: routes, redirect, 404, health, breakpoints, axe, paint timing | FR-00113, FR-00114, NFR-00101, NFR-00103, NFR-00104 | `.github/workflows/ci.yml`, `tests/e2e/001-app-skeleton.spec.ts`, `README.md` | workflow green under 10 minutes; axe zero serious/critical | T5, T6 | | Q3 |

T1, T6 and T7 are Q3 because they write the dependency manifest, the database
bootstrap and the CI workflow: state the plan, wait for yes. Nothing here is Q4.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no data, no auth, no chart, the
      toolbar buttons do nothing, the four open questions and the assumptions the
      plan took for them.
