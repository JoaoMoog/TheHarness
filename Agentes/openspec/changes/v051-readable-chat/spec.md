# v0.5.1 — resposta legível, cota da conta e proxy Rust conservador

## Problemas confirmados

Mensagens assistant sem texto viravam cartões vazios. A conclusão do harness
`task_complete` era exibida como JSON de ferramenta, não resposta. `session.idle`
em Autopilot pode ser uma fronteira de continuação, não conclusão. Eventos acima
de 32 KiB eram descartados inteiros, inclusive respostas úteis.

## Requisitos e critérios de aceite

1. Não criar resposta vazia para turnos de ferramentas. Agrupar execução em
   Atividade recolhida, conservando argumentos, sucesso/falha e resultados.
2. Exibir o resumo bem-sucedido de task_complete do agente principal como uma
   conclusão Markdown copiável. Não inventar detalhes nem fazer nova inferência
   para formatá-lo. Falha/subagente não encerra a tarefa principal.
3. Ao concluir tarefa principal em Autopilot, voltar o runtime para modo interativo
   e liberar compositor após idle verdadeiro; continuidade intermediária mantém
   Pausar. Próxima mensagem pode escolher Autopilot novamente, sem perder sessão.
4. Respostas extensas não são descartadas pelo limite de eventos de ferramenta.
   Prévia de ferramenta limitada recebe aviso explícito; limite visual não altera
   o contexto que o harness enviou à IA.
5. Ícone Copilot abre cota via SDK account.getQuota: categorias retornadas,
   percentual utilizado, usado/limite quando aplicável, reset e atualização.
   Sem tokens no WebView, sem endpoint privado e sem chamar modelo. Falha/dados
   ausentes não significam saldo zero. Cota da conta não é custo desta sessão;
   outros clientes afetam a cota. AIU do runtime não é fatura.
6. Proxy opcional Rust via hook postToolUse: só resultados já autorizados de
   view/grep/glob; deduplicação exata de content/detailedContent no mesmo resultado,
   com referência explícita. Não cortar linhas de código, instruções, erros, testes,
   contexto único, nem reescrever intenção. Sem I/O ou índice adicional no hook.
   Auditoria de caracteres removidos, não promessa de tokens/créditos economizados.
7. Orientação estática curta: busca focada, expandir instruções/dependências/testes,
   não enviar repo inteiro e entregar conclusão legível. Busca Rust automática
   permanece fail-closed quando contentExclusion.checkPaths não confirma política.
   Proxy não contorna política e não aumenta inteligência intrínseca do modelo.

## Validação

Testes offline de fluxo, respostas extensas, agrupamento, cota/reset/desconhecidos,
deduplicação exata e passthrough; testes reais opt-in isolados com conta existente,
sem projetos pessoais/MCPs pessoais. Build frontend + testes Rust + release e
pacote versionado com DLLs. Documentar o que foi ou não comprovado; sem push/deploy.
