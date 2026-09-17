# Tasks: Authentication

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | migration `0001_auth` with down and data-loss note, Drizzle auth tables, env additions with the 32-character rule, logger redaction | FR-00517, NFR-00502 | `src/server/db/migrations/0001_auth.sql`, `0001_auth.down.sql`, `src/server/db/schema/auth.ts`, `src/server/db/schema/index.ts`, `src/server/env.ts`, `.env.example`, `src/server/log.ts` | FR-00517 env test; migration applied on `DATABASE_URL_TEST`; logger test shows redacted keys | - | | Q4 |
| T2 | Auth.js configuration (adapter, OIDC provider, conditional test provider, allowlist callback, cookie flags, session max age, purge), handlers route, `requireUser` with `safeReturnTo`, `HttpError` and envelope | FR-00504, FR-00505, FR-00507, FR-00508, FR-00510, FR-00511, FR-00512, FR-00513, FR-00515, FR-00519, NFR-00501, NFR-00505 | `src/server/auth/config.ts`, `src/server/auth/requireUser.ts`, `src/server/http/envelope.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/server/auth/requireUser.test.ts` | FR-00504, FR-00507, FR-00508, FR-00511, FR-00512, FR-00515, FR-00519, NFR-00501 unit tests against the test database | T1 | | Q4 |
| T3 | sign-in page with provider actions, error and signed-in states, `(auth)` layout, middleware redirect with return path, `(shell)` layout calling `requireUserPage` | FR-00501, FR-00502, FR-00503, FR-00514, FR-00516, FR-00518, NFR-00503, NFR-00504 | `src/app/(auth)/layout.tsx`, `src/app/(auth)/entrar/page.tsx`, `src/middleware.ts`, `src/app/(shell)/layout.tsx`, `src/app/(auth)/entrar/page.test.tsx` | FR-00501, FR-00514, FR-00518 page tests; FR-00502, FR-00503, FR-00516, NFR-00504 e2e in T5 | T2 | | Q4 |
| T4 | header profile area and `ProfileMenu` island with `Sair` | FR-00509, FR-00510 | `src/ui/shell/Header.tsx`, `src/ui/shell/ProfileMenu.tsx`, `src/ui/shell/ProfileMenu.module.css`, `src/ui/shell/ProfileMenu.test.tsx` | FR-00509 unit test; FR-00510 e2e in T5 (old cookie replay → 401) | T2 | P | Q2 |
| T5 | API contract test over every route, Playwright flows with the test account, axe on `/entrar`, log audit | FR-00505, FR-00506, FR-00502, FR-00503, FR-00510, FR-00516, NFR-00502, NFR-00503, NFR-00504 | `src/app/api/api-auth.contract.test.ts`, `tests/e2e/005-authentication.spec.ts`, `playwright.config.ts` | contract test lists every route with its status; e2e green with `AUTH_TEST_LOGIN=1`; log grep finds zero cookie values | T3, T4 | | Q3 |

T1, T2 and T3 are Q4 because they create the person and session tables, configure
the identity provider, cookie flags and session lifetime, and decide which requests
are refused: a human runs them with the agent assisting. T4 is Q2 (UI only; the
invalidation it triggers lives in T2) and is reviewed before merge. T5 is Q3
because it enables the test-only sign-in in the Playwright configuration: state the
plan, wait for yes. T1 lists seven files because the down migration, the barrel
export and `.env.example` are one-line siblings of the three real changes.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no roles or workspaces, no
      password or MFA flows, no administrative session revocation, the four open
      questions and the assumptions (OIDC, open sign-in with optional domain list,
      rolling 30-day session, test-only provider outside production) the plan took
      for them.
