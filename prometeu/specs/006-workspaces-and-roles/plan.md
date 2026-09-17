# Implementation plan: Workspaces and roles

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: a personal workspace named `Workspace de <first name>` is created on the
person's first sign-in; any signed-in person may create workspaces; adding an unknown
e-mail is refused (no invitations); and the permission split is the one in the spec.
A different answer changes the marked steps only.

## Approach

Two tables (`workspaces`, `memberships`) and one column on the person
(`current_workspace_id`), one matrix module in `src/server/authz` that is both the
enforcement rule (`assertCan`) and the data source of the governance table, and a
`requireWorkspace` helper that resolves the current workspace for pages and lists.
Handlers for objects (analyses, sources, later versions) resolve the workspace from the
object, not from the client, and call `assertCan(actor, action, { workspaceId })`.
Rejected: storing the current workspace in a cookie — it would be a client-supplied
claim, and FR-00618 wants it to follow the person across devices. Rejected: a
role-per-resource table (ACLs) — not asked for; recorded as 017's open question.

## Reuse found

- `requireUser`, `requireUserPage`, `HttpError`, `jsonError` (planned in
  005-authentication): every handler and page here starts with them; `HttpError(403)`
  and `HttpError(404)` carry the codes of FR-00609 and FR-00610.
- `users` table and Auth.js `events.createUser` hook in `src/server/auth/config.ts`
  (planned in 005-authentication): the hook is where the personal workspace is
  created (assumption).
- `src/server/db/schema/index.ts`, `migrate.ts` (planned in 001-app-skeleton).
- `src/ui/shell/Header.tsx`, `Explorer.tsx`, `Modal.tsx`, `Toast.tsx`,
  `src/app/(shell)/layout.tsx` and `governanca/page.tsx` placeholder (planned in
  001-app-skeleton).
- Genuinely new: `src/server/authz` (matrix and `assertCan`), workspace and member
  repositories and routes, `requireWorkspace`, the switcher island, the governance
  components.

## Files

| File | Change |
|---|---|
| `src/server/db/migrations/0002_workspaces.sql`, `0002_workspaces.down.sql` | created: `workspaces(id, name, created_by, created_at, updated_at)`, `memberships(workspace_id, user_id, role, created_at, unique(workspace_id, user_id))`, role check `('reader','editor','admin')`, `users.current_workspace_id` nullable FK; down drops the tables and the column — data loss: every workspace and membership |
| `src/server/db/schema/workspaces.ts` | created: Drizzle definitions; `users` extended via `alterTable`-free re-declaration of the added column in `auth.ts` |
| `src/server/db/schema/auth.ts` | modified: `current_workspace_id` column on `users` |
| `src/server/db/schema/index.ts` | modified: export `workspaces` |
| `src/server/authz/matrix.ts` | created: `Role = "reader" \| "editor" \| "admin"`, `Action` union, `MATRIX: Record<Action, Record<Role, boolean>>`, `ROLE_LABELS` (Leitor/Editor/Administrador), `ACTION_LABELS` (the pt-BR rows of FR-00622) |
| `src/server/authz/assertCan.ts` | created: `assertCan(actor, action, { workspaceId })` — loads membership, throws 404 for non-member, 403 for denied; `can()` pure variant over a role |
| `src/server/auth/requireWorkspace.ts` | created: `requireWorkspace(user)` — current workspace validated against membership with the FR-00619 fallback; page variant redirects to the no-workspace state |
| `src/server/auth/config.ts` | modified: `events.createUser` creates the personal workspace (assumption) |
| `src/server/repos/workspaces.ts` | created: `createWorkspace(name, ownerId)` in one transaction (007 extends it with the demo seed), `listForUser(userId, cursor)`, `rename`, `setCurrent(userId, workspaceId)` |
| `src/server/repos/members.ts` | created: `list`, `addByEmail`, `changeRole`, `remove`, `adminCount` — last-admin guard inside the transaction |
| `src/server/http/validate.ts` | created: `parseBody(request, schema)` → 400 with the first field path |
| `src/core/schema/workspace.ts` | created: `WorkspaceNameSchema` (trim, 1–80), `RoleSchema`, `AddMemberSchema` |
| `src/app/api/workspaces/route.ts` | created: `GET` list (cursor, limit ≤ 100), `POST` create |
| `src/app/api/workspaces/[workspaceId]/route.ts` | created: `GET`, `PATCH` name (admin) |
| `src/app/api/workspaces/[workspaceId]/members/route.ts` | created: `GET` (member), `POST` add by e-mail (admin) |
| `src/app/api/workspaces/[workspaceId]/members/[userId]/route.ts` | created: `PATCH` role, `DELETE` (admin, last-admin guard) |
| `src/app/api/me/workspace/route.ts` | created: `PUT { workspaceId }` sets the current workspace after membership check |
| `src/app/(shell)/layout.tsx` | modified: resolves the current workspace, renders the no-workspace state (FR-00620), passes name and list to header and explorer |
| `src/ui/shell/Header.tsx` | modified: renders `WorkspaceSwitcher` with the current name |
| `src/ui/shell/WorkspaceSwitcher.tsx`, `WorkspaceSwitcher.module.css` | created: client island; menu of workspaces with role labels, `Criar workspace` opening a modal with the name field |
| `src/ui/shell/Explorer.tsx` | modified: title shows the workspace name |
| `src/ui/shell/NoWorkspace.tsx` | created: FR-00620 state |
| `src/app/(shell)/governanca/page.tsx` | modified: replaces the placeholder with `RolesTable` and `MemberList` |
| `src/ui/governance/RolesTable.tsx` | created: rows from `MATRIX` and `ACTION_LABELS` |
| `src/ui/governance/MemberList.tsx`, `governance.module.css` | created: member list with the admin-only role selector, `Remover` action and `Adicionar pessoa` form; styles |
| `src/server/authz/matrix.test.ts`, `assertCan.test.ts` | created: every cell (NFR-00601), 404 vs 403, byte-identical 404 (NFR-00603) |
| `src/server/repos/workspaces.test.ts`, `members.test.ts` | created: create makes the creator admin, list order and cursor; add, duplicate, unknown e-mail, last-admin guard, removal |
| `src/ui/governance/RolesTable.test.tsx`, `src/ui/shell/WorkspaceSwitcher.test.tsx` | created: table equals the matrix; switcher lists workspaces with role labels and `Criar workspace` |
| `tests/e2e/006-workspaces-and-roles.spec.ts` | created: create workspace, switch, governance as admin and as reader, axe |

