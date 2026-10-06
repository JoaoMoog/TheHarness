# ADR-001: Rust com Slint condicional

Status: PROPOSTO.

Contexto: Rust atende ao núcleo local e à integração Windows desejada. Slint é a hipótese de UI, mas não houve verificação local de sua API nem de um componente de edição/terminal adequado.

Decisão: iniciar a pesquisa e o spike com Rust; não comprometer a UI final com Slint até G-EDITOR comprovar edição robusta, gutter, seleção, clipboard, undo/redo, scroll, DPI, acessibilidade e diff virtualizado.

Consequências: nenhuma camada de domínio deve depender diretamente de widget. Se a hipótese falhar, interromper antes do editor de produção e apresentar componente/stack alternativa com licença, custo, benchmark e impacto para aprovação.

Alternativas: escrever editor/renderizador do zero (rejeitada antes de evidência); manter Slint sem spike (rejeitada); mudar toda a stack agora (prematura).
