; -*- coding: utf-8 -*-
; NSIS 3.13+. No resident updater, service, scans or application changes.
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"
!include "x64.nsh"
!include "Sections.nsh"
!include "FileFunc.nsh"

!ifndef APP_VERSION
  !error "APP_VERSION required"
!endif
!ifndef INSTALLER_TEST
  !define APP_ID "SpeedCode.Desktop"
  !define APP_NAME "SpeedCode"
!else
  ; Only the isolated harness supplies these; never distributed as a release.
  !ifndef APP_ID
    !error "Isolated APP_ID required for test"
  !endif
  !define APP_NAME "SpeedCode Test ${APP_ID}"
!endif
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
!define WEBVIEW_KEY "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!ifdef TEST_RUNTIME_FAILURE
  !ifndef INSTALLER_TEST
    !error "Runtime failure simulation is only allowed in an isolated test"
  !endif
!endif

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
RequestExecutionLevel user
!ifdef INSTALLER_TEST
  ; Exercise real installation logic without repeatedly compressing the app.
  SetCompressor zlib
  SetCompress off
!else
  SetCompressor /SOLID lzma
  SetCompressorDictSize 16
!endif
BrandingText "SpeedCode — código e agentes"
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1046 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1046 "FileDescription" "Instalador do SpeedCode"
VIAddVersionKey /LANG=1046 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1046 "LegalCopyright" "SpeedCode contributors"

!define MUI_ICON "${PROJECT_DIR}\assets\speedcode.ico"
!define MUI_UNICON "${PROJECT_DIR}\assets\speedcode.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao SpeedCode"
!define MUI_WELCOMEPAGE_TEXT "Editor, Git e agentes no mesmo espaço.$\r$\n$\r$\nEste instalador inclui as DLLs e formatadores. Instala somente para sua conta, sem exigir administrador para o SpeedCode.$\r$\n$\r$\nSalve seu trabalho e feche o SpeedCode antes de atualizar. Configurações e projetos não serão apagados.$\r$\n$\r$\nSe faltar WebView2, será oferecida sua instalação pela Microsoft (requer internet). Git, CLIs e .NET continuam opcionais conforme o uso."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "SpeedCode pronto"
!define MUI_FINISHPAGE_TEXT "Use o atalho no menu Iniciar.$\r$\n$\r$\nPara atualizar, salve seu trabalho, feche o aplicativo e execute o instalador novo. Não é necessário desinstalar a versão anterior."
!define MUI_FINISHPAGE_RUN "$INSTDIR\SpeedCode.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir SpeedCode"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "PortugueseBR"

Var PreviousDir
Var InstallerMutex

!macro AcquireInstallerMutex
    System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\${APP_ID}.Setup") p .r0 ?e'
    Pop $1
    StrCpy $InstallerMutex $0
    ${If} $0 == 0
    ${OrIf} $1 == 183
        MessageBox MB_OK|MB_ICONEXCLAMATION "Outro instalador/desinstalador está aberto ou o bloqueio de instalação não está disponível. Feche-o e tente novamente." /SD IDOK
        SetErrorLevel 13
        Quit
    ${EndIf}
!macroend

; Never close the application or schedule replacement at reboot. A locked
; executable/DLL/formatter stops installation/uninstallation before mutation.
!macro CheckUnlocked PREFIX
Function ${PREFIX}CheckUnlocked
    Pop $1
    IfFileExists "$1" 0 done
    System::Call 'kernel32::CreateFileW(w r1, i 0x40000000, i 0, p 0, i 3, i 0, p 0) p .r0'
    ${If} $0 == -1
        MessageBox MB_OK|MB_ICONEXCLAMATION "Um arquivo do SpeedCode está em uso ou não pode ser atualizado.$\r$\nSalve suas edições e feche o aplicativo/formatador antes de continuar.$\r$\n$1" /SD IDOK
        SetErrorLevel 11
        Quit
    ${EndIf}
    System::Call 'kernel32::CloseHandle(p r0)'
