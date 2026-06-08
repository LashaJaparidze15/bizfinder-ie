# Deploying bizfinder

Goal: make the API + web public so the mobile app and site work anywhere, with nothing running on
your PC. DB is already hosted (Supabase). ~€0 to start.

## 1. API → Render (free)
1. Create a free account at **render.com** and connect your GitHub.
2. **New + → Blueprint** → pick the `bizfinder-ie` repo. Render reads `render.yaml` and creates the
   `bizfinder-api` service.
3. In the service's **Environment**, set the secret vars (copy values from your local `.env`):
   `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PUBLISHABLE_KEY`.
4. Deploy. You get a public URL like `https://bizfinder-api.onrender.com`.
5. Confirm `https://<your-api>.onrender.com/health` returns `{"status":"ok","db":"ok"}`.

> Free tier sleeps after ~15 min idle → first request after sleep takes ~50s. Fine for now; upgrade
> the plan (or move to a small always-on VPS) before launch.

### Then point the clients at it
- **Mobile app:** set `app.json` → `expo.extra.apiUrl` to the Render URL.
- **Web:** set `API_URL` (server) and `NEXT_PUBLIC_API_URL` (browser) to the Render URL.
- **Stripe webhook (when going live):** add an endpoint in the Stripe dashboard pointing at
  `https://<your-api>.onrender.com/api/billing/webhook` and update `STRIPE_WEBHOOK_SECRET`.

## 2. Web → Vercel (free)
1. Create a free **vercel.com** account, **Add New → Project**, import `bizfinder-ie`.
2. Set **Root Directory** to `web`.
3. Env vars: `API_URL` + `NEXT_PUBLIC_API_URL` = the Render API URL; `SITE_URL` = the Vercel URL.
4. Deploy. Vercel handles SSR + ISR (the SEO pages revalidate automatically).

## 3. Mobile app store builds (later)
Use EAS Build (`npx eas build`) with an Expo account; Apple ($99/yr) + Google Play ($25) accounts
are only needed to publish to the stores.
