# Implementation plan: Authentication

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: a generic OIDC provider (Entra ID in production) configured by
`AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID` and `AUTH_OIDC_CLIENT_SECRET`; anyone the
provider authenticates may sign in, with an optional `AUTH_ALLOWED_DOMAINS` list
enforcing FR-00515 when set; a rolling 30-day session extended on use; and a
test-only credentials provider registered only when `NODE_ENV !== "production"`
and `AUTH_TEST_LOGIN=1`. A different answer changes the marked steps only.

## Approach

Use Auth.js with database sessions and its Drizzle adapter: the four adapter tables
arrive in migration `0001_auth`, the OIDC provider is configured from env, and one
helper `requireUser` is the only way a handler or server page obtains the acting
person. Page protection happens in two layers: `src/middleware.ts` redirects requests
without a session cookie to `/entrar` with the return path (cheap, no database), and
`(shell)/layout.tsx` calls `requireUser` to validate the cookie against the database
(catches expired and tampered cookies). Rejected: JWT sessions — sign-out could not
invalidate server-side (FR-00510) without a denylist, which is a database anyway.
Rejected: protecting pages only in middleware — middleware cannot read the database
sessions table at the edge, so it would trust the cookie's presence.

## Reuse found

- `src/server/env.ts` (planned in 001-app-skeleton): the zod environment schema;
  this plan adds the `AUTH_*` variables and the 32-character rule.
- `src/server/db/client.ts`, `src/server/db/migrate.ts`, `src/server/db/schema/index.ts`
  (planned in 001-app-skeleton): client, runner and barrel the new tables plug into.
- `src/server/log.ts` (planned in 001-app-skeleton): the logger; this plan adds
  redaction of `cookie`, `set-cookie` and `authorization` keys.
- `src/ui/shell/Header.tsx` and `src/app/(shell)/layout.tsx` (planned in
  001-app-skeleton): the profile area and the layout that will call `requireUser`.
- `src/ui/shell/Modal.tsx`, `Toast.tsx` (planned in 001-app-skeleton) for the menu
  and the sign-out confirmation toast.
- Genuinely new: everything under `src/server/auth`, the `(auth)` route group, the
  JSON error envelope helpers in `src/server/http` (first consumer is the 401), the
  middleware and the API contract test.

## Files

| File | Change |
|---|---|
| `src/server/db/migrations/0001_auth.sql`, `0001_auth.down.sql` | created: `users`, `accounts`, `sessions`, `verification_tokens` (Auth.js adapter shape) plus `users.created_at`; down drops the four tables — data loss: every person and session |
| `src/server/db/schema/auth.ts` | created: Drizzle definitions of the four tables |
| `src/server/db/schema/index.ts` | modified: export `auth` |
| `src/server/env.ts` | modified: `AUTH_SECRET` required, min 32; `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET` required in production; `AUTH_ALLOWED_DOMAINS`, `AUTH_TEST_LOGIN`, `AUTH_SESSION_MAX_AGE` optional |
| `.env.example` | modified: the new variables with empty values |
| `src/server/auth/config.ts` | created: Auth.js options — Drizzle adapter, database session strategy, OIDC provider, conditional test credentials provider, `signIn` callback for the domain allowlist, `pages.signIn = "/entrar"`, cookie flags, session `maxAge`, `deleteExpiredSessions`; exports `handlers`, `auth`, `signIn`, `signOut` |
| `src/server/auth/requireUser.ts` | created: `requireUser()` for handlers (throws `HttpError(401, "unauthenticated")`), `requireUserPage(returnTo)` for server pages (redirects to `/entrar?voltar=…`) and `safeReturnTo(value)` — same-origin relative path or `/` |
| `src/server/http/envelope.ts` | created: `HttpError`, `jsonError(status, code, message, field?)`, `notFound()`, `forbidden()`, `handle(fn)` wrapper mapping thrown errors to the envelope |
| `src/server/log.ts` | modified: redact `cookie`, `set-cookie`, `authorization`, `token`, `secret` keys |
| `src/middleware.ts` | created: matcher for shell routes and `/`; no session cookie → redirect to `/entrar?voltar=<path>`; sets `x-pathname` header for the layout |
| `src/app/api/auth/[...nextauth]/route.ts` | created: `GET`, `POST` from `handlers` |
| `src/app/(auth)/layout.tsx` | created: minimal centred layout with wordmark, no shell chrome |
| `src/app/(auth)/entrar/page.tsx` | created: provider actions, error state from `?erro=`, redirect to `/` when signed in, test action when enabled |
| `src/app/(shell)/layout.tsx` | modified: `requireUserPage` with the return path from `x-pathname`; passes the person to the header |
| `src/ui/shell/Header.tsx` | modified: profile area receives `{ name, initials }` and renders `ProfileMenu` |
| `src/ui/shell/ProfileMenu.tsx`, `ProfileMenu.module.css` | created: client island, menu button with `Sair` posting to sign-out |
| `src/server/auth/requireUser.test.ts` | created: unit tests with a real test database, including the `safeReturnTo` cases |
| `src/app/api/api-auth.contract.test.ts` | created: globs `src/app/api/**/route.ts`, imports each exported method, calls it with a bare `Request` and asserts 401 unless the path is `health` or `auth` |
| `src/app/(auth)/entrar/page.test.tsx`, `src/ui/shell/ProfileMenu.test.tsx` | created: actions, error state, test action visibility by env; menu with `Sair` |
| `playwright.config.ts` | modified: passes `AUTH_TEST_LOGIN=1` and `AUTH_TEST_USERS` to the web server and captures its log for NFR-00502 |
| `tests/e2e/005-authentication.spec.ts` | created: redirect with return path, sign in with the test account, profile menu, sign out, 401 on an API route, axe on `/entrar`, log audit |

