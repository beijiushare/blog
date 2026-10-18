import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import { createHighlighter } from 'shiki'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BASE = '/blog'
const SITE_URL = 'https://beijiushare.github.io/blog'
const CONTENT_DIR = path.join(ROOT, 'content')
const PUBLIC_DIR = path.join(ROOT, 'public')
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8')

const UI = {}
for (const f of fs.readdirSync(ROOT)) {
  if (/^ui\.\w+\.json$/.test(f)) {
    UI[f.slice(3, -5)] = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
  }
}
const DEFAULT_LANG = 'zh'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escXml = s => esc(s).replace(/'/g, '&apos;')

function pageUrl (lang, relPath) {
  if (relPath === 'index') return `${BASE}/${lang}/`
  return `${BASE}/${lang}/${relPath}/`
}

function outFile (lang, relPath) {
  if (relPath === 'index') return path.join(PUBLIC_DIR, lang, 'index.html')
  return path.join(PUBLIC_DIR, lang, relPath, 'index.html')
}

function scanContent () {
  const langs = fs.readdirSync(CONTENT_DIR)
    .filter(d => fs.statSync(path.join(CONTENT_DIR, d)).isDirectory())
  const pages = {}
  for (const lang of langs) {
    const map = new Map()
    const walk = dir => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) { walk(full); continue }
        if (!ent.name.endsWith('.md')) continue
        const rel = path.relative(CONTENT_DIR + path.sep + lang, full).replace(/\\/g, '/').replace(/\.md$/, '')
        const raw = fs.readFileSync(full, 'utf8')
        const { data, content } = matter(raw)
        if (data.draft) continue
        map.set(rel, { data, body: content })
      }
    }
    walk(path.join(CONTENT_DIR, lang))
    pages[lang] = map
  }
  return { langs, pages }
}

function buildTree (pages, langs) {
  const allPaths = new Set()
  for (const lang of langs) for (const p of pages[lang].keys()) allPaths.add(p)
  const root = { name: '', path: '', children: new Map() }
  for (const p of allPaths) {
    const parts = p.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const npath = parts.slice(0, i + 1).join('/')
      if (!node.children.has(name)) node.children.set(name, { name, path: npath, children: new Map(), isPage: false })
      node = node.children.get(name)
      if (i === parts.length - 1) node.isPage = true
    }
  }
  return root
}

function treeHtml (node, lang, pages, currentPath) {
  const kids = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))
  if (!kids.length) return ''
  let html = '<ul>'
  for (const child of kids) {
    const real = pages[lang].get(child.path)
    const title = real?.data?.title || child.name
    if (child.isPage) {
      const active = currentPath === child.path ? ' class="active"' : ''
      const sub = child.children.size ? treeHtml(child, lang, pages, currentPath) : ''
      html += `<li><a href="${pageUrl(lang, child.path)}"${active}>${esc(title)}</a>${sub}</li>`
      continue
    }
    const id = 'tree-' + lang + '-' + child.path.replace(/[^a-zA-Z0-9]+/g, '-')
    const checked = currentPath === child.path || currentPath.startsWith(child.path + '/') ? ' checked' : ''
    const labelInner = real
      ? `<a href="${pageUrl(lang, child.path)}">${esc(title)}</a>`
      : `<span>${esc(child.name)}</span>`
    html += `<li><input class="toggle" type="checkbox" id="${id}"${checked}>` +
      `<label for="${id}">${labelInner}<span class="chevron"></span></label>` +
      treeHtml(child, lang, pages, currentPath) + '</li>'
  }
  return html + '</ul>'
}

const md = new MarkdownIt({ html: true, linkify: true })
let toc = []
const slugSeen = new Map()
md.core.ruler.push('heading_ids', state => {
  toc = []
  state.tokens.forEach((tok, i) => {
    if (tok.type !== 'heading_open') return
    const level = Number(tok.tag.slice(1))
    if (level < 2 || level > 3) return
    const text = state.tokens[i + 1].content.replace(/<[^>]*>/g, '').trim()
    let slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
    if (!slug) slug = 'h'
    const n = (slugSeen.get(slug) || 0) + 1
    slugSeen.set(slug, n)
    if (n > 1) slug += '-' + n
    tok.attrSet('id', slug)
    toc.push({ level, text, slug })
  })
})

