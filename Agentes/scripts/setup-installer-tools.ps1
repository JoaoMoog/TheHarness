param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$toolsDir = Join-Path $projectRoot 'target\installer-tools'
$compiler = Join-Path $toolsDir 'nsis-3.13\makensis.exe'
$archive = Join-Path $toolsDir 'nsis-3.13.zip'
# Pinned bytes downloaded from the official NSIS SourceForge distribution.
$archiveHash = 'BA63DFFC4410EE89193E1CB5A41989991BD77C61068DA17E3156D136B7B0B3D8'
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri 'https://downloads.sourceforge.net/project/nsis/NSIS%203/3.13/nsis-3.13.zip' -OutFile $archive
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveHash) {
    throw 'O ZIP do NSIS não corresponde ao SHA256 fixado. Não será executado.'
}
if (-not (Test-Path -LiteralPath $compiler)) {
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsDir -Force
}
$bootstrapper = Join-Path $toolsDir 'MicrosoftEdgeWebview2Setup.exe'
if (-not (Test-Path -LiteralPath $bootstrapper)) {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrapper
}
$signature = Get-AuthenticodeSignature -LiteralPath $bootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|, )O=Microsoft Corporation(,|$)') {
    throw 'O bootstrapper WebView2 não tem assinatura válida da Microsoft. Não será empacotado.'
}
Write-Output "NSIS local: $compiler"
Write-Output 'Bootstrapper WebView2 Microsoft verificado. Nenhuma ferramenta foi instalada globalmente.'
