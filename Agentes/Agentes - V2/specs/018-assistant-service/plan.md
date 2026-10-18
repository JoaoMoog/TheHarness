# Implementation plan: Assistant service

Specification: [spec.md](spec.md)

Written before the repository exists, under these assumptions for the open
questions: no streaming (one JSON answer per call); the rate limit is per person,
10 calls per rolling minute; the maximum message length is 2,000 characters; the
provider sees aggregates only, never rows; one Bedrock region and model id per
environment, owned by whoever owns `.env` for that environment; a Leitor receives
proposals like everyone else and the interface decides what to do with them. A
different answer changes the marked steps only.

## Approach

One route handler builds a bounded context with the engine of 003-query-engine,
checks the deterministic fallbacks first, and only then calls `LlmProvider.complete`
with two tool definitions whose JSON schemas are generated from the zod widget
schema of 002-domain-schema (picked down to the eleven allowlisted keys) and a
hand-written schema for `configure_prometeu_dashboard`. Whatever comes back is parsed
again with the same zod schemas before it is returned; the handler owns no write
path to the analysis. Rejected: calling the Bedrock SDK from the handler and
mapping its shapes inline — the user explicitly asked for either Bedrock or Copilot,
so the seam is the point, and the fake adapter is what makes every other test in this
spec deterministic. Rejected: letting the model call the tool and applying the
result server-side as the prototype did — it violates "the model only proposes" and
would make a prompt injection in a widget title a write to the document.

## Reuse found

- `src/core/schema` (planned in 002-domain-schema): the widget schema and its enums
  are the source of the patch tool's schema and of the output validation; the
  document schema is used to load the analysis.
- `src/core/engine` (planned in 003-query-engine): `select.ts`, `metrics.ts`, `filters.ts`
  and `narrative.ts` supply the context aggregates, the insight sentence and the
  month-over-month narrative. Nothing is recomputed here.
- `src/core/format` (planned in 002-domain-schema): currency and period labels for the
  month-over-month sentence.
- `src/server/auth` `requireUser` (planned in 005-authentication) and `src/server/authz`
  `assertCan` (planned in 006-workspaces-and-roles): the route's identity and membership
  checks. The matrix gains one action, `assistant`, granted to every role.
- `src/server/repos/analyses.ts` `get` and `src/server/repos/sources.ts` `listRows` (planned in
  007-analyses-and-sources-persistence) load the document and the bounded row set.
- `src/server/http` (planned in 001/007): JSON envelope, request parsing, error mapping.
- `src/server/env.ts` and `src/server/log.ts` (planned in 001-app-skeleton): the variables
  `LLM_PROVIDER`, `AWS_REGION`, `BEDROCK_MODEL_ID` are declared optional there and become
  conditionally required here; the logger is used as is.
- Genuinely new: the provider interface and its two adapters, the tool definitions, the
  context builder, the prompt assembly with its data section, the fallback matcher and the
  in-memory rate limiter.

## Files

