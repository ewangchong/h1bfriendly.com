---
name: h1b-finder
description: H1B employer and salary intelligence based on official h1bfinder.com data (4M+ DOL records, incl. FY2025)｜基于 h1bfinder.com 官方数据的 H1B 雇主与薪资情报工具（400万+ DOL 记录，含 FY2025）
acceptLicenseTerms: true
metadata:
  {
    "openclaw": {
      "requires": { "apis": ["h1bfinder.com"] },
      "recommend": { "agents": ["engineering", "marketing", "legal", "finance"] },
      "version": "1.1.0",
      "author": "h1bfinder.com",
      "homepage": "https://h1bfinder.com"
    }
  }
---

# H1B Finder / H1B 智能检索

## What it is / 这是什么
**H1B Finder** is the official skill from [h1bfinder.com](https://h1bfinder.com) for AI-assisted H1B sponsor research.  
**H1B Finder** 是 [h1bfinder.com](https://h1bfinder.com) 官方技能，用于 AI 驱动的 H1B 雇主与薪资分析。

It grounds answers in **4M+ real DOL disclosure records** (including FY2025 updates), so your agent can produce data-backed insights instead of generic advice.  
它基于 **400万+ 真实 DOL 披露记录**（含 FY2025 更新），让 Agent 给出“有数据依据”的结论，而不是泛泛建议。

## Core capabilities / 核心能力
- Sponsor ranking and filtering by role, city/state, and year  
  按职位、地区、年份筛选雇主并生成赞助商排名
- Salary intelligence (median/top ranges, trend snapshots)  
  薪资情报（中位数/高位区间、趋势快照）
- Approval signal analysis using case status dimensions  
  基于 Case Status 的获批信号分析
- Side-by-side company comparison for practical decision-making  
  企业横向对比，支持真实求职决策

## Example prompts / 示例提问
1. “Find the top 10 NYC companies with the highest starting salary for Product Managers.”  
   “帮我找纽约给 Product Manager 起薪最高的前 10 家公司。”
2. “Compare Amazon vs Google H1B approval signals in Seattle for entry-level software roles.”  
   “对比 Amazon 和 Google 在西雅图针对初级软件岗位的 H1B 获批信号。”
3. “Which Austin companies pay over $150k for Data Scientist and show stable sponsor history?”  
   “奥斯汀哪些公司给 Data Scientist 薪资超过 15 万美元且赞助记录稳定？”
4. “Show me 2025 trend changes for PM salary in California.”  
   “给我看 2025 年加州 PM 薪资趋势变化。”

## Classic use case / 经典用例（实战）
**Prompt / 提问：**  
“Which Austin companies pay Data Scientists over $150k and have stable sponsorship records?”  
“奥斯汀哪些公司给 Data Scientist 薪资超过 15 万美元且赞助记录稳定？”

**Expected output style / 预期输出风格：**
- Top matches: **META PLATFORMS INC**, **IBM CORPORATION**
- Example salary signal: around **$181k–$184k** average in qualified records
- Stability signal: multi-year sponsor activity with consistent high-salary filings
- Actionable next step: shortlist + city/role/year drill-down

> Note: final numbers depend on live query window and filtering dimensions.
> 说明：最终数值会随实时查询时间窗和筛选条件变化。

## Data & API notes / 数据与接口说明
This skill queries H1B Finder’s structured API layer in real time and returns normalized fields for analysis-friendly outputs.  
本技能实时查询 H1B Finder 的结构化 API，并返回标准化字段，便于 AI 做统计、对比与总结。

Typical query dimensions include: `employer`, `job_title`, `city/state`, `fiscal_year`, `case_status`.  
常用查询维度包括：`employer`、`job_title`、`city/state`、`fiscal_year`、`case_status`。

## Setup / 使用方式
Install (registry):  
安装（仓库方式）：

```bash
openclaw skill install h1b-finder
```

If your runtime uses ClawHub CLI directly:  
如果你的环境直接使用 ClawHub CLI：

```bash
npx clawhub install h1b-finder
```

## Security & Privacy / 安全与隐私
- **Not legal advice / 非法律建议**: Outputs are informational and do not constitute immigration legal advice.  
  结果仅供信息参考，不构成移民法律意见。
- **Data source / 数据来源**: Public U.S. Department of Labor disclosure records (with possible release lag).  
  数据来自美国劳工部公开披露文件（可能存在发布时滞）。
- **Privacy / 隐私**: This skill is designed for public labor data analysis and should not be used to process private personal data.  
  本技能用于公开劳工数据分析，不应用于处理个人敏感隐私数据。

## Official links / 官方链接
- Website: https://h1bfinder.com
- Terms: https://h1bfinder.com/legal/tos.md
- Privacy: https://h1bfinder.com/legal/privacy.md
