#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${SITE_URL:-https://h1bfinder.com}"
HOST_NAME="${HOST_NAME:-h1bfinder.com}"
RESOLVE_IP="${RESOLVE_IP:-127.0.0.1}"

BASE_CURL=(curl --silent --show-error --insecure --resolve "${HOST_NAME}:443:${RESOLVE_IP}")

fail() {
  echo "::error title=Deploy Test Plan Failed::$1"
  exit 1
}

check_http_200() {
  local label="$1"
  local url="$2"
  local code
  code="$(${BASE_CURL[@]} --output /dev/null --write-out "%{http_code}" "${url}")"
  echo "[HTTP] ${label}: ${code}"
  [[ "${code}" == "200" ]] || fail "${label} returned HTTP ${code}"
}

check_no_api_500() {
  local label="$1"
  local url="$2"
  local body
  body="$(${BASE_CURL[@]} "${url}")"
  echo "[PAGE] ${label}: fetched ${#body} chars"
  if grep -q "API Connection Error. Verify H1B_API_BASE_URL." <<<"${body}"; then
    fail "${label} shows API Connection Error"
  fi
  if grep -q "API 500 for http://backend:8089" <<<"${body}"; then
    fail "${label} shows backend API 500"
  fi
}

check_api_json_success() {
  local label="$1"
  local path="$2"
  local body
  body="$(${BASE_CURL[@]} "${SITE_URL}${path}")"
  echo "[API] ${label}: fetched ${#body} chars"
  grep -q '"success":true' <<<"${body}" || fail "${label} did not return success=true"
}

echo "== Deploy Test Plan: UI filter matrix =="
check_no_api_500 "VA 2025" "${SITE_URL}/?year=2025&state=VA"
check_no_api_500 "VA 2024" "${SITE_URL}/?year=2024&state=VA"
check_no_api_500 "VA empty year" "${SITE_URL}/?year=&state=VA"
check_no_api_500 "CA no year" "${SITE_URL}/?state=CA"
check_no_api_500 "Year 2023" "${SITE_URL}/?year=2023"

echo "== Deploy Test Plan: key page health =="
check_http_200 "Home" "${SITE_URL}/"
check_http_200 "Companies" "${SITE_URL}/companies"
check_http_200 "Titles" "${SITE_URL}/titles"
check_http_200 "Plan" "${SITE_URL}/plan"
check_http_200 "Chat" "${SITE_URL}/chat"
check_http_200 "Legal ToS" "${SITE_URL}/legal/tos.md"
check_http_200 "Legal Privacy" "${SITE_URL}/legal/privacy.md"

echo "== Deploy Test Plan: API smoke =="
check_api_json_success "Meta years" "/api/v1/meta/years"
check_api_json_success "Rankings" "/api/v1/rankings?year=2025&limit=10"
check_api_json_success "Summary VA" "/api/v1/rankings/summary?year=2025&state=VA"
check_api_json_success "Titles" "/api/v1/titles?year=2025&limit=50"

echo "Deploy test plan passed ✅"
