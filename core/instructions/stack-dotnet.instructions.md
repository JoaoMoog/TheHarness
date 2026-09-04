---
applyTo: "**/*.cs,**/*.csproj,**/*.sln"
description: C# and .NET conventions. Activates only in repositories that contain C# projects.
---

# C# and .NET

Enable nullable reference types. A warning suppression needs a comment saying
why the value cannot be null.

Prefer records for data carried between layers, and keep them immutable. Expose
`IReadOnlyList` and `IReadOnlyDictionary` from public members rather than the
mutable interfaces.

## Async

Async all the way down. `.Result` and `.Wait()` deadlock in synchronisation
contexts and hide the real failure inside an `AggregateException`.

Pass `CancellationToken` through every async call that can take one, and honour
it. Use `ConfigureAwait(false)` in library code, not in application code.

`async void` only for event handlers. Anywhere else it makes failures
unobservable.

## Data access

Watch for N+1 with lazy loading — use `Include` deliberately or project into a
DTO with `Select`. Add `AsNoTracking` to read-only queries.

Never interpolate into raw SQL. `FromSqlInterpolated` parameterises; string
concatenation does not.

## Dependency injection

Register with the narrowest lifetime that works, and never resolve a scoped
service from a singleton — that captures the first scope forever.

## Exceptions

Do not use exceptions for control flow. Rethrow with `throw;`, never
`throw ex;`, which erases the stack trace.

## Disposal

Anything holding a handle, socket or stream is disposed — `using` declarations
in methods, `IAsyncDisposable` where the cleanup is async. Do not dispose an
`HttpClient` you got from a factory.
