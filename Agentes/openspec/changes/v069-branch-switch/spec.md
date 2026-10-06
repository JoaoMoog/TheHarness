# 0.6.9 — troca de branch e modal

- Retirar condição de status global vazio de criar/trocar branch: ela bloqueava
  por dependências ocultas mesmo quando a projeção Changes estava vazia.
- Delegar admissão ao Git switch normal; alterações compatíveis acompanham a
  troca. Recusar risco de sobrescrita, índice em conflito, worktree ocupado etc.
- Nunca force, reset, stash automático, apply/pop/drop ou descarte para trocar.
  Usar --no-overwrite-ignore também para proteger arquivos locais ignorados.
- Criar/trocar usa switch -c transacional: falha não cria/reset a branch.
- Stashes guardados não impedem troca. Buffers não salvos continuam protegidos
  pelo frontend; usuário salva antes, sem exigência genérica de commit/stash.
- Clicar na branch troca diretamente; retirar confirmação com mensagem falsa
  de commit/stash obrigatório. Remotas mantêm criação/uso da branch tracking.
- Modal: título fixo, Atualizar/Fechar agrupados no canto direito, só corpo rola,
  explicações/linhas compactas; atualização serial e botão ocupado desabilitado.
- Cotas/cache/paginação mantidos; nenhum scanner, timer ou animação adicional.
- Testar Git real com stash + 1.000 dependências, staged/unstaged/untracked,
  colisão de alteração local/untracked/ignored e falha de criação transacional.
  Teste DOM do header; testes completos JS/Rust, build e inspeção isolada da GUI.

Sem promessa de paridade total com extensões/auto-stash do VS Code. O contrato
de segurança usado é o de [git switch](https://git-scm.com/docs/git-switch).