## Contracts

- `assertCan(actor: { id }, action: Action, resource: { workspaceId }): Promise<Membership>`
  — throws `HttpError(404, "not_found", "Não encontrado.")` when the actor is not a
  member and `HttpError(403, "forbidden", "Você não tem permissão para esta ação.")`
  when the role denies. Actions are `group:verb` strings: `workspace:view`,
  `workspace:rename`, `members:manage`, `analysis:read`, `analysis:present`,
  `analysis:export`, `analysis:create`, `analysis:edit`, `analysis:remove`,
  `source:import`, `source:remove`, `version:save`, `version:restore`,
  `version:remove`, `template:save`, `template:use`, `template:remove`,
  `scenario:save`, `scenario:remove`, `assistant`. Later specs add actions here only;
  `ACTION_LABELS` maps each governance row to the actions it summarises, so a new
  action must be assigned to a row or the matrix test fails.
- `requireWorkspace(user): Promise<{ id, name, role }>` for pages and list handlers.
- `GET /api/workspaces` → `{ data: [{ id, name, role }], nextCursor }`;
  `POST /api/workspaces { name }` → 201 `{ data: { id, name, role: "admin" } }`;
  `400 { error: { code: "invalid", message: "Informe um nome de 1 a 80 caracteres.", field: "name" } }`.
- `GET /api/workspaces/:id/members` → `{ data: [{ userId, name, email, role }] }`;
  `POST { email, role }` → 201; `404 field: "email"`; `409 already_member`;
  `PATCH /api/workspaces/:id/members/:userId { role }`; `DELETE` → 204; `409 last_admin`.
- `PUT /api/me/workspace { workspaceId }` → 204, or 404 when not a member.
- `RolesTable` props: none; it imports the matrix, so the page cannot diverge.
- Breaking: `Header.tsx` gains a `workspace` prop and `Explorer.tsx` a `workspaceName`
  prop; `(shell)/layout.tsx` now needs a person (already from 005).

## Order of work

1. Confirm the reused files exist as described (`requireUser`, `HttpError`,
   `schema/auth.ts`, `schema/index.ts`, `Header.tsx`, `Explorer.tsx`,
   `(shell)/layout.tsx`, `governanca/page.tsx`); if not, return blocked. Green: tree
   unchanged and passing.
2. Migration `0002_workspaces`, Drizzle definitions, `workspace.ts` schemas,
   repositories. Green: repository tests on the test database (create makes the
   creator admin, last-admin guard, unique membership).
3. Matrix and `assertCan`, `requireWorkspace`, `validate.ts`. Green: every matrix cell
   asserted; 404 for non-member and 403 for reader on `analysis.edit`; NFR-00603
   byte comparison.
4. Workspace, member and current-workspace routes; `events.createUser` personal
   workspace (marked: auto-creation answer). Green: handler tests through plain
   `Request`s for FR-00603–FR-00616, FR-00625.
5. Header switcher, explorer title, layout with the no-workspace state, governance
   page. Green: `RolesTable` test equals the matrix; e2e switch and governance views;
   axe zero serious/critical.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| A later handler forgets `assertCan` and only calls `requireUser` | cross-workspace read | a lint-like unit test in `assertCan.test.ts` globs `src/app/api/**/route.ts` and fails when a file imports `requireUser` without `assertCan` or `requireWorkspace`, allowlist for `auth`, `health`, `me/workspace` |
| Last-admin guard raced by two concurrent removals | workspace without admin | count and delete inside one transaction with `SELECT … FOR UPDATE` on the workspace row |
| 404 body differs between "no such id" and "not a member" (e.g. timing, headers) | membership leak | both paths throw the same `HttpError` from the same place; NFR-00603 compares responses |
| Personal workspace creation inside the Auth.js event fails and blocks sign-in | nobody can sign in | the event catches and logs; `requireWorkspace` fallback shows the no-workspace state, which offers creation |
| Governance labels typed twice (matrix and page) | drift the spec forbids | labels live only in `matrix.ts`; `RolesTable.test.tsx` renders the table and compares it to `MATRIX` |

## Human approval required

Steps 2, 3 and 4 touch authorization: the schema migration for workspaces and
memberships, the matrix and `assertCan`, and the routes that grant, change and remove
membership (including removal, which is a deletion). A human runs them with the agent
assisting. Step 5 is UI over the tested rules.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
AUTH_TEST_LOGIN=1 npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/006-workspaces-and-roles
```

A pass: every command exits 0; as a second test user, an analysis id from the first
user's workspace answers 404 and, after being added as Leitor, a `PATCH` on it
answers 403 while `GET` answers 200; `/governanca` renders the same rows as
`MATRIX`; removing the only admin answers 409 `last_admin`; the switcher chosen on
one browser is the current workspace on a fresh sign-in.
