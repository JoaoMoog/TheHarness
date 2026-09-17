# Specification: Authentication

Status: draft
Owner: João Moog

## Problem

The prototype has no identity at all: the header shows a hard-coded "João Martins ·
Finanças / Workspace", every visitor is the same person, and everything is stored in
the visitor's own browser. Once analyses and sources live on a server, an unknown
visitor must not be able to read, change or delete them, and every write must be
attributable to a person. Without a session there is nothing for workspaces and roles
(006-workspaces-and-roles) to check, so no persisted feature can ship. The rewrite
replaces the prototype's fixed profile with a real sign-in, and the "Salvo localmente"
promise with a session that the server can verify on every request.

## Goal

A person signs in once on a pt-BR page, every shell page and every API call except the
health check and the sign-in flow itself requires that session, the session can be
ended from the header, and no session secret ever appears in a log.

## Out of scope

- Workspaces, roles and any permission beyond "has a session" (006-workspaces-and-roles).
- Password storage, reset and multi-factor flows: identity comes from an external
  provider, whose choice is an open question below.
- Self-service registration screens: a person exists in the application only after the
  provider has authenticated them.
- Account deletion and data export for a person.
- Session revocation from an administrative screen (only self sign-out).

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00501 | Ubiquitous | The application SHALL serve a sign-in page at `/entrar`, in pt-BR, showing the wordmark, the heading `Entrar no Prometeu` and one action per configured identity provider whose accessible name starts with `Entrar com`. |
| FR-00502 | Event | WHEN a visitor without a valid session requests any shell route, the application SHALL redirect to `/entrar` carrying the requested path and query as a return parameter. |
| FR-00503 | Event | WHEN sign-in completes with a return parameter present, the application SHALL redirect the person to that path. |
| FR-00504 | Unwanted | IF the return parameter is absent, empty, or not a same-origin relative path starting with `/`, THEN the application SHALL redirect to `/` after sign-in instead of the supplied value. |
| FR-00505 | Ubiquitous | Every JSON API route other than the health check and the sign-in and sign-out routes SHALL answer a request without a valid session with HTTP 401 and a JSON error body whose stable code is `unauthenticated` and whose message is `Entre para continuar.`. |
| FR-00506 | Ubiquitous | The health check and the sign-in and sign-out routes SHALL remain reachable without a session. |
| FR-00507 | Event | WHEN an identity is authenticated by the provider for the first time, the application SHALL create exactly one person record holding the provider's subject identifier, the email address and the display name. |
| FR-00508 | Event | WHEN an identity that already has a person record signs in again, the application SHALL reuse that record and update the display name if the provider reports a new one, creating no second record. |
| FR-00509 | Ubiquitous | The header profile area SHALL show the signed-in person's initials and display name, and a menu with the action `Sair`. |
| FR-00510 | Event | WHEN the person activates `Sair`, the application SHALL invalidate the session on the server, so that a later request presenting the same session cookie is treated as unauthenticated, and redirect to `/entrar`. |
| FR-00511 | State | WHILE a session is older than the configured session lifetime, the application SHALL treat requests presenting it as unauthenticated. |
| FR-00512 | Unwanted | IF a request presents a session cookie that is malformed, unknown or altered, THEN the application SHALL treat the request as unauthenticated without raising an unhandled exception and without writing the cookie value to any log. |
| FR-00513 | Ubiquitous | The session cookie SHALL be marked `HttpOnly` and `SameSite=Lax`, and `Secure` whenever the application runs in production. |
| FR-00514 | Unwanted | IF the identity provider is unreachable or returns an error during sign-in, THEN `/entrar` SHALL show the message `Não foi possível entrar agora. Tente novamente em instantes.` with a `Tentar novamente` action, and no stack trace or provider response body in the page. |
| FR-00515 | Complex | WHEN the provider authenticates an identity, IF a sign-in policy is configured and the identity does not satisfy it, THEN the application SHALL refuse the sign-in with the message `Este acesso não está autorizado.` and create no person record. |
| FR-00516 | Event | WHEN a person with a valid session requests `/entrar`, the application SHALL redirect to `/`. |
| FR-00517 | Unwanted | IF the authentication secret is missing or shorter than 32 characters at startup, THEN the application SHALL refuse to start and print the variable's name, never its value. |
| FR-00518 | Optional | WHERE the application runs outside production with the test sign-in explicitly enabled, the sign-in page SHALL offer an additional `Entrar com conta de teste` action that signs in a named test identity without an external provider. |
| FR-00519 | Unwanted | IF the application runs in production, THEN the test sign-in action SHALL be absent from `/entrar` and its route SHALL answer HTTP 404. |
| NFR-00501 | Ubiquitous | Resolving the person behind a valid session SHALL take under 20 ms at p95 with 1,000 stored sessions, measured on the local database. |
| NFR-00502 | Ubiquitous | Over a full end-to-end run, the application log SHALL contain zero occurrences of any session cookie value, provider access token or authentication secret. |
| NFR-00503 | Ubiquitous | An automated accessibility scan of `/entrar` in its default and error states SHALL report zero violations of impact `serious` or `critical`. |
| NFR-00504 | Ubiquitous | An unauthenticated request to a shell route SHALL be answered with the redirect within 100 ms at p95 on the local server, before any page rendering starts. |
| NFR-00505 | Ubiquitous | Sessions past their lifetime SHALL be removed from storage within 24 hours of expiring. |

## Open questions

`[NEEDS CLARIFICATION: identity provider — corporate OIDC (Entra ID), email magic link or GitHub? It decides the provider configuration, the environment variables, the sign-in page actions and whether an email delivery service is needed.]`

`[NEEDS CLARIFICATION: who may sign in — anyone the provider authenticates, an email-domain allowlist, or invite-only? Invite-only means an invitation record and screen that this spec does not have.]`

`[NEEDS CLARIFICATION: session lifetime — fixed (e.g. 8 h) or rolling (e.g. 30 days extended on use)? It changes the expiry rule and the purge job.]`

`[NEEDS CLARIFICATION: how end-to-end tests authenticate — a test-only sign-in enabled outside production is a security decision that needs an explicit yes; the alternative is a provider stub, which cannot exercise the real callback.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/005-authentication
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
