#!/usr/bin/env bash

set -euo pipefail

SITE_URL="${SITE_URL:-https://h1bfriend.com}"
HOST_NAME="${HOST_NAME:-h1bfriend.com}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8089/health}"
YEARS_URL="${YEARS_URL:-${SITE_URL}/api/v1/meta/years}"
CURL_RETRIES="${CURL_RETRIES:-20}"
CURL_RETRY_DELAY="${CURL_RETRY_DELAY:-2}"
TOP_TITLE_COUNT="${TOP_TITLE_COUNT:-3}"
TOP_COMPANY_COUNT="${TOP_COMPANY_COUNT:-2}"

json_get() {
  local expression="$1"
  python3 -c "import json,sys; data=json.load(sys.stdin); result=${expression}; print(result if result is not None else '')"
}

curl_base() {
  curl --fail --silent --show-error \
    --retry "${CURL_RETRIES}" \
    --retry-delay "${CURL_RETRY_DELAY}" \
    --retry-all-errors \
    --insecure \
    --resolve "${HOST_NAME}:443:127.0.0.1" \
    "$@"
}

curl_json() {
  local url="$1"
  curl_base "${url}"
}

warm_url() {
  local label="$1"
  local url="$2"

  echo "warming ${label}"
  curl_base \
    --output /dev/null \
    --write-out "  code=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
    "${url}"
}

join_lines() {
  python3 -c "import json,sys; data=json.load(sys.stdin); values=${1}; print('\n'.join(v for v in values if v))"
}

echo "checking backend health"
curl --fail --silent --show-error \
  --retry "${CURL_RETRIES}" \
  --retry-delay "${CURL_RETRY_DELAY}" \
  --retry-all-errors \
  "${BACKEND_HEALTH_URL}" >/dev/null

echo "loading available years"
years_json="$(curl_json "${YEARS_URL}")"
year="$(printf '%s' "${years_json}" | json_get "data['data'][0]")"
echo "using year ${year}"

companies_json="$(curl_json "${SITE_URL}/api/v1/companies?year=${year}&page=0&size=24")"
titles_json="$(curl_json "${SITE_URL}/api/v1/titles?year=${year}&limit=120")"

company_slug_lines="$(printf '%s' "${companies_json}" | join_lines "[(item.get('slug') or '') for item in data['data']['content'][:${TOP_COMPANY_COUNT}]]")"
title_slug_lines="$(printf '%s' "${titles_json}" | join_lines "[(item.get('slug') or '') for item in data['data'][:${TOP_TITLE_COUNT}]]")"

company_slugs=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && company_slugs+=("${line}")
done <<< "${company_slug_lines}"

title_slugs=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && title_slugs+=("${line}")
done <<< "${title_slug_lines}"

if [[ "${#title_slugs[@]}" -eq 0 ]]; then
  title_slugs=("software-engineer")
fi

echo "top titles: ${title_slugs[*]}"
echo "top companies: ${company_slugs[*]:-none}"

warm_url "meta years" "${SITE_URL}/api/v1/meta/years"
warm_url "companies list" "${SITE_URL}/api/v1/companies?year=${year}&page=0&size=24"
warm_url "titles list" "${SITE_URL}/api/v1/titles?year=${year}&limit=120"
warm_url "rankings" "${SITE_URL}/api/v1/rankings?year=${year}&limit=10"
warm_url "rankings summary" "${SITE_URL}/api/v1/rankings/summary?year=${year}"
warm_url "home page" "${SITE_URL}/?year=${year}"
warm_url "companies page" "${SITE_URL}/companies?year=${year}"
warm_url "titles page" "${SITE_URL}/titles?year=${year}"

for title_slug in "${title_slugs[@]}"; do
  warm_url "title summary ${title_slug}" "${SITE_URL}/api/v1/titles/${title_slug}/summary?year=${year}"
  warm_url "title page ${title_slug}" "${SITE_URL}/titles/${title_slug}?year=${year}"
done

for company_slug in "${company_slugs[@]}"; do
  [[ -z "${company_slug}" ]] && continue
  warm_url "company detail ${company_slug}" "${SITE_URL}/api/v1/companies/slug/${company_slug}"
  warm_url "company insights ${company_slug}" "${SITE_URL}/api/v1/companies/slug/${company_slug}/insights?year=${year}"
  warm_url "company page ${company_slug}" "${SITE_URL}/companies/${company_slug}?year=${year}"
done

echo "cache warmup complete"
