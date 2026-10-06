# Registro de riscos

| ID | Risco | Prob. | Impacto | Sinal/gate | Mitigação e fallback | Dono/estado |
|---|---|---:|---:|---|---|---|
| R-01 | Slint não atende editor/diff | média | alto | G-EDITOR | interromper; ADR com componente alternativo ou escopo menor | arquitetura / aberto |
| R-02 | terminal exige emulador caro | alta | alto | G-TERMINAL | usar renderer aprovado ou limitar escopo; não criar do zero | arquitetura / aberto |
| R-03 | CLI não suporta automação | alta | médio | documentação/teste manual | terminal interativo sem orquestração | produto / aberto |
| R-04 | status Git incorreto em paths especiais | média | alto | G-GIT, TP-GT-01 | protocolo NUL, fixtures amplas; bloquear mutações até passar | Git / aberto |
| R-05 | perda de dados por race/Save | baixa | crítico | TP-ED-02,05 | snapshots, conflito, write seguro e recovery | editor / aberto |
| R-06 | watchers causam CPU/I/O | média | alto | G-REPOS, TP-RS-01 | lazy scope, coalescing, refresh manual | workspace / aberto |
| R-07 | meta 150 MB conflita com editor/terminal | alta | alto | G-RESOURCES, TP-PF | medir no Dell; reduzir cache/escopo com aprovação | performance / aberto |
| R-08 | host observado não é Dell alvo | alta | alto | T-002 | não usar números atuais; ficha do Dell e cinco repetições | produto / bloqueado |
| R-09 | OpenSpec ausente/versão incompatível | alta | médio | T-001 | reconciliar ou aprovar Markdown compatível | processo / bloqueado |
| R-10 | licença/CVE/dependência não aprovada | média | alto | T-003,TP-SC-05 | pin, SBOM e aprovação TI; não distribuir | segurança / bloqueado |
| R-11 | processo filho escapa/permanece | média | alto | TP-TM-03,TP-AG-03 | lifecycle e limite de promessa; documentar residual | processos / aberto |
| R-12 | rede indevida ou telemetria | baixa | crítico | TP-SC-06 | sem client/serviço próprio e inspeção de PID | segurança / aberto |
| R-13 | UI bloqueia sob Git/output | média | alto | TP-UI-01,TP-RS | workers, fila limitada, profiling | UI / aberto |
| R-14 | configuração/log vaza segredo | média | crítico | TP-SC-03,TP-ST | dados mínimos, opt-in, redaction best effort | segurança / aberto |
| R-15 | políticas corporativas impedem binário/TTY | média | alto | T-002,T-007 | validação TI e execução manual autorizada | TI / bloqueado |

Escala: baixa/média/alta é qualitativa, a ser recalibrada com evidência. Riscos bloqueados exigem decisão externa; riscos abertos exigem teste/ADR antes da fase dependente.
