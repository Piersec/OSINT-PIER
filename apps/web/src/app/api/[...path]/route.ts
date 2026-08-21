import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '@osint-pier/api/app';

type InjectMethod =
  'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let appPromise: ReturnType<typeof createApp> | undefined;

async function resolveChecksDirectory(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'apps/api/dist/checks'),
    path.resolve(process.cwd(), '../api/dist/checks'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // The Vercel runtime and `next start` use different working directories.
    }
  }
  return candidates[0]!;
}

async function getApp() {
  if (!appPromise) {
    appPromise = createApp({
      logger: false,
      // The API is built before Next on Vercel. Keeping the directory explicit
      // preserves dynamic plugin discovery while allowing new checks to ship
      // without changing this route.
      checksDirectory: await resolveChecksDirectory(),
    });
  }
  return appPromise;
}

async function forward(request: NextRequest): Promise<NextResponse> {
  const app = await getApp();
  const url = new URL(request.url);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const payload = hasBody ? await request.text() : undefined;
  const response = await app.inject({
    method: request.method as InjectMethod,
    url: `${url.pathname}${url.search}`,
    headers: Object.fromEntries(request.headers.entries()),
    payload,
  });

  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (value === undefined || name.toLowerCase() === 'content-length')
      continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }

  return new NextResponse(response.body || null, {
    status: response.statusCode,
    headers,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
