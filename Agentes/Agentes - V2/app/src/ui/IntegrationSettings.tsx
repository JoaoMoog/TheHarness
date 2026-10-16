'use client';
import { useEffect, useState } from 'react';
import type { Actor } from '@/core/types';
import { api } from './api';
import { ErrorMessage, PageHeading } from './shared';

export function IntegrationSettings({ actor, provider }: { actor: Actor; provider: 'demo' | 'bedrock' }) {
  const [sap, setSap] = useState<{ configured: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<{ configured: boolean }>('sap/configuration', { signal: controller.signal }).then(setSap).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível conferir as integrações.'); });
    return () => controller.abort();
  }, []);
  return <><PageHeading title="Integrações" subtitle="Veja quais conexões estão disponíveis neste ambiente." />{error && <ErrorMessage message={error} />}<div className="integration-list">
    <article><h2>SAP</h2><span className={`status-badge${sap?.configured ? ' available' : ''}`}>{sap ? sap.configured ? 'Leitura configurada' : 'Demonstração' : 'Conferindo…'}</span><p>{sap?.configured ? 'A coleção configurada pode ser consultada em Seus dados. Confira a prévia e os critérios antes de confirmar; as versões podem ser atualizadas pela mesma conexão.' : 'Os exemplos de financeiro, vendas, compras e estoque são simulados. Uma coleção de leitura JSON ou OData pode ser configurada pela equipe responsável pelo SAP.'}</p></article>
    <article><h2>Arquivos</h2><span className="status-badge available">Disponível</span><p>Importe CSV, XLSX ou JSON, confira a qualidade e os critérios e atualize a fonte mantendo o histórico.</p></article>
    <article><h2>Inteligência artificial</h2><span className="status-badge">{provider === 'demo' ? 'Demonstração' : 'AWS Bedrock configurado'}</span><p>{provider === 'demo' ? 'As sugestões usam regras de demonstração. Os controles de indicadores, fórmulas e comparação funcionam com seus dados. A ativação da IA real fica para uma próxima etapa.' : 'Os pedidos são enviados ao AWS Bedrock com nomes de campos e dados agregados. Confira a proposta antes de salvar.'}</p></article>
    <article><h2>Acesso e colaboração</h2><span className="status-badge available">{actor.demo ? 'Demonstração' : actor.auth === 'local' ? 'Conta local' : 'Microsoft autenticado'}</span><p>Contas locais permitem usar espaços de equipe neste servidor. O acesso Microsoft exige configuração da organização. Administradores gerenciam membros e convites em Equipe e operação.</p></article>
  </div></>;
}
