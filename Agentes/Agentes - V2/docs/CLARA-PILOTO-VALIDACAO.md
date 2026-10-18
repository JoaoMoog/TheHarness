# Validação do piloto — 18/10/2026

## Atualização de experiência e SSO

Implementados: onboarding por usuário, entrada em Início, chat central com seleção de dashboard/fonte, dashboards recentes com capas, menu de perfil ancorado, login Microsoft de tenant único, remoção da navegação de modelos e tela Dados com importação CSV/XLSX e orientação para SAP. Contrato OpenAPI atualizado para 1.2.0.

| Verificação da atualização | Resultado |
|---|---|
| Lógica/API | 107 testes passaram |
| TypeScript e build final | Aprovados |
| Navegador determinístico | 11 cenários passaram em 20,8 s; nova captura móvel aguardando o menu fechar passou em execução adicional |
| Bedrock real, cinco intenções | Criação, empresa/período, gráfico, cenário e esclarecimento passaram |
| Navegador com Bedrock real, após reforço do prompt | Passou em 13,1 s: filtros, gráfico, cenário, CSV, planejamento e reabertura após reinício |
| Microsoft SSO real | Usuário confirmou entrada na CLARA após resolver a etapa MFA; inspeção da aba pelo agente foi negada pelo navegador |
| Configuração final servida | Health ok, demo=false, local=false, SSO configurado |
| Capas padrão e aplicação de imagem | Validadas no navegador; geração controlada e persistência da capa passaram |
| Geração de imagem AWS real | Uma chamada Stable Image Core funcionou; chamadas posteriores foram bloqueadas por INVALID_PAYMENT_INSTRUMENT no AWS Marketplace. Requer regularização de pagamento para uso contínuo |
| SAP real | Não configurado nem homologado |

O ensaio real de navegador inicialmente rejeitou uma proposta com centro inexistente, sem alterar o dashboard. As cinco intenções independentes passaram, e as instruções do modelo foram reforçadas para distinguir os catálogos de empresas e centros, preservar filtros omitidos e usar o valor literal `all`. O fluxo completo seguinte passou. A validação no servidor continua recusando propostas incompatíveis; uma execução bem-sucedida não garante toda formulação futura.

Logs do fluxo real atualizado: `app/.local/pilot-browser-bI0lmx/server.log`. Evidência da rejeição inicial: `app/.local/live-invalid-center-context.md` e `live-invalid-center-trace.zip`. Capturas desktop/móvel: `app/.local/inicio-validado.png` e `inicio-mobile-validado.png`. A chamada de imagem inicialmente aceita teve ID `6ab6e5ac-c7fb-44fa-8c70-0eb36cb75f0c`; a recusa de pagamento foi confirmada pela chamada `6ad964bd-8a84-413f-a7ae-c4475b4ecb40`. Nenhuma credencial foi incluída nos arquivos de diagnóstico.

Pendência externa desta atualização: ativação do modelo de imagens no AWS Marketplace mediante pagamento válido. A análise textual com Nova continua operacional. O piloto está disponível em http://127.0.0.1:3000 com Microsoft SSO e SQLite persistente. Veja [SSO](CLARA-SSO-MICROSOFT.md) e [guia operacional](CLARA-PILOTO.md).

## Histórico: validação do marco inicial

Piloto local validado com fonte financeira sintética por HTTP e AWS Bedrock real, usando o perfil `clara-piloto`, região `us-east-1` e modelo `us.amazon.nova-2-lite-v1:0`.

