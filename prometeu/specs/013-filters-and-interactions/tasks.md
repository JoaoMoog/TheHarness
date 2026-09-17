# Tasks: Filters and interactions

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | store actions for dashboard, page and widget filters, cross-filter state, reader override layer; heading filters and the category dialog | FR-01301, FR-01302, FR-01303, FR-01325 | `src/ui/studio/store.ts`, `src/ui/studio/store.test.ts`, `src/ui/studio/filters/DashboardFilters.tsx`, `src/ui/studio/filters/DashboardFilters.test.tsx` | the listed ids in the two test files; history length and `dirty` asserted | - | | Q1 |
| T2 | filter field group, page filter dialog, scope notes and chip container, context bar wiring with ` •` | FR-01304, FR-01305, FR-01306, FR-01307, FR-01309, FR-01322, FR-01326 | `src/ui/studio/filters/FilterFields.tsx`, `src/ui/studio/filters/PageFiltersDialog.tsx`, `src/ui/studio/filters/ScopeNotes.tsx`, `src/ui/studio/ContextBar.tsx`, `src/ui/studio/filters/*.module.css`, `src/ui/studio/filters/PageFiltersDialog.test.tsx` | the listed ids in `PageFiltersDialog.test.tsx` | T1 | | Q1 |
| T3 | widget filters in the Dados tab, `Filtro próprio` badge, indicator strip unchanged under page and widget filters | FR-01308, FR-01310, FR-01311 | `src/ui/studio/panel/DadosTab.tsx`, `src/ui/studio/WidgetCard.tsx`, `src/ui/studio/panel/DadosTab.test.tsx` | the listed ids in `DadosTab.test.tsx`; strip values asserted equal before and after | T2 | | Q1 |
| T4 | filter widget and button widget renderers with their Dados controls | FR-01312, FR-01313, FR-01321 | `src/ui/studio/filters/FilterWidget.tsx`, `src/ui/studio/filters/ButtonWidget.tsx`, `src/ui/studio/filters/FilterWidget.test.tsx`, `src/ui/studio/filters/ButtonWidget.test.tsx` | the listed ids in the two test files | T3 | | Q1 |
| T5 | hit protocol on chart points, `applyHit` with cross-filter toggle and chip, details dialog with the 100-row cap, navigation with the two toasts | FR-01314, FR-01315, FR-01316, FR-01317, FR-01318, FR-01319, FR-01320 | `src/ui/studio/interactions/hit.ts`, `src/ui/studio/interactions/DetailsDialog.tsx`, `src/ui/studio/interactions/interactions.test.tsx`, `src/ui/charts/hit.ts`, `src/ui/studio/interactions/*.module.css` | the listed ids in `interactions.test.tsx` | T4 | | Q1 |
| T6 | pure lineage function in core and the `Rastro da análise` component in the Dados tab; e2e with the 100-widget fixture, reader session, axe and timings | FR-01323, FR-01324, NFR-01301, NFR-01302, NFR-01303, NFR-01304 | `src/core/engine/lineage.ts`, `src/core/engine/lineage.test.ts`, `src/ui/studio/lineage/Lineage.tsx`, `src/ui/studio/panel/DadosTab.tsx`, `tests/e2e/013-filters-and-interactions.spec.ts` | `lineage.test.ts` for FR-01323; `npm run test:e2e` green for the rest | T5 | | Q1 |

Nothing here is Q3 or Q4: no manifest, CI, migration, authentication or deletion
is touched; the reader restriction is enforced on the server by 010-studio-canvas
and only mirrored here. T2 lists six files because the stylesheet is a one-line
sibling and the context bar change is the two-word label; T6 lists five because
mounting `Lineage` in `DadosTab.tsx` is a one-line section under the filters T3
added, and T6 runs after T3 so no file is shared with an unblocked task.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: cross-filter not persisted,
      details capped at 100 rows, last-write-wins between filter widgets, reader
      filter changes local to the session, no engine change, the governance page
      not yet showing the lineage (016), and the four open questions with the
      assumptions the plan took for them.
