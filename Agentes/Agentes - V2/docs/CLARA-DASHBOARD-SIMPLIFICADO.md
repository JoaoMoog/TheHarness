# Dashboard simplificado — 18/10/2026

Pedido: reduzir a informação no cabeçalho e adiar Planejamento, Previsões e Cenários.

- Cabeçalho único com título, estado de salvamento e ações Editar, CLARA IA e Salvar.
- Compartilhar, apresentar, exportar, histórico e desfazer ficam em Mais opções, com navegação por teclado, Escape e retorno de foco.
- O recorte aparece uma única vez. Anos completos usam apenas o ano; outros intervalos usam datas em português.
- Conclusão curta com investigação do centro e detalhes em Ver análise. Fontes e critérios ficam recolhidos abaixo dos resultados; cada indicador mantém acesso ao cálculo.
- Planejamento e cenários saíram do menu, da busca e das abas. Contratos, cálculos e registros foram preservados. A IA recebe o escopo atual e o servidor impede propostas aplicáveis dos módulos adiados.

Validação: build de produção e 121 testes de lógica aprovados. Quatro fluxos de navegador aprovados: dashboard compacto, evidências/investigação/desfazer, biblioteca/retomada/salvamento e piloto com exportação/reabertura após reinício. Layout verificado em 320, 390, 768, 1024 e 1440 px, em temas claro e escuro; auditoria WCAG A/AA sem violações no dashboard em 390 e 1440 px.

O detector Impeccable apresentou apenas avisos de escala tipográfica em relação ao DESIGN.md anterior. A autoridade vigente é Slate, escolhida pelo usuário e registrada em PRODUCT.md: títulos de 22–24 px e metadados de 12 px seguem a hierarquia existente. Houve uma correção visual de alinhamento do estado Salvo no celular e uma revisão final.

Piloto reiniciado com o build atualizado; `/api/health` respondeu `ok`. Integração AgentCore e dados persistentes mantidos.
