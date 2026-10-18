# CLARA Studio — evidências e decisões

18/10/2026. Segunda etapa das melhorias de design, sobre a prioridade de início, biblioteca e salvamento.

## Comportamento entregue

- O dashboard destaca uma conclusão calculada sobre o recorte, com tratamento distinto para ausência de registros e orçamento zero. A investigação abre o centro de maior desvio positivo; voltar a todos os centros mantém os demais filtros.
- Os filtros ficam em uma área expansível. O recorte permanece visível e a expansão é mantida durante consultas.
- A trilha Fonte / Período / Cálculo / Atualização abre um painel contextual no próprio dashboard. Indicadores e gráficos também oferecem acesso ao cálculo correspondente.
- A evidência usa a resposta da consulta atual: revisão, fonte, unidade, filtros e números. A amostra apresenta até cinco registros e informa que os cálculos usam todos os registros do recorte. A contagem fora do recorte só aparece quando a base completa e a consulta compartilham fonte e revisão.
- As datas de edição do dashboard e atualização da fonte continuam distintas. Revisões diferentes desde o salvamento produzem aviso explícito.
- O comparativo ocupa a maior coluna. Os gráficos oferecem tabelas de valores e eixos legíveis em unidades, milhares ou milhões; não houve mudança dos cálculos financeiros.
- Propostas no início e no assistente compartilham a tabela Atual / Proposto. Só campos alterados entram na tabela; mudanças de período são agrupadas, e valores falsos, zero e datas removidas são preservados. Aplicar, desfazer e salvar continuam operações separadas.
- Confortável / Compacta muda tipografia e espaçamento sem alterar o documento. A preferência fica neste navegador (`clara:ui-density:v1`); bloqueio de armazenamento não impede o uso. Mobile mantém alvos de toque e texto legíveis.
- A identidade Figtree/navy/azul foi preservada, com texto de trabalho de 14 px (13 px no modo compacto desktop), metadados de 12–13 px e transições curtas já existentes. Movimento reduzido continua respeitado.

## Verificação

- TypeScript e build de produção.
- 14 testes de lógica/API/renderização: incluem conclusões com orçamento zero, desvios compensados, comparação de propostas, datas removidas, unidades dos eixos, sugestões, versões e permissões.
- Cenários Playwright: `design-evidence.spec.ts`, `design-priority.spec.ts` e `home-refinement.spec.ts`.
- Verificações de investigação, preservação do recorte, evidências, retorno de foco, comparação/aplicação/desfazer, armazenamento da densidade e regressão da primeira etapa.
- Capturas e Axe nas superfícies alteradas em desktop/mobile. Não é uma auditoria manual completa de acessibilidade nem validação de integrações externas.
- Detector Impeccable emitiu apenas avisos sobre tokens não reconhecidos no DESIGN.md da geração anterior. A autoridade visual deste Studio continua sendo `design/clara-sap-studio/DESIGN.md`; as extensões de legibilidade/densidade estão descritas acima. Nenhuma substituição de identidade foi feita.

Não foram adicionados provedores, alterações de APIs ou persistência de análises. A retomada da primeira etapa continua limitada à página aberta; dashboards salvos usam o armazenamento já configurado.
