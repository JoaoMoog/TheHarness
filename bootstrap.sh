#!/usr/bin/env sh
# Bootstrap the harness into every git repository beside this one.
#
#   ./bootstrap.sh              scans the parent folder
#   ./bootstrap.sh /path/to/repos [/another/path]
#
# Thin on purpose: all logic lives in bin/harness.mjs so there is one
# implementation to maintain rather than one per shell.
set -eu

HARNESS_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$HARNESS_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required (18 or newer). Install it and run this again." >&2
  exit 1
fi

MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$MAJOR" -lt 18 ]; then
  echo "node 18 or newer is required, found $(node --version)." >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  ROOTS="$*"
else
  ROOTS=".."
fi

echo "Harness: $HARNESS_DIR"
echo "Scanning: $ROOTS"
echo

# shellcheck disable=SC2086
node bin/harness.mjs scan $ROOTS
node bin/harness.mjs link --all
node bin/harness.mjs doctor

echo
echo "Done. Repositories now read their agent configuration from this harness."
echo "Edit anything under core/ and every linked repository sees it immediately."
echo "To remove it everywhere: node bin/harness.mjs unlink --all"
