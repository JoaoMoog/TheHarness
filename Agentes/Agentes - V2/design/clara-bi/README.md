# CLARA · Business Intelligence

Proposta de protótipo inspirada na experiência empresarial e na análise contextual do Tableau Next, com a identidade Figtree/azul da CLARA. Revisão Taste aplicada ao dashboard, biblioteca, IA, editor, colaboração e estados auxiliares.

Navegação principal na parte superior, sem menu lateral. 82 telas e estados desktop usam uma barra única de 72 px; quatro telas mobile usam navegação no topo; as três telas de apresentação mantêm seus controles superiores. O dashboard aproveita a largura integral, e o canvas do editor tem 1.056 px. Páginas, fonte SAP e camadas ficam acima do canvas; as propriedades do gráfico permanecem como ferramenta contextual de edição.

A hierarquia visual destaca a IA, os valores financeiros e a ação principal de cada tela. Ações secundárias usam menos cor; métricas compartilham uma faixa branca; o saldo positivo tem destaque verde. O fundo e os divisores ficaram mais suaves. A biblioteca alterna entre cartões e lista, com miniaturas coerentes com os dados. A IA dispõe de conversa contextual e prévia ampla da análise; no celular, o acesso explícito à CLARA IA tem área de toque de 44 px.

- [Protótipo principal](https://www.figma.com/proto/HDU2QUZRjrN4eBNVpGCsYI/CLARA-Business-Intelligence?node-id=4-2&starting-point-node-id=4%3A2&scaling=scale-down)
- [Arquivo editável](https://www.figma.com/design/HDU2QUZRjrN4eBNVpGCsYI/CLARA-Business-Intelligence?node-id=4-2)
- [Editor visual](https://www.figma.com/proto/HDU2QUZRjrN4eBNVpGCsYI/CLARA-Business-Intelligence?node-id=7-2737&starting-point-node-id=7%3A2737&scaling=scale-down)
- [Criação com IA](https://www.figma.com/proto/HDU2QUZRjrN4eBNVpGCsYI/CLARA-Business-Intelligence?node-id=6-782&starting-point-node-id=6%3A782&scaling=scale-down)
- [No celular](https://www.figma.com/proto/HDU2QUZRjrN4eBNVpGCsYI/CLARA-Business-Intelligence?node-id=11-3963&starting-point-node-id=11%3A3963&scaling=scale-down)

## Jornada

Visão geral → novo dashboard → objetivo → conferir critérios → gerar prévia → editar → salvar → reabrir. Dashboard → CLARA IA → proposta antes/depois → aplicar → desfazer ou salvar. Compartilhar → copiar link → pessoas e permissões → visão de Leitor. O recorte de Tecnologia e a origem dos cálculos continuam disponíveis.

## Conteúdo

89 telas e estados nativos, incluindo quatro telas mobile. 54 tokens, 82 componentes (incluindo ícones), três conjuntos de variantes de botão e 11 estilos de texto. O arquivo está dividido em protótipo, componentes e direção visual.

- Compartilhamento por workspace, membros, papéis, alteração de acesso e visão de Leitor.
- IA com contexto, prévia antes/depois, aplicação, desfazer, espera e recuperação de erro.
- Oito visualizações: barras, colunas, linhas, área, rosca, tabela, cascata e indicador.
- Editor com abas Dados, Aparência e Interações; campos, agregações, comparação, séries, filtros, cores, formatos, eixos, rótulos, tamanho e bordas.
- Galeria de 12 componentes, camadas, duplicação, remoção, reordenação e texto executivo.
- Medidas validadas, cenário de redução de despesas, versões, modelos, apresentação de três páginas e opções de PDF/HTML/CSV.

Figma usa dados demonstrativos e interações guiadas com respostas predefinidas. Os controles mostram as opções propostas e os percursos demonstram ajustes selecionados. Não há edição arbitrária, autenticação ativa, envio de mensagens, cópia funcional de um endereço da aplicação ou geração real de arquivos. Esta entrega cria o design e as interações do protótipo; não altera a aplicação nem configura SAP ou um provedor de IA. A proposta não utiliza bibliotecas oficiais de Tableau ou BTG.

## Verificação

26.192 nós nativos e 2.293 nós com interações. Zero menus laterais e destinos inválidos; nenhum conflito de limites ou sobreposição entre filhos consecutivos no auto-layout, inclusive nas instâncias. Fonte Figtree e nenhuma imagem completa de interface. As telas de leitura compartilhada não apresentam ações diretas de edição ou administração. Nove percursos críticos conferidos entre biblioteca, IA, editor, compartilhamento e mobile; todos têm conexões válidas. Ver `verification-taste.json`.

Revisão visual de dashboard, editor, biblioteca em cartões e lista, início, IA e mobile. A verificação anterior da biblioteca está em `verification-v2.json`: os 54 tokens têm escopos explícitos e sintaxe WEB. O acesso mobile à IA tem 118 × 44 px. Conteúdos maiores dispõem de rolagem vertical sem mover a navegação global.

Dados financeiros: realizado R$ 8.190.000; orçamento R$ 8.319.000; saldo R$ 129.000; execução 98,4%. Tecnologia: realizado R$ 3.210.000; orçamento R$ 3.400.000; saldo R$ 190.000; execução 94,4%.

Simulação de redução de 5% em Tecnologia: realizado R$ 8.029.500; economia R$ 160.500; saldo R$ 289.500; execução 96,5%.

Os scripts em `run-*.js` são registros das fases de criação e não devem ser reexecutados sem conferir `state.json`. Previews atuais: `dashboard-taste.png`, `editor-taste.png`, `library-taste-final.png`, `library-list-taste-final.png`, `home-taste-final.png`, `ai-taste-final.png` e `mobile-taste-final.png`. O código da aplicação não foi alterado.
