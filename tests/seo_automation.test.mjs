import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractArticleText, parseFeed, parseRss2Json } from '../lib/digest-core.mjs';
import { runAutomation } from '../seo_automation.mjs';

const source = {
  name: 'Search Engine Land - SEO',
  allowedHost: 'searchengineland.com',
  requiredCategories: ['SEO'],
  detailMode: 'feed-content',
  maxItems: 10,
};

test('parseFeed keeps SEO items and full feed content', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title><![CDATA[Useful SEO article]]></title><link>https://searchengineland.com/useful-seo-123</link><pubDate>Tue, 14 Jul 2026 15:00:00 +0000</pubDate><category><![CDATA[SEO]]></category><description><![CDATA[<p>Summary</p>]]></description><content:encoded><![CDATA[<p>Full body</p>]]></content:encoded></item>
    <item><title>PPC only</title><link>https://searchengineland.com/ppc-only-456</link><pubDate>Tue, 14 Jul 2026 15:00:00 +0000</pubDate><category>PPC</category><description>Ads</description></item>
  </channel></rss>`;
  const articles = parseFeed(source, xml);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].originalTitle, 'Useful SEO article');
  assert.match(articles[0].feedContentHtml, /Full body/);
});

test('parseRss2Json preserves categories and full content', () => {
  const payload = JSON.stringify({
    status: 'ok',
    items: [
      {
        title: 'Visual semantics',
        link: 'https://searchengineland.com/visual-semantics-123',
        pubDate: '2026-07-14 15:00:00',
        categories: ['AI SEO', 'SEO'],
        description: '<p>Chinese-ready summary source</p>',
        content: '<p>Full article content</p>',
      },
      {
        title: 'PPC only',
        link: 'https://searchengineland.com/ppc-only-456',
        pubDate: '2026-07-14 15:00:00',
        categories: ['PPC'],
        description: 'Ads',
        content: 'Ads',
      },
    ],
  });
  const articles = parseRss2Json(source, payload);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].published, '2026-07-14T15:00:00.000Z');
  assert.match(articles[0].feedContentHtml, /Full article content/);
});
test('extractArticleText prioritizes structured articleBody', () => {
  const html = `<html><head><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"这是正文内容。${'有效信息'.repeat(200)}"}</script></head><body><nav>噪声导航</nav></body></html>`;
  const text = extractArticleText(html);
  assert.match(text, /这是正文内容/);
  assert.doesNotMatch(text, /噪声导航/);
});

test('full automation renders Chinese deep analysis without legacy templates', async () => {
  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-digest-test-'));
  const articles = [
    {
      source: 'Search Engine Journal - SEO',
      url: 'https://www.searchenginejournal.com/example/123456',
      originalTitle: 'Why Scaled AI Content Fails',
      published: '2026-07-15T01:00:00.000Z',
      description: 'Why large-scale content fails.',
      contentText: 'Google needs to allocate crawl and indexing resources. Pages without demand or unique value may lose crawl frequency.',
      excerpt: 'Google needs to allocate crawl and indexing resources.',
      contentQuality: 'full',
      categories: ['SEO'],
    },
    {
      source: 'Search Engine Roundtable',
      url: 'https://www.seroundtable.com/minor-update-99999.html',
      originalTitle: 'Minor Interface Update',
      published: '2026-07-15T02:00:00.000Z',
      description: 'A minor interface changed.',
      contentText: 'A minor interface changed.',
      excerpt: 'A minor interface changed.',
      contentQuality: 'summary_only',
      categories: [],
    },
  ];
  const modelClient = {
    model: 'test-model',
    async callModel({ schemaName }) {
      if (schemaName === 'seo_article_classification') {
        return {
          daily_overview: ['规模化内容的核心约束正在从生成能力转向需求、价值与抓取资源匹配。'],
          articles: [
            {
              url: articles[0].url,
              chinese_title: '规模化 AI 内容为什么会失败',
              content_type: '行业观点',
              relevance_score: 94,
              priority: 'must_read',
              one_sentence_summary: '文章解释了抓取资源、真实需求与内容价值不匹配时，批量页面为何会逐步失去索引。',
              priority_reason: '可直接沉淀为程序化 SEO 项目的准入方法。',
            },
            {
              url: articles[1].url,
              chinese_title: '某搜索界面的细微调整',
              content_type: '产品变化',
              relevance_score: 30,
              priority: 'brief',
              one_sentence_summary: '这是一项界面层面的调整，对 SEO 策略没有直接影响。',
              priority_reason: '仅需知晓，无法形成独立方法论。',
            },
          ],
        };
      }
      return {
        chinese_title: '规模化 AI 内容为什么会失败',
        applicable_to: ['内容负责人', '技术 SEO', '程序化 SEO 团队'],
        one_sentence_conclusion: '问题不在于使用 AI，而在于页面规模超过了真实需求、独特价值和网站抓取资源能够支撑的范围。',
        problem_statement: '文章讨论为什么批量页面可能先被抓取，随后因缺少需求和价值信号而降低抓取频率甚至退出索引。',
        evidence_boundary: '这是基于作者对案例和搜索机制的分析，不等同于 Google 对所有 AI 内容的官方判定。',
        core_points: [
          { title: '抓取资源需要被争取', explanation: '搜索引擎不会因为页面已经发布，就持续为每个 URL 分配相同的抓取与索引资源。' },
          { title: '初期收录不等于长期成功', explanation: '新鲜度可能带来短期抓取，但持续表现取决于需求、用户反馈和页面独特价值。' },
        ],
        methodology: {
          name: '规模化内容四道门',
          introduction: '批量生产前应先验证需求、价值、索引能力和维护责任，而不是只检查页面模板是否完整。',
          dimensions: [
            { dimension: '需求门', question: '每个页面是否对应独立且持续的真实搜索需求？' },
            { dimension: '价值门', question: '页面是否提供无法通过简单模板替换获得的信息？' },
            { dimension: '索引门', question: '小规模试点能否获得持续抓取、索引与曝光？' },
            { dimension: '维护门', question: '是否定义了更新、合并和淘汰机制？' },
          ],
        },
        metrics: ['有效索引页面占比', '再次抓取间隔', '长期无曝光页面占比'],
        misreadings: ['不能把文章理解为 Google 禁止 AI 内容。', '标题和结构完整不等于页面具有独特价值。'],
        final_judgment: '这篇文章适合纳入程序化 SEO 项目准入规范，核心价值是把内容规模视为资源配置问题。',
      };
    },
  };
  const result = await runAutomation({
    articles,
    statuses: [
      { source: 'Search Engine Journal - SEO', feedOk: true, total: 1, fullText: 1, note: '' },
      { source: 'Search Engine Roundtable', feedOk: true, total: 1, fullText: 0, note: '' },
    ],
    modelClient,
    runAt: '2026-07-15T03:00:00.000Z',
    reportDir,
    state: { seen_urls: {}, rejected_urls: {}, runs: [] },
    skipStateWrite: true,
    skipNotification: true,
  });
  const report = fs.readFileSync(result.report, 'utf8');
  assert.match(report, /## 今日概览/);
  assert.match(report, /## 中文深度解读/);
  assert.match(report, /可沉淀的方法论：规模化内容四道门/);
  assert.match(report, /#### 证据边界/);
  assert.match(report, /阅读价值：★★★★☆|阅读价值：★★★★★/);
  assert.match(report, /## 低价值快讯/);
  assert.doesNotMatch(report, /文章结构重点/);
  assert.doesNotMatch(report, /执行动作/);
  assert.doesNotMatch(report, /把核心答案前置为 40-80 字/);
});


test('model failure leaves seen state untouched', async () => {
  const state = { seen_urls: {}, rejected_urls: {}, runs: [] };
  const article = {
    source: 'Search Engine Journal - SEO',
    url: 'https://www.searchenginejournal.com/failure-case/999999',
    originalTitle: 'Failure case',
    published: '2026-07-15T01:00:00.000Z',
    description: 'A test article.',
    contentText: 'Enough article text for a model request.',
    excerpt: 'Enough article text for a model request.',
    contentQuality: 'full',
    categories: ['SEO'],
  };
  const modelClient = {
    model: 'test-model',
    async callModel() { throw new Error('temporary model failure'); },
  };
  await assert.rejects(() => runAutomation({
    articles: [article],
    statuses: [],
    modelClient,
    state,
    reportDir: fs.mkdtempSync(path.join(os.tmpdir(), 'seo-failure-test-')),
    skipStateWrite: true,
    skipNotification: true,
  }), /temporary model failure/);
  assert.deepEqual(state.seen_urls, {});
  assert.equal(state.runs.length, 0);
});
