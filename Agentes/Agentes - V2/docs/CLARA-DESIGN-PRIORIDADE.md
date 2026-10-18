# CLARA Studio — primeira prioridade de design

18/10/2026. Evolução da superfície existente em `/`, mantendo Figtree, navy, azul de ação e superfícies claras.

## Entrega

- Início: entrada mais compacta, acesso à importação, sugestões obtidas do catálogo da fonte selecionada (incluindo a fonte de um dashboard escolhido) e retomada da última análise aberta.
- Retomada: conserva título, composição, fonte e filtros em memória enquanto a página está aberta. Não constitui recuperação após recarga, logout ou troca de espaço. Abrir outra análise exige confirmar o descarte quando há alterações pendentes; fechar/recarregar a página também aciona a proteção do navegador.
- Prévias: consultam o recorte de cada dashboard salvo, mostrando realizado e até três centros de maior valor. Capa personalizada é preservada. A lista compacta mostra metadados; a galeria mostra dados. Consultas são adiadas até o cartão se aproximar da área visível e canceladas ao sair.
- Biblioteca: galeria/lista, busca e favoritos; painel do assistente recolhido ao entrar para não encobrir a lista no celular.
- Salvamento: estado persistente derivado da comparação entre documento em edição e documento confirmado pelo servidor. Falhas conservam o documento e o aviso. O modo temporário identifica que o salvamento vale somente para aquela execução.
- Datas distintas: “Editado em” refere-se ao dashboard; “Dados atualizados em” vem da linhagem da consulta.

## Validação

- Build de produção e TypeScript aprovados.
- 11 testes de lógica: comparação de documentos, sugestões, contratos, cálculos, versões e permissões.
- Dois cenários de navegador aprovados: `design-priority.spec.ts` e `home-refinement.spec.ts`. Verificam prévias com recortes reais, galeria/lista, busca, retomada, cancelamento de descarte, falha e recuperação de salvamento, teclado e ausência de erros JavaScript.
- Axe nas superfícies alteradas em 1440 e 390 px: nenhuma violação WCAG A/AA detectada. Não equivale a uma auditoria manual completa de acessibilidade.
- Capturas desktop/mobile em `app/test-results/design-priority-prioridade-ed534-ada-e-salvamento-confirmado/`.
- Detector Impeccable: somente avisos de escala tipográfica/raios contra o DESIGN.md da geração anterior. A autoridade desta superfície continua sendo o sistema do Studio em `design/clara-sap-studio/DESIGN.md`; mantidos metadados de 12 px, títulos de 18 px e raios compactos já presentes no Studio. Título de retomada de 17 px é uma extensão local.

Sem alteração de APIs, armazenamento, cálculos ou integrações externas. A etapa seguinte, com trilha de evidências e comparação visual das propostas, foi concluída e está documentada em `CLARA-DESIGN-EVIDENCIAS.md`.
