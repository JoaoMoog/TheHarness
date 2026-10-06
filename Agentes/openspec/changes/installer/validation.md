# Validação — instalador SpeedCode

Data: 2026-10-05. Windows x64; NSIS 3.13, baixado do projeto oficial para `target/installer-tools/`. Nenhuma ferramenta instalada globalmente.

## Testes executados

- Build Rust release: passou. O EXE tem o mesmo SHA256 do release anterior, `00D8060D741221D52A3D20865FE644200A4CEE137E817D5C05E317593B5C4F2A`: não mudou o app, somente sua distribuição. Nenhum serviço, auto-updater ou manutenção nova é executado pelo app. Não é uma nova medição de CPU/RAM.
- Suíte Rust: 53 passaram, 8 opt-in ignorados, zero falhas.
- Suíte JavaScript: 43 passaram, zero falhas.
- Compilação NSIS com warnings tratados como erros: passou.
- `scripts/test-installer.ps1`: Setup real em pasta/cadastro/atalhos de teste exclusivos, com EXE/DLLs/formatador reais. Instalação, arquivos por hash, atalhos, upgrade de 9.0.0 para 9.0.1 sem desinstalar, diretório original preservado mesmo com `/D` diferente, reparo da mesma versão e downgrade 8.9.9 bloqueado.
- Arquivo EXE mantido aberto por uma fixture: saída 11 sem substituição; instalador concorrente: saída 13; cadastro da versão anterior preservado.
- Falha WebView2 simulada: saída 12 antes de alterações no SpeedCode. Não desinstalamos nem reinstalamos o runtime compartilhado deste computador.
- Desinstalador recusa marcador de propriedade incorreto; desinstalação válida remove payload, atalhos e cadastro de teste, mas mantém arquivo do usuário e sentinela de configurações fora do app.
- Cadastro real e processo SpeedCode já aberto preservados. Nenhuma inferência/login ou leitura de tokens foi feita.
- `.gitignore` cobre EXEs, DLLs, dist, target e fixtures. Nenhum binário/build rastreado pelo Git.

## Reproduzir

```powershell
.\scripts\installer.ps1 -SkipBuild
.\scripts\test-installer.ps1
```

O teste usa versões/cadastro exclusivos com o app real 0.6.3: testa a lógica do instalador, não finge existir uma release 9.x do aplicativo. Relatórios detalhados ficam em `.validation/installer-<id>/report.json` local, não no Git.

## Limitações

Sucesso com WebView2 existente foi testado realmente. Instalar WebView2 em um Windows limpo/offline/política restritiva precisa de VM dedicada; a falha foi simulada para não alterar o runtime compartilhado. Não houve teste visual dos passos/cancelamento do wizard; instalação/desinstalação foram executadas em modo silencioso.

O Setup não tem assinatura Authenticode própria, nem atualização automática/publicação. Não há garantia contra bloqueio corporativo, crash de energia ou reversão transacional de uma cópia parcial. Reexecutar a mesma release é o caminho de reparo. A atualização exige fechar o app, salvar edições e aceitar que conversas RAM se encerrem.

Fontes do formato e requisito: [NSIS](https://nsis.sourceforge.io/Docs/) e [Microsoft WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).
