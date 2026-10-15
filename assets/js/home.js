// =========================================================================
// Angel Studio — home.js (the home page only; core.js loads first)
// =========================================================================
//
// DEVELOPER NOTES
// ---------------
// The home page doesn't really scroll: the page stays still ("the stage")
// and scrolling plays a timeline. Each scene (hero → work → contact) flows
// in and blows away on the liquid wind from core.js.
//
//   1. SETTINGS ......... timeline, big logo, menu jumps, clock
//   2. PIECES ........... the clock, the scenes' text, divider lines, arrows
//   3. THE BIG LOGO ..... scroll, hover, resting motion, water drop, intro
//   4. TIMELINE ......... what each scroll position looks like
//   5. SCROLL + MENU .... smooth scroll feel, menu jumps
//   6. HOVER EXTRAS ..... work-list arrows, bending divider lines
//   7. START-UP ......... hooking into core.js, the intro, the clock
//
// Shared settings (WIND, HOVER, PATTERN, RIPPLE, COLOR…) are in core.js.
// =========================================================================

// =========================================================================
// 1. SETTINGS
// =========================================================================

// When each step happens, in screen-heights of scrolling ([start, end]).
// Bigger gaps = slower. Menu jumps land at the end of workIn / contactIn.
const TIMELINE = {
  logoOut:    [0.0, 1.0],  // big logo + name blow away
  heroTexts:  [0.8, 1.4],  // corner texts blow away...
  background: [0.9, 1.6],  // ...while the cream sweeps in
  headerIn:   [1.4, 1.75], // small top-left logo flows in (shorter = tighter)
  workIn:     [1.5, 2.2],  // work section flows in
  workOut:    [3.0, 3.5],  // (after a pause to look at it) work blows away
  contactIn:  [3.5, 4.1],  // contact section flows in
  end:        4.4,         // total scroll length
};

// The small top-left logo arriving. Lower numbers = tighter, more together.
const HEADER = {
  spread: 0.3,     // how quickly the burn front crosses it (WIND.spread is used for everything else)
  drift: 0.45,     // how far it flows in from, compared with other text (1 = same)
};

// The big logo's resting motion: each drop gently sways like it's in a breeze
const FLOW = {
  sway: 5,         // how far each drop moves (logo units; the mark is 200 wide)
  tilt: 5,         // how much each drop rocks (degrees)
  breathe: 0.025,  // how much each drop swells and shrinks (0.025 = 2.5%)
  speed: 1,        // overall tempo (bigger = faster)
  // Liquid feel: drops stretch in the direction they're moving, squeeze
  // a little sideways, and their shape slowly wobbles
  stretch: 0.07,   // stretch when moving fastest (0.07 = 7% longer)
  wobble: 0.025,   // slow wobble of the shape (0.025 = 2.5%)
  // A soft blur on the side each drop is moving toward, so it blurs in and out
  trailBlur: 1.6,  // softness of that blur (logo units)
  trailReach: 0.9, // how far ahead of the drop it reaches when moving fastest (logo units)
  trailStrength: 0.5, // how visible it is (0 to 1)
};

// The big logo's water-drop effect. Clicking the logo (or name) drops water
// where you clicked: a ring spreads through the logo and each piece it reaches
// is pushed outward, wobbles, blurs and dissolves; then the page glides to the
// work list. The same effect plays in reverse when the page first loads (the
// logo forms out of the water), then the menu and the other text flow in.
const DRIP = {
  speed: 380,      // how fast the ring travels through the logo (px per second)
  band: 160,       // how wide the ring is: bigger = each piece takes longer to go (px)
  push: 28,        // how far pieces get pushed outward (px)
  wobble: 7,       // how much they wobble on the ring (px)
  blur: 12,        // blur on pieces as they dissolve (px)
  swell: 0.12,     // how much they grow as they dissolve (0.12 = 12%)
  introDelay: 350, // wait after the page loads before the drop falls (ms)
  textDelay: 150,  // after the logo has formed, wait this long before the rest flows in (ms)
  textTime: 1200,  // how long the menu and other text take to flow in (ms)
};

// Menu jumps (Work / Contact / Scroll / logo / Back to top)
const NAV = {
  msPerScreen: 600, // travel time per screen-height of scrolling. Bigger = slower
  min: 1100,        // shortest jump (ms)
  max: 2600,        // longest jump (ms), e.g. from Contact back to the top
};

