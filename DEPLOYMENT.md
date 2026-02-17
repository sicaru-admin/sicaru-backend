# Deployment Guide — Distribuidora Sicarú

## Architecture Overview

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Vercel (Storefront)        │     │  Railway (Backend)           │
│  Next.js 16 + PWA           │     │  Medusa.js v2                │
│  distribuidorasicaru.com    │────▶│  api.distribuidorasicaru.com │
└─────────────────────────────┘     └───────────┬──────────────────┘
                                                │
                               ┌────────────────┼────────────────┐
                               │                │                │
                    ┌──────────▼──┐  ┌──────────▼──┐  ┌─────────▼────┐
                    │  Supabase   │  │  Upstash     │  │  MeiliSearch  │
                    │  PostgreSQL │  │  Redis       │  │  (Railway)    │
                    └─────────────┘  └─────────────┘  └──────────────┘
```

| Service          | Provider    | Domain / URL                         |
|------------------|-------------|--------------------------------------|
| Storefront       | Vercel      | `distribuidorasicaru.com`            |
| Backend + Admin  | Railway     | `api.distribuidorasicaru.com`        |
| Database         | Supabase    | `db.*.supabase.co:5432`              |
| Cache / Queue    | Upstash     | `*.upstash.io:6379`                  |
| Search           | Railway     | `search-sicaru.up.railway.app`       |
| Payments         | MercadoPago | —                                    |
| Invoicing        | FacturAPI   | —                                    |
| Notifications    | WhatsApp Cloud API | —                             |
| Error Tracking   | Sentry      | —                                    |

---

## Prerequisites

- Node.js 20+, npm 9+
- A [Railway](https://railway.app) account (Hobby or Pro plan)
- A [Vercel](https://vercel.com) account (Hobby or Pro plan)
- A [Supabase](https://supabase.com) project with PostgreSQL
- An [Upstash](https://upstash.com) Redis database
- A [Sentry](https://sentry.io) project (free tier works)
- DNS access for `distribuidorasicaru.com`

---

## 1. Supabase (Database)

1. Create a new Supabase project in the **US East** region.
2. Go to **Settings → Database** and copy the **Connection string (URI)**.
3. The format is: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
4. Save this as `DATABASE_URL`.

> The pooler connection string (`pooler.supabase.com:6543`) can be used for better connection management at scale. Use the direct connection string for migrations.

---

## 2. Upstash (Redis)

1. Create a new Redis database on [Upstash](https://console.upstash.com).
2. Select the **US East 1** region.
3. Copy the **Redis URL** (TLS): `rediss://default:[PASSWORD]@[HOST].upstash.io:6379`
4. Save this as `REDIS_URL`.

---

## 3. MeiliSearch (Railway)

MeiliSearch runs as a separate Railway service. The storefront connects to it directly from the browser for instant search.

1. In your Railway project, click **New Service → Database → MeiliSearch**.
2. Or deploy from Docker image: `getmeili/meilisearch:v1.6`.
3. Set the `MEILI_MASTER_KEY` environment variable (generate with `openssl rand -hex 32`).
4. **Generate a public domain** for the service (e.g., `search-sicaru.up.railway.app`).
5. Create a **search-only API key** using the master key:

```bash
curl -X POST 'https://search-sicaru.up.railway.app/keys' \
  -H 'Authorization: Bearer YOUR_MASTER_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "description": "Storefront search-only key",
    "actions": ["search"],
    "indexes": ["products"],
    "expiresAt": null
  }'
```

6. Save the returned `key` value as `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY` for the storefront.
7. The master key stays on the backend as `MEILISEARCH_API_KEY` for indexing operations.

---

## 4. Backend — Railway

### 4.1 Create the Railway Service

1. In your Railway project, click **New Service → GitHub Repo** and select `sicaru-backend`.
2. Railway will auto-detect the `Dockerfile` and `railway.toml`.
3. The service will build using the multi-stage Dockerfile (deps → builder → runner).

### 4.2 Configure Environment Variables

In the Railway service settings, add all required environment variables:

