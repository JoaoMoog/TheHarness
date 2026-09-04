---
name: python-packaging
description: Set up reproducible Python projects with declared dependencies, a committed lock file and an isolated environment. Use when starting a project or fixing dependency drift.
version: 1.0.0
sfa: "scope: one Python project | format: pyproject configuration plus a lock file | audience: Python engineers"
globs: ["**/pyproject.toml", "**/requirements*.txt", "**/setup.py"]
stacks: [python]
alwaysApply: false
---

# python-packaging

## Rules

Dependencies are declared in pyproject.toml and locked in a committed lock file.
A requirements file with open ranges and no lock reproduces a different
environment on every machine and every day.

Separate runtime dependencies from development ones. Shipping the test framework
to production is both waste and attack surface.

Never install project dependencies into the system interpreter. Use a virtual
environment or a tool that manages one.

Pin the Python version the project supports and check it in CI, not only in a
readme.

Prefer the src layout. A flat layout lets tests import the working directory
instead of the installed package, so packaging errors surface after release
rather than in CI.

Anti-patterns to refuse:

- a lock file listed in gitignore
- installing dependencies from application code
- an unpinned transitive that only breaks on a clean install
- a setup script that reads a requirements file at build time

## Workflow

1. Declare name, version, Python requirement and dependencies in pyproject.toml.
2. Split development dependencies into an optional group.
3. Generate the lock file and commit it.
4. Create the environment from the lock, never from the loose declaration.
5. Add a CI job that installs from the lock on a clean runner and runs the suite.
6. Verify the package imports from an install, not from the source directory.

## Output

```
[project]
name = "orders"
version = "0.3.0"
requires-python = ">=3.11"
dependencies = ["httpx>=0.27,<0.28", "pydantic>=2.6,<3"]

[project.optional-dependencies]
dev = ["pytest>=8", "mypy>=1.9", "ruff>=0.4"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/orders"]
```

## Validation

- [ ] Dependencies are declared in pyproject.toml, not only in a requirements file.
- [ ] A lock file exists and is committed.
- [ ] Development dependencies are separated from runtime.
- [ ] CI installs from the lock on a clean runner.
- [ ] The package imports from an install, not from the source tree.
- [ ] The supported Python version is enforced, not merely documented.
