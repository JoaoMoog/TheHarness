# CLARA — proposta web v2

Abra `clara-web-v2.html` no Chrome ou Edge. É um arquivo independente, com fontes, ícones e código incorporados. Não precisa iniciar o servidor. Os arquivos importados e ajustes ficam neste navegador, na chave `clara:design:workbench:v2`; não são enviados ao servidor da CLARA.

## Direção

Navegação lateral azul profundo, destaque cobalto, verde claro nas ações principais, tipografia Figtree e gráficos com valores conferíveis. Cinco telas: Painel, Explorar dados, Minhas análises, Fontes de dados e Apresentar. Layout adaptado para desktop e navegador móvel, com menu compacto e tabelas que rolam dentro do painel.

## Interações implementadas

- Explorar os exemplos de finanças, vendas e estoque; filtrar períodos, selecionar múltiplos grupos, mudar agrupamento e investigar barras ou valores da tabela.
- Comparar dois períodos mantendo os filtros das outras dimensões.
- Criar fórmulas de aritmética segura, conferir a prévia e identificar registros excluídos por divisão por zero ou campos ausentes.
- Configurar indicadores e título, registrar observações, salvar, favoritar, buscar, duplicar e restaurar versões de análises.
- Preservar perguntas e observações ainda não enviadas após navegação ou recarga, além do recorte ativo.
- Importar CSV, XLSX com uma aba ou JSON; conferir operação, unidade, agrupamento, datas e comparação antes de adicionar a fonte.
- Conferir qualidade, cálculos, valores temporais e registros com busca e paginação.
- Preparar quatro páginas de apresentação com resumo editável, navegar pelo teclado e baixar CSV com contexto, relatório HTML ou apresentação HTML. Os arquivos HTML podem ser impressos ou salvos em PDF pelo navegador.
- Buscar ações e análises com Ctrl/Cmd K; consultar a atividade local.

O assistente usa `demoPlan`, com regras demonstrativas. Não há geração por IA nem chamada a um modelo. Os dados SAP iniciais são simulados. Contas, equipes, permissões, fontes do servidor e auditoria continuam pertencendo à aplicação principal; este protótipo não está integrado a esses serviços.

## Cálculo e implementação

O protótipo importa os módulos existentes da CLARA para cálculo, fórmulas, comparação, qualidade, interpretação demonstrativa, importação e exportação. Não mantém um motor de cálculo paralelo. O estado local tem uma chave própria e não modifica os dados da aplicação principal.

Fontes do estudo:

- `clara-workbench.ts`: telas e interações.
- `clara-workbench.css`: identidade, componentes, estados e responsividade.
- `build-clara-workbench.mjs`: empacotamento do HTML independente com esbuild e dependências já instaladas em `app`.
- `verify-clara-workbench.mjs`: validação isolada no navegador, sem acessar contas ou banco de dados.

Na raiz do projeto, com Node disponível:

```powershell
node design/build-clara-workbench.mjs
node app/node_modules/typescript/bin/tsc -p design/tsconfig.json
node design/verify-clara-workbench.mjs
```

## Evidência

Typecheck passou. O runner passou por 14 fluxos funcionais e auditou 15 telas/estados, incluindo os cinco destinos em larguras de 1440 e 390 pixels. Não encontrou erros de JavaScript, pedidos HTTP externos, transbordamento horizontal ou violações nos testes automatizados WCAG 2 A/AA e 2.1 AA executados. Também verificou foco após investigação de gráficos e fechamento de painéis.

Resultados e capturas estão em `clara-workbench-review/checks.json` e `clara-workbench-review/*.png`. A auditoria automática não equivale a uma avaliação completa com tecnologias assistivas ou pesquisa com usuários.

## Aplicação ao produto

Esta entrega revisa a proposta visual e funcional em um artefato independente. Para transferir a direção à aplicação, as telas devem utilizar os componentes React e os serviços existentes de identidade, fontes, rascunhos, relatórios e equipes. O armazenamento demonstrativo local não deve substituir esses serviços. A estrutura foi dividida por telas e componentes visuais para facilitar essa implementação.
