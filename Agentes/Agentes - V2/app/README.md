**Piloto com Microsoft SSO, persistência e Bedrock:** execute `npm run pilot` na pasta `app`. Inclui Início com chat, onboarding, capas e importação de planilhas. [Guia de configuração, testes e backup](../docs/CLARA-PILOTO.md) · [Microsoft SSO](../docs/CLARA-SSO-MICROSOFT.md).

# CLARA · Análise de negócios

**Atualização Studio:** `/` agora abre o Studio com a identidade SAP Analytics Cloud/Fiori aprovada, backend e contrato `/api/v1/studio/openapi`. Execute `npm run studio` para começar com dados em memória e nenhuma integração configurada. [Guia completo, containers e pendências](../docs/CLARA-STUDIO.md). A interface descrita abaixo permanece em `/classic`; o iniciador antigo e os dados SQLite anteriores foram preservados.

**Central de Leitura, Análise e Relatórios Assistidos.** Traga dados, descreva uma pergunta e confira o dashboard antes de salvar. Interface React/Next.js, backend Next, Tailwind, Radix Select, Lucide e Figtree. A identidade atual interpreta referências públicas do aplicativo BTG Pactual Investimentos; não utiliza pacote oficial do design system nem representa vínculo com o banco.

Navegação horizontal no desktop, análise em largura fluida e assistente recolhível à direita. Em telas menores, navegação e assistente usam modais. Recolher preserva texto, filtros, conversa e pedido em andamento.

## Rodar

Requer Node 24, npm e diretório gravável para SQLite. A forma mais simples, na raiz do projeto, é `node iniciar.mjs` (Windows: `iniciar.cmd`; macOS/Linux: `sh iniciar.sh`). O iniciador prepara `.env.local`, usa cache local e escuta em `127.0.0.1`.

Para executar manualmente, dentro de `app`:

```sh
npm ci --cache .local/npm-cache --no-audit --no-fund
npm test
npm run typecheck
npm run build
npm start
```

No PowerShell, use `npm.cmd` caso a política local bloqueie `npm.ps1`. Os scripts diretos `npm start` e `npm run dev` usam porta 3000 e escuta em `0.0.0.0`; `dev` atualiza a tela ao editar o código. `/api/health` responde `{"status":"ok","app":"prometeu"}`. Localhost só existe nesta máquina; não é um link remoto.

## Testes de navegador no Windows

O servidor precisa estar em execução. Para uma base demonstrativa isolada, abra um PowerShell em `app`:

```powershell
$env:AUTH_MODE = 'demo'
$env:AI_PROVIDER = 'demo'
$env:PUBLIC_APP_URL = 'http://127.0.0.1:3100'
$env:PROMETEU_DATA_DIR = Join-Path (Get-Location) '.local/clara-review-data'
node ../iniciar.mjs --porta=3100
```

