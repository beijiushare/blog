import fs from 'node:fs'
import path from 'node:path'
import { BASE, SITE_URL, TEMPLATE, UI, esc, pageUrl, outFile } from './config.mjs'
import { renderMarkdown } from './markdown.mjs'

export function treeHtml (node, lang, pages, currentPath) {
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
