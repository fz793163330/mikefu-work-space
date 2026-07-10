import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCES = [
  { name: 'Search Engine Journal - SEO', url: 'https://www.searchenginejournal.com/category/seo/', allowedHost: 'www.searchenginejournal.com' },
  { name: 'Search Engine Land - SEO', url: 'https://searchengineland.com/library/seo', allowedHost: 'searchengineland.com' },
];

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const STATE_FILE = path.join(ROOT, 'seo_automation_state.json');
const REPORT_DIR = path.join(ROOT, 'reports');
const LOG_DIR = path.join(ROOT, 'logs');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 CodexSEOAutomation/1.0';
const STOPWORDS = new Set(`a an and are as at be by for from has have how in into is it its of on or that the this to was what when where who why will with you your about after all also can more most new not over search seo google content marketing site sites page pages website websites ai aeo users user their they them there these those using use used via we our`.split(/\s+/));

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function cleanText(s = '') { return decodeEntities(String(s)).replace(/\s+/g, ' ').trim(); }
function decodeEntities(s) {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (orig, ent) => {
    if (ent[0] === '#') {
      const n = ent[1]?.toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : orig;
    }
    return Object.prototype.hasOwnProperty.call(map, ent) ? map[ent] : orig;
  });
}
function stripTags(html = '') {
  return cleanText(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' '));
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
  const m = tag.match(re);
  return m ? decodeEntities(m[2].trim()) : null;
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
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
function extractListingArticles(source, html) {
  const out = new Map();
  const anchorRe = /<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href = decodeEntities(m[2].trim());
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    let abs;
    try { abs = canonicalize(new URL(href, source.url).toString()); } catch { continue; }
    const u = new URL(abs);
    if (u.hostname.toLowerCase() !== source.allowedHost.toLowerCase()) continue;
    const lowerPath = u.pathname.toLowerCase();
    if (['/author/', '/category/', '/library/seo', '/tag/', '/page/', '/events', '/webinars', '/about', '/contact', '/advertise', '/newsletter', '/legal'].some(x => lowerPath.includes(x))) continue;
    if (path.basename(u.pathname).includes('.')) continue;
    let text = stripTags(m[3]).replace(/^(read more|learn more|continue reading)\b/i, '').trim();
    text = text.replace(/\s*[|–-]\s*Search Engine (Journal|Land).*$/i, '').trim();
    if (text.length < 12 || text.length > 180 || text.split(/\s+/).length < 3) continue;
    if (!out.has(abs)) out.set(abs, { source: source.name, title: text, url: abs });
  }
  const jsonUrlRe = /"url"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]+)*)"/gi;
  for (const m of html.matchAll(jsonUrlRe)) {
    let abs = m[1].replace(/\\\//g, '/');
    try { abs = canonicalize(abs); } catch { continue; }
    const u = new URL(abs);
    if (u.hostname.toLowerCase() !== source.allowedHost.toLowerCase()) continue;
    if (['/author/', '/category/', '/tag/'].some(x => u.pathname.toLowerCase().includes(x))) continue;
    if (!out.has(abs)) {
      const slug = path.basename(u.pathname).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (slug) out.set(abs, { source: source.name, title: slug, url: abs });
    }
  }
  return [...out.values()].slice(0, 20);
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
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}
function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const norm = item.toLowerCase().replace(/\W+/g, ' ').trim();
    if (norm && !seen.has(norm)) { seen.add(norm); out.push(item); }
  }
  return out;
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
async function extractArticleDetail(article) {
  const html = await fetchHtml(article.url, 20000);
  const title = meta(html, 'og:title') || firstMatch(html, [/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, /<title\b[^>]*>([\s\S]*?)<\/title>/i]) || article.title;
  const description = meta(html, 'description') || meta(html, 'og:description');
  let published = meta(html, 'article:published_time');
  if (!published) published = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || null;
  if (!published) published = html.match(/<time\b[^>]*datetime\s*=\s*(['"])(.*?)\1[^>]*>/i)?.[2] || null;
  const headings = dedupe([...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(m => stripTags(m[1])).filter(h => h && h.length < 160 && !['related articles', 'recommended', 'more resources'].includes(h.toLowerCase()))).slice(0, 8);
  const bullets = dedupe([...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => stripTags(m[1])).filter(b => b.length >= 25 && b.length <= 240 && b.split(/\s+/).length >= 5)).slice(0, 8);
  const detailed = { ...article, title, description, published: normalizeDate(published), headings, bullets };
  detailed.summary = makeSummary(detailed);
  detailed.methods = makeMethods(detailed);
  return detailed;
}
function loadState() {
  if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  return { seen_urls: {}, runs: [] };
}
function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); }
function renderReport(newArticles, errors, allFound) {
  ensureDir(REPORT_DIR);
  const now = new Date();
  const stamp = now.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '').replace('T', '_');
  const reportPath = path.join(REPORT_DIR, `seo-aeo-digest-${stamp}.md`);
  const lines = [];
  lines.push('# SEO/AEO 最新观点内容学习 & 方法论沉淀', '');
  lines.push(`- 运行时间：${now.toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 检查来源：${SOURCES.length} 个`);
  lines.push(`- 发现列表文章：${allFound.length} 篇`);
  lines.push(`- 新文章：${newArticles.length} 篇`, '');
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
async function main() {
  ensureDir(LOG_DIR); ensureDir(REPORT_DIR);
  const state = loadState();
  state.seen_urls ||= {};
  state.runs ||= [];
  const errors = [];
  const allFound = [];
  const newArticles = [];
  for (const source of SOURCES) {
    try {
      const html = await fetchHtml(source.url, 25000);
      const listing = extractListingArticles(source, html);
      allFound.push(...listing);
      for (const art of listing) {
        if (state.seen_urls[art.url]) continue;
        let detailed;
        try { detailed = await extractArticleDetail(art); }
        catch (e) {
          detailed = { ...art };
          detailed.summary = makeSummary(detailed);
          detailed.methods = makeMethods(detailed);
          errors.push(`详情页抓取失败：${art.url} — ${e.message}`);
        }
        newArticles.push(detailed);
        state.seen_urls[art.url] = { first_seen: new Date().toISOString(), title: detailed.title, source: detailed.source, published: detailed.published || null };
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (e) {
      errors.push(`列表页抓取失败：${source.name} ${source.url} — ${e.message}`);
    }
  }
  const report = renderReport(newArticles, errors, allFound);
  const runInfo = { run_at: new Date().toISOString(), found: allFound.length, new: newArticles.length, errors, report };
  state.runs.push(runInfo);
  state.runs = state.runs.slice(-50);
  saveState(state);
  console.log(JSON.stringify(runInfo, null, 2));
  process.exitCode = 0; // keep Windows Scheduler green; source-level errors are written into the report.
}
await main();

