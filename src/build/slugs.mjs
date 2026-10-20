import path from 'node:path'
import { pinyin } from 'pinyin-pro'
import { BASE, PUBLIC_DIR, SITE_URL } from './config.mjs'

const maps = new Map()

function pinyinSlug (s) {
  return pinyin(String(s), { toneType: 'none', type: 'array', nonZh: 'consecutive' })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function englishSlug (s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function dateStamp (date) {
  if (!date) return ''
  const d = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, '') : ''
}

export function initSlugs (pages, langs) {
  maps.clear()
  for (const lang of langs) {
    const map = new Map()
    maps.set(lang, map)
    const dates = new Map()
    for (const [rel, p] of pages[lang]) dates.set(rel, p.data.date)
    const conv = lang === 'en' ? englishSlug : pinyinSlug
    const dirs = new Map()
    const takenDirs = new Set()
    const takenPages = new Set()
    for (const rel of [...pages[lang].keys()].sort()) {
      if (rel === 'index') { map.set(rel, ''); continue }
      const parts = rel.split('/')
      const slugs = []
      for (let i = 0; i < parts.length - 1; i++) {
        const dirRel = parts.slice(0, i + 1).join('/')
        let s = dirs.get(dirRel)
        if (!s) {
          const base = conv(parts[i]) || 'dir'
          s = base
          let n = 2
          while (takenDirs.has([...slugs, s].join('/'))) s = `${base}-${n++}`
          takenDirs.add([...slugs, s].join('/'))
          dirs.set(dirRel, s)
        }
        slugs.push(s)
      }
      const tail = conv(parts[parts.length - 1]) || 'page'
      const date = lang === 'en' ? '' : dateStamp(dates.get(rel))
      const base = tail + (date ? '-' + date : '')
      let s = base
      let n = 2
      while (takenPages.has([...slugs, s].join('/'))) s = `${base}-${n++}`
      takenPages.add([...slugs, s].join('/'))
      slugs.push(s)
      map.set(rel, slugs.join('/'))
    }
  }
}

export function slugPath (lang, relPath) {
  if (relPath === 'index') return ''
  return maps.get(lang)?.get(relPath) || relPath
}

export function pagePath (lang, relPath) {
  const s = slugPath(lang, relPath)
  return s ? `${lang}/${s}/` : `${lang}/`
}

export function pageUrl (lang, relPath) {
  return `${BASE}/${pagePath(lang, relPath)}`
}

export function sitePageUrl (lang, relPath) {
  return `${SITE_URL}/${pagePath(lang, relPath)}`
}

export function outFile (lang, relPath) {
  return path.join(PUBLIC_DIR, lang, slugPath(lang, relPath), 'index.html')
}
