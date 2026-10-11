import type { MetadataRoute } from 'next';
// M15.1: manifest por app (D-001 PWA). Service worker seguro fica para o M15.6.
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'ONCOPHARMA Admin', short_name: 'Admin', description: 'Governança institucional do ONCOPHARMA.', start_url: '/', display: 'standalone', lang: 'pt-BR', background_color: '#0a344a', theme_color: '#0a344a', icons: [{ src: '/brand/mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}
