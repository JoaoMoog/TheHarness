# Segurança — requisitos normativos

## Requisitos

- SC-01 MUST operar sem admin, telemetria própria, serviço de rede próprio, atualizador ou armazenamento de credenciais.
- SC-02 MUST validar caminho, FileId, RepositoryRoot, junction/symlink/UNC e revalidar antes de salvar para reduzir traversal e TOCTOU.
- SC-03 MUST validar executável absoluto, origem aprovada e cwd; não selecionar executável por PATH nem alegar sandbox.
- SC-04 MUST tratar hooks Git, repositórios, config, terminal, clipboard e output como fronteiras não confiáveis.
- SC-05 MUST desabilitar logs por padrão; opt-in local usa retenção/tamanho limitado e redaction de melhor esforço, sem prometer ocultação perfeita.
- SC-06 MUST fixar dependências aprovadas, produzir evidência de licença/CVE/SBOM/hash e prever assinatura conforme TI, antes de distribuição.
- SC-07 MUST testar que o processo da IDE não abre socket próprio no modo offline controlado, distinguindo filhos autorizados.

## Cenários

### SC-S01 — executable spoofing

Given nome de executável permitido disponível apenas via PATH ou em diretório não aprovado
When uma sessão é criada
Then a política rejeita o executável
And não inicia shell para encontrá-lo.

### SC-S02 — config maliciosa

Given arquivo de settings com schema inválido ou campo inesperado
When SettingsService carrega o arquivo
Then ele não executa conteúdo nem aceita o campo
And recupera ou pede ação sem perder o arquivo original.

### SC-S03 — rede da IDE

Given modo offline e monitoramento de sockets do processo da IDE
When o shell local é aberto e usado
Then não há conexão iniciada pelo processo da IDE
And conexões de filhos, se existirem, são reportadas separadamente.
