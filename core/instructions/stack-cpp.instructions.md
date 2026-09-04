---
applyTo: "**/*.cpp,**/*.cc,**/*.hpp,**/*.h,**/CMakeLists.txt"
description: C++ conventions with an emphasis on memory and lifetime safety. Activates only in repositories that contain C++.
---

# C++

## Ownership

Ownership is expressed in the type. unique_ptr for sole ownership, shared_ptr
only where ownership is genuinely shared, raw pointers and references only for
non-owning observation whose lifetime is obviously shorter than the owner.

No bare new or delete in application code. Use make_unique and make_shared.

Follow the rule of zero: if a class needs a destructor, copy constructor or
assignment operator, consider whether a redesign removes the need.

## Lifetime

The most common defect in this language is a reference outliving what it refers
to. Watch for: returning a reference to a local, storing a string_view or span
past the lifetime of its buffer, capturing by reference in a lambda that escapes
the scope, and iterators invalidated by a container mutation.

## Correctness

Const by default, on methods and on parameters. Constexpr where the value is
known at compile time. Explicit on single-argument constructors.

Prefer standard containers and algorithms over hand-written loops and C arrays.
Prefer enum class over plain enums.

Check every index and size conversion; comparing a signed and an unsigned value
is a silent bug generator.

## Concurrency

Guard shared state with a mutex and a scoped lock, never by hand. Atomics are
for single values, not a substitute for a lock around an invariant that spans
several. Run the thread and address sanitisers in CI.

## Build

Warnings as errors. Enable the broad warning set for the toolchain and treat a
new warning as a failing build, not as noise.
