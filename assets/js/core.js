// =========================================================================
// Angel Studio — core.js (shared by every page)
// =========================================================================
//
// DEVELOPER NOTES — read this first
// ---------------------------------
// WHICH FILE DOES WHAT
//   core.js  (this file) . everything the pages share: the liquid wind, hover,
//                          water drops on links, glass, the background canvas
//                          (drop pattern, ripples), page transitions, lighter mode
//   home.js ............. the home page only: the big logo, the scroll
//                          timeline, the work list, menu jumps, the intro
//   about.js ............ the about page only
//   Each page loads core.js first, then its own file, which registers what it
//   needs on `Site` (section 6) and finally calls Site.start().
//
// HOW THIS FILE IS ORGANIZED
//   1. SETTINGS ............ shared numbers you might want to tweak
//   2. HELPERS ............. small math tools, styles, lighter-mode detection
//   3. THE DROP PATTERN .... where each water drop of the background pattern sits
//   4. TEXT → PIECES ....... splitting text into letters ("pieces")
//   5. MOVING A PIECE ...... the liquid wind + hover + water drop, turned into CSS
//   6. SITE ................ the hooks pages use, the top bar (condensing into
//                            the menu button) and the bending lines (every page)
//   7. BACKGROUND CANVAS ... base color, cream sweep, drop pattern, ripples
//   8. LINKS ............... water drop on clicked links, page transitions
//   9. POINTER ............. hover loop, pattern patch, glass, mouse/taps
//  10. START-UP ............ measuring, lighter-mode switch, Site.start()
//
// KEY IDEAS / WORDS USED IN THE COMMENTS
//   piece    : one thing that moves on its own: a letter (<span class="char">)
//              or one drop / letter of the logo (class="piece"). Each piece is a small
//              object (see makePiece) that remembers its state.
//   amount   : how "gone" a piece is. 0 = in place and visible, 1 = carried
//              off and invisible. Everything is built on this.
//   order    : 0–1, which pieces go first. Lets a "burn front" cross a word.
//   layers   : a piece's final look combines three layers:
//                base  = where the page's scroll/timeline puts it (place)
//                click = a water drop on a clicked link, or the intro wind
//                hover = the scatter near the mouse                (updateHover)
//              renderPiece() combines them and writes the CSS.
//   loops    : animations run in requestAnimationFrame loops that only run
//              while something is moving, then switch themselves off.
//              "wake" functions switch them back on.
//   coords   : pieces remember where they rest (cx, cy). On fixed-screen
//              pages (home) that's the screen; on normal scrolling pages
//              (about) it's the page, so Site.offsetY() adds the scroll.
//
// PERFORMANCE RULES (why the code looks the way it does)
//   - Never write a style that didn't change (applyStyle keeps a copy).
//   - Never run a loop when nothing moves (loops stop themselves).
//   - Skip work for things that can't change (hover skips pieces far from
//     the mouse; the home timeline only redraws groups that changed).
//   - No big blur filters on the canvas (the sweep is blurred at ¼ size).
//   - The background only redraws what moves: the sweep is one picture slid
//     along, the mouse pattern lives in a small square, and the film grain
//     is part of the page background (section 7).
//   - Lighter mode (QUALITY / perf.lite): weak devices, or any device that
//     starts dropping frames, skip the expensive extras (letter blur, glass,
//     drop trails, water sheen) but keep every animation.
//
// TESTING TIP
//   Add ?quality=lite or ?quality=full to the address to force a mode, or
//   ?quality=auto to start full and let the frame-rate check decide.
// =========================================================================

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// =========================================================================
// 1. SETTINGS — shared numbers you might want to tweak (page-only settings live in each page's file)
// =========================================================================

// The liquid wind used by every fade in and out: one shared wind field moves
// all pieces together, so words bend, ripple and smear away like ink or
// burning paper. A "burn front" crosses from the bottom right when fading out;
// fading in is the same thing in reverse.
const WIND = {
  spread: 0.45,    // how long the burn front takes to cross (0 = all at once, 0.9 = slow sweep)
  drift: 110,      // how far text gets carried (px)
  logoDrift: 240,  // how far the big logo + name get carried (px)
  ripple: 12,      // how much things wave like liquid as they go (px)
  smear: 0.7,      // how much pieces stretch along the wind (0.7 = up to 70% longer)
  tilt: 7,         // how much pieces rock with the flow (degrees)
  smoothing: 0.09, // home page: how softly everything follows the scroll (lower = softer, 1 = instant)
};

// The burgundy → cream sweep behind the home page (drawn by the canvas, section 7)
const SWEEP = {
  blur: 70,        // softness of the wavy edge (px). Bigger = wider, mistier blend
  edge: 320,       // keep at about 4–5× blur, so the soft edge starts fully off-screen
};

// Hovering text: the pieces near the pointer scatter outward from it with a
// blur, then slowly drift back. Smaller text reacts proportionally less.
// On phones, a tap does it once.
const HOVER = {
  radius: 170,     // size of the area around the pointer that reacts (px)
  push: 30,        // how far the closest pieces get pushed out (px)
  blur: 10,        // blur on the closest pieces (px)
  fade: 0,         // how much they fade (0 = not at all, 1 = fully): none, text never turns see-through
  tilt: 12,        // how much they rock as they're pushed (degrees)
  speed: 0.035,    // how quickly pieces move away (lower = slower, lazier)
  settle: 0.012,   // how quickly they drift back to their places (lower = slower)
  follow: 0.05,    // how quickly the effect follows the mouse (lower = trails further behind)
  menu: 0.35,      // all small text (menu, labels, footer) and the small logo react this much (1 = same as big text)
  menuBlur: 0.35,  // and the blur on all small text is turned down to this much on top of that
  emailBlur: 0.25, // the email's blur is turned down to this much (1 = same as other text)
  titleBlur: 0.35, // the big titles' blur is turned down to this much
};

// Clicking any link (menu, small logo, email, footer links, work rows…): a
// drop of water falls where you clicked, the background ripples from there,
// and the link's letters dissolve outward from that spot like the big logo
// does. After a pause the letters form back the same way. Links to other
// pages wait for the dissolve before opening; menu jumps stay dissolved until
// the page has arrived.
const LINK_DRIP = {
  speed: 240,      // how fast the ring travels through the link (px per second)
  band: 70,        // how wide the ring is: bigger = each letter takes longer to go (px)
  push: 12,        // how far letters get pushed outward (px, less for small text)
  wobble: 3,       // how much they wobble on the ring (px)
  blur: 6,         // blur on letters as they dissolve (px, less for small text)
  swell: 0.1,      // how much they grow as they dissolve
  pause: 650,      // wait before it forms back (ms). Menu jumps wait until you've arrived, plus this
};

// Text flowing in on a page's intro uses the wind
const INTRO_DRIFT = 70;  // how far it flows in from (px)

// The menu condenses while you scroll down: the words are squashed flat into
// lines, and the lines are reeled onto a ring like a chain onto a spool (three
// bars with small gaps), the ring turning counterclockwise. Scrolling up (or pressing
// the ring) plays it backward. It plays on every screen and device, phones
// too, even with "reduce motion" on (Angel's choice).
const FOLD = {
  time: 1000,      // how long the whole change takes (ms)
  squash: 0.3,     // how much of that time the words take to get squashed flat into lines
  radius: 12,      // the ring's size (px; the button in style.css is this + 10px on each side, 44px)
  gap: 30,         // gap between the ring's bars (degrees; the round ends fill a little of it)
  settle: 0.2,     // how much of the time the meeting point takes to settle at the ring
  after: 80,       // never condensed this close to the top of the page (px)
  scroll: 12,      // how far you scroll one way before it changes (px)
  reopen: 60,      // after pressing the ring: scroll this much further down before it condenses again (px)
};

// The divider lines (every page): each one is a single continuous line (an
// SVG path) with bend points along it. When you hover, the points near the
// mouse are pushed away from it, so the line bends smoothly around the mouse
// like a string, then slowly springs back. When its text flows in or blows
// away, the points are carried by the same liquid wind (section 6, "Lines").
const LINE = {
  points: 48,      // bend points per line (more = smoother curve)
  push: 16,        // how far the line bends away from the mouse (px)
  reach: 140,      // how far along the line the bend spreads (px)
  room: 30,        // space above and below the line for bending (px; keep the same as .line in style.css)
};

// Going to another page (links with data-transition="cream" or "burgundy"):
// the clicked link gets its water drop, then a misty wavy front of the next
// page's background color sweeps across the screen from the top left to the
// bottom right, and the next page opens already in that color. If the screen
// is already that color there's no sweep: the next page simply opens once the
// link has dissolved.
const TRANSITION = {
  time: 1000,      // how long the sweep takes (ms)
  blur: 60,        // softness of the wavy edge (px)
};

// Background pattern: outlines of the logo's teardrop (drops 2 and 3; drop 1
// is unique to the logo) facing six ways, laid out like
// "3. Logo/Pattern Screenshot.jpg" (section 3). It shows in a soft patch
// around the mouse and in the click ripples. Both are drawn together on the
// canvas (section 7) from one set of drops, so a ripple moves the very drops
// you see around the mouse.
const PATTERN = {
  mark: 18,        // height of each drop (px); the spacing grows and shrinks with it
  opacity: 0.55,   // how visible the pattern is overall (0.55 = 45% see-through)
  radius: 220,     // size of the patch of pattern around the mouse (px)
  hover: 0.6,      // how visible the pattern is around the mouse (0 to 1)
  fadeTime: 0.5,   // how long the patch takes to appear / disappear (s)
};

// Click effect: a drop of water lands where you click and the pattern
// ripples outward from it. The drops only show where the rings pass, like
// light catching the waves, then the water goes still again.
const RIPPLE = {
  speed: 200,      // how fast the rings spread (px per second)
  wavelength: 64,  // distance between rings (px)
  rings: 2.2,      // how many rings follow the first one
  depth: 7,        // how far the drops get pushed at the crests (px)
  swell: 0.25,     // how much bigger the drops get on a crest (0.25 = 25%)
  reach: 360,      // how far the ripple travels before it's gone (px)
  duration: 2600,  // how long one ripple lasts (ms)
  strength: 0.95,  // how visible the drops get on the crests (0 to 1)
  sheen: 0.2,      // soft circular light on the rings, like a water surface (0 = none)
  dragGap: 140,    // while dragging, a new drop at most this often (ms)
  max: 8,          // most ripples at once (oldest are dropped)
};

// Film grain on the page background: how strong the noise is (0 = none)
const GRAIN = 0.027;

// Brand colors used on the canvas (keep the same as the CSS variables)
const COLOR = {
  burgundy: '#3B0008',
  cream: '#D6C7AE',
  burgundyRGB: '59, 0, 8',
  creamRGB: '214, 199, 174',
};

