import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { BASE, DEFAULT_LANG, PUBLIC_DIR } from './config.mjs'

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.xml': 'application/rss+xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' }

export function serve (port) {
  const server = http.createServer((req, res) => {
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { res.writeHead(400); res.end(); return }
    if (pathname === '/') { res.writeHead(302, { Location: BASE + '/' + DEFAULT_LANG + '/' }); res.end(); return }
    if (!pathname.startsWith(BASE + '/')) { res.writeHead(404); res.end('404'); return }
    let rel = pathname.slice(BASE.length + 1)
    let file = path.join(PUBLIC_DIR, rel)
    if (rel === '' || rel.endsWith('/')) file = path.join(file, 'index.html')
    if (!path.resolve(file).startsWith(path.resolve(PUBLIC_DIR))) { res.writeHead(403); res.end(); return }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('404 ' + rel); return }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
      res.end(data)
    })
  })
  server.listen(port, () => console.log(`serve: http://localhost:${port}${BASE}/${DEFAULT_LANG}/`))
}
