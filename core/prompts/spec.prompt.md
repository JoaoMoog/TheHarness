---
mode: agent
description: Write a specification with EARS acceptance criteria, outside a session.
version: 2.0.0
---

Write a specification for the request below using the `spec-writing` skill and
`templates/spec.md`. Produce the specification only: no plan, no code.

For multi-step work prefer `/feature`, which runs the same phase inside a
session and records the result where the later phases can find it. Use this
prompt when you want a specification on its own.

Stop and ask rather than assuming when an ambiguity would change the shape of
the result.

Request: ${input:request}
