# Investigação — 2026-09-24

## Estado encontrado
- `src/main.rs`: janela Slint, um buffer, listagem de um diretório e `Command::spawn` com CREATE_NEW_CONSOLE. Não há emulador de terminal, serviço Git, diff, abas ou ícone Windows.
- O pacote 0.1 é funcional apenas como navegador/editor básico. A falta de diff de mudanças feitas por agentes é ausência de implementação, não configuração do Git.
- O projeto AgentDeskLite não possui `.git`; pastas sem Git devem continuar editáveis, mostrando essa condição.
- WebView2 153 está instalado. Node/npm, Git, Rust GNU/MSVC e LLVM-MinGW estão disponíveis. Não foi encontrado Visual Studio Build Tools no caminho padrão; reutilizar o caminho GNU/LLVM já validado antes de exigir instalação adicional.
- Copilot foi localizado no diretório WinGet GitHub.Copilot; Kiro em `%LOCALAPPDATA%/Kiro-Cli/kiro-cli.exe`. O PATH de usuário foi atualizado depois do início do processo hospedeiro. Consultar ambiente atual do Windows e caminhos conhecidos, com diagnóstico na interface.
- JTK encontrou a implementação anterior com cobertura completa para arquivos elegíveis, geração `1790287197479-47949d308e6225bf`; leitura direta confirmou os trechos. Nenhuma mutação em projetos indexados foi derivada do conteúdo recuperado.

## Decisão
Rust + Tao/Wry + WebView2 do sistema. Monaco fornece editor e diff; xterm.js fornece VT/ANSI; portable-pty fornece ConPTY. A reutilização destes componentes reduz o risco de inventar um emulador incompleto. Recursos frontend ficam no executável. Medir recursos do processo e filhos, sem prometer um limite não medido.

## Referências primárias
- Wry e IPC/protocolo local: https://docs.rs/wry/latest/wry/struct.WebViewBuilder.html
- Monaco: https://github.com/microsoft/monaco-editor
- xterm e controle de fluxo: https://xtermjs.org/docs/guides/flowcontrol/
- portable-pty: https://docs.rs/portable-pty/latest/portable_pty/
- Status Git NUL: https://git-scm.com/docs/git-status

## Riscos que orientam a implementação
WebView2 possui custo de processos próprios; isso não equivale ao consumo do executável Rust. Monaco não inclui o ecossistema de extensões do VS Code. PTY precisa preservar bytes entre blocos e aplicar backpressure. Git deve usar argv separado, NUL e caminhos literais. Alterações externas com buffer sujo não podem ser sobrescritas. Sessões pertencem ao workspace original mesmo quando o usuário troca de repositório. Push/pull em remoto real só ocorrem por ação explícita na interface; testes usam remoto bare local.
