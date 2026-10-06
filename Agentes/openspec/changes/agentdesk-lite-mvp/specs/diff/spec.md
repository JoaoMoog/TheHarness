# Diff — requisitos normativos

## Requisitos

- DF-01 MUST distinguir HEAD, index e worktree e mostrar a origem/destino de cada comparação.
- DF-02 MUST renderizar inline e lado a lado, com adição, remoção, contexto, números original/novo e navegação entre hunks.
- DF-03 MUST tratar arquivo novo, removido, renomeado, binário, EOL alterado e marcador sem newline.
- DF-04 MUST usar labels/ícones além de cor e manter contraste acessível.
- DF-05 MUST virtualizar linhas e limitar materialização/cache para arquivos ou diffs grandes.
- DF-06 MUST invalidar cache por repo, FileId, versão e par de snapshots; nunca apresentar diff obsoleto como atual.
- DF-07 SHOULD adiar stage por hunk até prova de robustez; stage por arquivo é o mínimo.

## Cenários

### DF-S01 — fontes Git distintas

Given alterações diferentes no index e no worktree
When o usuário seleciona HEAD para index
Then a visão mostra somente alterações staged
And ao selecionar index para worktree mostra somente alterações unstaged.

### DF-S02 — diff grande

Given um arquivo com milhares de hunks
When a visão abre e o usuário rola
Then somente viewport e contexto necessário são materializados
And a navegação de hunk preserva correspondência de linhas.

### DF-S03 — atualização concorrente

Given um DiffView em cache
When GitSnapshot ou DiskSnapshot muda
Then a view é marcada obsoleta e recalculada por versão
And não mistura linhas de snapshots diferentes.
