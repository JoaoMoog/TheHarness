# SpeedCode: desempenho é requisito de aceitação

Leia também as instruções herdadas do diretório pai. A descoberta JTK continua
auxiliar; o agente principal é responsável por alterações e validação.

- Toda funcionalidade deve respeitar [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
- Nada de scans recursivos, polling, filas, caches, modelos de editor ou elementos
  DOM sem limites de tamanho, concorrência e ciclo de vida explícitos.
- Trabalho caro é sob demanda e fora da thread da janela. Formatação usa worker
  descartável/timeout; nenhuma análise semântica automática pesada por padrão.
- Não obtenha o texto completo ou reconstrua toda a UI a cada tecla/evento.
- Ao ocultar/minimizar, suspenda manutenção dispensável, não a sessão do agente.
- Limites de apresentação nunca autorizam cortar o contexto do harness, descartar
  buffers não salvos, executar comandos Git destrutivos ou repetir mutações.
- Para recursos caros: teste normal, adversarial, cancelamento e liberação de
  recursos. Rode testes Rust/JS e build; meça app + WebView2 em perfil isolado.
- Regressão de CPU/RAM no cenário controlado bloqueia entrega; não aumente os
  tetos para esconder regressões. Registre cenário, hardware e limites da medição.
- Não prometa CPU/RAM fixa ou economia de tokens sem benchmark. CLIs, MCPs e sites
  externos têm custo próprio; inclua isso explicitamente na evidência.
