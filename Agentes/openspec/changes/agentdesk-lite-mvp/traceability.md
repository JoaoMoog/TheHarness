# Matriz de rastreabilidade

AC significa critério de aceite da proposta. As faixas listadas incluem cada requisito identificado; testes são complementares aos cenários Given/When/Then no spec correspondente.

| Requisitos | Implementação planejada | Testes principais | Aceite |
|---|---|---|---|
| WS-01, WS-02 | T-102, T-103 | TP-WS-01, TP-WS-03 | AC-02 |
| WS-03, WS-05 | T-104 | TP-WS-02, TP-RS-01 | AC-02, AC-06 |
| WS-04, WS-06, WS-07 | T-103, T-104 | TP-WS-01, TP-WS-03, TP-SC-01 | AC-02, AC-09 |
| ED-01, ED-02, ED-08 | T-105, T-107 | TP-ED-01, TP-UI-01 | AC-03 |
| ED-03, ED-04, ED-05 | T-105, T-106 | TP-ED-01, TP-ED-03 | AC-03 |
| ED-06, ED-07 | T-106 | TP-ED-02, TP-ED-05 | AC-03, AC-09 |
| ED-09 | T-003, T-004, T-105 | TP-ED-04, TP-PF-02 | AC-03, AC-10 |
| DF-01, DF-02, DF-03, DF-04 | T-202, T-203 | TP-DF-01 | AC-04 |
| DF-05, DF-06, DF-07 | T-203, T-204 | TP-DF-02, TP-DF-03, TP-GT-02 | AC-04, AC-06 |
| GT-01, GT-02, GT-03 | T-201 | TP-GT-01, TP-SC-02 | AC-04, AC-07 |
| GT-04, GT-05 | T-202, T-204, T-205 | TP-GT-02, TP-GT-03 | AC-04, AC-07 |
| GT-06, GT-07, GT-08 | T-206, T-207 | TP-GT-03, TP-GT-04, TP-UI-02 | AC-07, AC-09 |
| TM-01 | T-005 | TP-TM-01 | AC-05 |
| TM-02, TM-03, TM-04 | T-302 | TP-TM-01, TP-TM-02 | AC-05, AC-06, AC-09 |
| TM-05, TM-06 | T-302, T-304 | TP-TM-03, TP-AG-03 | AC-05, AC-09 |
| AG-01, AG-04 | T-301, T-305 | TP-AG-01, TP-AG-04 | AC-05, AC-08 |
| AG-02, AG-03, AG-05, AG-06 | T-303 | TP-AG-02, TP-RS-02 | AC-05, AC-06 |
| AG-07 | T-304 | TP-AG-03, TP-TM-03 | AC-09 |
| RS-01, RS-04 | T-304, T-401 | TP-RS-02, TP-RS-03 | AC-06, AC-10 |
| RS-02, RS-03, RS-05 | T-101, T-104, T-401 | TP-RS-01, TP-UI-01, TP-DF-02 | AC-06 |
| RS-06 | T-002, T-401, T-403 | TP-PF-01, TP-PF-02 | AC-10 |
| SC-01, SC-07 | T-007, T-404 | TP-SC-06 | AC-01, AC-08 |
| SC-02, SC-03, SC-04 | T-103, T-301 | TP-SC-01, TP-SC-02, TP-WS-01 | AC-08, AC-09 |
| SC-05 | T-007, T-102 | TP-SC-03 | AC-08 |
| SC-06 | T-003, T-404, T-405 | TP-SC-05 | AC-08, AC-09 |
| ST-01, ST-02, ST-03 | T-102 | TP-ST-01, TP-ST-02 | AC-01, AC-09 |
| ST-04, ST-05 | T-102, T-401 | TP-ST-01, TP-SC-03 | AC-08 |
| PF-01, PF-02 | T-002, T-403 | TP-PF-01 | AC-10 |
| PF-03, PF-04, PF-05 | T-401, T-403 | TP-PF-01, TP-PF-02 | AC-06, AC-10 |
| UI-01, UI-02 | T-101, T-107 | TP-UI-01, TP-UI-03 | AC-01, AC-02 |
| UI-03, UI-04, UI-05, UI-06 | T-107, T-207, T-303 | TP-UI-01, TP-UI-02, TP-UI-03 | AC-03, AC-04, AC-06 |

## Critérios de aceite

| ID | Demonstração exigida |
|---|---|
| AC-01 | inicia localmente em Windows alvo sem VS Code, admin ou rede do processo IDE |
| AC-02 | cadastra 12+ repos, navega/abre sem indexação total |
| AC-03 | salva preservando encoding/EOL e resolve conflito externo explicitamente |
| AC-04 | apresenta diff correto, colorido/acessível e fontes Git distintas |
| AC-05 | terminal/CLI autorizada funciona e falha não derruba a IDE |
| AC-06 | sessões/concorrência são controladas, UI responsiva e métricas separadas |
| AC-07 | fixture local completa stage/unstage/commit/push/pull confirmado |
| AC-08 | não há telemetria/rede própria detectada e credencial não é persistida |
| AC-09 | testes críticos passam sem perda de dados ou órfãos nos cenários suportados |
| AC-10 | benchmarks no Dell alvo documentam metas e resultados negativos |
