'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Database, Home, LayoutDashboard, LogOut, Menu, Plus, Settings } from 'lucide-react';
import type { Actor } from '@/core/types';
import { BRAND } from '@/core/brand';
import { Brand } from './Brand';
import { AdaptivePanel } from './AdaptivePanel';

export type View = 'home' | 'create' | 'data' | 'reports' | 'report' | 'settings' | 'team';
const links = [
  { id: 'home', label: 'Visão geral', icon: Home },
  { id: 'reports', label: 'Dashboards', icon: LayoutDashboard },
  { id: 'data', label: 'Seus dados', icon: Database },
] as const;

export function AppHeader({ actor, view, navigate, create, logout, logoutPending, canEdit = true }: {
  actor: Actor; view: View; navigate: (view: View) => void; create: () => void; logout: () => void; logoutPending: boolean; canEdit?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const profile = useRef<HTMLDivElement>(null);
  function closeMobile() { setMobileOpen(false); requestAnimationFrame(() => menuButton.current?.focus()); }
  function go(next: View) { setMobileOpen(false); setProfileOpen(false); navigate(next); }
  function newDashboard() { setMobileOpen(false); setProfileOpen(false); create(); }
  useEffect(() => {
    if (!profileOpen) return;
    function outside(event: PointerEvent) { if (!profile.current?.contains(event.target as Node)) setProfileOpen(false); }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [profileOpen]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const change = () => { if (media.matches) setMobileOpen(false); else setProfileOpen(false); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const navigation = <>{links.map(item => <button key={item.id} className="header-nav-link"
    aria-current={view === item.id || (view === 'report' && item.id === 'reports') ? 'page' : undefined}
    onClick={() => go(item.id)}><item.icon size={17} />{item.label}</button>)}</>;
  return <header className="app-header">
    <button className="brand-home" aria-label={`${BRAND.name}, visão geral`} onClick={() => go('home')}><Brand compact /></button>
    <span className="header-divider" aria-hidden="true" />
    <nav className="desktop-nav" aria-label="Navegação principal">{navigation}</nav>
    <div className="header-actions">
      <span className="environment-status"><span />{actor.demo ? 'Demonstração' : 'Seu espaço'}</span>
      {canEdit && <button className="button primary header-create" onClick={newDashboard}><Plus size={17} />Criar dashboard</button>}
      <div className="account-menu" ref={profile} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProfileOpen(false); }}
        onKeyDown={event => { if (event.key === 'Escape') { setProfileOpen(false); profileButton.current?.focus(); } }}>
        <button ref={profileButton} className="profile-toggle" aria-label="Abrir menu da conta" aria-expanded={profileOpen} aria-controls="account-options" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar">{actor.name.slice(0, 1)}</span><ChevronDown size={14} /></button>
        {profileOpen && <div id="account-options" className="account-options"><strong>{actor.name}</strong><small>{actor.demo ? 'Conta de demonstração' : actor.auth === 'local' ? 'Conta local' : 'Microsoft'}</small><button onClick={() => go('settings')}><Settings size={17} />Integrações</button><button onClick={logout} disabled={logoutPending}><LogOut size={17} />{logoutPending ? 'Saindo…' : 'Sair da conta'}</button></div>}
      </div>
      <button ref={menuButton} className="icon-button header-menu-toggle" aria-label="Abrir navegação" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
    </div>
    <AdaptivePanel open={mobileOpen} close={closeMobile} title="Navegação" id="mobile-navigation" className="mobile-navigation" modal>
      <nav aria-label="Navegação principal">{navigation}{canEdit && <button className="button primary" onClick={newDashboard}><Plus size={17} />Criar dashboard</button>}<button className="header-nav-link" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => go('settings')}><Settings size={17} />Integrações</button></nav>
      <div className="mobile-account"><strong>{actor.name}</strong><small>{actor.demo ? 'Conta de demonstração' : actor.auth === 'local' ? 'Conta local' : 'Microsoft'}</small><button className="text-button" onClick={logout} disabled={logoutPending}><LogOut size={17} />{logoutPending ? 'Saindo…' : 'Sair da conta'}</button></div>
    </AdaptivePanel>
  </header>;
}