| Verificação | Resultado observado |
|---|---|
| `npm test` | 103 testes aprovados, zero falhas |
| `npm run typecheck` | Aprovado |
| `npm run build` | Build de produção aprovado |
| `npm run test:pilot:e2e` | 1 cenário completo aprovado (17,5 segundos) |
| Playwright `studio.spec.ts` | 9 cenários de regressão aprovados |
| `npm run contracts:studio` | Contrato OpenAPI regenerado |
| `npm run bedrock:check` | Resposta estruturada e filtro Tecnologia válidos; chamada real em 1,275 s |
| `npm run test:bedrock:live` | 5 intenções aprovadas com AWS real: criação, empresa/período, gráfico, cenário e esclarecimento |
| `CLARA_LIVE_BEDROCK=1` + `npm run test:pilot:e2e` | Fluxo completo aprovado com build final; 18,3 s de teste, 19,0 s de execução |
| AWS STS com `clara-piloto` | Autenticação confirmada pela CLI 2.38.1 |
| SAP real | Não configurado nem homologado |

O cenário completo usa três processos: aplicação de produção standalone, fonte financeira HTTP e servidor Bedrock HTTP/2 controlado. As credenciais desse teste são fictícias e o endpoint não é AWS. O SDK, o servidor da aplicação e o navegador exercitam serialização, validação, propostas, aplicação explícita e persistência reais.

Na execução real, o servidor Bedrock controlado foi removido e o SDK utilizou o perfil AWS local. As três chamadas do navegador levaram 1,562 s, 1,268 s e 1,344 s. O fluxo salvou e recuperou dashboard, planejamento e cenário após reiniciar aplicação e fonte. A captura final foi inspecionada, sem erros de página e sem transbordamento horizontal na largura móvel testada.

Os ensaios iniciais encontraram duas respostas inadequadas do modelo: escolha de ano para um pedido ambíguo e datas sem dia. A segunda foi recusada pelo schema, sem aplicar mudanças. O contexto passou a destacar os anos de cobertura e as instruções passaram a explicitar esclarecimento e datas completas YYYY-MM-DD. Após a correção, as cinco intenções e o fluxo real de navegador passaram. Isso comprova os casos executados, sem garantir todas as formulações possíveis em linguagem natural.

Cobertura: cadastro/login local sem sessão demo; consulta autenticada paginada; totais independentes; seis centros e dois anos; filtros por empresa e datas; planejamento por centro; rascunhos separados por período; cenário de Pesquisa no recorte; CSV com origem e datas; reinício dos processos; recuperação da sessão, dashboard, conversa, planejamento e cenário; diagnóstico persistido. A captura visual foi inspecionada, e o navegador não reportou erros de página. Verificação móvel de largura e regressão de foco/navegação também passaram.

Testes de lógica incluem falhas HTTP, timeout, moeda incompatível, respostas Bedrock inválidas, histórico limitado, restauração de versões legadas, conflito de revisão da fonte, idempotência, permissões e backup/restauração com revogação de sessões.

Logs: `app/.local/pilot-test.log`, `pilot-build.log`, `pilot-browser.log` e `pilot-studio-regression.log`. Bases isoladas dos ensaios ficam em `app/.local`. Os artefatos Playwright em `app/test-results` são substituídos por execuções seguintes.

Log do navegador com AWS real: `app/.local/pilot-browser-zc0joB/server.log`. Identificador da chamada mínima: `2387bb21-cde8-4632-9a38-5f6a4fda8525`; esclarecimento aprovado: `d41e4bcc-65d2-4ab7-b2bc-54c1445a9d6f`. Os logs operacionais registram somente metadados de invocação. O sandbox inicialmente não conseguia ler o perfil local; executar os testes autorizados fora dessa restrição resolveu o acesso, sem copiar credenciais para o projeto.

Revisão independente apontou quatro problemas de contexto, legado, rascunhos e revisão da fonte; foram corrigidos e cobertos por regressão. Não há pendência de implementação desses achados. Uso distribuído, autorização SAP por usuário, moedas além de BRL e cargas extremas além da precisão inteira segura de JavaScript não foram homologados neste piloto local.

Os critérios de conclusão deste marco local foram atendidos. SAP real permanece fora deste marco e não foi homologado. O guia de preparação, execução, diagnóstico, testes e backup está em `CLARA-PILOTO.md`.
