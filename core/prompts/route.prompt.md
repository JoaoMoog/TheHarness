---
mode: ask
description: Decide whether a request goes to the generalist, to a skill, to a specialist agent, or to a full session.
version: 2.0.0
---

Apply the decision tree in `.github/instructions/routing.instructions.md` to the
request below. Answer the questions in order and stop at the first yes.

1. Is this multi-step work that needs a specification, a plan and review?
   Yes: `@orchestrator`, via `/feature`.
2. Does it need tools only a specialist holds?
   Yes: name the agent whose tool manifest lists them.
3. Does it need a fixed output contract another step will parse?
   Yes: name that agent.
4. Does a skill in `.github/skills/` already cover it? Search by description
   before concluding none does.
   Yes: the generalist plus that skill.

None of the above: the generalist alone. If the same kind of request has come up
three times, say that the skill should be written.

Return the routing decision, which question produced it, and the exact agent,
skill or command to use. Do not start the work.

Request: ${input:request}
