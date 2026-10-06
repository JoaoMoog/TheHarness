# Plano de benchmark

Status: planejado. Nenhum resultado foi medido nesta rodada.

## Perguntas e limites

Medir se a aplicação atende a orçamento acordado sem deslocar custo para processos filhos ou sacrificar correção. As metas iniciais de até 150 MB private bytes, até 1% CPU médio em idle e startup quente até 2 s são provisórias; somente o Dell alvo pode confirmá-las. Não se conclui desempenho comparando hosts diferentes, mocks visuais ou uma execução.

## Cenários comparáveis

| Série | Ambiente | Carga igual |
|---|---|---|
| A | VS Code + extensões/agentes usados no fluxo alvo | mesmos repos, tarefa, número de agentes e tempo |
| B | AgentDesk Lite + mesmos agentes | mesmos repos, tarefa, número de agentes e tempo |
| C | terminais puros + mesmos agentes | mesmos repos, tarefa, número de agentes e tempo |

Cada série executa cold e warm cinco vezes no mínimo. Registrar modelo/CPU/RAM/SSD, Windows/build, driver relevante, versão da aplicação/ferramentas, resolução/DPI, energia, antivírus/EDR e processos de fundo que não possam ser isolados. A ficha do Dell é pré-requisito.

## Matriz

| Dimensão | Níveis |
|---|---|
| repositórios fixture | 1, 5, 12, 20 |
| agentes fake | 0, 1, 3, 5 |
| arquivos alterados | 1, 100, 10.000 |
| diff | pequeno, linhas longas, 10 MB |
| terminal | ocioso, UTF-8/ANSI, output intenso |
| estabilidade | idle 10 min; abrir/fechar 100 arquivos e 100 sessões fake |

## Métricas e protocolo

- Startup cold/warm até shell interativo; abertura de arquivo; refresh Git; troca de aba/hunk; p50/p95 e amostras individuais.
- CPU do PID IDE e PIDs filhos/árvore separadamente; média e p95 no intervalo definido.
- Private bytes, working set, handles, buffers/cache/scrollback e tendência após ciclos.
- Número de scans, pedidos coalescidos, duração Git, erros/cancelamentos e versão de fixture.
- Executar uma rodada de aquecimento definida, depois cinco medições. Não alterar cache, threshold ou carga entre comparações sem reiniciar a série.

## Critérios e relatório

Cada relatório inclui dados brutos, script/procedimento, configuração, fixture hash, gráficos/tabelas, falhas e interpretação limitada. Um threshold não atingido é falha ou bloqueio; sua alteração exige ADR e aprovação. O relatório afirma somente o que foi medido: consumo da IDE não inclui filhos por omissão; consumo total informa explicitamente a soma. Nenhum resultado deve ser reutilizado como evidência do Dell se o host diferir.
