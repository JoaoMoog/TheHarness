# CLARA

**Central de Leitura, Análise e Relatórios Assistidos.** Seus dados, com clareza. Da pergunta à próxima decisão.

Aplicativo web de análise para pessoas de negócio. O primeiro exemplo é financeiro, mas fontes, indicadores e dashboards aceitam vendas, compras, estoque e outros assuntos. A pessoa seleciona dados demonstrativos do SAP ou importa um arquivo e descreve o que quer entender, sem precisar conhecer SQL, APIs, tabelas SAP ou fórmulas.

Primeiro produto: demonstração com dados SAP simulados; arquivos importados são processados de verdade. Autenticação Microsoft via MSAL e interpretação AWS Bedrock possuem adaptadores configuráveis, sem fingir conexão quando não configurados. Não criar regras contábeis sem o usuário: mostrar as operações realmente executadas e permitir definir quais registros contam.

Jornada aprovada: trazer dados → contar o objetivo → esclarecer quando necessário → conferir interpretação e critérios → filtrar e refinar → salvar → reabrir e exportar. Um dashboard responde uma pergunta e mostra fonte, recorte e cálculo. A prévia exige salvamento explícito. Filtros de consulta do dashboard salvo não sobrescrevem seu plano persistido; “Pedir outra análise” inicia uma conversa e preserva o original.

A análise ocupa a área principal, com assistente recolhível à direita no desktop e modal nas telas menores. Recolher preserva texto, conversa, filtros e pedido em andamento. Visão geral, biblioteca de dashboards, fontes e integrações compartilham a mesma navegação.

Evolução de 11/10/2026: “Retomar análise” conserva um trabalho por pessoa e espaço na conta, com cópia na sessão da aba para falhas de conexão. Texto não enviado, fonte/revisão, conversa e plano completo podem ser recuperados em outro navegador. Salvamento automático usa revisões e não sobrescreve conflitos. Sair limpa a cópia local após salvamento, preservando a conta. O prazo de 30 minutos da conversa continua valendo; sua recuperação explícita cria outra conversa válida após conferir fonte e plano. Mudança da fonte remove a prévia e preserva a pergunta. Nova conversa, troca de fonte e criação de outra análise confirmam o descarte de trabalho existente.

A importação apresenta operação, unidade, agrupamento, data e critérios antes da confirmação. Falhas posteriores à importação ou ao salvamento oferecem atualizar a tela sem repetir a operação concluída. Cada gráfico oferece sua tabela de valores, mesmo quando a tabela geral de detalhes está oculta; períodos multianuais exibem o ano. O dashboard salvo identifica filtros temporários junto aos controles e permite restaurar seu recorte original.

Fontes possuem qualidade conferível, atualização compatível, histórico e restauração. Dashboards podem ser editados, duplicados e restaurados por versão. Indicadores adicionais, fórmulas aritméticas por registro, comparação entre períodos e multisseleção são configurados antes de salvar. Alterações do plano são explicadas e exceções abrem o recorte correspondente. Relatório executivo e apresentação HTML são revisados antes do download; o navegador imprime ou salva PDF.

Contas locais e Microsoft têm espaços pessoais. Equipes compartilham fontes e dashboards com papéis Leitor, Editor e Administrador, convites de uso único, revogação e auditoria. Rascunhos continuam privados por pessoa e espaço. Backup/restauração SQLite e monitoramento local estão documentados em [OPERACOES.md](OPERACOES.md). Novos endpoints autenticados e tabelas internas são criados automaticamente, mantendo os dados e contratos anteriores.

CLARA substitui a identidade visual anterior do Prometeu. A referência autorizada são materiais públicos do aplicativo BTG Pactual Investimentos, interpretados para web executiva. Não há pacote oficial do design system BTG nem vínculo de marca. Figtree, azul profundo, azul de ação, ciano de comparação e superfícies claras orientam [DESIGN.md](DESIGN.md).

Limites: não implementar escrita no SAP, publicação externa ou integração Copilot sem contrato de provedor conhecido. Demonstração claramente identificada. O modelo propõe; servidor valida; pessoa confere e salva. Não usar saída da IA para executar código ou SQL. A IA real foi adiada pelo usuário. O conector SAP JSON/OData somente leitura e Microsoft dependem da configuração empresarial; Microsoft, SAP e Bedrock externos não foram validados com serviços reais nesta entrega.

A mudança preserva APIs, cálculos, dados e integrações. Identificadores técnicos `prometeu.sqlite`, `prometeu-session`, `PROMETEU_DATA_DIR`, nome do pacote e `app: "prometeu"` no health check permanecem por compatibilidade. Não houve publicação externa. Briefs e especificações anteriores são históricos. Consulte os comandos de verificação no [README principal](../README.md#verificação).
