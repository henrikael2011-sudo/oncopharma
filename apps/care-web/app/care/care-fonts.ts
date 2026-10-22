// Identidade Care (mockups oficiais 21/10): títulos Bricolage Grotesque 800, corpo Manrope. OFL 1.1 (fonts/LICENSE-OFL.txt),
// empacotadas via next/font/local (sem CDN). Escopo: só o Care (.care-page); o design system canônico segue com DM Sans.
import localFont from 'next/font/local';
export const bricolage = localFont({ src: './fonts/BricolageGrotesque-Variable.ttf', variable: '--cm-font-title', weight: '200 800', display: 'swap', fallback: ['system-ui', 'sans-serif'] });
export const manrope = localFont({ src: './fonts/Manrope-Variable.ttf', variable: '--cm-font-body', weight: '200 800', display: 'swap', fallback: ['system-ui', 'sans-serif'] });
