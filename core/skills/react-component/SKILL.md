---
name: react-component
description: Build React components with correct hook usage, derived rather than duplicated state, and accessible semantics by default. Use when creating or reviewing a component.
version: 1.0.0
sfa: "scope: one component | format: a component with typed props and cleanup | audience: React engineers"
globs: ["**/*.tsx", "**/*.jsx"]
stacks: [react]
alwaysApply: false
---

# react-component

## Rules

Derive, do not duplicate. State that can be computed from other state will
eventually disagree with it. Compute during render.

An effect is for synchronising with something outside React. Transforming data
for display, reacting to a user action, and deriving values are not effects.

Dependency arrays are complete. If a dependency causes a loop, fix the identity
of that value rather than deleting it from the array.

Every subscription, timer, listener and request in an effect returns a cleanup.

Keys come from stable ids in the data. An array index as a key corrupts
component state whenever the list reorders.

Semantics before ARIA. A div with a click handler has no role, no keyboard
support and no focus ring. Use the element that already means what you mean.

Do not memoise by default. Add memo, useMemo or useCallback where a measurement
shows a cost, and note what the measurement was.

Anti-patterns to refuse:

- an effect that sets state derived from props
- dangerouslySetInnerHTML with unsanitised content
- a component that both fetches and renders and formats, with no seam to test

## Workflow

1. Define the props as a type. Required by default; optional only when the
   component genuinely works without it.
2. Identify the minimum state. Everything else is derived.
3. Place remaining side effects in effects, each with cleanup and a complete
   dependency array.
4. Choose semantic elements, then label every interactive element.
5. Handle loading, empty and error states explicitly - all three exist.
6. Test behaviour through the accessible surface: role, label, visible text.

## Output

```
type Props = { userId: UserId; onSelect: (id: UserId) => void };

export function UserCard({ userId, onSelect }: Props) {
  const { data, error, isLoading } = useUser(userId);

  if (isLoading) return <Spinner label="Loading user" />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return <EmptyNote>No user found</EmptyNote>;

  return (
    <button type="button" onClick={() => onSelect(userId)}>
      {data.name}
    </button>
  );
}
```

## Validation

- [ ] No state duplicates something derivable.
- [ ] Every effect synchronises with the outside world and cleans up.
- [ ] Dependency arrays are complete.
- [ ] List keys are stable ids.
- [ ] Interactive elements are semantic, labelled and keyboard reachable.
- [ ] Loading, empty and error states are all handled.
