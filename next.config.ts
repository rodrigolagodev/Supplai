import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

// PWA / service worker. Serwist works with the App Router and the Workers runtime
// (unlike next-pwa, which is webpack-only). The SW source lives in src/app/sw.ts and
// is emitted to public/sw.js (served as a static asset by OpenNext).
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Avoid SW caching noise during local development.
  disable: process.env.NODE_ENV === 'development',
});

// Enables access to Cloudflare bindings (env, etc.) when running `next dev`.
initOpenNextCloudflareForDev();

export default withSerwist(nextConfig);