function extractMath (src) {
  const stash = []
  const parts = src.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g)
  const out = parts.map((p, i) => {
    if (i % 2 === 1) return p
    return p
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        stash.push({ tex: tex.trim(), display: true })
        return `\n@@MATH${stash.length - 1}@@\n`
      })
      .replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre, tex) => {
        stash.push({ tex: tex.trim(), display: false })
        return `${pre}@@MATH${stash.length - 1}@@`
      })
  })
  return { src: out.join(''), stash }
}

const mjAdaptor = liteAdaptor()
RegisterHTMLHandler(mjAdaptor)
const mjDoc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'local' })
})

function renderMath (tex, display) {
  try {
    const node = mjDoc.convert(tex, { display })
    let out = mjAdaptor.outerHTML(node)
    out = out.replace(/fill="[^"]*"/g, 'fill="currentColor"')
    if (display) out = `<div class="math-block">${out}</div>`
    return out
  } catch {
    return display
      ? `<p class="math-block"><code>${esc(tex)}</code></p>`
      : `<code>${esc(tex)}</code>`
  }
}

let highlighter = null
async function ensureHighlighter () {
  if (highlighter) return highlighter
  highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: ['js', 'ts', 'json', 'html', 'css', 'python', 'bash', 'markdown', 'yaml', 'xml', 'diff', 'txt']
  })
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const lang = (token.info || '').trim().split(/\s+/)[0]
    try {
      return highlighter.codeToHtml(token.content, {
        lang: lang || 'txt',
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false
      }) + '\n'
    } catch {
      return `<pre class="shiki"><code>${esc(token.content)}</code></pre>\n`
    }
  }
  return highlighter
}

function renderMarkdown (body) {
  slugSeen.clear()
  const { src, stash } = extractMath(body)
  let html = md.render(src)
  html = html.replace(/<p>@@MATH(\d+)@@<\/p>/g, (_, i) => {
    const m = stash[+i]
    return renderMath(m.tex, m.display)
  })
  html = html.replace(/@@MATH(\d+)@@/g, (_, i) => {
    const m = stash[+i]
    return renderMath(m.tex, m.display)
  })
  return { html, tocItems: toc.slice() }
}

async function renderPage (lang, relPath, pages, langs, tree, siteTitle) {
  const ui = UI[lang] || UI.zh
  const page = pages[lang].get(relPath)
  const langOptions = langs.map(l => {
    const u = `${BASE}/${l}/${relPath === 'index' ? '' : relPath + '/'}`
    return `<option value="${u}" data-lang="${l}"${l === lang ? ' selected' : ''}>${esc((UI[l] || UI.zh).language[l] || l)}</option>`
  }).join('')
  const alternates = langs.map(l =>
    `<link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/${relPath === 'index' ? '' : relPath + '/'}">`
  ).join('\n    ')

  let title, description, contentHtml, tocItems = []
  if (page) {
    title = page.data.title || (relPath === 'index' ? siteTitle : relPath.split('/').pop())
    description = page.data.description || ''
    const r = renderMarkdown(page.body)
    contentHtml = r.html
    tocItems = r.tocItems
  } else {
    const srcLang = langs.find(l => pages[l].has(relPath)) || langs[0]
    const srcPage = pages[srcLang].get(relPath)
    title = srcPage?.data?.title || (relPath === 'index' ? siteTitle : relPath.split('/').pop())
    description = ''
    contentHtml = `<div class="untranslated"><p>${esc(ui.untranslated)}</p><p><a href="${pageUrl(srcLang, relPath)}">${esc(ui.viewOriginal)}</a></p></div>`
  }

  const tocHtml = tocItems.length
    ? '<ul>' + tocItems.map(t => `<li><a href="#${t.slug}" data-level="${t.level}">${esc(t.text)}</a></li>`).join('') + '</ul>'
    : ''

  const html = TEMPLATE
    .replaceAll('{{HTML_LANG}}', lang)
    .replaceAll('{{TITLE}}', esc(`${title} · ${siteTitle}`))
    .replaceAll('{{DESCRIPTION}}', esc(description))
    .replaceAll('{{BASE}}', BASE)
    .replaceAll('{{LANG}}', lang)
    .replaceAll('{{SITE_TITLE}}', esc(siteTitle))
    .replaceAll('{{ALTERNATES}}', alternates)
    .replaceAll('{{TREE_HTML}}', treeHtml(tree, lang, pages, relPath))
    .replaceAll('{{LANG_OPTIONS}}', langOptions)
    .replaceAll('{{THEME_LIGHT}}', esc(ui.theme.light))
    .replaceAll('{{THEME_DARK}}', esc(ui.theme.dark))
    .replaceAll('{{THEME_AUTO}}', esc(ui.theme.auto))
    .replaceAll('{{CONTENT}}', `<article class="markdown">${contentHtml}</article><aside class="toc">${tocHtml}</aside>`)

  const out = outFile(lang, relPath)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, html)
}

