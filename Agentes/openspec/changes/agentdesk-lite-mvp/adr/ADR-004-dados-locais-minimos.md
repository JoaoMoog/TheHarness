# ADR-004: Persistência mínima e logs opt-in

Status: PROPOSTO.

Contexto: o produto processará paths, alterações e terminais em ambiente corporativo. Telemetria, cópia integral de código, segredos e output permanente ampliam risco sem atender ao MVP.

Decisão: persistir apenas configuração local validada, catálogo, preferências e metadados indispensáveis. Logs são desligados por padrão, locais, limitados e opt-in. Não persistir tokens, prompts, código integral ou output completo.

Consequências: diagnósticos dependem de ação explícita do usuário e redaction é melhor esforço, não garantia. Arquivo de settings terá schema, migração, escrita segura e recuperação de corrupção.

Alternativas: telemetria, serviço cloud, banco de código e histórico completo de terminal são fora de escopo.
