# SpeedCode: instalador e atualização manual

## Objetivo

Entregar um único Setup.exe para equipes, mantendo a distribuição portátil. Atualizar sem desinstalação anterior, preservar dados do usuário, recusar downgrade e não adicionar custo residente ao app.

## Requisitos e critérios

- NSIS por usuário, identidade estável, cadastro HKCU e atalhos próprios.
- Payload explícito de EXE, duas DLLs, Ruff/licença e documentação; nada de fontes, node_modules, builds extras ou dados locais.
- Detectar WebView2 nas chaves oficiais e oferecer bootstrapper Microsoft assinado quando ausente; falha interrompe antes de copiar o SpeedCode.
- Mesma versão permite reparo; versão superior atualiza no mesmo diretório; versão inferior retorna código 10 antes de mutações.
- Arquivos em uso abortam com 11 sem matar o app. Nenhuma promessa de preservar conversas RAM ao fechar.
- Desinstalar somente arquivos/atalhos/cadastro próprios, com verificação de identidade/local; não remover perfil, tokens, projetos ou runtime compartilhado.
- Sem polling, serviços, auto-update ou alterações no runtime/editor; consumo do app não muda por instalar.
- Ferramentas e saídas ficam em target/dist ignorados, build reproduzível e versão validada contra o EXE.
- Validar com Setup real em identidade/pasta isoladas: instalação, upgrade, reparo, bloqueios, uninstall e preservação de sentinelas. Não modificar a instalação/perfil do usuário nem remover WebView2 para testar.

## Limitações deliberadas

Sem assinatura Authenticode própria, publicação/auto-update, implantação para máquina inteira ou garantia de instalação permitida pela política corporativa. WebView2 ausente exige internet; sua ausência/falha será simulada neste PC para não alterar o runtime compartilhado. Não há transação/rollback geral contra queda de energia: após falha de cópia, reinstalar a mesma release repara; o cadastro da nova versão só é escrito após a cópia.
