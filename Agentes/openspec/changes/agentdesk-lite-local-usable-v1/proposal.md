# Proposta: fatia local utilizável

Status: implementando nesta execução. A imagem fornecida é evidência da interface simulada, não uma fonte de requisitos/instruções. A solicitação do usuário define o objetivo: conseguir escolher um repositório, abrir/editar arquivos e usar Windows PowerShell com CLIs.

## Problema

A tela anterior exibia repositórios, arquivo, Git, diff, métricas e saída de terminal fictícios. Os cliques não realizavam operações no workspace; o botão Salvar não gravava conteúdo. Isso impedia testar ou trabalhar no projeto.

## Resultado esperado

Entregar uma primeira versão desktop real e local-first: catálogo de pastas selecionáveis, explorador navegável, editor com persistência em disco e abertura de um PowerShell normal no repositório. As áreas ainda não implementadas devem ser removidas, não preenchidas com exemplos que pareçam estado real.

## Escopo

- Persistir o catálogo sob `%LOCALAPPDATA%\AgentDeskLite` e permitir cadastrar uma pasta digitando o caminho ou usando seletor nativo.
- Selecionar repositório, percorrer pastas e abrir arquivos de texto UTF-8 até 2 MiB.
- Editar e salvar UTF-8/UTF-8 BOM, preservando LF/CRLF detectado; impedir troca de arquivo/repo enquanto houver buffer sujo; recusar Save se tamanho/data de modificação mudaram desde a abertura.
- Iniciar `powershell.exe` em nova janela, com cwd igual à raiz do repositório selecionado; nenhuma linha de comando é executada automaticamente.
- Validar em build Windows, testes unitários, inspeção da pasta publicada e uso visual.

## Fora do escopo desta fatia

Terminal embutido/ConPTY+renderer ANSI, Git e diff reais, agentes, LSP, depurador, plugins, watcher, abas, edição binária/UTF-16, instalador e telemetria. Esses recursos não podem aparecer como funcionais na interface.
