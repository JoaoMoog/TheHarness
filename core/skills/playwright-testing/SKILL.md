---
name: playwright-testing
description: Validate changed web behavior with existing Playwright tests or explore a browser with Playwright CLI. Use for UI regressions and explicit browser checks.
---

# Playwright testing

Requires Node.js and a local test server. Reuse the project package manager and installed Playwright version.

## Rules

Use Playwright Test for repeatable assertions. Use playwright-cli only for
exploration/diagnosis when available; it is not a passing regression test.
Load this skill for web changes or an explicit browser request. API-only and
text-only tasks keep their own targeted checks. No always-on browser MCP.

## Workflow

1. Read the project's manifest and existing Playwright config. Reuse its
   package manager, baseURL, webServer, fixtures and test conventions.
2. If missing, include Playwright setup in the change plan before modifying
   dependencies. Installing the harness alone never installs project packages.
3. Reproduce the affected user flow with getByRole/getByLabel and await expect.
   Use isolated contexts, deterministic fixtures and no fixed sleep delays.
4. Run the affected test on Chromium through tools/verify/run.mjs, using a
   JSON argv command and an environment fingerprint for browser/server/data.
   Do not reuse browser evidence across changed server state or credentials.
5. If needed, use playwright-cli --help and a task-specific session for
   diagnosis. Inspect only relevant snapshots. Close the browser afterwards.
6. Record failure details, trace on first CI retry and screenshot on failure.
   Run Firefox/WebKit only for cross-browser scope or the complete suite.

## Output

flow: <observable user behavior>
command: <actual command>
result: passed | failed | blocked | not-run
artifacts: <test, verification record, trace/screenshot on failure>
limitations: <missing server/browser/test credentials or none>

## Validation

Missing prerequisites never count as passed. Keep assertions that expose real
regressions; do not weaken them to turn a failure green. No production data,
publication actions or new global dependencies. Prefer CLI + skill for bounded
exploration: https://github.com/microsoft/playwright-cli .
