import type { MetadataRoute } from 'next';
// M15.1: manifest por app (D-001 PWA). Service worker seguro fica para o M15.6.
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'ONCOPHARMA Clinical', short_name: 'Clinical', description: 'Acompanhamento oncológico multiprofissional: alertas, revisão e intervenções rastreáveis.', start_url: '/clinical', display: 'standalone', lang: 'pt-BR', background_color: '#f5f8f7', theme_color: '#0a344a', icons: [{ src: '/brand/clinical.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
