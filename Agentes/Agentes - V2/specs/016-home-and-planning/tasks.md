# Tasks: Home and planning

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | core scenario arithmetic and prompt parser with golden tests | FR-01606, FR-01607, FR-01608, FR-01609, FR-01610, FR-01611, FR-01617, FR-01618, NFR-01602 | `src/core/scenario/index.ts`, `src/core/scenario/index.test.ts`, `src/core/prompt/parse.ts`, `src/core/prompt/parse.test.ts` | the listed FR/NFR unit tests; `npm run lint` core rule clean | - | P | Q1 |
| T2 | migration 0006 with down file, Drizzle table, barrel export | FR-01623 | `src/server/db/migrations/0006_scenarios.sql`, `0006_scenarios.down.sql`, `src/server/db/schema/scenarios.ts`, `src/server/db/schema/index.ts` | `npm run db:migrate` applies once; repository test sees the table empty | - | P | Q4 |
| T3 | scenario repository and routes: list, create with server-side recompute, soft remove, `requireUser` + `assertCan` | FR-01623, FR-01625, FR-01627, FR-01628, FR-01629, FR-01631 | `src/server/repos/scenarios.ts`, `src/server/repos/scenarios.test.ts`, `src/app/api/scenarios/route.ts`, `src/app/api/scenarios/[scenarioId]/route.ts` | the listed FR tests against `DATABASE_URL_TEST` (route tests live in `scenarios.test.ts`) | T1, T2 | | Q2 |
| T4 | home page: composer, chips, live region, recent cards, `useAskHome` flow | FR-01601, FR-01602, FR-01603, FR-01604, FR-01605, FR-01612, FR-01613, FR-01614, FR-01615 | `src/ui/home/HomePage.tsx`, `HomePage.module.css`, `src/ui/home/useAskHome.ts`, `src/ui/home/useAskHome.test.ts` | the listed FR component tests with Testing Library and a fake fetch | T1 | P | Q1 |
| T5 | planning components: sliders, live results, save dialog, saved table, reader and empty states | FR-01616, FR-01619, FR-01620, FR-01621, FR-01622, FR-01624, FR-01626, FR-01630, NFR-01601 | `src/ui/planning/PlanningPage.tsx`, `PlanningPage.module.css`, `ScenarioSliders.tsx`, `SaveScenarioDialog.tsx`, `PlanningPage.test.tsx` | the listed FR/NFR component tests with Testing Library and a fake fetch | T3 | | Q1 |
| T6 | replace the `/inicio` and `/planejamento` placeholders, governance lineage placement, e2e with axe and timing | FR-01632, NFR-01603, NFR-01604 | `src/app/(shell)/inicio/page.tsx`, `src/app/(shell)/planejamento/page.tsx`, `src/ui/governance/GovernancePage.tsx`, `tests/e2e/016-home-and-planning.spec.ts` | `npm run test:e2e` green; axe zero serious/critical; prompt-to-studio under 2 s | T4, T5 | | Q1 |

T2 is Q4 because it applies a schema migration: a human runs it. T3 is Q2 rather
than Q4 because it reuses 006's matrix without adding a rule and its deletion is a
reversible soft delete; a human reviews it before merge.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no language-model parsing, no
      scenario comparison charts, no scenario editing, the prompt not stored as an
      assistant message, no scenario cap, the five open questions and the assumptions
      the plan took for them.
