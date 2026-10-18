# CLARA · Analytics Studio

Protótipo web navegável da CLARA, inspirado na experiência empresarial do SAP Analytics Cloud. Criado com as diretrizes Taste e Impeccable, usando a composição e o conteúdo aprovados na conversa.

## Abrir

Abra `index.html` diretamente no Chrome ou Edge. O arquivo contém código, estilos, ícones e fontes: não precisa de internet, instalação ou credenciais.

Para servir localmente a partir de `D:\Prometeu`:

```powershell
node design/clara-sap-studio/serve.mjs
```

Abra http://127.0.0.1:4178. O servidor escuta somente nesta máquina. Encerre com Ctrl+C.

## Experimentar

1. No chat, peça “Crie um dashboard financeiro”, confira os critérios e gere a análise.
2. Peça “Mostre apenas Tecnologia”, aplique e confira os números.
3. Peça “Troque o gráfico por barras horizontais” e experimente desfazer.
4. Peça “Simule redução de 5% em Tecnologia” e confira a economia de R$ 160.500.
5. Edite o dashboard, salve e reabra pela biblioteca.
6. Ajuste o orçamento em Planejamento, configure uma medida em Modelos e teste pausar/reconectar a fonte em Conexões.
7. Em Compartilhar, ative a visão de Leitor; em Administração, confira a restrição de acesso.

O navegador mantém análises, filtros, comentários, versões e cenários na chave `clara:sap-studio:v1`. O armazenamento é independente do app principal e dos protótipos anteriores. Endereços `file:` e `http:` mantêm espaços locais distintos. Caso o navegador bloqueie o armazenamento, um aviso informa que as alterações duram apenas a sessão.

## Limites da demonstração

- Dados financeiros sintéticos, com totais e filtros calculados localmente.
- Chat por intenções demonstrativas, sem chamada a modelo de IA. Pedidos não suportados recebem orientação.
- Conectores representam uma base local; não autenticam nem consultam SAP real.
- Permissões, pessoas e compartilhamento são demonstrações de interface; não constituem autenticação ou controle de acesso de produção.
- Projeção ilustrativa por média, sem modelo preditivo. Planejamento e cenários preservam o realizado original.
- CSV é gerado localmente. O modo de apresentação usa a impressão do navegador para PDF.
- Nenhum convite, mensagem ou dado é enviado externamente. Os links de referência só abrem quando selecionados.

## Desenvolvimento e verificação

Reaproveita React, Recharts, Lucide, Figtree, esbuild, TypeScript e Playwright já instalados em `app/node_modules`. Não altera dependências da aplicação principal.

```powershell
node design/clara-sap-studio/build.mjs
node --test design/clara-sap-studio/core.test.mjs
node app/node_modules/typescript/bin/tsc -p design/clara-sap-studio/tsconfig.json
node design/clara-sap-studio/verify.mjs
```

O teste de navegador usa Chrome ou Edge instalado no Windows, em contexto isolado. Resultados e capturas ficam em `.impeccable/review`. O utilitário automático do Impeccable estava indisponível por ausência do engine; as diretrizes foram aplicadas diretamente e a auditoria técnica usa axe-core/Playwright.

## Referências

- [SAP Analytics Cloud](https://www.sap.com/products/data-cloud/cloud-analytics.html)
- [Tour do SAP Analytics Cloud](https://www.sap.com/products/data-cloud/cloud-analytics/product-tour.html)
- [SAP Fiori para web](https://www.sap.com/design-system/fiori-design-web)
- [Análise conversacional com Joule](https://architecture.learning.sap.com/docs/ref-arch/9efadc)

São referências de design e funcionalidade; esta entrega não usa uma biblioteca oficial de interface SAP nem indica vínculo com a SAP.
