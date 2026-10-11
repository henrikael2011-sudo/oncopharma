import type { NextConfig } from 'next';
import path from 'node:path';
// M14.5: raiz do monorepo fixada para o tracing não depender de lockfiles externos ao repositório.
const nextConfig: NextConfig = { poweredByHeader: false, reactStrictMode: true, outputFileTracingRoot: path.join(process.cwd(), '..', '..') };
export default nextConfig;
