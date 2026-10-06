# 0.7.0 — chat em worktrees por tarefa

## Contrato

- Usar worktree marcado por padrão em Contexto e ferramentas; efeito em nova
  sessão. Sem mudar silenciosamente uma conversa já iniciada ou limpar contexto.
  Rótulo final: Alterar arquivos sempre em worktree. Não exigir mencionar worktree
  ou branch no prompt. Sem base explícita, HEAD da branch atual de cada repo;
  checkout original não muda. Seletor de base alternativa recolhido/opcional.
  Preparar no início mantém paths/contexto consistentes, inclusive durante análise;
  não interpretar intenção natural para desativar isolamento de uma futura edição.
- Antes de iniciar a sessão, preparar worktrees do projeto Git principal e dos
  projetos Git explicitamente anexados (até 8 repos). Diretórios/arquivos anexos
  são remapeados para os caminhos equivalentes, nunca para o checkout original.
- Uma pasta por tarefa, branches locais únicas por repo. Duas tarefas podem ter
  a mesma base, mas não editam simultaneamente a mesma branch local via force.
- Base explícita opcional (HEAD por padrão; origin/production etc. usam o último
  Fetch). Validar todos os commits antes de iniciar qualquer checkout. Sem fetch,
  instalação de dependências, build, push, stash ou cópia de arquivos locais
  automáticos. Arquivos não commitados não são copiados; snapshots são explícitos.
- Falha não permite envio no checkout original nem retry automático de mutação.
  Worktrees criadas, branches e manifesto preservados mesmo em falha/limpeza/saída.
- UI mostra origem, diretório isolado, branch e SHA-base, com abrir no explorador.
  Anexos posteriores também precisam usar worktrees; novo repo exige nova sessão.
- Busca/contexto Rust usa apenas o grupo isolado, mantendo cotas existentes,
  instruções do projeto/pais, testes, raciocínio, modelo e fallback nativo.
- Worktree não é sandbox de comandos/MCPs. Escritas via adaptador FS ficam no
  grupo; comandos/permissões ambíguos continuam sujeitos a aprovação humana,
  inclusive Autopilot. Nenhuma promessa de impedir qualquer comando externo.
- Sem novo timer, watcher, scan de dependências, runtime ou janela. Preparação
  sequencial sob demanda na thread de trabalho; manifesto local mínimo, sem
  prompt/transcrição/token. Limites de admissão antes da criação; nada removido
  para caber no orçamento. Perf existente não ampliado.

## Validação e entrega

Git real em fixtures: duas tarefas x três repos com bases diferentes/iguais,
edits isoladas, dirty originals/stashes/dependências preservados; mapping de
anexos/snapshots, espaços/nomes, rejeição de não-Git/base ausente/submodule,
erros, preservação após limpar e limites. JS: default, trava após preparar,
erro preserva prompt/anexos, contexto e paths, off mantém fluxo antigo.
Testes Rust/JS e build; GUI e medição app+WebView2 isoladas. Sem inferência paga
sem autorização específica; registrar separadamente integração real CLI.