// Lighter mode for slower devices. The page starts in full mode unless the
// device is clearly weak (2 processor cores or less / 2 GB memory or less /
// data saver on),
// and switches to lighter mode by itself if it notices dropped frames.
// Lighter mode keeps every animation but skips the expensive extras:
// letters fade without blurring, no glass behind text, no soft trail on the
// logo drops, no water sheen, fewer ripples at once, and a lower canvas resolution.
// To test: add ?quality=lite or ?quality=full to the address (or
// ?quality=auto to start full and let the frame-rate check decide).
const QUALITY = {
  auto: true,      // watch the frame rate and switch to lighter mode if needed
  slowFrame: 28,   // a frame slower than this (ms) counts as slow (28ms ≈ 36 fps)
  sample: 90,      // judge over this many animated frames
  liteRipples: 3,  // most ripples at once in lighter mode
};

// =========================================================================
// 2. HELPERS
// =========================================================================

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const ease = (t) => t * t * (3 - 2 * t);                 // smooth start and stop
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const segment = (p, [a, b]) => clamp01((p - a) / (b - a)); // 0 before a, 0→1 between, 1 after b
const round2 = (v) => Math.round(v * 100) / 100;          // shorter style strings, fewer rewrites
const mod = (n, m) => ((n % m) + m) % m;                   // remainder that's never negative

// Fixed "random" number per piece (0–1), so the motion is the same every time
const rand = (i, k) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Staggered progress for one piece: the whole group goes 0→1 as p goes 0→1,
// but pieces with a low order start first (that's the "burn front").
const pieceProgress = (p, order, spread = WIND.spread) =>
  ease(clamp01((p - order * spread) / (1 - spread)));

// Write a piece's styles, but only the ones that actually changed
// (rewriting identical styles every frame is a big source of lag)
function applyStyle(pc, transform, filter, opacity) {
  const s = pc.el.style;
  if (pc.lastTransform !== transform) { s.transform = transform; pc.lastTransform = transform; }
  if (pc.lastFilter !== filter) { s.filter = filter; pc.lastFilter = filter; }
  if (pc.lastOpacity !== opacity) { s.opacity = opacity; pc.lastOpacity = opacity; }
}

// A CSS blur, or none (tiny blurs, and everything in lighter mode, aren't worth the cost)
const blurStyle = (px) => (!perf.lite && px > 0.05 ? `blur(${round2(px)}px)` : '');

// ---- Performance: lighter mode ----
// perf.lite is true in lighter mode (see QUALITY). frameTick() is called by
// the animation loops; if too many recent frames were slow, it switches to
// lighter mode once (setLite, section 10). The first 1.5 s after loading
// don't count (pages are always busy then).
const perf = { lite: false, last: 0, slow: 0, count: 0, badRuns: 0, from: performance.now() + 1500 };
(() => {
  const q = new URLSearchParams(location.search).get('quality');
  const nav = navigator;
  // Only clearly weak devices start light; everything else is judged by how
  // it actually runs (many fine laptops and phones have just 4 cores)
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) ||
    (nav.deviceMemory && nav.deviceMemory <= 2) ||
    (nav.connection && nav.connection.saveData);
  perf.lite = q === 'lite' || (!q && !!weak);
  if (q === 'lite' || q === 'full') QUALITY.auto = false;  // forced from the address: don't switch by itself
  root.classList.toggle('is-lite', perf.lite);
})();

function frameTick(now) {
  if (perf.lite || !QUALITY.auto || now === perf.last || now < perf.from) return;  // several loops can share one frame; ignore the busy first moments after loading
  const dt = now - perf.last;
  perf.last = now;
  if (dt > 300) return;  // a pause between animations, not a slow frame
  perf.count++;
  if (dt > QUALITY.slowFrame) perf.slow++;
  if (perf.count >= QUALITY.sample) {
    // 40%+ slow frames twice in a row: lighten up (once is often just a hiccup)
    perf.badRuns = perf.slow > perf.count * 0.4 ? perf.badRuns + 1 : 0;
    if (perf.badRuns >= 2) setLite(true);
    perf.count = 0;
    perf.slow = 0;
  }
}

// =========================================================================
// 3. THE DROP PATTERN — where each drop of the background pattern sits
// =========================================================================
// The pattern is one tile repeated across the screen in rows and columns.
// Each tile holds six drops: the same teardrop facing each of six ways
// (measured from "3. Logo/Pattern Screenshot.jpg"). Sizes are in drop
// heights, so the whole pattern scales with PATTERN.mark.
const TILE = { w: 3.549, h: 1.813 };  // tile size (drop heights)
const TILE_DROPS = [  // [x, y, angle]: where each drop sits in its tile, and which way its point faces (0 = up, clockwise)
  [ 0.887,  0.356,   0],  // point up      (like drop 2 in the logo)
  [-0.887, -0.356, 180],  // point down
  [-0.161,  0.429,  60],  // point up-right
  [ 0.161, -0.429, 240],  // point down-left
  [ 1.935,  0.429, 300],  // point up-left  (like drop 3 in the logo)
  [ 1.614, -0.429, 120],  // point down-right
];
const PER_TILE = TILE_DROPS.length;
const TILE_W = TILE.w * PATTERN.mark;
const TILE_H = TILE.h * PATTERN.mark;

// Screen position of drop (i, j): tile column floor(i / 6), tile row j,
// and its spot in the tile i mod 6
function dropAt(i, j) {
  const [x, y] = TILE_DROPS[mod(i, PER_TILE)];
  return { x: Math.floor(i / PER_TILE) * TILE_W + x * PATTERN.mark, y: j * TILE_H + y * PATTERN.mark };
}

// Which way drop i faces, in degrees
const dropAngle = (i) => TILE_DROPS[mod(i, PER_TILE)][2];

// Calls fn(i, j, x, y) for every drop within `size` px (a square) of (cx, cy)
function eachDropNear(cx, cy, size, fn) {
  const c0 = Math.floor((cx - size) / TILE_W) - 1, c1 = Math.floor((cx + size) / TILE_W) + 1;
  const j0 = Math.floor((cy - size) / TILE_H) - 1, j1 = Math.floor((cy + size) / TILE_H) + 1;
  for (let j = j0; j <= j1; j++) {
    for (let c = c0; c <= c1; c++) {
      for (let k = 0; k < PER_TILE; k++) {
        const i = c * PER_TILE + k;
        const { x, y } = dropAt(i, j);
        if (Math.abs(x - cx) <= size && Math.abs(y - cy) <= size) fn(i, j, x, y);
      }
    }
  }
}

// The drop nearest to a point on screen (clicks land on it)
function nearestDrop(x, y) {
  let best = { x, y }, bestD = Infinity;
  eachDropNear(x, y, PATTERN.mark * 2, (i, j, dx, dy) => {
    const d = (dx - x) ** 2 + (dy - y) ** 2;
    if (d < bestD) { bestD = d; best = { x: dx, y: dy }; }
  });
  return best;
}

// =========================================================================
// 4. TEXT → PIECES — splitting text into letters
// =========================================================================

// Split an element's text into one <span class="char"> per letter. Letters are
// grouped per word (<span class="word">), so lines still only break between
// words. Use this for plain text (titles, menu links).
// Screen readers: the letters are hidden from them (aria-hidden) and a
// visually hidden copy of the text (.sr-only, see style.css) is read instead,
// so words are read as words, links keep their names and nothing is lost.
function srText(text) {
  const span = document.createElement('span');
  span.className = 'sr-only';
  span.textContent = text;
  return span;
}

function splitLetters(el) {
  const text = el.textContent;
  el.textContent = '';
  if (!el.closest('[aria-hidden="true"]')) el.append(srText(text.replace(/\s+/g, ' ').trim()));
  const makeChar = (ch) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch;
    span.setAttribute('aria-hidden', 'true');
    return span;
  };
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      el.append(makeChar(' '));  // space between words: lines may break here
      return;
    }
    const word = document.createElement('span');
    word.className = 'word';
    for (const ch of part) word.append(makeChar(ch));
    el.append(word);
  });
}

// Like splitLetters, but keeps everything inside the element (line breaks,
// links, the clock…) and only splits the text itself. Use this for labels.
function splitDeep(el) {
  const speak = !el.closest('[aria-hidden="true"]');
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node, n) => {
    let text = node.textContent;
    // Whitespace between items in a flex/grid row is ignored by the browser: keep it that way
    const display = getComputedStyle(node.parentElement).display;
    if (!text.trim() && (display.includes('flex') || display.includes('grid'))) return;
    if (n === 0) text = text.replace(/^\s+/, '');                 // no space before the first word
    if (n === nodes.length - 1) text = text.replace(/\s+$/, '');  // or after the last
    const frag = document.createDocumentFragment();
    if (speak && text.trim()) frag.append(srText(text));  // what screen readers read
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        const space = document.createElement('span');
        space.className = 'char';
        space.textContent = ' ';
        space.setAttribute('aria-hidden', 'true');
        frag.append(space);
        return;
      }
      const word = document.createElement('span');
      word.className = 'word';
      word.setAttribute('aria-hidden', 'true');
      for (const ch of part) {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        word.append(span);
      }
      frag.append(word);
    });
    node.replaceWith(frag);
  });
}

// A piece: one letter or one logo drop, plus everything it needs to remember.
let pieceCount = 0;
const pieceByEl = new Map();  // element → its piece (used to find the pieces inside a clicked link)

function makePiece(el, { tilt, blur }) {
  const i = pieceCount++;
  const pc = {
    el,                                         // the element that moves
    i,                                          // its number (seeds its "random" values)
    svg: el.closest('svg'),                     // drops live inside an SVG (different units)
    isDrop: el.classList.contains('drop'),      // a logo drop rather than a letter
    fixed: !!el.closest('.site-header'),        // in the fixed top bar: stays put when the page scrolls
    rot: (rand(i, 4) - 0.5) * tilt,             // its own rocking direction for hover
    blur,                                       // how blurry it gets when fully gone (px)
    order: 0,                                   // 0–1: when it goes (set by measureOrder)
    scale: 1,                                   // screen px per SVG unit (drops only)
    cx: 0, cy: 0,                               // resting center on screen (set by measureOrder)
    // Hover layer
    h: 0, ox: 0, oy: 0,                         // hover amount (blur/fade) and push offset (px)
    hoverScale: 1, hoverDamp: 1, blurDamp: 1,   // how strongly this piece reacts
    hovering: false,                            // still moving from hover last frame?
    // Click layer: 0 = normal, 1 = fully dissolved (water drop on a clicked
    // link, or the intro's wind for the menu / home-screen text)
    click: 0, clickIn: false, clickWater: null,
    // Base layer: where the scroll timeline last put it
    base: 0, baseIn: false, baseDist: WIND.drift,
    hidden: false,                              // true while it's out of sight for another reason (a menu word turned into a bar)
    sharp: false,                               // true: never blurs (the small logo)
  };
  pieceByEl.set(el, pc);
  return pc;
}

// Work out each piece's order (0 = left/top, 1 = right/bottom) and remember
// where it rests on screen and how big it is (used by wind and hover).
function measureOrder(pieces) {
  pieces.forEach((pc) => applyStyle(pc, '', '', '1'));  // measure at rest
  const pts = pieces.map((pc) => {
    const r = pc.el.getBoundingClientRect();
    pc.cx = r.left + r.width / 2;
    pc.cy = r.top + r.height / 2 + offsetFor(pc);  // page coordinates on scrolling pages
    if (r.height) pc.hoverScale = Math.min(1, Math.max(0.3, Math.sqrt(r.height / 110)));
    return r.width ? (pc.cx / window.innerWidth) * 0.75 + ((r.top + r.height / 2) / window.innerHeight) * 0.25 : null;
  });
  const visible = pts.filter((v) => v !== null);
  const min = Math.min(...visible);
  const max = Math.max(...visible);
  pieces.forEach((pc, n) => { pc.order = pts[n] === null ? 0 : (pts[n] - min) / (max - min || 1); });
}

