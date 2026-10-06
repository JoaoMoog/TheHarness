# Git — requisitos normativos

## Requisitos

- GT-01 MUST executar Git CLI por executável/cwd aprovados e argv estruturado, sem shell intermediário padrão.
- GT-02 MUST obter status por protocolo de máquina porcelain v2 NUL e tratar paths com separador seguro; saída humana localizada não é protocolo.
- GT-03 MUST exibir branch, staged, unstaged, untracked, HEAD e detached HEAD por RepositoryId.
- GT-04 MUST fornecer diff HEAD-worktree, HEAD-index e index-worktree sem external diff.
- GT-05 MUST permitir stage/unstage por arquivo e commit explícito, preservando hooks, assinatura, políticas, LFS e mensagens de falha.
- GT-06 MUST exigir confirmação antes de push/pull e reportar auth, rede e conflito sem ocultar output relevante.
- GT-07 MUST bloquear/advertir sync com buffer sujo ou agentes ativos conforme risco; nunca executar reset hard, clean, force push, merge/rebase automático ou descarte implícito.
- GT-08 MUST testar em fixture temporária e remoto bare local, nunca remoto real.

## Cenários

### GT-S01 — nome Unicode com espaço

Given uma fixture Git com arquivo Unicode, espaço e caractere especial no nome
When status é atualizado
Then o parser NUL produz a entrada correta associada ao FileId
And a UI não usa uma mensagem localizada para inferir o estado.

### GT-S02 — hook falho

Given hook de commit que falha em fixture
When o usuário confirma commit
Then Git não é ignorado
And a UI mantém o estado anterior e mostra falha acionável.

### GT-S03 — push explícito

Given um remoto bare local e mudanças commitadas
When o usuário seleciona Push
Then a UI pede confirmação antes de chamar Git
And a saída/exit code determina o resultado exibido.
