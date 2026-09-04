---
name: codebase-inventory
description: Produce the repository context file that later sessions read instead of rediscovering the codebase. Use once per repository, and again when the structure changes.
version: 1.0.0
sfa: "scope: one repository | format: specs/_context.md | audience: every agent that starts a session in this repository"
stacks: []
alwaysApply: false
---

# codebase-inventory

## Rules

Pay the discovery cost once. Every session that starts by grepping for the build
command, the module layout and the conventions pays for that discovery again, in
tokens and in latency. This file is that work, cached and committed.

The script does what a script can do. It counts files, detects the stack, reads
the scripts block and lists the largest modules, deterministically and for free.
Do not spend model tokens re-deriving anything it already produced.

You supply what it cannot: what the repository is for, which entry point
matters, which conventions the code actually follows, and which parts are
load-bearing despite looking wrong. That last section saves the most time and is
the one most often left out.

Observed, not aspirational. Write the conventions the code follows today. If the
code is inconsistent, say so and name which side is winning.

Commands are a sanction list. An agent may run what is listed here and nothing
else, so a command that is not safe to run unattended does not belong in it.

Anti-patterns to refuse:

- describing the repository from the readme instead of from the code
- listing every directory instead of the ten to twenty that matter
- leaving TODO markers in the committed file
- regenerating it on every commit; it changes when the structure changes

## Workflow

1. Run the script and capture its output as a draft:
   `node .github/skills/codebase-inventory/scripts/inventory.mjs > specs/_context.md`
2. Read the module map it produced. Open the two or three largest modules and
   establish what each one owns.
3. Find the real entry points. Follow them far enough to see the layering.
4. Read three or four files from different modules and write down the
   conventions they share: error handling, logging, naming, test layout.
5. Fill every TODO. Delete any row the script guessed wrong.
6. Write the landmines section last, from what surprised you while reading.
7. Commit the file. It is documentation the agents read, so it belongs in review.

## Output

Follow `templates/context.md`. The sections a script cannot fill look like this:

```
## What this repository is
The billing service. It owns invoice generation and the Stripe webhook. If it
stops, invoices are not issued and payment events are dropped rather than queued.

## Conventions this repository already follows
Errors are wrapped with context and rethrown; nothing is logged and swallowed.
Handlers are thin and delegate to a service module. Tests sit beside the code as
*.spec.ts and use the real database through a per-test transaction.

## Landmines
- src/legacy/rounding.ts looks redundant with money.ts and is not: it reproduces
  a rounding rule the tax authority requires. Changing it changes invoices.
- The webhook handler is idempotent by primary key, not by event id. Retries of
  a modified event silently overwrite.
```

## Validation

- [ ] The script was run and its deterministic output kept.
- [ ] No TODO marker remains in the committed file.
- [ ] The module map is ten to twenty rows, each with what it owns.
- [ ] Every listed command is safe for an agent to run.
- [ ] Conventions describe the code as it is, not as it should be.
- [ ] The landmines section is not empty.
