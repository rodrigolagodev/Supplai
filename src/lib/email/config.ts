import { Resend } from 'resend';

/**
 * Verified sender address for outbound email.
 *
 * MUST be set (via the EMAIL_FROM env var) to an address on a domain verified in
 * Resend for emails to be delivered in production. The fallback is Resend's sandbox
 * sender, which ONLY delivers to the Resend account owner's own email — never use it
 * in production.
 *
 * Format: "Display Name <address@your-verified-domain.com>"
 */
export const EMAIL_FROM = process.env.EMAIL_FROM || 'Supplai <onboarding@resend.dev>';

/**
 * Lazily-created Resend client. Created on first use rather than at module load so
 * the API key is read at request time (required on the Workers runtime, where env
 * vars are not available during module import).
 */
let cachedResend: Resend | null = null;

export function getResend(): Resend {
  if (!cachedResend) {
    cachedResend = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedResend;
}
