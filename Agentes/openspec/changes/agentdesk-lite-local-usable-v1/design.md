# Design — fatia local utilizável

## Decisões

- Manter uma crate Rust/Slint; a primeira fatia usa I/O local simples e explícito.
- Catálogo é uma lista UTF-8 de caminhos absolutos em `%LOCALAPPDATA%\AgentDeskLite\repositories.txt`. Caminhos ausentes são ignorados ao carregar; remover/editar o catálogo não toca no conteúdo dos repositórios.
- Na primeira execução, adicionar somente o caminho do projeto usado para compilar se ainda existir. Em outra máquina, catálogo vazio e cadastro pelo seletor continuam disponíveis.
- Explorador lista apenas o diretório atual (não faz indexação recursiva), ordena pastas antes de arquivos, não atravessa symlinks e oculta `.git`, `node_modules`, `.next`, `target`, `build`, `bin` e `obj` por padrão.
- Editor só abre UTF-8 até 2 MiB; identifica UTF-8 BOM e CRLF/LF. Arquivos maiores ou de encoding inválido são recusados sem escrita. Dirty bloqueia navegação destrutiva.
- Antes de gravar, revalidar que o arquivo canônico continua dentro da raiz e comparar tamanho/data modificada com o snapshot da abertura. Divergência preserva o texto em memória e recusa sobrescrita automática.
- PowerShell inicia fora do processo da IDE, em nova janela e com cwd na raiz. Isto entrega TTY completo para CLIs sem declarar um painel Slint como emulador de terminal. O usuário inicia comandos manualmente.
- Sem estado Git, métricas, output de agente ou terminal simulado. Limitações são mostradas no README e nesta spec.

## Riscos e limites residuais

- Arquivos em unidades remotas/lentas podem tornar listagem/leitura síncrona lenta; não faça varredura recursiva.
- Snapshot (data+comprimento) detecta muitos conflitos, não todos os casos em que outro programa reescreve bytes e restaura exatamente esses metadados.
- Salvamento direto não é transação atômica. Faça commit/backup de trabalho importante.
- `powershell.exe` depende do Windows PowerShell no PATH do sistema. A falha de spawn é exibida na barra de estado.
- Caminhos em junctions não são tratados como isolamento de segurança forte; a ferramenta é um editor local confiado, não sandbox.

## Validação de aceitação

1. Abrir o executável publicado e ver o próprio projeto no catálogo (em primeira execução no computador de build).
2. Adicionar outro diretório por seletor/caminho, selecioná-lo e percorrer subpastas.
3. Abrir arquivo UTF-8, editar, salvar e confirmar bytes no disco; reabrir e ver o conteúdo atualizado.
4. Abrir PowerShell e confirmar que a janela real abre com prompt no root selecionado; executar comando manualmente.
5. Tentar arquivo binário/maior que o limite e confirmar recusa; confirmar que alterações externas não são sobrescritas.
