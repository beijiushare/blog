import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CONTENT_DIR } from './config.mjs'

export function scanContent () {
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

export function buildTree (pages, langs) {
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

export function unionKeys (pages, langs) {
  const union = new Set()
  for (const lang of langs) for (const k of pages[lang].keys()) union.add(k)
  return union
}
