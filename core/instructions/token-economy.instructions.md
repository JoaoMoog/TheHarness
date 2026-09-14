---
applyTo: "**"
description: Keeps reads, verification, review scope and the shape of the answer proportional to the change, and says where a token-saving MCP server such as Cross TK pays.
---

# Token economy

Every model call resends the whole context, every tool result enters it, and
every sub-agent opens another one. Fewer calls, smaller reads and shorter
answers are the saving.

## Cross TK

When the MCP server named like `cross-tk` is connected, use it where it
returns less than the built-in tool would, and nowhere else: one symbol out
of a file over ~300 lines; a workspace-wide text search, grouped and capped;
the shape of a repository with no `_context.md`, once; a summary before
reading a large file whole.

Read directly: small files, files already in context, files you just edited,
exact line ranges. Never its write tool (edits go through the editor, where
the diff is reviewable and the guardrails run), never its cache or economy
tools inside a task, never a call made to satisfy this rule. Learn its tools
from their descriptions, once per session; never assume a name. Absent: one
line if asked, no probing.

Tests, `git diff`, `git log` and listings run as `crosstk run <cmd>` when the
binary is on PATH; the harness rewrites the common ones itself. Builds and
linters run plain: a compiler error needs its detail.

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

## Shape of the answer

Output costs several times what input does. Answer in the shape the step
needs: the diff, the check output that matters, one status line, the envelope
a phase requires. No preamble, no restating the request, no unasked
explanation. A phase summary is at most 120 words.
