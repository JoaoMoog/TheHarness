---
mode: agent
description: Turn a specification into an implementation plan, outside a session.
version: 2.0.0
---

Produce an implementation plan for the specification below using the
`plan-writing` skill and `templates/plan.md`. Write no code.

Search the repository for existing functions, modules and utilities before
proposing anything new, and record what you found. Finding nothing is a result
worth stating.

Flag every step that touches authentication, authorisation, cryptography or
payment, or that destroys data, as needing human approval before it runs.

For multi-step work prefer `/feature`, which runs this phase inside a session
with the specification already in hand.

Specification: ${input:spec}
