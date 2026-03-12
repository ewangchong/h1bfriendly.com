# H1B Finder 营销策略总表（2026-03-12）

> 用途：作为礼部当前唯一主营销执行文档，整合增长目标、首页转化、SEO 内容引擎、landing page backlog、分发节奏与最小埋点要求。

---

## 1. 当前结论

H1B Finder 现阶段营销重点应从“介绍一个 skill”切换为“承接高意图流量并推动行动转化”。

核心方向：
1. **首页升级为增长首页**：先服务普通求职者，再分流到 AI / skill 用户。
2. **SEO 主打高意图长尾**：company / role / state / how-to / salary。
3. **内容引擎优先批量产出 landing pages**，而不是泛博客。
4. **统一 CTA**：导向 `/chat`、`/companies`、`/titles`、`/plan`。
5. **用最小埋点验证转化漏斗**：从访问到提问到深入浏览。

---

## 2. 30 天目标与 KPI

### 目标
- 增加高质量自然流量
- 提高 chat engagement
- 把 chat 使用转化为 rankings / company page / plan 点击

### KPI
- Chat open rate > 15% of homepage visitors
- First question send rate > 40% of chat opens
- Click-through to rankings/company pages > 25% of answered chats
- 7-day return users > 12%

---

## 3. 首页转化策略

### 3.1 首页定位
首页不能只像 OpenClaw skill 安装页，必须同时承接两类用户：
1. 普通求职者：查 sponsor / salary / role trends
2. 高阶用户 / agent 用户：安装 skill，直接在 OpenClaw 调用

### 3.2 推荐 Hero 文案（优先方案）

**H1**
Find H1B Sponsors Faster with Verified Data

**Subcopy**
Search millions of public DOL records to find companies that sponsor H1B visas, compare salary trends, and narrow your job search by role, company, and year.

**Primary CTA**
Explore Sponsor Companies

**Secondary CTA**
Ask AI About My Target Role

**Tertiary Link**
Install the OpenClaw skill →

**Proof Strip**
- 4M+ public DOL records
- Latest fiscal year included
- Company, role, and salary trends in one place

### 3.3 首页结构建议

#### Block 1｜Hero
必须同时出现 3 个动作词：
- find sponsors
- compare salaries
- explore roles

#### Block 2｜Intent-based quick actions
- Find sponsor companies → `/companies`
- Explore top H1B job titles → `/titles`
- Ask AI to compare options → `/chat`

#### Block 3｜Proof / trust
- 4M+ public DOL records
- Latest fiscal year available
- Historical sponsor and salary trends

#### Block 4｜Top modules
- Top H1B Sponsor Companies
- Top H1B Job Titles by Filing Volume

#### Block 5｜Use cases
- I want to know which companies sponsor my role
- I want to compare salary trends across employers
- I want a shortlist of realistic H1B targets

#### Block 6｜AI + Skill 分流
- Web users: search / compare / ask AI
- Power users: install the OpenClaw skill

### 3.4 首页 SEO metadata
- **SEO Title**: Find H1B Sponsors, Salary Trends & Top Companies | H1B Finder
- **Meta Description**: Search verified public DOL records to find H1B sponsors, compare salary trends, explore top job titles, and ask AI for faster job-search insights.
- **Trust note**: Powered by public DOL LCA records. Historical data, not legal advice.

### 3.5 首页 AB Test 优先级
- CTA A/B：Explore Sponsor Companies vs Find H1B Sponsors
- AI CTA A/B：Ask AI About My Role vs Compare Sponsors with AI
- Hero emphasis：verified data vs faster job search

---

## 4. 漏斗与埋点

### 4.1 最小事件集
- `chat_open`
- `first_question_sent`
- `answer_returned`
- `click_to_rankings`
- `click_to_company_page`
- `chat_error`
- `chat_rate_limited`

### 4.2 最小 Dashboard
- Visitors
- Chat opens
- Questions sent
- Answers returned
- Downstream clicks
- Return visitors (7-day)

### 4.3 运营健康
- 每日监控 backend chat error rate
- 监控 Gemini quota failures
- 监控 p95 chat response latency

---

## 5. SEO 总策略

### 5.1 核心判断
主战场不是泛词 `h1b jobs`，而是高意图长尾：
- company
- role
- state
- salary
- compare
- sponsor list

### 5.2 承接方式
- 程序化承接：`/companies/*`、`/titles/*`、`/jobs/*`
- 编辑型承接：`/blog/*`

