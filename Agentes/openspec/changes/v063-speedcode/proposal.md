# SpeedCode — identidade e navegação Git

Renomear a marca, pasta local e repositório GitHub para SpeedCode. Preservar
exatamente a paleta da ferramenta e os gradientes do fundo/símbolo da marca;
substituir o símbolo por uma combinação original de raio e velocímetro em SVG.
Atualizar executável, metadados Windows, documentação e referências ativas.

Navegação: clique simples no controle de versão continua abrindo diff;
duplo clique abre o arquivo e revela seus ancestrais no explorador interno.
Oferecer também ação explícita no cabeçalho do diff. Nenhuma abertura externa,
Git mutação, autosave ou descarte de buffer. Arquivo removido deve revelar pasta
e informar ausência, sem reconstruir o arquivo do diff.

Desempenho: expandir apenas ancestrais, sequencialmente, respeitando cotas da
árvore; sem pesquisa recursiva, indexação ou timer novo. Navegação concorrente
invalida resposta de diff anterior. Explicar limites/parcialidade sem esconder
arquivos. Testar cliques, corrida assíncrona, exclusão/rename e preservação dirty.

Compatibilidade: manter perfil WebView/armazenamento legado quando existente,
aliases de variáveis antigas e ação JSON legada. Credenciais permanecem no CLI.
Specs/medições históricas registram o nome antigo e não são reescritas como se
SpeedCode fosse o binário anteriormente medido.

Documentar vantagens complementares de chat/CLI: integração e contexto versus
fluxo terminal nativo; nenhum ganho garantido de inteligência, créditos ou CPU.
Build 0.6.3 e validar sem alterar repositórios pessoais ou invocar inferência paga.
