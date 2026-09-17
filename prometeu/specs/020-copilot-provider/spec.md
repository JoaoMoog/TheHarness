# Specification: Copilot provider

Status: draft
Owner: João Moog

## Problem

The person who asked for the rewrite said the language model behind the assistant
would be reached "via copilot do usuário ou conexão via AWS Bedrock". The Bedrock half
is specified in 018-assistant-service. The Copilot half is ambiguous in a way that
produces two different systems, and this specification exists to hold that ambiguity
open rather than resolve it quietly.

Reading (a), outbound: Prometeu calls a Copilot service on the person's behalf, using a
credential that belongs to that person, through the same provider seam that Bedrock uses.
The application then stores or brokers a per-person credential, shows a consent notice,
and must respect the licence terms of calling that service from a server.

Reading (b), inbound: the person's own Copilot (GitHub Copilot in an editor, Microsoft 365
Copilot, or a Copilot Studio agent) calls Prometeu. Prometeu exposes its two assistant
tools — `configure_prometeu_dashboard` and the widget patch tool of 018-assistant-service —
through a Model Context Protocol server, and the person's Copilot decides when to call them.
The prototype hints at this reading: `app.js` registers `configure_prometeu_dashboard`
through `document.modelContext.registerTool` with an input schema, `readOnlyHint: false`
and `untrustedContentHint: true`, which is the shape of a tool offered to an external agent,
not of a call the application makes.

Under either reading, what must not change is the guarantee of 018-assistant-service: the
model proposes, the application validates, the person confirms. Under (b) that guarantee
also changes the prototype's behaviour: the tool applied the change and returned
`{title, area, period, chartType, records}`; here it records a proposal and returns the
same shape without touching the analysis.

## Goal

The assistant can use the person's Copilot as its model provider — in whichever direction
the open questions settle — with the provider chosen per workspace, credentials that never
reach source or logs, consent shown before first use, and Bedrock as the fallback when the
Copilot path is unavailable.

## Out of scope

- The Bedrock adapter, the tool schemas, the validation and the deterministic fallbacks
  (018-assistant-service); this specification reuses them unchanged.
- The chat interface and the preview modal (019-assistant-ui); this specification adds at
  most a provider badge, a consent notice and a pending-proposal entry point to them.
