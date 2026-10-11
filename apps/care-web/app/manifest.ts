import type { MetadataRoute } from 'next';
// M15.1: manifest por app (D-001 PWA). Service worker seguro fica para o M15.6.
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'ONCOPHARMA Care', short_name: 'Care', description: 'Acompanhamento do tratamento oncológico para paciente e cuidador. Um passo de cada vez. Juntos no cuidado.', start_url: '/care', display: 'standalone', lang: 'pt-BR', background_color: '#f5f8f7', theme_color: '#063f3b', icons: [{ src: '/brand/care.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
