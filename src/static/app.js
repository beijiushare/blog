/* app.js — theme / language / TOC highlight / htmx animation binding */
(function () {
  var docEl = document.documentElement
  var themeSelect = document.getElementById('theme-select')
  var langSelect = document.getElementById('lang-select')
  var menuControl = document.getElementById('menu-control')

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

  if (themeSelect) {
    try {
      var stored = localStorage.getItem('theme')
      if (stored) themeSelect.value = stored
    } catch (e) {}
    themeSelect.addEventListener('change', function () {
      swipeTheme(themeSelect.value)
    })
  }

  if (langSelect) {
    langSelect.addEventListener('change', function () {
      var opt = langSelect.options[langSelect.selectedIndex]
      try { localStorage.setItem('lang', opt.getAttribute('data-lang') || opt.value) } catch (e) {}
      location.href = langSelect.value
    })
  }

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
    if (menuControl) menuControl.checked = false
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToc)
  } else {
    initToc()
  }
})()
