# Settings — requisitos normativos

## Requisitos

- ST-01 MUST escolher e documentar um único formato local de settings antes da implementação, com schemaVersion.
- ST-02 MUST validar schema, aplicar migração compatível e rejeitar/isolar dados inválidos sem executar conteúdo.
- ST-03 MUST fazer escrita segura, recuperação de corrupção e preservação do último arquivo íntegro quando possível.
- ST-04 MUST persistir somente catálogo, preferências e metadados mínimos; tokens, prompts, código integral e output integral são proibidos.
- ST-05 MUST expor limites de sessões, buffers, cache, logs e política de links como preferências validadas.

## Cenários

### ST-S01 — migração

Given settings em schemaVersion anterior suportada
When a aplicação abre
Then ela migra para a versão atual de modo explícito
And mantém backup/recovery se a escrita falhar.

### ST-S02 — corrupção

Given settings truncados após falha
When SettingsService carrega
Then o catálogo íntegro mais recente é preservado quando disponível
And a UI mostra uma recuperação acionável.
