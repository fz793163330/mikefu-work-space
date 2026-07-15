export const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
export const MAX_DEEP_ARTICLES = 3;
export const MAX_CLASSIFY_ARTICLES = 24;
const MAX_EXCERPT_CHARS = 1800;
const MAX_BODY_CHARS = 16000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 SEOAEOAutomation/2.0';

export const SOURCES = [
  {
    name: 'Search Engine Journal - SEO',
    feedUrl: 'https://www.searchenginejournal.com/category/seo/feed/',
    allowedHost: 'www.searchenginejournal.com',
    detailMode: 'readability',
    maxItems: 20,
  },
  {
    name: 'Search Engine Land - SEO',
    feedUrl: 'https://searchengineland.com/feed',
    allowedHost: 'searchengineland.com',
    requiredCategories: ['SEO'],
    detailMode: 'feed-content',
    maxItems: 20,
  },
  {
    name: 'Moz Blog',
    feedUrl: 'https://moz.com/blog/feed',
    allowedHost: 'moz.com',
    detailMode: 'readability',
    maxItems: 15,
  },
  {
    name: 'Search Engine Roundtable',
    feedUrl: 'https://www.seroundtable.com/index.xml',
    allowedHost: 'www.seroundtable.com',
    detailMode: 'readability',
    excludeTitlePatterns: [/^Daily Search Forum Recap/i],
    maxItems: 20,
  },
];

export const CLASSIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['daily_overview', 'articles'],
  properties: {
    daily_overview: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: { type: 'string' },
    },
    articles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'chinese_title', 'content_type', 'relevance_score', 'priority', 'one_sentence_summary', 'priority_reason'],
        properties: {
          url: { type: 'string' },
          chinese_title: { type: 'string' },
          content_type: { type: 'string', enum: ['官方更新', '研究报告', '实操方法', '行业观点', '产品变化', '新闻快讯', '活动推广', '低相关信息'] },
          relevance_score: { type: 'integer', minimum: 0, maximum: 100 },
          priority: { type: 'string', enum: ['must_read', 'brief', 'ignore'] },
          one_sentence_summary: { type: 'string' },
          priority_reason: { type: 'string' },
        },
      },
    },
  },
};

export const DEEP_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'chinese_title', 'applicable_to', 'one_sentence_conclusion', 'problem_statement',
    'evidence_boundary', 'core_points', 'methodology', 'metrics', 'misreadings', 'final_judgment',
  ],
  properties: {
    chinese_title: { type: 'string' },
    applicable_to: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    one_sentence_conclusion: { type: 'string' },
    problem_statement: { type: 'string' },
    evidence_boundary: { type: 'string' },
    core_points: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'explanation'],
        properties: {
          title: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
    methodology: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'introduction', 'dimensions'],
      properties: {
        name: { type: 'string' },
        introduction: { type: 'string' },
        dimensions: {
          type: 'array',
          minItems: 2,
          maxItems: 6,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['dimension', 'question'],
            properties: {
              dimension: { type: 'string' },
              question: { type: 'string' },
            },
          },
        },
      },
    },
    metrics: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } },
    misreadings: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } },
    final_judgment: { type: 'string' },
  },
};

export function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function decodeEntities(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '?', mdash: '?', hellip: '?', rsquo: '?', lsquo: '?', rdquo: '?', ldquo: '?' };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (original, entity) => {
    if (entity.startsWith('#')) {
      const number = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : original;
    }
    return named[entity.toLowerCase()] ?? original;
  });
}

export function cleanText(value = '') {
  return decodeEntities(String(value)).replace(/\s+/g, ' ').trim();
}

export function canonicalize(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function stripCdata(value = '') {
  return String(value).replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, '$1');
}

function xmlTag(block, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(block).match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? stripCdata(match[1]).trim() : '';
}

function xmlTags(block, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...String(block).matchAll(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'gi'))]
    .map(match => cleanText(stripCdata(match[1])))
    .filter(Boolean);
}

export function htmlToText(html = '') {
  if (!html) return '';
  const cleaned = String(html)
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<noscript\b[\s\S]*?<\/noscript>|<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>|<header\b[\s\S]*?<\/header>|<footer\b[\s\S]*?<\/footer>|<aside\b[\s\S]*?<\/aside>|<form\b[\s\S]*?<\/form>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return cleanText(cleaned);
}

