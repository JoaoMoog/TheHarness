# Tasks: Assistant service

Plan: [plan.md](plan.md)

[P] marks a task that can run in parallel: it shares no file with any other
unblocked task and depends on nothing still open. Marking dependent work as
parallel produces conflicts that cost more than the sequencing saved.

| id | task | requirement | files | verified by | depends on | P | Q |
|---|---|---|---|---|---|---|---|
| T1 | provider interface, fake adapter, provider selection from `LLM_PROVIDER`, conditional environment variables, `.env.example` | FR-01821 | `src/server/llm/provider.ts`, `src/server/llm/fake.ts`, `src/server/llm/index.ts`, `src/server/env.ts`, `.env.example` | FR-01821 tests (missing `AWS_REGION`, missing `BEDROCK_MODEL_ID`, unknown name, fake needs nothing); fake round-trip test | - | | Q2 |
| T2 | tool definitions from the widget schema and the dashboard schema, output parsers with allowlist, target and unknown-tool checks | FR-01802, FR-01803, FR-01806 | `src/server/llm/tools.ts`, `src/server/llm/tools.test.ts` | FR-01802, FR-01803, FR-01806 tests; JSON-schema snapshot | T1 | | Q1 |
| T3 | context builder (aggregates, 50 groups, 32,000 characters) and prompt assembly with the delimited data section | FR-01812, FR-01813, NFR-01803, NFR-01806 | `src/server/llm/context.ts`, `src/server/llm/prompt.ts`, `src/server/llm/context.test.ts`, `src/server/llm/prompt.test.ts` | FR-01812, FR-01813, NFR-01803, NFR-01806 tests over the demo dataset | T1 | P | Q2 |
| T4 | fallback matcher, help text, month-over-month and balance narratives through the engine | FR-01807, FR-01808, FR-01809, FR-01810 | `src/server/llm/fallbacks.ts`, `src/server/llm/fallbacks.test.ts` | FR-01807 to FR-01810 golden tests | T1 | P | Q1 |
| T5 | rate limiter, matrix action `assistant`, route handler with identity, membership, parsing, fallbacks, provider call, validation, envelope and log line | FR-01801, FR-01804, FR-01805, FR-01811, FR-01814, FR-01815, FR-01816, FR-01817, FR-01818, FR-01819, FR-01820, FR-01822, FR-01823, NFR-01801, NFR-01805 | `src/server/llm/rateLimit.ts`, `src/server/authz/matrix.ts`, `src/app/api/analyses/[analysisId]/assistant/route.ts`, `src/app/api/analyses/[analysisId]/assistant/route.test.ts` | handler tests with a plain `Request`, fake provider, fake clock and the test database; 50-call p95 timing test | T2, T3, T4 | | Q4 |
| T6 | Bedrock Converse adapter with tool config, abort, bounded retries, usage mapping; dependency; end-to-end file | NFR-01802, NFR-01804 | `src/server/llm/bedrock.ts`, `src/server/llm/bedrock.test.ts`, `package.json`, `tests/e2e/018-assistant-service.spec.ts` | adapter tests with a mocked SDK client; `npm run test:e2e` with the fake provider; one manual real call recorded in the pull request | T5 | | Q4 |

T5 is Q4 because it wires authentication and authorisation on a new route and adds
an action to the permission matrix: a human runs and reviews it. T6 is Q4 because it
wires AWS credentials through the default chain and adds a dependency to the
manifest (the manifest part alone would be Q3). T1 and T3 are Q2 because they change
the startup environment contract and decide what leaves the application towards a
third party: run, then a human reviews before merge.

Each task is small enough to finish and verify on its own, and leaves the
repository building with its tests passing.

## Definition of done

- [ ] Every task complete and individually verified.
- [ ] Every acceptance criterion in the specification has a test.
- [ ] Build, lint and test all pass, and the real output was reported.
- [ ] Anything deliberately left out is written down: no interface, no Copilot adapter,
      no transcript persistence, no streaming, no tool beyond the two, the Bedrock adapter
      verified against a real model only by hand, the six open questions and the
      assumptions the plan took for them.
