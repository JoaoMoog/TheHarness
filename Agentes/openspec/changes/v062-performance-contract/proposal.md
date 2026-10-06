# Política de desempenho transversal

## Problema

A meta central é trabalhar por horas sem a IDE consumir recursos por trabalho
dispensável. O hotfix 0.6.1 limitou Git/árvore e retirou workers semânticos, mas
restavam cópias por tecla, caches/abas ilimitados, diff antecipado, browsers sem
limite e bytes MCP/chat recebidos antes dos limites de apresentação.

## Plano

1. Definir orçamentos e invariantes de preservação de trabalho/contexto.
2. Eliminar cópias por tecla e instanciar/liberar diff sob demanda.
3. Limitar admissão agregada de buffers, árvore, previews e IPC.
4. Tornar manutenção serial, adaptativa e sensível a visibilidade.
5. Limitar chat/MCP antes das alocações pesadas de parse/UI.
6. Adicionar testes adversariais, medição da árvore de processos e gate.
7. Buildar pacote versionado; preservar app/sessões anteriores do usuário.

Não é objetivo limitar o Windows, suspender agentes do usuário, cortar contexto,
prometer economia financeira ou comparar VS Code sem benchmark equivalente.
