# Tasks: Workspaces and roles

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | migration `0002_workspaces` with down and data-loss note, Drizzle tables, `current_workspace_id` column, workspace schemas | FR-00601, FR-00602, FR-00604 | `src/server/db/migrations/0002_workspaces.sql`, `0002_workspaces.down.sql`, `src/server/db/schema/workspaces.ts`, `src/server/db/schema/auth.ts`, `src/server/db/schema/index.ts`, `src/core/schema/workspace.ts` | migration applied on `DATABASE_URL_TEST`; FR-00604 schema test; unique membership constraint test | - | | Q4 |
| T2 | workspace and member repositories with the transactional last-admin guard; personal workspace on first sign-in | FR-00603, FR-00611, FR-00612, FR-00613, FR-00614, FR-00615, FR-00616, FR-00625 | `src/server/repos/workspaces.ts`, `src/server/repos/members.ts`, `src/server/auth/config.ts`, `src/server/repos/workspaces.test.ts`, `src/server/repos/members.test.ts` | FR-00603, FR-00611–FR-00616, FR-00625 repository tests; first sign-in of a test identity yields one workspace | T1 | | Q4 |
| T3 | permission matrix with labels, `assertCan`, `requireWorkspace` with fallback, body validation helper | FR-00605, FR-00606, FR-00607, FR-00608, FR-00609, FR-00610, FR-00619, NFR-00601, NFR-00602, NFR-00603 | `src/server/authz/matrix.ts`, `src/server/authz/assertCan.ts`, `src/server/auth/requireWorkspace.ts`, `src/server/http/validate.ts`, `src/server/authz/matrix.test.ts`, `src/server/authz/assertCan.test.ts` | every matrix cell asserted (NFR-00601); FR-00609 and FR-00610 tests; NFR-00603 byte comparison | T2 | | Q4 |
| T4 | workspace and member routes | FR-00603, FR-00604, FR-00611, FR-00612, FR-00613, FR-00614, FR-00615, FR-00616, FR-00625 | `src/app/api/workspaces/route.ts`, `src/app/api/workspaces/[workspaceId]/route.ts`, `src/app/api/workspaces/[workspaceId]/members/route.ts`, `src/app/api/workspaces/[workspaceId]/members/[userId]/route.ts` | handler tests with plain `Request`s for each status code; 401 contract test from 005 still green | T3 | | Q4 |
| T5 | current-workspace route, header `WorkspaceSwitcher`, no-workspace state, `(shell)` layout resolving the workspace, explorer title | FR-00617, FR-00618, FR-00620, FR-00621 | `src/app/api/me/workspace/route.ts`, `src/ui/shell/WorkspaceSwitcher.tsx`, `WorkspaceSwitcher.module.css`, `src/ui/shell/NoWorkspace.tsx`, `src/app/(shell)/layout.tsx`, `src/ui/shell/Header.tsx`, `src/ui/shell/Explorer.tsx`, `src/ui/shell/WorkspaceSwitcher.test.tsx` | FR-00617, FR-00620 unit tests; FR-00618 handler test (non-member → 404); FR-00621 e2e in T6 | T3 | P | Q1 |
| T6 | governance page from the matrix, member list with admin controls, e2e and axe | FR-00622, FR-00623, FR-00624, NFR-00604, NFR-00605 | `src/app/(shell)/governanca/page.tsx`, `src/ui/governance/RolesTable.tsx`, `src/ui/governance/MemberList.tsx`, `src/ui/governance/governance.module.css`, `src/ui/governance/RolesTable.test.tsx`, `tests/e2e/006-workspaces-and-roles.spec.ts` | FR-00622 test compares the table to `MATRIX`; FR-00623, FR-00624 e2e as admin and as reader; axe zero serious/critical | T4, T5 | | Q1 |

T1 to T4 are Q4 because they create the workspace and membership tables, define
and enforce authorization, and grant, change and remove membership (a deletion): a
human runs them with the agent assisting. Six tasks because the matrix (T3) is kept
apart from the routes (T4) so the human review of the rules is one sitting. T5
lists `Header.tsx` and `Explorer.tsx` as one-line prop changes beside its four real
files; the add-member form lives inside `MemberList.tsx`.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no invitations or e-mail, no
      groups or row-level rules, no workspace deletion, no per-analysis sharing, the
      prototype's "Aprovar orçamento" row dropped, the four open questions and the
      assumptions (personal workspace on first sign-in, anyone may create, unknown
      e-mail refused, the matrix as specified) the plan took for them.
