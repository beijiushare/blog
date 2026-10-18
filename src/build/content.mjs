import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { CONTENT_DIR } from './config.mjs'

export function scanContent () {
  const langs = fs.readdirSync(CONTENT_DIR)
    .filter(d => fs.statSync(path.join(CONTENT_DIR, d)).isDirectory())
  const pages = {}
  const orders = {}
  for (const lang of langs) {
    const map = new Map()
    const ord = new Map()
    orders[lang] = ord
    const walk = dir => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) { walk(full); continue }
        if (ent.name === '_order') {
          const dirRel = path.relative(path.join(CONTENT_DIR, lang), dir).replace(/\\/g, '/')
          ord.set(dirRel, fs.readFileSync(full, 'utf8').split(/\r?\n/)
            .map(l => l.replace(/#.*$/, '').trim()).filter(Boolean)
            .map(l => l.replace(/\/+$/, '').replace(/\.md$/, '')))
          continue
        }
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
  return { langs, pages, orders }
}

export function buildTree (pages, langs, orders) {
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
  const orderFor = dirRel => {
    for (const lang of langs) {
      const arr = orders?.[lang]?.get(dirRel)
      if (arr) return arr
    }
    return []
  }
  const sortNode = node => {
    const ord = orderFor(node.path)
    const kids = [...node.children.values()].sort((a, b) => {
      const ia = ord.indexOf(a.name)
      const ib = ord.indexOf(b.name)
      if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
      return a.name.localeCompare(b.name)
    })
    node.children = new Map(kids.map(k => [k.name, k]))
    for (const k of kids) sortNode(k)
  }
  sortNode(root)
  return root
}

export function unionKeys (pages, langs) {
  const union = new Set()
  for (const lang of langs) for (const k of pages[lang].keys()) union.add(k)
  return union
}
