import fs from 'node:fs'
import path from 'node:path'
import { BASE, SITE_URL, TEMPLATE, ASSET_Q, UI, esc, pageUrl, outFile, REPO } from './config.mjs'
import { renderMarkdown } from './markdown.mjs'

export function treeHtml (node, lang, pages, currentPath, depth = 0) {
  const kids = [...node.children.values()]
  if (!kids.length) return ''
  let html = '<ul>'
  for (const child of kids) {
    const real = pages[lang].get(child.path)
    const title = real?.data?.title || child.name
    if (child.isPage) {
      const active = currentPath === child.path ? ' class="active"' : ''
      const sub = child.children.size ? treeHtml(child, lang, pages, currentPath, depth + 1) : ''
      html += `<li><a href="${pageUrl(lang, child.path)}" title="${esc(title)}"${active}>${esc(title)}</a>${sub}</li>`
      continue
    }
    const id = 'tree-' + lang + '-' + child.path.replace(/[^a-zA-Z0-9]+/g, '-')
    const checked = depth === 0 || currentPath === child.path || currentPath.startsWith(child.path + '/') ? ' checked' : ''
    const labelInner = real
      ? `<a href="${pageUrl(lang, child.path)}" title="${esc(title)}">${esc(title)}</a>`
      : `<span title="${esc(child.name)}">${esc(child.name)}</span>`
    html += `<li><input class="toggle" type="checkbox" id="${id}"${checked}>` +
      `<label for="${id}"><span class="chevron"></span>${labelInner}</label>` +
      treeHtml(child, lang, pages, currentPath, depth + 1) + '</li>'
  }
  return html + '</ul>'
}

export async function renderPage (lang, relPath, pages, langs, tree, siteTitle) {
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
    const d = page.data.date
    const dateStr = d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : ''
    const editLang = page.data.__gen ? 'zh' : lang
    const meta = '<div class="page-meta">' +
      (dateStr ? `<time datetime="${dateStr}">${dateStr}</time>` : '<span></span>') +
      `<a href="https://github.com/${REPO}/edit/master/content/${editLang}/${relPath}.md" target="_blank" rel="noopener">${esc(ui.editPage)}</a></div>`
    contentHtml = contentHtml.includes('</h1>') ? contentHtml.replace('</h1>', '</h1>' + meta) : meta + contentHtml
    const pageUrlAbs = `${SITE_URL}/${lang}/${relPath === 'index' ? '' : relPath + '/'}`
    const attribution = `${ui.copyFrom}${siteTitle}-${title}\n${ui.permalink}${pageUrlAbs}\n${ui.credit}`
    contentHtml +=
      `<div class="page-footer" data-attribution="${esc('\n' + attribution)}">` +
      `<p>${esc(ui.credit)}：${esc(siteTitle)}-${esc(title)}</p>` +
      `<p>${esc(ui.permalink)}<a href="${pageUrlAbs}" target="_blank" rel="noopener">${esc(pageUrlAbs)}</a></p>` +
      '</div>'
  } else {
    const srcLang = langs.find(l => pages[l].has(relPath)) || langs[0]
    const srcPage = pages[srcLang].get(relPath)
    title = srcPage?.data?.title || (relPath === 'index' ? siteTitle : relPath.split('/').pop())
    description = ''
    contentHtml = `<div class="untranslated"><p>${esc(ui.untranslated)}</p><p><a href="${pageUrl(srcLang, relPath)}">${esc(ui.viewOriginal)}</a></p></div>`
  }

  function tocHtml (items) {
    if (!items.length) return ''
    const roots = []
    let g2 = null
    let g3 = null
    for (const t of items) {
      if (t.level === 2) {
        g2 = { t, subs: [] }
        roots.push(g2)
        g3 = null
      } else if (t.level === 3) {
        if (!g2) { g2 = { t: null, subs: [] }; roots.push(g2) }
        g3 = { t, kids: [] }
        g2.subs.push(g3)
      } else {
        if (!g2) { g2 = { t: null, subs: [] }; roots.push(g2) }
        if (!g3) { g3 = { t: null, kids: [] }; g2.subs.push(g3) }
        g3.kids.push(t)
      }
    }
    const a = t => `<a href="#${t.slug}" title="${esc(t.text)}">${esc(t.text)}</a>`
    const li = t => `<li>${a(t)}</li>`
    return '<ul>' + roots.map(g => {
      const subs = g.subs.map(s => {
        const kids = s.kids.map(li).join('')
        return s.t
          ? `<li>${a(s.t)}${kids ? `<ul>${kids}</ul>` : ''}</li>`
          : kids
      }).join('')
      return g.t
        ? `<li>${a(g.t)}${subs ? `<ul>${subs}</ul>` : ''}</li>`
        : subs
    }).join('') + '</ul>'
  }
  const toc = tocHtml(tocItems)

  const html = TEMPLATE
    .replaceAll('{{HTML_LANG}}', lang)
    .replaceAll('{{TITLE}}', esc(`${title} · ${siteTitle}`))
    .replaceAll('{{DESCRIPTION}}', esc(description))
    .replaceAll('{{BASE}}', BASE)
    .replaceAll('{{ASSET_Q}}', ASSET_Q)
    .replaceAll('{{LANG}}', lang)
    .replaceAll('{{SITE_TITLE}}', esc(siteTitle))
    .replaceAll('{{ALTERNATES}}', alternates)
    .replaceAll('{{TREE_HTML}}', treeHtml(tree, lang, pages, relPath))
    .replaceAll('{{LANG_OPTIONS}}', langOptions)
    .replaceAll('{{THEME_LIGHT}}', esc(ui.theme.light))
    .replaceAll('{{THEME_DARK}}', esc(ui.theme.dark))
    .replaceAll('{{THEME_AUTO}}', esc(ui.theme.auto))
    .replaceAll('{{CONTENT}}', `<article class="markdown">${contentHtml}</article>`)
    .replaceAll('{{TOC}}', toc)

  const out = outFile(lang, relPath)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, html)
}
