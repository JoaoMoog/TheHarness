---
name: dotnet-async
description: Write correct async C# with cancellation flowing end to end and no sync-over-async deadlocks. Use when adding or reviewing asynchronous code in a .NET project.
version: 1.0.0
sfa: "scope: one async call path | format: async methods with cancellation and disposal | audience: .NET engineers"
globs: ["**/*.cs"]
stacks: [dotnet]
alwaysApply: false
---

# dotnet-async

## Rules

Async all the way down. Blocking on a task with Result or Wait deadlocks in a
synchronisation context and wraps the real failure in an AggregateException.

Take a CancellationToken on every async method that can be cancelled, pass it
onward, and honour it. A token that is accepted and ignored is worse than none,
because callers believe cancellation works.

Async void only for event handlers. Anywhere else an exception becomes
unobservable and can bring the process down.

Use ConfigureAwait(false) in library code, where no context is needed. In
application code it is noise.

Do not fire and forget. An unawaited task loses its exception and its ordering.
If work must outlive the request, hand it to something that owns and observes it.

ValueTask is for hot paths that usually complete synchronously, and is awaited
exactly once.

Anti-patterns to refuse:

- Task.Run around already-async I/O
- an async method with no await, returning a completed task by accident
- a lock held across an await
- a sequential await loop over independent work

## Workflow

1. Follow the call path from entry point to I/O. Any synchronous link makes the
   whole path synchronous.
2. Add CancellationToken to each signature and thread it through.
3. Replace blocking calls with awaits.
4. For independent work, gather tasks and await them together rather than in
   sequence.
5. Confirm every disposable is disposed, using await using for async disposal.
6. Test cancellation: cancel mid-flight and assert the operation stops.

## Output

```
public async Task<Order> GetOrderAsync(OrderId id, CancellationToken ct)
{
    // One connection per concurrent query: most ADO.NET providers reject a
    // second command on a connection that is already reading.
    var orderTask = _orders.FindAsync(id, ct);
    var itemsTask = _items.ForOrderAsync(id, ct);

    var order = await orderTask;
    var items = await itemsTask;

    return order.With(items);
}
```

Awaiting each task, rather than reading Task.Result after WhenAll, keeps the
method consistent with its own checklist and unwraps the real exception
instead of an AggregateException.
## Validation

- [ ] No Result or Wait on a task anywhere in the path.
- [ ] CancellationToken is accepted, passed on and honoured.
- [ ] No async void outside an event handler.
- [ ] Independent work runs concurrently, not in a sequential await loop.
- [ ] No lock is held across an await.
- [ ] Cancellation is covered by a test.
