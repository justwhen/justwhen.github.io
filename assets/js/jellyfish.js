/*
 * Procedural ASCII "lantern jelly".
 *
 * Motion is modelled on a swimming moon jelly (and matched against filmed footage):
 *  - A slow stroke (~4.5 s): the bell squeezes into a tall dome, then relaxes
 *    into a wide, flat cap. The rim follows the apex on its own spring, so it lags.
 *  - Short, frilly oral arms trail as soft verlet chains in the water flow,
 *    curling in slow, out-of-step waves so they tangle.
 *  - The view follows the bell like a tracking camera, with a gentle drift.
 *  - A warm core glows inside the bell, with a faint aura around it.
 *
 * Text layers drawn each frame and stacked in CSS:
 *   #jelly-body: translucent body, lavender gradient
 *   #jelly-glow: rib lines and inner light, cyan with a glow
 * The creature is drawn upright in a local field, then sampled through a
 * rotation (CONFIG.tiltDeg, clockwise from vertical) onto the output grid.
 * window.JELLY_TAP (jelly-styles.js) can redraw the same fields in other styles.
 */
(function () {
  const bodyEl = document.getElementById('jelly-body');
  const glowEl = document.getElementById('jelly-glow');
  const goldEl = document.getElementById('jelly-gold');     // gold streaks
  if (!bodyEl || !glowEl) return;

  const CONFIG = {
    cols: 96,
    rows: 66,
    charAspect: 0.6,            // mono glyph width / height at line-height 1
    tiltDeg: 28,                // heading, clockwise from straight up
    ribs: 8,
    spin: 0.12,                 // rib rotation speed (rad/s)
    strokePeriod: 3.6,          // seconds per swim stroke (before timeScale)
    streaks: 34,                // drifting ASCII streaks around the jelly
    goldStreaks: 0.35,          // share of streaks drawn in gold
    tentacleDamping: 0.9,       // per-frame velocity kept by tentacle nodes (lower = more drag)
    squeeze: 0.3,               // how much the bell narrows on the stroke
    stretch: 0.2,               // how much taller it gets on the stroke (and flatter on the rebound)
    bounce: 0.78,               // apex spring damping: lower = bouncier follow-through (0.3–0.8)
    rimBounce: 0.55,            // rim spring damping: lower = springier rim (0.3–0.7)
    rimFlare: 0.2,             // how far the bottom of the bell flares out after each squeeze (0 = none)
    flare: 0.4,                 // how wide the rim kicks out during the flare
    squeezeShare: 0.3,         // share of each cycle spent squeezing (the rest is the slower release)
    timeScale: 0.8,             // overall animation speed (1 = normal, lower = slower)
    lightPulse: 1.0,            // strength of the bioluminescent wave that runs down the ribs each stroke
    bodyRamp: ' .,:;-~=+*oxO#',
    glowRamp: ' .:+*oO@',
    // 24 fps reads as smooth for a slow drift; phones and low-core devices draw at 18 to save battery
    // full frame rate keeps the slow glide smooth; phones and low-core devices draw at 30 to save battery
    fps: (window.matchMedia('(max-width: 640px)').matches || (navigator.hardwareConcurrency || 8) <= 4) ? 30 : 60,
  };

  const W = CONFIG.cols, H = CONFIG.rows, A = CONFIG.charAspect;
  const PW = W * A;
  const LW = 140, LH = 120, LPW = LW * A;
  const body = new Float32Array(LW * LH);
  const glow = new Float32Array(LW * LH);
  const aura = new Float32Array(LW * LH);      // warm core inside the bell + soft glow around it
  const BR = CONFIG.bodyRamp, GR = CONFIG.glowRamp;

  const th = CONFIG.tiltDeg * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
  const OX = PW / 2 - 4, OY = H / 2 + 4;      // output pivot
  const LX = LPW / 2, LY = 46;                 // where the bell hangs in the local field
  const PLY = 46;                              // local point that lands on the output pivot

  const A0 = 15.5, B0 = 20;                    // resting bell radius / height

  let pointerX = 0, pointerTarget = 0;
  window.addEventListener('pointermove', (e) => {
    pointerTarget = (e.clientX / window.innerWidth) * 2 - 1;
  }, { passive: true });

  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ── stroke: one continuous muscle signal driving two springs ──
  // The muscle signal is a single smooth wave (no keyframes, no stops): it rises
  // quickly and falls slowly because time is warped. The bell apex follows it
  // through a soft spring, and the rim follows the apex through a second spring,
  // so the squeeze rolls down the bell and the release overshoots into a flare
  // on its own, all as one connected motion.
  function muscle(phase) {
    // A lopsided triangle wave: squeeze at a steady pace, then relax at a slower steady pace.
    // It never holds still; the springs below round off the two turnarounds, and the
    // turnaround at the bottom is what swings the rim out into its flare.
    const u = ((phase % 1) + 1) % 1, up = CONFIG.squeezeShare;
    const e = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    return u < up ? e(u / up) : 1 - e((u - up) / (1 - up));
  }
  // The rim follows its own continuous path: it squeezes with the bell, releases a little
  // faster than the apex, swings out past neutral into a flare, then eases slowly back and
  // rolls straight into the next squeeze (never holds still).
  function rimPath(phase) {
    const u = ((phase % 1) + 1) % 1, up = CONFIG.squeezeShare, A = CONFIG.rimFlare, R1 = 0.3;
    if (u < up) return u / up;
    if (u < up + R1) { const s = (u - up) / R1; return 1 + (-A - 1) * (0.5 - 0.5 * Math.cos(Math.PI * s)); }
    const s = (u - up - R1) / (1 - up - R1);
    return -A * (1 - Math.pow(s, 1.6));                         // slow return, still moving when the next squeeze begins
  }
  // spring states: apex (x1) and rim (x2), with velocities
  const bell = { x1: 0, v1: 0, x2: 0, v2: 0 };
  function stepBell(target, dt, phase) {
    const w1 = 9, w2 = 7.5;                                      // natural frequencies (rad/s): firm enough to keep up with the stroke
    const z = CONFIG.bounce;
    const rimTarget = rimPath(phase);
    const sub = 4, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      bell.v1 += (w1 * w1 * (target - bell.x1) - 2 * z * w1 * bell.v1) * h;
      bell.x1 += bell.v1 * h;
      bell.v2 += (w2 * w2 * (rimTarget - bell.x2) - 2 * CONFIG.rimBounce * w2 * bell.v2) * h;
      bell.x2 += bell.v2 * h;
    }
  }

  // ── passive appendages as verlet chains ──
  function makeChain(n, segLen, x0, y0, damping, flow, curl) {
    const nodes = [];
    for (let i = 0; i < n; i++) nodes.push({ x: x0, y: y0 + i * segLen, px: x0, py: y0 + i * segLen });
    return { nodes, segLen, damping, flow, curl };
  }
  const tentacles = [];
  for (let k = 0; k < 0; k++) {   // no thin rim tentacles (kept as code in case they come back)
    const len = B0 * (1.7 + 0.45 * Math.sin(k * 1.9));
    tentacles.push(Object.assign(makeChain(30, len / 29, LX, LY, CONFIG.tentacleDamping, 1.0, 1.0), { u: (k / 11) * 2 - 1, k }));
  }
  const arms = [];
  for (let k = 0; k < 6; k++) {
    const len = B0 * (0.85 + 0.3 * Math.abs(Math.sin(k * 2.1)));
    arms.push(Object.assign(makeChain(18, len / 17, LX, LY, 0.92, 0.8, 0.5), { u: (k / 5 - 0.5) * 0.75, k, splay: (k / 5 - 0.5) * 4 }));
  }

  // body state
  let speed = 0, surge = 0, lastT = null;
  const motes = Array.from({ length: 16 }, () => ({ x: LX + (rand() - 0.5) * 30, y: LY + rand() * 40, s: 0.5 + rand(), p: rand() * 6.28 }));

  function stepChain(ch, ax, ay, dt, t, phase) {
    const n = ch.nodes;
    n[0].px = n[0].x; n[0].py = n[0].y; n[0].x = ax; n[0].y = ay;
    const damp = Math.pow(ch.damping, dt * 30);
    const flowAcc = (speed * 12 + 7) * ch.flow;               // water streaming past pushes them back
    const TAU = Math.PI * 2;
    for (let i = 1; i < n.length; i++) {
      const p = n[i];
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      const s = i / (n.length - 1);
      // a slow S-wave that rolls from the rim to the tip after every stroke,
      // plus a lazy current so no two strands move alike
      const wave = 3 * Math.sin(phase * TAU - s * 4 + ch.k * 0.35)
                 + 2.5 * Math.sin(t * 0.45 - s * 3 + ch.k * 0.6)
                 + 1 * Math.sin(t * 1.1 - p.y * 0.2 + ch.k * 0.5);
      p.x += vx + (ch.curl * wave + (ch.splay || 0)) * s * dt * dt;   // splay: arms fan out a little
      p.y += vy + flowAcc * dt * dt;
    }
    // soft length constraints: two passes keeps the strands loose and stretchy
    for (let it = 0; it < 2; it++) {
      for (let i = 1; i < n.length; i++) {
        const a = n[i - 1], b = n[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const diff = ((d - ch.segLen) / d) * 0.8;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
    }
  }

  function put(f, px, py, v) {
    const i = Math.round(px / A - 0.5), j = Math.round(py - 0.5);
    if (i < 0 || i >= LW || j < 0 || j >= LH) return;
    const k = j * LW + i;
    if (v > f[k]) f[k] = v;
  }

  function simulate(t) {
    const dt = lastT === null ? 1 / 30 : Math.min(0.05, Math.max(0.001, t - lastT));
    lastT = t;
    pointerX += (pointerTarget - pointerX) * 0.03;

    const phase = t / CONFIG.strokePeriod;
    stepBell(muscle(phase), dt, phase);
    const c = bell.x1;
    // thrust comes from the rim closing (that's what pushes water), so the surge follows the squeeze smoothly
    if (bell.v2 > 0) speed += bell.v2 * 0.7 * dt;   // thrust (drives the water flow past the arms)
    speed *= Math.exp(-1.1 * dt);                              // drag
    surge += (-speed * 0.4 - surge * 0.9) * dt;   // glide forward, drift back (small: the camera follows the animal)

    const st = {
      t, phase, c,
      cx: LX + 0.6 * Math.sin(t * 0.23) + pointerX * 1.5,
      cy: LY - 10 + 1.2 * Math.sin(t * 0.37) + surge,
      // gentle sway, plus the apex leaning slightly as it moves (continuous, from the spring velocity)
      lean: 0.9 * Math.sin(t * 0.55) + 0.5 * Math.sin(t * 0.21) + 0.12 * (bell.v1 - bell.v2),
    };
    // contraction at height h (0 rim … 1 apex): smooth blend from the rim spring to the apex spring
    st.cAt = (h) => {
      const k = Math.pow(Math.max(0, Math.min(1, h)), 0.8);
      return bell.x2 + (bell.x1 - bell.x2) * k;
    };
    st.R = (h) => {
      const ch = st.cAt(h);
      const flat = Math.max(0, -ch);                            // rebound: squashed wide
      return A0 * Math.pow(Math.max(0, 1 - Math.pow(h, 2.2)), 0.45)
        * (1 + 0.05 * Math.sin(h * Math.PI))                    // full shoulders
        * (1 - CONFIG.squeeze * ch * Math.pow(1 - h, 0.6))      // squeeze (or widen when ch < 0), strongest near the rim
        * (1 + CONFIG.flare * flat * Math.pow(1 - h, 2.5));     // rim flares out on the rebound
    };
    // height tracks the same squeeze as the width (rough volume conservation), so they move together
    st.b = B0 * (1 + CONFIG.stretch * (0.5 * bell.x1 + 0.5 * bell.x2));
    st.cRim = bell.x2;
    st.rimR = st.R(0);

    // anchors follow the moving, deforming rim
    for (const tn of tentacles) {
      stepChain(tn, st.cx + tn.u * st.rimR * 0.95, st.cy + 1.0 - 0.6 * st.cRim * Math.abs(tn.u), dt, t, phase);
    }
    for (const ar of arms) {
      stepChain(ar, st.cx + ar.u * st.rimR * 0.6, st.cy + 0.4, dt, t, phase - 0.15);
    }
    return st;
  }

  function drawChainLine(ch, v0, bright) {
    const n = ch.nodes;
    for (let i = 0; i < n.length - 1; i++) {
      const a = n[i], b = n[i + 1];
      const steps = 3;
      for (let q = 0; q < steps; q++) {
        const s = (i + q / steps) / (n.length - 1);
        put(body, a.x + (b.x - a.x) * q / steps, a.y + (b.y - a.y) * q / steps, bright(s) * v0);
      }
    }
  }

  function draw(st) {
    body.fill(0); glow.fill(0); aura.fill(0);
    const { t, cx, cy, b, lean } = st;

    // frilled oral arms (moon-jelly style): each is a folded curtain, not a flat ribbon.
    //  - the body of the curtain is a soft band across the arm, its width breathing along the length
    //  - the two edges are rolled frills: brighter, wavy, and they wander in and out
    //  - a few folds run lengthwise inside and slowly twist, so the mass reads as layered
    //  - a loose lobe peels off each arm and crosses its neighbours, giving the tangled look
    for (const ar of arms) {
      const n = ar.nodes;
      for (let i = 0; i < n.length - 1; i++) {
        const a = n[i], bb = n[i + 1];
        let tx = bb.x - a.x, ty = bb.y - a.y;
        const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
        const nx = -ty, ny = tx;                                         // across the arm
        for (let q = 0; q < 5; q++) {
          const s = (i + q / 5) / (n.length - 1);
          // each arm curls in a slow travelling S-wave, out of step with its neighbours so they cross
          const curl = (2.6 * Math.sin(s * 6.5 - t * 0.9 + ar.k * 1.9) + 1.2 * Math.sin(s * 13 - t * 1.3 + ar.k)) * Math.min(1, s * 3);
          const x = a.x + (bb.x - a.x) * q / 5 + nx * curl, y = a.y + (bb.y - a.y) * q / 5 + ny * curl;
          const taper = 1 - 0.55 * s;
          const fade = 0.75 * (1 - 0.55 * s);
          const w = 2.3 * taper * (0.7 + 0.35 * Math.sin(s * 7 - t * 0.7 + ar.k * 1.7));
          // curtain body
          for (let d = -w; d <= w; d += 0.6) {
            const fold = 0.5 + 0.5 * Math.sin(d * 2.2 + s * 9 - t * 0.5 + ar.k);   // lengthwise folds
            if (fold > 0.35) put(body, x + nx * d, y + ny * d, fade * (0.12 + 0.36 * fold));   // gaps between folds
          }
          // rolled, wavy edges on both sides
          for (const side of [-1, 1]) {
            const e = w * (1.05 + 0.3 * Math.sin(s * 22 - t * 1.1 + side * 1.3 + ar.k * 2));
            const ex = x + nx * e * side, ey = y + ny * e * side;
            put(body, ex, ey, fade * 0.95);
            put(body, ex + nx * 0.5 * side, ey + ny * 0.5 * side, fade * 0.6);
          }
          // a loose lobe that drifts off to one side and back, crossing its neighbours
          if (s > 0.12) {
            const off = (3.5 + 3 * Math.sin(s * 4 - t * 0.45 + ar.k * 2.3)) * (ar.k % 2 ? 1 : -1) * Math.min(1, (s - 0.12) * 4);
            const lw = 1.2 * taper;
            for (let d = -lw; d <= lw; d += 0.5) put(body, x + nx * (off + d), y + ny * (off + d), fade * (0.55 - 0.2 * Math.abs(d) / (lw + 0.1)));
          }
        }
      }
    }

    // ── bioluminescence on the ribs ──
    // Between strokes the ribs glow dimly and "breathe" out of sync with each other.
    // Each stroke fires a bright wave of light that runs from the apex down to the rim,
    // slightly staggered rib to rib so it chases around the bell, leaving a fading tail.
    const uCyc = ((st.phase % 1) + 1) % 1;
    const W0 = 0.02, WD = 0.55;                                  // when the light wave runs (fraction of cycle)
    const wq = (uCyc - W0) / WD;
    const flashEnv = wq > 0 && wq < 1 ? Math.sin(Math.PI * wq) : 0;
    function ribLight(h, r) {
      const breath = 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.1 + r * 0.8));
      if (!(wq > -0.1 && wq < 1.2)) return breath;
      const pos = 1.05 - (wq - r * 0.025) * 1.2;                // wave front height, apex → rim
      const dh = h - pos;
      const band = Math.exp(-(dh * dh) / 0.012);
      const tail = dh > 0 ? 0.45 * Math.exp(-dh / 0.22) : 0;     // afterglow above the front
      return Math.min(1.25, breath + CONFIG.lightPulse * (band * 1.05 + tail) * (0.35 + 0.65 * flashEnv));
    }
    glowEl.style.setProperty('--ga', (0.45 + 0.55 * flashEnv * CONFIG.lightPulse).toFixed(3));

    // bell
    const top = Math.max(0, Math.floor(cy - b - 2)), bot = Math.min(LH - 1, Math.ceil(cy + 5));
    const N = CONFIG.ribs, spin = t * CONFIG.spin;
    for (let j = top; j <= bot; j++) {
      const py = j + 0.5, dy = py - cy;
      const h = -dy / b;
      const shift = lean * Math.max(0, h) * Math.max(0, h);    // apex leans, rim stays put
      for (let i = 0; i < LW; i++) {
        const dx = (i + 0.5) * A - cx - shift;
        const k = j * LW + i;

        if (dy > 0) {                                          // margin / velum: whips like a skirt
          const cm = st.cRim;
          const tuck = Math.max(0, cm), flare = Math.max(0, -cm);
          // the skirt is a short cone: angled inward on the squeeze, kicked outward on the rebound
          const R0 = st.rimR * (1.02 + (0.16 * flare - 0.11 * tuck) * dy);
          const lip = 0.9 + 1.6 * tuck + 1.1 * flare + 0.5 * Math.sin(dx * 1.7 + t * 1.1);
          const inner = st.rimR * (0.72 + 0.1 * flare);           // hollow underside, so it reads as a lip
          const ax = Math.abs(dx);
          if (ax < R0 && ax > inner * (1 - dy * 0.05) && dy < lip) {
            body[k] = Math.max(body[k], 0.42 + 0.33 * ax / R0);
          }
          continue;
        }
        if (h > 1) continue;
        const R = st.R(h);
        if (Math.abs(dx) >= R) continue;
        const u = dx / R, z = Math.sqrt(1 - u * u);

        const ch = st.cAt(h);
        let v = 0.1 + 0.6 * Math.pow(1 - z, 1.6) + 0.3 * Math.pow(h, 2.5) * z
              + 0.04 * Math.sin(dx * 0.8 + dy * 0.7 + t * 2.4)
              + 0.16 * Math.max(0, ch) * Math.max(0, Math.sin(h * 11 - t * 2.5));  // muscle bands flex on the stroke

        let g = 0;
        for (let r = 0; r < N; r++) {
          const phi = (r / N) * Math.PI * 2 + spin;
          const front = Math.cos(phi);
          const d = Math.abs(dx - R * Math.sin(phi));
          if (front > 0) {
            const width = 0.42 + 0.4 * front;
            if (d < width && h < 0.94) {
              const dots = 0.7 + 0.3 * Math.sin(j * 1.9 + r * 1.3 - t * 1.2);
              g = Math.max(g, (0.45 + 0.55 * front) * dots * (1 - d / width * 0.5) * ribLight(h, r));
            }
          } else if (d < 0.35) {
            v += 0.12;
          }
        }
        const core = Math.exp(-((dx / (A0 * 0.35)) ** 2 + ((h - 0.35) / 0.22) ** 2));
        const coreW = Math.exp(-((dx / (A0 * 0.32)) ** 2 + ((h - 0.42) / 0.3) ** 2)) * (0.75 + 0.25 * Math.max(0, ch));
        if (coreW > aura[k]) aura[k] = coreW;
        g = Math.max(g, (0.22 + 0.16 * Math.max(0, ch)) * core);           // inner light brightens on each stroke

        if (v > body[k]) body[k] = v;
        if (g > glow[k]) glow[k] = g;
      }
    }

    {
      const ry0 = Math.max(0, Math.floor(cy - b * 1.9)), ry1 = Math.min(LH - 1, Math.ceil(cy + b * 0.7));
      const hx = A0 * 1.2, hy = b * 0.85, ccy = cy - b * 0.45, amp = 0.26 + 0.2 * flashEnv;
      for (let j = ry0; j <= ry1; j++) {
        const dy2 = ((j + 0.5 - ccy) / hy) ** 2;
        for (let i = 0; i < LW; i++) {
          const d2 = (((i + 0.5) * A - cx) / hx) ** 2 + dy2;
          if (d2 > 2.2) continue;
          const v = amp * Math.exp(-d2 * 2.4);
          const k = j * LW + i;
          if (v > aura[k]) aura[k] = v;
        }
      }
    }

    // motes shed into the wake
    for (const m of motes) {
      m.y += (0.04 + speed * 0.05) * m.s * CONFIG.timeScale; m.x += 0.02 * Math.sin(t + m.p) * CONFIG.timeScale;
      if (m.y > cy + b * 2.2) { m.y = cy - 2; m.x = cx + (rand() - 0.5) * A0 * 1.6; }
      const life = Math.max(0, 1 - (m.y - cy) / (b * 2.2));
      put(glow, m.x, m.y, 0.3 * life * (0.6 + 0.4 * Math.sin(t * 3 * m.s + m.p)));
    }
  }

  // ── drifting ASCII streaks (screen space), blowing opposite the heading ──
  const scr = new Float32Array(W * H);
  const scrGold = new Uint8Array(W * H);
  const windX = -sin, windY = cos;
  const streaks = Array.from({ length: CONFIG.streaks }, () => ({
    x: rand() * PW, y: rand() * H, s: 0.5 + rand() * 1.2, p: rand() * 6.28, len: 2 + Math.floor(rand() * 4),
    gold: rand() < CONFIG.goldStreaks,
  }));
  function drawStreaks(t) {
    scr.fill(0); scrGold.fill(0);
    for (const k of streaks) {
      const v = (0.05 + 0.035 * k.s + speed * 0.04) * CONFIG.timeScale;              // they rush past a bit faster on each stroke
      k.x += windX * v; k.y += windY * v;
      if (k.y > H + 2 || k.x < -2) {                            // respawn along the top / right edges
        if (rand() < 0.55) { k.x = rand() * PW * 1.1; k.y = -1; } else { k.x = PW + 1; k.y = rand() * H; }
      }
      const tw = 0.55 + 0.45 * Math.sin(t * 2 * k.s + k.p);
      for (let q = 0; q < k.len; q++) {
        const i = Math.round((k.x - windX * q * 0.9) / A - 0.5), j = Math.round(k.y - windY * q * 0.9 - 0.5);
        if (i >= 0 && i < W && j >= 0 && j < H) {
          const val = (0.12 + 0.2 * tw) * (1 - q / k.len);
          if (val > scr[j * W + i]) { scr[j * W + i] = val; scrGold[j * W + i] = goldEl && k.gold ? 1 : 0; }
        }
      }
    }
  }

  function frame(t) {
    // the reference camera does not hold the animal perfectly still: it wanders slowly in the frame
    // (about ±5% of the height, only ±2% across, measured from the clip), on a roughly 8 s cycle
    const camX = 0.5 * Math.sin(t * 0.55 + 1.1), camY = 2 * Math.sin(t * 0.95 + 0.4);
    const st = simulate(t);
    draw(st);
    // like the filming camera, the view follows the bell (most of its sway and surge is taken out)
    const fx = LX + 0.85 * (st.cx - LX), fy = PLY + 0.85 * (st.cy - (LY - 10)) + 0.3 * (st.b - B0);
    drawStreaks(t);
    // the text layers are only rebuilt while they're the visible style (a canvas style hides them),
    // and always for the first frame so the box is never empty
    const text = window.JELLY_TEXT !== false || !bodyEl.firstChild;
    let bs = '', gs = '', ys = '';
    if (text) for (let j = 0; j < H; j++) {
      const ry = j + 0.5 - (OY + camY);
      for (let i = 0; i < W; i++) {
        const rx = (i + 0.5) * A - (OX + camX);
        const li = Math.floor((fx + rx * cos + ry * sin) / A);
        const lj = Math.floor(fy - rx * sin + ry * cos);
        let bv = 0, gv = 0;
        if (li >= 0 && li < LW && lj >= 0 && lj < LH) { bv = body[lj * LW + li]; gv = glow[lj * LW + li]; }
        let gold = false;
        if (bv < 0.05 && gv <= 0.12) {                          // streaks pass behind the jelly
          bv = scr[j * W + i];
          gold = scrGold[j * W + i] === 1 && bv > 0;
        }
        const bch = BR[Math.max(0, Math.min(BR.length - 1, Math.floor(bv * (BR.length - 1) + 0.25)))];
        if (gv > 0.12) {
          gs += GR[Math.min(GR.length - 1, 1 + Math.floor(gv * (GR.length - 1.01)))];
          bs += ' '; ys += ' ';
        } else if (gold) {
          ys += bch; bs += ' '; gs += ' ';
        } else {
          bs += bch; gs += ' '; ys += ' ';
        }
      }
      if (j < H - 1) { bs += '\n'; gs += '\n'; ys += '\n'; }
    }
    if (window.JELLY_TAP) {
      // hand other renderers a sampler in output space (x in units of PW, y in rows), with the same camera
      const at = (fld, i, j) => (i >= 0 && i < LW && j >= 0 && j < LH) ? fld[j * LW + i] : 0;
      const bil = (fld, u, v) => { const i = Math.floor(u - 0.5), j = Math.floor(v - 0.5), a = u - 0.5 - i, c = v - 0.5 - j;
        return (at(fld, i, j) * (1 - a) + at(fld, i + 1, j) * a) * (1 - c) + (at(fld, i, j + 1) * (1 - a) + at(fld, i + 1, j + 1) * a) * c; };
      const sample = (x, y) => {
        const rx = x - (OX + camX), ry = y - (OY + camY);
        const u = (fx + rx * cos + ry * sin) / A, v = fy - rx * sin + ry * cos;
        const si = Math.floor(x / A), sj = Math.floor(y);
        return [bil(body, u, v), bil(glow, u, v), (si >= 0 && si < W && sj >= 0 && sj < H) ? scr[sj * W + si] : 0, bil(aura, u, v)];
      };
      window.JELLY_TAP(sample, { PW, H, t, flash: +glowEl.style.getPropertyValue("--ga") || 0.5 });
    }
    if (!text) return;
    bodyEl.textContent = bs;
    glowEl.textContent = gs;
    if (goldEl) goldEl.textContent = ys;
  }

  // settle the chains before the first visible frame
  for (let i = 0; i < 90; i++) simulate(i / 30);
  const tOffset = 3;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, last = 0;
  const start = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || (CONFIG.fps < 60 && now - last < 1000 / CONFIG.fps)) return;   // 60 = draw on every screen refresh (even pacing)
    last = now;
    frame(tOffset + ((now - start) / 1000) * CONFIG.timeScale);   // slow-motion applies to everything
  }

  frame(tOffset);
  if (!reduce.matches) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(bodyEl);
    requestAnimationFrame(loop);
  }
})();