| File | Change |
|---|---|
| `src/server/llm/provider.ts` | created: `LlmProvider` interface, `CompleteRequest`/`CompleteResult` types, `ProviderError` with a `transient` flag |
| `src/server/llm/index.ts` | created: `getProvider()` selecting `bedrock` or `fake` from `LLM_PROVIDER`; throws at import for an unknown name |
| `src/server/llm/fake.ts` | created: scripted adapter; a test sets the next result (text, tool call, error, delay) |
| `src/server/llm/bedrock.ts` | created: Converse API adapter with tool config, `AbortSignal`, retry on throttling/5xx (max 2), token usage mapping |
| `src/server/llm/tools.ts` | created: `widgetPatchTool` (schema from `src/core/schema` widget `.pick(...)`, `.partial()`, `.strict()`), `dashboardTool`, parsers for both outputs |
| `src/server/llm/context.ts` | created: builds the aggregate context from document, selection, filters and rows; caps 50 groups per widget and 32,000 characters |
| `src/server/llm/prompt.ts` | created: system instructions constant plus the delimited data section; document strings enter only the data section |
| `src/server/llm/fallbacks.ts` | created: normaliser (lower case, NFD strip), matchers for `mes anterior` and `explique|variacao|saldo`, the help text, narrative assembly through the engine |
| `src/server/llm/rateLimit.ts` | created: per-key sliding window of 60 s in a `Map`, `Retry-After` computation |
| `src/server/llm/*.test.ts` | created: co-located unit tests, one id per test |
| `src/server/env.ts` | modified: `LLM_PROVIDER` enum `bedrock \| fake` required; `AWS_REGION` and `BEDROCK_MODEL_ID` required when the provider is `bedrock`; `ASSISTANT_RATE_LIMIT_PER_MINUTE` optional with default 10 |
| `.env.example` | modified: the three assistant variables with empty values |
| `src/server/authz/matrix.ts` | modified: action `assistant` for every role |
| `src/app/api/analyses/[analysisId]/assistant/route.ts` | created: `POST`; requireUser → assertCan → parse → rate limit → load → fallbacks → provider → validate → envelope → log |
| `src/app/api/analyses/[analysisId]/assistant/route.test.ts` | created: handler tests with a plain `Request`, fake provider, real test database |
| `package.json` | modified: dependency `@aws-sdk/client-bedrock-runtime` |
| `tests/e2e/018-assistant-service.spec.ts` | created: signed-in call with the fake provider through the running app: text, patch, 429, 504 |

## Contracts

- `LlmProvider.complete({ system, messages, tools, maxTokens, signal })` →
  `{ text?: string, toolCalls: [{ name, input }], usage: { inputTokens, outputTokens } }`;
  throws `ProviderError({ code: 'timeout' | 'transient' | 'fatal', transient })`.
- `POST /api/analyses/[analysisId]/assistant` with body `{ message: string, selection: string[] }`.
  Response `{ data: { kind: 'text', text, reason? } }`, `{ data: { kind: 'widget_patch', patch, targets } }`
  or `{ data: { kind: 'dashboard', dashboard: { title, area, period, chartType, records } } }`.
  `reason` is one of `recorte_indisponivel`, `saida_invalida`, `provedor_indisponivel`.
  Errors use `{ error: { code, message, field? } }` with codes `unauthenticated` (401),
  `not_found` (404), `validation_error` (400), `rate_limited` (429, plus `Retry-After`),
  `provider_timeout` (504).
- Tool `configure_prometeu_dashboard`: input `{ area?: string, period?: string, chartType?: 'bar' | 'line' | 'table' }`,
  no additional properties, title `Configurar dashboard Prometeu`.
- Tool `patch_selected_widgets`: input is the widget schema picked to `type, top, sort, condition,
  conditionColor, legend, labels, unit, span, dimension, title`, all optional, no additional properties.
- Environment: `LLM_PROVIDER` becomes required (was optional in 001); `AWS_REGION` and
  `BEDROCK_MODEL_ID` required when it is `bedrock`. Breaking for a `.env` that omits it: startup fails
  naming the variable, which is the intended behaviour.
- Authorization matrix gains the action `assistant` (every role). Not breaking.

## Order of work

1. Confirm the reused files exist as described: the widget and document schemas, the engine
   modules named above, `requireUser`, `assertCan` and `matrix.ts`, `analyses.get` and
   `sources.listRows`, the envelope helpers, `env.ts` and `log.ts`. If not, return blocked. Green: nothing changes.
2. Provider interface, fake adapter, `getProvider()`, the environment change and `.env.example`.
   Green: FR-01821 tests (missing region, missing model id, unknown provider name, fake needs
   nothing) and a fake round-trip test pass; `npm run lint` clean.