function flattenJsonLd(node, output = []) {
  if (!node) return output;
  if (Array.isArray(node)) {
    node.forEach(item => flattenJsonLd(item, output));
    return output;
  }
  if (typeof node !== 'object') return output;
  output.push(node);
  if (node['@graph']) flattenJsonLd(node['@graph'], output);
  if (node.mainEntity) flattenJsonLd(node.mainEntity, output);
  return output;
}

function extractStructuredArticleBody(html) {
  for (const match of String(html).matchAll(/<script\b[^>]*type\s*=\s*(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const items = flattenJsonLd(JSON.parse(decodeEntities(match[2]).trim()));
      const article = items.find(item => {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        return types.some(type => ['Article', 'NewsArticle', 'BlogPosting'].includes(type)) && item.articleBody;
      });
      if (article?.articleBody) return cleanText(article.articleBody);
    } catch {}
  }
  return '';
}

export function extractArticleText(html) {
  const structuredBody = extractStructuredArticleBody(html);
  if (structuredBody.length >= 500) return structuredBody;
  const articleMatch = String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    const articleText = htmlToText(articleMatch[1]);
    if (articleText.length >= 500) return articleText;
  }
  const postContent = String(html).match(/<(?:div|section)\b[^>]*(?:id|class)\s*=\s*(['"])[^'"]*(?:post-content|article-content|entry-content)[^'"]*\1[^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  return postContent ? htmlToText(postContent[2]) : '';
}

export function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(cleanText(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function cleanupTitle(title, source) {
  let output = cleanText(title);
  if (source.name.startsWith('Search Engine Journal')) output = output.replace(/\s+via\s+@sejournal.*$/i, '');
  return output;
}

export async function fetchText(url, timeoutMs = 30000) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 1200);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export function parseFeed(source, xml) {
  const articles = [];
  for (const match of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const item = match[0];
    const categories = xmlTags(item, 'category');
    if (source.requiredCategories?.length) {
      const lowerCategories = categories.map(category => category.toLowerCase());
      if (!source.requiredCategories.some(required => lowerCategories.includes(required.toLowerCase()))) continue;
    }
    const originalTitle = cleanupTitle(xmlTag(item, 'title'), source);
    if (!originalTitle || source.excludeTitlePatterns?.some(pattern => pattern.test(originalTitle))) continue;
    const rawLink = cleanText(xmlTag(item, 'link'));
    if (!rawLink) continue;
    let url;
    try {
      url = canonicalize(rawLink);
      if (new URL(url).hostname.toLowerCase() !== source.allowedHost.toLowerCase()) continue;
    } catch {
      continue;
    }
    const descriptionHtml = xmlTag(item, 'description');
    articles.push({
      source: source.name,
      url,
      originalTitle,
      published: normalizeDate(xmlTag(item, 'pubDate')),
      description: htmlToText(descriptionHtml),
      feedContentHtml: xmlTag(item, 'content:encoded'),
      categories,
      detailMode: source.detailMode,
    });
    if (articles.length >= source.maxItems) break;
  }
  return articles;
}

export async function enrichArticle(article) {
  if (article.detailMode === 'feed-content' && article.feedContentHtml) {
    const contentText = htmlToText(article.feedContentHtml);
    return {
      ...article,
      contentText,
      excerpt: contentText.slice(0, MAX_EXCERPT_CHARS),
      contentQuality: contentText.length >= 1000 ? 'full' : 'summary_only',
    };
  }

  try {
    const html = await fetchText(article.url, 30000);
    const contentText = extractArticleText(html);
    if (contentText.length >= 500) {
      return {
        ...article,
        contentText,
        excerpt: contentText.slice(0, MAX_EXCERPT_CHARS),
        contentQuality: contentText.length >= 1800 ? 'full' : 'partial',
      };
    }
  } catch (error) {
    return {
      ...article,
      contentText: article.description,
      excerpt: article.description.slice(0, MAX_EXCERPT_CHARS),
      contentQuality: 'summary_only',
      detailError: error.message,
    };
  }

  return {
    ...article,
    contentText: article.description,
    excerpt: article.description.slice(0, MAX_EXCERPT_CHARS),
    contentQuality: 'summary_only',
  };
}

export function isChineseEnough(value) {
  const text = String(value || '');
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const letters = (text.match(/[A-Za-z\u3400-\u9fff]/g) || []).length;
  return chinese >= 4 && chinese / Math.max(letters, 1) >= 0.35;
}

function extractMessageText(messageContent) {
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) return messageContent.map(item => item?.text || '').join('');
  return '';
}

export function createModelClient(options = {}) {
  const endpoint = options.endpoint || process.env.SEO_MODEL_ENDPOINT || 'https://models.github.ai/inference/chat/completions';
  const model = options.model || process.env.SEO_AI_MODEL || 'openai/gpt-4.1';
  const token = options.token || process.env.GITHUB_MODELS_TOKEN || process.env.GITHUB_TOKEN || '';

  async function callModel({ system, user, schema, schemaName, maxTokens = 5000 }) {
    if (!token) throw new Error('缺少 GITHUB_TOKEN/GITHUB_MODELS_TOKEN；为避免生成低质量模板，本次不会标记文章为已处理。');
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: maxTokens,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
          }),
        });
        const raw = await response.text();
        if (!response.ok) throw new Error(`模型 API ${response.status}: ${raw.slice(0, 500)}`);
        const payload = JSON.parse(raw);
        const content = extractMessageText(payload.choices?.[0]?.message?.content);
        if (!content) throw new Error('模型返回空内容');
        return JSON.parse(content);
      } catch (error) {
        lastError = error;
        if (attempt < 3) await sleep(attempt * 2500);
      }
    }
    throw lastError;
  }

  return { callModel, model };
}


