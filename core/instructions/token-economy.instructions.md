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

The first read of a session goes through it. Where the server is known for
the repository, the harness refuses a built-in read or search until a Cross TK
tool has been used, so use it before anything else, not after the first
detour.

First run: when `.harness/crosstk.json` does not exist, look for the server in
your own tool list, by a name matching `cross-tk` or a description that names
it. Found: write that file with `server`, `tools` (the names exactly as your
tool list shows them) and `discoveredAt`, then use it first. The harness reads
the file from then on, to state the obligation and to recognise your calls, so
the names never have to be written anywhere else. Not found: say so once,
write nothing, use the built-in tools, and do not probe or retry.

## Read once

Re-read a file only when it changed since the last read, or when the first read
was partial and the missing part is needed now. What is already in context is
reused, not re-derived.

## Verify in proportion

A verification result holds until the tree changes. Record what ran and the
tree state it ran on (`node .github/tools/verify/tree-state.mjs`). Later steps
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
