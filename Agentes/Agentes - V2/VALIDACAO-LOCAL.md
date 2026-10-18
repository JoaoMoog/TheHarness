# Validação da distribuição local

Executada em 10/10/2026, Linux, Node 24.19.0, npm 11.9.0 e Chromium 151.0.7922.173.

## Preparação

- Cópia independente em `/workspace/prometeu-local`, sem `node_modules`, builds, banco ou arquivos de ambiente da origem.
- `node iniciar.mjs --preparar`, executado a partir de outra pasta (`/tmp`): criou a configuração demonstrativa e instalou os 180 pacotes do lockfile. O cache padrão do ambiente não era gravável; o iniciador passou a usar `app/.local/npm-cache`. A instalação seguinte passou mantendo a verificação de integridade do npm.
- Segunda preparação reaproveitou as dependências. O iniciador somente cria `.env.local` se o arquivo não existir.
- `npm test` na cópia: **32 testes aprovados**, zero falhas, cancelamentos ou skips.

## Inicialização real

O teste de inicialização usou o navegador Chromium do ambiente, fora da distribuição. Em cada modo verificou health HTTP 200, login demonstrativo, pedido “Compare despesas de Tecnologia em setembro de 2026”, prévia de **R$ 300.000** e salvamento com persistência no banco independente.

- **Desenvolvimento:** `sh iniciar.sh --porta=3001` a partir de outra pasta, servidor pronto e jornada aprovada.
- **Produção:** `node iniciar.mjs --producao --porta=3002`; build e TypeScript aprovados, servidor pronto e jornada aprovada.
- Encerrar o iniciador com SIGTERM encerrou o respectivo servidor nos dois modos; as portas não continuaram respondendo.

Os servidores temporários e os dados dessas jornadas foram removidos da pasta de distribuição. O servidor original da nuvem não foi usado para comprovar a cópia local.

## Pacote e limites

O ZIP contém fontes, lockfile, configuração de exemplo, iniciadores e documentação. Exclui dependências instaladas, caches, builds, bancos, sessões, `.env.local` e quaisquer outros arquivos `.env` além de `.env.example`. O iniciador cria a configuração local no primeiro uso. A integridade do ZIP e a igualdade dos arquivos com a pasta de distribuição são verificadas após a geração.

A execução foi validada em Linux. Windows e macOS não foram executados neste ambiente; o atalho `.cmd` e o iniciador em Node são fornecidos para esses sistemas. O usuário deve instalar Node.js 24 LTS e ter internet na primeira instalação. SAP e IA usam demonstração; MSAL/Bedrock reais dependem da configuração descrita em `app/README.md`.
