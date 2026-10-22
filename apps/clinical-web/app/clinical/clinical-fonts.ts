// Identidade Clinical (mockups marca-nova-v3h): títulos Bricolage Grotesque 800, corpo Manrope. OFL 1.1 (fonts/LICENSE-OFL.txt),
// empacotadas via next/font/local (sem CDN). Escopo: só o Clinical (.cv-app); o design system canônico segue com DM Sans.
import localFont from 'next/font/local';
export const bricolage = localFont({ src: './fonts/BricolageGrotesque-Variable.ttf', variable: '--cv-font-title', weight: '200 800', display: 'swap', fallback: ['system-ui', 'sans-serif'] });
export const manrope = localFont({ src: './fonts/Manrope-Variable.ttf', variable: '--cv-font-body', weight: '200 800', display: 'swap', fallback: ['system-ui', 'sans-serif'] });
