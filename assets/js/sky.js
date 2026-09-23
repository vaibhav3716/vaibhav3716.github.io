/* ------------------------------------------------------------------
   Live hero sky.

   The sky is computed in real time from the visitor's clock:
   - stars, constellation lines and the Milky Way from the HYG-based
     d3-celestial catalogue (assets/data/sky-data.json),
   - the Sun, Moon and planets from orbital elements (Paul Schlyter's
     method, accurate to a fraction of a degree), with the Moon's
     phase and parallax,
   - Earth's rotation from sidereal time, so the sky keeps turning.

   Dark theme shows wherever it is night right now, light theme
   wherever it is day: Mumbai, or the point exactly opposite it on
   Earth (19° S, 107° W, in the South Pacific), where the Sun's
   altitude is always the negative of Mumbai's. Switching theme
   carries the observer around the globe, so the sky turns as you go.
------------------------------------------------------------------- */
(function () {
  'use strict';

  var canvas = document.querySelector('.sky');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var liveText = document.getElementById('sky-live');

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var MUMBAI = { lat: 19.076, lon: 72.878, mumbai: true };
  var origin = MUMBAI;             // Mumbai, or the visitor's own location if they share it

  // ---------------------------------------------------------------
  // Vector helpers (celestial frame: x to RA 0h, z to the north pole)
  // ---------------------------------------------------------------
  function vec(raDeg, decDeg) {
    var r = raDeg * D2R, d = decDeg * D2R, cd = Math.cos(d);
    return [cd * Math.cos(r), cd * Math.sin(r), Math.sin(d)];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rev(x) { return x - Math.floor(x / 360) * 360; }
  function sind(x) { return Math.sin(x * D2R); }
  function cosd(x) { return Math.cos(x * D2R); }
  function atan2d(y, x) { return Math.atan2(y, x) * R2D; }

  // ---------------------------------------------------------------
  // Time and ephemerides
  // ---------------------------------------------------------------
  function julian(ms) { return ms / 86400000 + 2440587.5; }
  function gmstDeg(jd) { return rev(280.46061837 + 360.98564736629 * (jd - 2451545.0)); }

  function kepler(M, e) {
    var E = M + e * R2D * sind(M) * (1 + e * cosd(M));
    for (var i = 0; i < 6; i++) E = E - (E - e * R2D * sind(E) - M) / (1 - e * cosd(E));
    return E;
  }
  function orbit(el) {
    var E = kepler(rev(el.M), el.e);
    var xv = el.a * (cosd(E) - el.e), yv = el.a * Math.sqrt(1 - el.e * el.e) * sind(E);
    var v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv), u = v + el.w;
    return {
      x: r * (cosd(el.N) * cosd(u) - sind(el.N) * sind(u) * cosd(el.i)),
      y: r * (sind(el.N) * cosd(u) + cosd(el.N) * sind(u) * cosd(el.i)),
      z: r * sind(u) * sind(el.i), r: r
    };
  }
  var PLANETS = [
    { key: 'Mercury', col: '#D9D2C5', el: function (d) { return { N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }; }, mag: function (r, R, fv) { return -0.36 + 5 * Math.log10(r * R) + 0.027 * fv + 2.2e-13 * Math.pow(fv, 6); } },
    { key: 'Venus', col: '#FFF6E2', el: function (d) { return { N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }; }, mag: function (r, R, fv) { return -4.34 + 5 * Math.log10(r * R) + 0.013 * fv + 4.2e-7 * fv * fv * fv; } },
    { key: 'Mars', col: '#FF9C6B', el: function (d) { return { N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }; }, mag: function (r, R, fv) { return -1.51 + 5 * Math.log10(r * R) + 0.016 * fv; } },
    { key: 'Jupiter', col: '#F4E6C8', el: function (d) { return { N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }; }, mag: function (r, R, fv) { return -9.25 + 5 * Math.log10(r * R) + 0.014 * fv; } },
    { key: 'Saturn', col: '#EAD7A4', el: function (d) { return { N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d }; }, mag: function (r, R, fv) { return -9.0 + 5 * Math.log10(r * R) + 0.044 * fv; } }
  ];

  function ephemeris(jd) {
    var d = jd - 2451543.5, ecl = 23.4393;
    // Precess from the equinox of date back to J2000, the frame of the star catalogue
    var pr = -3.82394e-5 * d, cp = cosd(pr), sp = sind(pr);
    function toEq(x, y, z) {
      var x2 = x * cp - y * sp, y2 = x * sp + y * cp;
      return norm([x2, y2 * cosd(ecl) - z * sind(ecl), y2 * sind(ecl) + z * cosd(ecl)]);
    }

    // Sun
    var ws = 282.9404 + 4.70935e-5 * d, es = 0.016709 - 1.151e-9 * d, Ms = rev(356.0470 + 0.9856002585 * d);
    var Es = kepler(Ms, es);
    var xv = cosd(Es) - es, yv = Math.sqrt(1 - es * es) * sind(Es);
    var vS = atan2d(yv, xv), rS = Math.sqrt(xv * xv + yv * yv), lonS = rev(vS + ws);
    var xs = rS * cosd(lonS), ys = rS * sind(lonS);
    var out = { sun: toEq(xs, ys, 0), sunDist: rS, planets: [] };

    // Planets: geocentric = heliocentric + the Sun's geocentric position
    PLANETS.forEach(function (p) {
      var h = orbit(p.el(d));
      var xg = h.x + xs, yg = h.y + ys, zg = h.z, R = Math.sqrt(xg * xg + yg * yg + zg * zg);
      var cfv = (h.r * h.r + R * R - rS * rS) / (2 * h.r * R);
      var fv = Math.acos(Math.max(-1, Math.min(1, cfv))) * R2D;
      out.planets.push({ name: p.key, col: p.col, v: toEq(xg, yg, zg), mag: p.mag(h.r, R, fv), dist: R });
    });

    // Moon, with its main perturbations in longitude, latitude and distance
    var Nm = 125.1228 - 0.0529538083 * d, wm = 318.0634 + 0.1643573223 * d, Mm = rev(115.3654 + 13.0649929509 * d);
    var m = orbit({ N: Nm, i: 5.1454, w: wm, a: 60.2666, e: 0.054900, M: Mm });
    var lon = atan2d(m.y, m.x), lat = atan2d(m.z, Math.sqrt(m.x * m.x + m.y * m.y)), rm = m.r;
    var Ls = Ms + ws, Lm = Mm + wm + Nm, D = Lm - Ls, F = Lm - Nm;
    lon += -1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) - 0.059 * sind(2 * Mm - 2 * D)
      - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D) + 0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms)
      - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D);
    lat += -0.173 * sind(F - 2 * D) - 0.055 * sind(Mm - F - 2 * D) - 0.046 * sind(Mm + F - 2 * D) + 0.033 * sind(F + 2 * D) + 0.017 * sind(2 * Mm + F);
    rm += -0.58 * cosd(Mm - 2 * D) - 0.46 * cosd(2 * D);
    out.moonGeo = toEq(cosd(lon) * cosd(lat), sind(lon) * cosd(lat), sind(lat));
    out.moonDist = rm;                                     // in Earth radii
    out.moonLit = (1 - dot(out.moonGeo, out.sun)) / 2;     // illuminated fraction
    return out;
  }

  // ---------------------------------------------------------------
  // Observer: a point that travels from Mumbai (theta = 0) over the
  // South Pole to the antipode (theta = 180). The horizon frame is
  // carried along the path, so the sky turns smoothly on the way.
  // ---------------------------------------------------------------
  function frameAt(theta, gmst) {
    var p0 = vec(gmst + origin.lon, origin.lat);
    var n0 = norm(sub([0, 0, 1], mul(p0, p0[2])));
    var s0 = mul(n0, -1);
    var ct = Math.cos(theta * D2R), st = Math.sin(theta * D2R);
    var U = add(mul(p0, ct), mul(s0, st));
    var t = add(mul(p0, -st), mul(s0, ct));
    return { U: U, N: mul(t, -1), E: cross(p0, s0) };
  }
  function altOf(v, F) { return Math.asin(Math.max(-1, Math.min(1, dot(v, F.U)))) * R2D; }
  function azOf(v, F) { return rev(atan2d(dot(v, F.E), dot(v, F.N))); }
  function observerLatLon(F, gmst) {
    return { lat: Math.asin(F.U[2]) * R2D, lon: rev(atan2d(F.U[1], F.U[0]) - gmst + 180) - 180 };
  }

  // ---------------------------------------------------------------
  // Catalogue and notes
  // ---------------------------------------------------------------
  var CAT = null;
  // ra, dec, name, label note, info-card kind, distance
  var NOTES = [
    [101.287, -16.716, 'Sirius', 'its companion, Sirius B, is a white dwarf', 'The brightest star in the night sky, with a white dwarf companion', '8.6 light-years'],
    [114.826, 5.225, 'Procyon', 'also has a white dwarf companion', 'An F-type star with a white dwarf companion', '11.5 light-years'],
    [63.818, -7.653, '40 Eridani', 'home of the first white dwarf found', 'A triple star; 40 Eridani B was the first white dwarf identified (1910)', '16 light-years'],
    [47.042, 40.956, 'Algol', 'an eclipsing binary', 'An eclipsing binary that dims every 2.87 days', '90 light-years'],
    [10.685, 41.269, 'Andromeda Galaxy', '2.5 million light-years away', 'The nearest large galaxy to the Milky Way', '2.5 million light-years'],
    [56.75, 24.12, 'Pleiades', '', 'A young open star cluster', '444 light-years'],
    [83.82, -5.39, 'Orion Nebula', '', 'The nearest large star-forming region', '1,340 light-years'],
    [219.90, -60.83, 'Alpha Centauri', 'the nearest star system, 4.4 light-years', 'The nearest star system: two Sun-like stars and Proxima Centauri', '4.4 light-years'],
    [201.298, -11.161, 'Spica', 'two stars orbiting every 4 days', 'Two hot B-type stars orbiting every 4 days', '250 light-years'],
    [200.981, 54.925, 'Mizar and Alcor', 'a famous multiple star', 'A six-star system visible as a naked-eye pair', '83 light-years'],
    [247.352, -26.432, 'Antares', 'a red supergiant', 'A red supergiant with a hot companion', 'about 550 light-years'],
    [88.793, 7.407, 'Betelgeuse', 'a red supergiant', 'A red supergiant near the end of its life', 'about 550 light-years'],
    [266.417, -29.008, 'Centre of the Milky Way', 'home of a 4-million-solar-mass black hole', 'Sagittarius A*, a black hole of 4 million solar masses', '26,000 light-years'],
    [80.89, -69.76, 'Large Magellanic Cloud', 'a neighbouring galaxy', 'A satellite galaxy of the Milky Way', '160,000 light-years'],
    [13.19, -72.83, 'Small Magellanic Cloud', '', 'A satellite galaxy of the Milky Way', '200,000 light-years'],
    [201.697, -47.48, 'Omega Centauri', 'the largest globular cluster', 'The largest globular cluster of the Milky Way, about 10 million stars', '17,000 light-years'],
    [37.95, 89.26, 'Polaris', 'the pole star', 'A yellow supergiant and Cepheid variable near the north celestial pole', 'about 430 light-years']
  ].map(function (n) { return { v: vec(n[0], n[1]), text: n[2], sub: n[3], kind: n[4], dist: n[5] }; });

  // Facts for the brightest named stars (approximate distances)
  var STAR_FACTS = {
    'Canopus': ['An F-type bright giant, the second brightest star', '310 light-years'],
    'Arcturus': ['An orange giant', '37 light-years'],
    'Vega': ['A young A-type star', '25 light-years'],
    'Capella': ['A pair of yellow giant stars', '43 light-years'],
    'Rigel': ['A blue supergiant', 'about 860 light-years'],
    'Achernar': ['A fast-spinning hot B-type star', '139 light-years'],
    'Altair': ['A fast-spinning A-type star', '17 light-years'],
    'Aldebaran': ['An orange giant', '65 light-years'],
    'Pollux': ['An orange giant with a known planet', '34 light-years'],
    'Fomalhaut': ['An A-type star with a dusty debris disc', '25 light-years'],
    'Deneb': ['A white supergiant', 'about 2,600 light-years'],
    'Regulus': ['A fast-spinning B-type star', '79 light-years'],
    'Castor': ['A six-star system', '51 light-years'],
    'Bellatrix': ['A hot B-type giant', '250 light-years'],
    'Alnilam': ['A blue supergiant in Orion\'s Belt', 'about 2,000 light-years'],
    'Mirfak': ['A yellow-white supergiant', '510 light-years'],
    'Hadar': ['A pair of hot B-type giants', 'about 390 light-years'],
    'Acrux': ['A multiple system of hot B-type stars', 'about 320 light-years'],
    'Gacrux': ['A red giant', '88 light-years'],
    'Denebola': ['An A-type star', '36 light-years'],
    'Rigil Kentaurus': ['The nearest star system to the Sun', '4.4 light-years']
  };

  function bvColour(bv) {
    var stops = [[-0.4, [155, 176, 255]], [0, [202, 216, 255]], [0.3, [248, 247, 255]], [0.6, [255, 244, 234]], [0.9, [255, 222, 180]], [1.3, [255, 196, 136]], [2, [255, 170, 110]]];
    if (bv <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (bv <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = (bv - a[0]) / (b[0] - a[0]);
        return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
      }
    }
    return stops[stops.length - 1][1];
  }

  function loadCatalogue() {
    fetch('assets/data/sky-data.json').then(function (r) { return r.json(); }).then(function (data) {
      var stars = [];
      for (var i = 0; i < data.stars.length; i += 4) {
        var c = bvColour(data.stars[i + 3]);
        var idx = i / 4;
        stars.push({ v: vec(data.stars[i], data.stars[i + 1]), mag: data.stars[i + 2], bv: data.stars[i + 3],
          col: 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',', tw: Math.random() * 6.28,
          name: (data.names && data.names[idx]) || '', desig: (data.desig && data.desig[idx]) || '',
          con: (data.conNames && data.con && data.conNames[data.con[idx]]) || '' });
      }
      var lines = [];
      Object.keys(data.lines).forEach(function (k) {
        data.lines[k].forEach(function (seg) {
          for (var j = 1; j < seg.length; j++) lines.push([vec(seg[j - 1][0], seg[j - 1][1]), vec(seg[j][0], seg[j][1])]);
        });
      });
      var cons = data.cons.filter(function (c) { return c[4] <= 2; }).map(function (c) { return { v: vec(c[2], c[3]), name: c[1], rank: c[4] }; });
      var mw = [];
      for (var m = 0; m < data.mw.length; m += 3) {
        // jitter the 2-degree sampling grid so it doesn't show
        for (var q = 0; q < 2; q++) mw.push({ v: vec(data.mw[m] + (Math.random() - 0.5) * 2.4, data.mw[m + 1] + (Math.random() - 0.5) * 2.4), l: data.mw[m + 2] });
      }
      CAT = { stars: stars, lines: lines, cons: cons, mw: mw };
      if (!tween) view = viewFor(theta);
      draw(performance.now());
    }).catch(function () { /* the Sun, Moon and planets still render without the catalogue */ });
  }

  // ---------------------------------------------------------------
  // Scene state
  // ---------------------------------------------------------------
  var W = 0, H = 0, dpr = 1;
  var theta = 0;                  // 0 = Mumbai, 180 = its antipode
  var view = { az: 90, alt: 38, cx: 0.64, cy: 0.52, kW: 0.27, kH: 0.45 };
  var tween = null;
  var eph = null, ephAt = 0;
  var chosenTheme = null;

  function refreshEphemeris(force) {
    var t = Date.now();
    if (force || !eph || t - ephAt > 20000) { eph = ephemeris(julian(t)); ephAt = t; }
  }
  function currentGmst() { return gmstDeg(julian(Date.now())); }
  function moonFor(F) { return norm(sub(mul(eph.moonGeo, eph.moonDist), F.U)); }

  function homeIsNight() {
    refreshEphemeris();
    return altOf(eph.sun, frameAt(0, currentGmst())) < -0.5;
  }
  function thetaFor(theme) {
    var night = homeIsNight();
    return theme === 'dark' ? (night ? 0 : 180) : (night ? 180 : 0);
  }

  function narrow() { return W < 720; }
  function viewFor(th) {
    refreshEphemeris();
    var F = frameAt(th, currentGmst());
    var sunAlt = altOf(eph.sun, F);
    if (sunAlt > -2) {
      // Day: face the Sun, low enough to keep the horizon and its path in view
      // Keep the camera low so the horizon stays flat; a high Sun just sits higher in the frame
      var alt0 = Math.max(2, Math.min(20, sunAlt - 45));
      var t = (alt0 - 2) / 18;
      return narrow()
        ? { az: azOf(eph.sun, F), alt: alt0, cx: 0.62, cy: lerp(0.93, 0.86, t), kW: 0.75, kH: 0.26 }
        : { az: azOf(eph.sun, F) - 12, alt: alt0, cx: 0.72, cy: lerp(0.8, 0.76, t), kW: 0.24, kH: 0.42 };
    }
    // Night: face the richest part of the sky right now
    var best = 0, bestScore = -1;
    for (var az = 0; az < 360; az += 10) {
      var score = 0;
      var consider = function (v, w) {
        var a = altOf(v, F); if (a < 10 || a > 78) return;
        var dz = Math.abs(((azOf(v, F) - az + 540) % 360) - 180);
        if (dz < 60) score += w * (1 - dz / 75);
      };
      if (CAT) CAT.stars.forEach(function (s) { if (s.mag < 2.6) consider(s.v, Math.pow(10, -0.4 * s.mag)); });
      eph.planets.forEach(function (p) { consider(p.v, 2.2); });
      consider(moonFor(F), 2.5);
      NOTES.forEach(function (n) { consider(n.v, 0.5); });
      if (score > bestScore) { bestScore = score; best = az; }
    }
    return narrow()
      ? { az: best, alt: 16, cx: 0.5, cy: 0.86, kW: 0.95, kH: 0.40 }
      : { az: best, alt: 38, cx: 0.64, cy: 0.52, kW: 0.27, kH: 0.45 };
  }

  // ---------------------------------------------------------------
  // Projection (stereographic, as planetarium software uses)
  // ---------------------------------------------------------------
  var P = { c: null, r: null, u: null, cx: 0, cy: 0, k: 1, F: null };
  var zoom = 0, zoomTarget = null;    // scroll-driven zoom toward one object
  function setupProjection(F) {
    var az = view.az * D2R, al = view.alt * D2R;
    var h = add(mul(F.E, Math.sin(az)), mul(F.N, Math.cos(az)));
    var c = add(mul(h, Math.cos(al)), mul(F.U, Math.sin(al)));
    var z = zoom * zoom * (3 - 2 * zoom);
    if (zoomTarget && z > 0) c = norm(add(mul(c, 1 - z), mul(zoomTarget.v, z)));
    var r = norm(cross(c, F.U));
    P.F = F; P.c = c; P.r = r; P.u = cross(r, c);
    P.cx = W * lerp(view.cx, 0.62, z); P.cy = H * lerp(view.cy, 0.5, z);
    P.k = Math.max(W * view.kW, H * view.kH) * (1 + 6 * z * z);
  }
  function project(v) {
    var dc = dot(v, P.c);
    if (dc < -0.35) return null;
    var f = 2 / (1 + dc);
    return [P.cx + P.k * f * dot(v, P.r), P.cy - P.k * f * dot(v, P.u)];
  }
  function onScreen(p, m) { m = m || 0; return !!p && p[0] > -m && p[0] < W + m && p[1] > -m && p[1] < H + m; }

  // ---------------------------------------------------------------
  // Sky colour from the Sun's altitude (degrees)
  // ---------------------------------------------------------------
  var SKY_STOPS = [
    [-90, [6, 10, 22], [9, 15, 32], [16, 24, 46]],
    [-18, [6, 10, 22], [9, 15, 32], [16, 24, 46]],
    [-10, [10, 18, 40], [22, 34, 70], [58, 58, 92]],
    [-4, [18, 36, 74], [52, 66, 118], [180, 110, 96]],
    [2, [28, 58, 108], [86, 112, 164], [246, 170, 110]],
    [10, [34, 76, 140], [96, 140, 196], [230, 196, 160]],
    [25, [36, 90, 160], [100, 156, 214], [186, 214, 238]],
    [90, [34, 88, 158], [96, 152, 212], [180, 210, 236]]
  ];
  function mixC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function skyColours(h) {
    for (var i = 1; i < SKY_STOPS.length; i++) {
      if (h <= SKY_STOPS[i][0]) {
        var a = SKY_STOPS[i - 1], b = SKY_STOPS[i], t = (h - a[0]) / (b[0] - a[0]);
        return [mixC(a[1], b[1], t), mixC(a[2], b[2], t), mixC(a[3], b[3], t)];
      }
    }
    var l = SKY_STOPS[SKY_STOPS.length - 1]; return [l[1], l[2], l[3]];
  }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ---------------------------------------------------------------
  // Labels, placed so they never overlap
  // ---------------------------------------------------------------
  var labelBoxes = [];
  function claim(x, y, w, h) {
    for (var i = 0; i < labelBoxes.length; i++) {
      var b = labelBoxes[i];
      if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false;
    }
    labelBoxes.push([x, y, w, h]);
    return true;
  }
  var FONT = '500 12px "IBM Plex Sans", system-ui, sans-serif';
  var FONT_SUB = '400 11.5px "IBM Plex Sans", system-ui, sans-serif';
  var FONT_CON = 'italic 400 14px "Spectral", Georgia, serif';
  function label(p, text, sub, a, colour) {
    ctx.font = FONT;
    var w = ctx.measureText(text).width;
    if (sub) { ctx.font = FONT_SUB; w = Math.max(w, ctx.measureText(sub).width); }
    var h = sub ? 30 : 15, x = p[0] + 12, y = p[1] - 4;
    if (x + w > W - 12) x = p[0] - 12 - w;
    if (x < 8 || y < 72 || y + h > H - 36) return;
    if (!claim(x - 3, y - 12, w + 6, h + 4)) return;
    ctx.font = FONT;
    ctx.fillStyle = (colour || 'rgba(236,240,248,') + a + ')';
    ctx.fillText(text, x, y);
    if (sub) { ctx.font = FONT_SUB; ctx.fillStyle = 'rgba(170,185,215,' + 0.9 * a + ')'; ctx.fillText(sub, x, y + 15); }
  }

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  function draw(t) {
    if (!W) return;
    refreshEphemeris();
    var F = frameAt(theta, currentGmst());
    setupProjection(F);
    labelBoxes = textBoxes.slice();

    var sunAlt = altOf(eph.sun, F);
    var night = clamp01((-sunAlt - 4) / 12);
    var twilight = clamp01(1 - Math.abs(sunAlt - 1) / 14);
    var cols = skyColours(sunAlt);
    var tw = reduceMotion.matches ? 0 : t * 0.001;

    // Horizon (altitude 0) across the part of the sky that faces us
    var hpts = [];
    for (var a = view.az - 115; a <= view.az + 115; a += 1.5) {
      var hp = project(add(mul(F.E, Math.sin(a * D2R)), mul(F.N, Math.cos(a * D2R))));
      if (hp) hpts.push([hp[0], hp[1], a]);
    }
    var centreH = project(add(mul(F.E, Math.sin(view.az * D2R)), mul(F.N, Math.cos(view.az * D2R))));
    var gy = centreH ? centreH[1] : H;

    var g = ctx.createLinearGradient(0, 0, 0, Math.max(gy, H * 0.6));
    g.addColorStop(0, rgb(cols[0])); g.addColorStop(0.62, rgb(cols[1])); g.addColorStop(1, rgb(cols[2]));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var sunP = project(eph.sun);
    if (sunP && sunAlt > -12) {
      var ga = clamp01((sunAlt + 12) / 14);
      var rg = ctx.createRadialGradient(sunP[0], sunP[1], 0, sunP[0], sunP[1], Math.max(W, H) * 0.55);
      rg.addColorStop(0, 'rgba(255,214,150,' + 0.5 * ga + ')');
      rg.addColorStop(0.25, 'rgba(255,170,110,' + 0.2 * ga + ')');
      rg.addColorStop(1, 'rgba(255,150,100,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }

    if (CAT && night > 0.02) {
      // Milky Way
      var mwr = P.k * 0.045;
      for (var i = 0; i < CAT.mw.length; i++) {
        var m = CAT.mw[i];
        if (dot(m.v, F.U) < -0.02) continue;
        var mp = project(m.v); if (!onScreen(mp, mwr)) continue;
        ctx.fillStyle = 'rgba(200,208,240,' + (0.0065 * m.l * night) + ')';
        ctx.beginPath(); ctx.arc(mp[0], mp[1], mwr * (0.8 + 0.1 * m.l), 0, 6.2832); ctx.fill();
      }
      // Constellation lines
      ctx.strokeStyle = 'rgba(160,190,240,' + 0.24 * night + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var l = 0; l < CAT.lines.length; l++) {
        var ln = CAT.lines[l];
        if (dot(ln[0], F.U) < 0 || dot(ln[1], F.U) < 0) continue;
        var p1 = project(ln[0]), p2 = project(ln[1]);
        if (!p1 || !p2 || (!onScreen(p1, 40) && !onScreen(p2, 40))) continue;
        var dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.sqrt(dx * dx + dy * dy);
        if (len < 12 || len > W * 0.5) continue;
        var ux = dx / len * 4, uy = dy / len * 4;
        ctx.moveTo(p1[0] + ux, p1[1] + uy); ctx.lineTo(p2[0] - ux, p2[1] - uy);
      }
      ctx.stroke();
    }

    // Stars
    if (CAT) {
      for (var s = 0; s < CAT.stars.length; s++) {
        var st = CAT.stars[s];
        var u = dot(st.v, F.U); if (u < 0) continue;
        var vis = st.mag < 1 ? Math.max(night, clamp01((-sunAlt + 2) / 10)) : night;
        if (vis < 0.01) continue;
        var sp = project(st.v); if (!onScreen(sp, 4)) continue;
        var ext = clamp01(u * 7 + 0.1);                 // dimmer near the horizon
        var al2 = clamp01(1.08 - st.mag * 0.17) * vis * ext * (0.84 + 0.16 * Math.sin(tw * 1.2 + st.tw));
        if (al2 < 0.02) continue;
        var r = Math.max(0.55, 2.8 - 0.5 * st.mag);
        if (st.mag < 1.3) {
          var sg = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], r * 5);
          sg.addColorStop(0, st.col + 0.4 * al2 + ')'); sg.addColorStop(1, st.col + '0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sp[0], sp[1], r * 5, 0, 6.2832); ctx.fill();
        }
        ctx.fillStyle = st.col + al2 + ')';
        ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, 6.2832); ctx.fill();
      }
    }

    // Deep-sky glows
    if (night > 0.05) {
      glowAt(vec(10.685, 41.269), 'rgba(255,236,205,', 0.7 * night, 0.028, 0.35);   // Andromeda Galaxy
      glowAt(vec(83.82, -5.39), 'rgba(255,150,190,', 0.4 * night, 0.018, 1);        // Orion Nebula
      glowAt(vec(80.89, -69.76), 'rgba(210,215,240,', 0.35 * night, 0.05, 0.8);     // LMC
      glowAt(vec(13.19, -72.83), 'rgba(210,215,240,', 0.25 * night, 0.03, 0.8);     // SMC
    }

    // Planets
    var planetPts = [];
    eph.planets.forEach(function (p) {
      var u2 = dot(p.v, F.U); if (u2 < 0) return;
      var vis2 = Math.max(night, p.mag < -3 ? clamp01((-sunAlt + 8) / 10) : clamp01((-sunAlt - 2) / 8));
      if (vis2 < 0.02) return;
      var pp = project(p.v); if (!onScreen(pp, 4)) return;
      var r3 = Math.max(1.6, 3.2 - 0.45 * p.mag);
      var pg = ctx.createRadialGradient(pp[0], pp[1], 0, pp[0], pp[1], r3 * 4);
      pg.addColorStop(0, hexA(p.col, 0.5 * vis2)); pg.addColorStop(1, hexA(p.col, 0));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pp[0], pp[1], r3 * 4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = hexA(p.col, vis2); ctx.beginPath(); ctx.arc(pp[0], pp[1], r3, 0, 6.2832); ctx.fill();
      planetPts.push({ p: pp, a: vis2, name: p.name, u: u2 });
    });

    // The Moon, as seen from this point on Earth (includes parallax)
    var moonV = moonFor(F), moonAlt = altOf(moonV, F), moonP = project(moonV);
    if (moonAlt > -1 && onScreen(moonP, 30)) drawMoon(moonP, moonV, sunAlt);

    // The Sun and its path across the sky today
    var dayA = clamp01((sunAlt + 6) / 8) * (1 - night);
    if (dayA > 0.02) drawSunPath(F, dayA);
    if (sunP && sunAlt > -1.5) {
      var sr = Math.max(9, P.k * 0.017);
      var sgr = ctx.createRadialGradient(sunP[0], sunP[1], 0, sunP[0], sunP[1], sr * 4);
      sgr.addColorStop(0, 'rgba(255,245,225,1)'); sgr.addColorStop(0.25, 'rgba(255,220,160,.95)'); sgr.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = sgr; ctx.beginPath(); ctx.arc(sunP[0], sunP[1], sr * 4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#FFF6E4'; ctx.beginPath(); ctx.arc(sunP[0], sunP[1], sr, 0, 6.2832); ctx.fill();
    }

    drawGround(hpts, gy, sunAlt, twilight, sunP, moonP, moonAlt);

    // Flying into the target as the page scrolls
    if (zoomTarget && zoom > 0.02) {
      var tp = project(zoomTarget.v);
      if (tp) {
        var zr = 4 + Math.pow(zoom, 2.2) * Math.max(W, H) * 1.1;
        var za = Math.min(1, zoom * 1.4);
        var zg = ctx.createRadialGradient(tp[0], tp[1], 0, tp[0], tp[1], zr);
        zg.addColorStop(0, zoomTarget.col + za + ')');
        zg.addColorStop(0.35, zoomTarget.col + 0.55 * za + ')');
        zg.addColorStop(1, zoomTarget.col + '0)');
        ctx.fillStyle = zg; ctx.beginPath(); ctx.arc(tp[0], tp[1], zr, 0, 6.2832); ctx.fill();
      }
    }

    // Labels: desktop only; the phone layout keeps the sky as a backdrop
    if (!narrow() && zoom < 0.05) {
      var la = clamp01((night - 0.35) / 0.5);
      if (sunP && dayA > 0.5 && sunAlt > 0) {
        var pl = project(sunPathPoint(1.2));
        if (pl) label(pl, "The Sun's path across the sky today", '', dayA, 'rgba(255,244,228,');
      }
      if (moonAlt > 2 && onScreen(moonP)) label(moonP, 'Moon', Math.round(eph.moonLit * 100) + '% lit', Math.max(0.8, la));
      planetPts.forEach(function (pp) { if (pp.a > 0.4 && pp.u > 0.05) label(pp.p, pp.name, '', pp.a); });
      if (la > 0.02) {
        NOTES.forEach(function (n) {
          if (dot(n.v, F.U) < 0.08) return;
          var np = project(n.v); if (!onScreen(np)) return;
          label(np, n.text, n.sub, 0.92 * la);
        });
        if (CAT) {
          ctx.textAlign = 'center';
          CAT.cons.forEach(function (c) {
            if (dot(c.v, F.U) < 0.12) return;
            var cp = project(c.v); if (!onScreen(cp) || cp[1] < 80 || cp[1] > H - 40) return;
            ctx.font = FONT_CON;
            var w = ctx.measureText(c.name).width;
            if (!claim(cp[0] - w / 2, cp[1] - 12, w, 16)) return;
            ctx.fillStyle = 'rgba(170,190,230,' + (c.rank === 1 ? 0.55 : 0.4) * la + ')';
            ctx.fillText(c.name, cp[0], cp[1]);
          });
          ctx.textAlign = 'left';
        }
      }
    }
  }

  function glowAt(v, colour, a, size, squash) {
    if (dot(v, P.F.U) < 0.03) return;
    var p = project(v); if (!onScreen(p, 60)) return;
    var r = P.k * size;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-0.6); ctx.scale(1, squash);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, colour + a + ')'); g.addColorStop(1, colour + '0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawMoon(p, v, sunAlt) {
    // Drawn about five times its true size so the phase is readable.
    // The lit limb faces the Sun.
    var r = Math.max(7, P.k * 0.02);
    var toSun = project(norm(add(v, mul(sub(eph.sun, v), 0.02))));
    var ang = toSun ? Math.atan2(toSun[1] - p[1], toSun[0] - p[0]) : 0;
    var k = eph.moonLit, dayFade = clamp01((sunAlt + 2) / 10);
    ctx.save();
    ctx.translate(p[0], p[1]); ctx.rotate(ang);
    var glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 4);
    glow.addColorStop(0, 'rgba(235,240,255,' + 0.25 * k * (1 - dayFade * 0.7) + ')'); glow.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(40,46,64,' + (0.55 - 0.35 * dayFade) + ')';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(244,242,232,' + (0.95 - 0.35 * dayFade) + ')';
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    var rx = r * Math.abs(2 * k - 1);
    if (k >= 0.5) ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    else ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
    ctx.fill();
    ctx.restore();
  }

  function sunPathPoint(hoursFromNow) {
    // The Sun carried along by Earth's rotation: a turn about the celestial pole
    var s = eph.sun, a = -hoursFromNow * 15 * D2R, c = Math.cos(a), sn = Math.sin(a);
    return [s[0] * c - s[1] * sn, s[0] * sn + s[1] * c, s[2]];
  }
  function drawSunPath(F, a) {
    ctx.save();
    ctx.setLineDash([6, 7]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,236,200,' + 0.75 * a + ')';
    ctx.beginPath();
    var started = false;
    for (var h = -12; h <= 12; h += 0.1) {
      var v = sunPathPoint(h);
      var p = dot(v, F.U) > -0.01 ? project(v) : null;
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  function skyline(a) {
    var r = a * D2R;
    var h = 7 + Math.sin(r * 3 + 1) * 5 + Math.sin(r * 11 + 2) * 3 + Math.sin(r * 29) * 1.5;
    if (Math.sin(r * 57) > 0.9) h += 7;
    return h * Math.min(1.4, P.k / 420);
  }
  function drawGround(hpts, gy, sunAlt, twilight, sunP, moonP, moonAlt) {
    if (!hpts.length) return;
    var flat = clamp01((theta - 60) / 60);         // hills at the origin, a flat horizon at its antipode
    var sea = origin.mumbai ? flat : 0;            // Mumbai's antipode is open Pacific Ocean
    var day = clamp01((sunAlt + 8) / 14);
    var top = mixC(mixC([8, 11, 20], [34, 38, 58], day), mixC([6, 14, 30], [30, 74, 116], day), sea);
    var bot = mixC(mixC([3, 5, 10], [18, 20, 32], day), mixC([3, 8, 18], [14, 40, 70], day), sea);
    var gg = ctx.createLinearGradient(0, gy - 20, 0, H);
    gg.addColorStop(0, rgb(top)); gg.addColorStop(1, rgb(bot));
    ctx.fillStyle = gg;
    function hy(pt) { return pt[1] - skyline(pt[2]) * (1 - flat); }
    var first = hpts[0], last = hpts[hpts.length - 1];
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    ctx.lineTo(-10, Math.min(hy(first), H));
    hpts.forEach(function (pt) { ctx.lineTo(pt[0], hy(pt)); });
    ctx.lineTo(W + 10, Math.min(hy(last), H));
    ctx.lineTo(W + 10, H + 10);
    ctx.closePath(); ctx.fill();

    if (twilight > 0.05) {
      ctx.strokeStyle = 'rgba(255,190,140,' + 0.35 * twilight + ')';
      ctx.lineWidth = 1; ctx.beginPath();
      hpts.forEach(function (pt, i) { if (i) ctx.lineTo(pt[0], hy(pt)); else ctx.moveTo(pt[0], hy(pt)); });
      ctx.stroke();
    }
    // Glitter on the ocean below the Sun or the Moon
    if (sea > 0.2) {
      var src = sunP && sunAlt > 0 ? { p: sunP, c: '255,226,180', a: 0.55 }
        : (moonP && moonAlt > 0 ? { p: moonP, c: '220,228,255', a: 0.35 * eph.moonLit } : null);
      if (src && src.p[0] > 0 && src.p[0] < W) {
        var base = gy + 4, depth = H - base;
        for (var i = 0; i < 26; i++) {
          var y = base + Math.pow(i / 26, 1.6) * depth;
          var w = 6 + (i / 26) * 70 * (0.6 + 0.4 * Math.sin(i * 7.3));
          ctx.fillStyle = 'rgba(' + src.c + ',' + (src.a * sea * (1 - i / 30)) + ')';
          ctx.fillRect(src.p[0] - w / 2 + Math.sin(i * 3.1) * 8, y, w, 1.3);
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // Live caption
  // ---------------------------------------------------------------
  function fmtTime(ms, offsetHours) {
    var d = new Date(ms + offsetHours * 3600000);
    var h = d.getUTCHours(), m = d.getUTCMinutes();
    var ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function updateCaption() {
    if (!liveText) return;
    if (tween && tween.from !== tween.to) { liveText.textContent = 'Travelling to the other side of Earth…'; return; }
    var t = Date.now(), gmst = currentGmst(), F = frameAt(theta, gmst);
    var isDay = altOf(eph.sun, F) > -0.5;
    var up = [];
    if (altOf(moonFor(F), F) > 0) up.push('the Moon');
    eph.planets.forEach(function (p) { if (dot(p.v, F.U) > 0.05 && (isDay ? p.mag < -3.5 : p.mag < 1.8)) up.push(p.name); });
    var also = up.length ? ' Also up: ' + listJoin(up) + '.' : '';
    var ll = observerLatLon(F, gmst);
    var where = Math.abs(ll.lat).toFixed(0) + '° ' + (ll.lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(ll.lon).toFixed(0) + '° ' + (ll.lon >= 0 ? 'E' : 'W');
    if (theta < 90) {
      liveText.textContent = origin.mumbai
        ? 'Live: the sky over Mumbai right now, ' + fmtTime(t, 5.5) + ' IST.' + also
        : 'Live: the sky above you right now (' + where + '), ' + new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' + also;
    } else {
      liveText.textContent = 'Live: ' + (isDay ? 'daytime' : 'night') + ' right now on the opposite side of Earth, ' + where +
        (origin.mumbai ? ' in the South Pacific' : '') + ' (local solar time ' + fmtTime(t, ll.lon / 15) + ').' + also;
    }
  }

  // ---------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------
  var running = false, visible = true, raf = 0, lastDraw = 0, lastCheck = 0;
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function angLerp(a, b, t) { var d = ((b - a + 540) % 360) - 180; return a + d * t; }

  function frame(t) {
    if (tween) {
      var k = clamp01((t - tween.t0) / tween.dur), e = ease(k);
      theta = lerp(tween.from, tween.to, e);
      view = {
        az: angLerp(tween.v0.az, tween.v1.az, e), alt: lerp(tween.v0.alt, tween.v1.alt, e),
        cx: lerp(tween.v0.cx, tween.v1.cx, e), cy: lerp(tween.v0.cy, tween.v1.cy, e),
        kW: lerp(tween.v0.kW, tween.v1.kW, e), kH: lerp(tween.v0.kH, tween.v1.kH, e)
      };
      if (k >= 1) { theta = tween.to; tween = null; updateCaption(); }
    }
    // ~30 fps when idle is plenty for twinkling and a slowly turning sky
    if (tween || t - lastDraw > 32) { draw(t); lastDraw = t; }
    // Once a minute: follow sunrise and sunset, re-aim, refresh the caption
    if (!tween && t - lastCheck > 60000) { lastCheck = t; recheck(); }
    if (running) raf = requestAnimationFrame(frame);
  }
  function update() {
    var should = visible && !document.hidden;
    if (should && !running) { running = true; lastCheck = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }

  function goTo(targetTheta, animate) {
    var v1 = viewFor(targetTheta);
    if (!animate || reduceMotion.matches || !running) {
      tween = null; theta = targetTheta; view = v1; draw(performance.now()); updateCaption(); return;
    }
    tween = { from: theta, to: targetTheta, v0: view, v1: v1, t0: performance.now(), dur: targetTheta === theta ? 2000 : 4200 };
    updateCaption();
  }
  function recheck() {
    refreshEphemeris(true);
    var target = thetaFor(chosenTheme);
    if (target !== theta) { goTo(target, true); return; }
    if (Date.now() < manualUntil) { updateCaption(); return; }
    var v1 = viewFor(theta);
    if (Math.abs(((v1.az - view.az + 540) % 360) - 180) > 25 || Math.abs(v1.alt - view.alt) > 6) goTo(theta, true);
    else updateCaption();
  }

  function currentTheme() {
    var d = document.documentElement.dataset.theme;
    if (d) return d;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ---------------------------------------------------------------
  // Exploring: drag to look around, click or tap an object to identify it
  // ---------------------------------------------------------------
  var manualUntil = 0;
  var card = document.getElementById('sky-card');
  var resetBtn = document.getElementById('sky-reset');

  function describeStar(st) {
    var facts = STAR_FACTS[st.name];
    var colour = st.bv < 0 ? 'A hot blue-white star' : st.bv < 0.3 ? 'A white star' : st.bv < 0.6 ? 'A yellow-white star'
      : st.bv < 0.9 ? 'A yellow, Sun-like star' : st.bv < 1.4 ? 'A cool orange star' : 'A cool red star';
    var rows = [];
    if (st.desig) rows.push(['Designation', st.desig]);
    if (st.con) rows.push(['Constellation', st.con]);
    rows.push(['Brightness', 'magnitude ' + st.mag.toFixed(1)]);
    if (facts) rows.push(['Distance', facts[1]]);
    return { title: st.name || st.desig || 'Star', kind: facts ? facts[0] : colour, rows: rows };
  }
  function candidates(F) {
    var list = [];
    function push(v, info, pr) { if (dot(v, F.U) < 0) return; var p = project(v); if (onScreen(p)) list.push({ p: p, info: info, pr: pr }); }
    var sunAlt = altOf(eph.sun, F);
    push(eph.sun, function () { return { title: 'The Sun', kind: 'Our star', rows: [['Distance', (eph.sunDist * 8.317).toFixed(1) + ' light-minutes']] }; }, 3);
    var mv = moonFor(F);
    push(mv, function () {
      return { title: 'The Moon', kind: Math.round(eph.moonLit * 100) + '% lit right now',
        rows: [['Distance', Math.round(eph.moonDist * 6371).toLocaleString('en-US') + ' km'], ['Light takes', (eph.moonDist * 6371 / 299792).toFixed(2) + ' seconds']] };
    }, 3);
    eph.planets.forEach(function (pl) {
      push(pl.v, function () {
        return { title: pl.name, kind: 'A planet', rows: [['Distance now', (pl.dist * 149.6).toFixed(0) + ' million km'], ['Light takes', (pl.dist * 8.317).toFixed(1) + ' minutes'], ['Brightness', 'magnitude ' + pl.mag.toFixed(1)]] };
      }, 2);
    });
    NOTES.forEach(function (n) { push(n.v, function () { return { title: n.text, kind: n.kind, rows: [['Distance', n.dist]] }; }, 1.5); });
    if (CAT && sunAlt < 0) CAT.stars.forEach(function (st) { if (st.mag < 4.2) push(st.v, function () { return describeStar(st); }, 1 - st.mag * 0.1); });
    return list;
  }
  function pick(x, y) {
    var F = frameAt(theta, currentGmst());
    setupProjection(F);
    var best = null, bestD = 22 * 22;
    candidates(F).forEach(function (c) {
      var dx = c.p[0] - x, dy = c.p[1] - y, d = dx * dx + dy * dy - c.pr * 60;
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }
  function showCard(hit) {
    if (!card) return;
    var info = hit.info();
    card.querySelector('.sky-card-title').textContent = info.title;
    card.querySelector('.sky-card-kind').textContent = info.kind || '';
    var dl = card.querySelector('dl');
    dl.innerHTML = '';
    info.rows.forEach(function (r) {
      var row = document.createElement('div');
      var dt = document.createElement('dt'); dt.textContent = r[0];
      var dd = document.createElement('dd'); dd.textContent = r[1];
      row.appendChild(dt); row.appendChild(dd); dl.appendChild(row);
    });
    card.hidden = false;
    var cw = card.offsetWidth, ch = card.offsetHeight;
    var x = hit.p[0] + 18, y = hit.p[1] - ch / 2;
    if (x + cw > W - 12) x = hit.p[0] - 18 - cw;
    card.style.left = Math.max(12, x) + 'px';
    card.style.top = Math.max(72, Math.min(H - ch - 16, y)) + 'px';
    card.classList.add('show');
  }
  function hideCard() { if (card && !card.hidden) { card.classList.remove('show'); card.hidden = true; } }
  if (card) {
    card.querySelector('.sky-card-close').addEventListener('click', hideCard);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideCard(); });
  }

  var drag = null;
  function canvasXY(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  canvas.addEventListener('pointerdown', function (e) {
    if (zoom > 0.05) return;
    drag = { x: e.clientX, y: e.clientY, az: view.az, alt: view.alt, moved: false, touch: e.pointerType !== 'mouse', id: e.pointerId };
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) {
      if (e.target === canvas && e.pointerType === 'mouse') { var q = canvasXY(e); canvas.style.cursor = pick(q[0], q[1]) ? 'pointer' : 'grab'; }
      return;
    }
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    if (!drag.moved && drag.touch && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // let vertical swipes scroll the page
    if (!drag.moved) { drag.moved = true; hideCard(); canvas.style.cursor = 'grabbing'; try { canvas.setPointerCapture(drag.id); } catch (err) {} }
    var k = Math.max(W * view.kW, H * view.kH);
    view.az = rev(drag.az - dx / k * R2D);
    if (!drag.touch) view.alt = Math.max(0, Math.min(75, drag.alt + dy / k * R2D));
    tween = null;
    manualUntil = Date.now() + 120000;
    if (resetBtn) resetBtn.hidden = false;
  });
  window.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var wasDrag = drag.moved; drag = null;
    canvas.style.cursor = '';
    if (wasDrag) return;
    if (e.target !== canvas) return;
    var q = canvasXY(e), hit = pick(q[0], q[1]);
    if (hit) showCard(hit); else hideCard();
  });
  if (resetBtn) resetBtn.addEventListener('click', function () {
    manualUntil = 0; resetBtn.hidden = true; hideCard(); goTo(theta, true);
  });

  function chooseZoomTarget() {
    var F = frameAt(theta, currentGmst());
    setupProjection(F);
    if (altOf(eph.sun, F) > 0) return { v: eph.sun, col: 'rgba(255,238,210,' };
    // The brightest object on screen, preferring the right-hand side
    var best = null, bestScore = -Infinity;
    function consider(v, mag, col) {
      if (dot(v, F.U) < 0.15) return;
      var p = project(v); if (!onScreen(p)) return;
      var score = -mag + (p[0] / W) * 1.5;
      if (score > bestScore) { bestScore = score; best = { v: v, col: col }; }
    }
    eph.planets.forEach(function (pl) { consider(pl.v, pl.mag, 'rgba(255,240,220,'); });
    if (CAT) CAT.stars.forEach(function (st) { if (st.mag < 2) consider(st.v, st.mag, st.col); });
    return best || { v: P.c, col: 'rgba(220,230,255,' };
  }

  window.Sky = {
    set: function (theme, animate) {
      chosenTheme = theme;
      goTo(thetaFor(theme), animate);
    },
    // p in [0, 1]: how far the page has scrolled through the pinned hero
    setZoom: function (p) {
      p = clamp01(p);
      if (p > 0 && !zoomTarget) { zoomTarget = chooseZoomTarget(); hideCard(); }
      if (p === 0) zoomTarget = null;
      zoom = p;
      if (!running) draw(performance.now());
    },
    useLocation: function (lat, lon) {
      origin = { lat: lat, lon: lon, mumbai: false };
      manualUntil = 0; if (resetBtn) resetBtn.hidden = true; hideCard();
      theta = thetaFor(chosenTheme); view = viewFor(theta);
      draw(performance.now()); updateCaption();
    },
    useMumbai: function () {
      origin = MUMBAI;
      manualUntil = 0; if (resetBtn) resetBtn.hidden = true; hideCard();
      theta = thetaFor(chosenTheme); view = viewFor(theta);
      draw(performance.now()); updateCaption();
    }
  };

  var textBoxes = [];
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Labels must not sit under the intro text or the caption
    var cr = canvas.getBoundingClientRect();
    textBoxes = Array.prototype.map.call(document.querySelectorAll('.hero-text, .sky-bar'), function (el) {
      var r = el.getBoundingClientRect();
      return [r.left - cr.left - 10, r.top - cr.top - 10, r.width + 20, r.height + 20];
    });
  }

  resize();
  refreshEphemeris(true);
  chosenTheme = currentTheme();
  theta = thetaFor(chosenTheme);
  view = viewFor(theta);
  draw(0);
  updateCaption();
  update();
  loadCatalogue();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (!tween) view = viewFor(theta); draw(performance.now()); }, 150);
  });
  document.addEventListener('visibilitychange', function () { update(); if (!document.hidden) recheck(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; update(); }).observe(canvas);
  }
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', function () {
    if (!document.documentElement.dataset.theme) window.Sky.set(currentTheme(), true);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(performance.now()); });
})();
