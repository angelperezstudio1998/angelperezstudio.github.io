// =========================================================================
// Angel Studio — about.js (the about page only; core.js loads first)
// =========================================================================
//
// DEVELOPER NOTES
// ---------------
// Unlike the home page, the about page scrolls like a normal page. The text
// is split into letters by core.js's tools, and each block (class="reveal")
// flows in on the liquid wind the first time it comes into view, using the
// same burn front as everything else. Placeholder boxes (class="ph") fade in
// with their block (style.css, "About page"). On phones nothing animates:
// the text, boxes and top bar are simply there and links open right away.
//
//   1. SETTINGS ......... timing of the blocks flowing in
//   2. PIECES ........... the blocks and their letters
//   3. FLOWING IN ....... the header + the blocks, when they come into view
//   4. START-UP ......... hooking into core.js
//
// Hover, glass, water drops on links, ripples and the page transitions all
// come from core.js.
// =========================================================================

// =========================================================================
// 1. SETTINGS
// =========================================================================

const ABOUT = {
  flowTime: 1100,  // how long a block takes to flow in (ms)
  firstDelay: 120, // wait after the page opens before the first blocks flow in (ms)
  stagger: 140,    // blocks that come into view together flow in this far apart (ms)
  showAt: 0.15,    // how much of a block must be on screen before it flows in (0.15 = 15%)
};

// =========================================================================
// 2. PIECES
// =========================================================================

// The page's own coordinates: pieces remember where they rest on the PAGE,
// so the hover still finds them after scrolling (core.js adds the scroll)
Site.scrolls = true;
Site.offsetY = () => window.scrollY;
Site.bg = () => 'cream';

// Each block = its element + the letters inside it
const blocks = [...document.querySelectorAll('.reveal')].map((el) => ({
  el,
  pieces: windPieces(el),
  p: 0,            // 0 = not in yet, 1 = fully in
  started: false,
}));

const aboutPieces = blocks.flatMap((b) => b.pieces);
tuneSmallText(aboutPieces);  // labels and the footer react gently, like the menu
// The big text (name, services, "Let's work together"): normal movement, lighter blur
aboutPieces.filter((pc) => pc.el.closest('[data-wind="letters"]')).forEach((pc) => { pc.blurDamp = HOVER.titleBlur; });
Site.hoverPieces.push(...aboutPieces);

// The small logo and the menu flow in too, like a block of their own
const headerBlock = { pieces: [...headerPieces, ...navPieces], p: 0, started: false, el: null };

// =========================================================================
// 3. FLOWING IN
// =========================================================================

// Draw a block at its current progress (left end / top first, from the bottom right)
function renderBlock(b) {
  b.pieces.forEach((pc) => place(pc, 1 - pieceProgress(b.p, pc.order), true));
}

function flowIn(b, delay = 0) {
  if (b.started) return;
  b.started = true;
  if (b.el) b.el.classList.add('is-in');  // placeholder boxes fade in (CSS); the glass may switch on
  // Phones: everything is simply there, nothing flows in
  if (reduceMotion || smallScreen) { b.p = 1; renderBlock(b); updateGlass(); return; }
  const start = performance.now() + delay;
  const step = (now) => {
    b.p = clamp01((now - start) / ABOUT.flowTime);
    renderBlock(b);
    if (b.p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(updateGlass, delay);
}

// Blocks flow in the first time they come into view (or once you've
// scrolled past them, if you scrolled very fast). Blocks that appear
// together go one after another, top to bottom.
let blocksReady = false;  // set once the page has opened (the first wave is timed after the header)

function checkBlocks(delay = 0) {
  if (!blocksReady) return;
  const line = window.innerHeight * (1 - ABOUT.showAt);  // a block's top must pass this line
  let n = 0;
  blocks.forEach((b) => {   // (blocks are in page order, top to bottom)
    if (b.started) return;
    const r = b.el.getBoundingClientRect();
    if (r.top > line && r.bottom > window.innerHeight) return;  // not far enough in (short blocks at the very end count once fully shown)
    flowIn(b, delay + n * ABOUT.stagger);
    n++;
  });
}
window.addEventListener('scroll', () => checkBlocks(), { passive: true });

// "About" in the menu and "Back to top": glide to the top of this page
let gliding = false;
Site.jump = (hash) => {
  if (hash !== '#top') return false;
  gliding = true;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  return true;
};
Site.isGliding = () => {
  if (gliding && window.scrollY <= 1) gliding = false;  // arrived
  return gliding;
};
['wheel', 'touchstart', 'keydown'].forEach((type) =>
  window.addEventListener(type, () => { gliding = false; }, { passive: true }));

// =========================================================================
// 4. START-UP
// =========================================================================

Site.onMeasure.push(() => {
  blocks.forEach((b) => measureOrder(b.pieces));  // each block has its own left → right order
  measureOrder(headerBlock.pieces);
});
Site.onRedraw.push(() => {
  blocks.forEach(renderBlock);
  renderBlock(headerBlock);
  checkBlocks();  // after a resize or fonts loading, more blocks may be in view
});

// A refresh starts at the top, like the home page
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo({ top: 0, behavior: 'instant' });

Site.start();  // measures and draws everything hidden (p = 0)

// Then: the header flows in, and the blocks already on screen follow it
flowIn(headerBlock, ABOUT.firstDelay);
blocksReady = true;
if (smallScreen) blocks.forEach((b) => flowIn(b));  // phones: everything is there from the start
checkBlocks(ABOUT.firstDelay + ABOUT.stagger);
