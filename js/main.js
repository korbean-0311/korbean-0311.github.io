/* ============================================================
   main.js — shared navigation, theme toggle, "show more", scroll-spy
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Site map ----------
     Three top-level pages. "Academics" is one long page whose five sections
     are exposed as anchor links in the desktop dropdown, the mobile panel and
     the sidebar index. Keep NAV_SECTIONS in sync with ACADEMIC_SECTIONS in
     scripts/build-prerender.mjs (same ids, same order). */
  const ACADEMICS_PAGE = 'academics.html';
  const ACADEMICS_LABEL = 'Academics';
  const NAV_SECTIONS = [
    ['education', 'Education'],
    ['publications', 'Publications'],
    ['awards', 'Awards &amp; Honors'],
    ['research', 'Research'],
    ['others', 'Others'],
  ];

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
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ }
    // Light is the design target and the default for everyone (the OS dark
    // preference is deliberately ignored); an explicit toggle is remembered.
    applyTheme(saved || 'light');

    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      const persist = () => { try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ } };

      // View Transitions API: smooth circular reveal centered on the click.
      // Falls back to the existing 0.3s color transition when unsupported.
      const supportsVT = typeof document.startViewTransition === 'function'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!supportsVT) {
        applyTheme(next);
        persist();
        return;
      }

      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(() => {
        applyTheme(next);
        persist();
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

  /* ---------- Nav: desktop links + dropdown, mobile hamburger panel ---------- */
  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function initMenu() {
    // Mark the active top-level link in BOTH navs (side panel for mobile,
    // .topnav__links for desktop). Only one is visible at a time, but marking
    // both keeps state consistent if the viewport is resized mid-session.
    const page = currentPage();
    document.querySelectorAll('.topnav__links > a, .topnav__item > a, .menu-list > li > a').forEach((a) => {
      if (a.getAttribute('href') === page) a.classList.add('is-active');
    });

    // Desktop dropdown: hover opens it via CSS; the caret button toggles it for
    // touch and keyboard users. Click-outside / Escape close it.
    const item = document.querySelector('[data-dropdown]');
    const caret = item && item.querySelector('[data-dropdown-toggle]');
    if (item && caret) {
      const setOpen = (open) => {
        item.classList.toggle('is-open', open);
        caret.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      caret.addEventListener('click', (e) => {
        e.preventDefault();
        setOpen(!item.classList.contains('is-open'));
      });
      document.addEventListener('click', (e) => {
        if (!item.contains(e.target)) setOpen(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
      });
      item.querySelectorAll('.topnav__dropdown a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    }

    // Side-panel wiring (mobile / tablet portrait). On desktop the elements
    // still exist in the DOM but are CSS-hidden, so listeners are harmless.
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
    // Same-page anchor links don't reload, so close the panel explicitly.
    panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });
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

  const sectionNum = (i) => String(i + 1).padStart(2, '0');

  const DROPDOWN_LINKS = NAV_SECTIONS.map(([id, label], i) =>
    `<a href="${ACADEMICS_PAGE}#${id}" data-section-link="${id}"><span class="dd-num">${sectionNum(i)}</span><span>${label}</span></a>`
  ).join('\n            ');

  const PANEL_SUBLINKS = NAV_SECTIONS.map(([id, label]) =>
    `<li><a href="${ACADEMICS_PAGE}#${id}" data-section-link="${id}">${label}</a></li>`
  ).join('\n              ');

  const NAV_HTML = `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <symbol id="ico-menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
      </symbol>
    </svg>
    <nav class="topnav" aria-label="Primary">
      <a class="topnav__brand" href="index.html">Young-Seok Lee</a>
      <div class="topnav__actions">
        <div class="topnav__links">
          <a href="index.html">Home</a>
          <div class="topnav__item" data-dropdown>
            <a href="${ACADEMICS_PAGE}">${ACADEMICS_LABEL}</a>
            <button class="topnav__caret" type="button" data-dropdown-toggle aria-label="Show ${ACADEMICS_LABEL} sections" aria-expanded="false" aria-controls="academics-menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="topnav__dropdown" id="academics-menu">
            ${DROPDOWN_LINKS}
            </div>
          </div>
          <a href="contact.html">Contact</a>
        </div>
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
        <li><a href="index.html"><span class="menu-num">01</span><span>Home</span><svg class="menu-arrow" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-menu-arrow"/></svg></a></li>
        <li>
          <a href="${ACADEMICS_PAGE}"><span class="menu-num">02</span><span>${ACADEMICS_LABEL}</span><svg class="menu-arrow" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-menu-arrow"/></svg></a>
          <ul class="menu-sublist" aria-label="${ACADEMICS_LABEL} sections">
              ${PANEL_SUBLINKS}
          </ul>
        </li>
        <li><a href="contact.html"><span class="menu-num">03</span><span>Contact</span><svg class="menu-arrow" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-menu-arrow"/></svg></a></li>
      </ul>
      <div class="menu-panel__footer">© 2020–${new Date().getFullYear()} Young-Seok Lee</div>
    </aside>
  `;

  const FOOTER_HTML = `
    <footer class="site-footer">
      © 2020–<span data-current-year>${new Date().getFullYear()}</span> Young-Seok Lee
    </footer>
  `;

  /* ---------- Recent News: "show more" toggle on the pre-rendered list ---------- */
  function initNews() {
    const list = document.querySelector('.news-list');
    const toggle = document.getElementById('news-toggle');
    if (!list || !toggle) return;
    const extra = list.querySelectorAll('.news-item--extra').length;
    if (!extra) return;                 // 5 or fewer items — no toggle needed
    toggle.hidden = false;
    toggle.textContent = `Show ${extra} more`;
    toggle.addEventListener('click', () => {
      const expanded = list.classList.toggle('is-expanded');
      toggle.textContent = expanded ? 'Show less' : `Show ${extra} more`;
    });
  }

  /* ---------- Scroll-spy (academics page) ----------
     Highlights the section currently under the top bar in every place that
     links to sections: the sidebar index / mobile pill bar, the desktop
     dropdown and the mobile panel. Pure enhancement — the links work without it. */
  function initScrollSpy() {
    const sections = Array.from(document.querySelectorAll('main .section[id]'));
    const links = Array.from(document.querySelectorAll('[data-section-link]'));
    if (!sections.length || !links.length) return;

    const mobile = window.matchMedia('(max-width: 768px)');
    let current = null;

    function revealPill(link) {
      // Scroll the mobile pill row horizontally (never the page) so the active
      // pill stays visible.
      const row = link.closest('.side-index ol');
      if (!row || !mobile.matches) return;
      const left = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }

    function setActive(id) {
      if (id === current) return;
      current = id;
      links.forEach((l) => {
        const on = l.dataset.sectionLink === id;
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current');
        if (on && l.closest('.side-index')) revealPill(l);
      });
    }

    function update() {
      const nav = document.querySelector('.topnav');
      const bar = mobile.matches ? document.querySelector('.side-index') : null;
      const offset = (nav ? nav.offsetHeight : 60) + (bar ? bar.offsetHeight : 0) + 48;
      const probe = window.scrollY + offset;
      let id = sections[0].id;
      for (const s of sections) {
        const top = s.getBoundingClientRect().top + window.scrollY;
        if (top <= probe) id = s.id;
      }
      // At the very bottom the last section wins even when it is short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        id = sections[sections.length - 1].id;
      }
      setActive(id);
    }

    // Throttled with a short timer rather than requestAnimationFrame: rAF is
    // paused in occluded/embedded views, which would freeze the highlight.
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => { pending = false; update(); }, 40);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    window.addEventListener('load', schedule);
    update();
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    injectChrome();
    initTheme();
    initMenu();
    initNews();
    initScrollSpy();
  });
})();
