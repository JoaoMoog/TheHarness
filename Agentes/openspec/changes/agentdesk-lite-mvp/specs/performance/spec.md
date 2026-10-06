# Performance — requisitos normativos

## Requisitos

- PF-01 MUST comparar baseline A (VS Code e agentes), B (AgentDesk e mesmos agentes) e C (terminais puros e mesmos agentes) com tarefas/repositórios equivalentes.
- PF-02 MUST usar no mínimo cinco repetições cold/warm no Dell alvo, registrando hardware, versão, processos de fundo e política relevante.
- PF-03 MUST medir p50/p95 de interação, abertura de arquivo, atualização Git, startup, CPU, memória privada, working set, handles e crescimento após ciclos.
- PF-04 MUST cobrir 1/5/12/20 repositórios, 0/1/3/5 agentes fake, 1/100/10.000 arquivos alterados, output intenso, diff de 10 MB e idle de 10 minutos.
- PF-05 MUST marcar meta não atingida como falha/bloqueio; não altera threshold retroativamente sem aprovação.

## Cenários

### PF-S01 — startup quente

Given cache e configuração definidos pelo protocolo
When cinco execuções warm são medidas no Dell alvo
Then p50/p95 e amostras individuais são arquivados
And processos filhos são excluídos ou separados conforme métrica.

### PF-S02 — crescimento de memória

Given aplicação com fixtures e agentes fake
When 100 arquivos e 100 sessões fake são abertos/fechados pelo protocolo
Then a série de memória/handles é registrada
And crescimento não explicado bloqueia a meta correspondente.
