# Chat App (Vite + React + Supabase)

## Local setup
1. Install dependencies:
   - `npm ci`
2. Create `.env` with:
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<anon-key>`
3. Run:
   - `npm run dev`

## Vercel deployment
This repo includes [`vercel.json`](./vercel.json) with:
1. Vite build config
2. Output folder `dist`
3. SPA rewrites for React Router

In Vercel project settings:
1. Set `VITE_SUPABASE_URL`
2. Set `VITE_SUPABASE_ANON_KEY`
3. Redeploy with cache cleared when changing env vars

## Supabase auth checklist
In Supabase project settings:
1. `Authentication -> URL Configuration`
2. Set `Site URL` to your production domain
3. Add redirect URLs:
   - production domain
   - vercel preview domain
   - `http://localhost:5173`

## If login/signup times out
If browser shows `ERR_CONNECTION_TIMED_OUT` for:
- `https://<project-ref>.supabase.co/auth/v1/*`

Then this is network/endpoint reachability, not app logic.

Validate quickly:
1. Open `https://<project-ref>.supabase.co/auth/v1/health` in browser
2. If timeout persists:
   - check VPN/proxy/firewall/DNS
   - test another network (hotspot)
   - verify project ref and URL in env vars
