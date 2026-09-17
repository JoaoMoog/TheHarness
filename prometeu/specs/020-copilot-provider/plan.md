# Implementation plan: Copilot provider

Specification: [spec.md](spec.md)

Written before the repository exists, and **before the open questions are answered**.
This plan is a sketch under one assumption, stated so the difference is visible when
the answers arrive: **reading (b), inbound** — the person's Copilot (assumed to be
Microsoft 365 Copilot or a Copilot Studio agent in the organisation's tenant) calls
Prometeu through a Model Context Protocol server over Streamable HTTP, authenticated
with OAuth bearer tokens issued by the organisation's identity provider and validated
by Prometeu as a resource server. Further assumptions: the provider choice is per
workspace only; there is no stored credential under (b), so the encryption
requirements apply only to the acceptance record and become live under (a); the
consent notice is shown in the studio when the first inbound proposal for a person
arrives. The section "What changes under reading (a)" below sketches the other
system. Nothing in this plan is implemented until the specification's questions are
closed.

## Approach

Add one MCP server module that registers the two tool definitions of
018-assistant-service (unchanged) and, on a call, runs the same validators, writes a
pending proposal row and returns the dashboard shape; the studio's assistant tab polls
for pending proposals of the open analysis and shows them through the preview modal of
019-assistant-ui. Provider choice lives in a workspace settings row and drives which
path the assistant advertises; Bedrock stays the executing provider for every call
Prometeu makes itself, so "fallback to Bedrock" under (b) means "the in-app assistant
keeps working regardless of the Copilot side". Rejected: exposing the existing assistant
endpoint to Copilot as a plain HTTP tool — Copilot clients speak MCP, and the schema,
authentication and discovery would be re-invented. Rejected: applying an inbound tool
call directly as the prototype did — it breaks the "model proposes, person confirms"
guarantee and lets an external agent write to a document.

## Reuse found

- `src/server/llm/tools.ts` (planned in 018-assistant-service): the two tool schemas and
  their output parsers, reused verbatim as the MCP tool definitions.
- `src/server/llm/rateLimit.ts` (planned in 018-assistant-service): the per-person window,
  keyed by the same person id for inbound calls.
- `src/server/auth` `requireUser` and `src/server/authz` `assertCan` (planned in 005/006):
  membership and role checks after the bearer token is mapped to a person.
- `src/server/repos` analyses and rows (planned in 007): the source's areas and months for
  validation and `records`.
- `src/ui/assistant/PreviewModal.tsx` and the store actions (planned in 019-assistant-ui):
  a pending proposal is shown and applied through them.
- `src/ui/governance` page (planned in 006-workspaces-and-roles): gains a provider card.
- `src/server/env.ts` (planned in 001): gains the MCP variables.
- Genuinely new: the MCP server and its transport route, the bearer-token validation,
  the settings and proposals tables with their repositories, the governance card, the
  consent notice and the pending-proposal poll.

## Files

