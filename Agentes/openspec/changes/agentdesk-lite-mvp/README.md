# AgentDesk Lite MVP — change proposta

Status: RASCUNHO PARA REVISÃO. Criada em 2026-09-22; não foi validada nem aplicada pelo OpenSpec.

Esta árvore segue a convenção proposta de OpenSpec:

    openspec/
      changes/
        agentdesk-lite-mvp/
          proposal.md
          design.md
          tasks.md
          specs/<capacidade>/spec.md

O executável openspec não estava disponível no PATH quando esta change foi criada. Por isso, esta estrutura não foi inicializada, validada ou aplicada por OpenSpec e deve ser reconciliada com a versão aprovada da ferramenta antes de ser aceita como fonte oficial.

Estado atual da implementação (2026-09-23):

- existe um spike visual executável em `src/main.rs`, compilado e aberto no Windows;
- catálogo, arquivos, Git/diff, terminal, métricas e estado de agentes são dados simulados;
- o editor altera somente o buffer em memória; o botão Salvar apenas muda o status e não grava arquivo;
- não há integração com Copilot/Kiro, Git, sistema de arquivos, settings ou serviços;
- as tarefas do MVP em `tasks.md` continuam planejadas e os gates de viabilidade não foram concluídos;
- evidências ausentes estão marcadas como PENDENTE, e hipóteses como HIPÓTESE;
- os requisitos normativos estão em specs. Design, pesquisa e planos explicam o porquê e como verificar.

Ordem de leitura recomendada:

1. proposal.md e risk-register.md para escopo e gates;
2. research.md e ADRs para evidências e decisões provisórias;
3. design.md e specs/ para o contrato do MVP;
4. test-plan.md, benchmark-plan.md e traceability.md para comprovação;
5. tasks.md para a execução após aprovação.

Esta build visual foi criada após solicitação explícita para testar a interface; ela não significa aprovação da proposta nem conclusão do MVP.
