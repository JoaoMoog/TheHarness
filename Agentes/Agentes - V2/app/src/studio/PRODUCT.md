# CLARA Studio

Central de Leitura, Análise e Relatórios Assistidos, para gestores, controllers e analistas. Esta é a aplicação integrada servida em `/`, com interface de referência SAP Analytics Cloud/Fiori. A identidade aprovada é preservada do protótipo em `design/clara-sap-studio`; a superfície anterior está em `/classic`.

O usuário pediu todos os fluxos possíveis sem configuração, deixando SAP, SSO e persistência definitiva para depois, com Docker e Kubernetes preparados. O Studio usa serviços no servidor para dashboards, filtros, versões, comentários, planejamento, cenários, medidas e autorização por espaço. Propostas do assistente são conferidas e aplicadas explicitamente. Dados demonstrativos são sintéticos; o assistente sem configuração é determinístico, com limites identificados.

Contas e dados ficam em memória no iniciador Studio, Compose e Kubernetes base. Reiniciar perde os dados; essa limitação aparece no acesso e no aplicativo. Uma réplica até implementar persistência compartilhada e sessões distribuídas. Integrações selecionadas com falha não voltam silenciosamente à demonstração.

Fluxo: entrar → explorar → perguntar → conferir critérios → aplicar → salvar → compartilhar com membros autorizados. Rascunhos de planejamento, cenário e medida são preservados em memória da página durante recuperação de conflito ou sessão, separados por identidade/espaço. Logout explícito ou recarga da página descarta esses rascunhos não salvos.

Autoridade visual: BRIEF.md local e `design/clara-sap-studio/DESIGN.md`. Modo Operate, code-led já escolhido pelo usuário, sem novo mundo visual nesta extensão. Comportamento e limitações vigentes estão em `docs/CLARA-STUDIO.md`; o PRODUCT do protótipo documenta apenas seu estado independente anterior.
