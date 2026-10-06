# Plano v0.6.0 — contexto verificável, sem reduzir raciocínio

1. Antes do motor: mover Descartar tudo para a barra de Alterações, mantendo confirmação; redesenhar cota em painel compacto, detalhes recolhidos e ações reais Atualizar/Gerenciar.
2. Criar índice incremental em RAM, SQLite FTS5/BM25 e Tree-sitter para TS/JS/C#/Rust. Atualizar sob demanda, não por loop em segundo plano; verificar hashes dos trechos antes de retornar. Preservar orçamento, exclusões e cobertura/fallback.
3. Criar agentdesk_context: funções completas, relações sintáticas, instruções/configuração/testes candidatos, expansão explícita, sem promessa de resolução semântica de compilador.
4. Referenciar seleção ou buffer não salvo com prévia e confirmação. Política de conteúdo precisa confirmar cada caminho antes de fornecer texto ao modelo; sem bypass quando checker indisponível.
5. Notas fixadas em RAM, diagnóstico da compatibilidade e seletor visual de ferramentas MCP. Manter ID da sessão e permitir retirar referências/fatos deliberadamente, sem limpeza automática.
6. Observabilidade: separar cache/entrada/saída, consultas/leituras/tempo/cobertura. Checklist de validação e benchmark local offline repetível; custos/CPU de tarefa real contra CLI/VS Code exigem avaliação controlada, não inventar economia.
7. Testes JS/Rust, frontend/release e pacote separado v0.6.0. Não encerrar janelas/conversas antigas, fazer push/deploy nem editar projetos pessoais.

Agente auxiliar jtk faz descoberta somente leitura; decisões, edições e validação são do agente principal.
