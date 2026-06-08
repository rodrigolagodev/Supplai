import { headers } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Minimal type for the Workers Rate Limiting binding — avoids depending on
// generated worker-configuration.d.ts.
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface AuthEnv {
  AUTH_IP_LIMITER?: RateLimitBinding;
  AUTH_EMAIL_LIMITER?: RateLimitBinding;
}

export interface RateLimitResult {
  allowed: boolean;
  error?: string;
}

/**
 * Enforce per-IP and per-email rate limits on auth actions.
 *
 * Returns `{ allowed: true }` when both limiters accept the request.
 * On dev (no bindings available) the check is a no-op.
 */
export async function checkAuthRateLimit(
  action: 'login' | 'signup' | 'reset',
  email: string
): Promise<RateLimitResult> {
  let env: AuthEnv;
  try {
    env = getCloudflareContext().env as unknown as AuthEnv;
  } catch {
    // Not running in the Workers runtime (e.g. local `next dev`). Skip.
    return { allowed: true };
  }

  const ipLimiter = env.AUTH_IP_LIMITER;
  const emailLimiter = env.AUTH_EMAIL_LIMITER;

  if (!ipLimiter || !emailLimiter) {
    return { allowed: true };
  }

  const h = await headers();
  const ip =
    h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const normalizedEmail = email.trim().toLowerCase();

  const [ipResult, emailResult] = await Promise.all([
    ipLimiter.limit({ key: `${action}:${ip}` }),
    emailLimiter.limit({ key: `${action}:${normalizedEmail}` }),
  ]);

  if (!ipResult.success || !emailResult.success) {
    return {
      allowed: false,
      error: 'Demasiados intentos. Por favor espera un minuto antes de volver a intentarlo.',
    };
  }

  return { allowed: true };
}
