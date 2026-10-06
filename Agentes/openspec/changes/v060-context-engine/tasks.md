# Execução v0.6.0

- [x] Investigar o código atual, SDK instalado, limites de política e estado sujo do repo.
- [x] Primeiro: lixeira Descartar tudo ao lado de Preparar todas; preservar confirmação.
- [x] Primeiro: cartão compacto da cota real, barra, reset, Atualizar/Gerenciar e detalhes recolhidos.
- [x] Plano e spec com aceitação, segurança, fallback e limites de medição.
- [x] Índice RAM SQLite FTS5/BM25 incremental sob demanda, limites/exclusões e hashes dos resultados.
- [x] Tree-sitter TS/TSX/JS/C#/Rust, unidades e relações sintáticas candidatas, fallback lexical.
- [x] Pacotes de contexto com instruções/configurações candidatas, expansão e cobertura visível.
- [x] Seleção/snapshot do buffer confirmado, RAM apenas, com política fail-closed no envio.
- [x] Notas fixadas; envio somente quando alteradas e marcação apenas após envio bem-sucedido.
- [x] Diagnóstico sem inferência; distribuição de contexto e cache apenas quando informados.
- [x] Seletor real de ferramentas MCP e preservação ao pausar/retomar.
- [x] Checagem inicial de compatibilidade; retirar ferramentas Rust indisponíveis antes da inferência.
- [x] Regressões JS/Rust e benchmark offline sintético.
- [x] Integração real de sessão/diagnóstico sem prompt no CLI deste PC.
- [x] Build final, pacote portátil e conferência visual final (registrados em validation.md).

## Fora das garantias desta entrega

- A política do Copilot CLI 1.0.91 deste PC retorna indisponível. Busca manual local
  funciona; uso automático dos trechos Rust e snapshots não será liberado à força.
- Relações sintáticas não substituem LSP/compilador e não garantem localizar todas as
  dependências, overloads, injeção de dependência ou testes relevantes.
- Economia de créditos/tokens, qualidade da IA e CPU contra CLI/VS Code dependem de
  benchmark real comparável; não foram comprovadas pela fixture local.
- Não há nova chamada LLM para notas, ranking, formatação ou remoção de duplicatas.
  Compactação e desenvolvimento solicitados ao Copilot continuam sujeitos à cobrança.
