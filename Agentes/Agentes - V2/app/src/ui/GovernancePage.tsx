'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, RefreshCw, Users } from 'lucide-react';
import type { GovernanceState, Workspace, WorkspaceMember, WorkspaceRole } from '@/core/workspace';
import { api } from './api';
import { Select } from './Select';
import { Busy, ErrorMessage, PageHeading } from './shared';
import './governance.css';

const roleNames: Record<WorkspaceRole, string> = { reader: 'Leitor', editor: 'Editor', admin: 'Administrador' };
const roleOptions = Object.entries(roleNames).map(([value, label]) => ({ value, label }));
const actionNames: Record<string, string> = {
  'workspace.created': 'Criou o espaço', 'invite.created': 'Criou um convite', 'invite.revoked': 'Revogou um convite',
  'member.joined': 'Entrou no espaço', 'member.removed': 'Removeu um membro',
  'member.role.reader': 'Alterou acesso para leitor', 'member.role.editor': 'Alterou acesso para editor', 'member.role.admin': 'Alterou acesso para administrador',
  'source.created': 'Adicionou uma fonte', 'source.updated': 'Atualizou uma fonte', 'source.deleted': 'Excluiu uma fonte',
  'report.created': 'Salvou um dashboard', 'report.updated': 'Atualizou um dashboard', 'report.deleted': 'Excluiu um dashboard',
  'draft.created': 'Criou uma conversa', 'draft.updated': 'Atualizou uma conversa', 'report.saved': 'Salvou um dashboard',
  'draft.resumed': 'Recuperou um rascunho', 'source.imported': 'Importou uma fonte', 'source.replace': 'Atualizou os dados da fonte',
  'source.restore': 'Restaurou uma versão da fonte', 'report.duplicate': 'Duplicou um dashboard', 'report.restore': 'Restaurou uma versão do dashboard',
};
const when = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
type Operations = { health: { status: string }; resources: { kind: string; count: number; bytes: number }[]; auditEvents: number; uptimeSeconds: number; processWindow: { sampledRequests: number; errors: number; p95Ms: number | null }; notes: string };

function MemberRow({ member, disabled, change }: { member: WorkspaceMember; disabled: boolean; change: (member: WorkspaceMember, role: WorkspaceRole | null) => Promise<void> }) {
  const [role, setRole] = useState(member.role);
  const [removing, setRemoving] = useState(false);
  useEffect(() => setRole(member.role), [member.role]);
  return <li className="governance-member"><div><strong>{member.name}</strong><small>Desde {when(member.joinedAt)}</small></div>
    <Select label={`Acesso de ${member.name}`} value={role} onChange={value => setRole(value as WorkspaceRole)} options={roleOptions} disabled={disabled} />
    <button className="button secondary" disabled={disabled || role === member.role} onClick={() => void change(member, role)}>Salvar acesso</button>
    <button className="text-button" disabled={disabled} onClick={() => setRemoving(!removing)}>Remover</button>
    {removing && <div className="governance-confirm"><p>Remover {member.name} deste espaço? O acesso será encerrado; as análises da equipe continuam disponíveis.</p><button className="button secondary" disabled={disabled} onClick={() => setRemoving(false)}>Cancelar</button><button className="button danger" disabled={disabled} onClick={() => void change(member, null)}>Confirmar remoção</button></div>}
  </li>;
}

