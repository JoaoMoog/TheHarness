# Post-mortem: <what broke>

Date: <YYYY-MM-DD>
Duration: <detection to mitigation>
Impact: <who was affected, how many, for how long, in numbers>

## What happened

A timeline in plain sentences. Times, and what was known at each one — not what
was true, what was *known*. The gap between the two is usually the finding.

| time | event | who knew |
|---|---|---|
| | | |

## Why it happened

The chain, not the last link. Keep asking what allowed the previous answer until
you reach something the team controls.

## Why it took that long to notice

Detection is a separate failure from the cause, and usually the more expensive
one. If a human noticed before the monitoring did, that is the headline.

## What we are changing

| # | change | owner | tracked as |
|---|---|---|---|
| 1 | | | |

Each one is a real ticket with a person. "Be more careful" is not a change, and
"add more monitoring" is not one either until it names the signal.

## What we are not changing

The tempting fixes that were considered and rejected, with the reason. Without
this, the same suggestion arrives at the next incident.

## Blameless

Name systems, not people. A person who could cause this outage is a system that
allowed one person to cause it.