## Contracts

- `requireUser(): Promise<{ id: string; email: string; name: string }>` — throws
  `HttpError(401, "unauthenticated", "Entre para continuar.")`. Every handler written
  by later specs starts with it.
- `requireUserPage(returnTo?: string)` — same, but calls Next `redirect` to
  `/entrar?voltar=<encoded path>` instead of throwing.
- `401 { error: { code: "unauthenticated", message: "Entre para continuar." } }` — the
  first use of the envelope `{ error: { code, message, field? } }` that every later
  spec returns.
- Sign-in page URL: `/entrar?voltar=<path>&erro=<code>`; `erro` values `provider`
  (FR-00514) and `nao_autorizado` (FR-00515).
- Sign-out: `POST /api/auth/signout` (Auth.js) deletes the session row; response
  redirects to `/entrar`.
- Test sign-in (assumption): credentials provider `teste` accepting `email` only, listed
  in `AUTH_TEST_USERS` as `email:name;…`; registered only outside production with
  `AUTH_TEST_LOGIN=1`; in production `POST /api/auth/callback/teste` is 404 (FR-00519).
- Environment: `AUTH_SECRET` (≥ 32 chars), `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`,
  `AUTH_OIDC_CLIENT_SECRET`, `AUTH_ALLOWED_DOMAINS` (comma list, optional),
  `AUTH_SESSION_MAX_AGE` (seconds, default 2 592 000), `AUTH_TEST_LOGIN`, `AUTH_TEST_USERS`.
- Cookie: Auth.js default names (`__Secure-authjs.session-token` in production),
  `httpOnly`, `sameSite: "lax"`, `secure` in production.
- Session purge: `deleteExpiredSessions()` in `src/server/auth/config.ts`, run at
  startup and every 6 hours by the same process (NFR-00505; single instance assumed,
  see 001-app-skeleton's hosting question).
- Breaking: none; `(shell)/layout.tsx` keeps its props, the header gains one prop.

## Order of work

1. Confirm the reused files exist as described (`env.ts`, `db/client.ts`, `migrate.ts`,
   `schema/index.ts`, `log.ts`, `Header.tsx`, `(shell)/layout.tsx`); if not, return
   blocked. Green: nothing changed, tree still passes.
2. Migration `0001_auth` and `schema/auth.ts`, env additions, logger redaction. Green:
   the runner applies the migration on the test database; the env test fails startup
   on a 31-character secret naming `AUTH_SECRET` (FR-00517); a logger test shows the
   redacted keys.
3. Auth.js configuration, handlers route, `requireUser` with `safeReturnTo`, `HttpError`
   and envelope. Green: unit tests for `requireUser` (valid, expired, tampered cookie →
   401 without throwing), `safeReturnTo` (FR-00504 cases), first-sign-in creates one
   person and second sign-in reuses it (FR-00507, FR-00508) against the test database.
4. `(auth)` layout and `/entrar` page with error and signed-in states, middleware,
   `(shell)/layout.tsx` calling `requireUserPage`, header profile and `ProfileMenu`.
   Green: page unit tests; `npm run build`; e2e in step 5 for the flows. (Marked:
   provider list on the page depends on the provider answer.)
5. Contract test over every API route and the Playwright file with the test sign-in;
   log audit assertion greps the captured server log for the cookie value. Green:
   `npm test` and `npm run test:e2e` pass with `AUTH_TEST_LOGIN=1`. (Marked: depends on
   the e2e authentication answer.)

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Test credentials provider accidentally enabled in production | anyone signs in as anyone | registered only when `NODE_ENV !== "production"` and `AUTH_TEST_LOGIN=1`; FR-00519 test asserts 404 with `NODE_ENV=production`; env schema refuses `AUTH_TEST_LOGIN` in production |
| Open redirect through the return parameter | phishing via `/entrar?voltar=https://evil` | `safeReturnTo` accepts only `/`-prefixed same-origin paths, rejects `//` and scheme prefixes; FR-00504 tests |
| Middleware redirect loop on `/entrar` or auth routes | sign-in impossible | matcher excludes `/entrar`, `/api/auth`, `/api/health`, static assets; e2e covers it |
| Contract test misses a route added by a later spec | a handler without `requireUser` ships | the test globs `src/app/api/**/route.ts` at run time, so new routes are tested automatically; a route needing exemption must be added to an explicit allowlist in the test |
| Provider metadata fetch during `npm run build` without network | build fails in CI | provider is configured lazily from env; no discovery at build time |
| Session purge timer in a serverless host never runs | expired rows accumulate | purge also runs on every sign-in; hosting answer (001) may move it to a scheduled job |

## Human approval required

Every step from 2 to 5 touches authentication: the migration creating the person and
session tables (step 2), the provider configuration, cookie flags and `requireUser`
(step 3), the route protection (step 4) and enabling the test sign-in for e2e (step 5).
A human runs steps 2–4 with the agent assisting and confirms step 5 before it runs.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
npm run lint && npm test && npm run build
AUTH_TEST_LOGIN=1 npm run test:e2e
curl -si localhost:3000/dashboards | head -3              # 307 → /entrar?voltar=%2Fdashboards
curl -si localhost:3000/api/workspaces | head -1           # HTTP/1.1 401 (or any non-health API route present)
curl -s  localhost:3000/api/health                         # {"ok":true} without a session
node .github/tools/spec/traceability.mjs --spec=specs/005-authentication
```

A pass: every command exits 0 except the deliberate 401, the redirect carries the
return path, signing in with the test account lands on `/dashboards`, `Sair`
invalidates the session (replaying the old cookie gives 401), and grepping the
captured server log for the session cookie value finds nothing.
