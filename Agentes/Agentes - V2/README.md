**Piloto com Microsoft SSO, persistência e Bedrock:** execute `npm run pilot` na pasta `app`. Inclui Início com chat, onboarding, capas e importação de planilhas. [Guia de configuração, testes e backup](docs/CLARA-PILOTO.md) · [Microsoft SSO](docs/CLARA-SSO-MICROSOFT.md).

# CLARA para rodar no seu computador

**Studio integrado:** o novo aplicativo está em `/`, com contratos, serviços e modo temporário sem configuração. Use `iniciar-studio.cmd` ou, em `app`, `npm run studio`. Para containers, use `docker compose up --build` quando o Docker Engine estiver disponível. Veja o [guia do Studio, Docker/Kubernetes e integrações pendentes](docs/CLARA-STUDIO.md).

A interface anterior continua disponível em `/classic`. As instruções abaixo descrevem seu iniciador e armazenamento locais anteriores; para avaliar o novo Studio em memória, siga o guia acima.

**Central de Leitura, Análise e Relatórios Assistidos.** Traga seus dados, faça uma pergunta, confira os números e salve seu dashboard. A interface tem visão geral, biblioteca de análises e assistente recolhível, adaptados para desktop e celular.

## Iniciar

1. Instale **Node.js 24 LTS** em https://nodejs.org. O npm já vem junto. Depois, abra novamente o terminal.
2. Extraia o ZIP inteiro. Não abra arquivos diretamente dentro do ZIP.
3. No Windows, abra **iniciar.cmd**. No macOS/Linux, abra um terminal nesta pasta e execute `sh iniciar.sh`.
4. Quando aparecer **Ready**, abra `http://localhost:3000` no navegador. Escolha **Entrar com conta local** → **Criar conta local** para um espaço próprio, ou **Explorar demonstração** para a conta compartilhada de exemplos.

Também funciona em todos os sistemas, no terminal desta pasta:

```sh
node iniciar.mjs
```

O iniciador prepara `app/.env.local`, instala as dependências com `npm ci` na primeira execução e inicia frontend e backend juntos. Mantenha o terminal aberto; **Ctrl+C** encerra o servidor. A primeira instalação precisa de internet. Não é necessário Docker, SAP, conta AWS ou configuração Microsoft para experimentar a demonstração. A instalação do Node não é feita automaticamente.

Nas próximas execuções, a instalação é reaproveitada. O cache do npm fica em `app/.local/npm-cache`, sem exigir alterações em pastas do sistema. Mudanças no lockfile, na versão do Node ou no sistema/arquitetura provocam uma nova instalação. Configurações existentes em `.env.local` são preservadas. Variáveis definidas no terminal têm prioridade sobre esse arquivo.

## Se a porta estiver ocupada

```sh
node iniciar.mjs --porta=3001
```

Nesse caso, abra `http://localhost:3001`. Não é preciso alterar arquivos. O servidor local escuta somente em `127.0.0.1`.

## Preparar ou executar em produção

```sh
node iniciar.mjs --preparar
node iniciar.mjs --producao
```

O primeiro comando somente instala/configura. O segundo compila e inicia a versão de produção. Sem opções, inicia o modo de desenvolvimento, que atualiza a tela quando o código é alterado.

## Arquivos e integrações

- `app/`: código completo do frontend/backend, lockfile e testes.
- `app/.env.example`: valores de demonstração, contas locais e exemplos de configuração MSAL/SAP/Bedrock. O iniciador usa esse arquivo para criar `.env.local` sem credenciais.
- `app/.data/prometeu.sqlite`: banco local criado no primeiro login. Seus arquivos e dashboards ficam nesta máquina. Nenhum dado ou sessão do ambiente na nuvem está incluído no ZIP.
- `specs/`: referências históricas; não representam funcionalidades integralmente implementadas.

O chat continua em demonstração: a IA real fica para a próxima etapa. Importações, atualização e histórico de fontes, edição e versões de dashboards, fórmulas, vários indicadores, comparação de períodos, seleções e rascunhos na conta funcionam localmente. Equipes compartilham dados com permissões e auditoria. Relatório executivo e apresentação são HTML conferível; o navegador permite imprimir/salvar PDF. O conector SAP somente leitura precisa do serviço autorizado da empresa. Configuração em [app/README.md](app/README.md).

Para preservar seus dados, mantenha a pasta `app/.data`. Use o comando de backup consistente e a restauração para pasta nova de [app/OPERACOES.md](app/OPERACOES.md), que também documenta monitoramento, permissões e SAP. O pacote não traz `node_modules`, builds, bancos, sessões ou credenciais do ambiente de origem.

## Validação

Em 11/10/2026, a evolução ampliou os fluxos diários com rascunhos na conta, histórico de fontes e dashboards, análises configuráveis, relatório executivo, equipes e operação local. TypeScript, build e 20 cenários distintos de navegador passaram, incluindo retomada em outro navegador, exportação e revogação de acesso. A suíte de lógica/API cobre também arquivos de 20 mil registros, conflitos, backup/restauração e conector SAP simulado. Contagens e limites estão em [app/VALIDACAO-CLARA.md](app/VALIDACAO-CLARA.md).

Em 10/10/2026, a interface CLARA foi verificada localmente no Windows: 32 testes de lógica/backend, typecheck, build e sete testes de navegador passaram. A revisão incluiu importação, pedido, esclarecimento, prévia, filtros, refinamento, salvamento, reabertura, exportação e comportamento do assistente. Capturas de 320 a 1920px não registraram overflow do documento nem erros de página. Veja [app/VALIDACAO-CLARA.md](app/VALIDACAO-CLARA.md). `VALIDACAO-LOCAL.md` preserva a validação histórica da distribuição em Linux; esta rodada não revalidou todos os atalhos do iniciador.

Para executar os testes de lógica/backend após a preparação:

```sh
cd app
npm test
```

No PowerShell, use `npm.cmd test` se `npm.ps1` estiver bloqueado. Os testes de navegador detectam Chrome/Edge instalados no Windows e usam cache dentro de `app/.local`; instruções em [app/README.md](app/README.md). Eles não são necessários para iniciar o aplicativo.

CLARA substitui a identidade visual anterior. Nomes técnicos como `prometeu.sqlite`, `prometeu-session`, `PROMETEU_DATA_DIR` e o identificador do health check permanecem por compatibilidade. A troca preserva dados, cálculos, APIs e integrações. Não houve publicação externa; autenticação Microsoft, SAP e Bedrock reais continuam dependentes de configuração e não foram testados nesta entrega.
