# Agentes — requisitos normativos

## Requisitos

- AG-01 MUST associar cada AgentSession a RepositoryId, cwd explícito, executável absoluto validado, args documentados, PID/árvore, timestamps, exit code, estado de terminal e estado de tarefa distintos.
- AG-02 MUST diferenciar Open, Queued, Starting, Active, Exiting, Exited, Failed e Unknown; terminal aberto e tarefa concluída não são equivalentes.
- AG-03 MUST iniciar no máximo duas tarefas/agentes ativos por padrão e até cinco sessões abertas, com ajuste explícito de configuração.
- AG-04 MUST executar CLIs oficiais somente com caminho/versão autorizados e comportamento interativo documentado; sem isso, oferece terminal, não orquestração.
- AG-05 MUST nunca injetar prompt, criar commit/push ou inferir conclusão a partir de texto sem gesto explícito e sinal confiável.
- AG-06 MUST monitorar Git/filesystem independentemente do output do agente.
- AG-07 MUST oferecer fechamento seguro da IDE com processos ativos, sem prometer detach/reconnect não validado.

## Cenários

### AG-S01 — CLI não instalada

Given caminho de CLI ausente ou não autorizado
When o usuário tenta iniciar sessão de agente
Then ProcessManager bloqueia a criação com motivo acionável
And a IDE permanece funcional sem agente.

### AG-S02 — término sem texto confiável

Given processo termina sem mensagem de conclusão conhecida
When o handle fornece EOF e exit code
Then a sessão torna-se Exited ou Failed conforme exit code
And a UI não depende de texto do terminal.

### AG-S03 — fechamento com atividade

Given uma ou mais AgentSession Active
When o usuário tenta fechar a IDE
Then a UI oferece cancelar fechamento ou encerrar sessões com confirmação
And manter processos só aparece se suportado e testado.
