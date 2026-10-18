/* app.js — theme / language / TOC highlight / htmx animation binding */
(function () {
  var docEl = document.documentElement

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  function applyTheme (t) {
    docEl.setAttribute('data-theme', t)
    try { localStorage.setItem('theme', t) } catch (e) {}
    syncThemeControls()
  }

  function swipeTheme (t) {
    if (!document.startViewTransition || prefersReduced.matches) {
      applyTheme(t)
      return
    }
    var transition
    try {
      transition = document.startViewTransition(function () { applyTheme(t) })
    } catch (e) {
      applyTheme(t)
      return
    }
    transition.ready.then(function () {
      docEl.animate(
        {
          clipPath: [
            'polygon(0 -10%, 100% -10%, 100% -10%, 0 -10%)',
            'polygon(0 -10%, 100% -10%, 100% 110%, 0 110%)'
          ]
        },
        {
          duration: 650,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)'
        }
      )
    }).catch(function () {})
    transition.finished.catch(function () {})
  }

  function syncThemeControls () {
    var t = docEl.getAttribute('data-theme') || 'light'
    var s = document.getElementById('theme-select')
    if (s) s.value = t
    var seg = document.getElementById('theme-seg')
    if (seg) markSeg(seg, t)
  }

  function markSeg (seg, v) {
    var bs = seg.querySelectorAll('button')
    for (var i = 0; i < bs.length; i++) {
      bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-value') === v ? 'true' : 'false')
    }
  }

  /* segmented controls built from the selects (desktop shows seg, mobile keeps selects) */
  function buildSegs () {
    var controls = document.getElementById('controls')
    if (!controls || controls.querySelector('.seg')) return
    var pairs = [['lang-select', 'lang-seg'], ['theme-select', 'theme-seg']]
    for (var i = 0; i < pairs.length; i++) {
      var sel = document.getElementById(pairs[i][0])
      if (!sel) continue
      var seg = document.createElement('div')
      seg.className = 'seg'
      seg.id = pairs[i][1]
      seg.setAttribute('role', 'group')
      var al = sel.getAttribute('aria-label')
      if (al) seg.setAttribute('aria-label', al)
      for (var j = 0; j < sel.options.length; j++) {
        var o = sel.options[j]
        var b = document.createElement('button')
        b.type = 'button'
        b.textContent = o.textContent
        b.setAttribute('data-value', o.value)
        var dl = o.getAttribute('data-lang')
        if (dl) b.setAttribute('data-lang', dl)
        b.setAttribute('aria-pressed', o.selected ? 'true' : 'false')
        seg.appendChild(b)
      }
      controls.insertBefore(seg, sel)
    }
    controls.classList.add('seg-on')
  }

  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return
    var b = e.target.closest('button[data-value]')
    if (!b || !b.parentNode || !b.parentNode.classList.contains('seg')) return
    var seg = b.parentNode
    if (seg.id === 'theme-seg') {
      swipeTheme(b.getAttribute('data-value'))
    } else if (seg.id === 'lang-seg') {
      var lang = b.getAttribute('data-lang')
      if (!lang) return
      try { localStorage.setItem('lang', lang) } catch (err) {}
      var s = document.getElementById('lang-select')
      if (s) {
        for (var i = 0; i < s.options.length; i++) {
          if (s.options[i].getAttribute('data-lang') === lang) { location.href = s.options[i].value; return }
        }
      }
    }
  })

  /* lang options live in topbar (outside swap area): rebuild values for current path */
  function syncLangOptions () {
    var s = document.getElementById('lang-select')
    if (!s) return
    var base = docEl.getAttribute('data-base') || ''
    var p = location.pathname
    if (base && p.indexOf(base + '/') === 0) p = p.slice(base.length + 1)
    else p = p.replace(/^\//, '')
    var seg = p.split('/')
    var lang = seg.shift()
    var rel = seg.join('/')
    if (!lang) return
    for (var i = 0; i < s.options.length; i++) {
      var o = s.options[i]
      var l = o.getAttribute('data-lang')
      if (l) o.value = base + '/' + l + '/' + rel
    }
  }

  /* per-path scroll memory for the middle pane (window no longer scrolls) */
  function paneEl () { return document.querySelector('#content>article') }

  var saveTimer = null
  function scheduleScrollSave () {
    if (saveTimer) return
    saveTimer = setTimeout(function () {
      saveTimer = null
      var a = paneEl()
      if (!a || a.scrollHeight <= a.clientHeight + 2) return
      try { sessionStorage.setItem('paneScroll:' + location.pathname, String(a.scrollTop)) } catch (e) {}
    }, 150)
  }

  function restoreScroll () {
    var a = paneEl()
    if (!a || location.hash) return
    var v = null
    try { v = sessionStorage.getItem('paneScroll:' + location.pathname) } catch (e) {}
    if (!v) return
    var prev = a.style.scrollBehavior
    a.style.scrollBehavior = 'auto'
    a.scrollTop = parseInt(v, 10) || 0
    a.style.scrollBehavior = prev
  }

  document.addEventListener('scroll', function (e) {
    if (e.target && e.target.tagName === 'ARTICLE') scheduleScrollSave()
  }, true)

  /* delegated change binding: survives htmx swap (nodes rebuilt each page) */
  document.addEventListener('change', function (e) {
    var el = e.target
    if (!el || !el.id) return
    if (el.id === 'theme-select') {
      swipeTheme(el.value)
    } else if (el.id === 'lang-select') {
      var opt = el.options[el.selectedIndex]
      try { localStorage.setItem('lang', opt.getAttribute('data-lang') || opt.value) } catch (err) {}
      location.href = el.value
    }
  })

  /* ---- keyboard scroll for middle pane (page is locked on desktop) ---- */
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    var tag = (e.target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button' || e.target.isContentEditable) return
    var c = paneEl()
    if (!c || c.scrollHeight <= c.clientHeight + 2) return
    var k = e.key
    if (k === 'Home') { e.preventDefault(); c.scrollTop = 0; return }
    if (k === 'End') { e.preventDefault(); c.scrollTop = c.scrollHeight; return }
    var dir = 0
    if (k === ' ' || k === 'PageDown' || k === 'ArrowDown') dir = 1
    else if (k === 'PageUp' || k === 'ArrowUp') dir = -1
    if (!dir) return
    e.preventDefault()
    var step = (k === 'PageDown' || k === 'PageUp') ? c.clientHeight * 0.9
      : (k === ' ' ? 100 : 60)
    c.scrollTop += dir * step
  })

  /* ---- TOC highlight (IntersectionObserver) ---- */
  var tocObserver = null
  function initToc () {
    if (tocObserver) { tocObserver.disconnect(); tocObserver = null }
    var content = document.getElementById('content')
    if (!content) return
    var toc = content.querySelector('.toc')
    if (!toc) return
    var links = toc.querySelectorAll('a[href^="#"]')
    if (!links.length) return
    var byId = {}
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a })
    var headings = content.querySelectorAll('.markdown h2[id], .markdown h3[id], .markdown h4[id]')
    if (!headings.length) return
    var visible = new Set()
    tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible.add(en.target.id)
        else visible.delete(en.target.id)
      })
      var best = null
      headings.forEach(function (h) {
        if (best) return
        if (visible.has(h.id)) best = h.id
      })
      links.forEach(function (a) { a.classList.remove('active') })
      if (best && byId[best]) byId[best].classList.add('active')
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 })
    headings.forEach(function (h) { tocObserver.observe(h) })
  }

  /* ---- htmx: swap animation + TOC re-init + menu close + active tree update ---- */
  function contentEl () { return document.getElementById('content') }

  function clearFade () {
    var c = contentEl()
    if (c) c.classList.remove('htmx-swapping', 'htmx-added')
  }

  document.body.addEventListener('htmx:afterSwap', function () {
    var mc = document.getElementById('menu-control')
    if (mc) mc.checked = false
    initControls()
    restoreScroll()
    initToc()
    updateTreeActive()
  })

  document.body.addEventListener('htmx:historyRestore', function () {
    setTimeout(function () { restoreScroll(); initToc() }, 0)
  })

  document.body.addEventListener('htmx:responseError', clearFade)
  document.body.addEventListener('htmx:sendError', clearFade)
  document.body.addEventListener('htmx:afterRequest', function (e) {
    if (e.detail && e.detail.successful === false) clearFade()
  })

  function updateTreeActive () {
    var path = location.pathname
    document.querySelectorAll('.tree a.active').forEach(function (a) { a.classList.remove('active') })
    var match = null
    document.querySelectorAll('.tree a[href]').forEach(function (a) {
      var href = a.getAttribute('href')
      if (!href || href.charAt(0) === '#') return
      var clean = href.replace(/\/$/, '')
      if (path.replace(/\/$/, '') === clean) match = a
    })
    if (match) match.classList.add('active')
  }

  /* ---- init ---- */
  function initControls () {
    syncThemeControls()
    syncLangOptions()
    buildSegs()
  }
  initControls()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initControls(); initToc(); restoreScroll() })
  } else {
    initToc()
    restoreScroll()
  }
})()
