# Tarefas incrementais propostas

Status de todas as tarefas: PLANEJADA. Estimativas são relativas (P=pequena, M=média, G=grande) e não são prazo. Implementação começa somente após aprovação da proposta e dos gates aplicáveis.

## Fase 0 — descoberta, segurança e viabilidade

| ID | Tarefa | Dep. | Tam. | Requisitos/testes | Conclusão |
|---|---|---:|---:|---|---|
| T-001 | Reconciliar esta change com OpenSpec aprovado e rodar validação oficial | B-01 | P | todos | estrutura aceita pela ferramenta ou divergências aprovadas |
| T-002 | Registrar ficha do Dell alvo, TI e baseline A/C | aprovação ambiente | M | PF-01..05; TP-PF-01 | cinco amostras reproduzíveis por cenário |
| T-003 | Levantar documentação, licenças, CVEs e versões aprovadas | rede/TI | M | SC-06; TP-SC-05 | fontes datadas e decisão de dependências |
| T-004 | Executar G-EDITOR em projeto isolado | T-003 | G | ED-01..09; DF-05; TP-ED-04 | relatório contra critério G-EDITOR |
| T-005 | Executar G-TERMINAL com fake process no Windows alvo | T-003 | G | TM-01..06; TP-TM-01..03 | relatório de I/O, resize, UTF-8 e handles |
| T-006 | Executar G-GIT em fixtures temporárias e bare local | T-002 | M | GT-01..08; TP-GT-01..04 | parsing/protocolos e operações corretos |
| T-007 | Modelar ameaça, política de binário/links/logs e revisão TI | T-003 | M | SC-01..07; TP-SC-01..06 | riscos residuais aceitos ou bloqueios |
| T-008 | Decidir stack/UI, renderer e formato settings via ADR | T-004,T-005,T-007 | M | ADR-001..004 | ADRs aprovados; sem hipótese pendente crítica |

Saída: G-EDITOR, G-TERMINAL, G-GIT, G-REPOS, G-RESOURCES e G-DISTRIB aprovados ou escopo revisado. Rollback: manter somente especificação; não há produto para desfazer.

## Fase 1 — shell, catálogo e editor

| ID | Tarefa | Dep. | Tam. | Requisitos/testes | Conclusão |
|---|---|---:|---:|---|---|
| T-101 | Criar shell Rust/UI, Command/UiUpdate e worker model | T-008 | G | UI-01,UI-06,RS-02,03; TP-UI-01 | UI não bloqueia em fake I/O |
| T-102 | Implementar settings schema/migração/escrita segura | T-008 | M | ST-01..05; TP-ST-01,02 | recovery e validação testados |
| T-103 | Implementar RepositoryId, path policy e catálogo | T-101,T-102 | G | WS-01,02,04,06; TP-WS-01,03 | paths inseguros rejeitados |
| T-104 | Implementar explorer lazy e eventos coalescidos | T-103 | G | WS-03,05,07,RS-02; TP-WS-02,TP-RS-01 | 12 fixtures sem scan global |
| T-105 | Implementar DiskSnapshot, Buffer e classificação | T-101,T-103 | G | ED-01,02,04,05,08; TP-ED-01,03 | limites/encoding explícitos |
| T-106 | Implementar Save seguro e conflito externo | T-105 | G | ED-03,06,07; TP-ED-02,05 | nenhuma perda em testes |
| T-107 | Implementar layout, atalhos, foco, a11y e DPI | T-101,T-104,T-105 | G | UI-01..06; TP-UI-02,03 | cenários 100/150/200% aprovados |

Saída: AC-01, AC-02 e AC-03 demonstráveis em fixtures locais. Rollback: desabilitar feature flag de catálogo/editor que falhar sem apagar settings nem buffers.

## Fase 2 — Git e diffs

