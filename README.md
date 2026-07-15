# SEO/AEO 自动学习工作区

该仓库每天检查 SEO 行业资讯，通过 GitHub Models 进行中文筛选与深度解读，并生成可沉淀为 SEO/AEO SOP 的 Markdown 日报。

## 定时任务

- GitHub Actions：每天北京时间 09:00（UTC 01:00）
- 工作流：`.github/workflows/seo-aeo-digest.yml`
- 支持在 Actions 页面手动运行
- 本地 Windows 任务仍可作为备用，但需要设置 `GITHUB_MODELS_TOKEN` 或 `GITHUB_TOKEN`

## 输出

- 日报：`reports/`
- 去重状态：`seo_automation_state.json`
- 生成规范：`SEO_REPORT_SPEC.md`

新版报告结构为：今日概览、今日必读、中文深度解读、文章独有方法论、低价值快讯、抓取状态。

## 数据源与抓取策略

- Search Engine Journal：SEO 分类 RSS 发现文章，详情页正文分析。
- Search Engine Land：官方 RSS 的 SEO 分类，直接使用 Feed 完整正文；源站 403 时自动通过 RSS2JSON 只读代理获取同一公开 Feed。
- Moz Blog：官方 RSS 发现文章；Feed 403 时使用 RSS2JSON 兜底，详情页被阻断时使用摘要并降低内容质量等级。
- Search Engine Roundtable：官方 RSS 发现文章，排除 Daily Recap；低相关搜索新闻由 AI 降级或过滤。

正文优先读取 Article/NewsArticle/BlogPosting 的 `articleBody`，其次读取语义化 `<article>`，不再抓取整页 H2/H3，因此不会把导航、广告和推荐内容输出为“文章结构重点”。

## AI 生成

GitHub Actions 使用仓库自带的 `GITHUB_TOKEN` 调用 GitHub Models，无需额外创建 OpenAI API Key：

- 默认模型：`openai/gpt-4.1`
- 工作流权限：`models: read`
- 可通过环境变量 `SEO_AI_MODEL` 更换模型
- 本地运行时需要提供 `GITHUB_MODELS_TOKEN` 或 `GITHUB_TOKEN`

模型先对所有新增文章进行价值分类，最多选择 3 篇深度解读；低价值新闻进入快讯，无关或重复内容直接过滤。模型失败时不会退回旧版关键词模板，也不会把文章写入已处理状态。

## 本地验证

```powershell
npm test
npm run check
$env:GITHUB_MODELS_TOKEN = '<GitHub token>'
node .\seo_automation.mjs
```

## 钉钉推送

仓库 Secret `DINGTALK_WEBHOOK` 用于发送纯文本摘要。推送内容只包含中文“今日必读”标题与完整 GitHub 报告地址。

## 安全

不要把 GitHub Token 或钉钉 Webhook 写入代码、报告或提交记录。
