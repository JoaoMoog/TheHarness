<#
    Bootstrap the harness into every git repository beside this one.

        .\bootstrap.ps1                     scans the parent folder
        .\bootstrap.ps1 D:\Repos C:\Work    scans the folders you name

    Thin on purpose: all logic lives in bin/harness.mjs so there is one
    implementation to maintain rather than one per shell. No admin rights are
    needed - directory junctions do not require elevation.
#>
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Roots)

$ErrorActionPreference = 'Stop'
$harnessDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $harnessDir

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error 'node is required (18 or newer). Install it and run this again.'
    exit 1
}

$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) {
    Write-Error "node 18 or newer is required, found $(node --version)."
    exit 1
}

if (-not $Roots -or $Roots.Count -eq 0) { $Roots = @('..') }

Write-Host "Harness: $harnessDir"
Write-Host "Scanning: $($Roots -join ', ')"
Write-Host ''

node bin/harness.mjs scan @Roots
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node bin/harness.mjs link --all
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node bin/harness.mjs doctor

Write-Host ''
Write-Host 'Done. Repositories now read their agent configuration from this harness.'
Write-Host 'Edit anything under core/ and every linked repository sees it immediately.'
Write-Host 'To remove it everywhere: node bin/harness.mjs unlink --all'
