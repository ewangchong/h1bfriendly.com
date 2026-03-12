#!/usr/bin/env bash
set -euo pipefail

MODE_RAW="${SMOKE_MODE:-${MODE:-local}}"
MODE="$(printf '%s' "${MODE_RAW}" | tr '[:upper:]' '[:lower:]')"

case "${MODE}" in
  local)
    SITE_URL="${SITE_URL:-http://localhost:3000}"
    CURL_MAX_TIME="${CURL_MAX_TIME:-20}"
    BASE_CURL=(curl --silent --show-error --max-time "${CURL_MAX_TIME}")
    ;;
  prod)
    SITE_URL="${SITE_URL:-https://h1bfinder.com}"
    HOST_NAME="${HOST_NAME:-h1bfinder.com}"
    RESOLVE_IP="${RESOLVE_IP:-127.0.0.1}"
    CURL_MAX_TIME="${CURL_MAX_TIME:-20}"
    BASE_CURL=(curl --silent --show-error --insecure --max-time "${CURL_MAX_TIME}" --resolve "${HOST_NAME}:443:${RESOLVE_IP}")
    ;;
  *)
    echo "::error title=Deploy Test Plan Failed::Unsupported MODE/SMOKE_MODE '${MODE_RAW}'. Use local or prod."
    exit 1
    ;;
 esac

DESKTOP_UA="${DESKTOP_UA:-Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36}"
MOBILE_UA="${MOBILE_UA:-Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1}"

ERROR_PATTERNS=(
  "API Connection Error. Verify H1B_API_BASE_URL."
  "API 500 for http://backend:8089"
  "Application error"
  "Internal Server Error"
  "Unhandled Runtime Error"
  "__NEXT_ERROR__"
)

fail() {
  echo "::error title=Deploy Test Plan Failed::$1"
  exit 1
}

fetch_body() {
  local url="$1"
  local user_agent="$2"
  "${BASE_CURL[@]}" -A "${user_agent}" "${url}"
}

check_http_200() {
  local label="$1"
  local url="$2"
  local code
  code="$("${BASE_CURL[@]}" --output /dev/null --write-out "%{http_code}" "${url}")"
  echo "[HTTP] ${label}: ${code}"
  [[ "${code}" == "200" ]] || fail "${label} returned HTTP ${code}"
}

check_page_content() {
  local label="$1"
  local url="$2"
  local user_agent="$3"
  local expected_text="$4"
  local body
  body="$(fetch_body "${url}" "${user_agent}")"
  echo "[PAGE] ${label}: fetched ${#body} chars"

  for pattern in "${ERROR_PATTERNS[@]}"; do
    if grep -Fq "${pattern}" <<<"${body}"; then
      fail "${label} shows error pattern: ${pattern}"
    fi
  done

  if [[ -n "${expected_text}" ]] && ! grep -Fq "${expected_text}" <<<"${body}"; then
    fail "${label} missing expected text: ${expected_text}"
  fi
}

check_api_json_success() {
  local label="$1"
  local path="$2"
  local body
  body="$("${BASE_CURL[@]}" "${SITE_URL}${path}")"
  echo "[API] ${label}: fetched ${#body} chars"
  grep -q '"success":true' <<<"${body}" || fail "${label} did not return success=true"
}

run_filter_matrix() {
  echo "== ${MODE} smoke: desktop filter matrix =="
  check_page_content "VA 2025" "${SITE_URL}/?year=2025&state=VA" "${DESKTOP_UA}" "Test the Database"
  check_page_content "VA 2024" "${SITE_URL}/?year=2024&state=VA" "${DESKTOP_UA}" "Test the Database"
  check_page_content "VA empty year" "${SITE_URL}/?year=&state=VA" "${DESKTOP_UA}" "Test the Database"
  check_page_content "CA no year" "${SITE_URL}/?state=CA" "${DESKTOP_UA}" "Test the Database"
  check_page_content "Year 2023" "${SITE_URL}/?year=2023" "${DESKTOP_UA}" "Test the Database"
}

run_page_health() {
  echo "== ${MODE} smoke: key page health =="
  check_http_200 "Home" "${SITE_URL}/"
  check_http_200 "Companies" "${SITE_URL}/companies"
  check_http_200 "Titles" "${SITE_URL}/titles"
  check_http_200 "Plan" "${SITE_URL}/plan"
  check_http_200 "Chat" "${SITE_URL}/chat"
  check_http_200 "Blog" "${SITE_URL}/blog"
  check_http_200 "Legal ToS" "${SITE_URL}/legal/tos.md"
  check_http_200 "Legal Privacy" "${SITE_URL}/legal/privacy.md"
}

run_desktop_content_smoke() {
  echo "== ${MODE} smoke: full-path content smoke =="
  check_page_content "Home" "${SITE_URL}/" "${DESKTOP_UA}" "Verified H1B Intelligence"
  check_page_content "Companies" "${SITE_URL}/companies" "${DESKTOP_UA}" "Top Sponsors"
  check_page_content "Titles" "${SITE_URL}/titles" "${DESKTOP_UA}" "Top Jobs"
  check_page_content "Plan" "${SITE_URL}/plan" "${DESKTOP_UA}" "Generate a data-backed roadmap"
  check_page_content "Chat" "${SITE_URL}/chat" "${DESKTOP_UA}" "H1B Intelligence Chat"
  check_page_content "Blog" "${SITE_URL}/blog" "${DESKTOP_UA}" "H1B Insights & Guides"
}

run_mobile_content_smoke() {
  echo "== ${MODE} smoke: mobile smoke =="
  check_page_content "Mobile home" "${SITE_URL}/" "${MOBILE_UA}" "nav-mobile"
  check_page_content "Mobile companies" "${SITE_URL}/companies" "${MOBILE_UA}" "Top Sponsors"
  check_page_content "Mobile titles" "${SITE_URL}/titles" "${MOBILE_UA}" "Top Jobs"
  check_page_content "Mobile plan" "${SITE_URL}/plan" "${MOBILE_UA}" "Generate a data-backed roadmap"
  check_page_content "Mobile chat" "${SITE_URL}/chat" "${MOBILE_UA}" "H1B Intelligence Chat"
  check_page_content "Mobile blog" "${SITE_URL}/blog" "${MOBILE_UA}" "H1B Insights & Guides"
}

run_api_smoke() {
  echo "== ${MODE} smoke: API smoke =="
  check_api_json_success "Meta years" "/api/v1/meta/years"
  check_api_json_success "Rankings" "/api/v1/rankings?year=2025&limit=10"
  check_api_json_success "Summary VA" "/api/v1/rankings/summary?year=2025&state=VA"
  check_api_json_success "Titles" "/api/v1/titles?year=2025&limit=50"
}

echo "Smoke mode: ${MODE}"
echo "Smoke target: ${SITE_URL}"
if [[ "${MODE}" == "prod" ]]; then
  echo "Prod resolve target: ${HOST_NAME}:443 -> ${RESOLVE_IP}"
fi

run_filter_matrix
run_page_health
run_desktop_content_smoke
run_mobile_content_smoke
run_api_smoke

echo "${MODE} smoke passed ✅"
