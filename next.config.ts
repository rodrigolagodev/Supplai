import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

// Enables access to Cloudflare bindings (env, etc.) when running `next dev`.
initOpenNextCloudflareForDev();

// NOTE: We build with Turbopack (the Next 16 default), which is the configuration
// OpenNext supports for Next 16. The PWA plugin (@serwist/next) was removed because it
// requires a webpack build, and that build broke Server Action resolution on OpenNext.
// Offline data is handled by IndexedDB (Dexie); a static service worker can be added later.
export default nextConfig;
