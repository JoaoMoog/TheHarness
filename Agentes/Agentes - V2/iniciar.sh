#!/bin/sh
set -eu
if ! command -v node >/dev/null 2>&1; then
  echo 'Instale Node.js 24 LTS em https://nodejs.org e abra novamente o terminal.' >&2
  exit 1
fi
task_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
exec node "$task_directory/iniciar.mjs" "$@"
