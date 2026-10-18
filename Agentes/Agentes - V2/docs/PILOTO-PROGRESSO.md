# Piloto CLARA — registro de implementação

Plano: aprovado na conversa em 18/10/2026.

Atualização posterior de UX/SSO: Início simplificado, onboarding, perfil, capas e importação implementados; navegação de modelos removida. Login Microsoft em tenant único configurado e confirmado pelo usuário. Regressão atual: 107 testes, TypeScript/build, 11 cenários determinísticos e fluxo de navegador com AWS real aprovados. Geração de capas pelo modelo Stable Image Core depende de pagamento válido no AWS Marketplace; a AWS retornou `INVALID_PAYMENT_INSTRUMENT`. Detalhes e evidências atuais em `CLARA-PILOTO-VALIDACAO.md`; histórico abaixo refere-se ao marco inicial.

1. Execução e SQLite persistente — implementado; reinício e backup/restauração testados.
2. Serviço HTTP financeiro reproduzível — implementado; autenticação, paginação, totais e falhas testados.
3. Contratos e interface financeira flexível — implementados; datas, centros, planejamento, cenários e legado testados.
4. Bedrock e diagnóstico — implementados e validados com AWS real: chamada mínima, cinco intenções e três pedidos no navegador, perfil clara-piloto.
5. Testes, navegador, reinício e documentação — concluídos: 103 testes, typecheck, build, fluxo completo controlado e com AWS real, além de 9 regressões de navegador aprovados. Evidências em CLARA-PILOTO-VALIDACAO.md.

Decisões: esta distribuição não contém .git; implementar no workspace existente, sem inventar histórico ou commits. O serviço financeiro é um simulador do contrato JSON usado pelo conector, não um servidor SAP/OData completo. Nenhuma homologação SAP será alegada. Credenciais AWS devem vir da cadeia padrão da CLI/SDK.

Interfaces compartilhadas: provider financial-test usa o mesmo mapeamento do SAP; filtros e propostas precisam evoluir junto com consultas e UI; persistência deve preservar documentos v1 e históricos; testes ao vivo são separados da regressão sem AWS.

Revisão independente realizada por agente somente leitura. Correções: contexto/histórico do serviço ao Bedrock; limpeza de datas na restauração de versões v1; preservação do rascunho do recorte anterior; conflito quando revisão da fonte difere da prévia. Testes de serviço reproduziram contexto, legado e revisão (vermelho → verde). Navegador cobre rascunhos entre períodos. Inspeção visual adicional corrigiu origem e recorte da proposta de cenário (teste de renderização vermelho → verde).

Decisão de compatibilidade: comandos financeiros antigos sem baseRevision permanecem aceitos apenas no modo demo. Fontes HTTP exigem revisão explícita. A API continua /api/v1/studio, com contrato 1.1.0 e documentos novos schemaVersion 2.

O SDK instalado usa HTTP/2 para Converse. O servidor controlado do teste de navegador usa HTTP/2; o primeiro ensaio HTTP/1 foi rejeitado por erro de protocolo e não foi contado como validação de Bedrock.

AWS: após o usuário autenticar, STS e Bedrock passaram fora do sandbox que bloqueava o acesso à configuração local. Ensaios reais identificaram escolha indevida de ano e data sem dia; contexto de cobertura e instruções de datas foram corrigidos. Suíte real final: cinco intenções aprovadas. Navegador final com AWS real: aprovado em 18,3 s, incluindo reinício. SAP real não foi homologado.
