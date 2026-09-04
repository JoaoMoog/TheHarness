---
applyTo: "**/*.tsx,**/*.jsx"
description: React component and hook rules. Activates only in repositories that contain JSX.
---

# React

## Hooks

Dependency arrays are complete. If a dependency causes a loop, fix the identity
of that value — do not delete it from the array.

`useEffect` is for synchronising with something outside React. Deriving state
from props, transforming data for render, and responding to an event do not
belong in an effect: compute during render, or do it in the handler.

Every effect that subscribes, times, or fetches returns a cleanup.

## State

Keep state as low in the tree as it is used, and derive rather than duplicate. A
piece of state that can be computed from another piece of state will eventually
disagree with it.

Keys on lists are stable ids from the data. An array index as a key corrupts
state whenever the list reorders.

## Rendering

Do not optimise with `memo`, `useMemo` and `useCallback` by default. Add them
where a measurement shows a real cost, and note what the measurement was.

Never call `dangerouslySetInnerHTML` with anything that came from a user or an
API without sanitising it first.

## Server and client boundaries

In frameworks with server components, keep secrets and data access on the server
side and pass serialisable data down. A `use client` directive at the top of a
shared module drags everything it imports into the client bundle.

## Accessibility

Semantic elements before ARIA. A `div` with an `onClick` is not a button: it has
no role, no keyboard handling, and no focus. Every input has a label, and every
image has alt text or an explicit empty alt.
