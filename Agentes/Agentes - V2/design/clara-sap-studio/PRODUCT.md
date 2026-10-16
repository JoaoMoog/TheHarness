# CLARA · SAP Analytics Studio

CLARA significa **Central de Leitura, Análise e Relatórios Assistidos**. Este artefato é um protótipo web local e independente para gestores, analistas financeiros e controllers transformarem uma pergunta sobre dados SAP em uma análise conferível, editável e compartilhável na interface.

## Autoridade e escopo

O usuário escolheu a direção **code-led**, com composição, abrangência e conteúdo definidos na conversa e registrados em [BRIEF.md](BRIEF.md). A inspiração é SAP Analytics Cloud/Fiori, preservando o nome CLARA e a família Figtree. Não existiram concept seed nem composição em imagem aprovada: a autoridade visual é a direção escolhida pelo usuário, concretizada no código. Este protótipo não usa uma biblioteca oficial da SAP e não representa vínculo com a SAP.

O [PRODUCT.md da aplicação principal](../../app/PRODUCT.md) fornece a origem da marca e da jornada de análise, mas descreve outro produto implementado. Sua referência BTG é incumbente/histórica para este trabalho; não governa o novo mundo SAP deste artefato. Seus servidores, autenticação, importação de arquivos, integrações e contratos de contas não fazem parte deste protótipo. A aplicação principal permanece independente.

## Jornada demonstrada

A primeira abertura apresenta o dashboard financeiro pronto, filtros, quatro indicadores, comparação por centro, evolução mensal e tabela de valores. O assistente contextual começa aberto em telas a partir de 1100px. A jornada local é pergunta → critérios → gerar dashboard; ajustes seguem pedido → prévia → aplicar → desfazer o último ajuste. Criar um dashboard passa por três estados temporizados de preparação. Pedidos fora das intenções conhecidas recebem orientação explícita.

Os oito destinos da navegação são:

| Destino | Comportamento implementado |
| --- | --- |
| Visão geral | Pergunta inicial, análises recentes, desvios e atividade local. |
| Dashboards | Biblioteca pesquisável, favoritos, abertura e duplicação de análises. |
| Explorar dados | Registros financeiros pesquisáveis, com filtros de centro, período e empresa. |
| Planejamento | Edição local dos quatro orçamentos, nome da revisão e restauração da base. |
| Previsões e cenários | Redução de despesas de Tecnologia, comparação com o realizado e projeção ilustrativa. |
| Modelos de dados | Campos da base e uma medida calculada escolhida entre três operações predefinidas. |
| Conexões | Três conectores demonstrativos que representam a mesma base local; pausar/reconectar a fonte. |
| Administração | Pessoas fictícias, papéis demonstrativos e atividade local; área restrita na prévia de Leitor. |

O dashboard é a superfície de análise acessada pela biblioteca, além dos oito destinos. Seu editor ocupa o painel direito e permite renomear a análise e o gráfico, escolher entre oito representações, destacar desvios, ocultar o saldo ou comparativo, duplicar o comparativo e alternar a ordem dos gráficos. Editor e chat são mutuamente exclusivos. Recolher o painel devolve sua largura ao conteúdo no desktop.

## Dados e cálculos

Existem **72 registros sintéticos**: quatro centros × nove meses de 2026 × duas empresas (Matriz e Filial). A base está em `core.mjs`, sem leitura externa. O recorte completo soma R$ 8.190.000 de realizado, R$ 8.319.000 de orçamento e R$ 129.000 de saldo. Os filtros oferecem todos os meses ou julho–setembro, todos os centros ou um centro e todas as empresas ou uma empresa.

- Realizado e orçamento são somas dos registros filtrados.
- Saldo é orçamento menos realizado; execução é realizado dividido por orçamento × 100.
- Operações e Comercial excedem o orçamento da base completa.
- A simulação de 5% aplica a redução aos R$ 3.210.000 de Tecnologia e produz economia de R$ 160.500, sem mudar o realizado original. Cenários usam a base completa, independentemente dos filtros do dashboard.
- O controle de cenário oferece 0–30%; pedidos interpretados no chat são limitados a 0–100% pelo código. Essa diferença descreve a implementação atual, não uma regra de produto para outras superfícies.
- A projeção de outubro a dezembro é uma fórmula ilustrativa baseada na média mensal, no percentual do cenário e em pequeno incremento mensal; não existe modelo preditivo.
- Planejamento mantém valores separados do orçamento original. Salvar registra o nome/atividade da revisão atual; não cria um catálogo de revisões de planejamento.

Fontes e critérios são apresentados em diálogo. CSV exporta o resumo agrupado do recorte atual; apresentação abre a composição no navegador, cuja impressão permite gerar PDF.

## Estado e persistência

O estado é gravado automaticamente em `localStorage`, na chave `clara:sap-studio:v1`: dashboard em edição, filtros, conversa e texto não enviado, biblioteca, favoritos, orçamento revisado, cenário, medida, disponibilidade da fonte, comentários, pessoas, versões de dashboard e atividade. Salvar dashboard atualiza explicitamente a biblioteca e registra uma versão; o histórico conserva até 12 snapshots. A prévia de Leitor é reiniciada ao recarregar.

Abertura do chat/editor, navegação recolhida, diálogo aberto, prévia de ajuste, preparação e possibilidade de desfazer são estados da sessão React, não contratos de recuperação persistente. A gravação local não equivale a salvar uma versão da análise na biblioteca. Se o navegador bloquear o armazenamento, a interface informa que as mudanças duram apenas a sessão. As origens `file:` e `http:` têm armazenamento separado.

## Estados e limites

Há estados vazios para buscas sem resultados e ausência de versões, preparação de análise, fonte pausada, armazenamento bloqueado, controles indisponíveis e área administrativa restrita na visão de Leitor. O chat é um interpretador determinístico de intenções em português; não chama um modelo de IA. Pausar a fonte interrompe novos pedidos no chat e apresenta o estado de indisponibilidade no dashboard; os registros sintéticos continuam presentes no navegador.

Pessoas, papéis, comentários e compartilhamento são demonstrações locais. A prévia de Leitor desabilita ações de alteração e oculta a área administrativa, mas não fornece autenticação ou autorização de produção. Adicionar uma pessoa não envia convite. Copiar o link copia o endereço local e não publica a análise. Nenhuma mensagem ou dado é enviado a outras pessoas. Não existe servidor SAP, servidor de IA, escrita no SAP, credencial necessária ou publicação externa nesta entrega.

## Entrega e evidência

`index.html` é o artefato autossuficiente; código, estilos, ícones e Figtree são incorporados pelo build. Pode ser aberto diretamente ou servido em `127.0.0.1:4178`. Instruções e comandos de verificação ficam no [README.md](README.md). O sistema visual extraído do código está em [DESIGN.md](DESIGN.md), com extensões em [.impeccable/design.json](.impeccable/design.json).

Esta documentação foi extraída das fontes em 14/10/2026. A revisão final de navegador e o veredito independente de correções ainda estavam pendentes neste registro; este documento não declara aprovação final de acessibilidade, comportamento ou acabamento.
