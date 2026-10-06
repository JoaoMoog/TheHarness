param([ValidateSet('build','test','check')][string]$Action='build',[switch]$Release,[string]$TestFilter,[switch]$IncludeIgnored,[switch]$ShowOutput,[ValidateSet('webview-idle')][string]$Example)
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
 if(-not (Test-Path 'ui\dist\index.html')){throw 'Interface ainda não compilada. Rode: cd ui; npm ci; npm run build; cd ..'}
 $toolchainRoot=Join-Path $env:USERPROFILE '.rustup\toolchains\stable-x86_64-pc-windows-gnu'
 $rustGnuBin=Join-Path $toolchainRoot 'lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained'
 $llvmRoot=Join-Path (Split-Path (Get-Location).Path -Parent) 'JTK\.build\llvm-mingw-20260908-ucrt-x86_64'
 if($env:SPEEDCODE_LLVM){$llvmRoot=$env:SPEEDCODE_LLVM} elseif($env:AGENTDESK_LLVM){$llvmRoot=$env:AGENTDESK_LLVM}
 $llvmBin=Join-Path $llvmRoot 'bin'
 $llvmLib=Join-Path $llvmRoot 'x86_64-w64-mingw32\lib'
 if(-not (Test-Path (Join-Path $toolchainRoot 'bin\rustc.exe'))){throw 'Rust GNU não encontrado. Instale com: rustup toolchain install stable-x86_64-pc-windows-gnu'}
 if(-not (Test-Path (Join-Path $toolchainRoot 'lib\rustlib\x86_64-pc-windows-gnullvm\lib'))){throw 'Alvo Rust ausente. Instale com: rustup target add x86_64-pc-windows-gnullvm --toolchain stable-x86_64-pc-windows-gnu'}
 foreach($required in @('x86_64-w64-mingw32-gcc.exe','dlltool.exe','x86_64-w64-mingw32-windres.exe')){if(-not (Test-Path (Join-Path $llvmBin $required))){throw "LLVM-MinGW incompleto em '$llvmRoot'. Defina SPEEDCODE_LLVM para a raiz da distribuição LLVM-MinGW x64/UCRT."}}
 if(-not (Test-Path $llvmLib)){throw "Sysroot LLVM-MinGW não encontrado: $llvmLib. Confira SPEEDCODE_LLVM."}
 $hostLinker=(Join-Path $rustGnuBin 'x86_64-w64-mingw32-gcc.exe').Replace('\','\\')
 $llvmLinker=(Join-Path $llvmBin 'x86_64-w64-mingw32-gcc.exe').Replace('\','\\')
 $dlltool=(Join-Path $llvmBin 'dlltool.exe').Replace('\','\\')
 $llvmLibToml=$llvmLib.Replace('\','\\')
 # Build-dependencies use the host target without target rustflags. Put LLVM
 # dlltool first so host windows-sys does not pick GNU dlltool without GNU as.
 $env:Path="$llvmBin;$rustGnuBin;$toolchainRoot\bin;$env:Path"
 $env:SPEEDCODE_WINDRES=Join-Path $llvmBin 'x86_64-w64-mingw32-windres.exe'
 $env:LIBRARY_PATH=Join-Path (Get-Location).Path 'target\local-import-libs'
 $configs=@('--config',('target.x86_64-pc-windows-gnu.linker="'+$hostLinker+'"'),'--config',('target.x86_64-pc-windows-gnu.rustflags=["-C","link-self-contained=yes","-C","dlltool='+$dlltool+'"]'),'--config',('target.x86_64-pc-windows-gnullvm.linker="'+$llvmLinker+'"'),'--config',('target.x86_64-pc-windows-gnullvm.rustflags=["-C","link-arg=-L'+$llvmLibToml+'","-C","link-arg=-lmingwex","-C","link-arg=-lmingw32"]'))
 $cargoArgs=@($Action,'--target','x86_64-pc-windows-gnullvm')
 if($Release){$cargoArgs+='--release'}
 if($Example){if($Action -ne 'build'){throw 'Example requer -Action build'};$cargoArgs+=@('--example',$Example)}
 if($TestFilter){if($Action -ne 'test'){throw 'TestFilter requer -Action test'};$cargoArgs+=$TestFilter}
 if($IncludeIgnored -or $ShowOutput){if($Action -ne 'test'){throw 'IncludeIgnored/ShowOutput requer -Action test'};$cargoArgs+='--';if($IncludeIgnored){$cargoArgs+='--include-ignored'};if($ShowOutput){$cargoArgs+='--nocapture'}}
 $cargoExe=Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
 $buildProfile=if($Release){'release'}else{'debug'}
 $profileDir=Join-Path (Get-Location).Path "target\x86_64-pc-windows-gnullvm\$buildProfile"
 function Install-SpeedCodeRuntimes {
   $loader=Get-ChildItem -Path (Join-Path $profileDir 'build\webview2-com-sys-*\out\x64\WebView2Loader.dll') -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
   if(-not $loader){throw 'WebView2Loader.dll não foi gerado pelas dependências'}
   $unwind=Join-Path $llvmBin 'libunwind.dll'
   $runtimeDestinations=@($profileDir,(Join-Path $profileDir 'deps'))
   if($Example){$runtimeDestinations+=(Join-Path $profileDir 'examples')}
   foreach($destination in $runtimeDestinations) {
     if(Test-Path -LiteralPath $destination) {
       foreach($runtimeSource in @($loader.FullName,$unwind)) {
         $runtimeDestination=Join-Path $destination (Split-Path $runtimeSource -Leaf)
         # A running older build may lock its DLL. Identical runtimes need no rewrite.
         if((Test-Path -LiteralPath $runtimeDestination) -and
            ((Get-FileHash -LiteralPath $runtimeSource).Hash -eq (Get-FileHash -LiteralPath $runtimeDestination).Hash)){continue}
         Copy-Item -LiteralPath $runtimeSource -Destination $runtimeDestination -Force
       }
     }
   }
 }
 if($Action -eq 'test') {
   $compileArgs=@('test','--target','x86_64-pc-windows-gnullvm','--no-run')
   if($Release){$compileArgs+='--release'}
   & $cargoExe '+stable-x86_64-pc-windows-gnu' @configs @compileArgs
   if($LASTEXITCODE -ne 0){throw "Compilação de testes falhou: $LASTEXITCODE"}
   Install-SpeedCodeRuntimes
 }
 & $cargoExe '+stable-x86_64-pc-windows-gnu' @configs @cargoArgs
 if($LASTEXITCODE -ne 0){throw "Cargo $Action failed: $LASTEXITCODE"}
 if($Action -eq 'build'){Install-SpeedCodeRuntimes}
} finally {Pop-Location}
