# CLARA: edição, apresentações e dados livres

Implementação de 18/10/2026 na aplicação `/`. O piloto continua com Amazon Bedrock AgentCore e SQLite; nenhuma credencial ou infraestrutura foi substituída.

## Experiência

- Conclusão do dashboard com espaçamento próprio, ação alinhada e detalhes recolhíveis. Indicadores adaptam a grade à largura disponível, inclusive com o editor aberto.
- Marca horizontal oficial BTG Pactual, obtida do [Brand Center](https://brandcenter.btgpactual.com/guia-visual). Os SVGs conservam os vetores originais; a área vazia da prancheta foi ajustada para leitura no cabeçalho.
- Slate fixo, com modos claro e escuro. Preferências antigas de Tangerine são normalizadas.
- Calendário próprio em português: entrada manual, teclado, seleção de mês, Hoje e Limpar.
- Administração compacta, criação/convites/histórico recolhíveis, sem Estado da operação. Trocar de espaço conserva a tela de administração.
- Guia de 12 balões sobre as telas reais, com avançar, voltar, pular e concluir. A conclusão é persistida por usuário; o guia pode ser reaberto no perfil.

## Gráficos

Em Editar, clicar em qualquer gráfico seleciona seu painel. Cada gráfico possui configuração independente de título, visualização, agrupamento, medida, comparação, soma/média/contagem, coluna de data, unidade, cor, legenda e limite de grupos. Também é possível adicionar, duplicar, remover e reordenar.

Documentos antigos são normalizados para o novo contrato. Documentos novos preservam a lista de gráficos. Consultas e salvamento conferem as colunas e a autorização da fonte no servidor. Ausências permanecem ausentes; médias usam registros, não médias dos grupos. Fonte pausada bloqueia também gráficos e apresentações.

## Apresentar e unificar

Pedidos como “Crie uma apresentação deste dashboard para a diretoria” e “Unifique Desempenho financeiro e Visão da equipe” geram propostas no AgentCore. Se faltarem nomes ou critérios, a CLARA pede esclarecimento. Os recursos também ficam em Mais opções do dashboard.

A apresentação usa HTML independente, com marca, capa, visão executiva, gráficos, valores, fontes, filtros e revisões. Possui navegação por teclado, tela cheia e impressão em PDF. O servidor calcula os números; o modelo não fornece HTML executável nem totais inventados. Textos são escapados e a prévia usa iframe isolado. O arquivo funciona sem dependências externas.

A unificação cria um rascunho com os gráficos selecionados, conservando fonte e filtros de cada um. Não soma automaticamente métricas de dashboards diferentes. A persistência depende de Salvar. Limites: 12 dashboards selecionados e 24 gráficos no resultado.

O Harness recebe as novas instruções por invocação; não é necessário publicar um novo runtime para atualizar esse contrato. Tools do modelo continuam desativadas. As operações são validadas e executadas pela aplicação.

## Importação

CSV, XLSX e JSON passam por prévia, inferência e revisão dos tipos. O modo padrão preserva todas as colunas, sem exigir empresa, centro, realizado ou orçamento. O mapeamento financeiro é opcional. Identificadores com zeros iniciais e valores ausentes são preservados.

Limites atuais: 256 colunas originais, 20 mil registros, 8 MB e uma aba por arquivo XLSX. Fontes inteiramente numéricas recebem uma coluna adicional Registro para agrupamento. Não há promessa de suporte a documentos binários ou estruturas aninhadas arbitrárias.

SAP aceita a coleção de registros JSON/OData configurada no servidor e conserva suas colunas. O importador genérico não exige `SAP_STUDIO_MAPPING`; esse mapeamento continua necessário apenas para o modelo financeiro legado. A conexão real exige endereço e autenticação da organização. A importação genérica foi testada com resposta OData simulada; não foi feita carga de um SAP corporativo nesta entrega.

Novas operações autenticadas: `widgets/query`, `presentations`, `dashboards/merge` e `datasets/sap`. OpenAPI atualizado para 1.3.0.

## Verificação

- 129 testes de servidor/domínio aprovados, incluindo 90 colunas, isolamento entre espaços, agregações, HTML, unificação, SAP genérico, fonte pausada e normalização do contrato do modelo.
- Testes reais do AgentCore aprovados para apresentação atual, união de dois dashboards, pergunta quando faltam nomes e gráfico de fonte genérica com medida/unidade corretas; nenhuma análise persistida pelo modelo.
- Fluxos de navegador cobrem marca/Slate, calendário, edição individual/salvamento, importação, HTML baixável, unificação, troca de espaço sem navegação e percurso completo do onboarding, com inspeção em desktop/celular e temas claro/escuro.

Scripts: `scripts/test-executive-live.ts`, `tests/studio-expansion.test.ts` e `tests/e2e/product-expansion.spec.ts`.
