$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$runtime=Join-Path $projectRoot 'target\formatter-runtime'
& python -m pip install --upgrade --no-deps --target $runtime 'ruff==0.16.10'
if($LASTEXITCODE -ne 0){throw 'Não foi possível preparar Ruff. Python/pip são necessários somente na máquina de build.'}
Write-Output "Ruff portátil preparado em $runtime. Nenhuma instalação global foi alterada."