| ID | Tarefa | Dep. | Tam. | Requisitos/testes | Conclusão |
|---|---|---:|---:|---|---|
| T-201 | Implementar adaptador Git estruturado/status NUL | T-006,T-103 | G | GT-01..03; TP-GT-01 | todos os fixtures de path passam |
| T-202 | Implementar snapshots, cache e refresh correto | T-201,T-104 | M | GT-03,DF-06,RS-02; TP-DF-03 | estado obsoleto descartado |
| T-203 | Implementar fontes de diff e renderer virtualizado | T-004,T-202 | G | DF-01..06; TP-DF-01,02 | 10 MB/linhas longas têm limite explícito |
| T-204 | Implementar stage/unstage por arquivo | T-201,T-202 | M | GT-05,DF-07; TP-GT-02 | index/worktree correto |
| T-205 | Implementar commit e feedback de hook/assinatura | T-204 | M | GT-05,07; TP-GT-03 | hook falho não é ocultado |
| T-206 | Implementar push/pull confirmados e cancelamento seguro | T-205,T-007 | G | GT-06..08; TP-GT-04 | bare remoto local passa |
| T-207 | Integrar painel Git e avisos de buffer/agente | T-203,T-206 | M | UI-03,GT-07; TP-UI-02 | foco preservado e riscos visíveis |

Saída: AC-04 e AC-07 demonstráveis em fixture/bare remoto local. Rollback: desabilitar operações mutáveis, mantendo status/diff readonly.

## Fase 3 — terminal e sessões

| ID | Tarefa | Dep. | Tam. | Requisitos/testes | Conclusão |
|---|---|---:|---:|---|---|
| T-301 | Implementar ProcessManager e política de executável/cwd | T-005,T-007,T-103 | G | AG-01,04; SC-03; TP-AG-01,TP-SC-01 | spoofing bloqueado |
| T-302 | Implementar terminal aprovado, lifecycle e limites | T-005,T-301 | G | TM-02..06; TP-TM-01..03 | sem leak nos cenários suportados |
| T-303 | Implementar AgentSession/fila/notificação confiável | T-301,T-302 | M | AG-02,03,05,06; TP-AG-02 | estados e limites verificáveis |
| T-304 | Implementar fechamento seguro e recursos por processo | T-302,T-303 | M | AG-07,RS-01,04; TP-AG-03,TP-RS-03 | usuário decide e séries separadas |
| T-305 | Teste manual autorizado de CLIs reais | T-304, autorização CLI | M | AC-05; TP-AG-04 | resultado documentado sem segredos |

Saída: AC-05 e AC-06 demonstráveis com fake agents; CLIs reais somente se autorizadas. Rollback: terminal/session feature flag desabilitada, sem encerrar processos fora do fluxo suportado.

## Fase 4 — qualidade, desempenho e distribuição

| ID | Tarefa | Dep. | Tam. | Requisitos/testes | Conclusão |
|---|---|---:|---:|---|---|
| T-401 | Implementar ResourceSample, limites e dashboards locais | T-104,T-304 | M | RS-01..06; TP-RS-01..03 | dados por processo e alertas corretos |
| T-402 | Automatizar fixtures, testes Windows e regressões | T-101..T-401 | G | test-plan.md | suite classificada e estável |
| T-403 | Executar benchmark A/B/C no Dell alvo | T-002,T-401 | G | PF-01..05; TP-PF-01,02 | relatório completo, inclusive falhas |
| T-404 | Gerar SBOM, licença/CVE/hash e teste offline | T-003,T-402 | M | SC-06,07; TP-SC-05,06 | aprovação TI ou bloqueio registrado |
| T-405 | Preparar artefato release/assinatura autorizada | T-404, aprovação TI | M | G-DISTRIB; AC-09,10 | distribuição aprovada e verificável |

Saída: AC-08, AC-09 e AC-10 com evidências. Itens fora de escopo permanecem fora: plugins, LSP completo, debugger, IDE remota e agentes autônomos.
