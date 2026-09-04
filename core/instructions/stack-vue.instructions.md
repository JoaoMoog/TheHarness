---
applyTo: "**/*.vue"
description: Vue conventions. Activates only in repositories that contain single-file components.
---

# Vue

## Reactivity

Know what loses reactivity: destructuring a reactive object, replacing a
reactive array by assignment through a stale reference, and passing a ref into a
function that reads it without unwrapping. When a value stops updating, look
there before looking at the template.

Prefer ref for single values and reactive for objects you keep whole. Mixing
both for the same state is where the confusion starts.

Computed properties are pure. A computed that mutates, fetches or logs will run
at times you did not intend.

## Component boundaries

Props are typed and are read-only. Mutating a prop works until the parent
re-renders and then silently stops working.

Emit typed events rather than passing callbacks down. The event list is the
component contract, and a callback prop hides it.

Provide and inject are for genuinely cross-cutting state. Used for ordinary
parent-to-child data they make a component impossible to test in isolation.

## Watchers

A watcher is for synchronising with something outside Vue. Deriving state is a
computed. Reacting to a user action is a handler.

Clean up anything a watcher starts, and use the immediate flag deliberately
rather than as a habit.

## Templates

Never bind unsanitised content to v-html; that is the framework's injection
surface.

Keys on v-for come from stable ids in the data, never the index. Do not combine
v-if and v-for on the same element: the precedence is not what most readers
expect.

## Structure

Script setup with the composition API for new components. Extract shared logic
into composables that return refs, not into mixins.

Handle loading, empty and error states explicitly. All three exist.
