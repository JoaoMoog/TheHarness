# SpeedCode

IDE desktop para Windows, com editor, Git, terminais PowerShell e chat de IA. Antes chamado AgentDesk Lite. Feito em **Rust + JavaScript**, sem Electron, com foco em uma interface leve e trabalho local.

## O que você pode fazer

- Abrir repositórios, explorar pastas, editar e formatar arquivos; visualizar imagens, Markdown e HTML.
- Trabalhar com Git: pastas/subpastas abertas por padrão, botões Expandir/Recolher tudo, diff, commit, push/pull, branches, stash e conflitos. Leitura e paginação limitadas mantêm árvores grandes leves; duplo clique numa alteração abre o arquivo e revela sua pasta.
  Clique no nome da branch para abrir **Branches e stashes**. Stashes mostram descrição, Aplicar (sem apagar) e Remover (com confirmação); expanda para ver arquivos e clique em um para abrir seu diff. Criar stash guarda até 200 alterações visíveis, sem dependências/ignorados; volumes maiores usam o terminal.
  A troca de branch preserva alterações compatíveis e só é recusada pelo Git quando houver impedimento real (como sobrescrita ou conflito). Stashes guardados não bloqueiam a troca. Salve edições abertas no editor antes de trocar; nada é descartado ou aplicado automaticamente.
- Rodar PowerShell, Copilot CLI e Kiro CLI em terminais integrados.
- Usar Copilot Chat com o harness oficial: contexto da sessão, referências, modelos, aprovações e MCPs opcionais via JSON.
- Executar projetos .NET pelo `launch.json`, com build, navegador e botão de parar. O **×** na aba fecha o terminal e encerra a API. **Não há breakpoints ou attach.**

## Chat ou CLI?

O chat facilita anexar referências, acompanhar respostas, aprovar ações e consultar o consumo da sessão. O terminal mantém a experiência completa e os comandos originais do CLI. Ambos podem ficar abertos; escolha conforme a tarefa.

O chat usa o próprio Copilot, não um modelo mais inteligente ou uma licença gratuita. A busca Rust e os limites de contexto/renderização ajudam a controlar o trabalho local; **não garantem redução de tokens, créditos ou CPU**. O consumo da sessão é separado da cota da conta. CLIs, builds e MCPs também consomem recursos. Veja o [contrato de desempenho](docs/PERFORMANCE.md).

**Tarefas isoladas:** em Contexto e ferramentas, **Alterar arquivos sempre em worktree** vem marcado. Não precisa pedir worktree nem informar branch: usa `HEAD`, o último commit da branch atual de cada repo, sem trocar a branch original. Anexe todos os repos antes do primeiro envio (até 8). O Rust prepara uma vez, remapeia referências e busca, sem novos watchers; o preparo no início evita deslocar contexto no meio da conversa. Duas janelas podem usar a mesma base, mas editam branches internas diferentes. **Base diferente** é opcional; `origin/production` usa o último Fetch. Abra os arquivos isolados pelo botão **Abrir worktree**.

Não copia alterações não commitadas nem dependências; referências de buffer são snapshots explícitos. Não-Git como projeto principal exige desmarcar worktree; anexos externos não-Git são somente leitura. Limpar/fechar preserva arquivos e branches em `%LOCALAPPDATA%\SpeedCode\worktrees` (ou no perfil configurado). Revise/integre o resultado pelo Git; não há merge/push/limpeza automática. Worktree compartilha metadados Git e não é sandbox: comandos/MCPs exigem revisão; Autopilot mantém aprovações humanas nesse modo. Submodules/links simbólicos não são admitidos no preparo gerenciado. Modelo/raciocínio não são reduzidos.

## Instalar ou usar portátil

**Para compartilhar com equipes**, distribua `SpeedCode-<versão>-Setup.exe`. Ele instala o app/DLLs para o usuário, cria atalhos e oferece WebView2 quando ausente. Para atualizar, salve suas edições, feche o app e execute o novo Setup: não precisa desinstalar; configurações/projetos permanecem. Versões mais antigas são bloqueadas. [Detalhes e limites do instalador](docs/INSTALLER.md).

**Modo portátil:** execute `SpeedCode.exe` na pasta do pacote, sem instalador. Em ambos os modos, não precisa instalar Rust ou Node para usar o app pronto.

- Copie **a pasta inteira**, incluindo `WebView2Loader.dll`, `libunwind.dll` e `formatters/`; não apenas o EXE.
- Requisitos: Windows x64, **WebView2 Evergreen Runtime** e Git no `PATH`. Instale esses requisitos separadamente se estiverem ausentes.
- Copilot CLI/Kiro CLI são opcionais e precisam estar instalados para seus respectivos recursos. O chat compartilha o login do Copilot CLI.
- Projetos .NET exigem o SDK/runtime compatível com o projeto.

