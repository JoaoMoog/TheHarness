# Design técnico proposto

Status: arquitetura de referência para revisão; nenhuma API foi implementada.

## Visão de componentes

    +------------------- app/ui --------------------+
    | shell | panes | focus | commands | a11y       |
    +---------------------+-------------------------+
                          | mensagens tipadas
    +---------------------v-------------------------+
    | app coordinator / estado somente de UI         |
    +---+----------+----------+----------+-----------+
        |          |          |          |
   workspace     editor      diff        git
   settings      buffers     mapping     CLI adapter
        |          |          |          |
    filesystem  snapshots  cache v.     process_manager
        |                                     |
        +------------- agents / terminal -----+
                                      |
                            ConPTY ou processo fake

Cada caixa é uma separação lógica. O desenho não exige crate por módulo: uma crate inicial é preferível até haver razão mensurável para separar.

## Ownership, identidade e snapshots

| Modelo | Dono lógico | Campos mínimos | Regra |
|---|---|---|---|
| Workspace | workspace | catálogo, WorkspaceId, lista RepositoryId | catálogo não contém cópias de código |
| RepositoryRoot | workspace | caminho canônico/lógico, tipo, existência, worktree | identidade não depende do rótulo |
| RepoStatus | git | branch, HEAD, entradas NUL, versão, instante | nunca é inferido de UI |
| FileId | workspace | RepositoryId, caminho relativo validado, identidade de disco quando possível | nenhum path externo é aceito sem validação |
| EditorBuffer | editor | texto/bytes, encoding, EOL, sujo, undo, base DiskSnapshot | fonte de edição não é disco |
| DiskSnapshot | editor/workspace | versão, hash/metadata, encoding e conteúdo sob demanda | comparação explícita com buffer |
| GitSnapshot | git | HEAD, index e worktree por versão | não se mistura com DiskSnapshot |
| DiffView | diff | origem, destino, hunk map, cache key e limite | cache invalida por versão |
| AgentSession | agents | executable absoluto, cwd, args, PID/árvore, estado e timestamps | terminal aberto não equivale a tarefa concluída |
| TerminalSession | terminal | pseudoconsole, handles, tamanho, scrollback limitado | output não é evento confiável de tarefa |
| TaskQueue | coordinator | prioridade, cancelamento, limite e dono | backpressure antes de iniciar trabalho |
| ResourceSample | resources | PID, CPU, private bytes, working set, handles, instante | IDE e filhos têm séries separadas |
| AppSettings | settings | schemaVersion, catálogo, preferências não secretas | validação/migração antes de uso |

Normalização de caminho deve preservar a distinção entre caminho exibido e caminho usado. Antes de trabalhar em um FileId, validar que o caminho relativo não escapa da raiz permitida, tratar UNC, Unicode, case-insensitivity, long paths, junctions e symlinks conforme política, e revalidar antes de salvar. Repositórios nested e worktrees são identificados por Git; a árvore não os atravessa automaticamente.

## Concorrência e backpressure

1. A UI apenas despacha Command e aplica UiUpdate rápidos.
2. Coordinator atribui cancel token, prioridade, RepositoryId/FileId e limite à TaskQueue.
3. Workers de disco, Git, diff e processo fazem I/O sem a thread gráfica.
4. O worker retorna Result ou erro estruturado com versão observada.
5. Coordinator descarta resultado obsoleto, coalesce eventos e publica atualização.

Filas são limitadas. Pedidos de status repetidos para o mesmo repositório substituem pedidos pendentes; eventos de watcher são agrupados por raiz e debounce. Ações explícitas do usuário têm prioridade sobre pré-carregamento. Não existe polling rápido permanente: status é solicitado por ação, foco, evento coalescido ou refresh manual. Timeouts só cancelam operações comprovadamente seguras; Git/filhos não são mortos por limiar de recurso durante escrita, commit ou push.

## Contratos lógicos

| Serviço | Entrada | Saída | Falha esperada |
|---|---|---|---|
| WorkspaceService | Add/Remove/Open RepositoryRoot | CatalogChanged, TreePage | inexistente, não Git, acesso negado, link inseguro |
| EditorService | Open/Save/Reload/KeepBuffer FileId | BufferState, ExternalChange | binário, encoding desconhecido, limite, disco/perm. |
| GitService | Refresh/Diff/Stage/Commit/Sync RepositoryId | GitSnapshot, DiffSource, OperationResult | hook, auth, conflito, LFS, assinatura, cancelamento |
| DiffService | versões explícitas e limite | DiffView paginável | binário, arquivo enorme, base obsoleta |
| ProcessManager | Launch/Resize/Input/Interrupt/Close | ProcessEvent, ResourceSample | exe inválido, TTY, handle, acesso negado |
| SettingsService | Load/Validate/Migrate/Write | AppSettings, RecoveryNotice | schema/corrupção/escrita falha |
| SecurityPolicy | caminho, exe, argumento, log/clipboard | Allow/Deny com motivo | outside-root, spoof, policy incompatível |

Todos os erros transportam ação recomendada e dados técnicos mínimos; não incluem tokens, código integral ou output ilimitado.

## Sequências principais

