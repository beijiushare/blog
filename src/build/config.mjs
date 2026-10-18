import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const BASE = '/blog'
export const SITE_URL = 'https://beijiushare.github.io/blog'
export const DEFAULT_LANG = 'zh'
export const CONTENT_DIR = path.join(ROOT, 'content')
export const PUBLIC_DIR = path.join(ROOT, 'public')
export const TEMPLATE_PATH = path.join(ROOT, 'src', 'template.html')
export const UI_DIR = path.join(ROOT, 'src', 'locales')
export const STATIC_DIR = path.join(ROOT, 'src', 'static')
export const STYLE_DIR = path.join(ROOT, 'src', 'styles')

export const TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8')

export const UI = {}
for (const f of fs.readdirSync(UI_DIR)) {
  if (/^ui\.\w+\.json$/.test(f)) {
    UI[f.slice(3, -5)] = JSON.parse(fs.readFileSync(path.join(UI_DIR, f), 'utf8'))
  }
}

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const escXml = s => esc(s).replace(/'/g, '&apos;')

export function pageUrl (lang, relPath) {
  if (relPath === 'index') return `${BASE}/${lang}/`
  return `${BASE}/${lang}/${relPath}/`
}

export function outFile (lang, relPath) {
  if (relPath === 'index') return path.join(PUBLIC_DIR, lang, 'index.html')
  return path.join(PUBLIC_DIR, lang, relPath, 'index.html')
}