done:
FunctionEnd
!macroend
!insertmacro CheckUnlocked ""
!insertmacro CheckUnlocked "un."

!macro CheckAllUnlocked PREFIX
    Push "$INSTDIR\SpeedCode.exe"
    Call ${PREFIX}CheckUnlocked
    Push "$INSTDIR\WebView2Loader.dll"
    Call ${PREFIX}CheckUnlocked
    Push "$INSTDIR\libunwind.dll"
    Call ${PREFIX}CheckUnlocked
    Push "$INSTDIR\formatters\ruff.exe"
    Call ${PREFIX}CheckUnlocked
!macroend

Function HasWebView
    StrCpy $0 ""
    !ifdef TEST_RUNTIME_FAILURE
      ; Explicit failure fixture; never runs the real shared runtime installer.
      Return
    !endif
    SetRegView 32
    ReadRegStr $0 HKLM "${WEBVIEW_KEY}" "pv"
    ${If} $0 == ""
    ${OrIf} $0 == "0.0.0.0"
        ReadRegStr $0 HKCU "${WEBVIEW_KEY}" "pv"
    ${EndIf}
    SetRegView 64
    ${If} $0 == ""
    ${OrIf} $0 == "0.0.0.0"
        ReadRegStr $0 HKCU "${WEBVIEW_KEY}" "pv"
    ${EndIf}
    ${If} $0 == "0.0.0.0"
        StrCpy $0 ""
    ${EndIf}
FunctionEnd

Function .onInit
    SetShellVarContext current
    ${IfNot} ${RunningX64}
        MessageBox MB_OK|MB_ICONSTOP "O SpeedCode requer Windows x64." /SD IDOK
        SetErrorLevel 13
        Quit
    ${EndIf}
    SetRegView 64
    !insertmacro AcquireInstallerMutex
    ReadRegStr $2 HKCU "${UNINSTALL_KEY}" "DisplayVersion"
    ${If} $2 != ""
        ${VersionCompare} $2 "${APP_VERSION}" $3
        ${If} $3 == 1
            MessageBox MB_OK|MB_ICONSTOP "Já está instalada a versão $2, mais nova que ${APP_VERSION}.$\r$\nEsta instalação foi bloqueada para evitar downgrade." /SD IDOK
            SetErrorLevel 10
            Quit
        ${EndIf}
        ReadRegStr $PreviousDir HKCU "${UNINSTALL_KEY}" "InstallLocation"
        ${If} $PreviousDir == ""
            MessageBox MB_OK|MB_ICONSTOP "O cadastro da instalação está incompleto. Repare o cadastro antes de atualizar." /SD IDOK
            SetErrorLevel 13
            Quit
        ${EndIf}
        StrCpy $INSTDIR $PreviousDir
    ${EndIf}
FunctionEnd

Section "SpeedCode (obrigatório)" AppSection
    SectionIn RO
    !insertmacro CheckAllUnlocked ""
    Call HasWebView
    ${If} $0 == ""
        MessageBox MB_YESNO|MB_ICONQUESTION "O Microsoft WebView2 é necessário e não foi encontrado.$\r$\nInstalar o runtime da Microsoft agora? É necessária conexão com a internet.$\r$\nNão prosseguir deixa o SpeedCode sem alterações." /SD IDYES IDYES runtime_install
        SetErrorLevel 12
        Quit