| File | Change |
|---|---|
| `src/server/db/migrations/0007_assistant_provider.sql`, `0007_assistant_provider.down.sql` | created: `workspace_assistant_settings` (workspace id, provider, updated by, updated at), `assistant_consents` (person id, provider, accepted at, withdrawn at), `assistant_proposals` (id, person id, analysis id, kind, payload, created at, expires at, consumed at); the down file drops all three and notes that pending proposals and consent records are lost |
| `src/server/db/schema/assistant.ts` | created: Drizzle tables for the three |
| `src/server/db/schema/index.ts` | modified: export the new file |
| `src/server/repos/assistantSettings.ts`, `src/server/repos/assistantProposals.ts` | created: get/set provider per workspace; record, list pending (not expired, not consumed), consume, consent read/write |
| `src/server/env.ts` | modified: `MCP_ENABLED` (boolean, default false), `MCP_OAUTH_ISSUER`, `MCP_OAUTH_AUDIENCE` (required when enabled), `CREDENTIALS_KEY` (32 bytes, required only under reading a) |
| `.env.example` | modified: the four variables with empty values |
| `src/server/mcp/auth.ts` | created: bearer token verification against the issuer's key set, audience check, mapping of the token subject to a person (by the identity provider's subject stored by 005) |
| `src/server/mcp/server.ts` | created: MCP server registering the two tools from `src/server/llm/tools.ts`; a call runs validation, rate limit, `assertCan`, records the proposal and returns the dashboard shape |
| `src/app/api/mcp/route.ts` | created: Streamable HTTP transport; 404 when `MCP_ENABLED` is false |
| `src/app/api/analyses/[analysisId]/assistant/proposals/route.ts` | created: `GET` pending proposals for the acting person; `POST /{id}/consume` marks one consumed after the client applied it |
| `src/server/llm/index.ts` | modified: provider resolution takes the workspace setting; answers carry `provider` |
| `src/ui/governance/AssistantProviderCard.tsx` | created: radio `Plataforma` / `Copilot do usuário`, Administrador only |
| `src/ui/assistant/ConsentNotice.tsx` | created: the consent text and accept / decline; recorded through the consents repository |
| `src/ui/assistant/PendingProposals.tsx` | created: polls every 10 s while the tab is visible; opens the preview modal for the newest proposal |
| `src/ui/assistant/AssistantTab.tsx` | modified: provider badge `via Copilot` / `via plataforma`, consent notice, pending proposals |
| `src/server/authz/matrix.ts` | modified: action `assistant_settings` for Administrador |
| `package.json` | modified: `@modelcontextprotocol/sdk`, `jose` |
| `tests/e2e/020-copilot-provider.spec.ts` | created: signed MCP call with a test issuer → pending proposal → preview → apply; 401 without token; 404 for a non-member |

## Contracts

- MCP endpoint `POST /api/mcp` (Streamable HTTP) with `Authorization: Bearer <token>`; tools
  `configure_prometeu_dashboard` and `patch_selected_widgets` with the schemas of
  018-assistant-service; the widget patch tool additionally takes `analysisId` and
  `targets: string[]` because there is no studio selection on the inbound path.
- Tool result for both: `{ title, area, period, chartType, records, proposalId }`; the analysis
  is never modified. Errors follow MCP error semantics with the same pt-BR messages as 018.
- `GET /api/analyses/[analysisId]/assistant/proposals` → `{ data: Proposal[], nextCursor: null }`;
  `POST /api/analyses/[analysisId]/assistant/proposals/[proposalId]/consume` → `{ data: { consumed: true } }`.
- Assistant answers of 018 gain the field `provider: 'bedrock' | 'copilot' | 'fake'`. Additive.
- Workspace settings: `PUT /api/workspaces/[workspaceId]/assistant-provider` with
  `{ provider: 'platform' | 'copilot' }`, Administrador only. New.
- Environment: `MCP_ENABLED`, `MCP_OAUTH_ISSUER`, `MCP_OAUTH_AUDIENCE`, `CREDENTIALS_KEY`.
- Authorization matrix gains `assistant_settings` (Administrador).

## Order of work

1. Confirm the reused files exist as described: the tool definitions and rate limiter of
   018, `requireUser`, `assertCan`, the repositories of 007, the preview modal and store
   actions of 019, the governance page of 006 and `env.ts`. If not, return blocked. Also
   confirm every open question of the specification is answered; if not, return blocked —
   this step is where the plan stops today.
2. Migration 0007, Drizzle tables, repositories (Q4: schema migration). Green: repository
   tests against the test database; FR-02020 and NFR-02002 (expiry) with a fake clock;
   `npm run db:migrate` applies and the down file reverts on a scratch database.
3. Provider setting, matrix action, settings route and governance card (Q4: authorisation).
   Green: FR-02001, FR-02006, FR-02008 tests; a non-admin `PUT` answers 403.
4. Bearer-token verification with a test issuer and key set (Q4: authentication). Green:
   FR-02015, FR-02016 tests — no token, bad signature, wrong audience, non-member; FR-02003
   sentinel test over the captured log.
