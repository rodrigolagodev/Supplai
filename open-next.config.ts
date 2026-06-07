import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Default configuration: no incremental/ISR cache backend (this app is dynamic,
// auth-gated, and renders per-request), so no KV/R2/Durable Objects are required.
// See https://opennext.js.org/cloudflare/caching to enable caching later.
export default defineCloudflareConfig();
