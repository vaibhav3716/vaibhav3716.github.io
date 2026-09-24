/* ------------------------------------------------------------------
   About: the portrait sits at the centre of a small solar system.

   When the section scrolls into view, the photo rounds into a circle,
   then rings of dots spring outward from behind it, grey at first and
   taking on colour as they settle (after Apple's Account page). The
   rings become orbits, and six planets appear and start to revolve,
   each lit on the side that faces the centre.
------------------------------------------------------------------- */
(function () {
  'use strict';

  var stage = document.querySelector('.orbit-stage');
  if (!stage) return;
  var canvas = stage.querySelector('.orbit-canvas');
  var portrait = stage.querySelector('.portrait');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Vector planet art (100 x 100 unless noted), lit from the upper left; a separate
  // shade layer turns each planet's night side away from the centre as it orbits.
  var ART = {
    mercury: '<svg viewBox="0 0 100 100"><defs><radialGradient id="pm-g" cx="38%" cy="35%" r="72%"><stop offset="0" stop-color="#DDD7CD"/><stop offset=".6" stop-color="#A09A8F"/><stop offset="1" stop-color="#6E685F"/></radialGradient><clipPath id="pm-c"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="48" fill="url(#pm-g)"/><g clip-path="url(#pm-c)"><g fill="#7C766D" opacity=".5"><circle cx="32" cy="30" r="9"/><circle cx="62" cy="58" r="12"/><circle cx="40" cy="72" r="6"/><circle cx="73" cy="27" r="5"/><circle cx="19" cy="55" r="4.5"/><circle cx="56" cy="86" r="5"/><circle cx="84" cy="48" r="4"/></g>' +
      '<g fill="none" stroke="#EEE9E0" stroke-opacity=".4" stroke-width="1.6"><circle cx="31" cy="29" r="9"/><circle cx="61" cy="57" r="12"/><circle cx="39" cy="71" r="6"/><circle cx="72" cy="26" r="5"/></g></g></svg>',
    venus: '<svg viewBox="0 0 100 100"><defs><radialGradient id="pv-g" cx="38%" cy="35%" r="72%"><stop offset="0" stop-color="#FCF2DA"/><stop offset=".55" stop-color="#E8CB90"/><stop offset="1" stop-color="#B8883F"/></radialGradient><clipPath id="pv-c"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="48" fill="url(#pv-g)"/><g clip-path="url(#pv-c)" fill="none" stroke-linecap="round"><path d="M-5 30 C25 20 55 42 105 26" stroke="#FBEFD0" stroke-width="7" opacity=".6"/><path d="M-5 50 C30 42 60 62 105 48" stroke="#C99B55" stroke-width="6" opacity=".35"/>' +
      '<path d="M-5 68 C28 62 62 80 105 66" stroke="#FBEFD0" stroke-width="6" opacity=".5"/><path d="M8 16 C40 10 70 22 96 12" stroke="#D5AC66" stroke-width="4" opacity=".35"/><path d="M4 84 C34 80 60 92 98 82" stroke="#D5AC66" stroke-width="4" opacity=".3"/></g></svg>',
    earth: '<svg viewBox="0 0 100 100"><defs><radialGradient id="pe-g" cx="38%" cy="35%" r="72%"><stop offset="0" stop-color="#86BEF4"/><stop offset=".55" stop-color="#2F74CF"/><stop offset="1" stop-color="#153B7E"/></radialGradient><clipPath id="pe-c"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="48" fill="url(#pe-g)"/><g clip-path="url(#pe-c)"><g fill="#4F9E58"><path d="M16 30C22 19 40 17 46 26C50 32 42 38 44 46C46 55 37 61 30 55C24 49 27 41 20 39C13 37 13 34 16 30Z"/>' +
      '<path d="M58 21C67 17 81 22 85 30C89 38 79 41 72 38C66 36 64 44 68 51C72 59 66 67 60 63C54 59 56 49 52 43C48 36 51 26 58 21Z"/><path d="M66 73C72 68 83 70 83 77C83 83 72 85 68 81C64 78 62 75 66 73Z"/></g>' +
      '<g fill="#F4FAFF" opacity=".9"><ellipse cx="50" cy="3" rx="32" ry="7"/><ellipse cx="50" cy="98" rx="32" ry="6"/></g>' +
      '<g fill="none" stroke="#FFFFFF" stroke-linecap="round" opacity=".6"><path d="M8 44C20 39 30 47 42 42" stroke-width="3.2"/><path d="M50 67C61 62 75 69 92 60" stroke-width="3.2"/><path d="M28 81C37 76 46 81 54 78" stroke-width="2.6"/><path d="M60 12C68 9 76 12 84 10" stroke-width="2.4"/></g></g>' +
      '<circle cx="50" cy="50" r="47" fill="none" stroke="#A8D6FF" stroke-opacity=".55" stroke-width="2.2"/></svg>',
    mars: '<svg viewBox="0 0 100 100"><defs><radialGradient id="pa-g" cx="38%" cy="35%" r="72%"><stop offset="0" stop-color="#F3A574"/><stop offset=".55" stop-color="#C9592E"/><stop offset="1" stop-color="#7C3016"/></radialGradient><clipPath id="pa-c"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="48" fill="url(#pa-g)"/><g clip-path="url(#pa-c)"><g fill="#8A361A" opacity=".45"><path d="M28 40C38 33 52 43 48 54C44 63 30 61 27 52Z"/><path d="M60 58C70 53 81 62 77 70C72 77 62 75 60 66Z"/><ellipse cx="69" cy="33" rx="9" ry="4.5"/><path d="M10 64C18 60 26 66 22 72C18 76 10 72 10 64Z"/></g>' +
      '<ellipse cx="50" cy="5" rx="17" ry="7" fill="#FFF6EE" opacity=".92"/><path d="M20 48C26 46 34 50 40 49" stroke="#E8875A" stroke-width="2" fill="none" opacity=".5"/></g></svg>',
    jupiter: '<svg viewBox="0 0 100 100"><defs><clipPath id="pj-c"><circle cx="50" cy="50" r="48"/></clipPath><radialGradient id="pj-g" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset=".65" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>' +
      '<g clip-path="url(#pj-c)"><rect width="100" height="100" fill="#EBD5B0"/><rect y="8" width="100" height="7" fill="#C9A177"/><rect y="20" width="100" height="10" fill="#B7825A"/><rect y="30" width="100" height="6" fill="#F4E6CB"/>' +
      '<rect y="40" width="100" height="10" fill="#C28D5F"/><rect y="54" width="100" height="6" fill="#DFBE92"/><rect y="62" width="100" height="11" fill="#A8704A"/><rect y="78" width="100" height="7" fill="#C9A177"/><rect y="90" width="100" height="6" fill="#B7825A"/>' +
      '<path d="M0 40Q12 37 25 40T50 40T75 40T100 40" stroke="#E2BE93" stroke-width="2" fill="none"/><path d="M0 62Q12 65 25 62T50 62T75 62T100 62" stroke="#C99A70" stroke-width="2" fill="none"/>' +
      '<ellipse cx="64" cy="67" rx="11" ry="6" fill="#C4513A"/><ellipse cx="64" cy="67" rx="6.5" ry="3.2" fill="#DC7A52"/><circle cx="50" cy="50" r="48" fill="url(#pj-g)"/></g></svg>',
    saturn: '<svg viewBox="0 0 220 120"><defs><clipPath id="ps-c"><circle cx="110" cy="60" r="38"/></clipPath><clipPath id="ps-f"><rect x="0" y="60" width="220" height="70"/></clipPath>' +
      '<linearGradient id="ps-r" x1="0" x2="1"><stop offset="0" stop-color="#BFA46E"/><stop offset=".5" stop-color="#F3E5BE"/><stop offset="1" stop-color="#B89C66"/></linearGradient><radialGradient id="ps-g" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"/><stop offset=".65" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>' +
      '<g transform="rotate(-16 110 60)"><g fill="none" stroke="url(#ps-r)"><ellipse cx="110" cy="60" rx="98" ry="24" stroke-width="11" opacity=".85"/><ellipse cx="110" cy="60" rx="80" ry="19.5" stroke-width="5" opacity=".6"/></g>' +
      '<g clip-path="url(#ps-c)"><rect x="60" y="10" width="100" height="100" fill="#EAD39E"/><rect x="60" y="30" width="100" height="7" fill="#D9BC80"/><rect x="60" y="44" width="100" height="5" fill="#F4E7C3"/><rect x="60" y="56" width="100" height="9" fill="#C9A468"/>' +
      '<rect x="60" y="72" width="100" height="6" fill="#DCC08A"/><rect x="60" y="84" width="100" height="10" fill="#C29B5E"/><circle cx="110" cy="60" r="38" fill="url(#ps-g)"/></g>' +
      '<g clip-path="url(#ps-f)" fill="none" stroke="url(#ps-r)"><ellipse cx="110" cy="60" rx="98" ry="24" stroke-width="11" opacity=".9"/><ellipse cx="110" cy="60" rx="80" ry="19.5" stroke-width="5" opacity=".65"/></g></g></svg>'
  };

  // Orbits as fractions of the stage half-width; two planets share each orbit, half a turn apart.
  // w = element width as a fraction of the stage; disc = planet body width as a fraction of the element.
  var RINGS = [
    { f: 0.60, dots: 30, dot: 0.0085, period: 18, planets: [
      { art: 'mercury', w: 0.034, aspect: 1, disc: 0.96 },
      { art: 'venus', w: 0.054, aspect: 1, disc: 0.96 } ] },
    { f: 0.77, dots: 40, dot: 0.0105, period: 34, planets: [
      { art: 'earth', w: 0.060, aspect: 1, disc: 0.96, moon: true },
      { art: 'mars', w: 0.044, aspect: 1, disc: 0.96 } ] },
    { f: 0.94, dots: 52, dot: 0.0125, period: 62, planets: [
      { art: 'jupiter', w: 0.098, aspect: 1, disc: 0.96 },
      { art: 'saturn', w: 0.19, aspect: 120 / 220, disc: 0.345 } ] }
  ];

  // Build the planet elements once
  RINGS.forEach(function (ring) {
    ring.planets.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'planet planet-' + p.art;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = ART[p.art] + '<span class="planet-shade"></span>' + (p.moon ? '<span class="planet-moon"></span>' : '');
      stage.insertBefore(el, portrait);
      p.el = el;
      p.shade = el.querySelector('.planet-shade');
      p.moonEl = el.querySelector('.planet-moon');
    });
  });

  var S = 0, dpr = 1;
  var started = false, t0 = 0, visible = false, running = false, raf = 0;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function dark() {
    var d = document.documentElement.dataset.theme;
    return d ? d === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    S = canvas.clientWidth;
    canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    RINGS.forEach(function (ring) {
      ring.planets.forEach(function (p) {
        var w = S * p.w, h = w * p.aspect, d = w * p.disc;
        p.px = w; p.py = h;
        p.el.style.width = w + 'px'; p.el.style.height = h + 'px';
        p.shade.style.width = p.shade.style.height = d + 'px';
        p.shade.style.left = (w - d) / 2 + 'px'; p.shade.style.top = (h - d) / 2 + 'px';
      });
    });
  }

  // Colour around the ring: a slow sweep through warm and cool hues, like Apple's rings
  function dotColour(angle, colourAmt, alpha) {
    var hue = (angle * 180 / Math.PI + 380) % 360;
    var isDark = dark();
    var sat = lerp(0, isDark ? 72 : 62, colourAmt), light = lerp(isDark ? 55 : 62, isDark ? 66 : 56, colourAmt);
    return 'hsla(' + hue.toFixed(0) + ',' + sat.toFixed(0) + '%,' + light.toFixed(0) + '%,' + alpha + ')';
  }

  function draw(now) {
    if (!S) return;
    ctx.clearRect(0, 0, S, S);
    var t = started ? (now - t0) / 1000 : 0;
    if (reduceMotion.matches && started) t = 10;
    var c = S / 2, R = S / 2;
    var pr = R * 0.44 * 0.95;          // just outside the portrait

    // 1. The photo rounds into a circle and settles
    var m = started ? easeOutCubic(clamp01(t / 0.8)) : 0;
    portrait.style.setProperty('--pr', lerp(18, 50, m).toFixed(2) + '%');
    portrait.style.setProperty('--ps', lerp(0.86, 1, m).toFixed(4));
    portrait.style.setProperty('--glow', m.toFixed(3));
    if (!started) return;

    var spin = reduceMotion.matches ? 0 : t;

    RINGS.forEach(function (ring, ri) {
      var rf = R * ring.f;
      var turn = spin * (2 * Math.PI / 140) * (ri % 2 ? -1 : 1);   // the dots drift very slowly

      // 2. Dots spring outward, grey first, then take on colour
      for (var j = 0; j < ring.dots; j++) {
        var base = j / ring.dots * 2 * Math.PI - Math.PI / 2;
        var delay = 0.25 + ri * 0.16 + (j / ring.dots) * 0.35;
        var q = clamp01((t - delay) / 0.75);
        if (q <= 0) continue;
        var rad = lerp(pr, rf, easeOutBack(q));
        var colourAmt = clamp01((t - delay - 0.35) / 0.6);
        var a = base + turn;
        var ds = S * ring.dot * lerp(0.5, 1, q);
        ctx.fillStyle = dotColour(base, colourAmt, (0.25 + 0.6 * q) * (dark() ? 0.85 : 0.75));
        ctx.beginPath(); ctx.arc(c + Math.cos(a) * rad, c + Math.sin(a) * rad, ds, 0, 6.2832); ctx.fill();
      }

      // 3. Planets appear on the settled rings and revolve
      ring.planets.forEach(function (p, pi) {
        var appear = clamp01((t - 1.25 - ri * 0.15 - pi * 0.1) / 0.6);
        if (appear <= 0) { p.el.style.opacity = 0; return; }
        var ang = (pi * Math.PI) + ri * 1.1 + spin * (2 * Math.PI / ring.period);
        var x = c + Math.cos(ang) * rf, y = c + Math.sin(ang) * rf;
        var sc = easeOutBack(appear);
        p.el.style.opacity = Math.min(1, appear * 2);
        p.el.style.transform = 'translate(' + (x - p.px / 2).toFixed(2) + 'px,' + (y - p.py / 2).toFixed(2) + 'px) scale(' + sc.toFixed(3) + ')';
        // Night side faces away from the centre
        p.shade.style.transform = 'rotate(' + (ang * 180 / Math.PI).toFixed(1) + 'deg)';
        if (p.moonEl) {
          var ma = spin * (2 * Math.PI / 5);
          var mr = p.px * 0.95;
          p.moonEl.style.transform = 'translate(' + (Math.cos(ma) * mr).toFixed(2) + 'px,' + (Math.sin(ma) * mr).toFixed(2) + 'px)';
        }
      });
    });
  }

  function loop(now) {
    draw(now);
    if (running) raf = requestAnimationFrame(loop);
  }
  function update() {
    var should = visible && started && !document.hidden && !reduceMotion.matches;
    if (should && !running) { running = true; raf = requestAnimationFrame(loop); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    if (!should) draw(performance.now());
  }
  function start() {
    if (started) return;
    started = true; t0 = performance.now();
    update();
  }

  resize();
  draw(performance.now());
  window.addEventListener('resize', function () { resize(); draw(performance.now()); });
  document.addEventListener('visibilitychange', update);
  // Redraw when the theme changes so the dot colours follow it
  new MutationObserver(function () { draw(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        visible = e.isIntersecting;
        if (e.isIntersecting && e.intersectionRatio >= 0.35) start();
        update();
      });
    }, { threshold: [0, 0.35] }).observe(stage);
  } else {
    start();
  }
})();
