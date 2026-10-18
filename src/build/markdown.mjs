import MarkdownIt from 'markdown-it'
import { createHighlighter } from 'shiki'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { esc } from './config.mjs'

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

export function renderMarkdown (body) {
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
