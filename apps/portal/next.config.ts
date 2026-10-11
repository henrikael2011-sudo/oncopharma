import type { NextConfig } from 'next';
import path from 'node:path';
// M14.5: raiz do monorepo fixada para o tracing não depender de lockfiles externos ao repositório.
const nextConfig: NextConfig = { poweredByHeader: false, reactStrictMode: true, outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  // M15.1: imagem de contêiner (infra/docker/web.Dockerfile) usa saída standalone.
  ...(process.env.ONCO_STANDALONE === '1' ? { output: 'standalone' as const } : {}) };
export default nextConfig;
