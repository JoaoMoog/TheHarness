# Spec — AgentDesk Lite 0.6.0

## Objetivo e limites

Melhorar recuperação de contexto e produtividade mantendo o harness do Copilot, PowerShell/Copilot/Kiro independentes, permissões Enterprise, modelo/esforço e instruções intactos. Rust organiza evidências; não aumenta capacidade intrínseca da LLM nem transforma caracteres em créditos. Sem modelo local/embeddings, gravação de conversas ou upload automático de repo. Compatibilidade do checker pode continuar indisponível: diagnóstico explícito e fallback nativo são obrigatórios.

## UI inicial

- Cabeçalho Alterações agrupa Preparar todas e lixeira Descartar tudo, inclusive se só há stage. Nenhum descarte automático; modal existente e tratamento de buffers/conflitos permanecem.
- Créditos via account.getQuota: nome real da categoria, percentual grande e barra, reset compacto; valores ausentes/zero/ilimitado e reset passado não viram promessas falsas. Detalhes completos acessíveis, Atualizar sem inferência e Gerenciar abre GitHub. Não simular plano, inline suggestions, sync ou semantic index VS Code.

## Motor incremental

- Estado por raiz em RAM; SQLite in-memory FTS5 por arquivo com ranking BM25 e boosts caminho/símbolo; cache limitado, tempo/bytes/quantidade explícitos. Gitignore, exclusões de gerados/segredos, caminhos confinados, sem reparse/symlinks.
- Reconciliar metadados sob demanda; somente arquivos novos/alterados são relidos/reanalisados; excluir entradas removidas. Nenhum thread de indexação contínua. Mudança de branch revalida inventário; hash obrigatório nos resultados selecionados. Metadados iguais não dispensam leitura/hash do trecho retornado: freshness primeiro.
- Tree-sitter extrai unidades sintáticas e relações candidatas para C#, TypeScript/TSX, JavaScript e Rust. Erros de parse sinalizados. Não afirmar resolução de overloads, DI, reflexão, chamada virtual ou grafo semanticamente completo. Sem parser: fallback lexical.
- Busca tem cobertura da rodada, geração, hashes, truncation e métricas. Orçamento de contexto não exclui instruções/testes necessários silenciosamente; fallback/expansão disponíveis.

## Pacote da tarefa

- agentdesk_context recebe termos focados, prefixo e orçamento. Combina hits, unidades estruturais, imports/referências e testes/instruções/configs candidatos dentro dos limites. Exibe por que cada trecho foi escolhido; texto exato, não resumo da IA.
- Resultados devem ser revalidados e filtrados pela política do harness antes de chegar ao modelo. Se indisponível, retornar erro não-evidência e fallback; não usar o novo índice para contornar exclusões.
- Na criação da sessão, verificar compatibilidade sem inferência e retirar ferramentas Rust indisponíveis do catálogo. Falha de retirada mantém handlers fail-closed e aviso; nunca contorna política. A disponibilidade do checker não substitui checagem de cada arquivo.
- Busca manual/Contexto no painel é local; anexação explícita continua via política existente. No modelo, o pedido original permanece intacto; notas/contexto recebem rótulo de dados não confiáveis.

## Editor e sessão

- Ação seleção: texto e linhas do Monaco; buffer não salvo identificado. Confirmação com prévia, teto de 64 KiB por referência e 128 KiB total, sem salvar o arquivo. Backend valida raiz/caminho e política antes de injetar; preserva referências se envio falha, limpa só por comando explícito/encerramento.
- Notas de trabalho editáveis/fixadas, em RAM, teto de 8 KiB; injetar explicitamente quando modificadas e antes de /compact, sem repetir em todos os turnos. Não são instruções superiores às do projeto. Compactação continua podendo perder detalhes; usuário pode reenviar notas. Limpar sessão apaga notas/referências, não alterações no repo.
- Diagnóstico compatibilidade sem inferência: versão do CLI, sessão, content-policy disponível/indisponível, modo/índice. Não ler token nem tratar login como prova de ferramentas autorizadas.
- MCPs: selecionar subconjunto visualmente e atualizar tools do harness na sessão ociosa; pausar/retomar/remover preservam contexto. Ferramentas excluídas realmente deixam de ser registradas; nomes/schema originais conservados e política/permissões mantidas. No máximo 64 tools MCP; não lazy-load opaco.

## Assertividade e medição

- Orientação explícita: requisitos → localizar/expandir → editar → diff/teste proporcional → resposta com evidências, testes reais e limites. UI disponibiliza checklist e registra atividade, não proclama sucesso a partir de task_complete sozinho.
- Métricas separam entrada sem cache, cache read/write e saída quando runtime informa, sem converter a dinheiro. Diagnóstico local contabiliza arquivos lidos/cache/hash, tempo/geração/cobertura; não usar bytes evitados como tokens faturados.
- Benchmark offline compara varredura fria e consulta incremental quente em fixture multi-arquivo, valida recall e alteração/remoção. Relatório separa carga sintética de economia em tarefas reais. Protocolo A/B documentado: mesmo commit/modelo/esforço/prompt/MCP, sucesso/testes, tokens/cota/latência e árvore de processos, repetições e variação. Nenhuma inferência paga automática.

## Aceitação

Testes: metadados/hash inválidos, alteração/remoção/branch, índice limitado/secretos/gitignore, parse quebrado, pacote contextual e política indisponível, seleção/buffer sem gravação, notas sem repetição involuntária, tool subset real, cota compacta acessível, regressões sessão/Markdown/Git, benchmark offline reproduzível. Build Windows real e pacote portátil com DLLs. Documentar tudo que não foi confirmado em produção/conta do usuário.

## Fontes primárias consultadas

- https://sqlite.org/fts5.html (ranking BM25)
- https://tree-sitter.github.io/tree-sitter/ (análise sintática incremental)
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/hooks/hooks-overview
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing

Garantias de implementação dependem também dos tipos do SDK Rust fixado e do runtime instalado; não presumir que documentação geral valida uma conta Enterprise.
