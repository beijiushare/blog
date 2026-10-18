import fs from 'node:fs'
import path from 'node:path'
import { BASE, DEFAULT_LANG, PUBLIC_DIR, STATIC_DIR, STYLE_DIR, UI, esc } from './config.mjs'
import { scanContent, buildTree, unionKeys } from './content.mjs'
import { ensureHighlighter } from './markdown.mjs'
import { renderPage } from './page.mjs'
import { genRss } from './rss.mjs'
import { serve } from './serve.mjs'

async function main () {
  const t0 = Date.now()
  const siteTitle = UI.zh.siteTitle || 'Blog'
  const { langs, pages } = scanContent()
  const tree = buildTree(pages, langs)
  await ensureHighlighter()

  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true })
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  const union = unionKeys(pages, langs)

  for (const lang of langs) {
    for (const rel of union) {
      await renderPage(lang, rel, pages, langs, tree, siteTitle)
    }
    genRss(lang, pages)
  }

  fs.cpSync(STATIC_DIR, path.join(PUBLIC_DIR, 'static'), { recursive: true })
  const cssFiles = fs.readdirSync(STYLE_DIR).filter(f => f.endsWith('.css')).sort()
  const css = cssFiles.map(f => fs.readFileSync(path.join(STYLE_DIR, f), 'utf8')).join('\n')
  fs.writeFileSync(path.join(PUBLIC_DIR, 'style.css'), css)

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
