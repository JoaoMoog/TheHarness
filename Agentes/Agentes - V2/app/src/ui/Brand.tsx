import { BRAND } from '@/core/brand';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-lockup ${compact ? 'compact' : ''}`}>
    <span className="brand-wordmark">{BRAND.name}<span aria-hidden="true">.</span></span>
    {!compact && <span className="brand-description">Leitura, análise e decisões</span>}
  </span>;
}
