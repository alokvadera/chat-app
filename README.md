# Chat App (Vite + React + Supabase)

## Local setup
1. Install dependencies:
   - `npm ci`
2. Create `.env` with:
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<anon-key>`
   - `VITE_ZEGO_APP_ID=<zego-app-id>`
   - `VITE_ZEGO_TOKEN_ENDPOINT=https://<api-id>.execute-api.<region>.amazonaws.com/prod/zego-token`
3. Run:
   - `npm run dev`

## AWS deployment automation
This repo includes:
1. `scripts/deploy-frontend.sh` for S3 + CloudFront frontend deploys
2. `scripts/deploy-lambda.sh` for the ZEGO token Lambda deploy
3. `.github/workflows/deploy.yml` for automated deploys on push to `main`

### Required AWS resources
1. S3 bucket for the Vite `dist/` output
2. CloudFront distribution in front of that bucket
3. Lambda function for `zego-token`
4. API Gateway route connected to that Lambda

### Required environment variables for local deploy
1. `AWS_REGION`
2. `S3_BUCKET_NAME`
3. `CLOUDFRONT_DISTRIBUTION_ID`
4. `LAMBDA_FUNCTION_NAME`
5. `VITE_SUPABASE_URL`
6. `VITE_SUPABASE_ANON_KEY`
7. `VITE_ZEGO_APP_ID`
8. `VITE_ZEGO_TOKEN_ENDPOINT`
9. `ZEGO_APP_ID`
10. `ZEGO_SERVER_SECRET`
11. `CORS_ALLOW_ORIGIN` optional, recommended to set to your frontend domain

### Manual deploy commands
1. Deploy Lambda:
   - `npm run deploy:lambda`
2. Deploy frontend:
   - `npm run deploy:frontend`

### GitHub Actions secrets
1. `AWS_ACCESS_KEY_ID`
2. `AWS_SECRET_ACCESS_KEY`
3. `AWS_REGION`
4. `S3_BUCKET_NAME`
5. `CLOUDFRONT_DISTRIBUTION_ID`
6. `LAMBDA_FUNCTION_NAME`
7. `VITE_SUPABASE_URL`
8. `VITE_SUPABASE_ANON_KEY`
9. `VITE_ZEGO_APP_ID`
10. `VITE_ZEGO_TOKEN_ENDPOINT`
11. `ZEGO_APP_ID`
12. `ZEGO_SERVER_SECRET`
13. `CORS_ALLOW_ORIGIN`

### How the automation works
1. `deploy:lambda` zips `lambda/zego-token/index.mjs`, updates Lambda code, then updates Lambda configuration
2. `deploy:frontend` installs dependencies, runs the Vite build, syncs `dist/` to S3, then invalidates CloudFront

## ZEGO secret safety
Do not store `ZEGO_SERVER_SECRET` in any `VITE_*` variable.

Use:
1. `VITE_ZEGO_APP_ID` for the frontend
2. `VITE_ZEGO_TOKEN_ENDPOINT` for the API Gateway endpoint
3. `ZEGO_APP_ID` + `ZEGO_SERVER_SECRET` only in Lambda configuration

## Supabase auth checklist
In Supabase project settings:
1. `Authentication -> URL Configuration`
2. Set `Site URL` to your production domain
3. Add redirect URLs:
   - production domain
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
