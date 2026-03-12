# Deploy Test Plan (dual-mode smoke for h1bfinder)

每次部署后自动执行，目标是防止“筛选器切换导致 API 500 / 整页报错”再次发生，并把本地联调与生产部署后的冒烟路径彻底分开：

- `local mode`：默认模式，命中 `http://localhost:3000`
- `prod mode`：生产模式，命中 `https://h1bfinder.com`

核心原则：**本地测试不再走 prod 的 TLS / `--resolve` 路径。**

## Modes

### Local mode（默认）
- 默认 `SITE_URL=http://localhost:3000`
- 不使用 `--insecure`
- 不使用 `--resolve`
- 适合本地 `next dev` / 本地容器联调

### Prod mode
- 默认 `SITE_URL=https://h1bfinder.com`
- 保留：
  - `--insecure`
  - `--resolve h1bfinder.com:443:${RESOLVE_IP}`
- 适合部署后在目标主机上做生产域名验证

## Scope

### 1) 首页筛选回归（重点）
- `/?year=2025&state=VA`
- `/?year=2024&state=VA`
- `/?year=&state=VA`（空 year 容错）
- `/?state=CA`
- `/?year=2023`

验证项：
- 页面不出现已知错误模式：
  - `API Connection Error. Verify H1B_API_BASE_URL.`
  - `API 500 for http://backend:8089`
  - `Application error`
  - `Internal Server Error`
  - `Unhandled Runtime Error`
  - `__NEXT_ERROR__`
- 首页数据试用模块仍可渲染：`Test the Database`

### 2) 关键页面健康检查
- `/`
- `/companies`
- `/titles`
- `/plan`
- `/chat`
- `/blog`
- `/legal/tos.md`
- `/legal/privacy.md`

验证项：
- HTTP 200

### 3) 全路径内容冒烟（桌面）
- `/` → `Verified H1B Intelligence`
- `/companies` → `Top Sponsors`
- `/titles` → `Top Jobs`
- `/plan` → `Generate a data-backed roadmap`
- `/chat` → `H1B Intelligence Chat`
- `/blog` → `H1B Insights & Guides`

验证项：
- 页面不出现已知错误模式
- 页面仍渲染核心业务文案，而不是空白 / 错页 / 通用异常页

### 4) 移动端冒烟（Mobile UA）
- `/` → `nav-mobile`
- `/companies` → `Top Sponsors`
- `/titles` → `Top Jobs`
- `/plan` → `Generate a data-backed roadmap`
- `/chat` → `H1B Intelligence Chat`
- `/blog` → `H1B Insights & Guides`

验证项：
- 使用 Mobile Safari UA 抓取
- 页面不出现已知错误模式
- 首页确认移动导航结构存在，其余关键页确认核心业务文案仍在

### 5) API 冒烟
- `/api/v1/meta/years`
- `/api/v1/rankings?year=2025&limit=10`
- `/api/v1/rankings/summary?year=2025&state=VA`
- `/api/v1/titles?year=2025&limit=50`

验证项：
- JSON 中包含 `"success":true`

## CI Integration

执行脚本：
- `scripts/deploy-test-plan.sh`

Deploy workflow 已明确使用 `prod mode`：

```bash
SMOKE_MODE=prod ./scripts/deploy-test-plan.sh
```

这样生产验证继续保留域名 / TLS / resolve 逻辑，而本地默认不会误用该路径。

## Manual Run

### 本地联调（默认就是 local）

```bash
./scripts/deploy-test-plan.sh
```

或显式写法：

```bash
SMOKE_MODE=local ./scripts/deploy-test-plan.sh
```

如果本地不是 3000 端口：

```bash
SMOKE_MODE=local SITE_URL=http://localhost:3001 ./scripts/deploy-test-plan.sh
```

### 生产验证

```bash
SMOKE_MODE=prod \
SITE_URL=https://h1bfinder.com \
HOST_NAME=h1bfinder.com \
RESOLVE_IP=127.0.0.1 \
./scripts/deploy-test-plan.sh
```

## Supported Environment Variables

通用：
- `SMOKE_MODE` / `MODE`：`local` 或 `prod`
- `SITE_URL`
- `DESKTOP_UA`
- `MOBILE_UA`
- `CURL_MAX_TIME`

仅 prod mode 使用：
- `HOST_NAME`
- `RESOLVE_IP`

## Acceptance Notes

本次双模式收口后：
- local mode 默认覆盖：首页、Top Sponsors、Top Jobs、My Plan、AI Chat、Blog
- prod mode 继续支持 `https://h1bfinder.com`
- 本地测试不会再误走生产的 TLS / `--resolve` 链路
