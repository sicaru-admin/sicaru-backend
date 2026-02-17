# Launch Checklist — Distribuidora Sicarú

Complete every item before announcing the launch publicly. Items are grouped by category and ordered by priority within each group.

---

## Technical

### Products & Pricing
- [ ] All product data entered in Medusa admin (name, description, variants, SKUs)
- [ ] Product images uploaded (minimum 1 per product, ideally 3+)
- [ ] All prices verified in MXN (check rounding, no missing prices)
- [ ] Product categories and collections assigned correctly
- [ ] Inventory levels set for all variants

### Payments
- [ ] MercadoPago **LIVE** credentials configured (`MERCADOPAGO_SANDBOX=false`)
- [ ] Credit/debit card payment tested with real card
- [ ] OXXO Pay tested with real payment (generate voucher → pay at OXXO → confirm webhook)
- [ ] OXXO voucher generation verified (correct amount, barcode renders)
- [ ] MercadoPago webhook URL set to `https://api.distribuidorasicaru.com/hooks/payment/mercadopago_mercadopago`
- [ ] Webhook signature verification working (`MERCADOPAGO_WEBHOOK_SECRET` set)

### Invoicing
- [ ] FacturAPI production keys active (`FACTURAPI_SANDBOX=false`)
- [ ] Test invoice generated and verified (correct RFC, amounts, CFDI format)
- [ ] Organization tax info configured in FacturAPI dashboard

### Notifications
- [ ] WhatsApp Business API approved by Meta
- [ ] WhatsApp message templates submitted and approved:
  - [ ] Order confirmation template
  - [ ] Shipping notification template
  - [ ] Cart abandonment reminder template
  - [ ] OXXO payment reminder template
- [ ] Test WhatsApp notification sent and received
- [ ] Admin WhatsApp number receiving order alerts (`ADMIN_WHATSAPP_NUMBER`)

### Infrastructure
- [ ] Domain `distribuidorasicaru.com` pointing to Vercel (A record)
- [ ] Domain `www.distribuidorasicaru.com` pointing to Vercel (CNAME)
- [ ] Domain `api.distribuidorasicaru.com` pointing to Railway (CNAME)
- [ ] SSL certificates active on all domains (auto-provisioned by Vercel/Railway)
- [ ] Backend health check passing: `https://api.distribuidorasicaru.com/health` returns 200
- [ ] CORS configured for production domains (not localhost)