function stringValues(node, output = []) {
  if (typeof node === 'string') output.push(node);
  else if (Array.isArray(node)) node.forEach(item => stringValues(item, output));
  else if (node && typeof node === 'object') Object.values(node).forEach(value => stringValues(value, output));
  return output;
}

function containsChinese(value, minimum = 4) {
  return ((String(value || '').match(/[\u3400-\u9fff]/g) || []).length >= minimum);
}

function classificationIsChinese(result) {
  if (!result?.daily_overview?.every(item => containsChinese(item, 6))) return false;
  return result?.articles?.every(item => containsChinese(item.chinese_title, 2) && containsChinese(item.one_sentence_summary, 6) && containsChinese(item.priority_reason, 4));
}

export async function classifyArticles(articles, modelClient) {
  const inputs = articles.slice(0, MAX_CLASSIFY_ARTICLES).map(article => ({
    url: article.url,
    source: article.source,
    original_title: article.originalTitle,
    published: article.published,
    categories: article.categories,
    content_quality: article.contentQuality,
    excerpt: article.excerpt,
  }));
  const baseSystem = `你是资深中文 SEO/AEO 情报编辑。你的任务不是翻译标题列表，而是判断哪些文章值得中国 SEO 从业者深入阅读。

必须遵守：
1. 全部解释字段使用自然、专业的简体中文，产品名、专有名词可保留英文，但每个标题和句子的主体必须是中文。
2. 最多选择 ${MAX_DEEP_ARTICLES} 篇 must_read；只有能形成独立方法论、影响 SEO/AEO 决策或包含重要官方变化的文章才可入选。
3. 产品小改动、广告政策、账号操作、活动推广和重复新闻降为 brief 或 ignore。
4. 不得因为出现 AI、SEO 等关键词就机械提高优先级。
5. one_sentence_summary 必须说明文章真正说了什么，不能复述标题。
6. daily_overview 提炼当天跨文章的 1-4 个关键信号，不能写空泛建议。`;
  const user = `请评估以下新文章并返回结构化结果：
${JSON.stringify(inputs, null, 2)}`;
  let result;
  for (let semanticAttempt = 1; semanticAttempt <= 2; semanticAttempt += 1) {
    const system = semanticAttempt === 1
      ? baseSystem
      : `${baseSystem}

上一次输出未满足简体中文要求。本次必须把英文标题改写为中文标题，不能原样复制英文。`;
    result = await modelClient.callModel({ system, user, schema: CLASSIFICATION_SCHEMA, schemaName: 'seo_article_classification', maxTokens: 5000 });
    if (classificationIsChinese(result)) break;
  }
  if (!classificationIsChinese(result)) throw new Error('模型分类连续两次未达到简体中文质量要求');

  const byUrl = new Map(result.articles.map(item => [canonicalize(item.url), item]));
  for (const article of articles) {
    const classification = byUrl.get(article.url);
    if (!classification) throw new Error(`模型分类缺少文章：${article.url}`);
    Object.assign(article, classification);
    if (article.priority === 'must_read' && article.contentQuality === 'summary_only') {
      article.priority = 'brief';
      article.priority_reason = `正文不可用，仅能依据摘要判断；${article.priority_reason}`;
    }
    if (article.priority === 'must_read') article.relevance_score = Math.max(80, article.relevance_score);
    if (article.priority === 'brief') article.relevance_score = Math.min(79, Math.max(30, article.relevance_score));
    if (article.priority === 'ignore') article.relevance_score = Math.min(29, article.relevance_score);
  }

  const rankedMustRead = articles.filter(article => article.priority === 'must_read').sort((left, right) => right.relevance_score - left.relevance_score);
  rankedMustRead.slice(MAX_DEEP_ARTICLES).forEach(article => {
    article.priority = 'brief';
    article.priority_reason = `当日深度解读名额有限；${article.priority_reason}`;
    article.relevance_score = Math.min(79, article.relevance_score);
  });
  if (!rankedMustRead.length && articles.length) {
    const best = [...articles].filter(article => article.contentQuality !== 'summary_only').sort((left, right) => right.relevance_score - left.relevance_score)[0];
    if (best) {
      best.priority = 'must_read';
      best.relevance_score = Math.max(80, best.relevance_score);
    }
  }
  return { dailyOverview: result.daily_overview, articles };
}

