# CrossMarketPlace v2 · protótipo navegável

Marketplace interno de soluções de tecnologia e IA, no padrão visual "Orquestra" (aproximado, paleta BTG Banking).
Tudo roda no navegador, com **dados fictícios**; autenticação, permissões, persistência e integrações são simuladas.

## Rodar

```bash
npm install
npm start          # http://127.0.0.1:8790
npm test           # regras de negócio + servidor (node:test)
npm run typecheck
```

## O que dá para fazer

- **Perfil simulado** (menu no topo): Colaborador, Publicador, Aprovador e Administrador. Abas sem permissão mostram um cadeado e a tela "Sem autorização".
- **Simular** (mesmo menu): carregamento lento e falha ao carregar, para ver os estados de carregando e erro. "Reiniciar demonstração" volta aos dados iniciais.
- Fluxo completo: buscar → abrir detalhe → favoritar, pedir acesso, confirmar uso, avaliar → publicar (4 etapas, importação JSON/YAML, aviso de duplicidade) → aprovar, recusar ou pedir correção como Aprovador → solução aparece no catálogo → indicadores do time e da administração mudam.

## Estrutura

- `web/js/domain/` regras puras e testadas: catálogo, permissões, fluxo de aprovação e acesso, similaridade, métricas, importação.
- `web/js/screens/` uma tela por arquivo; `web/js/ui/` componentes, cabeçalho, modais, ícones.
- `web/js/store.js` estado imutável (cópia a cada mudança) salvo em `sessionStorage`.
- `src/` servidor estático com CSP e bloqueio de path traversal.

Figma: arquivo "CrossMarketPlace v2 · Orquestra" (AJmgwOJBHJ5GGWqfpXZIT7).
