# SpeedCode 0.6.7 — ícone Recolher tudo

Ajuste visual solicitado: dois quadrados sobrepostos com um traço interno,
como na referência. Mantidos stroke/currentColor/tamanho, tooltip e ação.
Nenhuma alteração em cores, DOM, eventos, leituras Git, cache ou paginação.

Os limites e o comportamento de 0.6.6 permanecem; medições anteriores constam
em ../v066-git-expansion/validation.md. Não são medições novas desta versão.

Validação em 2026-10-05:
- JS: 59 passaram, zero falhas; Rust: 53 passaram, 8 opt-in ignorados, zero falhas.
- SVG extraído do caminho real de main.js e renderizado via Resvg; inspeção
  visual confirmou os quadrados sobrepostos com traço. Prévia e script ignorados.
- Frontend e Rust release 0.6.7 compilados. Alerta pré-existente do chunk
  principal ~4,50 MB permanece. git diff --check passou.
- Não se repetiu medição de CPU/RAM nem automação da janela para esse ajuste
  de desenho estático; não foi introduzido trabalho adicional em background.
- Instalador usa o release verificado por FileVersion, mantendo a atualização
  por usuário. NSIS e lógica de instalação intactos; suíte não repetida.
  Nenhuma instalação, login ou inferência automática no perfil do usuário.
