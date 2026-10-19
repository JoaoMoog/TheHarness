# Piloto com dados sintéticos

O piloto inicia a aplicação e um serviço HTTP financeiro de teste. Usa SQLite; não consulta SAP real.

Com Node.js 24 e dependências instaladas, execute na pasta `app`:

```powershell
$env:CLARA_ENV_FILE = '.env.dev'
$env:STUDIO_DATA_PROVIDER = 'financial-test'
$env:SAP_READ_URL = 'http://127.0.0.1:4010/odata/FinancialFacts'
$env:SAP_STUDIO_MAPPING = '{"id":"DocumentId","center":"CostCenter","company":"Company","date":"PostingDate","actual":"ActualAmount","budget":"BudgetAmount","currency":"Currency"}'
npm.cmd run pilot
```

Sem `CLARA_ENV_FILE`, o piloto lê `.env.dev`. Os campos acima precisam ser definidos porque o dev normal usa dados demonstrativos internos. Para IA ou Microsoft reais, configure o ambiente conforme o [guia de configuração](configuracao/README.md).

Para executar compilado, mantenha essas variáveis, execute `npm run build` e depois `npm run pilot:start`. Use `studio:start` ou `start` para SAP corporativo. Dados persistentes ficam em `PROMETEU_DATA_DIR`; veja [backup e restauração](../app/OPERACOES.md).
