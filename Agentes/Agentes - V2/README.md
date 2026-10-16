# CLARA Studio

Projeto de frontend React e backend Next.js/TypeScript. Requer Node.js 24 e npm.

## Instalar e iniciar

Abra um terminal nesta pasta e execute:

```sh
cd app
npm i
npm run studio
```

Acesse http://127.0.0.1:3000 e escolha **Começar demonstração**.
No PowerShell, pode usar `npm.cmd` caso a política local bloqueie `npm.ps1`.

Nenhuma configuração externa é necessária para o modo demonstrativo. Os dados,
contas e sessões ficam em memória e são apagados ao reiniciar o servidor.
SAP, SSO, IA externa e persistência definitiva ficam para configuração posterior.
Os arquivos `.env.example` e `.env.studio.example` são modelos sem credenciais reais.

## Produção local

Na pasta `app`, após instalar as dependências:

```sh
npm run build
npm run studio:start
```

## Testes e contratos

Na pasta `app`: `npm test`, `npm run typecheck`, `npm run contracts:studio`.
Os testes de navegador são opcionais e precisam de navegador compatível e servidor ativo.

## Containers e documentação

Na raiz: `docker compose up --build`, com Docker Engine disponível.
O Compose usa http://localhost:3000. Kubernetes: `deploy/kubernetes/base`.
O Engine e o cluster ainda precisam de homologação no ambiente de destino.

- Guia: [docs/CLARA-STUDIO.md](docs/CLARA-STUDIO.md)
- Contrato: [app/contracts/studio.openapi.json](app/contracts/studio.openapi.json)
- Validação anterior: [docs/CLARA-VERIFICACAO.md](docs/CLARA-VERIFICACAO.md)

Esta cópia inclui código, testes, contratos, configuração de build, referências
de design e documentação. Dependências, builds, dados locais, credenciais,
instaladores, atalhos e caches não foram incluídos. A interface anterior continua em `/classic`.