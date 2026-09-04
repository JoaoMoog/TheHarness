# Runbook: <symptom as someone would describe it at 3am>

Owner: <team>
Last verified: <YYYY-MM-DD>

A runbook is read by a tired person who did not write it. Every line is an
instruction or an observation. Nothing here explains the architecture.

## You are here if

The signal that brings someone to this page. An alert name, an error string, a
graph shape. Be specific enough that the wrong runbook is obviously the wrong one.

## Check first

| # | check | command | what a healthy answer looks like |
|---|---|---|---|
| 1 | | | |
| 2 | | | |

Stop at the first check that fails. That is your branch.

## Act

| if check | do this | expected effect | how long |
|---|---|---|---|
| 1 fails | | | |
| 2 fails | | | |

Say what each action costs. Restarting the pool drops in-flight requests; the
person needs to know that before they run it, not after.

## If none of that worked

Escalate to <who>, via <where>, with: the alert, which checks you ran, and what
they returned. Do not keep trying variations past <n> minutes.

## Do not

The actions that look right and make it worse. This section is why the runbook
is worth more than the person's instincts at 3am.

## After

Open a `fix` session for the root cause. Mitigation is not a fix, and a runbook
that keeps being used is a defect nobody scheduled.
