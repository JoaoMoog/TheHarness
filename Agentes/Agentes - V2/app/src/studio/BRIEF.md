# CLARA Studio integrado

Direção atual: Slate Admin Console 1.0.4, escolhido explicitamente pelo usuário em 18/10/2026. Substitui a identidade visual SAP/Fiori no Studio integrado. Os arquivos em `design/clara-sap-studio/` registram o protótipo anterior.

THESIS: transformar perguntas financeiras em análises conferíveis, com aplicação explícita das propostas.
OWN-WORLD: tokens do template Slate, Geist e Geist Mono locais, navegação neutra em dois grupos, cabeçalho de 48px, painel interno, controles com bordas e indicadores sem aparência de botão. Paletas Slate/Tangerine, claro/escuro, preferência local persistida.
STORY: entrar → explorar → perguntar → conferir → aplicar → salvar e compartilhar com equipe autorizada.
FIRST VIEWPORT: login no primeiro acesso; depois conversa para criar análises, contexto de dados recolhível e dashboards recentes com prévias reais. Dashboard com conclusão, quatro indicadores, gráficos e evidências. Mobile com navegação/painéis sobrepostos, filtros recolhíveis e tabelas financeiras apresentadas como registros rotulados.
FORM: implementação em Next/React existente, sem dados fictícios da skill e sem telas alheias ao produto. A navegação mantém as oito áreas funcionais da CLARA. Interface anterior preservada em `/classic`.

Pedido atual: concluir tudo que dispensa configuração, preparando Docker/Kubernetes, contratos e adaptadores. SAP, SSO, IA externa e persistência definitiva ficam pendentes. Armazenamento em memória explícito. Dados demonstrativos e assistente por regras devem estar identificados. Integrações reais selecionadas com erro não podem voltar silenciosamente para a demonstração.

Verificação visual atual: `app/tests/e2e/slate-design.spec.ts`, artefatos em `app/.local/slate-final/` e registro em `docs/CLARA-DESIGN-SLATE.md`. Os testes de conversa, evidências, biblioteca e painéis continuam verificando os fluxos existentes.
