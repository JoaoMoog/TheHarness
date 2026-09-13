---
applyTo: "**"
description: Keeps verification, re-reads and review scope proportional to the change.
---

# Token economy

## Read once

Re-read a file only when it changed since the last read, or when the first read
was partial and the missing part is needed now. What is already in context is
reused, not re-derived.

## Verify in proportion

A verification result holds until the tree changes. Record what ran and the
tree state it ran on (`node .agents/tools/verify/tree-state.mjs`). Later steps
reuse a green record for the same state; review adds the targeted check on the
changed files, and runs the suite itself only when the state differs or the
record is missing, `not-run` or red.

Inside a loop, re-run the check that failed first. The full build, lint and
suite run once per tree state, on the final tree, before success is reported.

Done is done: every check passed on the final tree and the request is
satisfied. Another round needs a new failure, an open finding or an unchecked
risk. Polish is not a reason.

## Scope of findings

Only what the change introduced or altered can block. A problem that already
existed in a touched file is a WARN: one line with location, problem and
suggested improvement. It is never fixed uninvited, never scored below the
threshold, and never opens another round. Before flagging missing error
handling, check what the application already has: middleware, filters, global
handlers. A handler they cover is not a finding.

```
WARN src/OrdersController.cs:88 - GetOrder swallows the repository exception and returns 200 - let it propagate to the exception filter
```
