# Recursos — requisitos normativos

## Requisitos

- RS-01 MUST medir IDE e cada filho/árvore como séries separadas de CPU, private bytes, working set, handles e tempo.
- RS-02 MUST usar TaskQueue limitada, prioridades, cancelamento, debounce/coalescing e backpressure; não usar polling rápido permanente.
- RS-03 MUST manter UI responsiva durante I/O, Git, parsing, watchers e terminais.
- RS-04 MUST alertar/impedir novas inicializações conforme configuração quando o sistema está sob pressão, sem matar processo no meio de operação crítica por limiar de RAM.
- RS-05 MUST estabelecer limites para buffers, caches, diffs e scrollback e registrar ultrapassagem.
- RS-06 MUST considerar metas de 150 MB, 1% idle e startup quente de 2 s apenas provisórias até benchmark no Dell alvo.

## Cenários

### RS-S01 — eventos coalescidos

Given uma tempestade de eventos em um repositório
When vários pedidos de refresh chegam antes do worker começar
Then a fila consolida pedidos equivalentes
And a ação explícita do usuário recebe prioridade.

### RS-S02 — pressão de recursos

Given limiar configurado de pressão global alcançado
When o usuário inicia outra sessão
Then a UI alerta ou bloqueia a nova inicialização conforme configuração
And processos em execução não são encerrados automaticamente.

### RS-S03 — comparação limpa

Given cenário com processos filhos
When ResourceSample é registrado
Then IDE e filhos são reportados em linhas distintas
And o relatório não atribui consumo dos filhos à IDE.