// The corner clock shows YOUR time, not the visitor's. Set your city's time
// zone, e.g. 'America/New_York', 'Europe/Madrid'. null = visitor's own time.
const TIME_ZONE = null;

// =========================================================================
// 2. PIECES — finding everything on the home page that moves
// =========================================================================

// The clock is set before splitting, so its real digits get split into letters
const timeEl = document.getElementById('local-time');
function updateTime() {
  const text = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(TIME_ZONE && { timeZone: TIME_ZONE }),
  });
  // Once split, just swap each letter's text so the animated pieces stay in place
  const chars = timeEl.querySelectorAll('.char');
  if (chars.length === text.length) {
    chars.forEach((c, n) => { c.textContent = text[n]; });
    const sr = timeEl.querySelector('.sr-only');   // and what screen readers read
    if (sr) sr.textContent = text;
  } else timeEl.textContent = text;
}
updateTime();

const heroScene = document.querySelector('.scene--hero');
const workScene = document.querySelector('.scene--work');
const contactScene = document.querySelector('.scene--contact');
const heroLogo = document.querySelector('.hero__logo');
heroLogo.querySelectorAll('.wordmark').forEach(splitLetters);  // (the small logo's name is split by core.js)

const scenePieces = windPieces;  // (core.js)

const heroLogoPieces = logoPieces(heroLogo, { tilt: 60, blur: 8 });
const heroTextPieces = scenePieces(heroScene);
const workPieces = scenePieces(workScene);
const contactPieces = scenePieces(contactScene);

// The divider lines in the work list: each one is a single continuous line
// (an SVG path) with bend points along it. When you hover, the points near
// the mouse are pushed away from it, so the line bends smoothly around the
// mouse like a string, then slowly springs back. On scroll the points are
// carried by the same liquid wind as the text. Drawn by renderLine (section 6).
const LINE = {
  points: 48,      // bend points per line (more = smoother curve)
  push: 16,        // how far the line bends away from the mouse (px)
  reach: 140,      // how far along the line the bend spreads (px)
  room: 30,        // space above and below the line for bending (px)
};
const svgNS = 'http://www.w3.org/2000/svg';
const lines = [...document.querySelectorAll('.section-head, .work-item')].map((host) => {
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'line');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svgNS, 'path');
  svg.append(path);
  host.append(svg);
  return {
    host, svg, path,
    x: 0, y: 0, w: 0,                                   // where it sits on screen (set by measureLines)
    pts: Array.from({ length: LINE.points }, () => ({
      hy: 0,           // hover bend (px), eases toward its target
      wx: 0, wy: 0,    // wind offset from the scroll (px)
    })),
    moving: false, last: '',
  };
});

// Work list arrows: flow in on the wind when you hover a row, flow out when you leave
const arrowPieces = [...document.querySelectorAll('.work-item__arrow')].map((el) => {
  const pc = makePiece(el, { tilt: 20, blur: 5 });
  pc.show = 0;         // 0 = hidden, 1 = shown (eases toward showTarget)
  pc.showTarget = 0;
  pc.scrollAmt = 1;    // where the work section's scroll animation has it
  pc.scrollIn = true;
  return pc;
});

// Small text (labels, footer) reacts gently like the menu; the email gets a lighter blur (core.js)
tuneSmallText([...heroTextPieces, ...workPieces, ...contactPieces]);

// The big work titles: normal hover movement, lighter blur
workPieces.filter((pc) => pc.el.closest('.work-item__title')).forEach((pc) => { pc.blurDamp = HOVER.titleBlur; });

// Everything (besides the big logo, which has its own loop) that reacts to hover
// (the small logo and the menu were added by core.js)
Site.hoverPieces.push(...heroTextPieces, ...workPieces, ...contactPieces, ...arrowPieces);

// =========================================================================
// 3. THE BIG LOGO — scroll, hover, resting motion, water drop, intro
// =========================================================================
// The big logo + name have their own loop because the drops never stop
// moving gently while the logo is on screen. The loop stops once the logo
// has blown away and restarts when you scroll back. This section also holds
// the water-drop effects: clicking the logo, and the intro on page load.

