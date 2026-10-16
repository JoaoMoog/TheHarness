import type { Metadata } from 'next';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import './globals.css';
import { BRAND } from '@/core/brand';

export const metadata: Metadata = { title: `${BRAND.name} · Análise de negócios`, description: BRAND.description };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="pt-BR"><body>{children}</body></html>; }
