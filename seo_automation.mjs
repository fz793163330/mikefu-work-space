import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCES = [
  {
    name: 'Search Engine Journal - SEO',
    url: 'https://www.searchenginejournal.com/category/seo/',
    allowedHost: 'www.searchenginejournal.com',
    requiredSchemaTypes: ['Article', 'NewsArticle', 'BlogPosting'],
    urlPattern: /\/\d{4,}$/,
    maxCandidates: 60,
    maxArticles: 12,
  },
  {
    name: 'Search Engine Land - SEO',
    url: 'https://searchengineland.com/library/seo',
    allowedHost: 'searchengineland.com',
    requiredSchemaTypes: ['Article', 'NewsArticle', 'BlogPosting'],
    feedUrl: 'https://searchengineland.com/feed',
    feedCategoryInclude: ['SEO'],
    preferFeed: true,
    maxCandidates: 60,
    maxArticles: 12,
  },
  {
    name: 'Moz Blog',
    url: 'https://moz.com/blog',
    allowedHost: 'moz.com',
    requiredPathPrefix: '/blog/',
    requiredSchemaTypes: ['Article', 'BlogPosting', 'NewsArticle'],
    maxCandidates: 40,
    maxArticles: 10,
  },
  {
    name: 'Search Engine Roundtable',
    url: 'https://www.seroundtable.com/',
    allowedHost: 'www.seroundtable.com',
    urlPattern: /^\/[^/]+-\d+\.html$/,
    allowFileExtensions: ['.html'],
    requiredSchemaTypes: ['NewsArticle'],
    maxCandidates: 60,
    maxArticles: 12,
  },
];

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const STATE_FILE = path.join(ROOT, 'seo_automation_state.json');
const REPORT_DIR = path.join(ROOT, 'reports');
const LOG_DIR = path.join(ROOT, 'logs');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 CodexSEOAutomation/1.0';
const STOPWORDS = new Set(`a an and are as at be by for from has have how in into is it its of on or that the this to was what when where who why will with you your about after all also can more most new not over search seo google content marketing site sites page pages website websites ai aeo users user their they them there these those using use used via we our`.split(/\s+/));
const NON_ARTICLE_PATH_PATTERNS = [
  /^\/?$/,
  /\/author(s)?(\/|$)/i,
  /\/category(\/|$)/i,
  /\/tag(\/|$)/i,
  /\/page\/\d+/i,
  /\/library(\/|$)/i,
  /\/events?(\/|$)/i,
  /\/webinars?(\/|$)/i,
  /\/about(\/|$)/i,
  /\/contact(\/|$)/i,
  /\/advertise(\/|$)/i,
  /\/newsletter(\/|$)/i,
  /\/legal(\/|$)/i,
  /\/privacy(\/|$)/i,
  /\/terms(\/|$)/i,
  /\/login(\/|$)/i,
  /\/subscribe(\/|$)/i,
  /\/subscriptions?(\/|$)/i,
  /\/archives?(\/|$)/i,
  /\/forums?(\/|$)/i,
  /\/feed(\/|$)/i,
  /\/api(\/|$)/i,
  /\/products?(\/|$)/i,
  /\/free-seo-tools(\/|$)/i,
  /\/learn(\/|$)/i,
  /\/resources(\/|$)/i,
  /\/smb-solutions(\/|$)/i,
  /\/beginners-guide/i,
  /\/keyword-research-guide/i,
  /\/seo-competitor-analysis/i,
  /\/dont-sell-my-information(\/|$)/i,
];
const BAD_TITLE_RE = /\b(log\s*in|sign\s*in|subscribe|subscription|dashboard|pricing|products?|tools?|privacy|terms|contact|advertise|archives?|authors?)\b/i;

class ValidationSkip extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationSkip';
    this.validation = true;
  }
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function cleanText(s = '') { return decodeEntities(String(s)).replace(/\s+/g, ' ').trim(); }
function decodeEntities(s) {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (orig, ent) => {
    if (ent[0] === '#') {
      const n = ent[1]?.toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : orig;
    }
    return Object.prototype.hasOwnProperty.call(map, ent) ? map[ent] : orig;
  });
}
function stripTags(html = '') {
  return cleanText(String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' '));
}
function canonicalize(u) {
  const url = new URL(u);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}
