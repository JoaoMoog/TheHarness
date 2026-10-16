import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function ErrorMessage({ message, retry, retryLabel = 'Tentar novamente' }: { message: string; retry?: () => void; retryLabel?: string }) {
  return <div className="error-message" role="alert"><AlertCircle size={18} /><div><p>{message}</p>{retry && <button type="button" className="text-button" onClick={retry}>{retryLabel} <ArrowRight size={14} /></button>}</div></div>;
}
export function Busy({ children }: { children: ReactNode }) {
  return <span className="busy" role="status"><LoaderCircle size={16} className="spin" />{children}</span>;
}
export function PageHeading({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="heading-actions">{actions}</div>}</header>;
}
export function Steps({ active }: { active: number }) {
  return <ol className="steps" aria-label="Etapas para criar um dashboard">{['Trazer dados', 'Fazer o pedido', 'Conferir e salvar'].map((label, i) => <li key={label} aria-current={active === i ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>;
}
