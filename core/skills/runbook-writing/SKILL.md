---
name: runbook-writing
description: Write a runbook a tired stranger can follow at 3am, with checks that branch and actions that state their cost. Use after an incident, or when a manual procedure is repeated.
version: 1.0.0
sfa: "scope: one symptom | format: checks then branching actions | audience: whoever is on call, who did not write it"
stacks: []
alwaysApply: false
---

# runbook-writing

## Rules

Write for a tired person who did not build the system and is being paged for the
first time. Every line is an instruction or an observation. Explanation of how
the system works belongs somewhere else.

**Start from the signal, not the component.** The reader arrives holding an
alert name or an error string, not a theory. If the title is not what they are
staring at, they will not find the page.

Checks come before actions, and they **branch**. A list of things to try in
order, with no decision between them, is a person changing random variables in
production.

**Every action states its cost.** Restarting the pool drops in-flight requests.
Scaling out takes four minutes. Failing over loses the read replica. The reader
needs that before the command, not after.

Include a **do not** section. The actions that look right and make it worse are
the reason the page is worth more than the reader instincts at 3am.

**Bound the escalation.** Say who, where, with what, and after how long. Without
a time limit, people keep trying variations until the outage is long instead of
short.

A runbook has a last-verified date. One that has not been walked through since
the system changed is worse than none, because it is trusted.

Anti-patterns to refuse:

- a wall of prose with the commands buried in it
- an action with no expected effect, so the reader cannot tell if it worked
- "investigate the logs" as a step
- a runbook that keeps getting used and never becomes a fix

## Workflow

1. Name the symptom exactly as the alert or the error states it.
2. Write the checks, in the order that splits the problem space fastest, each
   with what a healthy answer looks like.
3. For each failing check, write the action, its expected effect and its cost.
4. Write the do-not section from what went wrong before.
5. Write the escalation: who, where, with what, after how long.
6. Walk it end to end yourself, out loud, as if paged. Fix what you had to
   improvise. That improvisation is the missing step.
7. Date it.

## Output

```markdown
# Checkout returning 5xx

## You are here if
Alert `checkout-error-rate` fired, or 502s in the checkout span.

## Check first
| # | check | command | healthy |
|---|---|---|---|
| 1 | did we deploy? | `az pipelines runs list --top 3` | nothing in the last hour |
| 2 | provider up? | open status.provider.com | all green |
| 3 | pool exhausted? | `curl -s :9090/metrics \| grep pool_in_use` | under 15 of 20 |

## Act
| if | do | effect | cost |
|---|---|---|---|
| 1 fails | roll back the release | errors stop in ~2 min | in-flight checkouts fail once |
| 3 fails | raise the pool to 40 | errors stop in ~30 s | more DB connections, safe to 60 |

## Do not
Restart the API to clear the pool. It drops every in-flight checkout and the
pool refills within a minute anyway.

## Escalate
After 15 minutes with no improvement: #payments-oncall, with the alert, the
checks you ran and their output.
```

## Validation

- [ ] The title is the signal the reader is holding.
- [ ] Checks come before actions and branch to them.
- [ ] Every check states what healthy looks like.
- [ ] Every action states its expected effect and its cost.
- [ ] There is a do-not section.
- [ ] Escalation names who, where, with what, and after how long.
- [ ] It was walked end to end, and it is dated.