export function GovernancePage({ workspace, workspaces, changed }: { workspace: Workspace; workspaces: Workspace[]; changed: (workspaceId?: string) => Promise<void> }) {
  const [state, setState] = useState<GovernanceState | null>(null);
  const [operations, setOperations] = useState<Operations | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('reader');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    let active = true; setState(null); setOperations(null); setInviteCode(''); setError(''); setLoading(workspace.role === 'admin');
    if (workspace.role !== 'admin') return;
    setLoading(true);
    Promise.all([api<GovernanceState>(`workspaces/${workspace.id}`), api<Operations>(`workspaces/${workspace.id}/operations`)])
      .then(([next, metrics]) => { if (active) { setState(next); setOperations(metrics); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar a equipe. Tente novamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspace.id, workspace.role, version]);
  async function run(action: () => Promise<void>) {
    if (pending) return; setPending(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setPending(false); }
  }
  async function memberChange(member: WorkspaceMember, role: WorkspaceRole | null) {
    await run(async () => {
      await api(`workspaces/${workspace.id}/members/${encodeURIComponent(member.actorId)}`, role ? { body: { role } } : { method: 'DELETE' });
      setNotice(role ? 'Acesso atualizado.' : 'Membro removido do espaço.');
      await changed(); refresh();
    });
  }
  return <><PageHeading title="Equipe e operação" subtitle="Compartilhe análises com acesso definido e acompanhe as mudanças do espaço." actions={<button className="button secondary" disabled={loading || pending} onClick={refresh}><RefreshCw size={16} />Atualizar</button>} />
    <div className="governance-context"><Users size={20} /><div><strong>{workspace.name}</strong><span>{workspace.personal ? 'Espaço pessoal' : 'Espaço de equipe'} · Seu acesso: {roleNames[workspace.role]}</span></div><Select label="Espaço atual" value={workspace.id} options={workspaces.map(item => ({ value: item.id, label: item.name }))} disabled={pending} onChange={id => void run(() => changed(id))} /></div>
    {notice && <p className="success-notice" role="status">{notice}</p>}{error && <ErrorMessage message={error} retry={refresh} />}
    <div className="governance-entry"><section><h2>Criar um espaço de equipe</h2><p>As fontes e dashboards deste novo espaço ficam separados dos seus dados pessoais.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { const created = await api<Workspace>('workspaces', { body: { name } }); setName(''); await changed(created.id); setNotice('Espaço criado. Convide sua equipe para começar.'); }); }}><label htmlFor="workspace-name">Nome do espaço</label><input id="workspace-name" value={name} maxLength={80} required disabled={pending} onChange={event => setName(event.target.value)} placeholder="Ex.: Planejamento comercial" /><button className="button primary" disabled={pending || !name.trim()}><Plus size={16} />Criar espaço</button></form></section>
      <section><h2>Entrar por convite</h2><p>Peça um código ao administrador. Ele vale por sete dias e só pode ser usado uma vez.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { const joined = await api<Workspace>('workspaces/join', { body: { code: code.trim() } }); setCode(''); await changed(joined.id); setNotice('Você entrou no espaço.'); }); }}><label htmlFor="workspace-code">Código do convite</label><input id="workspace-code" value={code} maxLength={100} required disabled={pending} autoComplete="off" spellCheck={false} onChange={event => setCode(event.target.value)} /><button className="button secondary" disabled={pending || !code.trim()}>Entrar no espaço</button></form></section></div>
    <p className="governance-help"><strong>Leitor</strong> consulta e exporta. <strong>Editor</strong> também cria e altera análises e fontes. <strong>Administrador</strong> gerencia acessos e vê a auditoria.</p>
    {loading && <Busy>Carregando equipe e operação…</Busy>}
    {workspace.role !== 'admin' && <div className="empty-state"><h2>Seu acesso está ativo</h2><p>A lista de membros, os convites e a auditoria são gerenciados pelos administradores deste espaço.</p></div>}
    {state && <>
      <section className="governance-section"><h2>{workspace.personal ? 'Seu espaço pessoal' : 'Membros e convites'}</h2>
        {workspace.personal ? <p>Somente você acessa este espaço. Crie um espaço de equipe acima para compartilhar novas análises.</p> : <><ul className="governance-members">{state.members.map(member => <MemberRow key={member.actorId} member={member} disabled={pending} change={memberChange} />)}</ul>
          <form className="governance-invite" onSubmit={event => { event.preventDefault(); void run(async () => { const invite = await api<{ code: string }>(`workspaces/${workspace.id}/invites`, { body: { role: inviteRole } }); setInviteCode(invite.code); setNotice('Convite criado. Copie o código antes de sair desta tela.'); const next = await api<GovernanceState>(`workspaces/${workspace.id}`); setState(next); }); }}><Select label="Acesso do convidado" value={inviteRole} options={roleOptions} onChange={value => setInviteRole(value as WorkspaceRole)} disabled={pending} /><button className="button primary" disabled={pending}>Criar código de convite</button></form>
          {inviteCode && <div className="governance-code"><label htmlFor="new-invite-code">Compartilhe este código com uma pessoa. Ele não será exibido novamente.</label><input id="new-invite-code" readOnly value={inviteCode} onFocus={event => event.target.select()} /><button className="button secondary" onClick={() => void run(async () => { try { await navigator.clipboard.writeText(inviteCode); setNotice('Código copiado.'); } catch { setError('Não foi possível copiar automaticamente. Selecione o código e copie pelo teclado.'); } })}><Copy size={16} />Copiar código</button><p>Nenhum e-mail ou mensagem será enviado pela CLARA.</p></div>}
          <h3>Convites em aberto</h3>{!state.invites.length ? <p>Nenhum convite pendente.</p> : <ul className="governance-invites">{state.invites.map(invite => <li key={invite.id}><span>{roleNames[invite.role]} · Válido até {when(invite.expiresAt)}</span><button className="text-button" disabled={pending} onClick={() => void run(async () => { await api(`workspaces/${workspace.id}/invites/${invite.id}`, { method: 'DELETE' }); setInviteCode(''); setNotice('Convite revogado.'); refresh(); })}>Revogar convite</button></li>)}</ul>}
        </>}
      </section>
      <section className="governance-section"><h2>Histórico de mudanças</h2><p>Até 50 eventos recentes deste espaço. Horários no fuso do seu navegador.</p>{state.audit.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Quando</th><th scope="col">Pessoa</th><th scope="col">Ação</th></tr></thead><tbody>{state.audit.map(entry => <tr key={entry.id}><td>{when(entry.createdAt)}</td><td>{entry.actorName}</td><td>{actionNames[entry.action] || entry.action}</td></tr>)}</tbody></table></div> : <p>Nenhuma mudança registrada neste espaço ainda.</p>}</section>
      {operations && <section className="governance-section"><h2>Estado da operação</h2><p>Banco de dados: <strong>{operations.health.status === 'ok' ? 'Disponível' : 'Indisponível'}</strong></p><dl className="governance-metrics"><div><dt>Requisições na janela</dt><dd>{operations.processWindow.sampledRequests}</dd></div><div><dt>Falhas de servidor</dt><dd>{operations.processWindow.errors}</dd></div><div><dt>95% das respostas em até</dt><dd>{operations.processWindow.p95Ms == null ? 'Sem amostra' : `${operations.processWindow.p95Ms} ms`}</dd></div></dl><p>{operations.notes}</p><div className="table-scroll"><table><thead><tr><th scope="col">Dados do espaço</th><th scope="col">Itens</th><th scope="col">Volume armazenado</th></tr></thead><tbody>{operations.resources.map(resource => <tr key={resource.kind}><th scope="row">{{ source: 'Fontes', report: 'Dashboards', draft: 'Conversas', upload: 'Importações pendentes' }[resource.kind] || resource.kind}</th><td>{resource.count}</td><td>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(resource.bytes / 1024)} KB</td></tr>)}</tbody></table></div><p>Backup e restauração são executados pela equipe de operação no servidor. O procedimento está em OPERACOES.md; nenhum backup é agendado automaticamente.</p></section>}
    </>}
  </>;
}
