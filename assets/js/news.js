/* ------------------------------------------------------------------
   What's new in research: three new astrophysics papers from arXiv,
   explained in plain words.

   Every morning a GitHub Action (.github/workflows/research-feed.yml)
   writes them to the research-feed branch of this repository. This
   reads that file, or the copy kept with the site if the branch can't
   be reached, whichever is newer.
------------------------------------------------------------------- */
(function () {
  'use strict';

  var list = document.getElementById('news-list');
  if (!list) return;
  var FEED = 'https://raw.githubusercontent.com/vaibhav3716/vaibhav3716.github.io/research-feed/arxiv.json';
  var LOCAL = 'assets/data/arxiv.json';
  var updatedEl = document.getElementById('news-updated');
  var creditEl = document.getElementById('news-credit');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var TOPIC_CLASS = { 'Stars': 'stars', 'The Sun': 'sun', 'Planets': 'planets', 'Galaxies': 'galaxies', 'Black holes': 'bh', 'Cosmology': 'cos', 'Instruments': 'inst' };

  function get(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }
  function usable(d) { return d && Array.isArray(d.papers) && d.papers.length > 0; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;           // text only: nothing from the feed is treated as HTML
    return e;
  }

  function card(p, plain) {
    if (!/^https:\/\/arxiv\.org\/abs\//.test(p.url || '')) return null;
    var art = el('article', 'news-card news-' + (TOPIC_CLASS[p.topic] || 'other'));
    var meta = el('p', 'news-meta');
    meta.appendChild(el('span', 'news-topic', p.topic || 'Astrophysics'));
    if (p.published) {
      var t = el('time', '', fmtDate(p.published));
      t.dateTime = p.published;
      meta.appendChild(t);
    }
    art.appendChild(meta);
    var h = el('h3', 'news-title'), a = el('a', '', p.headline || p.title);
    a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
    h.appendChild(a);
    art.appendChild(h);
    art.appendChild(el('p', 'news-summary' + (plain ? '' : ' news-abstract'), p.summary));
    var paper = el('p', 'news-paper');
    if (plain && p.title) paper.appendChild(el('span', 'news-paper-title', p.title));
    if (p.authors) paper.appendChild(el('span', 'news-authors', p.authors));
    art.appendChild(paper);
    var more = el('span', 'news-more', 'Read the paper on arXiv ');
    more.setAttribute('aria-hidden', 'true');
    more.insertAdjacentHTML('beforeend', '<svg class="icon"><use href="#i-arrow"/></svg>');
    art.appendChild(more);
    return art;
  }

  function render(d) {
    var cards = d.papers.slice(0, 3).map(function (p) { return card(p, !!d.plain); }).filter(Boolean);
    if (!cards.length) return fail();
    // Cards below the fold arrive one after another as they scroll into view, like the rest of the page
    // (the list itself may have no box of its own on wide screens, so measure its first card)
    var top = (list.firstElementChild || list).getBoundingClientRect().top;
    var later = !reduceMotion.matches && 'IntersectionObserver' in window && top > window.innerHeight;
    list.innerHTML = '';
    cards.forEach(function (c, i) {
      if (later) { c.classList.add('reveal'); c.style.setProperty('--rd', i * 90 + 'ms'); }
      list.appendChild(c);
    });
    if (later) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      cards.forEach(function (c) { io.observe(c); });
    }
    if (updatedEl && d.updated) updatedEl.textContent = 'Updated ' + fmtDate(d.updated) + '.';
    if (creditEl && !d.plain) {
      creditEl.textContent = 'These are the opening lines of each paper’s abstract. Thank you to arXiv for use of its open access interoperability.';
    }
  }

  function fail() {
    list.innerHTML = '';
    var a = el('a', 'news-card news-fallback');
    a.href = 'https://arxiv.org/list/astro-ph/new'; a.target = '_blank'; a.rel = 'noopener';
    a.appendChild(el('strong', '', 'See today’s new astrophysics papers on arXiv'));
    a.appendChild(el('span', '', 'The summaries couldn’t be loaded just now.'));
    list.appendChild(a);
  }

  // Both copies at once; use the newer (the branch copy is normally a day or more ahead)
  Promise.allSettled([get(FEED), get(LOCAL)]).then(function (results) {
    var best = null;
    results.forEach(function (r) {
      if (r.status !== 'fulfilled' || !usable(r.value)) return;
      if (!best || String(r.value.updated) > String(best.updated)) best = r.value;
    });
    if (best) render(best); else fail();
  });
})();