### 5.3 URL 结构（当前建议）
- 首页：`/`
- 公司索引：`/companies`
- 公司详情：`/companies/[slug]`
- 职位索引：`/titles`
- 职位详情：`/titles/[slug]`
- 内容页：`/blog/[slug]`
- AI 助手：`/chat`
- 求职漏斗页：`/plan`

### 5.4 slug 规范
- role：`top-h1b-sponsors-for-{role-plural}`
- company：`{company-name}-h1b-sponsorship-data`
- state：`h1b-sponsors-in-{state}`
- salary：`h1b-{role}-salary-guide`
- comparison：`{company-a}-vs-{company-b}-h1b-sponsorship`
- how-to：`how-to-{action}`

---

## 6. 内容引擎 MVP

### 6.1 最小可执行方案
**1 个页面模板 × 4 个内容集群 × 1 套生产流程**

统一原则：
- 模板统一
- 选题统一：role / company / state / how-to
- CTA 统一：`/chat`、`/companies`、`/titles`、`/plan`
- 先人工半程序化，后续再交兵部脚本化

### 6.2 统一页面模板（8 段）
1. Hero
2. Quick Answer
3. Top Findings
4. Data Table
5. Interpretation
6. Related Paths
7. FAQ
8. CTA

### 6.3 写作硬要求
- 800-1400 词
- 前 120 词内出现主关键词
- 至少 3 个小标题含语义近义词
- 至少 1 个数据表 / 数据卡片模块
- 至少 4 个站内链接
- 至少 1 个 CTA 指向 `/chat`
- FAQ 3 题
- 不写法律建议，不承诺 sponsor 结果

### 6.4 FAQ 模板库

#### Role 页 FAQ
- Which companies sponsor the most H1B visas for {role}?
- Are large sponsors always better for {role} candidates?
- How should I use H1B sponsor data in my job search?

#### Company 页 FAQ
- Does {company} sponsor H1B visas every year?
- What roles does {company} usually sponsor for H1B?
- Does historical sponsorship mean I should apply there now?

#### State 页 FAQ
- Which state has the strongest H1B demand?
- Are sponsor-heavy states better for every role?
- Should I search by state first or by company first?

#### How-to 页 FAQ
- What is the fastest way to find H1B sponsors?
- How can I tell if a company really sponsors broadly?
- What data matters most when checking H1B sponsorship?

### 6.5 内链规则
每个新 landing page 至少包含：
1. 2 个相关 company pages
2. 2 个相关 title pages
3. `/chat`
4. `/companies` 或 `/titles`

### 6.6 CTA 模板
- Ask AI to compare these sponsors → `/chat`
- Explore all sponsoring companies → `/companies`
- See role-level demand for {Role} → `/titles/{slug}`
- Build your H1B search plan → `/plan`

---

## 7. Landing Page Backlog（整合版）

> 原 CSV 已并入此处，避免继续维护独立散文件。

