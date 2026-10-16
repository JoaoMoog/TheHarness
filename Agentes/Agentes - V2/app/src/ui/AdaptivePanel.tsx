'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Keep children mounted: hiding a conversation must never discard its state. */
export function AdaptivePanel({ open, close, children, title, id, modal = false, className = '' }: {
  open: boolean; close: () => void; children: ReactNode; title: string; id: string;
  modal?: boolean; className?: string;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = panel.current!;
    const media = window.matchMedia('(max-width: 1023px)');
    let restoreOverflow: (() => void) | undefined;
    function sync() {
      restoreOverflow?.(); restoreOverflow = undefined;
      const active = document.activeElement;
      const restoreFocus = active instanceof HTMLElement && dialog.contains(active) ? active : null;
      if (dialog.open) dialog.close();
      if (!open) return;
      if (modal || media.matches) {
        dialog.showModal();
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        restoreOverflow = () => { document.body.style.overflow = previous; };
      } else dialog.show();
      restoreFocus?.focus({ preventScroll: true });
    }
    sync(); media.addEventListener('change', sync);
    return () => { media.removeEventListener('change', sync); restoreOverflow?.(); if (dialog.open) dialog.close(); };
  }, [open, modal]);
  return <dialog ref={panel} id={id} className={`adaptive-panel ${className}`} aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); close(); }}
    onKeyDown={event => {
      if (event.defaultPrevented) return;
      const dialog = event.currentTarget;
      if (event.key === 'Escape' && !dialog.matches(':modal')) { event.preventDefault(); close(); }
      if (event.key !== 'Tab' || !dialog.matches(':modal')) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(node => node.getClientRects().length > 0 && !node.closest('[inert], [aria-hidden="true"]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } }}>
    <div className="panel-heading"><h2 id={`${id}-title`}>{title}</h2><button className="icon-button" aria-label={`Fechar ${title.toLowerCase()}`} onClick={close}><X size={20} /></button></div>
    {children}
  </dialog>;
}
