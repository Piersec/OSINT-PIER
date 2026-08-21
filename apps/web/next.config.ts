import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@osint-pier/contracts'],
  // The API adapter lives in a sibling workspace. Keep the monorepo root in
  // the trace so Vercel copies the compiled Fastify app and every plugin into
  // the serverless function instead of relying on a workspace symlink that is
  // not guaranteed to exist in the deployment bundle.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  outputFileTracingIncludes: {
    '/*': ['./apps/api/dist/**/*', './apps/api/package.json', './.data/**/*'],
  },
};

export default nextConfig;