function attr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'is');
  const m = String(tag).match(re);
  return m ? decodeEntities(m[2].trim()) : null;
}
function isBlockingPage(html) {
  const s = String(html).slice(0, 12000);
  return (/Just a moment/i.test(s) && /cloudflare|cf-/i.test(s)) || /cf-browser-verification/i.test(s) || /enable javascript and cookies to continue/i.test(s);
}
async function fetchHtml(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const html = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    if (isBlockingPage(html)) throw new Error('Cloudflare/browser verification page');
    return html;
  } finally {
    clearTimeout(timer);
  }
}
function sourceForUrl(abs) {
  try {
    const host = new URL(abs).hostname.toLowerCase();
    return SOURCES.find(s => host === s.allowedHost.toLowerCase()) || null;
  } catch {
    return null;
  }
}
function sourceUrlAllowed(source, abs) {
  let u;
  try { u = new URL(abs); } catch { return false; }
  if (u.hostname.toLowerCase() !== source.allowedHost.toLowerCase()) return false;
  const pathname = u.pathname || '/';
  const lowerPath = pathname.toLowerCase();
  if (source.requiredPathPrefix && !lowerPath.startsWith(source.requiredPathPrefix.toLowerCase())) return false;
  if (source.urlPattern && !source.urlPattern.test(pathname)) return false;
  if (NON_ARTICLE_PATH_PATTERNS.some(re => re.test(lowerPath))) return false;
  const ext = path.extname(pathname).toLowerCase();
  if (ext && !(source.allowFileExtensions || []).includes(ext)) return false;
  return true;
}
function titleFromUrl(abs) {
  try {
    const slug = path.basename(new URL(abs).pathname).replace(/\.html$/i, '').replace(/-\d+$/, '').replace(/-/g, ' ');
    return slug.replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return '';
  }
}
function addCandidate(out, source, abs, title, origin) {
  let normalized;
  try { normalized = canonicalize(abs); } catch { return; }
  if (!sourceUrlAllowed(source, normalized)) return;
  const cleanTitle = cleanText(title || titleFromUrl(normalized)).replace(/^(read more|learn more|continue reading)\b/i, '').trim();
  if (cleanTitle && (cleanTitle.length > 180 || BAD_TITLE_RE.test(cleanTitle))) return;
  if (!out.has(normalized)) out.set(normalized, { source: source.name, title: cleanTitle || titleFromUrl(normalized), url: normalized, origin, order: out.size });
}
function stripCdata(s = '') {
  return String(s).replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, '$1');
}
function xmlTag(block, tagName) {
  const esc = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${esc}\\b[^>]*>([\\s\\S]*?)<\\/${esc}>`, 'i');
  const m = String(block).match(re);
  return m ? stripCdata(m[1]).trim() : null;
}
function xmlTags(block, tagName) {
  const esc = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${esc}\\b[^>]*>([\\s\\S]*?)<\\/${esc}>`, 'gi');
  return [...String(block).matchAll(re)].map(m => cleanText(stripTags(stripCdata(m[1])))).filter(Boolean);
}
async function fetchFeedArticles(source) {
  const xml = await fetchHtml(source.feedUrl, 25000);
  const out = [];
  let order = 0;
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const item = m[0];
    const categories = xmlTags(item, 'category');
    if (source.feedCategoryInclude?.length) {
      const lower = categories.map(c => c.toLowerCase());
      if (!source.feedCategoryInclude.some(cat => lower.includes(cat.toLowerCase()))) continue;
    }
    const link = cleanText(stripTags(stripCdata(xmlTag(item, 'link') || '')));
    if (!link) continue;
    let url;
    try { url = canonicalize(link); } catch { continue; }
    if (!sourceUrlAllowed(source, url)) continue;
    const title = cleanText(stripTags(stripCdata(xmlTag(item, 'title') || titleFromUrl(url))));
    if (!title || title.length < 8 || title.length > 180 || BAD_TITLE_RE.test(title)) continue;
    const contentHtml = stripCdata(xmlTag(item, 'content:encoded') || xmlTag(item, 'description') || '');
    const description = cleanText(stripTags(stripCdata(xmlTag(item, 'description') || ''))).replace(/^\s*$/, '');
    const published = normalizeDate(xmlTag(item, 'pubDate'));
    const headings = dedupe([...contentHtml.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(h => stripTags(h[1])).filter(h => h && h.length < 160)).slice(0, 8);
    const bullets = dedupe([...contentHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(b => stripTags(b[1])).filter(b => b.length >= 25 && b.length <= 240 && b.split(/\s+/).length >= 5)).slice(0, 8);
    const article = { source: source.name, title, url, origin: 'rss-feed', order: order++, published, description, headings, bullets, categories, schema_types: ['RSSItem'], detailReady: true };
    article.summary = makeSummary(article);
    article.methods = makeMethods(article);
    out.push(article);
    if (out.length >= (source.maxCandidates || 50)) break;
  }
  return out;
}
function extractListingArticles(source, html) {
  const out = new Map();
  const anchorRe = /<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href = decodeEntities(m[2].trim());
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    let abs;
    try { abs = new URL(href, source.url).toString(); } catch { continue; }
    let text = stripTags(m[3]);
    text = text.replace(/\s*[|–-]\s*Search Engine (Journal|Land).*$/i, '').trim();
    addCandidate(out, source, abs, text, 'anchor');
  }
  const jsonUrlRe = /"url"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]+)*)"/gi;
  for (const m of html.matchAll(jsonUrlRe)) {
    addCandidate(out, source, m[1].replace(/\\\//g, '/'), '', 'json-url');
  }
  const hrefUrlRe = /https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g;
  for (const m of html.matchAll(hrefUrlRe)) {
    addCandidate(out, source, m[0].replace(/\\\//g, '/'), '', 'raw-url');
  }
  return [...out.values()].slice(0, source.maxCandidates || 50);
}
function meta(html, key) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const k = attr(tag, 'name') || attr(tag, 'property');
    if (k && k.toLowerCase() === key.toLowerCase()) {
      const val = attr(tag, 'content');
      if (val) return cleanText(val);
    }
  }
  return null;
}
function canonicalLink(html) {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if ((attr(tag, 'rel') || '').toLowerCase() === 'canonical') return attr(tag, 'href');
  }
  return null;
}
function firstMatch(html, patterns) {
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return stripTags(m[1]);
  }
  return null;
}
function normalizeDate(s) {
  if (!s) return null;
  s = cleanText(s);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const norm = String(item).toLowerCase().replace(/\W+/g, ' ').trim();
    if (norm && !seen.has(norm)) { seen.add(norm); out.push(item); }
  }
  return out;
}
function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
function scalar(v) {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return cleanText(v);
  if (Array.isArray(v)) return scalar(v[0]);
  if (typeof v === 'object') return scalar(v.name || v.headline || v['@id'] || v.text);
  return null;
}
function flattenJsonLd(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  out.push(node);
  for (const key of ['@graph', 'itemListElement', 'mainEntity', 'about']) {
    if (node[key]) flattenJsonLd(node[key], out);
  }
  if (node.item) flattenJsonLd(node.item, out);
  return out;
}
function jsonLdItems(html) {
  const items = [];
  const scriptRe = /<script\b[^>]*type\s*=\s*(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(scriptRe)) {
    const raw = decodeEntities(m[2]).trim();
    if (!raw) continue;
    try {
      flattenJsonLd(JSON.parse(raw), items);
    } catch {
      // Some sites occasionally emit malformed JSON-LD; meta tags still provide fallback fields,
      // but schema validation below must pass for this automation to report a page.
    }
  }
  return items;
}
function itemTypes(item) {
  return asArray(item?.['@type']).flatMap(t => typeof t === 'string' ? [t] : []).map(t => t.toLowerCase());
}
function schemaTypeMatches(item, requiredTypes) {
  const types = itemTypes(item);
  return requiredTypes.some(req => types.includes(req.toLowerCase()));
}
function findArticleSchema(html, source) {
  const required = source.requiredSchemaTypes || [];
  if (!required.length) return null;
  return jsonLdItems(html).find(item => schemaTypeMatches(item, required)) || null;
}
function keywords(article, n = 10) {
  const text = `${article.title || ''} ${article.description || ''} ${(article.headings || []).join(' ')}`.toLowerCase();
  const counts = new Map();
  for (const w of text.match(/[a-z][a-z0-9-]{2,}/g) || []) {
    if (!STOPWORDS.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(x => x[0]);
}
function makeSummary(article) {
  const parts = [];
  if (article.description) parts.push(article.description.replace(/\.$/, ''));
  if (article.headings?.length) parts.push(`重点包括：${article.headings.slice(0, 4).join('；')}`);
  if (!parts.length) parts.push(`文章围绕《${article.title}》展开，可进一步阅读全文确认细节`);
  return `${parts.join('。')}。`;
}
function makeMethods(article) {
  const full = `${article.title || ''} ${article.description || ''} ${(article.headings || []).join(' ')}`.toLowerCase();
  const methods = [];
  if (/(\bai\b|generative|chatgpt|answer|aeo|overview)/.test(full)) methods.push('AEO：把核心答案前置为 40-80 字定义/结论，补充 FAQ、HowTo、Article 结构化数据，便于搜索与 AI 摘要引用。');
  if (/(content|helpful|quality|eeat|e-e-a-t)/.test(full)) methods.push('内容质量：为每篇文章增加作者经验、数据来源、更新日期、案例截图和独特观点，避免只复述通用答案。');
  if (/(technical|crawl|index|schema|javascript|core web|speed)/.test(full)) methods.push('技术 SEO：检查抓取/索引状态、页面速度、结构化数据和 JS 渲染，给关键模板建立可复用技术清单。');
  if (/(link|authority|backlink|internal)/.test(full)) methods.push('链接策略：从高意图页面向核心转化页做上下文内链，锚文本覆盖实体、问题和场景词。');
  if (/(local|maps|business profile)/.test(full)) methods.push('本地 SEO：统一 NAP 信息，维护 Google Business Profile，围绕服务+城市建立评价与问答资产。');
  if (/(keyword|query|intent|serp)/.test(full)) methods.push('关键词/意图：按 SERP 类型拆分信息型、比较型、交易型页面，避免同站多页争抢同一查询。');
  if (!methods.length) methods.push(`方法论沉淀：围绕 ${keywords(article, 5).join('、') || '主题实体'} 建立页面检查表：搜索意图、答案前置、证据支撑、内链入口、结构化数据。`);
  methods.push('执行动作：把本文观点转成 1 个待办实验，记录基准指标（排名/曝光/点击/转化），2-4 周后复盘。');
  return dedupe(methods);
}
async function extractArticleDetail(article, source) {
  if (!sourceUrlAllowed(source, article.url)) throw new ValidationSkip('URL 不符合该来源的内容页规则');
  const html = await fetchHtml(article.url, 20000);
  const canonical = canonicalLink(html) || meta(html, 'og:url') || article.url;
  let canonicalAbs = article.url;
  try { canonicalAbs = canonicalize(new URL(canonical, article.url).toString()); } catch {}
  if (!sourceUrlAllowed(source, canonicalAbs)) throw new ValidationSkip(`canonical URL 不符合内容页规则：${canonicalAbs}`);
  const schema = findArticleSchema(html, source);
  if ((source.requiredSchemaTypes || []).length && !schema) throw new ValidationSkip(`缺少 ${source.requiredSchemaTypes.join('/')} 结构化数据`);
  const title = scalar(schema?.headline) || scalar(schema?.name) || meta(html, 'og:title') || firstMatch(html, [/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, /<title\b[^>]*>([\s\S]*?)<\/title>/i]) || article.title;
  if (!title || title.length < 8 || BAD_TITLE_RE.test(title)) throw new ValidationSkip(`标题不像文章：${title || '(empty)'}`);
  const description = scalar(schema?.description) || meta(html, 'description') || meta(html, 'og:description');
  const published = normalizeDate(scalar(schema?.datePublished) || meta(html, 'article:published_time') || html.match(/<time\b[^>]*datetime\s*=\s*(['"])(.*?)\1[^>]*>/i)?.[2]);
  if (!published) throw new ValidationSkip('缺少可解析的发布时间');
  const headings = dedupe([...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(m => stripTags(m[1])).filter(h => h && h.length < 160 && !['related articles', 'recommended', 'more resources', 'latest articles'].includes(h.toLowerCase()))).slice(0, 8);
  const bullets = dedupe([...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => stripTags(m[1])).filter(b => b.length >= 25 && b.length <= 240 && b.split(/\s+/).length >= 5)).slice(0, 8);
  const detailed = { ...article, title, description, published, headings, bullets, schema_types: itemTypes(schema) };
  detailed.summary = makeSummary(detailed);
  detailed.methods = makeMethods(detailed);
  return detailed;
}
function loadState() {
  if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  return { seen_urls: {}, rejected_urls: {}, runs: [] };
}
function pruneState(state) {
  state.seen_urls ||= {};
  state.rejected_urls ||= {};
  state.runs ||= [];
  for (const url of Object.keys(state.seen_urls)) {
    const source = sourceForUrl(url);
    if (!source || !sourceUrlAllowed(source, url)) {
      state.rejected_urls[url] = {
        last_seen: new Date().toISOString(),
        source: state.seen_urls[url]?.source || source?.name || null,
        reason: 'pruned_by_strict_content_page_rules',
      };
      delete state.seen_urls[url];
    }
  }
}
function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); }
function articleSortKey(a) {
  const t = a.published ? Date.parse(a.published) : NaN;
  return Number.isFinite(t) ? t : 0;
}
function renderReport(newArticles, errors, allFound) {
  ensureDir(REPORT_DIR);
  const now = new Date();
  const stamp = now.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '').replace('T', '_');
  const reportPath = path.join(REPORT_DIR, `seo-aeo-digest-${stamp}.md`);
  const lines = [];
  lines.push('# SEO/AEO 最新观点内容学习 & 方法论沉淀', '');
  lines.push(`- 运行时间：${now.toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 检查来源：${SOURCES.length} 个`);
  lines.push(`- 有效最新内容页：${allFound.length} 篇`);
  lines.push(`- 新文章：${newArticles.length} 篇`, '');
  lines.push('> 抓取规则：只分析通过来源规则和 Article/NewsArticle/BlogPosting 结构化数据校验的内容页；Search Engine Land 使用 RSS Feed 兜底；已记录 URL 不会重复报告。', '');
  if (errors.length) { lines.push('## 抓取异常', ...errors.map(e => `- ${e}`), ''); }
  if (!newArticles.length) {
    lines.push('## 结果', '本次未发现新文章。', '');
  } else {
    const groups = new Map();
    for (const a of newArticles) groups.set(a.source, [...(groups.get(a.source) || []), a]);
    for (const [source, articles] of groups.entries()) {
      lines.push(`## ${source}`, '');
      articles.forEach((a, idx) => {
        lines.push(`### ${idx + 1}. [${a.title}](${a.url})`);
        if (a.published) lines.push(`- 发布时间：${a.published}`);
        lines.push(`- 摘要：${a.summary}`);
        if (a.headings?.length) lines.push(`- 文章结构重点：${a.headings.slice(0, 5).join('；')}`);
        lines.push('- 可执行方法论：');
        for (const method of a.methods || []) lines.push(`  - ${method}`);
        lines.push('');
      });
    }
    lines.push('## 今日行动清单');
    lines.push('1. 选择 1-2 条最相关方法论加入内容 SOP。');
    lines.push('2. 为现有页面补齐答案前置、FAQ/结构化数据、证据来源和内链。');
    lines.push('3. 记录实验页面与指标，安排 2-4 周后复盘。', '');
  }
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}
function githubReportUrl(reportPath) {
  const repo = process.env.GITHUB_REPOSITORY;
  const branch = process.env.GITHUB_REF_NAME || 'main';
  if (!repo) return null;
  const rel = path.relative(ROOT, reportPath).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${repo}/blob/${branch}/${rel}`;
}
function dingTalkText(runInfo, newArticles, reportPath) {
  const reportUrl = githubReportUrl(reportPath);
  const lines = [];
  lines.push('SEO/AEO 每日学习报告');
  lines.push('');
  lines.push(`- 运行时间：${new Date(runInfo.run_at).toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 新文章：${runInfo.new} 篇`);
  lines.push(`- 有效最新内容页：${runInfo.found} 篇`);
  if (runInfo.errors?.length) lines.push(`- 抓取异常：${runInfo.errors.length} 个（详见报告）`);
  lines.push(`- 报告：${reportUrl || path.basename(reportPath)}`);
  lines.push('');
  if (newArticles.length) {
    lines.push('今日重点文章：');
    for (const a of newArticles.slice(0, 8)) {
      lines.push(`- ${a.title}：${a.url}`);
    }
    if (newArticles.length > 8) lines.push(`- 其余 ${newArticles.length - 8} 篇见完整报告`);
    lines.push('');
    lines.push('今日执行建议：');
    lines.push('1. 选 1-2 条方法论加入内容 SOP。');
    lines.push('2. 为重点页面补齐答案前置、FAQ/结构化数据、证据来源和内链。');
    lines.push('3. 记录实验页面指标，2-4 周后复盘。');
  } else {
    lines.push('本次未发现新文章。');
  }
  let text = lines.join('\n');
  if (text.length > 3600) text = text.slice(0, 3500) + '\n\n内容较长，完整信息请查看 GitHub 报告。';
  return text;
}
async function sendDingTalk(runInfo, newArticles, reportPath) {
  const webhook = process.env.DINGTALK_WEBHOOK;
  if (!webhook) {
    console.log('DINGTALK_WEBHOOK is not set; skip DingTalk notification.');
    return;
  }
  const payload = {
    msgtype: 'text',
    text: {
      content: dingTalkText(runInfo, newArticles, reportPath),
    },
    at: { isAtAll: false },
  };
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`DingTalk HTTP ${res.status}: ${body}`);
  let parsed = null;
  try { parsed = JSON.parse(body); } catch {}
  if (parsed && parsed.errcode !== 0) throw new Error(`DingTalk API error ${parsed.errcode}: ${parsed.errmsg || body}`);
  console.log('DingTalk notification sent.');
}
async function main() {
  ensureDir(LOG_DIR); ensureDir(REPORT_DIR);
  const state = loadState();
  pruneState(state);
  const errors = [];
  const allFound = [];
  const newArticles = [];
  for (const source of SOURCES) {
    try {
      let candidates;
      if (source.feedUrl && source.preferFeed) {
        candidates = await fetchFeedArticles(source);
      } else {
        const html = await fetchHtml(source.url, 25000);
        candidates = extractListingArticles(source, html);
      }
      const validLatest = [];
      const detailErrors = [];
      for (const candidate of candidates) {
        const seen = state.seen_urls[candidate.url];
        if (seen) {
          validLatest.push({ ...candidate, title: seen.title || candidate.title, published: seen.published || null, seen: true });
          continue;
        }
        try {
          const detailed = candidate.detailReady ? candidate : await extractArticleDetail(candidate, source);
          validLatest.push({ ...detailed, seen: false });
          state.rejected_urls && delete state.rejected_urls[candidate.url];
        } catch (e) {
          if (e.validation) {
            state.rejected_urls[candidate.url] = { last_seen: new Date().toISOString(), source: source.name, reason: e.message };
          } else {
            detailErrors.push(`${candidate.url} — ${e.message}`);
          }
        }
        await new Promise(r => setTimeout(r, 700));
      }
      validLatest.sort((a, b) => articleSortKey(b) - articleSortKey(a) || a.order - b.order);
      const latestForSource = validLatest.slice(0, source.maxArticles || 10);
      allFound.push(...latestForSource);
      for (const art of latestForSource) {
        if (state.seen_urls[art.url]) continue;
        newArticles.push(art);
        state.seen_urls[art.url] = { first_seen: new Date().toISOString(), title: art.title, source: art.source, published: art.published || null };
      }
      if (detailErrors.length) {
        errors.push(`详情页抓取失败：${source.name} ${detailErrors.length} 个候选，示例：${detailErrors.slice(0, 2).join('；')}`);
      }
    } catch (e) {
      errors.push(`列表页抓取失败：${source.name} ${source.url} — ${e.message}`);
    }
  }
  const report = renderReport(newArticles, errors, allFound);
  const runInfo = { run_at: new Date().toISOString(), found: allFound.length, new: newArticles.length, errors, report };
  try {
    await sendDingTalk(runInfo, newArticles, report);
  } catch (e) {
    const msg = `钉钉推送失败：${e.message}`;
    console.error(msg);
    errors.push(msg);
    runInfo.errors = errors;
  }
  state.runs.push(runInfo);
  state.runs = state.runs.slice(-50);
  saveState(state);
  console.log(JSON.stringify(runInfo, null, 2));
  process.exitCode = 0; // keep Windows Scheduler green; source-level errors are written into the report.
}
await main();







