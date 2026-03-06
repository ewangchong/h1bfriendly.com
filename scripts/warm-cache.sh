#!/usr/bin/env bash

set -euo pipefail

SITE_URL="${SITE_URL:-https://h1bfriend.com}"
HOST_NAME="${HOST_NAME:-h1bfriend.com}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8089/health}"
YEARS_URL="${YEARS_URL:-${SITE_URL}/api/v1/meta/years}"
CURL_RETRIES="${CURL_RETRIES:-20}"
CURL_RETRY_DELAY="${CURL_RETRY_DELAY:-2}"

curl_json() {
  local url="$1"
  curl --fail --silent --show-error \
    --retry "${CURL_RETRIES}" \
    --retry-delay "${CURL_RETRY_DELAY}" \
    --retry-all-errors \
    --insecure \
    --resolve "${HOST_NAME}:443:127.0.0.1" \
    "${url}"
}

warm_url() {
  local url="$1"
  echo "warming ${url}"
  curl --fail --silent --show-error \
    --retry "${CURL_RETRIES}" \
    --retry-delay "${CURL_RETRY_DELAY}" \
    --retry-all-errors \
    --insecure \
    --resolve "${HOST_NAME}:443:127.0.0.1" \
    --output /dev/null \
    "${url}"
}

extract_json() {
  local expression="$1"
  python3 -c "import json,sys; data=json.load(sys.stdin); print(${expression})"
}

echo "checking backend health"
curl --fail --silent --show-error \
  --retry "${CURL_RETRIES}" \
  --retry-delay "${CURL_RETRY_DELAY}" \
  --retry-all-errors \
  "${BACKEND_HEALTH_URL}" >/dev/null

echo "loading available years"
years_json="$(curl_json "${YEARS_URL}")"
year="$(printf '%s' "${years_json}" | extract_json "data['data'][0]")"

echo "using year ${year}"

companies_json="$(curl_json "${SITE_URL}/api/v1/companies?year=${year}&page=0&size=24")"
company_slug="$(printf '%s' "${companies_json}" | extract_json "(data['data']['content'][0].get('slug') or '') if data['data']['content'] else ''")"

title_slug="software-engineer"

warm_url "${SITE_URL}/api/v1/meta/years"
warm_url "${SITE_URL}/api/v1/companies?year=${year}&page=0&size=24"
warm_url "${SITE_URL}/api/v1/titles?year=${year}&limit=120"
warm_url "${SITE_URL}/api/v1/rankings?year=${year}&limit=10"
warm_url "${SITE_URL}/api/v1/rankings/summary?year=${year}"
warm_url "${SITE_URL}/api/v1/titles/${title_slug}/summary?year=${year}"

if [[ -n "${company_slug}" ]]; then
  warm_url "${SITE_URL}/api/v1/companies/slug/${company_slug}"
  warm_url "${SITE_URL}/api/v1/companies/slug/${company_slug}/insights?year=${year}"
fi

warm_url "${SITE_URL}/?year=${year}"
warm_url "${SITE_URL}/companies?year=${year}"
warm_url "${SITE_URL}/titles?year=${year}"
warm_url "${SITE_URL}/titles/${title_slug}?year=${year}"

if [[ -n "${company_slug}" ]]; then
  warm_url "${SITE_URL}/companies/${company_slug}?year=${year}"
fi

echo "cache warmup complete"
