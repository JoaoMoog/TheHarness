---
applyTo: "**/*.go,**/go.mod"
description: Go conventions. Activates only in repositories that contain Go.
---

# Go

Handle every error where it happens. A discarded error needs a comment
justifying it. Wrap with context on the way up using the %w verb, and inspect
with errors.Is and errors.As rather than comparing strings.

Return early. Go code reads top to bottom with the happy path unindented.

## Concurrency

Every goroutine has a defined end. A goroutine writing to a channel nobody reads
leaks for the life of the process.

Pass context.Context as the first parameter and respect cancellation. Never
store a context in a struct.

Guard shared state with a mutex, or hand it to one owner over a channel. Run the
race detector in CI, not just locally.

Loop variable capture in a goroutine is a bug in Go before 1.22 - check the go
directive in go.mod before assuming it is safe.

## API shape

Accept interfaces, return structs. Define the interface where it is consumed,
and keep it to the methods that consumer actually calls.

Exported identifiers have doc comments starting with the identifier name.

## Resources

Defer the close immediately after the open, and check the error from Close on
anything you wrote to.
