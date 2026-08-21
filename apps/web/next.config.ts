import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@osint-pier/contracts'],
  serverExternalPackages: ['@osint-pier/api'],
  outputFileTracingIncludes: {
    '/*': ['./apps/api/dist/**/*', './.data/**/*'],
  },
};

export default nextConfig;
