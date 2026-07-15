import fs from 'node:fs';
import path from 'node:path';
import { SHANGHAI_TIMEZONE } from './digest-core.mjs';

export function shanghaiDateParts(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

export function formatShanghaiTime(iso, includeTime = true) {
  if (!iso) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(iso));
}

function markdownCell(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function valueStars(score) {
  const count = Math.max(1, Math.min(5, Math.round(score / 20)));
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

export function renderReport({ reportDir, runAt, modelName, dailyOverview, articles, deepArticles, sourceStatuses }) {
  fs.mkdirSync(reportDir, { recursive: true });
  const runDate = shanghaiDateParts(runAt);
  const todayArticles = articles.filter(article => shanghaiDateParts(article.published) === runDate);
  const backfillArticles = articles.filter(article => shanghaiDateParts(article.published) !== runDate);
  const briefs = articles
    .filter(article => article.priority === 'brief')
    .sort((left, right) => right.relevance_score - left.relevance_score);
  const ignored = articles.filter(article => article.priority === 'ignore');
  const stamp = runAt.replace(/:/g, '-').replace(/\.\d+Z$/, '').replace('T', '_');
  const reportPath = path.join(reportDir, `seo-aeo-digest-${stamp}.md`);
  const lines = [
    '# SEO/AEO 每日情报与方法论',
    '',
    `> 生成时间：${formatShanghaiTime(runAt)}｜AI 模型：${modelName}`,
    '',
    '## 今日概览',
    '',
    `- 今日新发布：${todayArticles.length} 篇`,
    `- 历史漏抓回补：${backfillArticles.length} 篇`,
    `- 深度解读：${deepArticles.length} 篇`,
    `- 低价值快讯：${briefs.length} 篇`,
    `- 已过滤无关或重复内容：${ignored.length} 篇`,
    '',
    '### 今日关键信号',
    '',
    ...dailyOverview.map((item, index) => `${index + 1}. ${item}`),
    '',
  ];

  if (deepArticles.length) {
    lines.push('## 今日必读', '');
    deepArticles.forEach((article, index) => {
      lines.push(`${index + 1}. [${article.analysis.chinese_title}](${article.url}) — ${article.priority_reason}`);
    });
    lines.push('', '## 中文深度解读', '');

    deepArticles.forEach((article, index) => {
      const analysis = article.analysis;
      lines.push(`### ${index + 1}. ${analysis.chinese_title}`, '');
      lines.push(`> 原文：[${article.originalTitle}](${article.url})  `);
      lines.push(`> 来源：${article.source}｜发布时间：${formatShanghaiTime(article.published)}｜类型：${article.content_type}｜阅读价值：${valueStars(article.relevance_score)}  `);
      lines.push(`> 适合：${analysis.applicable_to.join('、')}`, '');
      lines.push('#### 一句话结论', '', analysis.one_sentence_conclusion, '');
      lines.push('#### 文章解决了什么问题？', '', analysis.problem_statement, '');
      lines.push('#### 证据边界', '', analysis.evidence_boundary, '');
      lines.push('#### 核心观点', '');
      analysis.core_points.forEach((point, pointIndex) => {
        lines.push(`##### ${pointIndex + 1}. ${point.title}`, '', point.explanation, '');
      });
      lines.push('#### 对我们的启示', '', analysis.methodology.introduction, '');
      lines.push(`#### 可沉淀的方法论：${analysis.methodology.name}`, '');
      lines.push('| 检查维度 | 上线或决策前需要回答的问题 |', '|---|---|');
      analysis.methodology.dimensions.forEach(item => {
        lines.push(`| ${markdownCell(item.dimension)} | ${markdownCell(item.question)} |`);
      });
      lines.push('', '#### 建议监测指标', '');
      analysis.metrics.forEach(item => lines.push(`- ${item}`));
      lines.push('', '#### 不应误读', '');
      analysis.misreadings.forEach(item => lines.push(`- ${item}`));
      lines.push('', '#### 最终判断', '', analysis.final_judgment, '', '---', '');
    });
  }

  if (briefs.length) {
    lines.push('## 低价值快讯', '', '> 以下内容值得了解，但不足以形成独立 SEO/AEO 方法论。', '');
    lines.push('| 文章 | 类型 | 一句话说明 | 降级原因 |', '|---|---|---|---|');
    briefs.forEach(article => {
      lines.push(`| [${markdownCell(article.chinese_title)}](${article.url}) | ${article.content_type} | ${markdownCell(article.one_sentence_summary)} | ${markdownCell(article.priority_reason)} |`);
    });
    lines.push('');
  }

  lines.push('## 抓取状态', '');
  lines.push('| 来源 | Feed | 正文获取 | 备注 |', '|---|---|---|---|');
  sourceStatuses.forEach(status => {
    lines.push(`| ${status.source} | ${status.feedOk ? '正常' : '失败'} | ${status.fullText}/${status.total} 篇完整或部分正文 | ${markdownCell(status.note || '—')} |`);
  });
  lines.push('', '> 生成原则：只对高价值文章做深度解读；低价值内容降级为快讯，抓取噪声和通用模板不进入报告。', '');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

export function githubReportUrl(root, reportPath) {
  const repository = process.env.GITHUB_REPOSITORY;
  const branch = process.env.GITHUB_REF_NAME || 'main';
  if (!repository) return null;
  const relative = path.relative(root, reportPath).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${repository}/blob/${branch}/${relative}`;
}

export function dingTalkText({ root, runInfo, deepArticles, reportPath }) {
  const reportUrl = githubReportUrl(root, reportPath) || path.basename(reportPath);
  const lines = [
    'SEO/AEO 每日情报',
    '',
    `生成时间：${formatShanghaiTime(runInfo.run_at)}`,
    `新入库：${runInfo.new} 篇｜深度解读：${deepArticles.length} 篇`,
    '',
    '今日必读：',
    ...deepArticles.map((article, index) => `${index + 1}. ${article.analysis.chinese_title}`),
    '',
    `完整报告：${reportUrl}`,
  ];
  return lines.join('\n').slice(0, 3800);
}

