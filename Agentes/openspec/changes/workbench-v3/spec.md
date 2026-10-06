# AgentDesk Workbench v3 — execução, mídia e Git

## Objetivo e escopo

Entregar recursos locais reais mantendo os terminais PowerShell/Copilot/Kiro existentes. Não implementar DAP, breakpoints, attach, marketplace ou substituir os agentes CLI.

## Visualização

- PNG/JPEG/GIF/WebP/BMP/ICO/SVG abrem em abas somente leitura, com tamanho, dimensões, ajustar, 100% e zoom. Máximo 32 MiB. Recarregar atualiza a imagem do disco.
- HTML continua editável e ganha Prévia HTML. Prévia usa o arquivo salvo, preserva referências relativas e executa JavaScript na WebView2.
- Botão navegador aceita HTTP/HTTPS sem credenciais. Navegador é uma janela do próprio aplicativo, não um painel do editor. Não possui ponte IPC nem protocolo privilegiado da IDE.
- file:// não substitui servidor HTTP: módulos ES/fetch podem exigir um servidor local. Não contornar certificados inválidos.

## Execução .NET

- Descobrir `.vscode/launch.json` no projeto ativo; importar um arquivo existente sem sobrescrever/copiar configurações. Guardar associação por workspace em LOCALAPPDATA.
- Aceitar JSON com comentários/trailing commas; listar configurações e selecionar antes do Play/F5.
- `request: launch`, tipos coreclr/clr/dotnet. program .dll via dotnet; executáveis diretamente; projectPath via dotnet run.
- cwd, args array, env, preLaunchTask; variáveis workspaceFolder, workspaceRoot, workspaceFolderBasename e env:NAME. Campos windows sobrescrevem campos comuns.
- Tasks shell/process, dependsOn sequencial com detecção de ciclos e options.cwd/env. Builds falhas impedem launch. Tasks em background e provedores de extensão não suportados devem produzir erro explícito.
- coreclr/clr pode ler Properties/launchSettings.json (ou launchSettingsFilePath), perfil Project, environmentVariables/applicationUrl/launchBrowser/launchUrl. env de launch.json prevalece. IISExpress não iniciado.
- serverReadyAction identifica URL/porta na saída, aplica uriFormat e abre apenas uma vez no navegador escolhido. Se não configurado, abertura automática integrada pode usar o padrão ASP.NET `Now listening on:`.
- Execução usa ConPTY existente, conta no limite de oito sessões e Stop/Shift F5 encerra a árvore de processos. Trocar workspace não altera o diretório das sessões existentes.
- Configurações/tasks são código executável: só importar arquivos confiáveis; nunca exibir env/secrets em logs da IDE.

## Git

- Mostrar locais e refs/remotes, distinguindo branch ativa e referências do último fetch. Excluir HEAD simbólico da lista remota.
- Trocar branch requer worktree limpo e buffers salvos. Remota usa local com upstream correspondente ou cria branch tracking; colisões são reportadas pelo Git.
- Excluir apenas local via branch -d, com confirmação. Nunca -D, nunca excluir branch remota; branch ativa/ocupada/não mesclada protegida pelo Git.
- Criar stash com -u (sem ignorados), listar, visualizar patch incluindo novos arquivos, aplicar sem remover e remover com confirmação. Identificar por OID; reflog ordinal revalidado antes da remoção.
- Pull usa merge sem rebase. Falha de merge preserva estado e mostra arquivos em conflito. Comparar ours/theirs, editar o arquivo resultante, aceitar atual/recebido/ambos para conflitos textuais e salvar.
- Marcar resolvido verifica ausência de marcadores e usa git add. Exclusão requer confirmação e arquivo ausente. Conflitos binários ou rename complexos podem precisar do terminal; não inventar resolução automática.
- Completar merge exige MERGE_HEAD e nenhum unmerged, cria commit com mensagem de merge existente. Não dá push automaticamente. Conflito de stash não é merge: resolver e fazer commit normal.
- Abort permite cancelar merge com confirmação. Serializar operações Git, manter paths dentro do workspace e nunca testar operações destrutivas nos repositórios do usuário.

## Aceitação

Testes Git reais isolados para branches locais/remotas, stash e merge; testes JSONC/quoting/variáveis/tasks; teste opcional de build+HTTP+Stop .NET; testes JS de marcadores e URL; verificar UI desktop e build release. Documentar limites, exemplo launch/tasks e caminhos da distribuição. Builds/dependências fora do versionamento.