#### Core

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://postgres:...@...supabase.co:5432/postgres` |
| `REDIS_URL` | Upstash Redis TLS connection string | `rediss://default:...@...upstash.io:6379` |
| `JWT_SECRET` | Auth JWT signing secret (32+ hex chars) | `openssl rand -hex 32` |
| `COOKIE_SECRET` | Session cookie secret (32+ hex chars) | `openssl rand -hex 32` |

#### CORS (Production)

| Variable | Description | Value |
|----------|-------------|-------|
| `STORE_CORS` | Allowed storefront origins | `https://distribuidorasicaru.com,https://www.distribuidorasicaru.com` |
| `ADMIN_CORS` | Allowed admin origins | `https://api.distribuidorasicaru.com` |
| `AUTH_CORS` | Allowed auth origins | `https://distribuidorasicaru.com,https://www.distribuidorasicaru.com,https://api.distribuidorasicaru.com` |

#### Application URLs

| Variable | Description | Value |
|----------|-------------|-------|
| `MEDUSA_BACKEND_URL` | Public backend URL | `https://api.distribuidorasicaru.com` |
| `STORE_URL` | Public storefront URL | `https://distribuidorasicaru.com` |

#### MercadoPago (Payments)

| Variable | Description | Notes |
|----------|-------------|-------|
| `MERCADOPAGO_ACCESS_TOKEN` | MercadoPago API access token | From MP dashboard |
| `MERCADOPAGO_PUBLIC_KEY` | MercadoPago public key | From MP dashboard |
| `MERCADOPAGO_SANDBOX` | Enable sandbox mode | `false` for production |
| `MERCADOPAGO_WEBHOOK_SECRET` | Webhook signature verification | From MP webhook config |

#### FacturAPI (Invoicing)

| Variable | Description | Notes |
|----------|-------------|-------|
| `FACTURAPI_API_KEY` | FacturAPI secret key | From FacturAPI dashboard |
| `FACTURAPI_SANDBOX` | Enable sandbox mode | `false` for production |

#### WhatsApp (Notifications)

| Variable | Description | Notes |
|----------|-------------|-------|
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API permanent token | From Meta Business |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID | From Meta Business |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | Self-generated string |
| `ADMIN_WHATSAPP_NUMBER` | Admin phone for order alerts | `528281234567` |

#### MeiliSearch

| Variable | Description | Notes |
|----------|-------------|-------|
| `MEILISEARCH_HOST` | MeiliSearch internal URL | Use Railway internal networking or public URL |
| `MEILISEARCH_API_KEY` | MeiliSearch master key | Same as `MEILI_MASTER_KEY` on the search service |

### 4.3 Custom Domain

1. In the Railway service settings, go to **Settings → Networking → Public Networking**.
2. Click **Add Custom Domain** and enter `api.distribuidorasicaru.com`.
3. Railway will provide a CNAME record to add to your DNS.

### 4.4 Health Check

The service is configured with a health check at `/health` (Medusa built-in endpoint). Railway will:
- Wait up to 300 seconds for the first health check (allows time for database migrations).
- Restart the service on failure (up to 3 retries).

### 4.5 Deployment

Deployments happen automatically via GitHub Actions on push to `main`:

```
push to main → GitHub Actions → npm ci → medusa build → railway up
```

The workflow requires a `RAILWAY_TOKEN` secret in the GitHub repository settings:
1. Go to Railway → Account Settings → Tokens → Create Token.
2. Add it as `RAILWAY_TOKEN` in GitHub → Repository Settings → Secrets → Actions.

---

## 5. Storefront — Vercel

### 5.1 Import the Project

