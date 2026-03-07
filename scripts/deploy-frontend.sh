#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  AWS_REGION
  S3_BUCKET_NAME
  CLOUDFRONT_DISTRIBUTION_ID
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
  VITE_ZEGO_APP_ID
  VITE_ZEGO_TOKEN_ENDPOINT
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

echo "Installing dependencies"
npm ci

echo "Building frontend"
npm run build

echo "Uploading dist/ to s3://${S3_BUCKET_NAME}"
aws s3 sync dist/ "s3://${S3_BUCKET_NAME}" --delete --region "${AWS_REGION}"

echo "Invalidating CloudFront distribution ${CLOUDFRONT_DISTRIBUTION_ID}"
aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths "/*"

echo "Frontend deploy complete"
