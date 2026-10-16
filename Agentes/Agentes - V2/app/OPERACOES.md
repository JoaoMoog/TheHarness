# Operação local da CLARA

## Espaços e permissões

O espaço pessoal preserva o identificador `actor.id` e os dados existentes. Espaços de equipe usam identificadores próprios e armazenam dados separados. Leitor consulta; editor importa, cria análises e altera dashboards; administrador também gerencia membros, convites e auditoria. A API valida a associação e o papel em cada solicitação: esconder um botão não concede nem remove permissão.

Convites são códigos aleatórios, de uso único, válidos por sete dias. O servidor armazena apenas o hash. A pessoa administradora copia e compartilha o código pelo canal que escolher; a CLARA não envia mensagens. Revogar um convite impede novos ingressos. Remover um membro corta seu acesso ao espaço na próxima requisição. O último administrador não pode ser removido nem rebaixado. O espaço pessoal não aceita membros.

Eventos de auditoria registram pessoa, ação, identificador do item e horário UTC. Não incluem conteúdo das fontes, pedidos, credenciais ou códigos. São visíveis aos administradores do espaço. O arquivo SQLite e seus backups devem ficar protegidos por permissões do sistema operacional; esta versão não fornece armazenamento WORM nem assinatura externa do log.

## Backup e restauração

Use Node 24 ou superior. O comando cria uma fotografia SQLite consistente, incluindo transações confirmadas no WAL, verifica integridade e remove sessões do backup. Não substitui arquivos existentes. O manifesto SHA-256 deve acompanhar o arquivo; ele detecta corrupção acidental, não substitui uma assinatura contra adulteração intencional.

```powershell
cd D:/Prometeu/app
node scripts/backup.mjs create .data .local/backups/clara-2026-10-11.sqlite
node scripts/backup.mjs restore .local/backups/clara-2026-10-11.sqlite .local/restores/clara-2026-10-11
```

A restauração só aceita pasta de destino nova e valida o checksum antes de criá-la. Confira a pasta restaurada; pare o servidor antes de mudar `PROMETEU_DATA_DIR`; inicie e confirme `/api/health/ready`. Entre novamente, porque todas as sessões do backup foram revogadas. Preserve a pasta anterior para retorno. Nunca mova apenas o arquivo `.sqlite` de um banco ativo, ignorando seus arquivos WAL/SHM. Guarde backup e manifesto juntos em um local de acesso restrito e faça exercícios de restauração periódicos. Não há agenda externa de backup configurada automaticamente.

## Monitoramento

`GET /api/health` mantém o contrato histórico; `GET /api/health/ready` verifica uma consulta SQLite e deve retornar HTTP 503 se o banco estiver indisponível. A visão administrativa por espaço lista contagem e volume serializado dos recursos, quantidade de eventos e janela de latência/erros. A janela é limitada aos últimos dois mil pedidos e quinze minutos do processo atual; reiniciar apaga somente essas métricas. Não representa disponibilidade histórica nem substitui um monitor externo. O monitor deve alertar sobre falhas consecutivas de readiness sem incluir segredos em logs.

## SAP somente leitura

Configure `SAP_READ_URL` no servidor para uma coleção JSON ou OData (lista, `value` ou `d.results`). Use HTTPS em produção. HTTP é aceito apenas para localhost em testes. Se necessário, `SAP_READ_TOKEN` envia Bearer token; a interface não recebe esse valor. Utilize uma conta SAP com permissão de leitura e exponha somente as colunas autorizadas. A CLARA faz apenas GET, recusa redirecionamentos e aceita paginação somente na mesma origem e caminho da coleção configurada. São até 25 páginas, 20 mil registros, 8 MB e 30 segundos por consulta completa.

O resultado passa pela mesma conferência de colunas e critérios da importação. Nenhuma regra contábil é inferida pelo conector. Objetos aninhados devem ser projetados em colunas simples no serviço. Para SAP com autenticação diferente de Bearer ou formatos específicos, configure um gateway de leitura compatível. Testes locais usam respostas simuladas; não houve validação com SAP real, credenciais empresariais ou escrita no SAP. A IA permanece em demonstração.
