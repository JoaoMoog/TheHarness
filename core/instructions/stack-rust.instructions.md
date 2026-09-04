---
applyTo: "**/*.rs,**/Cargo.toml"
description: Rust conventions. Activates only in repositories that contain Rust.
---

# Rust

## Errors

Libraries define their own error type and implement std Error; applications use
a context-carrying wrapper. Either way, an error says what operation failed, not
only what went wrong underneath.

Unwrap and expect belong in tests, in main, and in cases where the invariant is
proven immediately above. Everywhere else, propagate with the question mark
operator. An expect in library code is a panic with a comment attached.

Do not swallow with ok(). Discarding a Result silently is the same defect as an
empty catch block in any other language.

## Ownership and borrowing

Take the least you need: a shared reference first, a mutable reference if you
must, ownership only when you keep it. A function taking String where it reads
a string slice forces every caller to allocate.

Clone deliberately, not to satisfy the borrow checker. A clone that exists only
to end an argument usually hides a lifetime that wants to be shorter.

Reach for interior mutability only when shared mutation is genuinely required,
and say why at the declaration.

## Unsafe

Every unsafe block carries a safety comment stating the invariant that makes it
sound and who upholds it. An unsafe block with no such comment is a defect,
regardless of whether it currently works.

## Concurrency

Send and Sync are checked by the compiler; deadlock is not. Order lock
acquisition consistently and keep critical sections short. Do not hold a lock
across an await.

Bound your channels. An unbounded channel turns backpressure into memory growth.

## Idioms

Prefer iterators and combinators to index loops. Use the type system for state:
an enum with data beats a struct of optional fields that cannot all be set.

Derive Debug on public types. A type nobody can print is a type nobody can
diagnose.

## Build

Warnings as errors in CI. Run clippy and treat its lints as the review it is.
Commit Cargo.lock for binaries; for libraries, do not.
