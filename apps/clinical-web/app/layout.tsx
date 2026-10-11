import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ONCOPHARMA | Plataforma de cuidado oncológico', description: 'Care e Clinical — interfaces do ecossistema ONCOPHARMA' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#063f3b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><a className="skip" href="#conteudo">Pular para o conteúdo</a>{children}</body></html>;
}