runtime_install:
        !ifdef TEST_RUNTIME_FAILURE
            StrCpy $0 1
        !else
            InitPluginsDir
            SetOutPath "$PLUGINSDIR"
            File /oname=MicrosoftEdgeWebview2Setup.exe "${WEBVIEW_BOOTSTRAPPER}"
            DetailPrint "Instalando Microsoft WebView2..."
            ClearErrors
            ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0
            ${If} ${Errors}
                StrCpy $0 1
            ${EndIf}
        !endif
        ${If} $0 != 0
            MessageBox MB_OK|MB_ICONSTOP "Não foi possível instalar o WebView2 (código $0).$\r$\nVerifique internet/políticas da empresa ou peça ao TI que instale o WebView2. O SpeedCode não foi alterado." /SD IDOK
            SetErrorLevel 12
            Quit
        ${EndIf}
        Call HasWebView
        ${If} $0 == ""
            MessageBox MB_OK|MB_ICONSTOP "O WebView2 ainda não está disponível. Conclua a instalação com o TI e tente novamente." /SD IDOK
            SetErrorLevel 12
            Quit
        ${EndIf}
    ${EndIf}
    ; Explicit allowlist: never package source, builds, profiles or credentials.
    SetOutPath "$INSTDIR"
    SetOverwrite on
    ClearErrors
    File "${PAYLOAD_DIR}\SpeedCode.exe"
    File "${PAYLOAD_DIR}\WebView2Loader.dll"
    File "${PAYLOAD_DIR}\libunwind.dll"
    File "${PAYLOAD_DIR}\README.md"
    File "${PAYLOAD_DIR}\LEIA-ME.txt"
    File "${PAYLOAD_DIR}\CONTRATO-DESEMPENHO.md"
    File "${PAYLOAD_DIR}\VALIDACAO-DESEMPENHO.md"
    File /oname=INSTALACAO.md "${PROJECT_DIR}\docs\INSTALLER.md"
    SetOutPath "$INSTDIR\formatters"
    File "${PAYLOAD_DIR}\formatters\ruff.exe"
    File "${PAYLOAD_DIR}\formatters\RUFF-LICENSE.txt"
    ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Falha ao copiar os arquivos. O cadastro da versão não foi atualizado. Execute este instalador novamente para reparar." /SD IDOK
        SetErrorLevel 14
        Quit
    ${EndIf}
    SetOutPath "$INSTDIR"
    ClearErrors
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteINIStr "$INSTDIR\speedcode-install.ini" "Install" "AppId" "${APP_ID}"
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\SpeedCode.lnk" "$INSTDIR\SpeedCode.exe"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Desinstalar.lnk" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "SpeedCode"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\SpeedCode.exe"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
    WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
    WriteRegStr HKCU "${UNINSTALL_KEY}" "URLInfoAbout" "https://github.com/JuanCampbsi/SpeedCode"
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
    ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "Falha ao cadastrar a instalação/atalhos. Execute o instalador novamente para reparar." /SD IDOK
        SetErrorLevel 14
        Quit
    ${EndIf}
SectionEnd

Section /o "Atalho na área de trabalho" DesktopSection
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\SpeedCode.exe"
SectionEnd

Function un.onInit
    SetShellVarContext current
    SetRegView 64
    !insertmacro AcquireInstallerMutex
    ReadINIStr $0 "$INSTDIR\speedcode-install.ini" "Install" "AppId"
    ReadRegStr $1 HKCU "${UNINSTALL_KEY}" "InstallLocation"
    ${If} $0 != "${APP_ID}"
    ${OrIf} $1 != $INSTDIR
        MessageBox MB_OK|MB_ICONSTOP "A pasta/cadastro não corresponde a esta instalação. Nenhum arquivo será removido." /SD IDOK
        SetErrorLevel 13
        Quit
    ${EndIf}
    !insertmacro CheckAllUnlocked "un."
FunctionEnd

Section "Uninstall"
    ; No recursive directory removal, wildcard deletion or profile/token access.
    Delete "$INSTDIR\SpeedCode.exe"
    Delete "$INSTDIR\WebView2Loader.dll"
    Delete "$INSTDIR\libunwind.dll"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\LEIA-ME.txt"
    Delete "$INSTDIR\CONTRATO-DESEMPENHO.md"
    Delete "$INSTDIR\VALIDACAO-DESEMPENHO.md"
    Delete "$INSTDIR\INSTALACAO.md"
    Delete "$INSTDIR\formatters\ruff.exe"
    Delete "$INSTDIR\formatters\RUFF-LICENSE.txt"
    RMDir "$INSTDIR\formatters"
    Delete "$INSTDIR\speedcode-install.ini"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"
    Delete "$SMPROGRAMS\${APP_NAME}\SpeedCode.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Desinstalar.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