function deepAnalysisPasses(result) {
  const analysisText = stringValues(result).join(' ');
  const bannedPatterns = [/把核心答案前置/, /2-4\s*周后/, /做一个实验/, /FAQ.*HowTo.*Article/i];
  return isChineseEnough(analysisText) && !bannedPatterns.some(pattern => pattern.test(analysisText));
}

export async function analyzeArticle(article, modelClient) {
  const baseSystem = `你是负责企业 SEO/AEO 方法论沉淀的资深中文分析师。请基于原文制作可直接阅读和复用的深度解读。

硬性要求：
1. 除原文标题、产品名和行业术语外，全部使用自然简体中文。
2. 忠实区分原文事实、作者观点和你的方法论转化，不得编造数字、案例或 Google 规则。
3. 核心观点必须解释因果关系、前提或影响，不能只翻译小标题。
4. methodology 必须由本文独有观点推导，名称和检查维度要具体；禁止默认套用“答案前置、FAQ、Schema、做实验”等通用模板。
5. 如果原文只是新闻或观点，要明确证据边界；不要把作者意见写成官方结论。
6. metrics 只保留确实能验证本文方法论的指标。
7. misreadings 用于指出最容易出现的错误理解。
8. evidence_boundary 必须说明内容属于官方确认、研究证据、案例观察还是作者推论，并指出不能据此下什么结论。
9. 不输出泛泛的执行安排，不复述网站导航、广告、推荐文章或作者简介。`;
  const input = {
    source: article.source,
    original_title: article.originalTitle,
    url: article.url,
    published: article.published,
    content_type: article.content_type,
    relevance_score: article.relevance_score,
    content_quality: article.contentQuality,
    article_text: (article.contentText || article.description || '').slice(0, MAX_BODY_CHARS),
  };
  const user = `请分析以下文章：
${JSON.stringify(input, null, 2)}`;
  let result;
  for (let semanticAttempt = 1; semanticAttempt <= 2; semanticAttempt += 1) {
    const system = semanticAttempt === 1
      ? baseSystem
      : `${baseSystem}

上一次输出未通过中文或模板化质量检查。本次必须使用简体中文，并让方法论严格来自本文独有观点。`;
    result = await modelClient.callModel({ system, user, schema: DEEP_ANALYSIS_SCHEMA, schemaName: 'seo_deep_analysis', maxTokens: 6000 });
    if (deepAnalysisPasses(result)) break;
  }
  if (!deepAnalysisPasses(result)) throw new Error(`深度解读连续两次未通过质量门：${article.url}`);
  return { ...article, analysis: result };
}

