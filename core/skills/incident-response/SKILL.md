---
name: incident-response
description: Work a live production incident: stanch first, understand second, and leave a runbook and a root-cause session behind. Use when something is broken in production right now.
version: 1.0.0
sfa: "scope: one live incident | format: a running log, a mitigation, and a follow-up | audience: whoever is on call, during and after"
stacks: []
alwaysApply: false
---

# incident-response

## Rules

**Stanch first, understand second.** This is the one place in the harness where
the normal order is inverted. Every other track establishes understanding before
changing code; an incident does not, because the cost of the outage is running
while you read.

Mitigation is not a fix. It buys time. The incident is not closed when the graph
recovers — it is closed when a `fix` session for the root cause exists.

**Write while it happens.** Memory rewrites itself within an hour, and the
post-mortem is only worth the accuracy of its timeline. Log what you observed,
what you tried, what it changed, with times. Log what you *knew* at each moment,
not what turned out to be true.

Prefer the reversible mitigation, even when a permanent fix looks close. A roll
back, a flag, a scale-out, a route away. A clever fix under pressure, unreviewed
and untested, is how one incident becomes two.

**Change one thing at a time.** Three simultaneous changes that fix it teach
nothing about which one mattered, and you will need that knowledge tonight.

Stop mitigating when the impact stops. Continuing to improve things while the
incident is technically open keeps everyone in the room and hides when it ended.

Anti-patterns to refuse:

- debugging the cause while the bleeding continues
- a mitigation that cannot be undone
- closing the incident because the alert cleared, with no follow-up open
- a timeline written afterwards from memory
- naming a person anywhere in the record

## Workflow

1. State the impact in one line: who, how many, since when. That line decides
   how aggressive the mitigation is allowed to be.
2. Check the recent changes first. Most incidents are something that shipped.
3. Pick the most reversible mitigation that plausibly stops the impact. Apply
   one change. Observe.
4. If it did not help, undo it before trying the next. Log both.
5. When the impact stops, say so explicitly and stop changing things.
6. Write the runbook entry from what you just did, while it is accurate.
7. Open the `fix` session for the root cause, and link it.
8. Write the post-mortem from the log, not from memory.

## Output

```
IMPACT  checkout 500s for roughly 8% of requests, since 14:20

14:31  paged. error rate 8%, latency normal, no deploy in 6h
14:34  payment provider status page: degraded since 14:15
14:38  MITIGATION enabled the retry-with-backoff flag. one change.
14:41  error rate 1.2%. impact substantially reduced, not zero
14:44  MITIGATION raised the pool from 20 to 40. one change.
14:46  error rate 0.1%. IMPACT ENDED. stopping here.

Cause so far: provider degradation exposed a pool that had no headroom.
Not the cause: our deploy. Ruled out at 14:31.

Follow-up: specs/041-pool-headroom  (fix)
Runbook: docs/runbooks/checkout-5xx.md
```

## Validation

- [ ] The impact was stated in numbers before anything was changed.
- [ ] Each mitigation was one change, logged with its effect.
- [ ] Anything that did not help was undone before the next attempt.
- [ ] The end of impact is marked explicitly.
- [ ] A runbook entry exists, written during or immediately after.
- [ ] A `fix` session for the root cause is open and linked.
- [ ] No person is named anywhere in the record.