### Abrir workspace e arquivo

    UI -> WorkspaceService: abrir catálogo
    WorkspaceService -> UI: metadados baratos somente
    UI -> WorkspaceService: expandir nó
    WorkspaceService -> worker: listar uma página da árvore
    worker -> UI: TreePage(version)
    UI -> EditorService: Open(FileId)
    EditorService -> worker: ler e classificar bytes
    worker -> EditorService: DiskSnapshot
    EditorService -> UI: BufferState(readonly/encoding/EOL)

Não há scan de todos os diretórios, nem watcher para toda a árvore. Diretórios gerados podem ser ocultos de exploração/indexação/watch por padrão, mas não ficam inacessíveis para Git ou abertura explícita.

### Modificação externa e diff

    watcher/manual refresh -> coordinator: caminho/repo possivelmente alterado
    coordinator -> editor: comparar metadado/DiskSnapshot
    editor -> UI: reload se buffer limpo; conflito se sujo
    UI -> git: Refresh(repo)
    git -> diff: Diff(HEAD|index|worktree, FileId, versões)
    diff -> UI: DiffView virtualizado

Buffer sujo mais alteração externa sempre apresenta Comparar, Recarregar ou Manter buffer. Manter não autoriza sobrescrever sem o próximo Save explícito e confirmação de conflito se a base mudou.

### Iniciar e encerrar agente

    UI -> SecurityPolicy: validar exe absoluto, cwd e args documentados
    policy -> ProcessManager: Launch aprovado
    ProcessManager -> ConPTY/processo: criar handles e processo sem shell
    ProcessManager -> UI: Session Active + output limitado
    UI -> ProcessManager: Resize/Input/Interrupt
    processo -> ProcessManager: EOF/exit code
    ProcessManager -> UI: Session Exited; notificar se sinal confiável

Texto de terminal não altera estado de tarefa. Sessão pode estar Open, Queued, Starting, Active, Exiting, Exited, Failed ou Unknown. A sessão de terminal aberta e o processo ativo são campos separados. Ao fechar a IDE com processos, a UI oferece Cancelar fechamento, Encerrar sessões confirmadamente, ou Manter somente se um mecanismo validado suportar isso; não promete reconnect.

### Commit e push

    UI -> GitService: Refresh + precondition(snapshot)
    UI -> GitService: Stage/Unstage por arquivo
    GitService -> UI: novo GitSnapshot
    UI -> GitService: Commit(mensagem explícita)
    Git CLI -> UI: resultado/hook/assinatura sem ocultar falha
    UI -> confirmação: Push/Pull
    UI -> GitService: Sync somente após confirmação

O adaptador usa argv estruturado, diretório explícito, delimitador de caminhos e stdout/stderr tratados como dados. Para status usa protocolo de máquina NUL; nunca infere estado a partir de mensagem traduzida. Reset hard, clean, force push, merge/rebase automático e descarte não pertencem ao MVP.

## Editor e diffs

EditorBuffer retém bytes e metadados suficientes para preservar UTF-8 com/sem BOM e CRLF/LF. UTF-16 ou encoding desconhecido é detectado e exige modo/decisão explícita; binário é readonly. Arquivos acima do limite de edição usam modo limitado ou readonly, sem truncar dados silenciosamente. Save escreve em caminho temporário no mesmo volume quando permitido, faz flush/rename de forma apropriada, preserva atributos/permissões quando possível e comunica falha/recovery. A semântica precisa ser comprovada em Windows.

Diff recebe duas fontes nomeadas; por exemplo HEAD para index, index para worktree e HEAD para worktree. Ele preserva marcador de arquivo sem newline, binário, rename e EOL. A visão usa viewport/linhas materializadas sob demanda, cache por repo/arquivo/versões/origem/destino e invalidação explícita. Acessibilidade não depende só de verde/vermelho: inclui rótulo e forma/ícone.

## Terminal e processos

ConPTY, se adotado, fornece pseudoconsole e I/O; ele não desenha caracteres. A seleção do renderizador VT/ANSI precisa ser uma decisão após G-TERMINAL. O parser deve limitar sequência de escape, hyperlinks, OSC 52/clipboard, taxa de saída e scrollback; terminal não executa comando privilegiado por uma sequência recebida. UTF-8, foco, stdin, Ctrl+C, resize, EOF, stderr, subprocessos e todos os handles fazem parte do contrato de teste.

ProcessManager valida o caminho absoluto contra allowlist/política, registra sem segredos executable/cwd/args permitidos/PID e usa ambiente herdado mínimo. Não usa PATH para escolher executável e não trata Job Objects como sandbox. A associação a Job Object, se aprovada, é documentada por processo e testa processos que escapam.

## Configuração, logs e segurança

AppSettings é um arquivo local TOML ou JSON, escolhido e congelado antes da implementação. Possui schemaVersion, validação estrita, migração compatível, escrita segura, backup/recovery de corrupção e campos mínimos. Não contém tokens, prompt, código ou output. Logs ficam desabilitados por padrão; opt-in local define retenção/tamanho e redaction de melhor esforço. A UI declara claramente a fronteira entre seu processo e conexões/processos iniciados por Git ou CLIs.

## Trade-offs que exigem decisão

- Um editor/diff completo pode violar orçamento de memória; G-EDITOR decide antes de produto.
- Renderizador de terminal completo tem custo e risco maior que simples output; G-TERMINAL define o MVP viável.
- Watchers ampliam atualidade, mas não são fonte de verdade Git nem devem disparar varredura global.
- Métrica global de máquina não mede a IDE; ResourceSample e baseline separam processos.