// Logos: measured like text, plus the SVG scale (screen px per logo unit).
// rightFirst: the right end goes first (the big logo blowing away).
function measureLogo(pieces, rightFirst) {
  measureOrder(pieces);
  pieces.forEach((pc) => {
    if (rightFirst) pc.order = 1 - pc.order;
    pc.scale = pc.svg ? pc.svg.getBoundingClientRect().width / pc.svg.viewBox.baseVal.width || 1 : 1;
  });
}

// =========================================================================
// 5. MOVING A PIECE — the liquid wind + hover + water drop, turned into CSS
// =========================================================================

// The wind blows toward the top left. Things fading out are carried with it;
// things fading in flow in from the bottom right, against it.
const WIND_DIR = { x: -1.6 / Math.hypot(1.6, 1), y: -1 / Math.hypot(1.6, 1) };
const WIND_ANGLE = (Math.atan2(WIND_DIR.y, WIND_DIR.x) * 180) / Math.PI;
const STILL = { x: 0, y: 0, rot: 0, stretch: 1 };  // "no wind" (used with reduced motion)

// Where the wind puts a piece at progress p (0 = in place, 1 = gone).
// Everything depends on the piece's spot on screen, so neighbors move almost
// the same way and words stay together like one liquid shape.
function windOffset(pc, p, dist, incoming) {
  const along = pc.cx * WIND_DIR.x + pc.cy * WIND_DIR.y;     // position along the wind
  const across = -pc.cx * WIND_DIR.y + pc.cy * WIND_DIR.x;   // position across it
  const sign = incoming ? -1 : 1;                            // incoming pieces come from upwind
  const carry = sign * p * p * dist * (0.85 + 0.3 * Math.sin(across * 0.004 + 1.3));  // picks up speed
  const wave = p * WIND.ripple * Math.sin(along * 0.008 + across * 0.005 + p * 4);    // liquid ripple
  return {
    x: WIND_DIR.x * carry - WIND_DIR.y * wave,
    y: WIND_DIR.y * carry + WIND_DIR.x * wave,
    rot: p * WIND.tilt * Math.sin(along * 0.006 - across * 0.004 + p * 3),
    stretch: 1 + p * WIND.smear,                             // smears along the wind
  };
}

// Build the CSS transform for a piece: wind offset (+ extra offsets),
// rotation, smear along the wind, size, and any extra transform at the end.
// Returns '' when the piece is exactly at rest.
function windTransform(pc, off, extraX = 0, extraY = 0, extraRot = 0, size = 1, extra = '') {
  const s = pc.scale;  // drops live inside a scaled SVG: convert screen px into SVG units
  const x = (off.x + extraX) / s;
  const y = (off.y + extraY) / s;
  const rot = off.rot + extraRot;
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01 && Math.abs(rot) < 0.01 &&
      off.stretch < 1.0005 && Math.abs(size - 1) < 0.0005 && !extra) return '';
  const smear = off.stretch > 1.0005
    ? ` rotate(${round2(WIND_ANGLE)}deg) scaleX(${off.stretch.toFixed(3)}) rotate(${round2(-WIND_ANGLE)}deg)`
    : '';
  return `translate(${round2(x)}px, ${round2(y)}px) rotate(${round2(rot)}deg)${smear}` +
    (Math.abs(size - 1) >= 0.0005 ? ` scale(${size.toFixed(4)})` : '') + extra;
}

// The water-drop look for a piece: a drop landed at (x0, y0) t seconds ago
// and a ring spreads from it. cfg holds speed / band / push / wobble / blur /
// swell (DRIP or LINK_DRIP); k scales push and blur (smaller for small text).
// mode 'out' dissolves the piece as the ring passes; 'in' forms it back.
// Writes into `out` (amount 0–1 = how dissolved, x/y push in px, blur, size).
function waterLook(pc, x0, y0, t, mode, cfg, k, out) {
  t = Math.max(0, t);
  const dx = pc.cx - x0, dy = pc.cy - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const u = clamp01((cfg.speed * t - dist) / cfg.band);   // 0 before the ring arrives, 1 after it has passed
  const e = ease(u);
  const gone = mode === 'out' ? e : 1 - e;                // how dissolved this piece is
  const ring = Math.sin(Math.PI * u);                     // strongest while the ring is on it
  const push = k * (gone * cfg.push + ring * cfg.wobble * Math.sin(dist * 0.06 - t * 9));
  out.amount = gone;
  out.x = (dx / dist) * push;
  out.y = (dy / dist) * push;
  out.blur = k * gone * cfg.blur;
  out.size = 1 + gone * cfg.swell;
  return out;
}

// Set a piece's BASE layer (where the scroll timeline wants it) and redraw.
// amount: 0 = in place, 1 = carried off. incoming: true for fading in.
function place(pc, amount, incoming = false, dist = WIND.drift) {
  pc.base = amount;
  pc.baseIn = incoming;
  pc.baseDist = dist;
  renderPiece(pc);
}

// Combine a piece's layers and write its styles. The base (scroll) and click
// layers both mean "how gone": whichever is stronger wins. Hover adds on top.
function renderPiece(pc) {
  let amount = pc.base, incoming = pc.baseIn, dist = pc.baseDist;
  let water = null;  // a link-click water drop, when it's the stronger layer
  if (pc.click > amount) {
    amount = pc.click;
    incoming = pc.clickIn;
    dist = INTRO_DRIFT;
    water = pc.clickWater;  // null for the intro (which uses the wind)
  }
  const p = reduceMotion ? 0 : amount;  // reduced motion: fade only, no movement
  const off = water || reduceMotion ? STILL : windOffset(pc, p, dist, incoming);
  const k = pc.hoverScale * pc.hoverDamp;
  const wx = water && !reduceMotion ? water.x : 0;
  const wy = water && !reduceMotion ? water.y : 0;
  const transform = windTransform(pc, off, pc.ox + wx, pc.oy + wy, pc.h * HOVER.tilt * k * Math.sign(pc.rot || 1),
    water && !reduceMotion ? water.size : 1);
  const goneBlur = water ? water.blur : p * pc.blur;
  const blur = pc.sharp ? 0 : (goneBlur + pc.h * HOVER.blur * k * pc.blurDamp) / pc.scale;
  // Fully gone pieces are invisible: drop their blur too, so the browser has nothing to process
  applyStyle(pc, transform, amount >= 1 ? '' : blurStyle(blur), String(round2((1 - amount) * (1 - pc.h * HOVER.fade))));
}

// The mouse (or last tap), in screen coordinates. Updated by the pointer events in section 9.
const pointer = {
  x: 0, y: 0,       // where the mouse is
  sx: 0, sy: 0,     // a point that trails behind the mouse (the hover effect follows this)
  px: 0, py: 0,     // center of the pattern patch (glides after the mouse, a bit quicker)
  active: false,    // is the mouse on the page / was there a tap?
  tap: 0,           // timer that ends a tap
};
const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const smallScreen = window.matchMedia('(max-width: 699.98px)').matches;  // phones (same size as the home page's phone version)

// Move a piece's HOVER layer one frame along. live: 1 = fully visible,
// 0 = gone (gone pieces don't react). Returns true while it's still moving.
// Uses the trailing pointer (pointer.sx/sy).
function updateHover(pc, live) {
  // Fast exit: resting pieces that are nowhere near the pointer can't change
  const py = pointer.sy + offsetFor(pc);  // the trailing pointer, in the same coordinates as the pieces
  if (pc.h === 0 && pc.ox === 0 && pc.oy === 0) {
    if (!pointer.active || live <= 0 || reduceMotion) return false;
    if (Math.abs(pc.cx - pointer.sx) > HOVER.radius || Math.abs(pc.cy - py) > HOVER.radius) return false;
  }

  const k = pc.hoverScale * pc.hoverDamp;  // smaller text reacts less; the menu less again
  let dx = pc.cx - pointer.sx;
  let dy = pc.cy - py;
  const d = Math.hypot(dx, dy);
  const radius = HOVER.radius * (0.5 + 0.5 * k);
  const near = pointer.active && !reduceMotion ? clamp01(1 - d / radius) ** 2 : 0;
  const target = near * live;
  pc.h += (target - pc.h) * (target > pc.h ? HOVER.speed : HOVER.settle);  // blur + fade amount
  if (d < 1) { dx = rand(pc.i, 6) - 0.5; dy = rand(pc.i, 7) - 0.5; }       // pointer dead-center: pick a direction
  const len = Math.hypot(dx, dy) || 1;

  // Where the hover wants this piece (pushed out from the pointer). The piece
  // glides there at its own slow pace, so when the pointer passes over it, it
  // drifts across through the pointer instead of jumping to the other side.
  const tx = (dx / len) * target * HOVER.push * k;
  const ty = (dy / len) * target * HOVER.push * k;
  const glide = Math.hypot(tx, ty) > Math.hypot(pc.ox, pc.oy) ? HOVER.speed : HOVER.settle;
  pc.ox += (tx - pc.ox) * glide;
  pc.oy += (ty - pc.oy) * glide;

  const moving = target > 0 || pc.h > 0.002 || Math.abs(pc.ox) > 0.03 || Math.abs(pc.oy) > 0.03;
  if (!moving) { pc.h = 0; pc.ox = 0; pc.oy = 0; }  // snap to rest so the fast exit kicks in
  return moving;
}

// =========================================================================
// 6. SITE — the hooks pages use, the top bar and the bending lines (every page)
// =========================================================================
// core.js doesn't know what's on each page. Each page's file fills in `Site`:
// it adds its pieces, registers small functions ("hooks") that core.js calls
// at the right moments, and finally calls Site.start().

const Site = {
  hoverPieces: [],        // pieces that react to the mouse (the header's are added below)
  onMeasure: [],          // page measuring (after fonts load / resize), before redrawing
  onRedraw: [],           // redraw the page's pieces (after measuring, or a lighter-mode switch)
  onHoverFrame: [],       // extra per-frame hover work; return true while still moving
  onPointer: [],          // the mouse moved or the screen was tapped
  onTap: [],              // touchscreens: a tap (not a swipe) ended, with its pointer event
  onRipple: [],           // a ripple starts: fn(x, y, start) (screen coordinates, start time in ms)
  onLite: [],             // lighter mode was switched on or off
  jump: null,             // (hash) → true if this page handles a link to that #scene itself
  isGliding: () => false, // is an in-page jump still moving? (links stay dissolved until it stops)
  scrolls: false,         // true on normal scrolling pages (about); false on the fixed home stage
  creamAt: null,          // optional (x, y) → is that spot on screen cream? (pattern drop colors)
  ownBackground: false,   // true: the page paints its own background (core.js won't set it)
  linkDrops: !smallScreen, // false: clicked links open right away, without the water-drop dissolve (phones)
  offsetY: () => 0,       // 0 on fixed-screen pages; window.scrollY on normal scrolling pages
  bg: () => root.dataset.bg || 'burgundy',  // the background color right now ('burgundy' or 'cream')
  start: null,            // set in section 10
};

