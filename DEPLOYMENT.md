# Deployment Guide — Cloudflare Workers (OpenNext)

Supplai is deployed to **Cloudflare Workers** via the [OpenNext](https://opennext.js.org/cloudflare)
adapter, under the domain **`supplai.rlago.com`**. Supabase (auth, DB, storage) and Resend (email)
are unchanged by the hosting platform. Everything below runs on **Workers free** ($0/mo).

> All steps marked **[you]** require your accounts/credentials and are done once.

---

## 0. Rotate the leaked Supabase service key (do this first) **[you]**

A previous commit (`2ac407f`) committed the Supabase `service_role` key in a DB trigger
(now removed). Treat it as compromised:

1. Supabase Dashboard → **Settings → API → service_role** → **Reset / Roll**.
2. Use the new key only as a Worker secret (step 3) — never in the repo.

---

## 1. Apply the database migrations **[you]**

```bash
supabase db push   # or apply supabase/migrations/* via the dashboard
```

New migrations in this change:

- `20260607000001_drop_email_queue_trigger.sql` — removes the `pg_net` trigger + leaked key.
- `20260607000002_create_claim_pending_jobs.sql` — atomic job claiming (no duplicate emails).
- `20260607000003_fix_jobs_rls.sql` — removes the contradictory `WITH CHECK (true)` policy.

---

## 2. Verify a sending domain in Resend **[you]**

Supplier emails will NOT deliver from the `resend.dev` sandbox in production.

1. Resend → **Domains** → add `rlago.com` (or `mail.rlago.com`).
2. Add the DKIM / SPF / (DMARC) records Resend shows you into **Cloudflare DNS** (DNS-only / grey cloud).
3. Set `EMAIL_FROM` (step 3) to an address on that domain, e.g. `Supplai <orders@rlago.com>`.

---

## 3. Create the Worker & set secrets **[you]**

```bash
pnpm install
wrangler login

# Secrets (never committed):
wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # the NEW rotated key
wrangler secret put GROQ_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM                  # e.g. Supplai <orders@rlago.com>
wrangler secret put CRON_SECRET                 # openssl rand -base64 32
```

Public build-time vars (set in **Workers Builds → Build variables**; they must exist at build time):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL=https://supplai.rlago.com
```

---

## 4. Build & deploy

```bash
pnpm preview   # builds + runs in the workerd runtime locally — VALIDATE HERE FIRST
pnpm deploy    # builds + deploys to Cloudflare
```

`pnpm preview` is the most important local check: it runs the real `workerd` runtime, so it catches
runtime-only issues (env access, the PWA service worker, streaming) that `next dev` does not.

The build uses webpack (`next build --webpack`) because the PWA plugin (`@serwist/next`) requires it;
OpenNext invokes the `build` script, so this is automatic.

---

## 5. Custom domain **[you]**

Cloudflare Dashboard → your Worker → **Settings → Domains & Routes → Add Custom Domain** →
`supplai.rlago.com`. Cloudflare creates the DNS record automatically.

---

## 6. Supabase Auth redirect URLs **[you]**

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://supplai.rlago.com`
- **Redirect URLs**:
  ```
  https://supplai.rlago.com/auth/callback
  https://supplai.rlago.com/auth/confirm
  http://localhost:3000/auth/callback
  http://localhost:3000/auth/confirm
  ```

---

## Background job processing (email queue)

- **Happy path:** when an order is submitted, emails are sent **inline** in the submit server action
  (`SubmitOrderUseCase`) — instant, no DB trigger.
- **Fallback:** a **Cloudflare Cron Trigger** (`*/3 * * * *`, in `wrangler.jsonc`) runs `scheduled()`
  in `worker.ts`, which calls the internal `/api/cron/process-jobs` route to retry any jobs left
  pending (rate limits / transient failures).
- Jobs are claimed atomically (`claim_pending_jobs` RPC) and sends are idempotent, so the inline path
  and the cron can never produce a duplicate supplier email.

Trigger processing manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://supplai.rlago.com/api/cron/process-jobs
```

---

## Troubleshooting

- **Emails not delivered:** the Resend domain isn't verified, or `EMAIL_FROM` isn't on the verified
  domain. Check Resend → Emails for the failure reason.
- **Auth link points to localhost / "access denied":** `NEXT_PUBLIC_SITE_URL` or the Supabase redirect
  URLs are wrong. They must match `https://supplai.rlago.com` exactly.
- **500 on first request after deploy:** usually a missing secret — confirm all `wrangler secret put`
  values are set.
- **PWA not installing / stale content:** re-validate with `pnpm preview`; the SW is emitted to
  `public/sw.js` by serwist at build time and disabled in development.
