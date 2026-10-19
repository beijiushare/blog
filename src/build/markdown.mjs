import MarkdownIt from 'markdown-it'
import { createHighlighter } from 'shiki'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { esc, BASE, UI } from './config.mjs'

const md = new MarkdownIt({ html: true, linkify: true })

const defaultLinkOpen = md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const i = token.attrIndex('href')
  if (i >= 0) {
    const href = token.attrs[i][1]
    if (/^https?:\/\//.test(href)) {
      if (token.attrIndex('target') === -1) token.attrPush(['target', '_blank'])
      if (token.attrIndex('rel') === -1) token.attrSet('rel', 'noopener')
    } else if (href.startsWith('/') && !href.startsWith('//') && href !== BASE && href.indexOf(BASE + '/') !== 0) {
      token.attrs[i][1] = BASE + href
    }
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

let curLang = 'zh'
const defaultImage = md.renderer.rules.image ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const img = defaultImage(tokens, idx, options, env, self)
  const label = esc((UI[curLang] || UI.zh).imageLoading)
  return `<span class="img-load"><span class="img-load-hint">${label}</span>${img}</span>`
}

let toc = []
const slugSeen = new Map()
md.core.ruler.push('heading_ids', state => {
  toc = []
  let h2c = 0
  let h3c = 0
  let h4c = 0
  state.tokens.forEach((tok, i) => {
    if (tok.type !== 'heading_open') return
    const level = Number(tok.tag.slice(1))
    if (level === 1) {
      h2c = 0
      h3c = 0
      h4c = 0
      return
    }
    if (level < 2 || level > 4) return
    const inline = state.tokens[i + 1]
    const text = inline.content.replace(/<[^>]*>/g, '').trim()
    let slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
    if (!slug) slug = 'h'
    const n = (slugSeen.get(slug) || 0) + 1
    slugSeen.set(slug, n)
    if (n > 1) slug += '-' + n
    let num
    if (level === 2) {
      h2c++
      h3c = 0
      h4c = 0
      num = `${h2c}`
    } else if (level === 3) {
      if (!h2c) h2c = 1
      h3c++
      h4c = 0
      num = `${h2c}.${h3c}`
    } else {
      if (!h2c) h2c = 1
      if (!h3c) h3c = 1
      h4c++
      num = `${h2c}.${h3c}.${h4c}`
    }
    tok.attrSet('id', slug)
    toc.push({ level, text: `${num} ${text}`, slug })
    if (inline.children && inline.children.length) {
      const prefix = new state.Token('text', '', 0)
      prefix.content = `${num} `
      inline.children.unshift(prefix)
    }
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
export async function ensureHighlighter () {
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

export function renderMarkdown (body, lang = 'zh') {
  curLang = lang
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
