import type { Metadata } from 'next';
import '../care/care-mobile.css';
import './cadastro.css';
export const dynamic = 'force-dynamic';
// O token está no caminho: nunca enviar como Referer nem indexar.
export const metadata: Metadata = { title: 'ONCOPHARMA Care', referrer: 'no-referrer', robots: { index: false, follow: false } };
export default function CadastroLayout({ children }: { children: React.ReactNode }) { return children; }
