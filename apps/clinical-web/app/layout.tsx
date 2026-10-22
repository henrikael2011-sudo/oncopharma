import type { Metadata, Viewport } from 'next';
import './globals.css';
import { dmSans } from './fonts';
export const metadata: Metadata = { title: 'ONCOPHARMA Clinical', description: 'Acompanhamento oncológico multiprofissional: alertas, revisão e intervenções rastreáveis.', applicationName: 'ONCOPHARMA Clinical' };
// themeColor: token aprovado (Plano v3 §2.2).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0a344a' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={dmSans.variable}><body><a className="skip" href="#conteudo">Pular para o conteúdo</a>{children}</body></html>;
}
