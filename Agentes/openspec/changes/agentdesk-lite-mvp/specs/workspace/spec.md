# Workspace — requisitos normativos

## Requisitos

- WS-01 MUST manter RepositoryId estável, RepositoryRoot validada e rótulo exibido separado da identidade.
- WS-02 MUST permitir cadastrar, renomear, agrupar, abrir e remover do catálogo sem apagar conteúdo de disco.
- WS-03 MUST carregar apenas catálogo e metadados baratos na inicialização; árvores são paginadas e lazy.
- WS-04 MUST validar caminhos Windows, case-insensitivity, Unicode, UNC, long paths, junctions, symlinks, nested repos e worktrees antes de acesso sensível.
- WS-05 MUST excluir por padrão node_modules, .next, dist, build, bin, obj e .git de exploração/indexação/watch custosos, sem impedir Git ou abertura manual.
- WS-06 MUST representar repo ausente, não Git, detached HEAD e erro de permissão sem corromper catálogo.
- WS-07 MUST confirmar troca de branch com mudanças e não atravessar links indiscriminadamente.

## Cenários

### WS-S01 — catálogo sem indexação global

Given 12 repositórios registrados, incluindo árvore grande
When a aplicação abre o workspace
Then somente catálogo e metadados baratos são carregados
And nenhuma árvore recursiva é indexada ou observada integralmente.

### WS-S02 — remoção lógica

Given um repositório existente no catálogo
When o usuário seleciona remover do catálogo e confirma
Then o rótulo e a entrada são removidos da configuração
And nenhum arquivo no RepositoryRoot é removido.

### WS-S03 — link e caminho fora de raiz

Given um nó que resolve por link para fora de RepositoryRoot
When a árvore tenta expandi-lo
Then a política bloqueia ou marca o nó conforme configuração
And nenhum arquivo externo é lido automaticamente.