3. Tool definitions and output parsers. Green: FR-01802, FR-01803, FR-01806 unit tests — every
   allowlisted key accepted with a valid value, every disallowed key or out-of-range value rejected
   with the field path, target outside the selection rejected, unknown tool rejected.
4. Context builder and prompt assembly. Green: FR-01812, FR-01813, NFR-01803, NFR-01806 tests —
   zero rows in the request, groups capped at 50, character cap honoured by dropping groups first,
   instruction section byte-identical with hostile titles.
5. Fallback matcher and narratives. Green: FR-01807, FR-01808, FR-01809, FR-01810 golden tests
   through the engine with the demo dataset.
6. Rate limiter and the route handler with identity, membership, parsing, fallbacks, provider
   call, validation, envelope and log line (Q4: authorization on the route). Green: FR-01801,
   FR-01804, FR-01805, FR-01811, FR-01814 to FR-01820, FR-01822, FR-01823, NFR-01801, NFR-01805
   handler tests against the test database with the fake provider and a fake clock.
7. Bedrock adapter (Q4: credentials via the default chain; Q3: the dependency). Green: unit tests
   with the SDK client mocked prove tool config mapping, abort on signal, two retries then failure,
   usage mapping (NFR-01802, NFR-01804); one manual call against a real model is recorded in the
   pull request, not in CI.
8. End-to-end file. Green: `npm run test:e2e` passes the four scenarios.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Zod-to-JSON-schema conversion emits shapes Bedrock rejects (e.g. `anyOf` for optional keys) | every real call fails at the provider | the tool schema is generated once, snapshot-tested, and hand-checked against the Converse `toolConfig` rules in step 7; enums and optionals only, no unions |
| The model answers with text that embeds a JSON patch instead of a tool call | proposal silently lost | text answers are returned as text; the system instructions ask for tools; a test pins that embedded JSON is not parsed as a patch |
| Prompt injection through widget titles reaches the model regardless of the data section | unwanted proposal | defence in depth: targets restricted to the selection, keys to the allowlist, and nothing is applied without the person's confirmation in 019 |
| In-memory rate limit is per instance | limit multiplied by instance count | known landmine in `_context.md`; tied to the hosting question of 001-app-skeleton |
| Retries plus a 20 s timeout can hold a request for 25 s | Node worker tied up | one `AbortSignal` bounds the whole call including retries (NFR-01804); the limiter counts the call before it starts |
| The `[analysisId]` route path is not captured by the traceability planned-file regex | false "unrequested change" line | known landmine; explained once in the pull request body |
| AWS credentials absent in CI | Bedrock tests fail | CI runs with `LLM_PROVIDER=fake`; the Bedrock adapter is tested with a mocked client |

## Human approval required

Step 6 wires `requireUser` and `assertCan` on a new route and adds a matrix action
(authorisation): Q4. Step 7 wires AWS credentials through the default chain and
adds a dependency: Q4 for the credentials, Q3 for the manifest. Step 2 changes the
startup environment contract: Q2, reviewed after. No cryptography, payment, schema
migration or deletion in this spec.

## Verification

```
npm ci
docker compose up -d db && npm run db:migrate
LLM_PROVIDER=fake npm run lint && LLM_PROVIDER=fake npm test
npx vitest run src/server/llm src/app/api/analyses
LLM_PROVIDER=fake npm run test:e2e
LLM_PROVIDER=bedrock npm run dev            # without AWS_REGION: exits naming AWS_REGION
node .github/tools/spec/traceability.mjs --spec=specs/018-assistant-service
```

A pass: every command exits 0 except the deliberate startup failure, which prints
`AWS_REGION` and never a value; a signed-in `POST` with the fake provider scripted to
return a patch answers `kind: "widget_patch"` with only allowlisted keys and the
analysis `revision` unchanged; the eleventh call within a minute answers 429 with
`Retry-After`; a scripted 21 s delay answers 504; the log file for these calls contains
no message text; and the matrix shows every FR/NFR with at least one test.
