param([Parameter(Mandatory=$true)][string]$ExePath,[ValidateRange(2,60)][int]$Seconds=10,[switch]$PassThru)
$ErrorActionPreference='Stop'
$resolvedExe=(Resolve-Path -LiteralPath $ExePath).Path
$rootProcesses=@(Get-Process | Where-Object {try {$_.Path -eq $resolvedExe} catch {$false}})
if(-not $rootProcesses.Count){throw "Aplicação não está aberta nesse caminho: $resolvedExe"}
$roots=@($rootProcesses.Id)
$previous=@{}
$samples=@()
$clock=[Diagnostics.Stopwatch]::StartNew()
for($sample=0;$sample -lt $Seconds;$sample++) {
  $inventory=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name)
  $ids=[Collections.Generic.HashSet[int]]::new()
  foreach($rootId in $roots){[void]$ids.Add($rootId)}
  do { $added=$false;foreach($item in $inventory){if($ids.Contains([int]$item.ParentProcessId)-and $ids.Add([int]$item.ProcessId)){$added=$true}} } while($added)
  $workingSet=0L;$private=0L;$cpuDelta=0.0;$processCount=0
  foreach($processId in $ids){try{
    $process=Get-Process -Id $processId -ErrorAction Stop
    $key="$processId-$($process.StartTime.Ticks)"
    $cpu=$process.TotalProcessorTime.TotalSeconds
    if($previous.ContainsKey($key)){$cpuDelta+=[Math]::Max([double]0.0,[double]($cpu-[double]$previous[$key]))}
    $previous[$key]=$cpu
    $workingSet+=$process.WorkingSet64;$private+=$process.PrivateMemorySize64;$processCount++
  }catch{}}
  $samples+=[pscustomobject]@{Elapsed=[Math]::Round($clock.Elapsed.TotalSeconds,2);Processes=$processCount;WorkingSetMiB=[Math]::Round($workingSet/1MB,2);PrivateMiB=[Math]::Round($private/1MB,2);CpuSecondsDelta=[Math]::Round($cpuDelta,4)}
  Start-Sleep -Seconds 1
}
$processors=[Environment]::ProcessorCount
$observedSeconds=[Math]::Max(0.001,($samples[-1].Elapsed-$samples[0].Elapsed))
$cpuSeconds=($samples | Measure-Object CpuSecondsDelta -Sum).Sum
$report=[pscustomobject]@{Executable=$resolvedExe;WindowSeconds=[Math]::Round($observedSeconds,2);LogicalProcessors=$processors;CpuSeconds=[Math]::Round($cpuSeconds,4);MeanMachineCpuPercent=[Math]::Round(100*$cpuSeconds/$observedSeconds/$processors,3);PeakWorkingSetMiB=($samples | Measure-Object WorkingSetMiB -Maximum).Maximum;PeakPrivateMiB=($samples | Measure-Object PrivateMiB -Maximum).Maximum;WorkingSetGrowthMiB=[Math]::Round(($samples[-1].WorkingSetMiB-$samples[0].WorkingSetMiB),2);Samples=$samples;Note='Árvore atual: app + descendentes WebView2/CLI/MCP. Working sets podem compartilhar páginas; não é memória única, tokens ou economia financeira.'}
if($PassThru){$report}else{$samples | Format-Table -AutoSize;$report | Select-Object * -ExcludeProperty Samples | Format-List}