1. Go to [vercel.com/new](https://vercel.com/new) and import the `sicaru-storefront` repository.
2. Vercel will auto-detect Next.js and use the settings from `vercel.json`.
3. The deployment region is set to `iad1` (US East — Washington, D.C.).

### 5.2 Configure Environment Variables

In the Vercel project settings, add:

| Variable | Description | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Backend API URL | `https://api.distribuidorasicaru.com` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL | `https://distribuidorasicaru.com` |
| `REVALIDATION_SECRET` | ISR webhook secret (32+ hex chars) | `openssl rand -hex 32` |
| `NEXT_PUBLIC_MEILISEARCH_HOST` | MeiliSearch public URL | `https://search-sicaru.up.railway.app` |
| `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY` | MeiliSearch search-only key | From step 3 |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | MercadoPago public key | From MP dashboard |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking | From Sentry project settings |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps | From Sentry → Settings → Auth Tokens |
| `SENTRY_ORG` | Sentry organization slug | `sicaru` |
| `SENTRY_PROJECT` | Sentry project slug | `storefront` |

### 5.3 Custom Domain

1. In Vercel project settings, go to **Domains**.
2. Add `distribuidorasicaru.com` and `www.distribuidorasicaru.com`.
3. Vercel will provide DNS records to add.

### 5.4 Deployment

Vercel auto-deploys on every push to `main` via Git integration. Pull requests get preview deployments with unique URLs.

The CI workflow (`.github/workflows/ci-storefront.yml`) runs lint and type checks on every PR to `main`.

---

## 6. DNS Configuration

Add the following records to your DNS provider for `distribuidorasicaru.com`:

| Type  | Name    | Value                                   | TTL  |
|-------|---------|-----------------------------------------|------|
| A     | `@`     | `76.76.21.21` (Vercel)                  | 3600 |
| CNAME | `www`   | `cname.vercel-dns.com`                  | 3600 |
| CNAME | `api`   | `<railway-provided>.up.railway.app`     | 3600 |

> The exact Vercel A record IP and Railway CNAME will be provided when you add custom domains in each platform. The values above are examples.

SSL certificates are provisioned automatically by both Vercel and Railway.

---

## 7. Sentry (Error Tracking)

### Backend

No Sentry integration on the backend currently. Medusa.js logs errors to stdout, which Railway captures in its log viewer.

### Storefront

Sentry is integrated with three config files:

- `sentry.client.config.ts` — Browser errors, 10% performance traces, session replay (1% normal, 100% on error)
- `sentry.server.config.ts` — SSR/API route errors, 20% performance traces
- `sentry.edge.config.ts` — Edge runtime errors, 20% performance traces

Source maps are uploaded to Sentry during build and deleted from the deployment bundle.

### Setup

1. Create a Sentry project at [sentry.io](https://sentry.io) → Create Project → Next.js.
2. Copy the **DSN** and add it as `NEXT_PUBLIC_SENTRY_DSN` in Vercel.
3. Create an auth token at Settings → Auth Tokens → Create New Token (with `project:releases` and `org:read` scopes).
4. Add it as `SENTRY_AUTH_TOKEN` in Vercel.
5. Set up alerts: go to Alerts → Create Alert Rule for error spikes and performance anomalies.

---

## 8. Scheduled Jobs

The backend includes three scheduled jobs that run automatically:

| Job | Schedule | Description |
|-----|----------|-------------|
| Cart Abandonment Recovery | Every 10 minutes | Sends WhatsApp reminders for carts abandoned 1–24 hours ago |
| Loyalty Tier Evaluation | Daily | Recalculates customer loyalty tiers based on spending |
| OXXO Payment Reminder | Periodic | Reminds customers of pending OXXO cash payments |

These jobs run within the Medusa process — no external cron or scheduler needed.

---

## 9. ISR Revalidation Webhook

The storefront uses Incremental Static Regeneration. To trigger on-demand revalidation when content changes in the backend:

```bash
curl -X POST 'https://distribuidorasicaru.com/api/revalidate' \
  -H 'Content-Type: application/json' \
  -d '{ "secret": "YOUR_REVALIDATION_SECRET", "paths": ["/", "/products"] }'
```

This can be called from Medusa subscribers when products, categories, or collections are updated.

---

## 10. Going Live Checklist

### Secrets & Config

- [ ] `JWT_SECRET` and `COOKIE_SECRET` are unique, random 32+ hex character strings
- [ ] `MERCADOPAGO_SANDBOX=false` (production payments enabled)
- [ ] `FACTURAPI_SANDBOX=false` (production invoicing enabled)
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` is set and matches MercadoPago webhook config
- [ ] `REVALIDATION_SECRET` is set on both backend (for calling) and storefront (for verifying)

### CORS

- [ ] `STORE_CORS` includes `https://distribuidorasicaru.com` and `https://www.distribuidorasicaru.com`
- [ ] `ADMIN_CORS` includes `https://api.distribuidorasicaru.com`
- [ ] `AUTH_CORS` includes all allowed origins

### External Services

- [ ] MercadoPago webhook URL is set to `https://api.distribuidorasicaru.com/hooks/payment/mercadopago_mercadopago`
- [ ] WhatsApp webhook URL is set to `https://api.distribuidorasicaru.com/webhooks/whatsapp`
- [ ] WhatsApp message templates are approved in Meta Business Manager
- [ ] FacturAPI organization and tax info are configured for production

### Data

- [ ] Database migrations have run (`npx medusa db:migrate` — runs automatically on deploy)
- [ ] Admin user is created (`npx medusa user -e admin@sicaru.com -p <password>`)
- [ ] MeiliSearch product index is synced (trigger via admin or API)
- [ ] Seed data is loaded if needed (`npx medusa seed -f ./data/seed.json`)

### Search

- [ ] MeiliSearch search-only API key is generated and set on the storefront
- [ ] MeiliSearch master key is set on both the search service and the backend
- [ ] MeiliSearch has a public Railway domain for client-side access

### DNS & SSL

- [ ] `distribuidorasicaru.com` A record points to Vercel
- [ ] `www.distribuidorasicaru.com` CNAME points to Vercel
- [ ] `api.distribuidorasicaru.com` CNAME points to Railway
- [ ] SSL certificates are active on all domains (auto-provisioned)

### Monitoring

- [ ] Sentry DSN and auth token are configured on Vercel
- [ ] Sentry alert rules are set up for error spikes
- [ ] Railway logs are accessible for backend debugging

### PWA

- [ ] `manifest.webmanifest` is served correctly
- [ ] Service worker (`/sw.js`) registers and caches assets
- [ ] App is installable on mobile devices

### Final Verification

- [ ] Visit `https://distribuidorasicaru.com` — homepage loads
- [ ] Visit `https://api.distribuidorasicaru.com/health` — returns `200 OK`
- [ ] Search works from the storefront
- [ ] Add product to cart and complete a test payment via MercadoPago
- [ ] Verify order confirmation WhatsApp notification is sent
- [ ] Verify admin dashboard is accessible at `https://api.distribuidorasicaru.com/app`

---

## 11. Rollback Procedures

### Backend (Railway)

1. Go to Railway → Deployments.
2. Find the last known-good deployment.
3. Click **Redeploy** to restore it.

If a database migration needs reversal:
```bash
# Connect to Supabase and manually reverse the migration
# Always test rollback migrations in staging first
npx medusa db:rollback
```

### Storefront (Vercel)

1. Go to Vercel → Deployments.
2. Find the last known-good deployment.
3. Click **Promote to Production** to instantly serve that version.

Vercel keeps all previous deployments accessible via unique URLs for testing.

### MeiliSearch

MeiliSearch data is stored in a Railway volume. If the index is corrupted:
1. Delete the MeiliSearch service data volume.
2. Redeploy the MeiliSearch service.
3. Re-trigger product indexing from the backend.

---

## 12. Local Production Testing

Use `docker-compose.production.yml` to test the full stack locally:

```bash
# Start all services
docker compose -f docker-compose.production.yml up --build

# Services available at:
# Backend:     http://localhost:9000
# Admin:       http://localhost:9000/app
# PostgreSQL:  localhost:5432
# Redis:       localhost:6379
# MeiliSearch: http://localhost:7700
```

This uses the same Dockerfile as Railway, ensuring parity between local testing and production.

---

## 13. Backup Strategy

### Database (Supabase)

- Supabase provides automatic daily backups (Pro plan: point-in-time recovery).
- For manual backups: Supabase Dashboard → Database → Backups.
- For pg_dump: use the direct connection string (not the pooler).

### MeiliSearch

- MeiliSearch data is stored in a Railway volume with persistence.
- For manual backup: use the [MeiliSearch dump API](https://www.meilisearch.com/docs/reference/api/dump):

```bash
curl -X POST 'https://search-sicaru.up.railway.app/dumps' \
  -H 'Authorization: Bearer YOUR_MASTER_KEY'
```

### Redis (Upstash)

- Upstash provides automatic persistence and replication.
- Redis is used for cache and job queues — data is ephemeral and rebuilt automatically.

### Source Code

- Both repositories are on GitHub with full version history.
- All deployments are immutable and can be rolled back via Railway/Vercel dashboards.
