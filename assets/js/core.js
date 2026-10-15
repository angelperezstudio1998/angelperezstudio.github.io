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
//   6. SITE ................ the hooks pages use, and the header (on every page)
//   7. BACKGROUND CANVAS ... base color, cream sweep, drop pattern, ripples
//   8. LINKS ............... water drop on clicked links, page transitions
//   9. POINTER ............. hover loop, pattern patch, glass, mouse/taps
//  10. START-UP ............ measuring, lighter-mode switch, Site.start()
//
// KEY IDEAS / WORDS USED IN THE COMMENTS
//   piece    : one thing that moves on its own: a letter (<span class="char">)
//              or one drop of a logo (<g class="piece">). Each piece is a small
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
  fade: 0.2,       // how much they fade (0 = not at all, 1 = fully)
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

// Going to another page (links with data-transition="cream" or "burgundy"):
// the clicked link gets its water drop, then a misty wavy front of the next
// page's background color sweeps across the screen from the top left to the
// bottom right, and the next page opens already in that color. If the screen
// is already that color, a band of the other color washes across first so you
// still see the wave pass.
const TRANSITION = {
  time: 1000,      // how long the sweep takes (ms)
  blur: 60,        // softness of the wavy edge (px)
  band: 260,       // width of the contrasting band when the colors match (px)
};

