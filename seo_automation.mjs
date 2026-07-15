import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_CLASSIFY_ARTICLES,
  MAX_DEEP_ARTICLES,
  SOURCES,
  analyzeArticle,
  classifyArticles,
  createModelClient,
  enrichArticle,
  fetchText,
  parseFeed,
  sleep,
} from './lib/digest-core.mjs';
import { dingTalkText, renderReport } from './lib/digest-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const STATE_FILE = path.join(ROOT, 'seo_automation_state.json');
const REPORT_DIR = path.join(ROOT, 'reports');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { seen_urls: {}, rejected_urls: {}, runs: [] };
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  state.seen_urls ||= {};
  state.rejected_urls ||= {};
  state.runs ||= [];
  return state;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function collectNewArticles(state) {
  const allNew = [];
  const statuses = [];
  for (const source of SOURCES) {
    const status = { source: source.name, feedOk: false, total: 0, fullText: 0, note: '' };
    try {
      const xml = await fetchText(source.feedUrl, 30000);
      status.feedOk = true;
      const feedArticles = parseFeed(source, xml)
        .filter(article => !state.seen_urls[article.url])
        .slice(0, source.maxItems);
      for (const article of feedArticles) {
        const enriched = await enrichArticle(article);
        allNew.push(enriched);
        status.total += 1;
        if (enriched.contentQuality !== 'summary_only') status.fullText += 1;
        if (enriched.detailError) status.note = '部分详情页失败，已使用 Feed 摘要兜底';
        await sleep(350);
      }
    } catch (error) {
      status.note = error.message;
    }
    statuses.push(status);
  }
  allNew.sort((left, right) => Date.parse(right.published || 0) - Date.parse(left.published || 0));
  return { articles: allNew.slice(0, MAX_CLASSIFY_ARTICLES), statuses };
}

async function sendDingTalk(runInfo, deepArticles, reportPath) {
  const webhook = process.env.DINGTALK_WEBHOOK;
  if (!webhook) {
    console.log('DINGTALK_WEBHOOK is not set; skip DingTalk notification.');
    return;
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'text',
      text: { content: dingTalkText({ root: ROOT, runInfo, deepArticles, reportPath }) },
      at: { isAtAll: false },
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`DingTalk HTTP ${response.status}: ${raw}`);
  const payload = JSON.parse(raw);
  if (payload.errcode !== 0) throw new Error(`DingTalk API error ${payload.errcode}: ${payload.errmsg}`);
}

export async function runAutomation(options = {}) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const state = options.state || loadState();
  const runAt = options.runAt || new Date().toISOString();
  const modelClient = options.modelClient || createModelClient();
  const collection = options.articles
    ? { articles: options.articles, statuses: options.statuses || [] }
    : await collectNewArticles(state);

  if (!collection.articles.length) {
    const runInfo = { run_at: runAt, found: 0, new: 0, deep: 0, report: null, errors: [] };
    state.runs.push(runInfo);
    state.runs = state.runs.slice(-50);
    if (!options.skipStateWrite) saveState(state);
    console.log(JSON.stringify(runInfo, null, 2));
    return runInfo;
  }

  const { dailyOverview, articles } = await classifyArticles(collection.articles, modelClient);
  const mustRead = articles
    .filter(article => article.priority === 'must_read')
    .sort((left, right) => right.relevance_score - left.relevance_score)
    .slice(0, MAX_DEEP_ARTICLES);
  const deepArticles = [];
  for (const article of mustRead) {
    deepArticles.push(await analyzeArticle(article, modelClient));
    await sleep(1200);
  }

  const report = renderReport({
    reportDir: options.reportDir || REPORT_DIR,
    runAt,
    modelName: modelClient.model,
    dailyOverview,
    articles,
    deepArticles,
    sourceStatuses: collection.statuses,
  });
  const runInfo = {
    run_at: runAt,
    found: articles.length,
    new: articles.length,
    deep: deepArticles.length,
    report,
    errors: collection.statuses.filter(status => !status.feedOk).map(status => `${status.source}: ${status.note}`),
  };

  for (const article of articles) {
    state.seen_urls[article.url] = {
      first_seen: runAt,
      title: article.originalTitle,
      title_zh: article.chinese_title,
      source: article.source,
      published: article.published,
      priority: article.priority,
    };
    delete state.rejected_urls[article.url];
  }
  if (!options.skipNotification) {
    try {
      await sendDingTalk(runInfo, deepArticles, report);
    } catch (error) {
      runInfo.errors.push(`钉钉推送失败：${error.message}`);
      console.error(runInfo.errors.at(-1));
    }
  }
  state.runs.push(runInfo);
  state.runs = state.runs.slice(-50);
  if (!options.skipStateWrite) saveState(state);
  console.log(JSON.stringify(runInfo, null, 2));
  return runInfo;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  runAutomation().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

