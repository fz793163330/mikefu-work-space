# SEO/AEO 最新观点手工摘要（2026-07-16 09:30 CST）

> 说明：本文件为本次 Codex 运行时的手工核查摘要。现有 GitHub Actions 自动任务仍按每天 09:00（Asia/Shanghai）运行；本地 Windows 备份任务今天因缺少 GitHub Models token 未生成 AI 深度报告。

## 新发现文章概览

### Search Engine Journal - SEO

1. [How Google May ‘Understand’ Unique Content](https://www.searchenginejournal.com/how-google-may-understand-unique-content/581959/)
   - 核心：文章围绕 Google “information gain” 专利与原创性/努力度信号，强调长内容不等于有价值，真正的差异来自比同主题既有内容提供新的、可帮助用户完成目标的信息。
   - 方法论：做内容前先列出 SERP 已回答的共性答案，再明确本页新增的独家数据、经验、对比、流程或判断；避免只靠更长篇幅和语义词堆叠。

2. [Google Says No SEO Penalty For Year-Long A/B Tests?](https://www.searchenginejournal.com/google-says-no-seo-penalty-for-year-long-a-b-tests/582349/)
   - 核心：John Mueller 表示长期 A/B 测试本身未必导致 penalty/demotion，但频繁变化会让被索引版本不确定、调试和监控更困难；这与 Google 官方“过长测试可能被视为欺骗”的指南存在语境差异。
   - 方法论：A/B 测试必须用 canonical、302、避免 cloaking；大改版/长期 holdout 要记录 Googlebot 可见版本，并尽量让核心内容与结构稳定。

### Search Engine Land - SEO

1. [EU expected to rule Google favored its own services in search](https://searchengineland.com/eu-rule-google-favored-own-services-search-482495)
   - 核心：欧盟可能要求 Google 调整购物、旅行等自有垂直服务在搜索结果中的展示方式，可能影响高商业意图 query 的可见性分配。
   - 方法论：购物/旅行/本地比较类网站应预先建立“监管变更监控表”，追踪 SERP 模块、Google 自有卡片、竞品聚合位变化。

2. [Google is AI Mode’s No. 2 most-cited domain: Report](https://searchengineland.com/ai-mode-cites-google-report-482463)
   - 核心：Profound 追踪显示 AI Mode 中 google.com 引用量约两个月增长 8.4 倍，Google Business Profiles 和 Product Knowledge Panels 在本地/购物查询中变得更重要。
   - 方法论：把 GBP、商品知识面板、Merchant/产品数据当成 AEO 第一落点维护；先修正营业时间、照片、评价、规格、兼容性和价格等 AI 答案前置资料。

3. [Where AI agents get stuck on your site](https://searchengineland.com/stuck-ai-agents-482344)
   - 核心：B2B 站点中 pricing/features 是 AI agent 最容易转向第三方来源的环节，原因包括信息不透明、机器不可读、访问摩擦。
   - 方法论：为 agent 优化定价页：真实价格或价格逻辑放在 canonical URL；价格与权益用可抓取 HTML；补充 Product/Offer schema；允许主流 AI crawler；避免 JS-only、截图、PDF、复杂计算器。

4. [Why the SEO vs. PPC debate is finally over](https://searchengineland.com/seo-vs-ppc-debate-finally-over-482366)
   - 核心：AI Overview 和零点击搜索使 SEO/PPC 不再是互斥渠道；点击不再是唯一价值单位，AI citation 和品牌影响成为共同目标。
   - 方法论：预算评估从“SEO 还是 PPC”改为“同一 query/主题下，AI citation、自然结果、广告、本地/社交触点如何协同影响转化”。

5. [Your next customer may discover your brand on TikTok before Google](https://searchengineland.com/customer-discover-brand-tiktok-before-google-482388)
   - 核心：用户越来越先在 TikTok/Instagram 被推荐系统种草，再到 Google 验证；SEO 要把推荐平台视作搜索需求的前置触点。
   - 方法论：本地和消费品牌应把短视频脚本中的地点、服务、评论互动、字幕和画面文字纳入语义资产；在 Google 侧准备对应的品牌/地点验证页。

## 今日可执行沉淀

1. **Information Gain 内容审稿表**：每篇文章发布前回答“相比当前 SERP Top 10，本页新增了什么事实/经验/工具/数据/判断？”没有新增贡献则合并、更新或不发。
2. **Agent 可读性检查**：关键商业页（价格、产品、对比、门店）必须具备可抓取 HTML、结构化数据、轻量 DOM、明确 canonical、低拦截策略。
3. **AI Mode 资料源维护**：把 GBP、产品知识面板、Merchant feed、评价和图片当成 AI 答案素材库，而不是只优化官网页面。
4. **搜索全域衡量**：按主题建立 Google/AI/社媒/本地/PPC 统一看板，指标包含 citation、品牌搜索增量、GBP 行为、SERP 像素可见性、付费 CTR 和最终线索质量。
5. **测试治理**：长期 A/B 测试需要 SEO guardrail：canonical/302/不 cloaking/核心内容稳定/Googlebot 可见版本记录/测试结束后及时收敛。

## 运行状态提醒

- 已存在云端 GitHub Actions 定时任务：每天 01:00 UTC = 09:00 Asia/Shanghai。
- 已存在本地 Windows Scheduled Task：Codex SEO AEO Daily Digest，下次运行 2026-07-17 09:00:00。
- 今日本地备份任务失败原因：缺少 GITHUB_TOKEN 或 GITHUB_MODELS_TOKEN，因此未标记文章为已处理，避免生成低质量模板报告。
