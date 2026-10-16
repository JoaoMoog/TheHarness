import type { Source } from '@/core/types';

export const domains = [
  { id: 'finance', name: 'Financeiro', description: 'Despesas, orçamento e centros de custo', count: 72 },
  { id: 'sales', name: 'Vendas', description: 'Faturamento por região e produto', count: 48 },
  { id: 'purchases', name: 'Compras', description: 'Pedidos por fornecedor e categoria', count: 48 },
  { id: 'inventory', name: 'Estoque', description: 'Quantidade por unidade e produto', count: 48 },
];

export function sapSource(domain: string, owner: string): Source {
  const option = domains.find(d => d.id === domain);
  if (!option) throw new Error('Escolha uma área disponível.');
  const finance = domain === 'finance';
  const mainLabel = finance ? 'Despesas' : domain === 'sales' ? 'Valor de vendas' : domain === 'purchases' ? 'Valor dos pedidos' : 'Quantidade em estoque';
  const groupLabel = finance ? 'Centro de custo' : domain === 'sales' ? 'Região' : domain === 'purchases' ? 'Fornecedor' : 'Unidade';
  const groups = finance ? ['Tecnologia', 'Operações', 'Comercial', 'Pessoas'] : domain === 'sales' ? ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste'] : domain === 'purchases' ? ['Atlas Serviços', 'Nexo Logística', 'Nova Sistemas', 'Horizonte'] : ['São Paulo', 'Rio de Janeiro', 'Curitiba', 'Recife'];
  const categories = finance ? ['Serviços', 'Infraestrutura', 'Pessoal'] : ['Produto A', 'Produto B'];
  const rows = [];
  for (let month = 4; month <= 9; month++) {
    for (let group = 0; group < groups.length; group++) {
      for (let category = 0; category < categories.length; category++) {
        const value = finance ? 60000 + group * 14500 + category * 24000 + (month - 4) * 3200 : domain === 'inventory' ? 120 + group * 35 + category * 80 + month * 6 : 40000 + group * 18000 + category * 25000 + month * 2200;
        rows.push({ period: `2026-${String(month).padStart(2, '0')}`, group: groups[group], category: categories[category], value,
          ...(finance ? { budget: Math.round(value * (group === 0 ? 0.92 : 1.04)) } : {}), status: finance ? 'Contabilizado' : 'Concluído' });
      }
    }
  }
  return {
    id: crypto.randomUUID(), owner, name: option.name === 'Financeiro' ? 'Despesas e orçamento' : `${option.name} · visão mensal`,
    domain: option.name, origin: 'sap-demo', createdAt: new Date().toISOString(), revision: 1,
    columns: [{ key: 'period', label: 'Período', type: 'date' }, { key: 'group', label: groupLabel, type: 'text' },
      { key: 'category', label: finance ? 'Categoria' : 'Produto', type: 'text' }, { key: 'value', label: mainLabel, type: 'number' },
      ...(finance ? [{ key: 'budget', label: 'Orçamento', type: 'number' as const }] : []), { key: 'status', label: 'Status', type: 'text' }],
    rows, metrics: [{ key: 'value', label: mainLabel, unit: domain === 'inventory' ? 'number' : 'BRL', operation: 'sum' },
      ...(finance ? [{ key: 'budget', label: 'Orçamento', unit: 'BRL' as const, operation: 'sum' as const }] : [])],
    primaryMetric: 'value', budgetMetric: finance ? 'budget' : undefined, groupBy: 'group', dateColumn: 'period',
    rule: { column: 'status', value: finance ? 'Contabilizado' : 'Concluído' },
  };
}
