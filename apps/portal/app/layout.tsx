import type { Metadata, Viewport } from 'next';
import './globals.css';
import { dmSans } from './fonts';
export const metadata: Metadata = { title: 'ONCOPHARMA | Plataforma de cuidado oncológico', description: 'Care e Clinical — interfaces do ecossistema ONCOPHARMA' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#063f3b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={dmSans.variable}><body><a className="skip" href="#conteudo">Pular para o conteúdo</a>{children}</body></html>;
}
