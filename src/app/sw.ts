/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkOnly, NetworkFirst } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never cache dynamic Next.js traffic: API routes, Supabase, server actions (POST)
    // and RSC payloads. Caching these causes version skew — a stale cached page/bundle
    // calls server-action IDs the new deployment no longer has (404).
    {
      matcher: ({ url, request }) =>
        request.method !== 'GET' ||
        url.pathname.startsWith('/api/') ||
        url.hostname.endsWith('.supabase.co') ||
        url.searchParams.has('_rsc'),
      handler: new NetworkOnly(),
    },
    // Page navigations: always try the network first so the served HTML references the
    // current JS chunks; fall back to the offline page only when truly offline.
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 10 }),
    },
    // Static, content-hashed assets (JS/CSS/fonts/images): serwist's tuned defaults.
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline.html',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
