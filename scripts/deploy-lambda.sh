#!/usr/bin/env bash

set -euo pipefail

required_vars=(
  AWS_REGION
  LAMBDA_FUNCTION_NAME
  ZEGO_APP_ID
  ZEGO_SERVER_SECRET
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

tmp_dir="$(mktemp -d)"
zip_path="${tmp_dir}/zego-token.zip"

cleanup() {
  rm -rf "${tmp_dir}"
}

trap cleanup EXIT

cp lambda/zego-token/index.mjs "${tmp_dir}/index.mjs"

(
  cd "${tmp_dir}"
  zip -q "${zip_path}" index.mjs
)

echo "Updating Lambda code for ${LAMBDA_FUNCTION_NAME}"
aws lambda update-function-code \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --zip-file "fileb://${zip_path}" \
  --region "${AWS_REGION}" \
  >/dev/null

echo "Updating Lambda configuration for ${LAMBDA_FUNCTION_NAME}"
environment_payload="Variables={ZEGO_APP_ID=${ZEGO_APP_ID},ZEGO_SERVER_SECRET=${ZEGO_SERVER_SECRET}"
if [[ -n "${CORS_ALLOW_ORIGIN:-}" ]]; then
  environment_payload+=",CORS_ALLOW_ORIGIN=${CORS_ALLOW_ORIGIN}"
fi
environment_payload+="}"

aws lambda update-function-configuration \
  --function-name "${LAMBDA_FUNCTION_NAME}" \
  --runtime "nodejs20.x" \
  --handler "index.handler" \
  --timeout 10 \
  --memory-size 256 \
  --environment "${environment_payload}" \
  --region "${AWS_REGION}" \
  >/dev/null

echo "Lambda deploy complete"