// The page's scroll position, kept up to date by a scroll listener. (Reading
// window.scrollY right after moving pieces makes the browser redo the page
// layout first; doing that for every piece in every frame made scrolling slow.)
// Scrolling pages use it as Site.offsetY.
let lastScrollY = window.scrollY;
window.addEventListener('scroll', () => { lastScrollY = window.scrollY; }, { passive: true });
const pageScroll = () => lastScrollY;

// A piece's scroll offset: pieces remember their place on the PAGE on
// scrolling pages, except those in the fixed top bar, which never move
const offsetFor = (pc) => (pc && pc.fixed ? 0 : Site.offsetY());

// ---- The header (small logo + menu), on every page ----
const headerLogo = document.querySelector('.site-header__logo');

// The drops and letters of a logo (each is its own shape in the logo's SVG)
function logoPieces(container, opts) {
  if (!container) return [];
  return [...container.querySelectorAll('.piece')].map((el) => makePiece(el, opts));
}

// Every [data-wind] element inside a container, split into letters.
// data-wind="letters" = plain text (big titles); data-wind = labels that may
// contain line breaks, links or the clock.
function windPieces(container) {
  const els = [];
  container.querySelectorAll('[data-wind]').forEach((el) => {
    if (el.dataset.wind === 'letters') splitLetters(el);
    else splitDeep(el);
    els.push(...[...el.querySelectorAll('.char')].filter((c) => c.textContent.trim()));
  });
  return els.map((el) => makePiece(el, { tilt: 30, blur: 6 }));
}

const headerPieces = logoPieces(headerLogo, { tilt: 30, blur: 5 });

// Menu links: split into letters so they can react to hover
const navPieces = [];
document.querySelectorAll('.site-nav a').forEach((a) => {
  splitLetters(a);
  a.querySelectorAll('.char').forEach((c) => {
    if (c.textContent.trim()) navPieces.push(makePiece(c, { tilt: 20, blur: 5 }));
  });
});

// All small text reacts like the menu: a gentler push and a light blur, so it
// stays easy to read and click. "Small text" = the menu, every .label and the
// footer row. Pages call this on their pieces too.
const isSmallText = (pc) => !!pc.el.closest('.site-nav, .label, .contact__bottom');
function tuneSmallText(pieces) {
  pieces.filter(isSmallText).forEach((pc) => {
    pc.hoverDamp = HOVER.menu;
    pc.blurDamp = HOVER.menuBlur;
  });
  // The email: normal hover movement, but a lighter blur so it stays readable
  pieces.filter((pc) => pc.el.closest('.contact__email')).forEach((pc) => { pc.blurDamp = HOVER.emailBlur; });
}
tuneSmallText(navPieces);
navPieces.forEach((pc) => { pc.sharp = true; });  // the menu's letters never blur (its only blur is the frosted pill behind the whole menu)
headerPieces.forEach((pc) => { pc.hoverDamp = HOVER.menu; pc.sharp = true; });  // the small logo: gentle push, never blurred
Site.hoverPieces.push(...headerPieces, ...navPieces);


// ---- The menu condenses into a ring while scrolling down (settings in FOLD) ----
// First all three words are pressed flat, as if sandwiched, into lines that
// settle at the height of the ring's bottom edge. Then the lines are reeled
// in like a belt onto a wheel: they slide right together and run straight
// onto the ring, which turns counterclockwise as it reels them in. Wound up,
// each word shrinks to one bar (and the space between words to a small gap),
// so the three bars end up evenly spaced around the circle. Opening plays it backward: the ring turns
// clockwise and the words roll back out.
// The lines are drawn on one SVG over the top bar (.site-morph); the button
// (.site-burger) is an invisible hit area on top of the ring.
const svgNS = 'http://www.w3.org/2000/svg';  // (also used by the lines below and home.js)
const siteNav = document.querySelector('.site-nav');
const burger = document.querySelector('.site-burger');
const morphSvg = document.createElementNS(svgNS, 'svg');
morphSvg.setAttribute('class', 'site-morph');
morphSvg.setAttribute('aria-hidden', 'true');
if (burger) burger.after(morphSvg);

const bars = [...siteNav.querySelectorAll('a')].reverse().map((link) => {  // right to left: the order they're reeled in
  const path = document.createElementNS(svgNS, 'path');
  morphSvg.append(path);
  return {
    link, path,
    pieces: navPieces.filter((pc) => link.contains(pc.el)),
    x0: 0, x1: 0, y: 0,   // where the word sits at rest (set by measureFold)
    last: '',
  };
});
const ring = { x: 0, y: 0 };  // the ring's center (the button's center)
const CHAIN_POINTS = 40;      // points along each word's line (more = a smoother curve)

const fold = {
  on: false,       // condensed (or on its way there)?
  t: 0,            // where the timeline is: 0 = the menu, 1 = the ring
  running: false,
  last: 0,
  anchor: null,    // the scroll position the direction is measured from
  slack: 0,        // extra scroll needed before condensing again (after pressing the ring)
};

function setFold(on) {
  if (on === fold.on || !burger) return;
  fold.on = on;
  root.classList.toggle('is-folded', on);
  siteNav.inert = on;            // the hidden menu can't be clicked or tabbed to…
  burger.inert = !on;            // …and neither can the hidden button
  if (glassReady) updateGlass(); // the menu's glass goes and comes with it
  if (!fold.running) { fold.running = true; fold.last = performance.now(); requestAnimationFrame(foldFrame); }
}

// Moves the timeline toward the ring (1) or the menu (0); turning around halfway just reverses it
function foldFrame(now) {
  const step = (now - fold.last) / FOLD.time;
  fold.last = now;
  fold.t = clamp01(fold.t + (fold.on ? step : -step));
  drawFold();
  if (fold.t !== (fold.on ? 1 : 0)) requestAnimationFrame(foldFrame);
  else { fold.running = false; checkBehindLogo(); }  // the ring is done: is anything behind it?
}

// Wound onto the ring, the chain is shorter: each word becomes one bar and
// each space between words one gap. chainAt(x) says how far along the wound
// chain the spot that rests at x (on the menu) ends up (px, from the right end
// of the last word). Outside the words it isn't shortened.
function chainAt(x) {
  const r = FOLD.radius;
  const bar = (r * (360 / bars.length - FOLD.gap) * Math.PI) / 180;  // one bar's length on the ring (px)
  const gap = (r * FOLD.gap * Math.PI) / 180;
  if (x >= bars[0].x1) return -(x - bars[0].x1);                     // right of the menu
  for (let k = 0; k < bars.length; k++) {
    const b = bars[k], start = k * (bar + gap);
    if (x >= b.x0) return start + ((b.x1 - x) / (b.x1 - b.x0 || 1)) * bar;           // on word k
    const next = bars[k + 1];
    if (next && x >= next.x1) return start + bar + ((b.x0 - x) / (b.x0 - next.x1 || 1)) * gap;  // the space after it
  }
  const last = bars[bars.length - 1];
  return (bars.length - 1) * (bar + gap) + bar + (last.x0 - x);       // left of the menu
}

function drawFold() {
  if (!bars.length) return;
  const t = fold.t, r = FOLD.radius;
  const cy = ring.y;
  // First every word is squashed flat, as if pressed down from above: it
  // flattens into a line that settles at the height of the ring's bottom edge
  const squash = ease(segment(t, [0, FOLD.squash]));
  const lineY = (bar) => bar.y + (cy + r - bar.y) * squash;
  // Then the lines are reeled in, running straight onto the bottom of the ring
  // like a belt onto a wheel: how far the chain has moved right (when it's
  // all in, the left end of the first word has just reached the ring)
  const reel = segment(t, [FOLD.squash, 1]);
  const move = (ring.x - bars[bars.length - 1].x0) * easeInOut(reel);
  // Where the chain meets the ring (straight under its center). It starts just
  // right of the menu, so nothing is reeled in at rest, and moves to the ring
  // quickly as the lines start sliding (the ring is still empty then)
  const meet = ring.x + Math.max(0, bars[0].x1 + 2 - ring.x) * (1 - ease(segment(reel, [0, FOLD.settle])));
  const wound = chainAt(meet - move);                     // how much chain is on the ring
  burger.style.setProperty('--ring', String(round2(ease(segment(t, [0.45, 0.9])))));  // its frosted disc can only show as the ring forms

  // A spot that rests at x on the menu: where is it now?
  const spot = (x, bar) => {
    const p = x + move;
    if (p <= meet) return [p, lineY(bar)];                // on its way: a straight line
    const a = Math.PI / 2 - (wound - chainAt(x)) / r;     // wound on: further round the ring, counterclockwise
    return [meet + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  bars.forEach((bar) => {
    // The line (the whole word, once it's flat enough)
    let d = '';
    if (squash > 0) {
      for (let i = 0; i <= CHAIN_POINTS; i++) {
        const [x, y] = spot(bar.x0 + ((bar.x1 - bar.x0) * i) / CHAIN_POINTS, bar);
        d += `${i ? 'L' : 'M'}${round2(x)} ${round2(y)}`;
      }
    }
    if (d !== bar.last) { bar.path.setAttribute('d', d); bar.last = d; }
    bar.path.style.opacity = String(round2(segment(squash, [0.55, 1])));  // the line shows as the word gets flat
    // The word: pressed down flat (and spread a little sideways), sliding with the chain, gone once it's a line
    const s = bar.link.style;
    s.transform = squash > 0
      ? `translate(${round2(move)}px, ${round2(lineY(bar) - bar.y)}px) scale(${round2(1 + 0.08 * squash)}, ${round2(1 - 0.94 * squash)})`
      : '';
    s.opacity = squash > 0 ? String(round2(1 - segment(squash, [0.6, 1]))) : '';
    bar.pieces.forEach((pc) => { pc.hidden = squash > 0; });  // no hover while it's changing
  });
}

// ---- Frosted backgrounds (logo, menu, ring): only while something is behind ----
// While page content (text, a box, an image) is within BEHIND.near px of the
// small logo, the menu or the ring, <html> gets .is-behind / .is-behind-nav /
// .is-behind-ring and that frosted shape fades in (style.css section 5; each
// also shows while the mouse is over it). For speed, the content's boxes and
// the top bar's boxes are measured once (measureBehind, at start and after
// resizes); while scrolling it's only a little math, at most once a frame.
const BEHIND = { near: 18 };  // how close content has to come (px; the frosted shapes reach a little past the logo, menu and ring)
const CONTENT = 'main p, main h1, main h2, main h3, main li, main a, main img, main video, main .ph';  // what counts as content
let contentBoxes = [];        // { scene, block, l, r, t, b }: page coordinates on scrolling pages
const barBoxes = {};          // the logo's, the menu's and the ring's boxes (the top bar never moves)
let behindQueued = false;

function measureBehind() {
  const off = Site.offsetY();
  contentBoxes = [...document.querySelectorAll(CONTENT)].map((el) => {
    const r = el.getBoundingClientRect();
    return { scene: el.closest('.scene'), block: el.closest('.reveal'), l: r.left, r: r.right, t: r.top + off, b: r.bottom + off };
  }).filter((c) => c.r > c.l);
  for (const [name, el] of [['logo', headerLogo], ['nav', siteNav], ['ring', burger]]) {
    if (el) barBoxes[name] = el.getBoundingClientRect();
  }
}

// Is any page content that's showing within BEHIND.near px of this top-bar box?
function contentBehind(box) {
  if (!box) return false;
  const m = BEHIND.near, off = Site.offsetY();
  return contentBoxes.some((c) =>
    !(c.scene && c.scene.lastVisibility === 'hidden') && !(c.block && !c.block.classList.contains('is-in')) &&  // (hidden scenes, blocks not in yet)
    c.l < box.right + m && c.r > box.left - m && c.t - off < box.bottom + m && c.b - off > box.top - m);
}

function updateBehind() {
  root.classList.toggle('is-behind', root.classList.contains('is-scrolled') && contentBehind(barBoxes.logo));
  root.classList.toggle('is-behind-ring', fold.t > 0 && contentBehind(barBoxes.ring));
  root.classList.toggle('is-behind-nav', fold.t < 1 && contentBehind(barBoxes.nav));
}

// Phone browsers color their own top bar (behind the clock) and the area
// you see when pulling the page down. Tell them the color of the page right
// at the top, so it never shows a different color there. (Only the meta tag:
// a background on <html> would cover the pattern canvas, which sits behind
// the page and relies on the body's background being the page's own.)
const themeMeta = document.querySelector('meta[name="theme-color"]') || document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
function syncTopColor() {
  const color = root.classList.contains('is-light') || Site.bg() === 'cream' ? COLOR.cream : COLOR.burgundy;
  if (themeMeta.content !== color) themeMeta.content = color;
}
new MutationObserver(syncTopColor).observe(root, { attributes: true, attributeFilter: ['class'] });  // (follows .is-light as it changes)

// Checks at most once a frame
function checkBehindLogo() {
  if (behindQueued) return;
  behindQueued = true;
  requestAnimationFrame(() => {
    behindQueued = false;
    updateBehind();
  });
}

// Which way the page is scrolling decides: down condenses, up brings the menu back
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  checkBehindLogo();
  if (fold.anchor === null || y <= FOLD.after) {   // first scroll (or a jump on opening), or back near the top
    fold.anchor = y;
    if (y <= FOLD.after) setFold(false);
    return;
  }
  if (fold.on) {
    if (y < fold.anchor - FOLD.scroll) { setFold(false); fold.anchor = y; }
    else fold.anchor = Math.max(fold.anchor, y);
  } else {
    if (y > fold.anchor + FOLD.scroll + fold.slack) { setFold(true); fold.anchor = y; fold.slack = 0; }
    else fold.anchor = Math.min(fold.anchor, y);
  }
}, { passive: true });