| Priority | Cluster | URL Slug | Target Keyword | Recommended CTA |
|---|---|---|---|---|
| P0 | role | top-h1b-sponsors-for-data-scientists | h1b sponsors for data scientists | Ask AI to compare these sponsors |
| P0 | role | top-h1b-sponsors-for-product-managers | h1b sponsors for product managers | Build my H1B search shortlist |
| P0 | role | top-h1b-sponsors-for-business-analysts | h1b sponsors for business analysts | See all sponsor companies |
| P1 | role | top-h1b-sponsors-for-devops-engineers | h1b sponsors for devops engineers | Ask AI to compare sponsor patterns |
| P1 | role | top-h1b-sponsors-for-financial-analysts | h1b sponsors for financial analysts | Explore sponsor data |
| P1 | role | top-h1b-sponsors-for-machine-learning-engineers | h1b sponsors for machine learning engineers | Compare salary and sponsor demand |
| P0 | company | amazon-h1b-sponsorship-data | amazon h1b sponsorship | Compare Amazon with another company |
| P0 | company | google-h1b-sponsorship-data | google h1b sponsorship | See Google sponsor history |
| P0 | company | microsoft-h1b-sponsorship-data | microsoft h1b sponsorship | Compare Microsoft with Amazon |
| P0 | company | meta-h1b-sponsorship-data | meta h1b sponsorship | Ask AI whether Meta fits your role |
| P1 | company | apple-h1b-sponsorship-data | apple h1b sponsorship | View Apple sponsor patterns |
| P1 | comparison | amazon-vs-google-h1b-sponsorship | amazon vs google h1b sponsorship | Ask AI to compare your target role |
| P0 | state | best-states-for-h1b-jobs | best states for h1b jobs | See top sponsor companies by state |
| P0 | state | h1b-sponsors-in-california | h1b sponsors in california | Ask AI which California companies fit your role |
| P0 | state | h1b-sponsors-in-texas | h1b sponsors in texas | Explore Texas sponsor rankings |
| P1 | state | h1b-sponsors-in-washington | h1b sponsors in washington | Compare Washington sponsor demand |
| P1 | state | h1b-sponsors-in-new-york | h1b sponsors in new york | Find sponsor-heavy roles in New York |
| P1 | salary | h1b-software-engineer-salary-guide | h1b software engineer salary | See software sponsor companies |
| P1 | salary | h1b-data-scientist-salary-guide | h1b data scientist salary | Compare salary by sponsor |
| P0 | howto | how-to-find-h1b-sponsors | how to find h1b sponsors | Start with the sponsor database |
| P0 | howto | how-to-check-if-a-company-sponsors-h1b | how to know if a company sponsors h1b | Check a real sponsor example |
| P1 | comparison | best-h1b-sponsor-database | best h1b sponsor database | Search sponsor records now |
| P1 | discovery | companies-that-sponsor-h1b-visas | companies that sponsor h1b visas | Explore all sponsoring employers |
| P1 | discovery | top-h1b-sponsors-2025 | top h1b sponsors | View full rankings |

---

## 8. 执行节奏

### 本周优先（P0）
1. top-h1b-sponsors-for-data-scientists
2. top-h1b-sponsors-for-product-managers
3. top-h1b-sponsors-for-business-analysts
4. amazon-h1b-sponsorship-data
5. google-h1b-sponsorship-data
6. microsoft-h1b-sponsorship-data
7. meta-h1b-sponsorship-data
8. best-states-for-h1b-jobs
9. h1b-sponsors-in-california
10. h1b-sponsors-in-texas
11. how-to-find-h1b-sponsors
12. how-to-check-if-a-company-sponsors-h1b

### 第二批（P1）
- devops / financial analyst / machine learning engineer
- salary guides
- washington / new york
- apple / compare / discovery pages

### 建议的 3 天生产节奏

#### Day 1
- top-h1b-sponsors-for-data-scientists
- top-h1b-sponsors-for-product-managers
- amazon-h1b-sponsorship-data
- google-h1b-sponsorship-data

#### Day 2
- microsoft-h1b-sponsorship-data
- meta-h1b-sponsorship-data
- best-states-for-h1b-jobs
- h1b-sponsors-in-california

#### Day 3
- h1b-sponsors-in-texas
- how-to-find-h1b-sponsors
- how-to-check-if-a-company-sponsors-h1b
- top-h1b-sponsors-2025

---

## 9. 分发与社区投放

### 9.1 社区渠道
- Reddit：r/h1b
- Reddit：r/f1visa
- Reddit：r/cscareerquestions
- LinkedIn：feature launch post
- LinkedIn：data insight post
- X：top sponsors + link thread

### 9.2 发帖格式
- 1 screenshot
- 1 key stat
- 1 link
- 1 concrete use case
- 全部加 UTM

---

## 10. 轻量 GTM 与协作需求

### 10.1 Partnerships / GTM
- Identify 10 immigration attorneys/consultants for feedback/demo
- Identify 10 university international student communities
- Offer embeddable “Top Sponsors” widget concept draft

### 10.2 需要兵部最小配合的事项
1. blog post 数据结构允许新增 FAQ / CTA / related links 字段
2. company/title/state 卡片组件可复用到 blog
3. sitemap 自动包含新增 blog pages
4. blog 文章底部统一加 CTA module

---

## 11. 安全与合规提醒

- 不提供法律建议
- 历史 sponsor 数据 ≠ 当前 offer 保证
- 页面统一保留 disclaimer：historical data, not legal advice
- 若保留 chat logs，需要明确 retention policy，并评估 IP / prompt 脱敏

---

## 12. 每周复盘模板
- Traffic: ____
- Chat opens: ____
- Questions sent: ____
- Answer success rate: ____
- CTR to rankings/company: ____
- 7-day return users: ____
- Top channel by quality traffic: ____
- Biggest blocker next week: ____
