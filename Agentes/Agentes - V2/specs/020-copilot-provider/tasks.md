# Tasks: Copilot provider

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

**Blocked.** The specify phase of this specification does not close until its six
open questions are answered; every task below is a sketch under reading (b) of the
plan and is Q4 regardless of its content, because the direction, the credential
handling and the transport are all still undecided. No task here is started, and no
task is marked parallel, until that happens.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | migration 0007 with its down file, Drizzle tables, settings and proposals repositories with expiry | FR-02020, NFR-02002 | `src/server/db/migrations/0007_assistant_provider.sql`, `0007_assistant_provider.down.sql`, `src/server/db/schema/assistant.ts`, `src/server/db/schema/index.ts`, `src/server/repos/assistantSettings.ts`, `src/server/repos/assistantProposals.ts` | repository tests against the test database with a fake clock; migrate up and down on a scratch database | - | | Q4 |
| T2 | workspace provider setting: matrix action, settings route, provider resolution and `provider` on answers, governance card | FR-02001, FR-02006, FR-02008 | `src/server/authz/matrix.ts`, `src/server/llm/index.ts`, `src/app/api/workspaces/[workspaceId]/assistant-provider/route.ts`, `src/ui/governance/AssistantProviderCard.tsx` | FR-02001, FR-02006, FR-02008 tests; non-admin `PUT` answers 403 | T1 | | Q4 |
| T3 | bearer-token verification against the issuer's key set, audience check, subject → person mapping, environment variables | FR-02003, FR-02015, FR-02016, NFR-02001 | `src/server/mcp/auth.ts`, `src/server/mcp/auth.test.ts`, `src/server/env.ts`, `.env.example` | FR-02015, FR-02016 tests with a test issuer; FR-02003 sentinel search of the captured log; NFR-02001 key-length startup test | T1 | | Q4 |
| T4 | MCP server registering the two tools, transport route, tool handlers that validate, rate-limit, record a proposal and return the dashboard shape | FR-02010, FR-02014, FR-02017, FR-02018, NFR-02003 | `src/server/mcp/server.ts`, `src/server/mcp/server.test.ts`, `src/app/api/mcp/route.ts`, `src/app/api/analyses/[analysisId]/assistant/proposals/route.ts` | FR-02010, FR-02014, FR-02017, FR-02018 tests with an in-process MCP client; `revision` unchanged; NFR-02003 50-call timing | T2, T3 | | Q4 |
| T5 | consent notice with recorded acceptance, pending-proposal poll opening the preview modal, provider badge, platform fallback on Copilot failure and disconnect | FR-02002, FR-02005, FR-02007, FR-02009, FR-02019, NFR-02004 | `src/ui/assistant/ConsentNotice.tsx`, `src/ui/assistant/PendingProposals.tsx`, `src/ui/assistant/AssistantTab.tsx`, `src/ui/assistant/ConsentNotice.test.tsx` | FR-02002, FR-02005, FR-02007, FR-02009, FR-02019, NFR-02004 component tests with mocked `fetch` and fake timers | T4 | | Q4 |
| T6 | dependencies and the end-to-end file: signed MCP call → proposal → preview → apply; 401; 404 | FR-02004, FR-02011, FR-02012, FR-02013 | `package.json`, `tests/e2e/020-copilot-provider.spec.ts` | `npm run test:e2e`; FR-02004 and FR-02011 to FR-02013 covered by tests that assert the dormant reading's requirements are not reachable when its adapter is absent, to be rewritten if reading (a) is chosen | T5 | | Q4 |

Every task is Q4: T1 is a schema migration; T2 changes authorisation; T3 is
authentication; T4 opens an externally reachable path that writes proposals; T5
records consent and drives the apply flow; T6 adds dependencies and exercises the
authentication path end to end (the manifest alone would be Q3). Under reading (a),
T3 and T4 are replaced by the credential store with encryption and the outbound
adapter, both Q4 as well. Six tasks because the authentication module and the MCP
server are each a full human sitting.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: the reading not chosen (its
      requirements stay dormant and are tested only as unreachable), no second Copilot, no
      source rows to any Copilot, no credential storage under reading (b), the six open
      questions and the assumption the plan took for each.
