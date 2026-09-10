---
applyTo: "**"
description: Keeps verification, re-reads and review scope proportional to the change, and says how a token-saving MCP server such as Cross TK is used when one is connected.
---

# Token economy

## Cross TK

Cross TK is the default, not an option. Whenever the MCP server whose name
matches `cross-tk` (any spelling: `crosstk`, `cross_tk`) is connected, every
read, search, summary, diff and token count it covers goes through it; the
built-in tools are the fallback for what it does not cover. Learn what it
offers from the tool descriptions, once per session. Never assume a tool name
or a signature, and never call it only to satisfy this rule.

Not connected: say so in one line, use the built-in tools, and do not probe or
retry. The session start reports whether one is configured in this repository.

## Read once

Re-read a file only when it changed since the last read, or when the first read
was partial and the missing part is needed now. What is already in context is
reused, not re-derived.

## Verify in proportion

A verification result holds until the tree changes. Record what ran and the
tree state it ran on (`node .github/tools/verify/tree-state.mjs`). A later step
reuses that record unless its contract requires an independent run: the
reviewer's first pass does; rubric scoring, deliver and retries do not.

Inside a loop, re-run the check that failed first. The full build, lint and
suite run once, on the final tree, before success is reported.

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
