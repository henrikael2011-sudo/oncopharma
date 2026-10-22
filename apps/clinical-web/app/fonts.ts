// M17 — DM Sans (OFL) empacotada no app via next/font/local: sem CDN em tempo de execução; famílias de reserva preservadas.
import localFont from 'next/font/local';
export const dmSans = localFont({ src: './fonts/DMSans-Variable.ttf', variable: '--font-dm-sans', weight: '100 1000', style: 'normal', display: 'swap', fallback: ['system-ui', 'sans-serif'] });
