---
name: go-concurrency
description: Write Go concurrency where every goroutine has an owner and an exit, context cancellation propagates, and shared state is guarded. Use when adding or reviewing goroutines and channels.
version: 1.0.0
sfa: "scope: one concurrent unit | format: goroutines with defined lifetimes and cancellation | audience: Go engineers"
globs: ["**/*.go"]
stacks: [go]
alwaysApply: false
---

# go-concurrency

## Rules

Every goroutine has an owner who knows when it ends. A goroutine blocked on a
channel nobody reads leaks for the life of the process, and leaks are invisible
until the process dies.

Context is the first parameter and is respected. Select on ctx.Done alongside
the work, and return the context error.

The party that creates a channel closes it. Closing from the receiving side, or
from several senders, panics.

Guard shared state with a mutex, or give it to one owner and communicate over a
channel. Do not do both for the same state.

Bound your fan-out. Spawning a goroutine per item over an unbounded input is a
denial of service you wrote yourself. Use a worker pool or a semaphore.

Run the race detector in CI. Races are timing-dependent and will not reproduce
on the machine where you looked for them.

Anti-patterns to refuse:

- time.Sleep used to coordinate goroutines
- a WaitGroup Add inside the goroutine it counts
- sending on a channel without a select on ctx.Done, in code that can be cancelled
- a mutex copied by value along with its struct

## Workflow

1. State what each goroutine does and exactly how it ends.
2. Thread context through and select on cancellation everywhere the work blocks.
3. Choose one coordination mechanism per piece of state: mutex or channel.
4. Bound concurrency explicitly with a pool or a semaphore.
5. Ensure errors from goroutines reach the caller, through a channel or an
   errgroup - a logged-and-dropped error is a silent failure.
6. Run the tests with the race detector.

## Output

```
func FetchAll(ctx context.Context, ids []ID) ([]Item, error) {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(8)

    items := make([]Item, len(ids))
    for i, id := range ids {
        i, id := i, id
        g.Go(func() error {
            item, err := fetch(ctx, id)
            if err != nil {
                return fmt.Errorf("fetching %s: %w", id, err)
            }
            items[i] = item
            return nil
        })
    }
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return items, nil
}
```

## Validation

- [ ] Every goroutine has a defined exit condition.
- [ ] Context cancellation is selected on wherever the work can block.
- [ ] Channels are closed by their sender, once.
- [ ] Concurrency is bounded.
- [ ] Goroutine errors reach the caller.
- [ ] Tests pass under the race detector.