### SEO & Discoverability
- [ ] `sitemap.xml` generating correctly at `/sitemap.xml`
- [ ] `robots.txt` allowing crawlers at `/robots.txt`
- [ ] All JSON-LD structured data schemas validating (test at https://validator.schema.org)
- [ ] `llms.txt` accessible at `/llms.txt`
- [ ] Open Graph meta tags rendering correctly (test at https://developers.facebook.com/tools/debug/)
- [ ] Canonical URLs set on all pages

### PWA
- [ ] `manifest.webmanifest` served correctly
- [ ] Service worker (`/sw.js`) registering and caching assets
- [ ] App installable on mobile (test install prompt on Android Chrome and iOS Safari)
- [ ] Offline fallback page renders when network unavailable
- [ ] App icon displays correctly on home screen (192x192 and 512x512)

### Performance
- [ ] Core Web Vitals measured and passing:
  - [ ] LCP (Largest Contentful Paint) < 2.5 seconds
  - [ ] INP (Interaction to Next Paint) < 200 milliseconds
  - [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] Test at: https://pagespeed.web.dev
- [ ] Mobile responsive: tested on iPhone SE (small screen)
- [ ] Mobile responsive: tested on Android budget phone
- [ ] Desktop tested on Chrome, Firefox, Safari

### End-to-End Flows
- [ ] Browse products → add to cart → checkout → pay with card → order confirmation
- [ ] Browse products → add to cart → checkout → pay with OXXO → receive voucher → confirm payment via webhook
- [ ] Order placed → WhatsApp confirmation received by customer
- [ ] Order placed → admin WhatsApp notification received
- [ ] Request invoice → FacturAPI generates CFDI → customer receives PDF
- [ ] Search for product → results appear from MeiliSearch
- [ ] Cart abandoned → WhatsApp reminder sent after 1 hour
- [ ] Customer returns after cart recovery → cart restored

### Automation
- [ ] Cart recovery automation active (cron running every 10 minutes)
- [ ] Loyalty program calculating points correctly on purchases
- [ ] Loyalty tier evaluation running daily
- [ ] OXXO payment reminder job running

### Secrets & Security
- [ ] `JWT_SECRET` is unique, random, 32+ hex characters (not default)
- [ ] `COOKIE_SECRET` is unique, random, 32+ hex characters (not default)
- [ ] `REVALIDATION_SECRET` is set on both backend and storefront
- [ ] No secrets committed to Git (check with `git log --all -p | grep -i "secret\|password\|token"`)
- [ ] `.env` files are in `.gitignore`

---

## Content

### Blog
- [ ] Blog post 1: "Küül vs Voglia: ¿Cuál Línea de Cuidado Capilar Es Mejor Para Ti?" — published
- [ ] Blog post 2: "Cuidado Capilar Profesional en Nuevo León: Guía Completa" — published
- [ ] Blog post 3: "5 Señales de Que Tu Cabello Necesita un Tratamiento de Keratina" — published
- [ ] Blog post 4: "Guía de Precios: Productos Capilares al Mayoreo en México" — published
- [ ] Blog post 5: "Cómo Iniciar Tu Salón de Belleza en Nuevo León: Lo Que Nadie Te Dice" — published

### Pages
- [ ] All brand description pages written and live (Küül, Voglia, Nekane, Hidra Color, Xiomara, Vitale, Montis)
- [ ] All category description pages written and live
- [ ] About page live with store photo and brand story
- [ ] Contact page live with address, phone, WhatsApp link, map
- [ ] Privacy policy live (LFPDPPP compliant — Mexico's data protection law)
- [ ] Terms and conditions live
- [ ] Returns and refund policy live
- [ ] Shipping policy live (same-day Cadereyta, next-day Monterrey metro)

---

## Business & Marketing

### Directory Listings
- [ ] Google Business Profile claimed and **verified** (see DIRECTORIES.md)
- [ ] Foursquare listing claimed and verified
- [ ] Facebook Business Page live and linked
- [ ] Instagram Business Profile live and linked
- [ ] Apple Business Connect claimed
- [ ] Sección Amarilla listing submitted
- [ ] Yelp México listing submitted
- [ ] Bing Places listing submitted
- [ ] OpenStreetMap point added
- [ ] Waze listing submitted
- [ ] **Minimum 10 directory listings active** (from the 20 in DIRECTORIES.md)

### Social Media
- [ ] TikTok Business account created
- [ ] First 3 TikTok/Reels recorded and ready to post
- [ ] Social media handles consistent across all platforms
- [ ] WhatsApp Business profile complete (photo, description, catalog)

### Reviews
- [ ] Review generation plan documented (who to ask, when, how)
- [ ] Google review link shortened and ready to share
- [ ] Plan to ask first 10 customers for reviews

---

## Monitoring

### Error Tracking
- [ ] Sentry DSN configured on Vercel (`NEXT_PUBLIC_SENTRY_DSN`)
- [ ] Sentry auth token configured (`SENTRY_AUTH_TOKEN`)
- [ ] Test error triggers Sentry alert
- [ ] Alert rules configured for error spikes (email and/or Slack)

### Uptime
- [ ] Uptime monitoring configured for `https://distribuidorasicaru.com`
- [ ] Uptime monitoring configured for `https://api.distribuidorasicaru.com/health`
- [ ] Alert notification set (email, WhatsApp, or SMS)
- [ ] Recommended services: [UptimeRobot](https://uptimerobot.com) (free, 5-min intervals) or [Better Stack](https://betterstack.com)

### Analytics
- [ ] Google Search Console verified for `distribuidorasicaru.com`
  - Verify via DNS TXT record or HTML meta tag
  - Submit sitemap: `https://distribuidorasicaru.com/sitemap.xml`
- [ ] Google Analytics 4 installed
  - Add `G-XXXXXXXXXX` measurement ID
  - Configure e-commerce event tracking (view_item, add_to_cart, purchase)
  - Set up conversion goals (purchase, add_to_cart, whatsapp_click)
- [ ] Consider: Microsoft Clarity (free heatmaps and session recordings)

### Backups
- [ ] Supabase daily backups confirmed active (check dashboard)
- [ ] MeiliSearch data can be rebuilt from Medusa (source of truth)
- [ ] Test: can restore from Supabase backup if needed

---

## Launch Day Sequence

Execute in this order on launch day:

1. **Final smoke test** — complete one full checkout flow with real payment
2. **Flip payment to production** — confirm `MERCADOPAGO_SANDBOX=false`
3. **Verify domains** — all three domains resolving with SSL
4. **Announce on WhatsApp** — send to personal contacts and existing customers
5. **Post on social media** — Facebook, Instagram, TikTok (stagger throughout the day)
6. **Update Google Business Profile** — mark as open, add first post
7. **Monitor Sentry** — watch for errors in the first 2 hours
8. **Monitor Railway logs** — check for backend errors or failed jobs
9. **Celebrate** — you launched!

---

## Post-Launch (First 48 Hours)

- [ ] Check Sentry for any errors — fix critical issues immediately
- [ ] Verify all scheduled jobs are running (check Railway logs)
- [ ] Confirm first real customer order flows through completely
- [ ] Respond to any Google Business Profile questions/reviews
- [ ] Post a "we're live" update on all social channels
- [ ] Send cart recovery test — abandon a cart, verify WhatsApp reminder arrives
- [ ] Check Google Search Console for crawl errors
- [ ] Verify MeiliSearch index is complete (all products searchable)
