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
    // Keep both workspace-relative forms: Vercel may evaluate these globs
    // from the monorepo root, while local `next build` resolves them from
    // apps/web. The dynamic plugin loader needs the complete compiled API,
    // including apps/api/dist/core and not only each plugin entrypoint.
    '/*': [
      './apps/api/dist/**/*',
      '../api/dist/**/*',
      './apps/api/package.json',
      '../api/package.json',
      './.data/**/*',
      '../.data/**/*',
    ],
  },
};

export default nextConfig;
