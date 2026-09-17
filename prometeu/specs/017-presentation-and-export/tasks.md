# Tasks: Presentation and export

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | `Slide` component in overlay and export modes, presentation overlay with focus trap, `inert`, arrows, Escape, jumps | FR-01701, FR-01702, FR-01703, FR-01704, FR-01705, FR-01706, FR-01707, NFR-01703 | `src/ui/studio/Slide.tsx`, `Slide.module.css`, `src/ui/studio/Presentation.tsx`, `Presentation.module.css`, `Presentation.test.tsx` | the listed FR/NFR component tests with Testing Library | - | | Q1 |
| T2 | CSV writer and server HTML renderer with export styles and size check | FR-01712, FR-01713, FR-01714, FR-01716, FR-01717, FR-01727 | `src/server/export/csv.ts`, `csv.test.ts`, `src/server/export/html.ts`, `html.test.ts`, `src/server/export/presentationStyles.ts` | the listed FR unit tests: golden CSV, no `http` reference in markup, numbers equal `chartData`, 16 MB refusal | T1 | | Q1 |
| T3 | export routes with `requireUser` + `assertCan(analysis:read)` and filter parsing | FR-01711, FR-01715, FR-01725, FR-01726, NFR-01701, NFR-01702 | `src/app/api/analyses/[analysisId]/export/html/route.ts`, `src/app/api/analyses/[analysisId]/export/csv/route.ts`, `src/app/api/analyses/[analysisId]/export/route.test.ts` | the listed FR/NFR route tests against `DATABASE_URL_TEST` with a maximum document | T2 | | Q2 |
| T4 | export dialog, print stylesheet and its import | FR-01708, FR-01709, FR-01710 | `src/ui/studio/ExportDialog.tsx`, `ExportDialog.test.tsx`, `src/styles/print.css`, `src/app/layout.tsx` | the listed FR component tests; print media assertion in T6 | T1 | P | Q1 |
| T5 | share dialog, `pagina` parameter on the dashboard page, toolbar wiring of `Apresentar`, `Exportar` and `Compartilhar` | FR-01718, FR-01719, FR-01720, FR-01721, FR-01724 | `src/ui/studio/ShareDialog.tsx`, `ShareDialog.test.tsx`, `src/app/(shell)/dashboard/[analysisId]/page.tsx`, `src/ui/shell/Toolbar.tsx` | the listed FR component tests; unknown `pagina` falls back to the first page | T1 | P | Q2 |
| T6 | e2e: overlay by keyboard, downloads opened offline with request counting, print emulation, share link as member, non-member and anonymous, axe | FR-01722, FR-01723, NFR-01704, NFR-01705 | `tests/e2e/017-presentation-and-export.spec.ts` | `npm run test:e2e` green; zero requests on the offline open; axe zero serious/critical | T3, T4, T5 | | Q1 |

T3 and T5 are Q2 rather than Q4 because they reuse 006's matrix and 010's
membership check without adding an authorization rule; a human reviews them before
merge. Nothing here is Q4: no migration, no cryptography, no deletion.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no anonymous or expiring links,
      no per-analysis access list, no server-side PDF, no scheduled exports, the
      snapshot-in-URL sharing removed, the 16 MB cap as a placeholder, the five open
      questions and the assumptions the plan took for them.
