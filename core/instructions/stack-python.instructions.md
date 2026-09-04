---
applyTo: "**/*.py,**/pyproject.toml,**/requirements*.txt"
description: Python conventions. Activates only in repositories that contain Python.
---

# Python

Type hints on every public function. Run a type checker in CI; hints that are
never checked drift into fiction.

## The traps that bite

- **Mutable default arguments.** `def f(items=[])` shares one list across every
  call. Use `None` and build inside.
- **Bare `except:`** catches `KeyboardInterrupt` and `SystemExit`. Catch the
  exception you expect, and use `raise ... from err` to keep the chain.
- **Late binding in closures.** A lambda in a loop captures the variable, not
  its value.
- **Truthiness on collections and zero.** `if not value` is not `if value is
  None`.

## Structure

Prefer a dataclass or a Pydantic model over a dict passed between functions — a
dict has no contract and no editor support.

Comprehensions when they fit on one readable line; a loop when they do not.
Generators for anything that could be large.

Use `pathlib` over string paths, and context managers for every resource.

## Async

Do not call blocking I/O inside a coroutine — it stalls the whole loop. Push it
to a thread with `asyncio.to_thread`.

## Packaging

Declare dependencies in `pyproject.toml`, pin them in a lock file, and commit
the lock. Never `pip install` into the system interpreter for project work.