const hero = {
  time: 0,          // clock for the resting motion (s)
  progress: 0,      // how far the scroll has blown the logo away (0–1)
  running: false,   // is the loop on?
  last: 0,
  drip: null,       // a water-drop effect playing on the logo: { mode: 'in' | 'out', x, y, start, reach, … }
  lastProgress: -1, // scroll progress last frame (to notice when nothing changes)
  skip: false,      // skipped drawing this frame (calm: 30 fps)
};

// ---- Water drop on the logo ----
// Where the drop is for one piece: 0 = untouched, 1 = fully dissolved, plus
// how far it's pushed / how blurred / how big. 'out' dissolves the logo,
// 'in' forms it (the same thing played backwards).
const dripLook = { amount: 0, x: 0, y: 0, blur: 0, size: 1 };
function dripAt(pc, now) {
  const d = hero.drip;
  return waterLook(pc, d.x, d.y, (now - d.start) / 1000, d.mode, DRIP, 1, dripLook);
}

// Start a drop on the logo at (x, y) on screen
function startDrip(mode, x, y, start = performance.now()) {
  // How far the ring has to travel to cross the whole logo
  const reach = Math.max(...heroLogoPieces.map((pc) => Math.hypot(pc.cx - x, pc.cy - y))) + DRIP.band;
  hero.drip = { mode, x, y, start, reach, done: false };
  background.addDrop(x, y, start);  // the background ripples from the same spot
  wakeHero();
}

// Called every frame by the logo's loop: what happens when a drop finishes
function checkDrip(now) {
  const d = hero.drip;
  if (!d || now < d.start + (d.reach / DRIP.speed) * 1000) return;  // still playing
  if (d.mode === 'in') {
    hero.drip = null;                 // logo has formed
    if (d.intro) startIntroText(now);  // now the menu and other text flow in
    return;
  }
  // 'out': the logo has dissolved
  if (!d.done) {
    d.done = true;
    goTo('#work', true);              // glide to the work list
  } else if (hero.progress >= 1) {
    hero.drip = null;                 // arrived: scrolling back up brings the logo back on the wind
  } else if (!glide) {
    // The glide was stopped before the logo scrolled away: let it form again
    startDrip('in', d.x, d.y, now);
  }
}

