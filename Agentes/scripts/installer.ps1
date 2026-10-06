param(
    [switch]$SkipBuild,
    [string]$NsisCompiler = $env:SPEEDCODE_NSIS
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    & (Join-Path $PSScriptRoot 'setup-installer-tools.ps1')
    if (-not $NsisCompiler) { $NsisCompiler = Join-Path $projectRoot 'target\installer-tools\nsis-3.13\makensis.exe' }
    $NsisCompiler = (Resolve-Path -LiteralPath $NsisCompiler).Path
    & (Join-Path $PSScriptRoot 'package.ps1') -SkipBuild:$SkipBuild
    $cargo = Get-Content -LiteralPath 'Cargo.toml' -Raw
    if ($cargo -notmatch '(?m)^version\s*=\s*"(\d+\.\d+\.\d+)"') { throw 'Versão de release inválida no Cargo.toml' }
    $version = $Matches[1]
    $payload = Join-Path $projectRoot 'dist\SpeedCode'
    $binaryVersion = (Get-Item -LiteralPath (Join-Path $payload 'SpeedCode.exe')).VersionInfo.FileVersion
    if ([version]$binaryVersion -ne [version]$version) { throw 'EXE não corresponde ao Cargo.toml; faça um build release antes de gerar o instalador.' }
    $outputDir = Join-Path $projectRoot 'dist\installer'
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    $output = Join-Path $outputDir "SpeedCode-$version-Setup.exe"
    $defines = @("/DAPP_VERSION=$version", "/DPAYLOAD_DIR=$payload", "/DOUTPUT_FILE=$output", "/DPROJECT_DIR=$projectRoot", "/DWEBVIEW_BOOTSTRAPPER=$projectRoot\target\installer-tools\MicrosoftEdgeWebview2Setup.exe")
    & $NsisCompiler /WX /V2 @defines (Join-Path $projectRoot 'installer\SpeedCode.nsi')
    if ($LASTEXITCODE -ne 0) { throw "Compilação do instalador falhou: $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $output)) { throw 'NSIS não gerou o instalador esperado' }
    $hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash
    Write-Output "Instalador pronto: $output"
    Write-Output "SHA256: $hash"
    Write-Output 'Ainda sem assinatura Authenticode do SpeedCode: SmartScreen/políticas corporativas podem alertar ou bloquear.'
} finally { Pop-Location }
