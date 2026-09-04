# Tasks: <feature name>

Plan: <link to plan.md>

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | expose the filtered rows in the hook | FR-001 | src/reports/useReport.ts | its unit test | - | | Q1 |
| T2 | export button and its test | FR-001, FR-002 | src/reports/exportButton.tsx | FR-001, FR-002 tests | T1 | P | Q1 |
| T3 | permission check on the endpoint | FR-005 | src/api/export.ts | FR-005 test | T1 | P | Q4 |

P marks a task that shares no file with another unblocked task. Q is the
oversight quadrant: Q1 runs, Q2 runs and is reviewed after, Q3 asks first, Q4
is a human at the keyboard. Auth, crypto, payment, production schema and
deletion are Q4 by default.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down.
