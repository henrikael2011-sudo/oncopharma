import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ONCOPHARMA Care', description: 'Acompanhamento do tratamento oncológico para paciente e cuidador. Um passo de cada vez. Juntos no cuidado.', applicationName: 'ONCOPHARMA Care' };
// themeColor: token aprovado (Plano v3 §2.2).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#063f3b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><a className="skip" href="#conteudo">Pular para o conteúdo</a>{children}</body></html>;
}