5. MCP server and transport route, tool handlers writing proposals (Q4: exposes a write path
   to an external agent). Green: FR-02014, FR-02017, FR-02018, FR-02010, NFR-02003 tests with
   an in-process MCP client; `revision` unchanged after every call.
6. Consent notice, pending-proposal poll, provider badge in the tab; consents recorded.
   Green: FR-02005, FR-02007 (fake Copilot failure → platform answer), FR-02009, FR-02019,
   NFR-02004 component tests.
7. Dependencies and end-to-end file (Q3: manifest; Q4: end-to-end runs the authentication
   path). Green: `npm run test:e2e` passes the four scenarios.

## What changes under reading (a), outbound

- `src/server/llm/copilot.ts` implements `LlmProvider` against the chosen Copilot's
  completion interface, selected per workspace or per person; FR-02011 to FR-02013 become
  live and FR-02014 to FR-02020 stay dormant (no MCP server, no proposals table, no poll).
- A `user_provider_credentials` table stores the person's token encrypted with
  `CREDENTIALS_KEY` (AES-256-GCM, 32-byte key, NFR-02001), written by a connect flow
  (`GET /api/assistant/copilot/connect` → OAuth authorization code → callback) and deleted by
  `DELETE /api/assistant/copilot` (FR-02009). Q4: cryptography and credentials.
- The consent notice moves to the connect flow, before any token is stored.
- The fallback chain in `src/server/llm/index.ts` tries `copilot` then `bedrock` within the
  25 s bound of 018; the answer's `provider` says which one answered.
- The licence question decides whether this reading is allowed at all.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The open questions are answered with reading (a) after this plan was drafted for (b) | the files table and half the order of work are wrong | the plan stops at step 1 until the questions close; the section above is the replacement outline |
| The chosen Copilot cannot register a third-party MCP server, or requires tenant admin approval | reading (b) impossible for the person | confirmed in the specify phase with the organisation before any code |
| Bearer tokens from the tenant do not map to a Prometeu person (different subject claim) | every inbound call 401 | 005-authentication stores the identity provider's subject; the mapping is by that subject, verified in step 4 with a real token from the tenant |
| An external agent can spam proposals for a person | table growth, noise in the tab | rate limit of 018 counts inbound calls; proposals expire after 10 minutes and are purged by the consume/list repository |
| A widget patch from the inbound path names targets the person did not select | unexpected preview | targets are validated against the analysis, shown in the preview with their titles, and applied only on confirmation |
| Licence or terms of service forbid the chosen integration | the whole spec is void | recorded as an open question; nothing is built before it is answered |

## Human approval required

Every step from 2 to 7: step 2 is a schema migration, steps 3 to 5 are authorisation,
authentication and an externally reachable write path, step 6 records consent, step 7
adds dependencies and runs the authentication path end to end. Under reading (a) the
credential storage and encryption are additionally Q4. A human is at the keyboard for
all of it, and none of it starts before the specification's open questions are closed.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
LLM_PROVIDER=fake MCP_ENABLED=true npm run lint && LLM_PROVIDER=fake MCP_ENABLED=true npm test
npx vitest run src/server/mcp src/server/repos/assistantProposals.test.ts
LLM_PROVIDER=fake MCP_ENABLED=true npm run test:e2e
node .github/tools/spec/traceability.mjs --spec=specs/020-copilot-provider
```

A pass: every command exits 0; an MCP call with a token from the test issuer answers
`{ title, area, period, chartType, records, proposalId }` and leaves the analysis
`revision` unchanged; the same call without a token answers 401 and with a non-member's
token 404; the proposal appears in the assistant tab within 10 seconds, applies on
`Aplicar alterações` as one undo entry, and disappears after 10 minutes if ignored; the
log contains no token; the matrix shows every FR/NFR with at least one test — which is
only possible once every `[NEEDS CLARIFICATION]` in the specification is closed.
