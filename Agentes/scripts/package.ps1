param(
  [switch]$SkipBuild,
  [ValidatePattern('^SpeedCode(-[0-9]+\.[0-9]+\.[0-9]+)?$')]
  [string]$PackageName='SpeedCode'
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
  if(-not $SkipBuild) {
    Push-Location (Join-Path $projectRoot 'ui')
    try { & npm ci; if($LASTEXITCODE -ne 0){throw 'npm ci falhou'}; & npm run build; if($LASTEXITCODE -ne 0){throw 'Build frontend falhou'} } finally {Pop-Location}
    & (Join-Path $PSScriptRoot 'build.ps1') -Action build -Release
  }
  $binary=Join-Path $projectRoot 'target\x86_64-pc-windows-gnullvm\release\speedcode.exe'
  if(-not (Test-Path -LiteralPath $binary)){throw 'Release ausente: execute build.ps1 -Action build -Release'}
  $packageDir=Join-Path (Join-Path $projectRoot 'dist') $PackageName
  New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
  Copy-Item -LiteralPath $binary -Destination (Join-Path $packageDir 'SpeedCode.exe') -Force
  $loader=Join-Path (Split-Path $binary -Parent) 'WebView2Loader.dll'
  if(-not(Test-Path -LiteralPath $loader)){throw 'WebView2Loader.dll ausente; execute build.ps1 novamente'}
  Copy-Item -LiteralPath $loader -Destination $packageDir -Force
  $llvmRoot=Join-Path (Split-Path $projectRoot -Parent) 'JTK\.build\llvm-mingw-20260908-ucrt-x86_64'
  if($env:SPEEDCODE_LLVM){$llvmRoot=$env:SPEEDCODE_LLVM} elseif($env:AGENTDESK_LLVM){$llvmRoot=$env:AGENTDESK_LLVM}
  $runtime=Join-Path $llvmRoot 'bin\libunwind.dll'
  if(-not(Test-Path -LiteralPath $runtime)){throw "Runtime libunwind.dll ausente: $runtime"}
  Copy-Item -LiteralPath $runtime -Destination $packageDir -Force
  $ruff=Join-Path $projectRoot 'target\formatter-runtime\bin\ruff.exe'
  $ruffLicense=Join-Path $projectRoot 'target\formatter-runtime\ruff-0.16.10.dist-info\licenses\LICENSE'
  if(-not(Test-Path -LiteralPath $ruff)){throw 'Ruff ausente: execute scripts/setup-formatters.ps1 antes de empacotar'}
  $ruffVersion=& $ruff --version
  if($LASTEXITCODE -ne 0 -or "$ruffVersion".Trim() -ne 'ruff 0.16.10'){throw 'Ruff incompatível: execute scripts/setup-formatters.ps1 para preparar 0.16.10'}
  $formatters=Join-Path $packageDir 'formatters'
  New-Item -ItemType Directory -Path $formatters -Force | Out-Null
  Copy-Item -LiteralPath $ruff -Destination $formatters -Force
  Copy-Item -LiteralPath $ruffLicense -Destination (Join-Path $formatters 'RUFF-LICENSE.txt') -Force
  Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $packageDir -Force
  Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\PORTABLE.txt') -Destination (Join-Path $packageDir 'LEIA-ME.txt') -Force
  Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\PERFORMANCE.md') -Destination (Join-Path $packageDir 'CONTRATO-DESEMPENHO.md') -Force
  Copy-Item -LiteralPath (Join-Path $projectRoot 'openspec\changes\v070-chat-worktree\validation.md') -Destination (Join-Path $packageDir 'VALIDACAO-DESEMPENHO.md') -Force
  Write-Output "Distribuição pronta: $packageDir\SpeedCode.exe"
} finally {Pop-Location}
