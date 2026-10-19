# CLARA

Aplicação de análise de dados com frontend e backend em `app/`. A interface principal fica em `/`; a anterior permanece em `/classic`.

## Executar localmente

Requer Node.js 24 e npm. Na primeira execução:

```sh
cd app
npm ci
npm run studio
```

Abra http://127.0.0.1:3000. Depois de instalar as dependências, também pode usar `iniciar-studio.cmd` no Windows. O ambiente local usa demonstração em memória; reiniciar descarta os dados dessa execução. `node iniciar.mjs` também prepara as dependências e inicia a aplicação.

## Ambientes

Existem quatro arquivos em `app/`:

| Arquivo | Finalidade |
|---|---|
| `.env.local` | Demonstração local sem integrações; ignorado pelo Git |
| `.env.dev` | Desenvolvimento com contas locais e SQLite em `.data/dev` |
| `.env.uat` | Homologação; preencher Microsoft, AWS e SAP do destino |
| `.env.prod` | Produção; preencher Microsoft, AWS e SAP do destino |

Dev, UAT e prod são modelos sem credenciais, versionados. Configure segredos no processo ou no Secrets Manager. Os quatro perfis têm o mesmo inventário de variáveis.

Na pasta `app`, selecione o arquivo no PowerShell:

```powershell
$env:CLARA_ENV_FILE = '.env.dev'
npm.cmd run dev
```

Para homologação ou produção, mantenha o mesmo perfil no build e na execução:

```powershell
$env:CLARA_ENV_FILE = '.env.uat'
npm.cmd run build
npm.cmd start
```

No macOS/Linux: `CLARA_ENV_FILE=.env.dev npm run dev`. Sem seleção, dev/build/start/studio usam `.env.local`. Variáveis do processo prevalecem. UAT e produção exigem a configuração das integrações antes de iniciar.

## Migração

Consulte o [guia de configuração](docs/configuracao/README.md) e os [procedimentos de backup](app/OPERACOES.md). `app/.data` contém dados locais e não foi apagado na limpeza; não o copie para uma instalação que deve começar vazia. Para reutilizar um banco, faça backup consistente e aponte `PROMETEU_DATA_DIR` para a pasta restaurada.

Não transfira `node_modules`, `.next`, `.local`, resultados de testes ou credenciais da máquina de origem. Reinstale com `npm ci` e gere um novo build. Se migrar via Git, transfira a configuração local separadamente ou deixe `node iniciar.mjs` regenerar a demonstração. `design/`, `specs/` e `infra/agentcore/` preservam fontes históricas; a aplicação não depende delas. Não execute os scripts antigos de infraestrutura no destino sem revisar seus identificadores.

## Verificação

Na pasta `app`: `npm run test:env` valida a seleção de ambiente sem instalar dependências. `npm test`, `npm run typecheck`, `npm run build` e `npm run test:e2e` exigem `npm ci`.
