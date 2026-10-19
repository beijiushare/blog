import fs from 'node:fs'
import path from 'node:path'
import { SITE_URL, PUBLIC_DIR, UI, escXml } from './config.mjs'

function rssSummary (p) {
  if (p.data.description) return p.data.description
  const text = p.body
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~|-]+/g, ' ')
    .replace(/\{\{<[^>]*>\}\}|\{\{[^}]*\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 200) + (text.length > 200 ? '…' : '')
}

const ORIGIN = new URL(SITE_URL).origin

function rssContent (p) {
  if (!p.renderedHtml) return ''
  const html = p.renderedHtml
    .replace(/<span class="img-load-hint">[^<]*<\/span>/g, '')
    .replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, '')
    .replace(/(href|src)="\/(?!\/)/g, `$1="${ORIGIN}/`)
    .replace(/]]>/g, ']]]]><![CDATA[>')
  return `<content:encoded><![CDATA[${html}]]></content:encoded>`
}

export function genRss (lang, pages) {
  const ui = UI[lang] || UI.zh
  const selfUrl = `${SITE_URL}/${lang}/rss.xml`
  const items = []
  for (const [rel, p] of pages[lang]) {
    if (!p.data.date) continue
    if (/^tests(\/|$)/.test(rel)) continue
    const url = `${SITE_URL}/${lang}/${rel === 'index' ? '' : rel + '/'}`
    items.push({
      date: new Date(p.data.date),
      xml: `<item><title>${escXml(p.data.title || rel)}</title><link>${escXml(url)}</link><guid isPermaLink="true">${escXml(url)}</guid><pubDate>${new Date(p.data.date).toUTCString()}</pubDate><description>${escXml(rssSummary(p))}</description>${rssContent(p)}</item>`
    })
  }
  items.sort((a, b) => b.date - a.date)
  const lastBuild = items.length ? items[0].date.toUTCString() : new Date().toUTCString()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${escXml(ui.siteTitle)} (${lang})</title><link>${escXml(SITE_URL + '/' + lang + '/')}</link><description>${escXml(ui.siteTitle)}</description><language>${lang}</language><generator>blog build</generator><lastBuildDate>${lastBuild}</lastBuildDate><ttl>60</ttl><atom:link rel="self" type="application/rss+xml" href="${escXml(selfUrl)}"/>\n${items.map(i => i.xml).join('\n')}\n</channel></rss>`
  const out = path.join(PUBLIC_DIR, lang, 'rss.xml')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, xml)
}
