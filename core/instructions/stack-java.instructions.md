---
applyTo: "**/*.java,**/pom.xml,**/build.gradle*"
description: Java conventions. Activates only in repositories that contain Java.
---

# Java

Prefer Optional as a return type for a value that may be absent - never as a
field or a parameter. Records for immutable data carriers.

Program to interfaces at boundaries; keep implementations package-private where
the language allows.

## Exceptions

Never swallow. An empty catch block, or one that only logs and continues, hides
the failure until it surfaces somewhere unrelated. Wrap with context and
rethrow, or handle it completely. Do not catch Exception broadly to make a
compiler complaint go away.

## Streams and collections

Streams for transformation, loops for side effects. A stream whose forEach
mutates external state is a loop wearing a costume.

Return unmodifiable views from getters. Returning the internal list hands the
caller write access to invariants the class is supposed to protect.

## Persistence

Watch for N+1 with lazy associations - use fetch joins or entity graphs where
the data is actually needed. Keep transactions at the service boundary and
short. Never concatenate into JPQL or native SQL; bind parameters.

## Concurrency

Prefer the executor framework over raw threads, and always shut executors down.
Immutability removes most synchronisation questions before they are asked.

## Nulls

Annotate nullability and check it at the boundary. A requireNonNull on
constructor arguments turns a distant NullPointerException into a local one.