// Background pattern: outlines of single water drops from the logo, laid out
// like the logo repeated (right way up, flipped on its head, right way up…).
// Every drop is the same distance from its neighbors and faces the way it
// does in the logo. It shows in a soft patch around the mouse and in the
// click ripples. Both are drawn together on the canvas (section 7) from one
// set of drops, so a ripple moves the very drops you see around the mouse.
const PATTERN = {
  spacing: 28,     // distance between neighboring drops (px)
  mark: 14,        // height of each drop (px)
  opacity: 0.9,    // how visible the pattern is overall (0.9 = 10% see-through)
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
// Drops sit in rows; every other row is shifted by half a step, so each drop
// is the same distance from all six neighbors (a triangle grid). Rows are
// paired up: each pair is a row of triangles alternating "logo" (point up)
// and "logo flipped on its head" (point down). Each drop faces the way its
// spot faces in the logo. The CSS pattern in style.css follows the same rules.

const ROW = (PATTERN.spacing * Math.sqrt(3)) / 2;  // distance between rows
const GRID_X = PATTERN.spacing / 4;                 // where the grid starts on screen
const GRID_Y = ROW / 2;

// Screen position of drop (i, j): column i, row j
function dropAt(i, j) {
  return { x: GRID_X + i * PATTERN.spacing + mod(j, 2) * (PATTERN.spacing / 2), y: GRID_Y + j * ROW };
}

// Which way drop (i, j) faces, in degrees. The logo itself is turned 3.42°
// (that's how its drops sit), so the pattern follows that.
const LOGO_TURN = 3.42;
function dropAngle(i, j) {
  const pair = Math.floor(j / 2);
  const spot = mod(i - pair, 3);  // shifting each row pair by one makes the diagonals
  return mod(j, 2) === 0
    ? [120, 60, 180][spot] + LOGO_TURN    // top row: logo's top drop / flipped logo's top-left / top-right
    : [240, 300, 0][spot] + LOGO_TURN;    // bottom row: logo's bottom-right / flipped logo's bottom / logo's bottom-left
}

// The drop nearest to a point on screen (clicks land on it)
function nearestDrop(x, y) {
  const j = Math.round((y - GRID_Y) / ROW);
  const i = Math.round((x - GRID_X - mod(j, 2) * (PATTERN.spacing / 2)) / PATTERN.spacing);
  return dropAt(i, j);
}

// =========================================================================
// 4. TEXT → PIECES — splitting text into letters
// =========================================================================

// Split an element's text into one <span class="char"> per letter. Letters are
// grouped per word (<span class="word">), so lines still only break between
// words. Use this for plain text (the wordmark, titles, menu links).
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
    isDrop: el.classList.contains('piece'),     // a logo drop rather than a letter
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

// Logos: measured like text, plus the SVG scale for the drops.
// rightFirst: the right end goes first (the big logo blowing away).
function measureLogo(pieces, rightFirst) {
  measureOrder(pieces);
  pieces.forEach((pc) => {
    if (rightFirst) pc.order = 1 - pc.order;
    pc.scale = pc.svg ? pc.svg.getBoundingClientRect().width / 200 || 1 : 1;  // the SVG is 200 units wide
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
  const blur = (goneBlur + pc.h * HOVER.blur * k * pc.blurDamp) / pc.scale;
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
// 6. SITE — the hooks pages use, and the header (on every page)
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
  onLite: [],             // lighter mode was switched on or off
  jump: null,             // (hash) → true if this page handles a link to that #scene itself
  isGliding: () => false, // is an in-page jump still moving? (links stay dissolved until it stops)
  scrolls: false,         // true on normal scrolling pages (about); false on the fixed home stage
  offsetY: () => 0,       // 0 on fixed-screen pages; window.scrollY on normal scrolling pages
  bg: () => root.dataset.bg || 'burgundy',  // the background color right now ('burgundy' or 'cream')
  start: null,            // set in section 10
};

// A piece's scroll offset: pieces remember their place on the PAGE on
// scrolling pages, except those in the fixed top bar, which never move
const offsetFor = (pc) => (pc && pc.fixed ? 0 : Site.offsetY());

// ---- The header (small logo + menu), on every page ----
const headerLogo = document.querySelector('.site-header__logo');
document.querySelectorAll('.site-header__logo .wordmark').forEach(splitLetters);

// The drops and letters of a logo
function logoPieces(container, opts) {
  if (!container) return [];
  return [...container.querySelectorAll('.piece, .char')]
    .filter((el) => el.classList.contains('piece') || el.textContent.trim() !== '')
    .map((el) => makePiece(el, opts));
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
headerPieces.forEach((pc) => { pc.hoverDamp = HOVER.menu; });  // the small logo: gentle push too
Site.hoverPieces.push(...headerPieces, ...navPieces);

// =========================================================================
// 7. BACKGROUND CANVAS — base color, cream sweep, drop pattern, ripples
// =========================================================================
// Everything here lives inside this one block; the rest of the code talks to
// it through `background`: setBase(color), setSweep(t), addDrop(x, y),
// patternChanged(), areas() and resize().

const background = (() => {
  const canvas = document.querySelector('.bg');
  const ctx = canvas.getContext('2d');

  // The sweep is drawn and blurred on a small copy (¼ size), then scaled up.
  // Blurring a small image is ~16× cheaper and looks the same (the edge is soft anyway).
  const SWEEP_SCALE = 0.25;
  const sweepCanvas = document.createElement('canvas');
  const sctx = sweepCanvas.getContext('2d');
  const pad = SWEEP.blur * 2;  // extra room so the blur never fades at the screen edges

  let w = 0, h = 0, dpr = 1;   // canvas size (css px) and pixel density
  let time = 0;                // clock for the sweep's wavy edge (s)
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

    sweepCanvas.width = Math.ceil((w + pad * 2) * SWEEP_SCALE);
    sweepCanvas.height = Math.ceil((h + pad * 2) * SWEEP_SCALE);

    const D = Math.hypot(w, h);
    const u = { x: -w / D, y: -h / D };  // direction the sweep travels (to the top left)
    geo = { D, u, n: { x: -u.y, y: u.x } };
    draw(performance.now());
  }

  // ---- Cream sweep: a wavy, misty front from the bottom-right to the top-left ----

  const waveAt = (v) => Math.sin(v * 0.006 + time * 0.9) * 46 + Math.sin(v * 0.017 - time * 1.4) * 18;
  const frontAt = () => -SWEEP.edge + sweep * (geo.D + 2 * SWEEP.edge);

  function drawSweep() {
    if (sweep <= 0) return;
    if (sweep >= 1) {
      ctx.fillStyle = COLOR.cream;
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const { D, u, n } = geo;
    const edge = SWEEP.edge;
    const front = frontAt();
    const k = SWEEP_SCALE;

    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, sweepCanvas.width, sweepCanvas.height);
    sctx.setTransform(k, 0, 0, k, pad * k, pad * k);
    sctx.filter = `blur(${SWEEP.blur * k}px)`;  // soft, misty edge
    sctx.fillStyle = COLOR.cream;
    sctx.beginPath();
    for (let v = -D; v <= D; v += 30) {         // trace the wavy front...
      const s = front + waveAt(v);
      const x = w + u.x * s + n.x * v;
      const y = h + u.y * s + n.y * v;
      v === -D ? sctx.moveTo(x, y) : sctx.lineTo(x, y);
    }
    sctx.lineTo(w - u.x * edge * 3 + n.x * D, h - u.y * edge * 3 + n.y * D);  // ...and close it off past the corner
    sctx.lineTo(w - u.x * edge * 3 - n.x * D, h - u.y * edge * 3 - n.y * D);
    sctx.closePath();
    sctx.fill();
    sctx.filter = 'none';

    ctx.drawImage(sweepCanvas, -pad, -pad, w + pad * 2, h + pad * 2);
  }

  // Is this spot cream yet? (follows the same wavy front as drawSweep)
  function creamAt(px, py) {
    if (base === 'cream') return true;
    if (sweep <= 0) return false;
    if (sweep >= 1) return true;
    const { u, n } = geo;
    const v = (px - w) * n.x + (py - h) * n.y;
    const along = (px - w) * u.x + (py - h) * u.y;
    return along < frontAt() + waveAt(v);
  }

  // ---- The drop pattern + click ripples ----

  // One water drop from the logo (same shape as #drop in index.html), centered,
  // as a reusable outline. One version per direction it can face (cached).
  const DROP_UNITS = 86;  // how tall the drop is, in the logo's units
  const dropShape = new Path2D('M0,-48 C12,-30 30,-12 30,8 A30,30 0 1,1 -30,8 C-30,-12 -12,-30 0,-48 Z');
  const dropPaths = new Map();
  function dropPath(deg) {
    let path = dropPaths.get(deg);
    if (!path) {
      path = new Path2D();
      path.addPath(dropShape, new DOMMatrix().rotate(deg).translate(0, 5));
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

  // Calls fn(i, j, x, y) for every drop within `size` px of (cx, cy)
  function eachDropNear(cx, cy, size, fn) {
    const S = PATTERN.spacing;
    const j0 = Math.ceil((cy - size - GRID_Y) / ROW), j1 = Math.floor((cy + size - GRID_Y) / ROW);
    for (let j = j0; j <= j1; j++) {
      const shift = mod(j, 2) * (S / 2);
      const i0 = Math.ceil((cx - size - GRID_X - shift) / S), i1 = Math.floor((cx + size - GRID_X - shift) / S);
      for (let i = i0; i <= i1; i++) {
        const { x, y } = dropAt(i, j);
        fn(i, j, x, y);
      }
    }
  }

  function drawDrops(now) {
    const R = RIPPLE;
    ripples = ripples.filter((rp) => now - rp.start < R.duration);
    drops.forEach((d) => { d.light = 0; d.px = 0; d.py = 0; d.swell = 0; });

    // 1. The soft patch around the mouse: full strength in the middle,
    //    fading out toward its edge (like the old CSS circle)
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
        const g = ctx.createRadialGradient(rp.x, rp.y, inner, rp.x, rp.y, size);
        const STEPS = 28;
        for (let s = 0; s <= STEPS; s++) {
          const wv = waterAt(inner + ((size - inner) * s) / STEPS, t, fade);
          const a = s === 0 || s === STEPS ? 0 : R.sheen * PATTERN.opacity * wv.light;  // clear at both edges
          g.addColorStop(s / STEPS, `rgba(${rgb}, ${a.toFixed(3)})`);
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, size, 0, Math.PI * 2);
        ctx.fill();
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
      ctx.strokeStyle = creamAt(x, y) ? COLOR.burgundy : COLOR.cream;
      ctx.globalAlpha = d.light * PATTERN.opacity;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (x + d.px), dpr * (y + d.py));
      ctx.lineWidth = 1 / scale;  // keep the outline 1px thick at any size
      ctx.stroke(dropPath(dropAngle(d.i, d.j)));
    });
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- Drawing loop: only runs while something is moving ----

  function draw(now) {
    ctx.fillStyle = COLOR[base];
    ctx.fillRect(0, 0, w, h);
    drawSweep();
    drawDrops(now);
  }

  const patternTarget = () => (pointer.active && hasMouse && !reduceMotion ? 1 : 0);
  const isMoving = () => !reduceMotion &&
    ((sweep > 0 && sweep < 1) || ripples.length > 0 || patternMoved || patternFade !== patternTarget());

  function frame(now) {
    frameTick(now);
    const dt = Math.min(now - lastNow, 50) / 1000;
    time += dt;  // keeps the wave speed steady at any frame rate
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
    wake();
  }

  window.addEventListener('pointerdown', (e) => {
    if (reduceMotion || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('a, button, .hero__logo')) return;  // links make no ripple; the big logo makes its own
    pressed = true;
    lastX = lastY = null;
    root.classList.add('is-drawing');           // no text highlighting while dragging
    addRipple(e);
  }, { passive: true });

  window.addEventListener('pointermove', (e) => { if (pressed) addRipple(e); }, { passive: true });

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
      if (reduceMotion) return;
      ripples.push({ x, y, start });
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
      if (reduceMotion) draw(performance.now());
      else wake();
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
  if (reduceMotion) return 0;
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
  if (link.dataset.transition && !reduceMotion && !newTab) {
    // Another page of this site: sweep its color across, then open it
    e.preventDefault();
    pageTransition(link.dataset.transition, link.href);
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
let leaving = false;  // a transition is already playing (a second click is ignored)

function pageTransition(color, href) {
  if (leaving) return;
  leaving = true;
  const other = color === 'cream' ? 'burgundy' : 'cream';
  const same = Site.bg() === color;  // already that color: wash a band of the other color across first
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
  const band = same ? TRANSITION.band : 0;
  const start = performance.now();

  // Fill everything behind a wavy front at distance s from the top-left corner
  const front = (s, fill, t) => {
    c.fillStyle = COLOR[fill];
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
    const s = -edge + easeInOut(p) * (D + 2 * edge + band);  // the leading front
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, pad * k, pad * k);
    c.filter = `blur(${TRANSITION.blur * k}px)`;
    if (band) front(s, other, t);       // the contrasting band first...
    front(s - band, color, t);          // ...then the new page's color behind it
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
    const live = 1 - Math.max(pc.base, pc.click);  // pieces that are gone don't react
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
// is blurred. Big titles (data-wind="letters") are readable enough without it.
// (Blurring and glass are skipped entirely in lighter mode.)
const GLASS_SELECTOR = '[data-wind]:not([data-wind="letters"]) .word, .site-nav .word, .site-header__logo .word';
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
      : g.block ? g.block.classList.contains('is-in')                                   // about page: once its block has flowed in
      : !g.el.closest('.site-header__logo') || root.classList.contains('is-scrolled');  // the small logo only once it's in
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

// Touchscreens: a tap scatters the pieces around that spot, then they settle back
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
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
  measureLogo(headerPieces, false);    // small logo: left end arrives first
  measureOrder(navPieces);
  Site.onMeasure.forEach((fn) => fn());  // the page measures its own pieces
  measureGlass();
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