Em outro PowerShell, também em `app`:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3100'
npm.cmd run test:e2e
```

O script chama `node tests/run-e2e.mjs` e usa `.local/playwright-cache`, evitando o cache de transformação na pasta pessoal. A configuração detecta Chrome/Edge instalados no Windows ou `/usr/bin/chromium` no Linux. Para outro executável, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Sem executável detectado, o Playwright precisa de seu próprio Chromium instalado. Os testes criam dados: mantenha a base de revisão separada da base de uso.

## O que funciona

- Continuidade: “Retomar análise” recupera texto, conversa e plano completo da conta no espaço selecionado, inclusive em outro navegador. Salvamento automático e “Salvar rascunho agora” usam revisões para evitar sobrescrever outra aba. A sessão da aba conserva ajustes durante falhas de conexão. Sair da conta limpa a cópia local depois de salvar; o rascunho da conta permanece. Conversas continuam expirando em 30 minutos: recuperar explicitamente cria outra conversa após conferir a fonte e seu plano; fonte alterada preserva a pergunta e exige nova análise.
- Conferência: resumo da operação antes de importar, tabelas de valores por gráfico mesmo com detalhes ocultos, anos explícitos em recortes multianuais e restauração do recorte salvo junto aos filtros.
- Recuperação: falhas de envio e salvamento têm ações próprias; quando a fonte ou dashboard já foram salvos, “Atualizar tela” repete somente a atualização.
- Fontes: qualidade dos registros, cobertura de datas, exemplos de valores ausentes, substituição conferida do arquivo, histórico e restauração. Colunas reordenadas mantêm suas chaves; alterações incompatíveis são recusadas antes de gravar. Dashboards indicam quando usam uma nova revisão da fonte.
- Dashboards: edição de título e plano, duplicação, histórico e restauração de versões. Alterações conflitantes são recusadas; consulta temporária continua separada de uma edição salva.
- Análises: vários indicadores, fórmulas aritméticas por registro sem executar código, comparação entre períodos e seleção de vários valores por campo. Valores ausentes ou divisões por zero são identificados e excluídos do cálculo; médias usam os registros considerados. “O que mudou” explica ajustes; exceções de orçamento abrem seu recorte, mesmo quando o total está abaixo do orçamento.
- Reuniões: prévia conferível de relatório executivo ou apresentação HTML, download do conteúdo revisado e impressão/PDF pelo navegador. CSV com fonte, revisão, filtros, critérios e cálculos. Apresentações são HTML; não há exportador PPTX.
- Contas locais com senha e espaços pessoais separados. Espaços de equipe têm papéis Leitor, Editor e Administrador, convites por código de uso único, revogação e auditoria. Compartilhamento acontece dentro do espaço; não há links públicos anônimos. Backups/restauração por comando, readiness e métricas administrativas: [OPERACOES.md](OPERACOES.md).

- SAP em demonstração: financeiro, vendas, compras e estoque; as fontes não se duplicam ao selecionar a mesma área.
- Importação de CSV (UTF-8, com ou sem BOM, ou Windows-1252), XLSX (uma aba) e JSON (lista de objetos), até 8 MB, 20 mil registros e 50 colunas. Cabeçalhos únicos. Datas ISO ou DD/MM/AAAA; números simples e decimais brasileiros; identificadores com zero à esquerda preservados. Células de texto acima de mil caracteres são recusadas. Somente os primeiros cinco registros aparecem na conferência, mas todas as linhas são importadas.
- Conferência do nome da fonte, indicador, agrupamento, data, unidade, operação (soma/média/contagem), orçamento opcional e critério de inclusão. O critério oferece campos de texto com até 200 valores distintos. Nenhuma regra contábil é inferida para arquivos.
- Chat com sugestões contextuais, proposta validada, pergunta de esclarecimento, refinamento, cancelamento, restauração de conversa por URL e prévia antes do salvamento. Conversa privada expira após 30 minutos sem novo pedido, limite de dez pedidos por conversa e vinte pedidos por minuto por pessoa.
- Dashboards genéricos por campos e indicadores: comparação, evolução temporal quando houver datas e tabela de detalhes. Datas diárias são agrupadas por mês nos gráficos temporais. O filtro permite mês inteiro ou ano inteiro; pedidos como “setembro de 2026”, “09/2026” e “2026-09” consideram todas as datas do mês. Se o mês existir em mais de um ano, o chat pergunta qual ano usar.
- Critérios e caminho do número (fonte → critérios/filtros → indicador), contagens de registros, cálculo detalhado por indicador, filtros, ordenação e detalhe por grupo. Soma/média usam os valores preenchidos; vazio não vira zero. Centavos preservados na apresentação.
- Persistência de fontes, conversas, relatórios e sessões em `.data/prometeu.sqlite`. Salvamento transacional e idempotente: a mesma conversa não cria vários relatórios. Filtros ajustados antes de pedir um refinamento são enviados ao servidor. Filtros de consulta em um dashboard salvo não sobrescrevem seu plano; exportar usa o recorte atual, e pedir outra análise preserva o original.
- Exportação CSV dos grupos da consulta e exclusão de dashboards com confirmação no próprio contexto. Não há alteração de dados ou escrita no SAP.

## Integrações reais

### TypeSafe / Jev

O SDK oficial `@typesafe-ai/sdk` está instalado. Preencha apenas a chave em `app/.env.local`:

```dotenv
TYPESAFE_API_KEY=sua_chave
TYPESAFE_DEFAULT_MODEL=jev-latest
```

Dentro de `app`, execute `npm.cmd run jev:check` (Windows) ou `npm run jev:check` (macOS/Linux). O comando lê `.env.local`, faz uma chamada real com um exemplo fixo de urgência e mostra modelo, probabilidade e uso de tokens. A chamada usa a cota da sua conta. Sem chave, termina com uma instrução de configuração e não faz chamada. Uma chave definida no terminal tem prioridade sobre o arquivo.

A chave fica no servidor; `.env.local` é ignorado pelo Git. Reinicie o servidor depois de alterar o arquivo. `src/server/jev.ts` expõe `createJevClient()` para chamadas tipadas e `checkJevConnection()` para verificar a integração. O cliente tem timeout de 10 segundos por tentativa e uma repetição; o teste tem limite total de 25 segundos e não mostra credenciais nem corpos de erro do provedor.

Esta configuração prepara o acesso ao Jev. O chat de dashboards continua usando `AI_PROVIDER` (`demo` ou `bedrock`); Jev retorna decisões estruturadas e sua aplicação no planejamento precisa de um fluxo próprio. Não use `AI_PROVIDER=jev`. Referência: [SDK oficial](https://docs.typesafe.ai/sdk/javascript).

O modo padrão tem conta compartilhada de demonstração e respostas previsíveis para os pedidos sugeridos. É para demonstrar o fluxo, não para avaliar qualidade de um modelo real. Arquivos importados são processados e persistidos de verdade dentro dessa conta de demonstração.

Microsoft MSAL: registre a SPA e a API no tenant, exponha o escopo de acesso, configure o redirect URI, preencha as variáveis de `.env.example` e use `AUTH_MODE=msal`. O servidor valida assinatura, emissor, audience, tenant e escopo do access token antes de emitir uma sessão HttpOnly. Contas Microsoft têm espaço pessoal isolado e podem participar dos espaços de equipe. Login real ainda depende da configuração e não foi testado com um tenant. Para uso local sem Microsoft, escolha “Entrar com conta local” e “Criar conta local”; senhas são armazenadas com scrypt e salt individual. `LOCAL_AUTH_ENABLED=false` desabilita essas contas; `AUTH_MODE=msal` também.

AWS Bedrock: preencha região e model/inference profile, disponibilize credenciais pela cadeia padrão do SDK e use `AI_PROVIDER=bedrock`. O adaptador usa Converse, leva nomes de campos, valores de dimensões e agregados, não leva linhas brutas nem oferece ferramentas para escrever. A saída JSON é validada contra campos e filtros existentes. Timeout de 25 segundos; erro do provedor não cai silenciosamente em demonstração. O adaptador é testado com respostas simuladas; nenhuma chamada real foi feita neste ambiente.

SAP: os quatro assuntos demonstrativos continuam disponíveis. O conector opcional usa `SAP_READ_URL` e `SAP_READ_TOKEN` no servidor para consultar uma coleção JSON/OData somente por GET, com limites de volume, tempo e paginação. Antes de importar ou atualizar, a pessoa confere os mesmos campos e critérios dos arquivos. Serviços com outros formatos/autenticações precisam de gateway compatível. O conector passou por testes simulados; o SAP da empresa ainda depende de endereço, autorização e mapeamento reais. GitHub Copilot não está conectado. A IA real foi adiada por decisão do usuário; mantenha `AI_PROVIDER=demo` nesta entrega.

Em um proxy/host público, configure `PUBLIC_APP_URL` com a origem HTTPS exata. Isso governa a proteção contra pedidos de outra origem e o cookie Secure. Não habilite a conta demo compartilhada com dados confidenciais. As configurações técnicas ficam na documentação e em Integrações, fora da jornada de negócio.

## Contexto e validação

A evolução de 11/10/2026 ampliou a suíte e validou 20 cenários distintos de navegador: 19 na execução completa final e retomada entre navegadores reexecutada após abrir o assistente preservado recolhido. TypeScript e build de produção passaram. Para executar com servidor e dados demonstrativos isolados automaticamente, após `npm run build`, use `node tests/verify-local.mjs` dentro de `app`. O runner usa a porta local 3112, encerra seu servidor ao terminar e mantém os dados de teste em `.local/daily-e2e-*`. Se a porta estiver ocupada, falha sem usar o servidor existente. Capturas atuais ficam em `.local/evolution-review`; as da primeira entrega, em `.local/daily-review`. Resultados e contagem final dos testes de lógica/API estão em [VALIDACAO-CLARA.md](VALIDACAO-CLARA.md).

[PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), [.impeccable/design.json](.impeccable/design.json) e [brief da superfície](.impeccable/surfaces/business-dashboard.md) registram o produto e a identidade CLARA. [VALIDACAO-CLARA.md](VALIDACAO-CLARA.md) registra as verificações de 10 e 11/10/2026; [VALIDACAO.md](VALIDACAO.md) e `../specs` preservam o histórico, sem promessa de implementação integral.

A troca de identidade preserva APIs, cálculos, dados e integrações. `prometeu.sqlite`, `prometeu-session`, `PROMETEU_DATA_DIR`, nome do pacote e identificador do health check continuam técnicos e compatíveis. Não houve publicação externa nem validação real de Microsoft, SAP ou Bedrock nesta entrega.
