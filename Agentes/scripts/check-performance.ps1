param(
  [Parameter(Mandatory=$true)][string]$ExePath,
  [ValidateRange(5,60)][int]$Seconds=15,
  [double]$MaxIdleCpuPercent=2.0,
  [double]$MaxWorkingSetMiB=900,
  [double]$MaxGrowthMiB=128
)
$ErrorActionPreference='Stop'
# Explicit controlled idle scenario only. Never starts/kills processes or changes
# system settings. Include descendants, not just the small Rust host process.
$report=& (Join-Path $PSScriptRoot 'measure-process-tree.ps1') -ExePath $ExePath -Seconds $Seconds -PassThru
$report | Select-Object * -ExcludeProperty Samples | Format-List
$violations=@()
if($report.MeanMachineCpuPercent -gt $MaxIdleCpuPercent){$violations+='CPU média acima da meta de repouso'}
if($report.PeakWorkingSetMiB -gt $MaxWorkingSetMiB){$violations+='Working set acima da meta do cenário'}
if($report.WorkingSetGrowthMiB -gt $MaxGrowthMiB){$violations+='Crescimento de memória acima da meta do cenário'}
if($violations.Count){throw ($violations -join '; ')}
Write-Output 'PASS: orçamento do cenário medido respeitado. Não é garantia de todas as cargas/máquinas nem comparação com VS Code.'
