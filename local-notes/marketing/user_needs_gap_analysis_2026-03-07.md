# H1B Finder 用户需求缺口分析（2026-03-07）

> 用途：说明国际学生 / H1B 求职用户首次打开产品时的认知落差，以及最优先补的产品-营销缺口。适合作为首页、chat、plan 页和推荐系统的策略依据。

## 1. 用户首次访问会想什么

- 这份数据是否可信、是否足够新？
- 这能不能帮我现在做决定，还是只是一个 dashboard？
- 哪些公司 / 岗位适合我？
- 我看完后下一步具体该做什么？

## 2. 当前主要缺口

### Gap A：数据可看，但不够个性化
当前：以 aggregate rankings 和 trend data 为主。  
缺失：profile-aware recommendations。

用户需要：
- 输入 major / role preference / location / experience
- 输出 personalized target company/title list

### Gap B：有 insight，但缺行动路径
当前：用户能探索数字。  
缺失：系统没有明确告诉用户下一步做什么。

用户需要：
- Prioritized application list
- Weekly application plan
- Suggested role/title targeting strategy

### Gap C：有体量指标，但缺风险质量指标
当前：能看到 filings / approvals / salary。  
缺失：稳定性与风险信号。

用户需要：
- Sponsor stability score
- Trend volatility warning
- “High volume but unstable” signal

### Gap D：有 broad title categories，但缺实操粒度
当前：title 存在，但 practical decision guidance 偏弱。  
缺失：role-level conversion hints。

用户需要：
- 区分 SWE / ML / Data / PM 等子方向
- 更好的 title normalization 和 role grouping

### Gap E：有历史数据，但缺当前求职周期策略
当前：展示 historic trend。  
缺失：current-cycle strategy。

用户需要：
- When to apply guidance
- Seasonality hints
- Timing recommendation by role/company type

### Gap F：更像信息产品，不像结果导向工具
当前：更像 analytics product。  
缺失：outcome-driving tools。

用户需要：
- Resume keyword guidance
- JD match helper
- Interview prep direction linked to target sponsors

## 3. 根问题

当前产品给人的感觉：
- “H1B analytics dashboard”

而目标用户真正期待的是：
- “Give me my best path to an H1B-offer outcome”

## 4. 两周内可做的 MVP 修补项

### Priority 1（必须）
- Homepage 增加 “Personalized Plan” 入口
- 输入表单：major + target role + target city + years experience
- 输出卡片：
  - Top 20 target sponsors
  - Recommended titles
  - Weekly action checklist

### Priority 2
- 增加 sponsor stability score + volatility badge
- 在每个图表下加 CTA：`Generate my action plan`

### Priority 3
- 增加 explainable recommendation panel
  - Why this company/title is recommended
  - Which data-backed factors were used

## 5. 成功指标

- % users starting personalized flow
- % users who export/save plan
- % users returning within 7 days
- % chat sessions ending with actionable click

## 6. 工作假设

如果 H1B Finder 从“数据探索”转向“个性化行动规划”，转化和留存应会提升，因为用户能更快把数据变成实际求职动作。
