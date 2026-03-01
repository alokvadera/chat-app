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
3. Set `VITE_ZEGO_APP_ID`
4. Set server-only `ZEGO_APP_ID` (same numeric value)
5. Set server-only `ZEGO_SERVER_SECRET`
3. Redeploy with cache cleared when changing env vars

## ZEGO secret safety (Vercel)
Do NOT store ZEGO server secret in any `VITE_*` variable.

Use:
1. `VITE_ZEGO_APP_ID` for frontend
2. `ZEGO_APP_ID` + `ZEGO_SERVER_SECRET` for Vercel serverless function (`/api/zego-token`)

The frontend now requests call tokens from `/api/zego-token`.

## Render deployment (connected repository)
This repo now includes [`render.yaml`](./render.yaml) for one-click setup on Render.

### What Render will use
1. Build command: `npm ci && npm run build`
2. Publish directory: `dist`
3. SPA rewrite: all routes (`/*`) -> `/index.html`

### Steps
1. In Render, click **New +** -> **Blueprint**.
2. Select this GitHub repository.
3. Confirm service from `render.yaml` and deploy.

### Required environment variables (Render service)
1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_ANON_KEY`

After adding/changing env vars, trigger a **Manual Deploy**.

### Important for Supabase auth
In Supabase dashboard -> **Authentication -> URL Configuration**:
1. Set `Site URL` to your Render production URL
2. Add redirect URLs for:
   - your Render production URL
   - local: `http://localhost:5173`
   - any preview URL you use

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
