'use client';

import {inputLimits,parseWorkspaceInvite} from '@/core/inputLimits';

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
  'dashboard.invite.created': 'Criou convite para dashboard', 'dashboard.invite.revoked': 'Revogou convite de dashboard',
  'dashboard.member.joined': 'Aceitou acesso a dashboard', 'dashboard.member.revoked': 'Removeu acesso individual a dashboard',
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
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('reader');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    let active = true; setState(null); setInviteCode(''); setError(''); setLoading(workspace.role === 'admin');
    if (workspace.role !== 'admin') return;
    setLoading(true);
    api<GovernanceState>(`workspaces/${workspace.id}`)
      .then(next => { if (active) setState(next); })
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
  return <div className="compact-admin"><PageHeading title="Administração" subtitle="Compartilhe análises com acesso definido e acompanhe as mudanças do espaço." actions={<button className="button secondary" disabled={loading || pending} onClick={refresh}><RefreshCw size={16} />Atualizar</button>} />
    <div className="governance-context"><Users size={20} /><div><strong>{workspace.name}</strong><span>{workspace.personal ? 'Espaço pessoal' : 'Espaço de equipe'} · Seu acesso: {roleNames[workspace.role]}</span></div><Select label="Espaço atual" value={workspace.id} options={workspaces.map(item => ({ value: item.id, label: item.name }))} disabled={pending} onChange={id => void run(() => changed(id))} /></div>
    {notice && <p className="success-notice" role="status">{notice}</p>}{error && <ErrorMessage message={error} retry={refresh} />}
    <div className="governance-entry"><details><summary>Criar um espaço de equipe</summary><p>As fontes e dashboards deste novo espaço ficam separados dos seus dados pessoais.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { const created = await api<Workspace>('workspaces', { body: { name } }); setName(''); await changed(created.id); setNotice('Espaço criado. Convide sua equipe para começar.'); }); }}><label htmlFor="workspace-name">Nome do espaço</label><input id="workspace-name" value={name} maxLength={inputLimits.name} required disabled={pending} onChange={event => setName(event.target.value)} placeholder="Ex.: Planejamento comercial" /><button className="button primary" disabled={pending || !name.trim()}><Plus size={16} />Criar espaço</button></form></details>
      <details><summary>Entrar por convite</summary><p>Peça um código ao administrador. Ele vale por sete dias e só pode ser usado uma vez.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { const joined = await api<Workspace>('workspaces/join', { body: { code: parseWorkspaceInvite(code) } }); setCode(''); await changed(joined.id); setNotice('Você entrou no espaço.'); }); }}><label htmlFor="workspace-code">Código do convite</label><input id="workspace-code" value={code} maxLength={inputLimits.inviteLink} required disabled={pending} autoComplete="off" spellCheck={false} onChange={event => setCode(event.target.value)} /><button className="button secondary" disabled={pending || !code.trim()}>Entrar no espaço</button></form></details></div>
    {loading && <Busy>Carregando equipe…</Busy>}
    {workspace.role !== 'admin' && <div className="empty-state"><h2>Seu acesso está ativo</h2><p>A lista de membros, os convites e a auditoria são gerenciados pelos administradores deste espaço.</p></div>}
    {state && <>
      <section className="governance-section"><h2>Membros e convites</h2>
        <><ul className="governance-members">{state.members.map(member => <MemberRow key={member.actorId} member={member} disabled={pending || member.actorId === workspace.id} change={memberChange} />)}</ul>
          <form className="governance-invite" onSubmit={event => { event.preventDefault(); void run(async () => { const invite = await api<{ code: string }>(`workspaces/${workspace.id}/invites`, { body: { role: inviteRole, email: inviteEmail } }); setInviteCode(location.origin + '/shared?workspaceInvite=' + encodeURIComponent(invite.code)); setNotice('Convite criado. Copie o link antes de sair desta tela.'); const next = await api<GovernanceState>(`workspaces/${workspace.id}`); setState(next); }); }}><label className="field">E-mail do convidado (opcional)<input type="email" maxLength={inputLimits.email} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} disabled={pending}/></label><Select label="Acesso do convidado" value={inviteRole} options={roleOptions} onChange={value => setInviteRole(value as WorkspaceRole)} disabled={pending} /><button className="button primary" disabled={pending}>Criar convite para o espaço</button></form>
          {inviteCode && <div className="governance-code"><label htmlFor="new-invite-code">Compartilhe este link com uma pessoa. Ele não será exibido novamente.</label><input id="new-invite-code" readOnly value={inviteCode} onFocus={event => event.target.select()} /><button className="button secondary" onClick={() => void run(async () => { try { await navigator.clipboard.writeText(inviteCode); setNotice('Link copiado.'); } catch { setError('Não foi possível copiar automaticamente. Selecione o link e copie pelo teclado.'); } })}><Copy size={16} />Copiar link</button><p>Nenhum e-mail ou mensagem será enviado pela CLARA.</p></div>}
          <p className="governance-invite-help">Com e-mail, o convite exige a conta Microsoft correspondente. Sem e-mail, o link pode ser aceito uma vez por qualquer pessoa autenticada.</p><h3>Convites em aberto</h3>{!state.invites.length ? <p>Nenhum convite pendente.</p> : <ul className="governance-invites">{state.invites.map(invite => <li key={invite.id}><span>{invite.email || 'Pessoa com o link'} · {roleNames[invite.role]} · Válido até {when(invite.expiresAt)}</span><button className="text-button" disabled={pending} onClick={() => void run(async () => { await api(`workspaces/${workspace.id}/invites/${invite.id}`, { method: 'DELETE' }); setInviteCode(''); setNotice('Convite revogado.'); refresh(); })}>Revogar convite</button></li>)}</ul>}
        </>
      </section>
      <details className="governance-section"><summary>Histórico de mudanças</summary><p>Até 50 eventos recentes deste espaço. Horários no fuso do seu navegador.</p>{state.audit.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Quando</th><th scope="col">Pessoa</th><th scope="col">Ação</th></tr></thead><tbody>{state.audit.map(entry => <tr key={entry.id}><td>{when(entry.createdAt)}</td><td>{entry.actorName}</td><td>{actionNames[entry.action] || entry.action}</td></tr>)}</tbody></table></div> : <p>Nenhuma mudança registrada neste espaço ainda.</p>}</details>

    </>}
  </div>;
}
