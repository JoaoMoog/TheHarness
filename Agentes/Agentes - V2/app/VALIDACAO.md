# Validação do fluxo de negócio

Executada nesta reconstrução em 10/10/2026, Node 24.19.0, npm 11.9.0, Next 16.4.0, Chromium do sistema 151.0.7922.173.

- `npm ci --cache /tmp/prometeu-npm --no-audit --no-fund`: instalação reprodutível passou (180 pacotes).
- `npm test`: 32 testes passaram, zero falhas/cancelados/skips. Importação (incluindo acentos UTF-8, BOM e Windows-1252), critérios, soma/média/contagem, centavos, datas/mês/ano, campos e filtros válidos, autenticação de sessão/CSRF, isolamento por identidade, confirmação de importação, expiração, revisão de rascunho e salvamento concorrente/idempotente. Adaptador Bedrock testado com respostas simuladas; não é chamada real à AWS.
- `npm run build`: build de produção e TypeScript passaram após as correções finais de cancelamento e codificação de CSV.
- `/api/health`: respondeu HTTP 200 com app `prometeu` e status `ok` no servidor de produção.

## Navegador

`npm run test:e2e`: **4/4 jornadas passaram** no servidor de produção (10,4 s, Chromium). Os testes cobrem: pedido financeiro → critérios → filtros → refinamento → recarga da conversa → salvar → excluir; SAP de vendas sem orçamento financeiro; importação com acentos, datas diárias e critério de status com total de R$ 300; fluxo mobile com pergunta de esclarecimento, foco de navegação/prévia/chat, cancelamento e novo envio após cancelamento, além das larguras 320/390/768/1024/1440. Cada jornada executa Axe WCAG 2 A/AA e 2.1 AA em estados relevantes, com zero violações encontradas.

As capturas verificadas estão em `.impeccable/review/business/`. `checks.json` registra zero violações nos estados inicial desktop, prévia desktop, prévia mobile e seletor aberto mobile, nenhuma exceção de página e ausência de overflow de documento nas cinco larguras. Essas capturas são anteriores ao tabIndex do histórico longo e ao ajuste para datas diárias; a fonte mensal SAP mostrada permanece com os mesmos valores. As verificações funcionais finais cobrem as mudanças posteriores.

Revisor independente: **ship** no escopo das sete capturas e do contrato BTG, sem achado visual material. Relatório `.impeccable/review/business/review.md`; não certifica integrações externas ou todos os estados. Não havia comp aprovado recuperado. Launcher/detector do Impeccable não estavam disponíveis nesta instalação em nuvem; a revisão visual consultou craft-floor diretamente.

## Limites verificáveis

SAP continua simulado; não foi feita conexão real. MSAL e AWS Bedrock precisam de configuração e validação com contas reais. Não há API de Copilot, perfis de equipe, múltiplas páginas ou editor livre equivalente ao protótipo anterior. O banco desta reconstrução usa SQLite, não o PGlite da implementação local perdida. A conta de demonstração é compartilhada; arquivos nela persistem de verdade. Nenhum acesso público remoto foi validado. Não confundir servidor no ambiente com localhost da máquina do usuário.

## Ambiente

O rascunho de configuração da nuvem foi salvo com instalação reproduzível e instruções de início atualizadas. O app exige Node 24 mesmo quando o projeto raiz ativa Node 22. Rede, repositório e bindings de segredos existentes foram preservados. O rascunho exige revisão e publicação pelas configurações do ambiente; salvar o rascunho não o publica. Uma restauração em tarefa nova não foi testada. Os arquivos de implementação ainda não estão em um commit; devem ser preservados no snapshot do ambiente ou no repositório antes de recriar este workspace.