É portátil no sentido de não ter instalador, mas **não é totalmente autocontido**: configurações/cache ficam, por padrão, em `%LOCALAPPDATA%\SpeedCode`. Perfis antigos de AgentDesk Lite podem ser reutilizados. Credenciais são gerenciadas pelo Copilot, e o chat pode enviar contexto ao serviço remoto. Conversas do SpeedCode ficam em memória; alterações nos arquivos permanecem no projeto.

## Preparar o ambiente de desenvolvimento

Use PowerShell na raiz do repositório. Você precisa de:

- Git e WebView2; Node.js **20.19+ na linha 20, ou 22.12+** e npm.
- Rust instalado via rustup, com o toolchain GNU e o alvo abaixo.
- LLVM-MinGW **x64/UCRT**, com GCC, windres e dlltool. Defina `SPEEDCODE_LLVM` para a pasta extraída.
- Python com pip para preparar o formatador Python incluído no pacote.
- .NET SDK **10** somente para executar o exemplo .NET deste repositório.

```powershell
git clone https://github.com/JuanCampbsi/SpeedCode.git
cd SpeedCode
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup target add x86_64-pc-windows-gnullvm --toolchain stable-x86_64-pc-windows-gnu
$env:SPEEDCODE_LLVM = 'C:\Dev\llvm-mingw'
```

Substitua `C:\Dev\llvm-mingw` pela sua pasta. O repositório exige acesso à conta/organização se estiver privado. A primeira compilação precisa de internet para baixar dependências.

## Build e geração do executável

Na raiz, para gerar o **instalador**:

```powershell
.\scripts\setup-formatters.ps1
.\scripts\installer.ps1
```

**Resultado:** `dist/installer/SpeedCode-<versão>-Setup.exe`. O script prepara o compilador NSIS local, compila a interface/Rust e gera também o pacote portátil. Se o release já estiver atualizado, use `.\scripts\installer.ps1 -SkipBuild`. Instalador ainda sem assinatura própria: políticas corporativas/SmartScreen podem exigir aprovação do TI.

Para gerar **somente o portátil**, use `.\scripts\package.ps1`. Resultado: `dist/SpeedCode/SpeedCode.exe`; compartilhe a pasta inteira. Feche a cópia em execução antes de sobrescrever esse pacote.

Para desenvolver e gerar apenas o build de debug:

```powershell
npm --prefix ui ci
npm --prefix ui run build
.\scripts\build.ps1 -Action build
.\target\x86_64-pc-windows-gnullvm\debug\speedcode.exe
```

Depois de alterar a interface, repita `npm --prefix ui run build` antes do build Rust: a interface é embutida no executável. Para compilar somente o Rust em release, use `.\scripts\build.ps1 -Action build -Release`; para reunir o release já compilado, `.\scripts\package.ps1 -SkipBuild`.

## Testes

```powershell
npm --prefix ui test
.\scripts\build.ps1 -Action test
```

Instalação/upgrade/desinstalação em cadastro isolado: `.\scripts\test-installer.ps1` (após gerar o pacote). Não testa com a instalação/perfil real do usuário.

Teste real .NET, opcional, com SDK 10 instalado:

```powershell
.\scripts\build.ps1 -Action test -TestFilter real_dotnet_launch_build_serve_and_stop -IncludeIgnored -ShowOutput
```

Esse teste usa o executor e o terminal reais: compila a API, verifica endpoints, Swagger e confirma que parar encerra o servidor. Veja a [validação .NET](docs/DOTNET-VALIDATION.md).

## Exemplo .NET: Play/F5

Abra **a raiz do SpeedCode** na ferramenta. Em **Executar .NET**, escolha **SpeedCode — API exemplo .NET 10**, selecione o destino do navegador e clique em Play/F5. O navegador abre `http://127.0.0.1:51879/swagger`: use **Try it out → Execute** para testar. Stop/Shift+F5 ou **×** na aba encerra a execução. A primeira compilação baixa o pacote Swagger e exige internet.

- [launch.json da raiz](.vscode/launch.json) e [tasks.json da raiz](.vscode/tasks.json): funcionam com este repositório aberto.
- [API de exemplo](examples/dotnet-run/README.md): projeto pequeno e configuração independente, para adaptar às suas APIs.

Os JSONs usam `${workspaceFolder}`, sem caminhos do computador do autor. Se a porta estiver ocupada, altere `ASPNETCORE_URLS`. O exemplo pode abrir o navegador externo pela configuração; no SpeedCode, você pode escolher o integrado. O recurso é um **executor**, não um depurador com breakpoints.

## Onde mexer no código

- `src/`: backend Rust — arquivos, Git, terminais, chat e execução .NET.
- `ui/src/`: frontend JavaScript — interface, editor Monaco e terminal xterm.
- `assets/`: marca/ícones; `scripts/`: build e empacotamento.
- `examples/`: exemplos; `docs/` e `openspec/`: limites e especificações técnicas.

**Não versionar builds:** `.gitignore` exclui `target/`, `dist/`, `ui/dist/`, `node_modules/`, `bin/`, `obj/`, `.exe` e `.dll`. O repositório guarda código, configurações e exemplos; cada máquina gera seu próprio executável. Não use `git add -f` para incluir artefatos.
