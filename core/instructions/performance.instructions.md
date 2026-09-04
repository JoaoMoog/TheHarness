---
applyTo: "**"
description: Performance rules for every file. The other 14.5% coverage gap; most config sets describe how to build, not how fast it must be.
---

# Performance

## Measure before you optimise

Do not restructure code for speed without a measurement showing where the time
goes. A profile, a timing, or a query plan — not intuition. State the number you
started from and the number you reached; "faster" without a figure is not a
result.

The corollary matters just as much: do not add caching, pooling, batching or
memoisation speculatively. Each one is state you now have to invalidate.

## The costs that actually dominate

In order of how often they are the real problem:

1. **N+1 queries and requests.** A loop that queries per item. Fetch the set in
   one round trip and join in memory, or use the ORM's eager loading.
2. **Unbounded result sets.** Any query without a limit will eventually be run
   against a table where it matters. Paginate at the boundary.
3. **Work repeated per request that could be done once.** Compiling a regex,
   parsing config, building a lookup table.
4. **Blocking the event loop or the request thread.** Synchronous file, crypto
   or CPU work inside a handler.
5. **Payload size.** Selecting every column, returning every field, shipping an
   unbounded array to a client.

Algorithmic complexity is the last thing to look at, not the first — quadratic
code on ten items is fine, linear code that opens a connection per item is not.

## Data access

Index the columns you filter, join and sort on, and know that an index has a
write cost. Select the columns you use. Keep transactions short and do not do
network calls inside them.

## Allocation and memory

Streaming beats loading a whole file. Reuse buffers on hot paths. Watch for
listeners, timers, and subscriptions that are registered and never removed —
that is the usual shape of a leak.

## Front-end specifics

Budget the bundle and check it in CI. Load below-the-fold and route-level code
lazily. Keep list rendering keyed and stable. Do not re-create callbacks and
objects passed to memoised children on every render.

## Budgets

State the budget where it can be checked, not in a comment: a CI assertion on
bundle size, a timeout on a request, a limit on a query. A performance rule with
no enforcement decays within a quarter.