// ---- Drop trails: a soft blur on the side each drop is moving toward ----
// Each drop gets a tiny SVG filter: a blurred, shifted, faint copy of itself
// behind the sharp drop. Only the shift and softness change each frame.
const dropDefs = document.querySelector('svg defs');
heroLogoPieces.filter((pc) => pc.isDrop).forEach((pc, k) => {
  const use = pc.el.querySelector('use');
  if (!use || !dropDefs) return;
  // The drop shape is rotated inside its group; remember by how much, so the
  // shift can be turned into the drop's own direction
  const m = /rotate\(([-\d.]+)\)/.exec(use.getAttribute('transform') || '');
  pc.useAngle = m ? (parseFloat(m[1]) * Math.PI) / 180 : 0;

  const filter = document.createElementNS(svgNS, 'filter');
  filter.id = `drop-trail-${k}`;
  ['x', 'y'].forEach((a) => filter.setAttribute(a, '-40%'));
  ['width', 'height'].forEach((a) => filter.setAttribute(a, '180%'));
  filter.innerHTML = `
    <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="soft"/>
    <feOffset in="soft" dx="0" dy="0" result="ahead"/>
    <feComponentTransfer in="ahead" result="faint"><feFuncA type="linear" slope="${FLOW.trailStrength}"/></feComponentTransfer>
    <feMerge><feMergeNode in="faint"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  dropDefs.append(filter);
  use.setAttribute('filter', `url(#${filter.id})`);
  pc.trail = {
    id: filter.id,
    blur: filter.querySelector('feGaussianBlur'),
    offset: filter.querySelector('feOffset'),
    last: '',
  };
});

function updateDropTrail(pc, vx, vy, speed) {
  if (!pc.trail || perf.lite) return;
  // Turn the movement into the drop shape's own (rotated) direction
  const c = Math.cos(-pc.useAngle), sn = Math.sin(-pc.useAngle);
  const k = FLOW.trailReach / (FLOW.sway * 0.7);
  const dx = (vx * c - vy * sn) * k;
  const dy = (vx * sn + vy * c) * k;
  const sd = FLOW.trailBlur * (0.4 + 0.6 * clamp01(speed));
  const key = `${dx.toFixed(2)} ${dy.toFixed(2)} ${sd.toFixed(2)}`;
  if (key === pc.trail.last) return;  // only touch the filter when it changes
  pc.trail.last = key;
  pc.trail.offset.setAttribute('dx', dx.toFixed(2));
  pc.trail.offset.setAttribute('dy', dy.toFixed(2));
  pc.trail.blur.setAttribute('stdDeviation', sd.toFixed(2));
}

function renderHeroLogo() {
  const pScroll = hero.progress;
  const live = 1 - pScroll;  // hover and flow fade out as the logo blows away
  const t = hero.time * FLOW.speed;

  const now = performance.now();

  heroLogoPieces.forEach((pc) => {
    const wind = pieceProgress(pScroll, pc.order);  // scroll: 0 = in place, 1 = gone
    const s = pc.scale;

    // A water drop (click or page load) wins over the scroll when it hides more
    const drip = hero.drip ? dripAt(pc, now) : null;
    const useDrip = drip && drip.amount >= wind;
    const a = useDrip ? drip.amount : wind;        // how gone this piece is

    updateHover(pc, 1 - a);  // hover scatter (same as all other text)

    // Scroll (liquid wind) or water drop, + hover offset
    const off = reduceMotion ? STILL : windOffset(pc, useDrip ? 0 : wind, WIND.logoDrift, false);
    let x = pc.ox + (useDrip && !reduceMotion ? drip.x : 0);
    let y = pc.oy + (useDrip && !reduceMotion ? drip.y : 0);
    let rot = reduceMotion ? 0 : pc.h * HOVER.tilt * Math.sign(pc.rot || 1);
    let size = useDrip && !reduceMotion ? drip.size : 1;

    // Resting motion: only the three drops, each on its own rhythm
    let liquid = '';
    if (pc.isDrop && !reduceMotion) {
      const ph = pc.i * 2.1;     // each drop's own phase
      const f = live * (1 - a);  // fades out as the logo blows away
      const A = FLOW.sway;
      // Position (logo units) and how fast it's changing (its velocity)
      const fx = A * (Math.sin(t * 0.55 + ph) + 0.5 * Math.sin(t * 0.23 + ph * 1.7));
      const fy = A * 0.8 * Math.cos(t * 0.45 + ph);
      const vx = A * (0.55 * Math.cos(t * 0.55 + ph) + 0.115 * Math.cos(t * 0.23 + ph * 1.7));
      const vy = -A * 0.36 * Math.sin(t * 0.45 + ph);
      const speed = Math.hypot(vx, vy) / (A * 0.7);  // about 0 (still) to 1 (fastest)

      x += s * f * fx;
      y += s * f * fy;
      rot += f * FLOW.tilt * Math.sin(t * 0.4 + ph);
      size += f * FLOW.breathe * Math.sin(t * 0.7 + ph);

      // Liquid: stretch along the direction of travel, squeeze across it, slow wobble
      const dir = (Math.atan2(vy, vx) * 180) / Math.PI;
      const wob = FLOW.wobble * Math.sin(t * 1.1 + ph * 1.3);
      const sx = 1 + f * (FLOW.stretch * speed + wob);
      const sy = 1 - f * (FLOW.stretch * 0.6 * speed + wob);
      liquid = ` rotate(${round2(dir - rot)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) rotate(${round2(rot - dir)}deg)`;

      updateDropTrail(pc, vx * f, vy * f, speed * f);  // soft blur on the side it's moving toward
    }

    const transform = windTransform(pc, off, x, y, rot, size, liquid);
    const goneBlur = useDrip ? drip.blur : a * pc.blur;
    const blur = reduceMotion ? 0 : (goneBlur + pc.h * HOVER.blur) / s;
    applyStyle(pc, transform, a >= 1 ? '' : blurStyle(blur), String(round2((1 - a) * (1 - pc.h * HOVER.fade))));
  });
}

function heroFrame(now) {
  frameTick(now);
  hero.time += Math.min(now - hero.last, 50) / 1000;
  hero.last = now;
  // When nothing is happening but the slow resting motion, drawing every
  // other frame (30 fps) looks the same and saves battery
  const calm = !hero.drip && !pointer.active && hero.progress === hero.lastProgress &&
    heroLogoPieces.every((pc) => pc.h === 0 && pc.ox === 0 && pc.oy === 0);
  hero.lastProgress = hero.progress;
  hero.skip = calm && !hero.skip;
  if (!hero.skip) renderHeroLogo();
  checkDrip(now);
  if (hero.progress < 1 || hero.drip) requestAnimationFrame(heroFrame);
  else hero.running = false;  // logo has blown away: nothing to animate
}

// ---- Clicking the logo: it dissolves like a drop fell on it, then the page goes to the work list ----
function dripLogo(x, y) {
  if (reduceMotion) { goTo('#work', false); return; }
  if (hero.drip || hero.progress > 0.05) return;  // already playing, or already scrolling away
  startDrip('out', x, y);
}
heroLogo.addEventListener('click', (e) => dripLogo(e.clientX, e.clientY));
heroLogo.addEventListener('keydown', (e) => {   // keyboard: Enter or Space on the focused logo
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  const r = heroLogo.getBoundingClientRect();
  dripLogo(r.left + r.width / 2, r.top + r.height / 2);
});

// ---- Page load: the logo forms out of a drop, then the rest flows in ----
// The menu and the home-screen text start hidden (their "click" layer is set
// to fully gone) and flow in on the wind once the logo has formed.
const introPieces = () => [...navPieces, ...heroTextPieces];

function startIntro() {
  introPieces().forEach((pc) => { pc.click = 1; pc.clickIn = true; pc.clickWater = null; renderPiece(pc); });
  // The drop falls on the middle of the mark (the three drops)
  const mark = heroLogo.querySelector('.mark').getBoundingClientRect();
  startDrip('in', mark.left + mark.width / 2, mark.top + mark.height / 2, performance.now() + DRIP.introDelay);
  hero.drip.intro = true;
}

function startIntroText(now, pieces = introPieces()) {
  const start = now + DRIP.textDelay;
  const step = (t) => {
    const p = clamp01((t - start) / DRIP.textTime);
    pieces.forEach((pc) => {
      if (pc.inLink) return;  // clicked while flowing in: the link's water drop has taken over
      pc.click = 1 - pieceProgress(p, pc.order);  // flows in from the bottom right, left end first
      pc.clickIn = true;
      pc.clickWater = null;
      renderPiece(pc);
    });
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function wakeHero() {
  if (reduceMotion) { renderHeroLogo(); return; }
  if (hero.running) return;
  hero.running = true;
  hero.last = performance.now();
  requestAnimationFrame(heroFrame);
}

// =========================================================================
// 4. TIMELINE — what each scroll position looks like
// =========================================================================

// Show/hide a scene and set its --reveal (0–1). CSS uses --reveal to fade
// the divider lines and the glass blur behind text along with the scene.
// A scene that's away is hidden completely (visibility: hidden): this halves
// the work while scrolling. Keyboard and screen-reader users reach the other
// scenes through the menu, and each jump moves the focus there (focusScene).
function setScene(scene, visible, reveal) {
  const visibility = visible ? '' : 'hidden';
  const r = reveal.toFixed(3);
  if (scene.lastVisibility !== visibility) {
    scene.style.visibility = visibility;
    scene.lastVisibility = visibility;
    if (glassReady) updateGlass();  // a scene appeared or disappeared: its glass too
  }
  if (scene.lastReveal !== r) { scene.style.setProperty('--reveal', r); scene.lastReveal = r; }
}

// A group of pieces only needs redrawing when its progress changed.
// (Most groups sit at 0 or 1 most of the time, so this skips a lot of work.)
const lastProgress = new Map();
function progressChanged(key, ...values) {
  const sig = values.join('|');
  if (lastProgress.get(key) === sig) return false;
  lastProgress.set(key, sig);
  return true;
}

function update(y) {
  const p = y / screenH;  // scroll position in screen-heights
  const T = TIMELINE;
  const pLogo = segment(p, T.logoOut);
  const pTexts = segment(p, T.heroTexts);
  const pBg = segment(p, T.background);
  const pHeader = segment(p, T.headerIn);
  const pWorkIn = segment(p, T.workIn);
  const pWorkOut = segment(p, T.workOut);
  const pContact = segment(p, T.contactIn);

  // Scene 1: the big logo (drawn by its own loop, section 8), then the corner texts
  if (progressChanged('logo', pLogo) || pLogo < 1) {
    hero.progress = pLogo;
    wakeHero();
  }
  if (progressChanged('heroTexts', pTexts)) {
    heroTextPieces.forEach((pc) => place(pc, pieceProgress(pTexts, 1 - pc.order)));
  }
  setScene(heroScene, pTexts < 1, 1 - pTexts);

  // Background sweep; the menu turns burgundy once the cream reaches it
  background.setSweep(ease(pBg));
  root.classList.toggle('is-light', pBg > 0.7);

  // Small logo flows in (left end first)
  if (progressChanged('header', pHeader)) {
    headerPieces.forEach((pc) => place(pc, 1 - pieceProgress(pHeader, pc.order, HEADER.spread), true, WIND.drift * HEADER.drift));
  }
  const scrolled = pHeader > 0.5;
  if (headerLogo.inert === scrolled) headerLogo.inert = !scrolled;  // while it's invisible, the keyboard skips it
  if (scrolled !== root.classList.contains('is-scrolled')) {
    root.classList.toggle('is-scrolled', scrolled);
    if (glassReady) updateGlass();  // the small logo's glass comes and goes with it
  }

  // Scene 2: work flows in, holds, then blows away (arrows follow the same timing)
  if (progressChanged('work', pWorkIn, pWorkOut)) {
    workPieces.forEach((pc) => {
      if (pWorkOut > 0) place(pc, pieceProgress(pWorkOut, 1 - pc.order));
      else place(pc, 1 - pieceProgress(pWorkIn, pc.order), true);
    });
    windLines(pWorkIn, pWorkOut);
    arrowPieces.forEach((pc) => {
      pc.scrollIn = pWorkOut <= 0;
      pc.scrollAmt = pc.scrollIn ? 1 - pieceProgress(pWorkIn, pc.order) : pieceProgress(pWorkOut, 1 - pc.order);
      renderArrow(pc);
    });
  }
  setScene(workScene, pWorkIn > 0 && pWorkOut < 1, Math.min(pWorkIn, 1 - pWorkOut));

  // Scene 3: contact flows in
  if (progressChanged('contact', pContact)) {
    contactPieces.forEach((pc) => place(pc, 1 - pieceProgress(pContact, pc.order), true));
  }
  setScene(contactScene, pContact > 0, pContact);
}

// =========================================================================
// 5. SCROLL + MENU — smooth scroll feel, menu jumps
// =========================================================================

// ---- Smooth scrolling feel ----
// The animation doesn't jump straight to the scroll position: each frame it
// moves a little closer ("smoothY" glides toward the real scroll position).
let smoothY = window.scrollY;
let ticking = false;

function tick(now) {
  frameTick(now);
  const target = window.scrollY;
  smoothY += (target - smoothY) * (reduceMotion ? 1 : WIND.smoothing);
  if (Math.abs(target - smoothY) < 0.5) smoothY = target;
  update(smoothY);
  if (smoothY !== target) requestAnimationFrame(tick);  // keep gliding next frame
  else ticking = false;
}

function startTick() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

// The screen height used for the timeline. Only updated on real resizes, so
// a phone's address bar showing/hiding doesn't shift the animation.
let screenH = window.innerHeight;

// ---- Keyboard ----
// Jumps move the keyboard focus to the scene you land on, so the next Tab
// continues there (the scene you left gets hidden).
function focusScene(hash) {
  const el = hash === '#top' ? heroScene : document.querySelector(hash);
  if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
}

// ---- Menu jumps ----
// Where each menu link takes you (in screen-heights)
const STOPS = { '#top': 0, '#work': TIMELINE.workIn[1], '#contact': TIMELINE.contactIn[1] };

// The browser's own smooth scroll is too quick for this page, so menu jumps
// use our own slower glide (speed set in NAV). `glide` is non-null while gliding.
let glide = null;

function stopGlide() {
  if (glide) cancelAnimationFrame(glide.frame);
  glide = null;
}

function goTo(hash, smooth) {
  const target = STOPS[hash] * screenH;
  stopGlide();
  if (!smooth || reduceMotion) {
    window.scrollTo({ top: target, behavior: 'instant' });
    return;
  }
  const start = window.scrollY;
  const screens = Math.abs(target - start) / screenH;
  const duration = Math.min(NAV.max, Math.max(NAV.min, screens * NAV.msPerScreen));
  const t0 = performance.now();
  glide = {};
  const step = (now) => {
    const t = clamp01((now - t0) / duration);
    window.scrollTo({ top: start + (target - start) * easeInOut(t), behavior: 'instant' });
    if (t < 1 && glide) glide.frame = requestAnimationFrame(step);
    else if (glide) {
      glide = null;
      requestAnimationFrame(() => focusScene(hash));  // arrived (and shown): keyboard users continue from here
    }
  };
  glide.frame = requestAnimationFrame(step);
}

// If you scroll yourself during a menu jump, the jump stops and you take over
['wheel', 'touchstart', 'keydown'].forEach((type) =>
  window.addEventListener(type, stopGlide, { passive: true }));

// Address changed to #work / #contact without reloading: jump there too
window.addEventListener('hashchange', () => {
  if (!(location.hash in STOPS)) return;
  goTo(location.hash, true);
  history.replaceState(null, '', location.pathname + location.search);
});

// =========================================================================
// 6. HOVER EXTRAS — work-list arrows, bending divider lines
// =========================================================================

// ---- Work list arrows ----
// An arrow is hidden by the scroll (work section not in yet) or by not being
// hovered: whichever hides it more wins.
function renderArrow(pc) {
  const hide = 1 - ease(pc.show);
  if (pc.scrollAmt >= hide) place(pc, pc.scrollAmt, pc.scrollIn, WIND.drift * 0.5);
  else place(pc, hide, pc.showTarget > pc.show, WIND.drift * 0.5);  // appearing: flows in; leaving: blows away
}

arrowPieces.forEach((pc) => {
  const item = pc.el.closest('.work-item');
  const show = (on) => () => { pc.showTarget = on; wakeHover(); };
  item.addEventListener('pointerenter', show(1));
  item.addEventListener('pointerleave', show(0));
  item.addEventListener('focus', show(1));   // keyboard users get the arrow too
  item.addEventListener('blur', show(0));
});

// ---- Divider lines: one bending line each ----

function measureLines() {
  lines.forEach((ln) => {
    const r = ln.host.getBoundingClientRect();
    ln.x = r.left;
    ln.y = r.bottom - 0.5;  // where the old 1px border was
    ln.w = r.width;
    ln.svg.setAttribute('viewBox', `0 ${-LINE.room} ${Math.max(1, ln.w)} ${LINE.room * 2}`);
    ln.last = '';
  });
}

// Draw a line through its bend points (only touches the page when it changed)
function renderLine(ln) {
  const n = ln.pts.length - 1;
  let d = '';
  ln.pts.forEach((pt, k) => {
    const x = (ln.w * k) / n + pt.wx;
    const y = pt.hy + pt.wy;
    d += `${k ? 'L' : 'M'}${round2(x)} ${round2(y)}`;
  });
  if (d !== ln.last) { ln.path.setAttribute('d', d); ln.last = d; }
}

// Scroll: carry each bend point with the wind, like the letters (called by the timeline)
function windLines(pIn, pOut) {
  lines.forEach((ln) => {
    const n = ln.pts.length - 1;
    ln.pts.forEach((pt, k) => {
      const fake = { cx: ln.x + (ln.w * k) / n, cy: ln.y };  // this point's spot on screen
      const order = (fake.cx / window.innerWidth) * 0.75 + (fake.cy / window.innerHeight) * 0.25;
      const amount = pOut > 0 ? pieceProgress(pOut, 1 - order) : 1 - pieceProgress(pIn, order);
      const off = reduceMotion ? STILL : windOffset(fake, amount, WIND.drift, pOut <= 0);
      pt.wx = off.x;
      pt.wy = off.y;
    });
    renderLine(ln);
  });
}

// Hover: bend the points near the mouse away from it. Returns true while moving.
function bendLines() {
  let busy = false;
  const live = workScene.lastVisibility !== 'hidden';
  lines.forEach((ln) => {
    const n = ln.pts.length - 1;
    const dy = ln.y - pointer.sy;               // which side of the line the mouse is on
    const side = dy >= 0 ? 1 : -1;              // bend away from it
    const near = pointer.active && live && !reduceMotion && Math.abs(dy) < HOVER.radius;
    let moving = false;
    ln.pts.forEach((pt, k) => {
      let target = 0;
      if (near) {
        const dx = ln.x + (ln.w * k) / n - pointer.sx;
        const d = Math.hypot(dx / LINE.reach, dy / HOVER.radius);  // smooth falloff along and across the line
        target = side * LINE.push * clamp01(1 - d) ** 2;
      }
      const rate = Math.abs(target) > Math.abs(pt.hy) ? HOVER.speed : HOVER.settle;  // out slowly, back even slower
      pt.hy += (target - pt.hy) * rate;
      if (Math.abs(target - pt.hy) > 0.02 || target !== 0) moving = true;
      else pt.hy = target;
    });
    if (moving || ln.moving) renderLine(ln);
    ln.moving = moving;
    if (moving) busy = true;
  });
  return busy;
}

// Run by core.js's hover loop each frame; true while anything is still moving
function arrowsFrame() {
  let busy = false;
  arrowPieces.forEach((pc) => {
    if (Math.abs(pc.showTarget - pc.show) < 0.002) return;
    pc.show += (pc.showTarget - pc.show) * 0.09;
    if (Math.abs(pc.showTarget - pc.show) < 0.002) pc.show = pc.showTarget;
    renderArrow(pc);
    busy = true;
  });
  return busy;
}

// =========================================================================
// 7. START-UP — hooking into core.js, the intro, the clock
// =========================================================================

const scrollSpace = document.querySelector('.scroll-space');

Site.jump = (hash) => {          // menu links to a scene on this page glide there
  if (!(hash in STOPS)) return false;
  goTo(hash, true);
  return true;
};
Site.isGliding = () => !!glide;
Site.bg = () => (root.classList.contains('is-light') ? 'cream' : 'burgundy');

Site.onMeasure.push(() => {
  screenH = window.innerHeight;
  scrollSpace.style.height = `${(TIMELINE.end + 1) * screenH}px`;  // page length for the scroll
  [heroScene, workScene, contactScene].forEach((s) => { s.style.visibility = ''; s.lastVisibility = ''; });
  measureLogo(heroLogoPieces, true);   // big logo: right end goes first
  [heroTextPieces, workPieces, contactPieces, arrowPieces].forEach(measureOrder);
  heroLogoPieces.forEach((pc) => { pc.hoverScale = 1; });  // the big logo gets the full hover
  measureLines();
});
Site.onRedraw.push(() => {
  lastProgress.clear();  // positions (or lighter mode) changed: every group must redraw
  update(smoothY);
});
Site.onHoverFrame.push(bendLines, arrowsFrame);
Site.onPointer.push(() => { if (hero.progress < 1) wakeHero(); });
Site.onLite.push((lite) => {
  heroLogoPieces.forEach((pc) => {     // the soft trail on the logo drops
    const use = pc.trail && pc.el.querySelector('use');
    if (use) use.setAttribute('filter', lite ? 'none' : `url(#${pc.trail.id})`);
  });
});

window.addEventListener('scroll', startTick, { passive: true });
Site.start();

// A refresh always starts at the top (browsers normally restore the old
// scroll position, which would drop you in the middle of the animation)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

if (location.hash === '#work' || location.hash === '#contact') {
  // Opened with a link like index.html#work: jump to that scene once,
  // then clean the address so the next refresh starts at the top again
  const arriving = location.hash === '#work' ? workPieces : contactPieces;
  goTo(location.hash, false);
  history.replaceState(null, '', location.pathname + location.search);
  if (!reduceMotion) {
    // Coming from another page (its color sweep just covered the screen):
    // the top bar and that scene flow in on the wind
    const pieces = [...headerPieces, ...navPieces, ...arriving];
    pieces.forEach((pc) => { pc.click = 1; pc.clickIn = true; pc.clickWater = null; renderPiece(pc); });
    startIntroText(performance.now(), pieces);
  }
} else {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (!reduceMotion) startIntro();  // the logo forms out of a water drop, then the rest flows in
}
smoothY = window.scrollY;
update(smoothY);

setInterval(updateTime, 30 * 1000);  // keep the corner clock ticking
