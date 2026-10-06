# ADR-003: ConPTY como transporte condicional

Status: PROPOSTO.

Contexto: sessões interativas exigem TTY, resize, input, sinais e cleanup. ConPTY pode prover pseudoconsole no Windows, mas não fornece por si só emulação/renderização VT.

Decisão: executar G-TERMINAL com processo fake antes de escolher biblioteca de renderização. Implementação só usa processo direto, ConPTY e renderer aprovados após evidência. Limitar sessões abertas a cinco e tarefas ativas inicialmente a duas, ajustáveis por configuração.

Consequências: não há alegação de automação de Copilot/Kiro; se sua semântica programática não estiver documentada, o produto oferece terminal interativo. Escape sequences, clipboard e output são tratados como dados não confiáveis.

Alternativas: shell intermediário por padrão e parser próprio completo são rejeitados até necessidade e testes demonstrarem valor.