- Any Copilot beyond the one named by the open questions; no support for several at once.
- Training, fine-tuning or sending source rows to any Copilot.
- Implementing anything before the open questions are answered; the plan is a sketch.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-02001 | Ubiquitous | An Administrador SHALL be able to select, for a workspace, whether the assistant uses the platform provider or the person's Copilot, with the current choice shown on the governance page. |
| FR-02002 | Optional | WHERE the Copilot credential belongs to the person rather than the workspace, the person SHALL be able to override the workspace choice for themselves between the two providers. |
| FR-02003 | Ubiquitous | No Copilot credential, token, client secret or endpoint key SHALL appear in the source tree, in the container image or in any log line, verified by a test that searches the captured log for a sentinel token value. |
| FR-02004 | Ubiquitous | Every stored Copilot credential SHALL be encrypted at rest with a key supplied by the environment, so that a raw database dump contains no plaintext credential. |
| FR-02005 | Event | WHEN the person's Copilot is about to be used for the first time, the application SHALL proceed only after the person accepts a consent notice stating what is sent (the message, the selected widgets' configuration and aggregated figures, never source rows) and to which service. |
| FR-02006 | Unwanted | IF the person has not accepted the consent notice, or has withdrawn it, THEN the assistant SHALL answer through the platform provider and mark the answer with the provider used. |
| FR-02007 | Unwanted | IF the Copilot path fails (credential rejected, service unavailable, timeout), THEN the assistant SHALL answer through the platform provider within the total time bound of 018-assistant-service and mark the answer with the provider used. |
| FR-02008 | Ubiquitous | Every assistant answer SHALL carry the name of the provider that produced it, so the interface can show `via Copilot` or `via plataforma`. |
| FR-02009 | Event | WHEN the person disconnects their Copilot, the application SHALL delete the stored credential immediately and route the next call through the platform provider. |
| FR-02010 | Ubiquitous | The per-person rate limit of 018-assistant-service SHALL count calls through the Copilot path and the platform path together. |
| FR-02011 | Optional | WHERE the outbound adapter is configured, the application SHALL call the Copilot service with the credential of the acting person only, never with a shared or service credential. |
| FR-02012 | Optional | WHERE the outbound adapter is configured, a proposal returned by the Copilot service SHALL pass through the same tool validation as a Bedrock proposal, so that the same scripted output yields the same validated proposal from either adapter. |
| FR-02013 | Unwanted | IF the outbound adapter is configured and the person's credential has expired, THEN the application SHALL answer through the platform provider and invite the person to reconnect with `Reconecte seu Copilot para voltar a usá-lo.`. |
| FR-02014 | Optional | WHERE the inbound server is enabled, the application SHALL expose `configure_prometeu_dashboard` and the widget patch tool to Model Context Protocol clients with the same input schemas as 018-assistant-service, over an authenticated transport. |
| FR-02015 | Unwanted | IF an inbound tool call carries no valid credential, THEN the application SHALL refuse it with 401. |
| FR-02016 | Unwanted | IF the credential's person is not a member of the analysis's workspace, THEN the application SHALL refuse the inbound tool call with 404 and the same body as for a missing analysis. |
| FR-02017 | Optional | WHERE the inbound server is enabled, WHEN a valid tool call arrives, the application SHALL record, after validating it exactly as a provider tool call, a pending proposal for that person and analysis, leaving the analysis's document and `revision` unchanged. |
| FR-02018 | Optional | WHERE the inbound server is enabled, WHEN a valid tool call arrives, the application SHALL return `{ title, area, period, chartType, records }` computed from the proposal, with `records` the number of source rows the proposed area and period select. |
| FR-02019 | Optional | WHERE the inbound server is enabled, the studio SHALL show a pending proposal in the assistant tab as a preview that follows the confirm-and-apply flow of 019-assistant-ui, never applying it on its own. |
| FR-02020 | Unwanted | IF a pending proposal is not confirmed within its lifetime, THEN it SHALL expire and no longer be shown. |
| NFR-02001 | Ubiquitous | Credentials at rest SHALL be encrypted with authenticated encryption using a 32-byte key from the environment; startup SHALL refuse a key of any other length naming the variable. |
| NFR-02002 | Ubiquitous | A pending proposal SHALL expire 10 minutes after it is recorded. |
| NFR-02003 | Ubiquitous | An inbound tool call SHALL be answered within 300 ms at p95 excluding credential verification network time, measured over 50 calls on the continuous-integration runner. |
| NFR-02004 | Ubiquitous | The consent notice SHALL be shown at most once per person per provider until withdrawn, and its acceptance SHALL be recorded with a timestamp. |

## Open questions

`[NEEDS CLARIFICATION: which Copilot — GitHub Copilot (editor or chat), Microsoft 365 Copilot, or a Copilot Studio agent? Each has a different integration surface, credential and licence.]`

`[NEEDS CLARIFICATION: direction — does Prometeu call Copilot (outbound, reading a) or does the person's Copilot call Prometeu (inbound, reading b)? They are different systems: a provider adapter versus a Model Context Protocol server.]`

`[NEEDS CLARIFICATION: credential ownership, storage and consent — is the credential the person's own, brokered by an organisation tenant, or a workspace-level key? Who stores it, where, and what consent text is required by the organisation?]`

`[NEEDS CLARIFICATION: licensing and terms of service — does the chosen Copilot's licence permit server-side or programmatic use on the person's behalf? If not, only reading (b) is possible.]`

`[NEEDS CLARIFICATION: if inbound, which transport and authentication — Streamable HTTP with OAuth bearer tokens from which issuer, or another mechanism? This decides the server's authentication module and who can register the tool.]`

`[NEEDS CLARIFICATION: is the provider choice per workspace, per person, or both? A single level removes one of the two requirements.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/020-copilot-provider
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