// Pressing the ring opens the menu again (keyboard: the focus moves to its first link)
if (burger) {
  burger.addEventListener('click', () => {
    const keyboard = burger.matches(':focus-visible');
    setFold(false);
    fold.anchor = window.scrollY;
    fold.slack = FOLD.reopen;
    if (keyboard) siteNav.querySelector('a').focus({ preventScroll: true });
  });
}

// Where each word's line sits and where the ring is (in the top bar's own space)
function measureFold() {
  if (!burger) return;
  const hb = burger.parentElement.getBoundingClientRect();
  morphSvg.setAttribute('viewBox', `0 0 ${Math.max(1, hb.width)} ${Math.max(1, hb.height)}`);
  const b = burger.getBoundingClientRect();
  ring.x = b.left + b.width / 2 - hb.left;
  ring.y = b.top + b.height / 2 - hb.top;
  bars.forEach((bar) => {
    const moved = bar.link.style.transform;
    bar.link.style.transform = '';  // measure the word at rest
    const r = bar.link.getBoundingClientRect();
    bar.link.style.transform = moved;
    bar.x0 = r.left - hb.left;
    bar.x1 = r.right - hb.left;
    bar.y = r.top + r.height / 2 - hb.top;
    bar.last = '';
  });
  drawFold();
}

// ---- Lines: the bending divider lines (settings in LINE) ----
// makeLines() turns the border of each matching element into one bending
// line. edge: 'top' or 'bottom' (which border it replaces). live(host): is
// that line on screen right now (only those bend)? Pages wind their lines
// along with their text (windLines).
const lines = [];

function makeLines(selector, edge, live) {
  return [...document.querySelectorAll(selector)].map((host) => {
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', `line line--${edge}`);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNS, 'path');
    svg.append(path);
    host.append(svg);
    host.classList.add(`has-line--${edge}`);  // its border is hidden (style.css)
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const ln = {
      host, svg, path, edge,
      live: () => live(host),
      x: 0, y: 0, w: 0,                       // where it sits (set by measureLines)
      pts: Array.from({ length: LINE.points }, () => ({
        hy: 0,           // hover bend (px), eases toward its target
        wx: 0, wy: 0,    // wind offset (px)
      })),
      moving: false, last: '',
    };
    lines.push(ln);
    return ln;
  });
}

