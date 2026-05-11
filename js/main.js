/* ============================================================
   main.js — shared navigation, theme toggle, JSON loader
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Theme toggle ---------- */
  const THEME_KEY = 'theme';

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    // Default to dark mode for first-time visitors; respect user choice once toggled.
    const theme = saved || 'dark';
    applyTheme(theme);

    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    btn.addEventListener('click', (ev) => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';

      // View Transitions API: smooth circular reveal centered on the click.
      // Falls back to the existing 0.3s color transition when unsupported.
      const supportsVT = typeof document.startViewTransition === 'function'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!supportsVT) {
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
        return;
      }

      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      document.documentElement.style.setProperty('--vt-x', x + 'px');
      document.documentElement.style.setProperty('--vt-y', y + 'px');
      document.documentElement.style.setProperty('--vt-r', endRadius + 'px');

      const transition = document.startViewTransition(() => {
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0 at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      });
    });
  }

  /* ---------- Hamburger menu ---------- */
  function initMenu() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const panel = document.querySelector('[data-menu-panel]');
    const overlay = document.querySelector('[data-menu-overlay]');
    const closeBtn = document.querySelector('[data-menu-close]');
    if (!toggle || !panel || !overlay) return;

    function open() {
      panel.classList.add('is-open');
      overlay.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function close() {
      panel.classList.remove('is-open');
      overlay.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', open);
    overlay.addEventListener('click', close);
    closeBtn && closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });

    // mark active link
    const path = location.pathname.split('/').pop() || 'index.html';
    panel.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('is-active');
    });
  }

  /* ---------- JSON loader (memo + sessionStorage) ---------- */
  const cache = {};
  async function loadJSON(path) {
    if (cache[path]) return cache[path];
    // sessionStorage hit — instant on cross-page navigation
    try {
      const stored = sessionStorage.getItem('json:' + path);
      if (stored) {
        const parsed = JSON.parse(stored);
        cache[path] = parsed;
        return parsed;
      }
    } catch (_) { /* sessionStorage unavailable */ }
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    const data = await res.json();
    cache[path] = data;
    try { sessionStorage.setItem('json:' + path, JSON.stringify(data)); } catch (_) {}
    return data;
  }

  /* ---------- Inject shared chrome ---------- */
  function injectChrome() {
    // Inject nav if a placeholder is present
    const navMount = document.querySelector('[data-mount-nav]');
    if (navMount) {
      navMount.outerHTML = NAV_HTML;
    }
    const footerMount = document.querySelector('[data-mount-footer]');
    if (footerMount) {
      footerMount.outerHTML = FOOTER_HTML;
    }
  }

  const NAV_HTML = `
    <nav class="topnav" aria-label="Primary">
      <a class="topnav__brand" href="index.html">Young-Seok Lee</a>
      <div class="topnav__actions">
        <button class="icon-btn" data-theme-toggle type="button" aria-label="Toggle theme">
          <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
          </svg>
          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </button>
        <button class="icon-btn" data-menu-toggle type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu-panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </nav>

    <div class="menu-overlay" data-menu-overlay aria-hidden="true"></div>
    <aside class="menu-panel" id="menu-panel" data-menu-panel aria-hidden="true" aria-label="Site navigation">
      <div class="menu-panel__header">
        <span class="menu-panel__title">Menu</span>
        <button class="icon-btn" data-menu-close type="button" aria-label="Close menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <ul class="menu-list">
        <li><a href="index.html"><span class="menu-num">01</span><span>Home</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a></li>
        <li><a href="education.html"><span class="menu-num">02</span><span>Education</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a></li>
        <li><a href="publications.html"><span class="menu-num">03</span><span>Publications &amp; Awards</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a></li>
        <li><a href="research.html"><span class="menu-num">04</span><span>Research</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a></li>
        <li><a href="others.html"><span class="menu-num">05</span><span>Others</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a></li>
        <li><a href="contact.html"><span class="menu-num">06</span><span>Contact</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a></li>
      </ul>
      <div class="menu-panel__footer">© 2020–${new Date().getFullYear()} Young-Seok Lee</div>
    </aside>
  `;

  const FOOTER_HTML = `
    <footer class="site-footer">
      © 2020–<span data-current-year>${new Date().getFullYear()}</span> Young-Seok Lee
    </footer>
  `;

  /* ---------- Helpers exposed globally ---------- */
  window.Portfolio = {
    loadJSON,
    escapeHTML(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    highlightAuthor(authors, me) {
      if (!authors) return '';
      const safe = this.escapeHTML(authors);
      if (!me) return safe;
      const safeMe = this.escapeHTML(me).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return safe.replace(new RegExp(safeMe, 'g'), `<span class="me">${this.escapeHTML(me)}</span>`);
    }
  };

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    injectChrome();
    initTheme();
    initMenu();
  });
})();
