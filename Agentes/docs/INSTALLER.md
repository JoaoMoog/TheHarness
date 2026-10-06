# Instalador do SpeedCode

Distribua somente `SpeedCode-<versão>-Setup.exe`. O instalador inclui o EXE, DLLs, formatadores e documentação; cria atalhos e a entrada de desinstalação do Windows.

- Instala para a conta atual em `%LOCALAPPDATA%\Programs\SpeedCode`, sem exigir administrador para o SpeedCode.
- Detecta WebView2 e, se ausente, oferece instalar o bootstrapper oficial da Microsoft. Esse passo exige internet e pode depender das políticas da empresa. Não altera uma instalação existente do runtime nem o remove ao desinstalar o SpeedCode.
- Git, Copilot/Kiro e .NET não são instalados automaticamente. São requisitos separados conforme os recursos utilizados.
- O instalador ainda não tem assinatura Authenticode do SpeedCode. SmartScreen/antivírus ou políticas corporativas podem alertar ou bloquear; não desative proteções. Para distribuição institucional, combine assinatura e aprovação com o TI.

## Atualizar ou reparar

Salve as edições, encerre suas tarefas e feche o SpeedCode. Execute o instalador da versão nova: a instalação existente é atualizada no mesmo diretório, sem desinstalação prévia. A mesma versão pode ser reinstalada para reparar arquivos. Instalar uma versão mais antiga é bloqueado.

O instalador não encerra processos à força. Arquivos do app em uso bloqueiam a operação; feche-os e tente novamente. Não existe atualizador residente, serviço nem busca automática de atualizações: execute o novo instalador manualmente.

Configurações/cache e credenciais ficam fora dos arquivos instalados. O instalador não os lê, move ou exclui. Projetos e configurações são preservados inclusive na desinstalação. Conversas em RAM não sobrevivem ao fechamento; salve edições antes de atualizar. Instalações portáteis antigas continuam independentes e não são removidas automaticamente.

## Gerar o instalador

No ambiente de build descrito no [README](../README.md):

```powershell
.\scripts\setup-formatters.ps1
.\scripts\installer.ps1
```

Resultado: `dist/installer/SpeedCode-<versão>-Setup.exe`. O script também gera o pacote portátil. Para reutilizar um release atual já compilado: `.\scripts\installer.ps1 -SkipBuild`.

O compilador NSIS 3.13 e o bootstrapper WebView2 são baixados para `target/installer-tools/`, sem instalar ferramentas globalmente. O ZIP tem SHA256 fixado; a assinatura Microsoft do bootstrapper é verificada antes do empacotamento. Para usar outro compilador, defina `SPEEDCODE_NSIS` com o caminho de `makensis.exe`.

A versão vem de `Cargo.toml` e deve coincidir com o EXE compilado. Mantenha `APP_ID` estável em `installer/SpeedCode.nsi`: ele identifica a mesma instalação entre versões. Ajuste as versões do app e faça o build para publicar uma release nova. Não distribua builds de teste.

`dist/`, `target/`, EXEs e DLLs continuam ignorados pelo Git. O repo guarda apenas scripts e fonte do instalador.

## Teste isolado e implantação silenciosa

```powershell
.\scripts\test-installer.ps1
```

O teste usa cadastro e diretórios exclusivos, não a instalação/perfil real do SpeedCode. Verifica instalação, upgrade, reparo, downgrade bloqueado, arquivos em uso, falha simulada do requisito e desinstalação. Requer WebView2 já instalado para o cenário de sucesso.

Para TI: `SpeedCode-<versão>-Setup.exe /S` instala para o usuário do processo, não para todas as contas. Se faltar WebView2, tenta instalar o runtime; precisa de internet. Não execute como SYSTEM para uma implantação por usuário. Saídas: `0` sucesso; `10` downgrade; `11` arquivo em uso; `12` WebView2; `13` cadastro/arquitetura/concorrência; `14` cópia dos arquivos. Confira também os arquivos instalados e o cadastro após falhas.

## Fontes

[NSIS: documentação](https://nsis.sourceforge.io/Docs/), [NSIS: licença](https://nsis.sourceforge.io/License) e [Microsoft: distribuição WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).
