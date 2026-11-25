/*
 * Isometric nature aquarium (interactive section map).
 *
 * One distinct, well-spaced object per section, laid out roughly in section order:
 *   01 Research      the main stone group (shaded low-poly rocks, the focal point)
 *   02 Experience    a thick piece of driftwood
 *   03 Education     a cairn of three river stones (one per degree)
 *   04 Publications  a group of background stem plants (back left)
 *   05 Honors        red and gold stem plants (back right)
 *   06 Skills        a hairgrass island (front right)
 *   07 Contact       a brass plaque on the stand
 *   CV               a second plaque on the stand (downloads the CV)
 * Labels sit outside the tank with leader lines. Each object has a padded
 * invisible hover area, so gaps between leaves still count. The fish are decoration.
 *
 * Coordinates: x runs along the long front glass, y runs from the back glass (0)
 * to the front glass (D), z is height. P(x, y, z) projects to screen space.
 */
function buildTank() {
  const mount = document.getElementById('tank');
  if (!mount) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── projection & helpers ──
  const U = 30, C = 0.8660254 * U, S = 0.5 * U;
  const L = 16, D = 6, HT = 5.4, WL = 4.95, SH = 1.15;  // tank length, depth, height, water level, stand height
  const P = (x, y, z) => [(x - y) * C, (x + y) * S - z * U];
  const n1 = (v) => v.toFixed(1);
  const pts = (a) => a.map((p) => n1(p[0]) + ',' + n1(p[1])).join(' ');
  const poly = (a, attrs) => `<polygon points="${pts(a)}" ${attrs || ''}/>`;
  const line = (a, b, attrs) => `<line x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}" ${attrs || ''}/>`;
  const ell = (p, rx, ry, fill, rot) =>
    `<ellipse cx="${n1(p[0])}" cy="${n1(p[1])}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${fill}"${rot ? ` transform="rotate(${rot.toFixed(0)} ${n1(p[0])} ${n1(p[1])})"` : ''}/>`;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shade = (pal, t) => pal[clamp(Math.round(t * (pal.length - 1)), 0, pal.length - 1)];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };

  // sand height: slopes up toward the back glass (classic nature-aquarium layout)
  const zs = (x, y) => 0.5 + 1.4 * Math.pow(1 - y / D, 1.25) + 0.3 * (1 - x / L) + 0.18 * Math.sin(x * 0.8) * (1 - y / D);
  const onSand = (x, y, dz) => P(x, y, zs(x, y) + (dz || 0));

  // ── hover areas: collect screen points per element, wrap them in a padded hull ──
  const hulls = {};
  let curKey = null;
  const track = (p) => { if (curKey) (hulls[curKey] = hulls[curKey] || []).push([p[0], p[1]]); };
  function convexHull(ps) {
    const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  function hitArea(key, pad) {
    const ps = hulls[key];
    if (!ps || ps.length < 3) return '';
    const h = convexHull(ps);
    const cx = h.reduce((a, p) => a + p[0], 0) / h.length, cy = h.reduce((a, p) => a + p[1], 0) / h.length;
    return poly(h.map(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return [x + dx / d * pad, y + dy / d * pad]; }), 'class="aq-hit" fill="transparent"');
  }

  const out = [];
  const callouts = [];
  const hitMeta = {};
  function begin(key) { curKey = key; }
  function hot(key, label, inner, pad) {
    hitMeta[key] = { pad: pad == null ? 10 : pad };
    curKey = null;
    return `<a href="#${key}" class="aq-hot" data-key="${key}" aria-label="${label}"><g class="aq-feat">${inner}</g></a>`;
  }
  // label box outside the tank, joined to the object by a leader line
  function callout(key, num, name, anchor, at) { callouts.push({ key, num, name, anchor, at }); }
  const sway = (inner, slow) => {
    const dur = ((slow ? 7 : 4.5) + rnd() * 3.5).toFixed(1), del = (-rnd() * 6).toFixed(1);
    return `<g class="aq-sway" style="animation-duration:${dur}s;animation-delay:${del}s">${inner}</g>`;
  };
  const qpt = (b, c, t, q) => [
    (1 - q) * (1 - q) * b[0] + 2 * (1 - q) * q * c[0] + q * q * t[0],
    (1 - q) * (1 - q) * b[1] + 2 * (1 - q) * q * c[1] + q * q * t[1],
  ];

  // ── defs ──
  out.push(`<defs>
    <linearGradient id="aq-water-back" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2d8a7c" stop-opacity=".55"/>
      <stop offset="1" stop-color="#0e403f" stop-opacity=".8"/>
    </linearGradient>
    <linearGradient id="aq-water-front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b9f3ea" stop-opacity=".10"/>
      <stop offset="1" stop-color="#7fd6c9" stop-opacity=".16"/>
    </linearGradient>
    <linearGradient id="aq-sand-face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3eee3"/>
      <stop offset="1" stop-color="#d8d0bf"/>
    </linearGradient>
    <linearGradient id="aq-ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8fffb" stop-opacity=".18"/>
      <stop offset="1" stop-color="#e8fffb" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="aq-brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7dc9a"/>
      <stop offset=".5" stop-color="#e2b866"/>
      <stop offset="1" stop-color="#b98a3e"/>
    </linearGradient>
    <radialGradient id="aq-moss" cx=".38" cy=".32" r=".75">
      <stop offset="0" stop-color="#8fd06a"/>
      <stop offset=".55" stop-color="#3f8a3e"/>
      <stop offset="1" stop-color="#1f4a26"/>
    </radialGradient>
    <filter id="aq-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <radialGradient id="aq-shadow">
      <stop offset="0" stop-color="#000" stop-opacity=".45"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>`);

  // ── floor shadow & stand ──
  {
    const c = P(L / 2, D / 2, -SH);
    out.push(`<ellipse cx="${n1(c[0])}" cy="${n1(c[1] + 6)}" rx="${n1((L + D) * C * 0.62)}" ry="${n1((L + D) * S * 0.5)}" fill="url(#aq-shadow)" class="aq-noev"/>`);
    out.push(poly([P(0, D, 0), P(L, D, 0), P(L, D, -SH), P(0, D, -SH)], 'fill="#162230"'));
    out.push(poly([P(L, 0, 0), P(L, D, 0), P(L, D, -SH), P(L, 0, -SH)], 'fill="#0f1924"'));
    out.push(`<polyline points="${pts([P(0, D, 0), P(L, D, 0), P(L, 0, 0)])}" fill="none" stroke="#2f4256" stroke-width="1.2"/>`);
    out.push(line(P(0, D, -SH + 0.12), P(L, D, -SH + 0.12), 'stroke="#22324200" stroke-width="1"'));
  }

  // ── back glass with the water behind everything ──
  out.push(`<g class="aq-noev">`);
  out.push(poly([P(0, 0, 0), P(L, 0, 0), P(L, 0, WL), P(0, 0, WL)], 'fill="url(#aq-water-back)"'));
  out.push(poly([P(0, 0, 0), P(0, D, 0), P(0, D, WL), P(0, 0, WL)], 'fill="url(#aq-water-back)" opacity=".85"'));
  out.push(poly([P(0, 0, WL), P(L, 0, WL), P(L, 0, HT), P(0, 0, HT)], 'fill="#cfe9ff" opacity=".03"'));
  out.push(poly([P(0, 0, WL), P(0, D, WL), P(0, D, HT), P(0, 0, HT)], 'fill="#cfe9ff" opacity=".03"'));
  for (let k = 0; k < 6; k++) {
    const x = 1.5 + k * 2.4 + rnd(), w = 0.35 + rnd() * 0.4;
    const ray = poly([P(x, 0.2, WL), P(x + w, 0.2, WL), P(x + w + 0.6, 0.2, 0.8), P(x + 0.6, 0.2, 0.8)], 'fill="url(#aq-ray)"');
    out.push(`<g class="aq-ray" style="animation-delay:${(-rnd() * 8).toFixed(1)}s">${ray}</g>`);
  }
  out.push(`</g>`);

  // ── sand bed ──
  {
    const nx = 32, ny = 12, cells = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) cells.push([i, j]);
    cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    out.push('<g class="aq-noev">');
    for (const [i, j] of cells) {
      const x0 = (i / nx) * L, x1 = ((i + 1) / nx) * L, y0 = (j / ny) * D, y1 = ((j + 1) / ny) * D;
      const lum = 84 + 3.5 * zs((x0 + x1) / 2, (y0 + y1) / 2) + rnd() * 1.6;
      const col = `hsl(42,20%,${lum.toFixed(1)}%)`;
      out.push(poly([P(x0, y0, zs(x0, y0)), P(x1, y0, zs(x1, y0)), P(x1, y1, zs(x1, y1)), P(x0, y1, zs(x0, y1))], `fill="${col}" stroke="${col}" stroke-width=".8"`));
    }
    for (let k = 0; k < 320; k++) {
      const p = onSand(rnd() * L, rnd() * D);
      out.push(`<circle cx="${n1(p[0])}" cy="${n1(p[1])}" r="${(0.5 + rnd() * 0.8).toFixed(2)}" fill="#8f8574" opacity="${(0.15 + rnd() * 0.25).toFixed(2)}"/>`);
    }
    out.push('</g>');
  }

  // ── shaded low-poly rock (shares the tank's lighting) ──
  const VIEW = [1, 1, 1.15], LIGHT = (() => { const v = [-0.35, 0.55, 1]; const d = Math.hypot(...v); return v.map((x) => x / d); })();
  function rock(cx, cy, r, h, o) {
    o = o || {};
    const z0 = o.z0 != null ? o.z0 : zs(cx, cy) - 0.12, ry = o.ry || 0.72, lean = o.lean || [0, 0];
    const dark = o.dark || '#5d6976', light = o.light || '#d3dbe2';
    const n = 9, rings = o.rings || [[1, 0], [0.92, 0.42], [0.58, 0.82]];
    const jit = Array.from({ length: n }, () => 0.8 + rnd() * 0.32), off = rnd() * 6.28;
    const R = rings.map(([f, zf]) => {
      const ring = [];
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.22, rr = r * f * jit[k] * (0.93 + rnd() * 0.14);
        ring.push([cx + Math.cos(a) * rr + lean[0] * zf * h, cy + Math.sin(a) * rr * ry + lean[1] * zf * h, z0 + zf * h * (0.92 + rnd() * 0.16)]);
      }
      return ring;
    });
    const peak = [cx + lean[0] * h + (rnd() - 0.5) * r * 0.25, cy + lean[1] * h, z0 + h];
    const faces = [];
    for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < n; k++) faces.push([R[i][k], R[i][(k + 1) % n], R[i + 1][(k + 1) % n], R[i + 1][k]]);
    for (let k = 0; k < n; k++) faces.push([R[R.length - 1][k], R[R.length - 1][(k + 1) % n], peak]);
    const centre = [cx + lean[0] * h * 0.4, cy + lean[1] * h * 0.4, z0 + h * 0.4];
    const vis = [];
    for (const f of faces) {
      const a = f[0], b = f[1], c = f[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const fc = [0, 1, 2].map((i) => f.reduce((s, p) => s + p[i], 0) / f.length);
      if ((fc[0] - centre[0]) * nrm[0] + (fc[1] - centre[1]) * nrm[1] + (fc[2] - centre[2]) * nrm[2] < 0) nrm = nrm.map((x) => -x);
      if (nrm[0] * VIEW[0] + nrm[1] * VIEW[1] + nrm[2] * VIEW[2] <= 0) continue;   // facing away
      const d = Math.hypot(...nrm) || 1;
      const lam = (nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]) / d;
      vis.push({ f, depth: fc[0] + fc[1] + fc[2] * 0.8, t: clamp(0.18 + 0.82 * lam, 0, 1) });
    }
    vis.sort((a, b) => a.depth - b.depth);
    const base = P(cx, cy, z0 + 0.05);
    let s = ell([base[0], base[1] + 2], r * C * 1.05, r * S * 0.75, '#3b4652', 0) .replace('/>', ' opacity=".28"/>');
    for (const { f, t } of vis) {
      const sp = f.map((p) => P(p[0], p[1], p[2]));
      sp.forEach(track);
      const col = mix(dark, light, t);
      s += poly(sp, `fill="${col}" stroke="${col}" stroke-width=".7" stroke-linejoin="round"`);
    }
    return s;
  }
  const moss = (x, y, n, spread) => {
    let s = '';
    for (let k = 0; k < n; k++) s += ell(onSand(x + (rnd() - 0.5) * spread, y + (rnd() - 0.5) * spread * 0.6, 0.03), 2.6 + rnd() * 2.6, 1.5 + rnd() * 1.3, pick(['#3e7d3c', '#4f9a4a', '#62b257', '#7cc964']));
    return s;
  };

  // ── plant species ──
  function needleStem(x, y, h, pal, bend) {
    const b = onSand(x, y, -0.05), t = P(x, y, zs(x, y) + h); t[0] += bend * 0.6;
    const c = [(b[0] + t[0]) / 2 + bend, (b[1] + t[1]) / 2];
    let s = `<path d="M${n1(b[0])} ${n1(b[1])} Q${n1(c[0])} ${n1(c[1])} ${n1(t[0])} ${n1(t[1])}" stroke="${pal[0]}" stroke-width="1" fill="none"/>`;
    const nodes = Math.floor(h * 7);
    for (let k = 2; k <= nodes; k++) {
      const q = k / nodes, p = qpt(b, c, t, q), col = shade(pal, q), len = 4.2 - q * 1.8;
      for (const a of [-150, -115, -65, -30]) {
        const r = (a + (rnd() - 0.5) * 14) * Math.PI / 180;
        s += `<line x1="${n1(p[0])}" y1="${n1(p[1])}" x2="${n1(p[0] + Math.cos(r) * len)}" y2="${n1(p[1] + Math.sin(r) * len * 0.8)}" stroke="${col}" stroke-width="1.1" stroke-linecap="round"/>`;
      }
    }
    s += ell(t, 2.6, 2.2, pal[pal.length - 1]);
    track(b); track(t);
    return sway(s);
  }
  function broadStem(x, y, h, pal, bend) {
    const b = onSand(x, y, -0.05), t = P(x, y, zs(x, y) + h); t[0] += bend * 0.6;
    const c = [(b[0] + t[0]) / 2 + bend, (b[1] + t[1]) / 2];
    let s = `<path d="M${n1(b[0])} ${n1(b[1])} Q${n1(c[0])} ${n1(c[1])} ${n1(t[0])} ${n1(t[1])}" stroke="${pal[0]}" stroke-width="1.4" fill="none"/>`;
    const pairs = Math.floor(h * 3.2);
    for (let k = 1; k <= pairs; k++) {
      const q = k / pairs, p = qpt(b, c, t, q), col = shade(pal, q), rx = 6.4 - q * 2.2;
      s += ell([p[0] - rx * 0.75, p[1] - 1], rx, 2.3, col, -24 + (rnd() - 0.5) * 10);
      s += ell([p[0] + rx * 0.75, p[1] - 1], rx, 2.3, col, 24 + (rnd() - 0.5) * 10);
    }
    track(b); track(t); track([t[0] - 7, t[1]]); track([t[0] + 7, t[1]]);
    return sway(s);
  }
  function ribbon(x, y, h, col) {
    const b = onSand(x, y, -0.05), H = h * U, lean = (rnd() - 0.5) * 18, tipBend = (rnd() < 0.5 ? -1 : 1) * (8 + rnd() * 10);
    const p1 = [b[0] + lean * 0.3, b[1] - H * 0.4], p2 = [b[0] + lean * 0.9, b[1] - H * 0.8], t = [b[0] + lean + tipBend, b[1] - H + 4];
    track(b); track(t); track(p2);
    return sway(`<path d="M${n1(b[0])} ${n1(b[1])} C${n1(p1[0])} ${n1(p1[1])} ${n1(p2[0])} ${n1(p2[1])} ${n1(t[0])} ${n1(t[1])}" stroke="${col}" stroke-width="${(1.8 + rnd() * 1.2).toFixed(1)}" stroke-linecap="round" fill="none" opacity=".92"/>`, true);
  }
  function redStem(x, y, h, bend) {
    const pal = ['#6f8a3a', '#8e6a35', '#b4493a', '#d8573f', '#ea6f4f', '#f09a5a', '#f4c977'];
    const b = onSand(x, y, -0.05), t = P(x, y, zs(x, y) + h); t[0] += bend * 0.6;
    const c = [(b[0] + t[0]) / 2 + bend, (b[1] + t[1]) / 2];
    let s = `<path d="M${n1(b[0])} ${n1(b[1])} Q${n1(c[0])} ${n1(c[1])} ${n1(t[0])} ${n1(t[1])}" stroke="#7a4a30" stroke-width="1.3" fill="none"/>`;
    const pairs = Math.floor(h * 3.6);
    for (let k = 1; k <= pairs; k++) {
      const q = k / pairs, p = qpt(b, c, t, q), col = shade(pal, q), rx = 5 - q * 1.4;
      s += ell([p[0] - rx * 0.7, p[1]], rx, 2.6, col, -18 + (rnd() - 0.5) * 12);
      s += ell([p[0] + rx * 0.7, p[1]], rx, 2.6, col, 18 + (rnd() - 0.5) * 12);
    }
    s += ell([t[0], t[1] - 1], 3.4, 2.4, '#f4c977');
    track(b); track(t); track([t[0] - 6, t[1]]); track([t[0] + 6, t[1]]);
    return sway(s);
  }
  function hairgrass(x, y, hgt) {
    const p = onSand(x, y, 0.02);
    let t = '';
    const n = 8 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const a = (-90 + (k / (n - 1) - 0.5) * 70 + (rnd() - 0.5) * 12) * Math.PI / 180, len = hgt * (0.7 + rnd() * 0.4);
      const ex = p[0] + Math.cos(a) * len, ey = p[1] + Math.sin(a) * len;
      t += `<path d="M${n1(p[0])} ${n1(p[1])} Q${n1(p[0] + Math.cos(a) * len * 0.3)} ${n1(p[1] + Math.sin(a) * len * 0.6)} ${n1(ex)} ${n1(ey)}" stroke="${pick(['#7fcf6a', '#a6e07f', '#5fae55', '#c2ec8f'])}" stroke-width=".95" stroke-linecap="round" fill="none"/>`;
    }
    track(p); track([p[0], p[1] - hgt]);
    return sway(t);
  }
  const carpetLeaf = (x, y) => {
    const p = onSand(x, y, 0.02), r = 2.0 + rnd() * 1.5;
    return ell([p[0], p[1] - 1], r, r * 0.62, pick(['#2f6b35', '#3e7d3c', '#4f9a4a', '#5ea852', '#6fbf5f', '#86d06d']));
  };

  // ════════════════════ the scene, back to front ════════════════════

  // 04 Publications: a compact background group, back left
  {
    begin('publications');
    const items = [];
    const greens = ['#2f6b35', '#3e7d3c', '#4f9a4a', '#62b257', '#7cc964', '#a6e07f'];
    const pinkTip = ['#3e7d3c', '#4f9a4a', '#6aa86a', '#c9a0a8', '#f0a6b6'];
    const limes = ['#4c7f2f', '#6aa33c', '#8cc44c', '#b3dc62', '#d6ef8a'];
    for (let k = 0; k < 20; k++) items.push(['rib', 0.3 + rnd() * 1.5, 0.25 + rnd() * 0.8]);
    for (let k = 0; k < 12; k++) items.push(['broad', 1.2 + rnd() * 1.5, 0.3 + rnd() * 1.0, limes]);
    for (let k = 0; k < 12; k++) items.push(['needle', 2.0 + rnd() * 1.5, 0.3 + rnd() * 1.1, greens]);
    for (let k = 0; k < 6; k++) items.push(['needle', 2.6 + rnd() * 0.9, 0.5 + rnd() * 0.8, pinkTip]);
    items.sort((a, b) => a[2] - b[2]);
    let g = '';
    for (const [kind, x, y, pal] of items) {
      const room = WL - zs(x, y) - 0.2;
      if (kind === 'rib') g += ribbon(x, y, Math.min(room + 0.15, 2.4 + rnd() * 0.9), pick(['#4f9a4a', '#5ea852', '#6fbf5f', '#3e7d3c']));
      else if (kind === 'needle') g += needleStem(x, y, Math.min(room, 1.8 + rnd() * 1.3), pal, (rnd() - 0.5) * 6);
      else g += broadStem(x, y, Math.min(room, 1.7 + rnd() * 1.1), pal, (rnd() - 0.5) * 5);
    }
    out.push(hot('publications', 'Publications', g));
    callout('publications', '04', 'Publications', P(2.3, 0.85, WL - 1.35), [-210, -170]);
  }

  // 05 Honors: red and gold stem plants, back right
  {
    begin('honors');
    const items = [];
    for (let k = 0; k < 16; k++) items.push([13.4 + rnd() * 2.2, 0.3 + rnd() * 1.3]);
    items.sort((a, b) => a[1] - b[1]);
    let g = '';
    for (const [x, y] of items) g += redStem(x, y, Math.min(WL - zs(x, y) - 0.3, 1.8 + rnd() * 1.3), (rnd() - 0.5) * 6);
    out.push(hot('honors', 'Honors, fellowships and scholarships', g));
    callout('honors', '05', 'Honors', P(14.3, 1.0, WL - 1.9), [560, 30]);
  }

  // quiet filler planting between the features (decorative, not links, lower contrast)
  {
    curKey = null;
    const items = [];
    for (let k = 0; k < 22; k++) items.push(['needle', 6.9 + rnd() * 6.2, 0.25 + rnd() * 0.7]);
    for (let k = 0; k < 10; k++) items.push(['rib', 3.6 + rnd() * 2.6, 0.2 + rnd() * 0.5]);
    items.sort((a, b) => a[2] - b[2]);
    const muted = ['#2c5a3a', '#346744', '#3e7650', '#4d8a5a', '#5f9c66'];
    let g = '<g class="aq-noev" opacity=".7">';
    for (const [kind, x, y] of items) {
      const room = WL - zs(x, y) - 0.4;
      g += kind === 'rib' ? ribbon(x, y, Math.min(room, 1.6 + rnd() * 0.8), pick(muted)) : needleStem(x, y, Math.min(room, 0.9 + rnd() * 1.0), muted, (rnd() - 0.5) * 5);
    }
    g += '</g><g class="aq-noev">';
    const patches = [[0.9, 4.0, 0.9, 0.6, 90], [10.9, 3.6, 1.5, 0.55, 120], [6.3, 5.2, 0.9, 0.45, 60], [15.0, 2.7, 0.7, 0.5, 50]];
    const leaves = [];
    for (const [cx, cy, rx, ry, n] of patches) {
      for (let k = 0; k < n; k++) {
        const th = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
        leaves.push([cx + Math.cos(th) * rx * r, cy + Math.sin(th) * ry * r]);
      }
    }
    leaves.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [x, y] of leaves) g += carpetLeaf(x, y);
    for (let k = 0; k < 26; k++) {                              // scattered pebbles
      const p = onSand(rnd() * L, 1.5 + rnd() * 4.3, 0.02);
      g += ell(p, 1.6 + rnd() * 2, 1 + rnd() * 1.1, pick(['#9aa3ab', '#b7bec4', '#7f8892', '#c9c2b4']));
    }
    out.push(g + '</g>');
  }

  // 01 Research: the iwagumi stone group, the focal point (about a third of the way in)
  {
    begin('research');
    let g = '';
    g += rock(4.0, 1.9, 0.5, 1.15, { lean: [-0.1, 0] });
    g += rock(5.6, 2.3, 0.95, 3.0, { lean: [0.14, -0.04], ry: 0.68 });       // main stone
    g += rock(4.3, 3.0, 0.62, 1.45, { lean: [-0.16, 0.02] });
    g += rock(6.9, 3.2, 0.5, 1.0, { lean: [0.1, 0] });
    g += moss(5.4, 3.2, 12, 2.2) + moss(4.0, 3.6, 8, 1.2);
    out.push(hot('research', 'Research and interests', g));
    callout('research', '01', 'Research', P(5.75, 2.25, zs(5.6, 2.3) + 2.3), [40, -215]);
  }

  // 02 Experience: one thick, gnarled piece of driftwood
  {
    begin('experience');
    const a = onSand(11.0, 2.8, -0.15), K = 1.25;
    const woodOutlines = [];
    function limb(p0, p1, p2, w0, w1) {
      p0 = [p0[0] * K, p0[1] * K]; p1 = [p1[0] * K, p1[1] * K]; p2 = [p2[0] * K, p2[1] * K]; w0 *= K * 1.35; w1 *= K * 1.35;
      const N = 16, left = [], right = [], spine = [];
      for (let k = 0; k <= N; k++) {
        const q = k / N;
        const x = (1 - q) * (1 - q) * p0[0] + 2 * (1 - q) * q * p1[0] + q * q * p2[0];
        const y = (1 - q) * (1 - q) * p0[1] + 2 * (1 - q) * q * p1[1] + q * q * p2[1];
        const tx = 2 * (1 - q) * (p1[0] - p0[0]) + 2 * q * (p2[0] - p1[0]);
        const ty = 2 * (1 - q) * (p1[1] - p0[1]) + 2 * q * (p2[1] - p1[1]);
        const d = Math.hypot(tx, ty) || 1, nx = -ty / d, ny = tx / d;
        const w = lerp(w0, w1, Math.pow(q, 0.8)) / 2 * (1 + 0.08 * Math.sin(q * 11 + w0));
        spine.push([a[0] + x, a[1] + y, nx, ny, w]);
        left.push([a[0] + x + nx * w, a[1] + y + ny * w]);
        right.push([a[0] + x - nx * w, a[1] + y - ny * w]);
      }
      left.concat(right).forEach(track);
      woodOutlines.push(left.concat(right.slice().reverse()));
      let s = poly(left.concat(right.slice().reverse()), 'fill="#4e3524"');
      const lit = spine.map(([x, y, nx, ny, w]) => { const sgn = (nx - ny) < 0 ? 1 : -1; return [x + sgn * nx * w * 0.45, y + sgn * ny * w * 0.45]; });
      s += `<polyline points="${pts(lit)}" fill="none" stroke="#9c7652" stroke-width="${n1(Math.max(1.2, (w0 + w1) * 0.16))}" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
      for (const off of [-0.25, 0.15]) {
        const gr = spine.filter((_, i) => i % 2 === 0).map(([x, y, nx, ny, w]) => [x + nx * w * off, y + ny * w * off]);
        s += `<polyline points="${pts(gr)}" fill="none" stroke="#3a281b" stroke-width=".8" opacity=".7"/>`;
      }
      return s;
    }
    // a heavy, sprawling piece: a low body lying across the sand with thick limbs rising out of it
    let g = '';
    g += limb([-30, -2], [-40, -30], [-36, -56], 13, 3.5);                  // back root, rising
    g += limb([14, -66], [-14, -92], [-48, -106], 14, 3.5);                 // upper-left limb
    g += limb([2, -116], [10, -138], [4, -160], 8, 2.2);                    // top twig
    g += limb([24, -28], [18, -74], [2, -118], 26, 10);                     // main upright limb
    g += limb([34, -34], [64, -54], [88, -92], 19, 5);                      // right limb
    g += limb([-60, 6], [-10, -8], [38, -34], 34, 26);                      // the body, lying diagonally
    g += limb([38, -30], [74, -30], [108, -20], 15, 3.5);                   // right low limb
    g += limb([-56, 6], [-82, 12], [-106, 6], 18, 4);                       // front claw
    g += limb([-52, 0], [-72, -12], [-92, -28], 14, 3);                     // front claw, raised
    // cast shadow: every limb outline projected onto the sand, away from the light (down and to the right)
    {
      const shadowOf = (pts2) => pts2.map(([x, y]) => { const h = Math.max(0, a[1] - y); return [x + h * 0.5, a[1] + 4 + h * 0.12]; });
      const sh = woodOutlines.map((o) => poly(shadowOf(o), '')).join('');
      g = `<g class="aq-noev" filter="url(#aq-soft)" fill="#3a2e22" opacity=".32">${sh}</g>` + g;
    }
    // fluffy moss cushions sitting on the wood (not on the tips)
    for (const [mx, my, r] of [[-22, -14, 11], [10, -24, 12], [26, -46, 9], [50, -44, 8], [-60, 0, 7]]) {
      for (let k = 0; k < 16; k++) {
        const th = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r * K;
        g += ell([a[0] + mx * K + Math.cos(th) * rr, a[1] + my * K + Math.sin(th) * rr * 0.55 - 2], 1.6 + rnd() * 1.4, 1.1 + rnd() * 0.8, pick(['#3e7d3c', '#4f9a4a', '#62b257', '#7cc964', '#a6e07f']));
      }
    }
    out.push(hot('experience', 'Experience', g));
    callout('experience', '02', 'Experience', [a[0] + 20 * K, a[1] - 70 * K], [330, -175]);
  }

  // a low carpet in front of the stones (decorative, not a link)
  {
    let g = '<g class="aq-noev">';
    const leaves = [];
    for (let k = 0; k < 360; k++) {
      const x = 2.6 + rnd() * 4.8, y = 3.3 + rnd() * 1.9;
      if (Math.hypot((x - 5.0) / 2.6, (y - 4.1) / 1.0) > 1) continue;
      leaves.push([x, y]);
    }
    leaves.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [x, y] of leaves) g += carpetLeaf(x, y);
    out.push(g + '</g>');
  }

  // 03 Education: three moss balls resting on the sand, front left
  {
    begin('education');
    let g = '';
    const balls = [[2.9, 4.75, 15], [1.95, 5.05, 19], [2.55, 5.55, 12]];   // drawn back to front
    balls.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
    for (const [x, y, r] of balls) {
      const b = onSand(x, y, 0);
      const c = [b[0], b[1] - r * 0.92];
      g += ell([b[0] + 2, b[1] + 1], r * 1.05, r * 0.32, '#2d3a2c').replace('/>', ' opacity=".35"/>');
      g += `<circle cx="${n1(c[0])}" cy="${n1(c[1])}" r="${r}" fill="url(#aq-moss)"/>`;
      // fuzzy strands around the edge and across the surface
      for (let k = 0; k < r * 5; k++) {
        const th = rnd() * Math.PI * 2, rr = r * (0.35 + rnd() * 0.68), len = 1.4 + rnd() * 2.2;
        const x0 = c[0] + Math.cos(th) * rr, y0 = c[1] + Math.sin(th) * rr, ang = th + (rnd() - 0.5) * 1.2;
        const lit = (Math.cos(th) * -0.6 + Math.sin(th) * -0.8) > 0;
        g += `<line x1="${n1(x0)}" y1="${n1(y0)}" x2="${n1(x0 + Math.cos(ang) * len)}" y2="${n1(y0 + Math.sin(ang) * len)}" stroke="${lit ? pick(['#7cc964', '#a6e07f', '#62b257']) : pick(['#2f6b35', '#3e7d3c', '#24572d'])}" stroke-width=".9" stroke-linecap="round"/>`;
      }
      [[c[0] - r, c[1]], [c[0] + r, c[1]], [c[0], c[1] - r], [b[0], b[1]]].forEach(track);
    }
    out.push(hot('education', 'Education', g, 10));
    callout('education', '03', 'Education', P(2.4, 5.0, zs(2.4, 5.0) + 0.9), [-235, 150]);
  }

  // 06 Skills: a hairgrass island, front right
  {
    begin('skills');
    const items = [];
    for (let k = 0; k < 260; k++) {
      const x = 12.2 + rnd() * 3.0, y = 4.0 + rnd() * 1.8;
      if (Math.hypot((x - 13.7) / 1.5, (y - 4.9) / 0.9) > 1) continue;
      items.push([x, y, 'leaf']);
    }
    for (let k = 0; k < 34; k++) {
      const th = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      items.push([13.7 + Math.cos(th) * 1.3 * r, 4.9 + Math.sin(th) * 0.75 * r, 'tuft']);
    }
    items.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    let g = '';
    for (const [x, y, kind] of items) {
      if (kind === 'leaf') { g += carpetLeaf(x, y); track(onSand(x, y)); }
      else g += hairgrass(x, y, 11 + rnd() * 9);
    }
    out.push(hot('skills', 'Methods and technical skills', g, 8));
    callout('skills', '06', 'Skills', onSand(13.7, 4.85, 0.4), [560, 300]);
  }

  // decorative school of tetras high in the water (swims upright; not a link)
  const school = { cx: 8.4, cy: 2.2, cz: 4.15, rx: 3.6, ry: 1.0, fish: [] };
  {
    const fish = `<g class="aq-fishbody">
      <path d="M-7 0 L-11 -3 L-11 3 Z" fill="#cfe3ef" opacity=".8"/>
      <ellipse cx="0" cy="0" rx="7" ry="2.6" fill="#d9eef7"/>
      <path d="M-6 0.2 Q0 1.2 5 0.4 L5 1.6 Q0 2.6 -6 1.4 Z" fill="#ff5a6e"/>
      <path d="M-5 -0.9 Q0 -0.2 6 -0.8 L6 0.1 Q0 0.6 -5 0 Z" fill="#45e0ff"/>
      <circle cx="4.6" cy="-0.6" r=".7" fill="#0a131c"/>
    </g>`;
    let g = '<g class="aq-noev">';
    for (let k = 0; k < 8; k++) {
      school.fish.push({ lag: k * 0.07 + rnd() * 0.04, ox: (rnd() - 0.5) * 16, oy: (rnd() - 0.5) * 8, face: 1, wig: rnd() * 6 });
      g += `<g class="aq-fish">${fish}</g>`;
    }
    out.push(g + '</g>');
  }

  // CO₂ bubbles in the back corner (decorative)
  {
    const b = onSand(0.8, 2.2, 0.2), top = P(0.8, 2.2, WL);
    let g = `<g class="aq-noev"><ellipse cx="${n1(b[0])}" cy="${n1(b[1])}" rx="4" ry="2.4" fill="#d9f1ff" opacity=".5"/>`;
    if (!reduce) {
      for (let k = 0; k < 7; k++) {
        const r = (1.2 + rnd() * 1.6).toFixed(1), dur = (3.5 + rnd() * 2.5).toFixed(1), del = (-rnd() * 5).toFixed(1), wob = (rnd() - 0.5) * 6;
        g += `<circle r="${r}" fill="none" stroke="#e7fbff" stroke-opacity=".7" stroke-width=".8">
          <animate attributeName="cy" from="${n1(b[1])}" to="${n1(top[1])}" dur="${dur}s" begin="${del}s" repeatCount="indefinite"/>
          <animate attributeName="cx" values="${n1(b[0])};${n1(b[0] + wob)};${n1(b[0] - wob * 0.5)};${n1(b[0] + wob * 0.3)}" dur="${dur}s" begin="${del}s" repeatCount="indefinite"/>
        </circle>`;
      }
    }
    out.push(g + '</g>');
  }

  // ── sand cross-section seen through the front glass ──
  {
    const front = [], side = [];
    for (let x = L; x >= 0; x -= 0.5) front.push(P(x, D, zs(x, D)));
    for (let y = D; y >= 0; y -= 0.5) side.push(P(L, y, zs(L, y)));
    const strata = 0.32;
    out.push('<g class="aq-noev">');
    out.push(poly([P(0, D, 0), P(L, D, 0), P(L, D, strata), P(0, D, strata)], 'fill="#8f8a80"'));
    out.push(poly([P(0, D, strata), P(L, D, strata)].concat(front), 'fill="url(#aq-sand-face)"'));
    out.push(poly([P(L, 0, 0), P(L, D, 0), P(L, D, strata), P(L, 0, strata)], 'fill="#7d786f"'));
    out.push(poly([P(L, D, strata), P(L, 0, strata)].concat(side.reverse()), 'fill="#d6cebd"'));
    for (let k = 0; k < 140; k++) {
      const p = rnd() < 0.75 ? P(rnd() * L, D, rnd() * strata) : P(L, rnd() * D, rnd() * strata);
      out.push(`<ellipse cx="${n1(p[0])}" cy="${n1(p[1])}" rx="${(1.2 + rnd() * 1.6).toFixed(1)}" ry="${(0.9 + rnd()).toFixed(1)}" fill="${pick(['#6d6860', '#a7a196', '#5c5852', '#bdb6aa'])}"/>`);
    }
    out.push('</g>');
  }

  // ── front water, surface and glass ──
  out.push('<g class="aq-noev">');
  out.push(poly([P(0, D, 0), P(L, D, 0), P(L, D, WL), P(0, D, WL)], 'fill="url(#aq-water-front)"'));
  out.push(poly([P(L, 0, 0), P(L, D, 0), P(L, D, WL), P(L, 0, WL)], 'fill="url(#aq-water-front)" opacity=".9"'));
  out.push(poly([P(0, 0, WL), P(L, 0, WL), P(L, D, WL), P(0, D, WL)], 'fill="#bff6ee" opacity=".10"'));
  out.push(`<polyline class="aq-ripple" points="${pts([P(0, D, WL), P(L, D, WL), P(L, 0, WL)])}" fill="none" stroke="#d8fff9" stroke-opacity=".6" stroke-width="1.2" stroke-dasharray="14 6 3 6"/>`);
  const dim = 'stroke="#dff4ff" stroke-opacity=".22" stroke-width="1"';
  const bright = 'stroke="#e9f8ff" stroke-opacity=".6" stroke-width="1.3"';
  out.push(line(P(0, 0, 0), P(0, 0, HT), dim));
  out.push(line(P(0, 0, HT), P(L, 0, HT), dim));
  out.push(line(P(0, 0, HT), P(0, D, HT), dim));
  out.push(line(P(L, 0, 0), P(L, 0, HT), bright));
  out.push(line(P(0, D, 0), P(0, D, HT), bright));
  out.push(line(P(L, D, 0), P(L, D, HT), 'stroke="#f2fbff" stroke-opacity=".85" stroke-width="1.6"'));
  out.push(`<polyline points="${pts([P(0, D, HT), P(L, D, HT), P(L, 0, HT)])}" fill="none" ${bright}/>`);
  out.push(`<polyline points="${pts([P(0, D, 0), P(L, D, 0), P(L, 0, 0)])}" fill="none" ${bright}/>`);
  out.push(poly([P(1.2, D, HT - 0.3), P(2.0, D, HT - 0.3), P(4.6, D, 0.6), P(3.8, D, 0.6)], 'fill="#ffffff" opacity=".045"'));
  out.push('</g>');

  // ── hover/click layer: padded outlines, stacked by priority (last = on top) ──
  {
    let h = '<g class="aq-hitlayer">';
    for (const key of ['publications', 'honors', 'skills', 'research', 'experience', 'education']) {
      h += `<a href="#${key}" class="aq-hot aq-hitonly" data-key="${key}" tabindex="-1" aria-hidden="true">${hitArea(key, hitMeta[key].pad)}</a>`;
    }
    out.push(h + '</g>');
  }

  // ── callouts (outside the tank): one line each, leader runs straight in to the object ──
  const boxes = [];
  for (const c of callouts) {
    const [ax, ay] = c.anchor, [bx, by] = c.at;
    const title = `${c.num}  ${c.name}`;
    const w = title.length * 7.6 + 26, h = 28;
    const x0 = bx - w / 2, y0 = by - h / 2;
    // leave the box from the side facing the object
    const dx = ax - bx, dy = ay - by;
    const ex = Math.abs(dx) / (w / 2) > Math.abs(dy) / (h / 2) ? bx + Math.sign(dx) * w / 2 : clamp(ax, x0 + 10, x0 + w - 10);
    const ey = Math.abs(dx) / (w / 2) > Math.abs(dy) / (h / 2) ? by : by + Math.sign(dy) * h / 2;
    boxes.push([x0, y0, x0 + w, y0 + h]);
    out.push(`<a href="#${c.key}" class="aq-call" data-key="${c.key}" aria-label="${c.name}">
      <line class="halo" x1="${n1(ex)}" y1="${n1(ey)}" x2="${n1(ax)}" y2="${n1(ay)}"/>
      <line class="lead" x1="${n1(ex)}" y1="${n1(ey)}" x2="${n1(ax)}" y2="${n1(ay)}"/>
      <circle cx="${n1(ax)}" cy="${n1(ay)}" r="3.2"/>
      <rect x="${n1(x0)}" y="${n1(y0)}" width="${n1(w)}" height="${h}" rx="8"/>
      <text class="t" x="${n1(bx)}" y="${n1(by + 4.2)}" text-anchor="middle">${title}</text>
    </a>`);
  }

  // ── assemble ──
  const corners = [P(0, 0, HT), P(L, 0, HT), P(L, D, -SH), P(0, D, -SH), P(0, D, HT), P(L, 0, -SH)];
  const xs = corners.map((p) => p[0]).concat(boxes.flatMap((b) => [b[0], b[2]]));
  const ys = corners.map((p) => p[1]).concat(boxes.flatMap((b) => [b[1], b[3]]));
  const minX = Math.min(...xs) - 12, maxX = Math.max(...xs) + 12, minY = Math.min(...ys) - 12, maxY = Math.max(...ys) + 26;
  mount.innerHTML = `<svg viewBox="${n1(minX)} ${n1(minY)} ${n1(maxX - minX)} ${n1(maxY - minY)}" role="group" aria-label="Aquarium map of this page">${out.join('')}</svg>`;

  // ── fish: swim a loop, always upright, turning around with a quick squash-flip ──
  const fishEls = Array.from(mount.querySelectorAll('.aq-fish'));
  const loopPos = (th) => P(school.cx + school.rx * Math.cos(th), school.cy + school.ry * Math.sin(th), school.cz + 0.25 * Math.sin(2 * th));
  const SPEED = (Math.PI * 2) / 34;
  function placeFish(t, dt) {
    fishEls.forEach((el, i) => {
      const f = school.fish[i];
      const th = (t - f.lag * 6) * SPEED;
      const a = loopPos(th), b = loopPos(th + 0.01);
      const vx = b[0] - a[0], vy = b[1] - a[1];
      f.face += ((vx >= 0 ? 1 : -1) - f.face) * Math.min(1, dt * 6);
      const tilt = clamp(Math.atan2(vy, Math.abs(vx) + 1e-6) * 180 / Math.PI, -22, 22) * Math.sign(f.face || 1);
      const bob = Math.sin(t * 2.2 + f.wig) * 1.2;
      el.setAttribute('transform', `translate(${n1(a[0] + f.ox)} ${n1(a[1] + f.oy + bob)}) rotate(${tilt.toFixed(1)}) scale(${(f.face * 1.35).toFixed(3)} 1.35)`);
    });
  }
  if (reduce) placeFish(4, 1);
  else {
    let visible = true, last = performance.now();
    // pause everything in the tank (fish, swaying plants, light rays) while it's off-screen
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; mount.classList.toggle('aq-paused', !visible); }).observe(mount);
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (visible) placeFish(now / 1000, dt);
    };
    placeFish(0, 1);
    requestAnimationFrame(loop);
  }

  // ── linked highlighting: object ↔ callout ↔ legend entry ──
  const all = Array.from(document.querySelectorAll('[data-key]'));
  const setHot = (key, on) => all.forEach((el) => { if (el.dataset.key === key) el.classList.toggle('is-hot', on); });
  all.forEach((el) => {
    const key = el.dataset.key;
    el.addEventListener('mouseenter', () => setHot(key, true));
    el.addEventListener('mouseleave', () => setHot(key, false));
    el.addEventListener('focus', () => setHot(key, true));
    el.addEventListener('blur', () => setHot(key, false));
  });
}

// Build the tank only when it is about to scroll into view (it is ~5,000 SVG shapes),
// so it never competes with the first paint of the hero.
(function () {
  const mount = document.getElementById('tank');
  if (!mount) return;
  if (!('IntersectionObserver' in window)) { buildTank(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); buildTank(); }
  }, { rootMargin: '900px 0px' });
  io.observe(mount);
})();