function measureLines() {
  lines.forEach((ln) => {
    const r = ln.host.getBoundingClientRect();
    ln.x = r.left;
    ln.y = (ln.edge === 'top' ? r.top + 0.5 : r.bottom - 0.5) + Site.offsetY();  // where the 1px border was
    ln.w = r.width;
    ln.svg.setAttribute('viewBox', `0 ${-LINE.room} ${Math.max(1, ln.w)} ${LINE.room * 2}`);
    ln.last = '';
    renderLine(ln);
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

// Carry each bend point with the wind, like the letters next to it.
// pIn: 0–1 how far it has flowed in; pOut: 0–1 how far it has blown away.
function windLines(list, pIn, pOut = 0) {
  list.forEach((ln) => {
    const n = ln.pts.length - 1;
    ln.pts.forEach((pt, k) => {
      const fake = { cx: ln.x + (ln.w * k) / n, cy: ln.y };  // this point's spot
      // (kept between 0 and 1: a line far down the page would otherwise count
      // as "not there yet" even once its block is fully in, and stay bent)
      const order = clamp01((fake.cx / window.innerWidth) * 0.75 + ((fake.cy - Site.offsetY()) / window.innerHeight) * 0.25);
      const amount = pOut > 0 ? pieceProgress(pOut, 1 - order) : pIn >= 1 ? 0 : 1 - pieceProgress(pIn, order);
      const off = reduceMotion || amount <= 0 ? STILL : windOffset(fake, amount, WIND.drift, pOut <= 0);
      pt.wx = off.x;
      pt.wy = off.y;
    });
    renderLine(ln);
  });
}

// Hover: bend the points near the mouse away from it. Returns true while moving.
function bendLines() {
  let busy = false;
  lines.forEach((ln) => {
    const n = ln.pts.length - 1;
    const dy = ln.y - Site.offsetY() - pointer.sy;  // which side of the line the mouse is on
    const side = dy >= 0 ? 1 : -1;                  // bend away from it
    const near = pointer.active && !reduceMotion && Math.abs(dy) < HOVER.radius && ln.live();
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
Site.onHoverFrame.push(bendLines);

// =========================================================================
// 7. BACKGROUND CANVAS — base color, cream sweep, drop pattern, ripples
// =========================================================================
// Everything here lives inside this one block; the rest of the code talks to
// it through `background`: setBase(color), setSweep(t), addDrop(x, y),
// patternChanged(), areas() and resize().
//
// SPEED: the page's own background color (body) is the base. The canvases are
// see-through and only draw what moves on top of it:
//   - the big canvas (.bg, full screen): the cream sweep while it moves, and
//     ripples. Hidden the rest of the time.
//   - a small canvas (.bg-patch) just big enough for the drop pattern around
//     the mouse, which follows the mouse. Redrawing a small square instead of
//     the whole screen on every mouse move is what keeps hovering smooth.
// While ripples play, the mouse patch is drawn on the big canvas instead, so
// each drop is still only ever drawn once.

const background = (() => {
  const canvas = document.querySelector('.bg');
  const ctx = canvas.getContext('2d');
  const patch = document.createElement('canvas');  // the small mouse-patch canvas
  patch.className = 'bg bg-patch';
  patch.setAttribute('aria-hidden', 'true');
  canvas.after(patch);
  Object.assign(patch.style, { inset: 'auto', left: '0', top: '0', width: `${2 * Math.ceil(PATTERN.radius + PATTERN.mark * 2)}px`, height: `${2 * Math.ceil(PATTERN.radius + PATTERN.mark * 2)}px` });
  const pctx = patch.getContext('2d');
  const PATCH = 2 * Math.ceil(PATTERN.radius + PATTERN.mark * 2);  // its size (css px)

  // The sweep is drawn and blurred on a small copy (¼ size), then scaled up.
  // Blurring a small image is ~16× cheaper and looks the same (the edge is soft anyway).
  const SWEEP_SCALE = 0.25;
  const sweepCanvas = document.createElement('canvas');
  sweepCanvas.className = 'bg bg-sweep';
  sweepCanvas.setAttribute('aria-hidden', 'true');
  canvas.before(sweepCanvas);  // behind the drops
  Object.assign(sweepCanvas.style, { inset: 'auto', left: '0', top: '0', visibility: 'hidden', willChange: 'transform' });
  const sctx = sweepCanvas.getContext('2d');
  let sweepSize = 0, sweepShown = false;

  let w = 0, h = 0, dpr = 1;   // canvas size (css px) and pixel density
  let sweep = 0;               // how far the cream has swept in (0–1)
  let base = root.dataset.bg || 'burgundy';  // the page's base color: <html data-bg="cream"> on the about page
  let geo = { D: 1, u: { x: 0, y: 0 }, n: { x: 0, y: 0 } };  // sweep direction, set on resize
  let ripples = [];            // ripples currently playing
  let running = false;         // is the drawing loop on?
  let hadRipples = false;      // were ripples playing last frame? (one last glass update when they end)
  let lastNow = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, perf.lite ? 1 : 1.5);  // capped: sharper isn't worth the cost
    // Use the canvas's real on-screen size (excludes the scrollbar), so the
    // drawing isn't squeezed
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    patch.width = patch.height = Math.round(PATCH * dpr);

    const D = Math.hypot(w, h);
    const u = { x: -w / D, y: -h / D };  // direction the sweep travels (to the top left)
    geo = { D, u, n: { x: -u.y, y: u.x } };
    drawSweepImage();
    draw(performance.now());
  }

  // ---- Cream sweep: a wavy, misty front from the bottom-right to the top-left ----
  // The soft wavy edge is drawn ONCE (on resize) into its own canvas, small
  // and blurred, then shown big. Scrolling only slides that picture along
  // (a CSS transform), so the browser moves it without redrawing anything.

  const waveAt = (v) => Math.sin(v * 0.006) * 46 + Math.sin(v * 0.017) * 18;
  const frontAt = () => -SWEEP.edge + sweep * (geo.D + 2 * SWEEP.edge);

  function drawSweepImage() {
    const { D, u, n } = geo;
    const edge = SWEEP.edge;
    sweepSize = 2 * Math.ceil(D + 2 * edge);         // css px; the front's middle sits in the center
    const k = SWEEP_SCALE;
    sweepCanvas.width = sweepCanvas.height = Math.ceil(sweepSize * k);
    sweepCanvas.style.width = sweepCanvas.style.height = `${sweepSize}px`;
    const c = sweepSize / 2;
    sctx.setTransform(k, 0, 0, k, 0, 0);
    sctx.clearRect(0, 0, sweepSize, sweepSize);
    sctx.filter = `blur(${SWEEP.blur * k}px)`;      // soft, misty edge
    sctx.fillStyle = COLOR.cream;
    sctx.beginPath();
    for (let v = -D; v <= D; v += 30) {             // trace the wavy front...
      const x = c + u.x * waveAt(v) + n.x * v;
      const y = c + u.y * waveAt(v) + n.y * v;
      v === -D ? sctx.moveTo(x, y) : sctx.lineTo(x, y);
    }
    sctx.lineTo(c - u.x * (D + edge) + n.x * D, c - u.y * (D + edge) + n.y * D);  // ...and fill everything behind it
    sctx.lineTo(c - u.x * (D + edge) - n.x * D, c - u.y * (D + edge) - n.y * D);
    sctx.closePath();
    sctx.fill();
    sctx.filter = 'none';
    placeSweep();
  }

  // Slide the picture so its front sits where the sweep has got to
  function placeSweep() {
    const moving = sweep > 0 && sweep < 1;
    if (moving !== sweepShown) { sweepCanvas.style.visibility = moving ? '' : 'hidden'; sweepShown = moving; }
    if (!moving) return;
    const s = frontAt();
    const x = w + geo.u.x * s - sweepSize / 2;
    const y = h + geo.u.y * s - sweepSize / 2;
    sweepCanvas.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // Is this spot cream yet? (follows the same wavy front as drawSweep)
  function creamAt(px, py) {
    if (Site.creamAt) return Site.creamAt(px, py);  // a page can decide itself (the home page on phones)
    if (base === 'cream') return true;
    if (sweep <= 0) return false;
    if (sweep >= 1) return true;
    const { u, n } = geo;
    const v = (px - w) * n.x + (py - h) * n.y;
    const along = (px - w) * u.x + (py - h) * u.y;
    return along < frontAt() + waveAt(v);
  }

  // ---- The drop pattern + click ripples ----

  // One water drop from the logo (its bottom-left drop, point up), centered,
  // as a reusable outline. One version per direction it can face (cached).
  const DROP_UNITS = 66.18;  // how tall the drop is, in the logo's units
  const dropShape = new Path2D('M1.37 -32.33 L19.45 -1.07 C25.75 9.82 22.09 24.07 11.11 30.22 C7.91 32.02 4.45 32.95 1 33.09 L0.08 33.09 L-0.81 33.09 C-8.29 32.79 -15.46 28.79 -19.49 21.82 C-23.51 14.86 -23.41 6.65 -19.93 0.02 L-19.48 -0.75 L-19.02 -1.55 L-1.26 -32.33 C-0.68 -33.34 0.78 -33.34 1.37 -32.33 Z');
  const dropPaths = new Map();
  function dropPath(deg) {
    let path = dropPaths.get(deg);
    if (!path) {
      path = new Path2D();
      path.addPath(dropShape, new DOMMatrix().rotate(deg));
      dropPaths.set(deg, path);
    }
    return path;
  }

  // The water surface at distance r from where the drop landed, t seconds
  // after it landed. Fills `wave` (reused, no new objects each time) with:
  //   push  = how far the pattern is pushed outward there (px)
  //   light = how visible the pattern is there (0–1)
  //   crest = how high the wave is (-1 to 1)
  const wave = { push: 0, light: 0, crest: 0 };
  function waterAt(r, t, fade) {
    const R = RIPPLE;
    const behind = R.speed * t - r;         // how far behind the first ring this spot is
    if (behind < 0 || r > R.reach) { wave.push = 0; wave.light = 0; wave.crest = 0; return wave; }
    const band = R.wavelength * R.rings;
    const packet = Math.exp(-(((behind - R.wavelength * 0.6) / (band * 0.5)) ** 2));  // where the rings are
    const crest = Math.sin((2 * Math.PI * behind) / R.wavelength);                    // up and down
    const spread = 1 / Math.sqrt(1 + r / 90);                                        // rings flatten as they grow
    const edge = clamp01(1 - r / R.reach);
    wave.push = R.depth * crest * packet * spread * fade;
    wave.crest = crest * packet * fade;
    wave.light = R.strength * packet * edge * fade * (0.45 + 0.55 * Math.max(0, crest));  // crests catch the light
    return wave;
  }

  // ---- The drops: one set for both the mouse patch and the ripples ----
  // Every frame, each drop that's visible gets a "how visible" amount and a
  // "how far pushed" offset. The mouse patch makes drops visible; ripples make
  // them visible on their crests and push them outward. A drop under both just
  // takes the stronger visibility and the ripple's push, so there's only ever
  // one copy of each drop.
  let patternFade = 0;    // 0 = mouse patch hidden, 1 = shown (eases in and out)
  let patternMoved = false;
  const drops = new Map(); // drops to draw this frame, keyed "i,j" (reused)

  function touchDrop(i, j) {
    const key = `${i},${j}`;
    let d = drops.get(key);
    if (!d) { d = { i, j, light: 0, px: 0, py: 0, swell: 0 }; drops.set(key, d); }
    return d;
  }

  // c = the canvas to draw on; (ox, oy) = where its top-left corner is on screen
  function drawDrops(now, c, ox, oy) {
    const R = RIPPLE;
    ripples = ripples.filter((rp) => now - rp.start < R.duration);
    drops.forEach((d) => { d.light = 0; d.px = 0; d.py = 0; d.swell = 0; });

    // 1. The soft patch around the mouse: full strength in the middle,
    //    fading out toward its edge
    if (patternFade > 0) {
      const PR = PATTERN.radius;
      eachDropNear(pointer.px, pointer.py, PR, (i, j, x, y) => {
        const d = Math.hypot(x - pointer.px, y - pointer.py);
        if (d > PR) return;
        const edge = d < PR * 0.3 ? 1 : clamp01((PR - d) / (PR * 0.7));
        touchDrop(i, j).light = PATTERN.hover * edge * patternFade;
      });
    }

    // 2. The ripples: a soft circular sheen on the water, plus the drops on the rings
    ripples.forEach((rp) => {
      const t = (now - rp.start) / 1000;
      const fade = (1 - t / (R.duration / 1000)) ** 1.6 * Math.min(1, t / 0.06);  // quick start, slow calm-down
      const size = Math.min(R.reach, R.speed * t);                                 // how far it has spread
      if (size < 2) return;
      const inner = Math.max(0, R.speed * t - R.wavelength * (R.rings + 1.5));     // calm water inside the rings

      // The water surface: soft circular bands of light that follow the rings,
      // so the drops ride on smooth water instead of floating on their own.
      if (R.sheen > 0 && !perf.lite) {
        const rgb = creamAt(rp.x, rp.y) ? COLOR.burgundyRGB : COLOR.creamRGB;
        const g = c.createRadialGradient(rp.x - ox, rp.y - oy, inner, rp.x - ox, rp.y - oy, size);
        const STEPS = 28;
        for (let s = 0; s <= STEPS; s++) {
          const wv = waterAt(inner + ((size - inner) * s) / STEPS, t, fade);
          const a = s === 0 || s === STEPS ? 0 : R.sheen * PATTERN.opacity * wv.light;  // clear at both edges
          g.addColorStop(s / STEPS, `rgba(${rgb}, ${a.toFixed(3)})`);
        }
        c.fillStyle = g;
        c.beginPath();
        c.arc(rp.x - ox, rp.y - oy, size, 0, Math.PI * 2);
        c.fill();
      }

      eachDropNear(rp.x, rp.y, size, (i, j, x, y) => {
        const dx = x - rp.x, dy = y - rp.y;
        const r = Math.hypot(dx, dy);
        if (r > size || r < inner) return;
        const wv = waterAt(r, t, fade);
        if (wv.light < 0.01 && Math.abs(wv.push) < 0.05) return;
        const d = touchDrop(i, j);
        const k = r > 0.5 ? wv.push / r : 0;
        d.px += dx * k;                                   // pushed outward by the wave
        d.py += dy * k;
        d.light = Math.max(d.light, wv.light);            // the stronger visibility wins
        d.swell = Math.max(d.swell, Math.max(0, wv.crest));
      });
    });

    // 3. Draw every drop once (cream on burgundy, burgundy on cream)
    const base = PATTERN.mark / DROP_UNITS;  // logo units → px
    drops.forEach((d, key) => {
      if (d.light < 0.01) { drops.delete(key); return; }
      const { x, y } = dropAt(d.i, d.j);
      const scale = base * (1 + R.swell * d.swell);  // swells on the crests
      c.strokeStyle = creamAt(x, y) ? COLOR.burgundy : COLOR.cream;
      c.globalAlpha = d.light * PATTERN.opacity;
      c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (x + d.px - ox), dpr * (y + d.py - oy));
      c.lineWidth = 1 / scale;  // keep the outline 1px thick at any size
      c.stroke(dropPath(dropAngle(d.i)));
    });
    c.globalAlpha = 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- Drawing loop: only runs while something is moving ----

  // Film grain: a small tile of noise in the page's own color, used as the
  // page background (it used to be a layer blended over the whole screen,
  // which made the browser redo the whole screen whenever anything moved).
  // Each pixel is the color made a touch lighter or darker.
  const grains = new Map();
  function grainFor(hex) {
    if (!grains.has(hex)) {
      const g = document.createElement('canvas');
      g.width = g.height = 160;
      const gc = g.getContext('2d');
      const img = gc.createImageData(160, 160);
      const rgb = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
      for (let p = 0; p < img.data.length; p += 4) {
        const n = (Math.random() + Math.random() + Math.random() - 1.5) * GRAIN;  // soft random, mostly small
        for (let c = 0; c < 3; c++) img.data[p + c] = rgb[c] + n * Math.min(rgb[c], 255 - rgb[c]);  // like the old overlay: none on pure dark/light
        img.data[p + 3] = 255;
      }
      gc.putImageData(img, 0, 0);
      grains.set(hex, `url(${g.toDataURL()})`);
    }
    return grains.get(hex);
  }

  let bigOn = true, patchOn = true, bodyColor = null;
  function draw(now) {
    // The page background: cream once the sweep is done (or on cream pages)
    const color = base === 'cream' || sweep >= 1 ? COLOR.cream : COLOR[base];
    if (color !== bodyColor && !Site.ownBackground) {
      document.body.style.backgroundColor = color;
      document.body.style.backgroundImage = GRAIN > 0 ? grainFor(color) : 'none';
      bodyColor = color;
    }

    // Big canvas: only while ripples play
    const rippling = ripples.length > 0;
    const big = rippling;
    if (big || bigOn) ctx.clearRect(0, 0, w, h);
    if (big) drawDrops(now, ctx, 0, 0);  // ripples, plus the mouse patch
    if (big !== bigOn) { canvas.style.visibility = big ? '' : 'hidden'; bigOn = big; }

    // Small canvas: the mouse patch on its own (when no ripples are playing)
    const small = !rippling && patternFade > 0;
    if (small) {
      const ox = Math.round(pointer.px - PATCH / 2), oy = Math.round(pointer.py - PATCH / 2);
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.clearRect(0, 0, patch.width, patch.height);
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDrops(now, pctx, ox, oy);
      patch.style.transform = `translate(${ox}px, ${oy}px)`;
    } else if (!rippling) {
      drops.clear();
    }
    if (small !== patchOn) { patch.style.visibility = small ? '' : 'hidden'; patchOn = small; }
  }

  // (The pattern and the ripples show even with "reduce motion" on: Angel's choice)
  const patternTarget = () => (pointer.active && hasMouse ? 1 : 0);
  const isMoving = () => ripples.length > 0 || patternMoved || patternFade !== patternTarget();

  function frame(now) {
    frameTick(now);
    const dt = Math.min(now - lastNow, 50) / 1000;
    lastNow = now;
    // Ease the mouse patch in or out
    const target = patternTarget();
    if (patternFade !== target) {
      const stepFade = dt / PATTERN.fadeTime;
      patternFade = target > patternFade ? Math.min(target, patternFade + stepFade) : Math.max(target, patternFade - stepFade);
    }
    patternMoved = false;
    draw(now);
    if (ripples.length || hadRipples) updateGlass();  // ripples moved: glass behind text may need to follow
    hadRipples = ripples.length > 0;
    if (isMoving()) requestAnimationFrame(frame);
    else running = false;  // nothing moving: stop until something changes
  }

  function wake() {
    if (running) return;
    running = true;
    lastNow = performance.now();
    requestAnimationFrame(frame);
  }

  // ---- Clicks: a drop lands on the nearest drop of the pattern ----
  // While the button is held, dragging lets more drops fall along the way.
  let pressed = false, lastX = null, lastY = null, lastDrop = 0;

  function addRipple(e) {
    const { x, y } = nearestDrop(e.clientX, e.clientY);
    if (x === lastX && y === lastY) return;                         // still on the same drop
    const now = performance.now();
    if (lastX !== null && now - lastDrop < RIPPLE.dragGap) return;  // dragging: not too many drops
    lastX = x;
    lastY = y;
    lastDrop = now;
    ripples.push({ x, y, start: now });
    if (ripples.length > (perf.lite ? QUALITY.liteRipples : RIPPLE.max)) ripples.shift();  // drop the oldest if there are too many
    Site.onRipple.forEach((fn) => fn(x, y, now));
    wake();
  }

  const makesRipple = (e) => !e.target.closest('a, button, .hero__logo');  // links make no ripple; the big logo makes its own

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || (e.pointerType === 'mouse' && e.button !== 0) || !makesRipple(e)) return;
    pressed = true;
    lastX = lastY = null;
    root.classList.add('is-drawing');           // no text highlighting while dragging
    addRipple(e);
  }, { passive: true });

  window.addEventListener('pointermove', (e) => { if (pressed) addRipple(e); }, { passive: true });

  // Touchscreens: only a tap makes a ripple, not a swipe (onTap, section 9)
  Site.onTap.push((e) => {
    if (!makesRipple(e)) return;
    lastX = lastY = null;
    addRipple(e);
  });

  const release = () => { pressed = false; root.classList.remove('is-drawing'); };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // Re-measure whenever the visible area changes size (window resize, or the
  // scrollbar appearing once the page gets its scroll length)
  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    // Redraw at the right resolution (called when switching to lighter mode)
    resize,
    // Start a ripple at (x, y), optionally later (start = a future time)
    addDrop(x, y, start = performance.now()) {
      ripples.push({ x, y, start });
      Site.onRipple.forEach((fn) => fn(x, y, start));
      if (ripples.length > (perf.lite ? QUALITY.liteRipples : RIPPLE.max)) ripples.shift();
      wake();
    },
    // The mouse patch moved or appeared/disappeared: redraw
    patternChanged() {
      patternMoved = true;
      wake();
    },
    // The circles the ripples currently cover (used to switch on the glass behind text)
    areas() {
      const now = performance.now();
      return ripples.map((rp) => ({ x: rp.x, y: rp.y, r: Math.min(RIPPLE.reach, RIPPLE.speed * (now - rp.start) / 1000) }));
    },
    // The page's base color: 'burgundy' (home) or 'cream' (about)
    setBase(color) {
      base = color;
      draw(performance.now());
    },
    // Called by the home timeline: how far the cream has swept in (0–1)
    setSweep(t) {
      if (t === sweep) return;
      sweep = t;
      placeSweep();                                   // just slides the picture
      if (sweep <= 0 || sweep >= 1 || ripples.length || patternFade > 0) draw(performance.now());  // page color / drop colors
    },
  };
})();

// =========================================================================
// 8. LINKS — water drop on clicked links, page transitions
// =========================================================================

// ---- Link clicks: a water drop on the clicked text ----

// The pieces inside a link (found once, then remembered on the link).
// A link whose text isn't split yet gets split the first time it's clicked.
function linkPieces(link) {
  if (!link.linkPieces) {
    const inside = [...link.querySelectorAll('.piece, .char')]
      .map((el) => pieceByEl.get(el))
      .filter(Boolean);
    if (inside.length) {
      link.linkPieces = inside;
    } else {
      splitLetters(link);
      link.linkPieces = [...link.querySelectorAll('.char')]
        .filter((c) => c.textContent.trim())
        .map((el) => makePiece(el, { tilt: 20, blur: 5 }));
    }
  }
  return link.linkPieces;
}

const linkAnims = [];   // link drops currently playing
let linkLoopOn = false;

// A drop on a link at (x, y). waitForGlide: for menu jumps, stay dissolved
// until the page has arrived. Returns how long the dissolve takes (ms).
function playLinkDrop(link, x, y, waitForGlide = false) {
  if (reduceMotion || !Site.linkDrops) return 0;
  const pieces = linkPieces(link);
  if (!pieces.length) return 0;
  // Measure where each letter is now, and how far the ring has to travel
  let reach = 0;
  const off = offsetFor(pieces[0]);  // pieces use page coordinates on scrolling pages (not in the top bar)
  y += off;
  pieces.forEach((pc) => {
    const r = pc.el.getBoundingClientRect();
    pc.cx = r.left + r.width / 2;
    pc.cy = r.top + r.height / 2 + off;
    pc.clickWater = pc.clickWater || { amount: 0, x: 0, y: 0, blur: 0, size: 1 };
    pc.inLink = true;  // (the home intro leaves letters alone while a link drop plays on them)
    reach = Math.max(reach, Math.hypot(pc.cx - x, pc.cy - y));
  });
  const outMs = ((reach + LINK_DRIP.band) / LINK_DRIP.speed) * 1000;
  // Clicked again while still playing: the new drop takes these letters over
  const mine = new Set(pieces);
  linkAnims.forEach((anim) => { anim.pieces = anim.pieces.filter((pc) => !mine.has(pc)); });
  linkAnims.push({ pieces, x, y, start: performance.now(), outMs, waitForGlide, backAt: null });
  background.addDrop(x, y - off);  // the background ripples from the same spot (screen coordinates)
  if (!linkLoopOn) { linkLoopOn = true; requestAnimationFrame(linkLoop); }
  return outMs;
}

function linkLoop(now) {
  for (let k = linkAnims.length - 1; k >= 0; k--) {
    const anim = linkAnims[k];
    const t = now - anim.start;

    // When does it form back? After the dissolve + pause, or, for a menu
    // jump, once the page has finished gliding there (+ the pause)
    if (anim.backAt === null && t >= anim.outMs && !(anim.waitForGlide && Site.isGliding())) {
      anim.backAt = now + LINK_DRIP.pause;
    }
    const back = anim.backAt === null ? -1 : now - anim.backAt;
    const done = back > anim.outMs;

    anim.pieces.forEach((pc) => {
      if (done) {
        pc.click = 0;
        pc.clickWater = null;
        pc.inLink = false;
      } else {
        const k2 = 0.4 + 0.6 * pc.hoverScale;  // small text: smaller push and blur
        const look = back < 0
          ? waterLook(pc, anim.x, anim.y, t / 1000, 'out', LINK_DRIP, k2, pc.clickWater)     // dissolving; then stays gone
          : waterLook(pc, anim.x, anim.y, back / 1000, 'in', LINK_DRIP, k2, pc.clickWater);  // forming back
        pc.click = look.amount;
        pc.clickIn = false;
      }
      renderPiece(pc);
    });
    if (done) linkAnims.splice(k, 1);
  }
  if (linkAnims.length) requestAnimationFrame(linkLoop);
  else linkLoopOn = false;
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  // Links that open something on the page itself (data-no-drop, like the
  // work rows, whose cards do the opening): no dissolve, nothing to follow
  if (link.hasAttribute('data-no-drop')) { if (href === '#') e.preventDefault(); return; }

  // Where the drop lands: where you clicked, or the link's middle when it was
  // opened with the keyboard (Enter)
  let x = e.clientX, y = e.clientY;
  if (e.detail === 0) {
    const r = link.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }

  if (Site.jump && Site.jump(href)) {
    // A scene on this page (the page glides there itself). The link stays
    // dissolved until you arrive, so things like the small logo don't flash
    // back while the page glides.
    e.preventDefault();
    playLinkDrop(link, x, y, true);
    return;
  }
  const outMs = playLinkDrop(link, x, y);

  const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank';
  if (link.dataset.transition && !reduceMotion && !newTab && !smallScreen) {  // (phones: no sweep, the page just opens)
    // Another page of this site: sweep its color across, then open it
    e.preventDefault();
    pageTransition(link.dataset.transition, link.href, outMs);
    return;
  }
  if (href === '#') {
    e.preventDefault();  // placeholder link: just the animation
  } else if (!href.startsWith('mailto:') && !newTab && outMs) {
    // Another page: let the text dissolve first, then open it
    e.preventDefault();
    setTimeout(() => { window.location.href = link.href; }, outMs);
  }
});


