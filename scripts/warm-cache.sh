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

build_query() {
  local year="$1"
  local sort_by="${2:-}"
  local limit="${3:-}"
  local params=("year=${year}")

  if [[ -n "${sort_by}" && "${sort_by}" != "approvals" ]]; then
    params+=("sortBy=${sort_by}")
  fi

  if [[ -n "${limit}" ]]; then
    params+=("limit=${limit}")
  fi

  local IFS='&'
  printf '%s' "${params[*]}"
}

build_companies_query() {
  local year="$1"
  local sort_by="${2:-filed}"
  local sort_direction="${3:-DESC}"
  local page="${4:-0}"
  local size="${5:-24}"
  local params=("year=${year}" "page=${page}" "size=${size}")

  if [[ -n "${sort_by}" && "${sort_by}" != "filed" ]]; then
    params+=("sortBy=${sort_by}")
  fi

  if [[ -n "${sort_direction}" && ! ( "${sort_by}" == "filed" && "${sort_direction}" == "DESC" ) ]]; then
    params+=("sortDirection=${sort_direction}")
  fi

  local IFS='&'
  printf '%s' "${params[*]}"
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
year_lines="$(printf '%s' "${years_json}" | join_lines "[str(item) for item in data['data']]")"
echo "using year ${year}"

years=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && years+=("${line}")
done <<< "${year_lines}"

if [[ "${#years[@]}" -eq 0 ]]; then
  years=("${year}")
fi

echo "available years: ${years[*]}"

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
warm_url "jobs page" "${SITE_URL}/jobs"

for warm_year in "${years[@]}"; do
  default_qs="$(build_query "${warm_year}" "" "10")"
  salary_qs="$(build_query "${warm_year}" "salary" "10")"
  default_top100_qs="$(build_query "${warm_year}" "" "100")"
  salary_top100_qs="$(build_query "${warm_year}" "salary" "100")"
  companies_default_qs="$(build_companies_query "${warm_year}" "filed" "DESC" "0" "24")"
  companies_name_qs="$(build_companies_query "${warm_year}" "name" "ASC" "0" "24")"

  warm_url "rankings api FY${warm_year} approvals top10" "${SITE_URL}/api/v1/rankings?${default_qs}"
  warm_url "rankings api FY${warm_year} salary top10" "${SITE_URL}/api/v1/rankings?${salary_qs}"
  warm_url "rankings summary FY${warm_year}" "${SITE_URL}/api/v1/rankings/summary?year=${warm_year}"
  warm_url "home page FY${warm_year} approvals top10" "${SITE_URL}/?${default_qs}"
  warm_url "home page FY${warm_year} salary top10" "${SITE_URL}/?${salary_qs}"
  warm_url "home page FY${warm_year} approvals top100" "${SITE_URL}/?${default_top100_qs}"
  warm_url "home page FY${warm_year} salary top100" "${SITE_URL}/?${salary_top100_qs}"
  warm_url "companies api FY${warm_year} default" "${SITE_URL}/api/v1/companies?${companies_default_qs}"
  warm_url "companies api FY${warm_year} name" "${SITE_URL}/api/v1/companies?${companies_name_qs}"
  warm_url "companies page FY${warm_year} default" "${SITE_URL}/companies?${companies_default_qs}"
  warm_url "companies page FY${warm_year} name" "${SITE_URL}/companies?${companies_name_qs}"
  warm_url "titles api FY${warm_year}" "${SITE_URL}/api/v1/titles?year=${warm_year}&limit=120"
  warm_url "titles page FY${warm_year}" "${SITE_URL}/titles?year=${warm_year}"
  warm_url "jobs page FY${warm_year}" "${SITE_URL}/jobs?year=${warm_year}"
done

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
