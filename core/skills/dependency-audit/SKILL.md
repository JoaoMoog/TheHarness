---
name: dependency-audit
description: Assess a dependency before adding it and keep the tree healthy afterwards, weighing maintenance, transitive weight and vulnerability exposure. Use when adding, upgrading or reviewing dependencies.
version: 1.0.0
sfa: "scope: one dependency or one lock file | format: a keep, replace or inline recommendation | audience: the engineer deciding"
globs: ["**/package.json", "**/requirements*.txt", "**/pyproject.toml", "**/go.mod", "**/Cargo.toml", "**/pom.xml", "**/*.csproj"]
stacks: []
alwaysApply: false
---

# dependency-audit

## Rules

Every dependency is a permanent commitment: to its bugs, its vulnerabilities,
its transitive tree, and to whoever maintains it. Fifteen lines you own beat a
package you do not.

Judge it on: is it maintained, how large is the transitive tree, what
permissions does it need for what it does, is the licence compatible, and how
hard is it to remove later.

Pin versions and commit the lock file. An unpinned dependency turns an unrelated
install into an unreviewed upgrade.

A vulnerability report is triaged, not obeyed reflexively. Determine whether the
vulnerable path is reachable from your code before treating it as an emergency,
and say which it is.

Upgrade deliberately, one major at a time, reading the changelog. A batch
upgrade that breaks something gives you no bisect.

Anti-patterns to refuse:

- adding a package to avoid writing a small function
- a dependency that needs network or filesystem access unrelated to its purpose
- an unpinned range in a lock-less project
- suppressing an advisory without recording why it is not reachable

## Workflow

1. State what problem the dependency solves and what writing it yourself costs.
2. Check maintenance: last release, open issue behaviour, whether one person is
   the sole maintainer.
3. Check weight: transitive count, install size, and whether it duplicates
   something already in the tree.
4. Check licence compatibility.
5. Run the ecosystem audit command and triage each finding for reachability.
6. Pin and commit the lock file.
7. Record the decision where the next person will find it.

## Output

```
Package: left-pad-plus 2.4.0
Solves: padding a string, used in one formatter
Cost to inline: about 8 lines
Maintenance: last release 3 years ago, 14 open issues, single maintainer
Weight: 4 transitive packages
Licence: MIT, compatible
Advisories: 1 moderate, prototype pollution, reachable from our call site

Recommendation: do not add. Inline the 8 lines.
```

## Validation

- [ ] The cost of writing it yourself was considered explicitly.
- [ ] Maintenance, weight and licence were checked.
- [ ] The audit command was run and each finding triaged for reachability.
- [ ] Versions are pinned and the lock file is committed.
- [ ] Any suppressed advisory has a recorded reason.