// Back button: a page restored from the browser's memory would still be
// covered by the sweep, so clear it
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  document.querySelectorAll('.page-sweep').forEach((cv) => cv.remove());
  leaving = false;
});

// ---- Page transitions ----
// A misty, wavy front of the next page's color sweeps from the top-left
// corner to the bottom-right one, over everything; then the next page opens.
// Drawn on its own small canvas on top of the page (made when needed).
// Already that color: no sweep, the page opens once the link has dissolved.
let leaving = false;  // a transition is already playing (a second click is ignored)

function pageTransition(color, href, outMs = 0) {
  if (leaving) return;
  leaving = true;
  if (Site.bg() === color) {
    setTimeout(() => { window.location.href = href; }, outMs);
    return;
  }
  const cv = document.createElement('canvas');
  cv.className = 'page-sweep';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  const k = 0.25;                     // drawn small and scaled up, like the home sweep (cheap blur)
  const w = window.innerWidth, h = window.innerHeight;
  const pad = TRANSITION.blur * 2;
  cv.width = Math.ceil((w + pad * 2) * k);
  cv.height = Math.ceil((h + pad * 2) * k);
  Object.assign(cv.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${w + pad * 2}px`, height: `${h + pad * 2}px` });
  const c = cv.getContext('2d');
  const D = Math.hypot(w, h);
  const u = { x: w / D, y: h / D };   // direction of travel: toward the bottom right
  const n = { x: -u.y, y: u.x };      // along the front
  const edge = TRANSITION.blur * 4;
  const start = performance.now();

  // Fill everything behind a wavy front at distance s from the top-left corner
  const front = (s, t) => {
    c.fillStyle = COLOR[color];
    c.beginPath();
    for (let v = -D; v <= D; v += 30) {
      const wave = Math.sin(v * 0.006 + t * 0.9) * 46 + Math.sin(v * 0.017 - t * 1.4) * 18;
      const x = u.x * (s + wave) + n.x * v;
      const y = u.y * (s + wave) + n.y * v;
      v === -D ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.lineTo(-u.x * edge * 3 + n.x * D, -u.y * edge * 3 + n.y * D);  // close it off past the corner
    c.lineTo(-u.x * edge * 3 - n.x * D, -u.y * edge * 3 - n.y * D);
    c.closePath();
    c.fill();
  };

  const step = (now) => {
    const p = clamp01((now - start) / TRANSITION.time);
    const t = (now - start) / 1000;
    const s = -edge + easeInOut(p) * (D + 2 * edge);  // the front
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, pad * k, pad * k);
    c.filter = `blur(${TRANSITION.blur * k}px)`;
    front(s, t);
    c.filter = 'none';
    if (p < 1) requestAnimationFrame(step);
    else window.location.href = href;   // fully covered: open the next page
  };
  requestAnimationFrame(step);
}

// =========================================================================
// 9. POINTER — hover loop, pattern patch, glass, mouse and taps
// =========================================================================

// ---- Hover loop: runs while the mouse is around or anything is still settling ----
let hoverOn = false;

function hoverFrame() {
  pointer.sx += (pointer.x - pointer.sx) * HOVER.follow;  // the trailing point catches up a little
  pointer.sy += (pointer.y - pointer.sy) * HOVER.follow;
  let busy = pointer.active;

  Site.hoverPieces.forEach((pc) => {
    const live = pc.hidden ? 0 : 1 - Math.max(pc.base, pc.click);  // pieces that are gone don't react
    const moving = updateHover(pc, live);
    if (moving || pc.hovering) renderPiece(pc);    // one last draw when it settles
    pc.hovering = moving;
    if (moving) busy = true;
  });

  Site.onHoverFrame.forEach((fn) => { if (fn()) busy = true; });  // the page's extras (e.g. bending lines)

  if (busy) requestAnimationFrame(hoverFrame);
  else hoverOn = false;
}

function wakeHover() {
  if (reduceMotion || hoverOn) return;
  hoverOn = true;
  requestAnimationFrame(hoverFrame);
}

// ---- The pattern patch that follows the mouse ----
// The patch's center (pointer.px/py) glides after the mouse; the canvas
// (section 7) draws the drops around it. Stops once it has caught up.
let patchMoving = false;

function followPattern() {
  pointer.px += (pointer.x - pointer.px) * 0.18;
  pointer.py += (pointer.y - pointer.py) * 0.18;
  background.patternChanged();
  updateGlass();
  if (Math.abs(pointer.x - pointer.px) + Math.abs(pointer.y - pointer.py) > 0.3) requestAnimationFrame(followPattern);
  else patchMoving = false;  // caught up: stop until the mouse moves again
}

// ---- Glass: switch on the blur behind text only where it's needed ----
// The frosted glass behind text (style.css, "Glass") is only useful where
// the drop pattern is behind the text: around the mouse and inside ripples.
// Blurring is expensive, so only text blocks overlapping those areas get the
// .glass class. Their boxes are measured once (in remeasure, section 10).
// Every word of the SMALLER text gets its own pane (words are made by the
// letter splitting in section 4), so only the area right behind the letters
// is blurred. Big titles (data-wind="letters") are readable enough without it,
// and so is the small logo (it's solid shapes, and stays sharp).
// (Blurring and glass are skipped entirely in lighter mode.)
const GLASS_SELECTOR = '[data-wind]:not([data-wind="letters"]) .word';  // (not the menu: it has one frosted pill, style.css section 5)
let glassHosts = [];  // found in Site.start(), once the page has split its text into words
function collectGlass() {
  glassHosts = [...document.querySelectorAll(GLASS_SELECTOR)]
    .map((el) => ({ el, scene: el.closest('.scene'), block: el.closest('.reveal'), fixed: !!el.closest('.site-header'), box: null, on: false }));
}
const GLASS_MARGIN = 10;  // switch on a little early, before the pattern reaches the text

function measureGlass() {
  glassHosts.forEach((g) => {
    const off = g.fixed ? 0 : Site.offsetY();  // page coordinates on scrolling pages (the top bar stays put)
    const r = g.el.getBoundingClientRect();
    g.box = { left: r.left, right: r.right, top: r.top + off, bottom: r.bottom + off };
  });
}

// Does a box overlap a circle?
function boxTouchesCircle(b, c, off) {
  const nx = Math.max(b.left - GLASS_MARGIN, Math.min(c.x, b.right + GLASS_MARGIN));
  const ny = Math.max(b.top - off - GLASS_MARGIN, Math.min(c.y, b.bottom - off + GLASS_MARGIN));
  return (nx - c.x) ** 2 + (ny - c.y) ** 2 < c.r * c.r;
}

function updateGlass() {
  if (perf.lite) return;  // no glass in lighter mode (setLite removes it)
  const areas = background.areas();
  if (pointer.active && hasMouse) areas.push({ x: pointer.px, y: pointer.py, r: PATTERN.radius });
  const off = Site.offsetY();
  glassHosts.forEach((g) => {
    if (!g.box) return;
    const visible = g.scene ? g.scene.lastVisibility !== 'hidden'
      : g.block ? g.block.classList.contains('is-in')  // about page: once its block has flowed in
      : !fold.on;                                      // the menu: not while the top bar is condensed
    const on = visible && areas.some((c) => boxTouchesCircle(g.box, c, g.fixed ? 0 : off));
    if (on !== g.on) { g.el.classList.toggle('glass', on); g.on = on; }
  });
}

// ---- Pointer events ----
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  if (!pointer.active) {
    // Mouse just arrived: start the trailing point and the pattern right here
    pointer.sx = pointer.px = e.clientX;
    pointer.sy = pointer.py = e.clientY;
  }
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
  Site.onPointer.forEach((fn) => fn());
  wakeHover();

  if (hasMouse && !patchMoving) { patchMoving = true; requestAnimationFrame(followPattern); }
}, { passive: true });

root.addEventListener('mouseleave', () => {
  pointer.active = false;
  wakeHover();  // let everything settle back
  background.patternChanged();  // fade the patch out
  updateGlass();
});

// Touchscreens: a tap scatters the pieces around that spot, then they settle
// back (and the background ripples, section 7). On phones (small screens)
// only the ripple plays: the letters stay put. Only real taps count, not
// swipes: the finger must lift close to where it went down, and a swipe that
// starts scrolling cancels the pointer anyway (reacting to every swipe made
// scrolling slower on phones).
let touchDown = null;  // where the finger went down
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') touchDown = { x: e.clientX, y: e.clientY };
}, { passive: true });
window.addEventListener('pointercancel', () => { touchDown = null; });
window.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch' || !touchDown) return;
  const moved = Math.hypot(e.clientX - touchDown.x, e.clientY - touchDown.y);
  touchDown = null;
  if (moved > 10) return;  // a swipe, not a tap
  Site.onTap.forEach((fn) => fn(e));
  if (smallScreen) return;  // phones: no scatter
  pointer.x = pointer.sx = e.clientX;
  pointer.y = pointer.sy = e.clientY;
  pointer.active = true;
  Site.onPointer.forEach((fn) => fn());
  wakeHover();
  clearTimeout(pointer.tap);
  pointer.tap = setTimeout(() => { pointer.active = false; }, 600);
}, { passive: true });

// On scrolling pages the glass has to follow the text as it scrolls
window.addEventListener('scroll', () => { if (glassReady && Site.scrolls) updateGlass(); }, { passive: true });

// =========================================================================
// 10. START-UP — measuring, lighter-mode switch, Site.start()
// =========================================================================

let glassReady = false;  // set once everything is measured

// Measure every piece in its resting place and redraw everything.
// Runs at start, when fonts finish loading, and after the window is resized.
function remeasure() {
  lastScrollY = window.scrollY;          // (the page may have been scrolled from code)
  measureLogo(headerPieces, false);    // small logo: left end arrives first
  measureOrder(navPieces);
  Site.onMeasure.forEach((fn) => fn());  // the page measures its own pieces
  measureLines();
  measureFold();
  measureGlass();
  measureBehind();                       // where the page content and the top bar are…
  checkBehindLogo();                     // …so: is anything behind the logo, menu or ring right now?
  syncTopColor();                        // the phone browser's top color
  Site.onRedraw.forEach((fn) => fn());   // the page redraws its pieces
  navPieces.forEach(renderPiece);        // the menu (it may be mid-intro)
  updateGlass();
}

// Switch lighter mode on (or off) while the page is open
function setLite(on) {
  perf.lite = on;
  root.classList.toggle('is-lite', on);
  applyLiteExtras();
  background.resize();                     // canvas resolution
  Site.onRedraw.forEach((fn) => fn());     // redraw everything without (or with) blur
  Site.hoverPieces.forEach(renderPiece);   // (includes the menu)
}

// The extras that are switched off as a whole in lighter mode
function applyLiteExtras() {
  Site.onLite.forEach((fn) => fn(perf.lite));  // e.g. the big logo's drop trails
  if (perf.lite) glassHosts.forEach((g) => { g.el.classList.remove('glass'); g.on = false; });
  else updateGlass();
}

// Resizing fires many events in a row: remeasure at most once per frame
// On phones, the address bar showing/hiding while you scroll changes the
// window height a little: that isn't a real resize, so it's ignored.
let resizeQueued = false;
let lastSize = { w: window.innerWidth, h: window.innerHeight };
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  if (!hasMouse && w === lastSize.w && Math.abs(h - lastSize.h) < 160) return;
  lastSize = { w, h };
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; remeasure(); });
});

// Called once by the page's own file, after it has registered everything
Site.start = () => {
  collectGlass();
  glassReady = true;
  applyLiteExtras();                     // in case the page starts in lighter mode
  document.fonts.ready.then(remeasure);  // letter widths change once fonts load
  remeasure();
  // Pages that open mid-transition start hidden (class="is-entering") so
  // nothing flashes before the first frame is drawn; show them now
  requestAnimationFrame(() => root.classList.remove('is-entering', 'is-arriving-cream'));
};
