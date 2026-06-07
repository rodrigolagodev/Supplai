/**
 * Minimal structured logger for server-side critical paths (queue, email, cron, AI).
 *
 * Wraps console with a consistent `[context]` prefix so logs are greppable in the
 * Cloudflare Workers Observability dashboard. Kept intentionally tiny — swap the
 * implementation here if a real logging backend is added later.
 */

export function logInfo(context: string, message: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(`[${context}] ${message}`, data);
  } else {
    console.warn(`[${context}] ${message}`);
  }
}

export function logError(context: string, message: string, error?: unknown): void {
  console.error(`[${context}] ${message}`, error ?? '');
}
