---
applyTo: "**/session.md,**/tasks.md"
description: Bound context and repeated verification in structured work.
---

# Token economy

One planning pass, one approval, then implement and review. Carry summaries of
at most 120 words and paths; read details only when needed. A clear localized
fix with a new regression test belongs in direct work.
Reuse green checks only for identical content, command, config and environment.
Use the verification runner under tools/verify to record evidence. Session
reports do not invalidate code checks. Re-run only failures or invalidated
checks, and stop when acceptance criteria pass. Two review rounds maximum.
Cross TK is optional; no probing absent tools and no economy calls just to
satisfy a rule. Show actual measurement separately from estimated tokens.
No background memory/consolidation workflow; use /dream explicitly.
