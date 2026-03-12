# H1BFinder Testing & Regression Guide

该文档合并原部署冒烟方案与仍有参考价值的 QA 历史结论，作为 engineering 目录的统一测试入口。

## 1. 目的

用于防止以下问题反复出现：
- 筛选器切换导致 API 500 / 整页报错
- Rankings / Companies / Chat 口径不一致
- 部署后关键页面可访问但内容异常
- 移动端关键路径回归未被发现

原则：**区分本地联调与生产验证，不让本地测试误走生产 TLS / `--resolve` 链路。**

---

## 2. 测试模式

### Local mode（默认）
- 默认 `SITE_URL=http://localhost:3000`
- 不使用 `--insecure`
- 不使用 `--resolve`
- 适合本地 `next dev` / 容器联调

### Prod mode
- 默认 `SITE_URL=https://h1bfinder.com`
- 保留：
  - `--insecure`
  - `--resolve h1bfinder.com:443:${RESOLVE_IP}`
- 适合部署后在目标主机上做生产域名验证

---

## 3. 当前标准冒烟范围

### 3.1 首页筛选回归（重点）
测试路径：
- `/?year=2025&state=VA`
- `/?year=2024&state=VA`
- `/?year=&state=VA`
- `/?state=CA`
- `/?year=2023`

验证项：
- 页面不出现以下错误模式：
  - `API Connection Error. Verify H1B_API_BASE_URL.`
  - `API 500 for http://backend:8089`
  - `Application error`
  - `Internal Server Error`
  - `Unhandled Runtime Error`
  - `__NEXT_ERROR__`
- 首页数据试用模块仍可渲染：`Test the Database`

### 3.2 关键页面健康检查
路径：
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

### 3.3 全路径内容冒烟（桌面）
路径与期望内容：
- `/` → `Verified H1B Intelligence`
- `/companies` → `Top Sponsors`
- `/titles` → `Top Jobs`
- `/plan` → `Generate a data-backed roadmap`
- `/chat` → `H1B Intelligence Chat`
- `/blog` → `H1B Insights & Guides`

验证项：
- 页面不出现已知错误模式
- 页面仍渲染核心业务文案，而不是空白页 / 错页 / 通用异常页

### 3.4 移动端冒烟（Mobile UA）
路径与期望内容：
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

### 3.5 API 冒烟
路径：
- `/api/v1/meta/years`
- `/api/v1/rankings?year=2025&limit=10`
- `/api/v1/rankings/summary?year=2025&state=VA`
- `/api/v1/titles?year=2025&limit=50`

验证项：
- JSON 中包含 `"success":true`

---

## 4. 执行方式

脚本：
- `scripts/deploy-test-plan.sh`

### 本地联调
```bash
./scripts/deploy-test-plan.sh
```

或：
```bash
SMOKE_MODE=local ./scripts/deploy-test-plan.sh
```

若本地端口不是 3000：
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

### 环境变量
通用：
- `SMOKE_MODE` / `MODE`：`local` 或 `prod`
- `SITE_URL`
- `DESKTOP_UA`
- `MOBILE_UA`
- `CURL_MAX_TIME`

仅 prod mode：
- `HOST_NAME`
- `RESOLVE_IP`

---

## 5. 与指标口径文档的关系

涉及以下模块的数据一致性校验时，统一以 `metrics-contract.md` 为准：
- rankings
- companies
- plan output
- chat context

任何跨页面、跨接口、跨聊天回答的数字对比，必须在**同 fiscal year、同 filter set**下进行。

---

## 6. 历史 QA 结论（保留，仍有参考价值）

### 2026-03-07 Production QA
- 环境：`https://h1bfinder.com`
- 覆盖范围：
  - 全局导航与页面路由
  - Companies / Titles / Blog / Chat
  - 首页 chat modal
  - 核心筛选与搜索
  - Chat API 基础连通性
  - `/api/v1/chat/status`
  - `/api/v1/chat`
  - `/api/v1/chat/logs` 鉴权行为

#### 当时已通过
- 站点可访问，导航正常。
- Companies 列表搜索/筛选可用。
- Company detail 页面可加载 title/state/trend 模块。
- Titles 列表与详情页可加载。
- Blog 列表可加载，文章链接存在。
- 首页 chat modal 与 `/chat` 页面都可用。
- Chat API 可以返回答案。
- `/api/v1/chat/logs` 未带 token 返回 `401`，说明鉴权修复已上线。

#### 发现问题

##### BUG-001（高）— Rankings 与 Companies/Chat 数据不一致
现象：
- Rankings FY2025 top approvals 数值明显小于 Companies 与 Chat 返回值。
- 例如 Google / Amazon / Cognizant 在不同产品面上的数字不一致。

影响：
- 核心信任问题，用户会认为同一年份的数据彼此冲突。

可能原因：
- rankings 与 companies/chat 使用了不同 aggregation 语义、字段或派生表。
- FY 标签与累计值口径可能不一致。

建议：
- 优先以 `metrics-contract.md` 收口。
- 增加 Rankings vs Companies vs Chat 同年同口径对齐测试。

##### BUG-002（中）— 年份说明文案过期
现象：
- 多个页面仍写 `FY2020–FY2024`，但 UI 已显示 FY2025。

影响：
- 会造成用户对数据范围的误解。

##### BUG-003（低）— Rankings Sponsor Name 需按 Enter 才生效但无提示
现象：
- 输入 Sponsor Name 后结果不会即时变化，按 Enter 才生效。

影响：
- 用户可能误判为筛选器失效。

##### BUG-004（低）— `/api/health` 路由与预期不一致
现象：
- `GET /api/health` 返回 404。
- 后端健康检查可能实际暴露在 `/health`，而不是 `/api/health`。

影响：
- 若监控或文档默认写 `/api/health`，会产生误报。

---

## 7. 修复优先级

1. 先修 BUG-001：数据口径一致性
2. 再修 BUG-002：年份说明文案
3. 再修 BUG-003：筛选器 UX 提示
4. 最后明确 BUG-004：健康检查路由文档与监控策略

---

## 8. 回归复测清单

- [ ] Rankings / Companies / Chat 在同 year、同 metric basis 下完全对齐
- [ ] 所有 FY range 标签与真实可用年份一致
- [ ] Sponsor Name 筛选行为对用户可感知（即时生效、按钮或提示）
- [ ] Health endpoint 行为已文档化，监控使用正确路径

---

## 9. 收口说明

本目录现在以该文档作为测试总入口：
- 测试流程、运行方式、验证项：看本文件
- 指标定义与跨接口口径：看 `metrics-contract.md`
