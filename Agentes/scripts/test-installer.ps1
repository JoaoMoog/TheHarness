param([string]$NsisCompiler = $env:SPEEDCODE_NSIS)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'setup-installer-tools.ps1')
if (-not $NsisCompiler) { $NsisCompiler = Join-Path $projectRoot 'target\installer-tools\nsis-3.13\makensis.exe' }
$NsisCompiler = (Resolve-Path -LiteralPath $NsisCompiler).Path
$runId = [guid]::NewGuid().ToString('N')
$fixture = Join-Path $projectRoot ".validation\installer-$runId"
$installDir = Join-Path $fixture 'installed'
$dataDir = Join-Path $fixture 'user-data'
$payload = Join-Path $fixture 'payload'
$appId = "SpeedCode.InstallerTest.$runId"
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$appId"
$productionRegPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SpeedCode.Desktop'
$productionBefore = if (Test-Path -LiteralPath $productionRegPath) { (Get-ItemProperty -LiteralPath $productionRegPath | Select-Object DisplayVersion,InstallLocation | ConvertTo-Json -Compress) } else { '' }
New-Item -ItemType Directory -Path $payload,$dataDir -Force | Out-Null
$files = @('SpeedCode.exe','WebView2Loader.dll','libunwind.dll','README.md','LEIA-ME.txt','CONTRATO-DESEMPENHO.md','VALIDACAO-DESEMPENHO.md','formatters\ruff.exe','formatters\RUFF-LICENSE.txt')
foreach ($file in $files) {
    $source = Join-Path $projectRoot "dist\SpeedCode\$file"
    if (-not (Test-Path -LiteralPath $source)) { throw "Prepare o pacote com scripts/package.ps1 antes: falta $file" }
    $destination = Join-Path $payload $file
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}
# Generated fixtures, not real settings, login, projects or source-file edits.
Set-Content -LiteralPath (Join-Path $payload 'must-not-ship.env') -Value 'NOT_A_REAL_SECRET' -Encoding UTF8
Set-Content -LiteralPath (Join-Path $dataDir 'settings.json') -Value '{"theme":"unchanged","login":"mock-only"}' -Encoding UTF8
$dataHash = (Get-FileHash -LiteralPath (Join-Path $dataDir 'settings.json')).Hash
$checks = [System.Collections.Generic.List[object]]::new()

function Assert-InstallerTest([bool]$Condition, [string]$Description) {
    if (-not $Condition) { throw "FAIL: $Description" }
    Write-Output "PASS: $Description"
    $checks.Add([pscustomobject]@{ check = $Description; passed = $true })
}
function Compile-TestInstaller([string]$Version, [switch]$RuntimeFailure) {
    $tag = if ($RuntimeFailure) { 'runtime-failure' } else { $Version }
    $output = Join-Path $fixture "setup-$tag.exe"
    $defines = @('/DINSTALLER_TEST', "/DAPP_ID=$appId", "/DAPP_VERSION=$Version", "/DPAYLOAD_DIR=$payload", "/DOUTPUT_FILE=$output", "/DPROJECT_DIR=$projectRoot", "/DWEBVIEW_BOOTSTRAPPER=$projectRoot\target\installer-tools\MicrosoftEdgeWebview2Setup.exe")
    if ($RuntimeFailure) { $defines += '/DTEST_RUNTIME_FAILURE' }
    & $NsisCompiler /WX /V2 @defines (Join-Path $projectRoot 'installer\SpeedCode.nsi') | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Test installer compilation failed: $LASTEXITCODE" }
    return $output
}
function Run-TestInstaller([string]$Path, [int]$Expected, [string]$Destination = $installDir) {
    $arguments = "/S /D=$Destination"
    $process = Start-Process -FilePath $Path -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(60000)) { throw 'Installer test exceeded 60 seconds; fixture retained for inspection.' }
    Assert-InstallerTest ($process.ExitCode -eq $Expected) "setup expected=$Expected actual=$($process.ExitCode)"
}
function Read-TestVersion { (Get-ItemProperty -LiteralPath $regPath).DisplayVersion }
function Assert-Payload {
    foreach ($file in $files) {
        Assert-InstallerTest ((Get-FileHash -LiteralPath (Join-Path $installDir $file)).Hash -eq (Get-FileHash -LiteralPath (Join-Path $payload $file)).Hash) "payload intact: $file"
    }
    Assert-InstallerTest (-not (Test-Path -LiteralPath (Join-Path $installDir 'must-not-ship.env'))) 'allowlist excludes unrelated files'
}

