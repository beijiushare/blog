/* app.js — theme / language / TOC highlight / htmx animation binding */
(function () {
  var docEl = document.documentElement

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  function applyTheme (t) {
    docEl.setAttribute('data-theme', t)
    try { localStorage.setItem('theme', t) } catch (e) {}
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

  function syncThemeSelect () {
    var s = document.getElementById('theme-select')
    if (s) s.value = docEl.getAttribute('data-theme') || 'light'
  }

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
    var c = document.getElementById('content')
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
    var headings = content.querySelectorAll('.markdown h2[id], .markdown h3[id]')
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
    syncThemeSelect()
    initToc()
    updateTreeActive()
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
  syncThemeSelect()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { syncThemeSelect(); initToc() })
  } else {
    initToc()
  }
})()