function genRss (lang, pages, siteTitle) {
  const ui = UI[lang] || UI.zh
  const items = []
  for (const [rel, p] of pages[lang]) {
    if (!p.data.date) continue
    const url = `${SITE_URL}/${lang}/${rel === 'index' ? '' : rel + '/'}`
    items.push({
      date: new Date(p.data.date),
      xml: `<item><title>${escXml(p.data.title || rel)}</title><link>${escXml(url)}</link><guid isPermaLink="true">${escXml(url)}</guid><pubDate>${new Date(p.data.date).toUTCString()}</pubDate>${p.data.description ? `<description>${escXml(p.data.description)}</description>` : ''}</item>`
    })
  }
  items.sort((a, b) => b.date - a.date)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escXml(siteTitle)} (${lang})</title><link>${escXml(SITE_URL + '/' + lang + '/')}</link><description>${escXml(ui.siteTitle)}</description><language>${lang}</language>\n${items.map(i => i.xml).join('\n')}\n</channel></rss>`
  const out = path.join(PUBLIC_DIR, lang, 'rss.xml')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, xml)
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/rss+xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' }

function serve (port) {
  const server = http.createServer((req, res) => {
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { res.writeHead(400); res.end(); return }
    if (pathname === '/') { res.writeHead(302, { Location: BASE + '/' + DEFAULT_LANG + '/' }); res.end(); return }
    if (!pathname.startsWith(BASE + '/')) { res.writeHead(404); res.end('404'); return }
    let rel = pathname.slice(BASE.length + 1)
    let file = path.join(PUBLIC_DIR, rel)
    if (rel === '' || rel.endsWith('/')) file = path.join(file, 'index.html')
    if (!path.resolve(file).startsWith(path.resolve(PUBLIC_DIR))) { res.writeHead(403); res.end(); return }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('404 ' + rel); return }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
      res.end(data)
    })
  })
  server.listen(port, () => console.log(`serve: http://localhost:${port}${BASE}/${DEFAULT_LANG}/`))
}

async function main () {
  const t0 = Date.now()
  const siteTitle = UI.zh.siteTitle || 'Blog'
  const { langs, pages } = scanContent()
  const tree = buildTree(pages, langs)
  await ensureHighlighter()

  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true })
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  const union = new Set()
  for (const lang of langs) for (const k of pages[lang].keys()) union.add(k)

  for (const lang of langs) {
    for (const rel of union) {
      await renderPage(lang, rel, pages, langs, tree, siteTitle)
    }
    genRss(lang, pages, siteTitle)
  }

  fs.cpSync(path.join(ROOT, 'static'), path.join(PUBLIC_DIR, 'static'), { recursive: true })
  fs.copyFileSync(path.join(ROOT, 'style.css'), path.join(PUBLIC_DIR, 'style.css'))

  const rootHtml = `<!DOCTYPE html><html lang="${DEFAULT_LANG}"><head><meta charset="utf-8"><title>${esc(siteTitle)}</title><meta http-equiv="refresh" content="0;url=${BASE}/${DEFAULT_LANG}/"><script>try{var l=localStorage.getItem('lang');if(!l){l=(navigator.language||'').toLowerCase().indexOf('zh')===0?'zh':'en'};location.replace(l+'/')}catch(e){location.replace('${DEFAULT_LANG}/')}</script></head><body></body></html>`
  fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), rootHtml)

  const pageCount = union.size * langs.length
  console.log(`build: ${pageCount} pages, ${langs.length} langs (${langs.join(', ')}), ${Date.now() - t0}ms`)

  const serveArg = process.argv.indexOf('--serve')
  if (serveArg !== -1) {
    const port = Number(process.argv[serveArg + 1]) || 4321
    serve(port)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