try {
    $initial = Compile-TestInstaller '9.0.0'
    $update = Compile-TestInstaller '9.0.1'
    $older = Compile-TestInstaller '8.9.9'
    $failure = Compile-TestInstaller '9.0.2' -RuntimeFailure
    Run-TestInstaller $initial 0
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.0') 'initial registration version'
    Assert-Payload
    $shortcutDir = Join-Path ([Environment]::GetFolderPath('StartMenu')) "Programs\SpeedCode Test $appId"
    Assert-InstallerTest (Test-Path -LiteralPath (Join-Path $shortcutDir 'SpeedCode.lnk')) 'Start Menu shortcut created'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $shortcutDir 'SpeedCode.lnk'))
    Assert-InstallerTest ($shortcut.TargetPath -eq (Join-Path $installDir 'SpeedCode.exe')) 'shortcut targets the installed app'
    Assert-InstallerTest ($shortcut.WorkingDirectory -eq $installDir) 'shortcut starts in the application directory'
    $null = [Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)
    $null = [Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    $unknownFile = Join-Path $installDir 'user-file.keep'
    Set-Content -LiteralPath $unknownFile -Value 'preserve user file' -Encoding UTF8

    # Fail closed if the installed app is in use; never kill or launch a real app.
    $held = [IO.File]::Open((Join-Path $installDir 'SpeedCode.exe'), [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try { Run-TestInstaller $update 11 } finally { $held.Dispose() }
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.0') 'locked files do not update registration'
    Assert-Payload

    $mutex = [Threading.Mutex]::new($false, "Local\$appId.Setup")
    try { Run-TestInstaller $update 13 } finally { $mutex.Dispose() }
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.0') 'concurrent installer blocked before mutation'

    $otherDir = Join-Path $fixture 'must-not-move-existing-install'
    Run-TestInstaller $update 0 $otherDir
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.1') 'upgrade without uninstall updates registration'
    Assert-InstallerTest ((Get-ItemProperty -LiteralPath $regPath).InstallLocation -eq $installDir) 'upgrade uses existing directory'
    Assert-InstallerTest (-not (Test-Path -LiteralPath $otherDir)) 'upgrade ignores an alternative destination'
    Assert-InstallerTest (Test-Path -LiteralPath $unknownFile) 'upgrade preserves unknown user files'
    Assert-Payload

    Run-TestInstaller $older 10
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.1') 'downgrade blocked before mutation'
    Assert-Payload
    Run-TestInstaller $failure 12
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.1') 'simulated WebView2 failure preserves installation'
    Assert-Payload

    Set-Content -LiteralPath (Join-Path $installDir 'README.md') -Value 'damaged fixture' -Encoding UTF8
    Run-TestInstaller $update 0
    Assert-Payload
    Assert-InstallerTest ((Read-TestVersion) -eq '9.0.1') 'same version repairs payload'

    $uninstaller = Join-Path $installDir 'Uninstall.exe'
    $marker = Join-Path $installDir 'speedcode-install.ini'
    $markerCopy = Join-Path $fixture 'original-install.ini'
    Copy-Item -LiteralPath $marker -Destination $markerCopy
    Set-Content -LiteralPath $marker -Value "[Install]`r`nAppId=wrong-fixture-id" -Encoding ASCII
    # _?= keeps the uninstaller in-process, so an early rejection has a direct exit code.
    $rejected = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$installDir" -WindowStyle Hidden -PassThru
    if (-not $rejected.WaitForExit(60000)) { throw 'Uninstaller ownership test exceeded 60 seconds' }
    Assert-InstallerTest ($rejected.ExitCode -eq 13) 'uninstaller refuses an incorrect ownership marker'
    Assert-InstallerTest (Test-Path -LiteralPath (Join-Path $installDir 'SpeedCode.exe')) 'uninstaller rejection preserves installed app'
    Copy-Item -LiteralPath $markerCopy -Destination $marker -Force
    $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -PassThru
    if (-not $uninstallProcess.WaitForExit(60000)) { throw 'Uninstaller test exceeded 60 seconds' }
    # NSIS normally re-executes the uninstaller from TEMP; wait for its child.
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ((Test-Path -LiteralPath $regPath) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
    Assert-InstallerTest (-not (Test-Path -LiteralPath $regPath)) 'uninstall removes only test registration'
    Assert-InstallerTest (-not (Test-Path -LiteralPath (Join-Path $installDir 'SpeedCode.exe'))) 'uninstall removes application payload'
    Assert-InstallerTest (-not (Test-Path -LiteralPath (Join-Path $shortcutDir 'SpeedCode.lnk'))) 'uninstall removes its shortcut'
    Assert-InstallerTest (Test-Path -LiteralPath $unknownFile) 'uninstall preserves unknown user files'
    Assert-InstallerTest ((Get-FileHash -LiteralPath (Join-Path $dataDir 'settings.json')).Hash -eq $dataHash) 'settings sentinel unchanged across install/upgrade/uninstall'
    $productionAfter = if (Test-Path -LiteralPath $productionRegPath) { (Get-ItemProperty -LiteralPath $productionRegPath | Select-Object DisplayVersion,InstallLocation | ConvertTo-Json -Compress) } else { '' }
    Assert-InstallerTest ($productionBefore -eq $productionAfter) 'real installation registry untouched'
    $report = [ordered]@{ schemaVersion = 1; utc = [DateTime]::UtcNow.ToString('o'); realInstallers = $true; runtimeFailureSimulated = $true; applicationLaunched = $false; checks = $checks.ToArray() }
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $fixture 'report.json') -Encoding UTF8
    Write-Output "Installer test passed; report: $fixture\report.json"
} finally {
    # Uninstall only this registered fixture on early failures, never broad rm/rmdir.
    if (Test-Path -LiteralPath $regPath) {
        $registered = (Get-ItemProperty -LiteralPath $regPath).InstallLocation
        if ($registered -eq $installDir -and (Test-Path -LiteralPath (Join-Path $installDir 'Uninstall.exe'))) {
            Start-Process -FilePath (Join-Path $installDir 'Uninstall.exe') -ArgumentList '/S' -WindowStyle Hidden -Wait
        }
    }
}
