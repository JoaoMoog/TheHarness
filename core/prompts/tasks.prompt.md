---
mode: agent
description: Decompose a plan into atomic tasks, outside a session.
version: 2.0.0
---

Decompose the plan below using the `task-decomposition` skill and
`templates/tasks.md`.

Mark a task parallel only when it shares no file with any other unblocked task.
Give every task an oversight quadrant, and default anything touching auth,
crypto, payment, a schema, a deletion or an infrastructure apply to Q4.

Produce the task list only; implement nothing.

For multi-step work prefer `/feature`, which runs this phase inside a session.

Plan: ${input:plan}
