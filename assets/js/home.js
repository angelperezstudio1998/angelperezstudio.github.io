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
// PHONES (screens narrower than PHONE.width) get a calm, simple version: the
// page scrolls normally, top to bottom. The only animations are the logo
// forming out of a water drop when the page first opens, the menu turning
// into the ring (core.js) and the ripples when you tap; everything else is
// simply there. The page is
// burgundy behind the logo and cream from the work list down (section 8). The class "is-phone"
// on <html> is set in index.html before the page shows, so the CSS knows too.
//
//   1. SETTINGS ......... timeline, big logo, menu jumps, clock
//   2. PIECES ........... the clock, the scenes' text, divider lines, arrows
//   3. THE BIG LOGO ..... scroll, hover, resting motion, water drop, intro
//   4. TIMELINE ......... what each scroll position looks like
//   5. SCROLL + MENU .... smooth scroll feel, menu jumps
//   6. HOVER EXTRAS ..... work-list arrows (the bending lines are in core.js)
//   7. START-UP ......... hooking into core.js, the intro, the clock
//   8. PHONES ........... the simpler scrolling version for small screens
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
  sway: 3,         // how far each drop moves (logo units; the three drops together are 125 wide)
  tilt: 5,         // how much each drop rocks (degrees)
  breathe: 0.025,  // how much each drop swells and shrinks (0.025 = 2.5%)
  speed: 1,        // overall tempo (bigger = faster)
  // Liquid feel: drops stretch in the direction they're moving, squeeze
  // a little sideways, and their shape slowly wobbles
  stretch: 0.07,   // stretch when moving fastest (0.07 = 7% longer)
  wobble: 0.025,   // slow wobble of the shape (0.025 = 2.5%)
  // A soft blur on the side each drop is moving toward, so it blurs in and out
  trailBlur: 1,    // softness of that blur (logo units)
  trailReach: 0.56, // how far ahead of the drop it reaches when moving fastest (logo units)
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

// Phones: the calm, normally scrolling version (section 8)
const PHONE = {
  width: 700,      // screens narrower than this (px) get it; keep the same as in index.html and core.js
};
const isPhone = root.classList.contains('is-phone');
// (phone state, used in section 8)
let creamLine = 0;           // page height where burgundy turns cream (the top of the work list)
let phoneGlideTo = null;     // where a menu jump is scrolling to (null = not jumping)

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

const scenePieces = windPieces;  // (core.js)

const heroLogoPieces = logoPieces(heroLogo, { tilt: 60, blur: 8 });

// ---- The logo's shadow on the water ----
// The logo casts its shadow on the background (style.css). When
// a ripple passes under it, the shadow wobbles like a shadow on water: how
// much follows the waves where the shadow is, swaying back and forth.
const SHADOW_WATER = {
  warp: 70,        // how far the shadow bends on the highest waves (logo units)
  sway: 7,         // how fast it sways back and forth (per second)
};
const heroShadow = heroLogo.querySelector('.hero__shadow');
const shadowWarp = heroShadow.querySelector('feDisplacementMap');
let shadowLoop = false, shadowLast = 0, shadowScale = '0';
function shadowFrame(now) {
  // (the water filter is costly to redraw: at most ~25 times a second, and
  // only when the bend changes by a visible amount)
  if (now - shadowLast < 40) { requestAnimationFrame(shadowFrame); return; }
  shadowLast = now;
  const r = heroShadow.getBoundingClientRect();
  let a = 0;
  if (r.bottom > 0 && r.top < window.innerHeight) {
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {   // (waves under a few spots of the shadow)
      a = Math.max(a, background.waterAt(r.left + (r.width * i) / 4, r.top + (r.height * j) / 2));
    }
  }
  const wet = a > 0.02 && !perf.lite;
  heroShadow.classList.toggle('is-wet', wet);
  const scale = wet ? String(Math.round((SHADOW_WATER.warp * a * Math.sin((now / 1000) * SHADOW_WATER.sway)) / 3) * 3) : '0';
  if (scale !== shadowScale) { shadowWarp.setAttribute('scale', scale); shadowScale = scale; }
  if (background.rippling()) requestAnimationFrame(shadowFrame);
  else { shadowLoop = false; heroShadow.classList.remove('is-wet'); }
}
const watchShadow = () => { if (!shadowLoop) { shadowLoop = true; requestAnimationFrame(shadowFrame); } };
['pointerdown', 'pointerup'].forEach((type) => window.addEventListener(type, () => setTimeout(watchShadow, 0), { passive: true }));
const heroTextPieces = scenePieces(heroScene);
const workPieces = scenePieces(workScene);
const contactPieces = scenePieces(contactScene);

// The divider lines: the work list's and the footer's, each one bending line
// (core.js, "Lines"). They only bend while their scene is on screen, and are
// carried by the same wind as the text on scroll (the timeline, section 4).
const sceneLive = (scene) => () => scene.lastVisibility !== 'hidden';  // (the line's own element isn't needed)
const workLines = makeLines('.section-head, .work-item', 'bottom', sceneLive(workScene));
const contactLines = makeLines('.scene--contact .contact__bottom', 'top', sceneLive(contactScene));

// Project cards (one per project in each work row; style.css, "Project cards").
// Each card learns its number (--k: they rise one after another, left to right).
const workList = document.querySelector('.work-list');
const workRows = [...workList.children].filter((li) => li.querySelector('.work-cards'));
workRows.forEach((li) => li.querySelectorAll('.work-card').forEach((card, k) => card.style.setProperty('--k', k)));
let closeCards = () => {};  // (bigger screens: puts the open row's cards away; used by the popup)

if (smallScreen) {
  // Phones: tapping a row opens its cards as a strip under it (and closes the others)
  workRows.forEach((li) => {
    const row = li.querySelector('.work-item');
    row.setAttribute('aria-expanded', 'false');
    row.addEventListener('click', () => {
      const open = !li.classList.contains('is-open');
      workRows.forEach((other) => {
        other.classList.toggle('is-open', other === li && open);
        other.querySelector('.work-item').setAttribute('aria-expanded', String(other === li && open));
      });
      remeasure();  // the rows below moved: lines, frost checks and the color edge measure again
    });
  });
} else {
  // Bigger screens: hovering (or focusing) a row brings its cards up from
  // behind its bottom line, next to the title. Where they reach over the
  // lines above, those lines fade out near them.
  let activeRow = null;

  const showCards = (row) => {
    if (row === activeRow) return;
    if (activeRow) { activeRow.classList.remove('is-active'); cutLines(activeRow, null); }
    activeRow = row;
    if (row) { row.classList.add('is-active'); cutLines(row, -1); }
  };
  closeCards = () => showCards(null);

  // Fade the lines above a row where its cards cross them: where the small
  // cards reach over a line (all of them), and where the big card k does
  // (-1: none big; null: the row is closing, so no cuts at all). While cut,
  // the faded stretch slides along with the big card (style.css, ".line").
  function cutLines(row, k) {
    const g = row.geom;
    if (!g) return;
    const w = g.small * g.ratio;
    g.lines.forEach(({ svg, y, dx }) => {
      let l = Infinity, r = -Infinity;
      if (k !== null && y > -g.small - 2) {
        l = g.from;
        r = g.from + g.n * w + (g.n - 1) * g.gap + (k >= 0 ? w * (g.grow - 1) : 0);
      }
      if (k !== null && k >= 0 && y > -g.small * g.grow - 2) {
        const x = g.from + k * (w + g.gap);
        l = Math.min(l, x);
        r = Math.max(r, x + w * g.grow);
      }
      if (l === Infinity) {
        svg.classList.remove('is-cut');
        setTimeout(() => { if (!svg.classList.contains('is-cut')) svg.classList.remove('has-cut'); }, 500);  // (once it has faded back)
        return;
      }
      svg.style.setProperty('--cut-l', `${Math.round(l + dx - 20)}px`);  // (a little room either side)
      svg.style.setProperty('--cut-r', `${Math.round(r + dx + 20)}px`);
      if (svg.classList.contains('is-cut')) return;
      svg.classList.add('has-cut');
      requestAnimationFrame(() => { if (row === activeRow) svg.classList.add('is-cut'); });  // (one frame later, so it fades)
    });
  }

  // A card is big while the mouse is on it, or while it has keyboard focus
  // (style.css matches: :hover / :focus-visible)
  workRows.forEach((li) => {
    li.addEventListener('pointerenter', () => showCards(li));
    li.addEventListener('focusin', () => showCards(li));
    li.querySelectorAll('.work-card').forEach((card, k) => {
      const grow = () => { if (li === activeRow) cutLines(li, k); };
      const shrink = () => { if (li === activeRow) cutLines(li, -1); };
      card.addEventListener('pointerenter', grow);
      card.addEventListener('pointerleave', shrink);
      card.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) grow(); });
      card.addEventListener('focusout', shrink);
    });
  });
  workList.addEventListener('pointerleave', () => { if (!projectPopup.open) showCards(null); });
  workList.addEventListener('focusout', (e) => { if (!workList.contains(e.relatedTarget) && !projectPopup.open) showCards(null); });

  // Where each row's cards go and how big they are: they start after the
  // longest title they could reach over (plus its hover nudge) and fill the
  // row to its end with one card grown (--grow). Then: the lines above that
  // they may cross, for cutLines(). Positions come from the layout (inside
  // the work section), so the wind moving things while the section is off
  // screen doesn't throw them off.
  const workHead = workScene.querySelector('.section-head');
  const px = (css, name) => parseFloat(css.getPropertyValue(name)) || 0;
  const at = (el) => {
    let x = 0, y = 0;
    for (let e = el; e && e !== workScene; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x, b: y + el.offsetHeight };
  };
  const titleEnd = (li) => { const t = li.querySelector('.work-item__title'); return t.offsetLeft + t.offsetWidth; };
  Site.onMeasure.unshift(() => {
    showCards(null);
    workRows.forEach((li, i) => {
      const list = li.querySelector('.work-cards');
      const css = getComputedStyle(list);
      const air = px(css, '--air'), gap = px(css, '--gap'), grow = px(css, '--grow') || 1;
      const ratio = px(css, '--ratio') || 1, most = px(css, '--most');
      const n = list.children.length;
      const box = at(li);
      const base = box.b - air;                         // the cards' bottom
      const above = workRows.slice(0, i);
      const reached = above.filter((r) => at(r).b > base - most * grow);  // rows a big card may reach over
      const from = Math.max(...[li, ...reached].map(titleEnd)) + 16 + 20;  // (16: the title's hover nudge)
      const small = Math.max(24, Math.floor(Math.min(most, (li.offsetWidth - from - (n - 1) * gap) / (ratio * (n - 1 + grow)))));
      list.style.setProperty('--from', `${from}px`);
      list.style.setProperty('--small', `${small}px`);
      li.geom = {
        from, small, ratio, gap, grow, n,
        // each line above: its height from the cards' bottom (y) and where it starts (dx)
        lines: lines.filter((ln) => ln.host === workHead || above.some((r) => r.contains(ln.host)))
          .map((ln) => { const h = at(ln.host); return { svg: ln.svg, y: h.b - base, dx: box.x - h.x }; }),
      };
    });
  });
}

// ---- The project view: clicking a card opens its project page ----
// Almost like a page of its own: it fades in over the whole screen with the
// project centered (style.css, "The project view"). The arrows (or the ← →
// keys) step to the previous / next project of its category and the list of
// their names on the left jumps to any of them, so you never have to go back first. Filled in from the cards: their row, name and quick line, and
// their page (a <template class="work-card__page"> after the card's button;
// without one, a placeholder).
// Each project has its own address (?p=poster-01: the name in lowercase with
// dashes, or the card's data-id), so it can be shared and the browser's back
// button closes it. The ×, Esc and the back button all close it (it fades out).
const projectPopup = document.querySelector('.project');
const popupList = projectPopup.querySelector('.project__list');
const popupPrev = projectPopup.querySelector('.project__step--prev');
const popupNext = projectPopup.querySelector('.project__step--next');
const popupInner = projectPopup.querySelector('.project__inner');
const popupBody = projectPopup.querySelector('.project__body');
const popupAbout = projectPopup.querySelector('.project__about');
const POPUP_CLOSE_MS = 450;  // = --fade-time in style.css
const POPUP_SWITCH_MS = 250; // = .project__inner's fade in style.css
let popupCard = null;        // the card whose project is showing
let popupButton = null, popupByPointer = false;  // the card's button that opened it, and whether by mouse/touch
let popupPushed = false;     // whether opening it added a step to the browser's history (then closing goes back)
let popupClosing = 0;        // (the timer while it draws back)

const projectId = (card) => card.dataset.id
  || card.querySelector('.work-card__name').textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const allCards = [...document.querySelectorAll('.work-card')];

// While it's open the page behind never scrolls (the home page's scroll plays
// its animation): .is-locked stops the page itself (style.css), this stops
// the wheel and touch outside its scrolling parts too (phones don't always
// obey the lock). Only listening while it's open keeps scrolling smooth the
// rest of the time.
const keepScrollInPopup = (e) => {
  if (!e.target.closest || !e.target.closest('.project__inner, .project__list')) e.preventDefault();
};

// Show this card's project in the view (its text and page, and its category's
// column, with it marked)
function fillProject(card) {
  const name = card.querySelector('.work-card__name').textContent;
  const page = card.querySelector('.work-card__page');
  const list = card.parentElement;
  const k = [...list.children].indexOf(card);
  popupPrev.hidden = k === 0;                          // (no previous for the first,
  popupNext.hidden = k === list.children.length - 1;   //  no next for the last)
  projectPopup.querySelector('.project__kind').textContent = list.getAttribute('aria-label').replace(/ projects$/, '');  // its row ("Posters projects" → Posters)
  projectPopup.querySelector('.project__title').textContent = name;
  projectPopup.querySelector('.project__lead').textContent = card.querySelector('.work-card__desc').textContent.replace(name, '').trim();
  // Its page: the paragraphs go on the right, everything else (images) on the left
  const content = page ? [...page.content.cloneNode(true).children] : [
    Object.assign(document.createElement('div'), { className: 'ph project__image', innerHTML: '<span class="label">Project images</span>' }),
    ...['The brief', 'The idea', 'How it was made'].map((t) => Object.assign(document.createElement('p'), { textContent: `${t}: a few sentences about the project.` })),
  ];
  // (phones: one column, so everything stays in the order written)
  const toRight = (el) => !smallScreen && el.tagName === 'P';
  popupBody.replaceChildren(...content.filter((el) => !toRight(el)));
  popupAbout.replaceChildren(...content.filter(toRight));
  popupInner.scrollTop = 0;
  fadeParagraphs();
  if (popupList.dataset.list !== list.className) {  // (a different category: build its column)
    popupList.dataset.list = list.className;
    popupList.replaceChildren(...[...list.children].map((other) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'project__item';
      item.textContent = other.querySelector('.work-card__name').textContent;
      item.card = other;
      item.addEventListener('click', () => switchProject(other));
      return item;
    }));
  }
  popupList.querySelectorAll('.project__item').forEach((item) => {
    item.setAttribute('aria-current', String(item.card === card));
    if (item.card === card) item.scrollIntoView({ block: 'nearest', inline: 'nearest' });  // (keep it in view in the list)
  });
  // Its color (data-color on the card, e.g. data-color="#1d3557"; burgundy without one)
  if (card.dataset.color) root.style.setProperty('--project-color', card.dataset.color);
  else root.style.removeProperty('--project-color');
  popupCard = card;
}

// The paragraphs on the right fade with the scroll: fully there around the
// middle of the view, gone by the time they reach its top or bottom edge
let fadeQueued = false;
function fadeParagraphs() {
  fadeQueued = false;
  const box = popupInner.getBoundingClientRect();
  const mid = box.top + box.height / 2, reach = box.height * 0.45;
  popupAbout.querySelectorAll('p').forEach((p) => {
    const r = p.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - mid);
    p.style.opacity = String(round2(Math.max(0, Math.min(1, 1.6 - (d / reach) * 1.6))));
  });
}
const queueFade = () => { if (!fadeQueued) { fadeQueued = true; requestAnimationFrame(fadeParagraphs); } };
popupInner.addEventListener('scroll', queueFade, { passive: true });
window.addEventListener('resize', () => { if (projectPopup.open) queueFade(); });

// byPointer: opened with the mouse or a tap; push: add a step to the browser's history
function openProject(card, { byPointer = false, push = true } = {}) {
  clearTimeout(popupClosing);
  fillProject(card);
  popupButton = card.querySelector('.work-card__open');
  popupByPointer = byPointer;
  if (push) history.pushState({ project: projectId(card) }, '', `?p=${projectId(card)}`);
  popupPushed = push;
  root.classList.add('is-locked');
  window.addEventListener('wheel', keepScrollInPopup, { passive: false });
  window.addEventListener('touchmove', keepScrollInPopup, { passive: false });
  if (!projectPopup.open) {
    projectPopup.classList.remove('is-shown');
    projectPopup.showModal();
    popupInner.focus({ preventScroll: true });  // (so the arrow keys scroll the project)
    getComputedStyle(projectPopup).opacity;     // (start from invisible, so it fades in)
  }
  projectPopup.classList.add('is-shown');
  queueFade();  // (now that it's on screen and can be measured)
}

// Another project of the same category, from the column: the content fades
// over to it; the address changes without adding a step (back still closes)
function switchProject(card) {
  if (card === popupCard) return;
  history.replaceState({ project: projectId(card) }, '', `?p=${projectId(card)}`);
  popupInner.classList.add('is-switching');
  setTimeout(() => {
    fillProject(card);
    popupButton = card.querySelector('.work-card__open');
    popupInner.classList.remove('is-switching');
  }, POPUP_SWITCH_MS);
}

// Fade it out, then close
function hideProject() {
  if (!projectPopup.open || !projectPopup.classList.contains('is-shown')) return;
  projectPopup.classList.remove('is-shown');
  popupClosing = setTimeout(() => projectPopup.close(), POPUP_CLOSE_MS);
}
// The ×, Esc: back through the browser's history if opening added a step
// (that then hides it, below), otherwise just clean the address and hide it
function closeProject() {
  if (popupPushed && history.state && history.state.project) { history.back(); return; }
  history.replaceState(null, '', location.pathname);
  hideProject();
}
window.addEventListener('popstate', () => {
  const id = history.state && history.state.project;
  if (!id) { popupPushed = false; hideProject(); return; }
  const card = allCards.find((c) => projectId(c) === id);  // (forward again to a project)
  if (card) { openProject(card, { push: false }); popupPushed = true; }  // (there's a step to go back to)
});

allCards.forEach((card) => card.querySelector('.work-card__open').addEventListener('click', (e) =>
  openProject(card, { byPointer: e.detail > 0 })));  // (detail 0: Enter or Space)
projectPopup.querySelector('.project__close').addEventListener('click', closeProject);
// Previous / next in the category (the arrows, or ← → when not typing)
const stepProject = (by) => {
  const list = popupCard && popupCard.parentElement;
  const next = list && list.children[[...list.children].indexOf(popupCard) + by];
  if (next) switchProject(next);
};
popupPrev.addEventListener('click', () => stepProject(-1));
popupNext.addEventListener('click', () => stepProject(1));
projectPopup.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') stepProject(-1);
  else if (e.key === 'ArrowRight') stepProject(1);
});
projectPopup.addEventListener('cancel', (e) => { e.preventDefault(); closeProject(); });  // Esc
projectPopup.addEventListener('close', () => {
  projectPopup.classList.remove('is-shown');
  root.classList.remove('is-locked');
  window.removeEventListener('wheel', keepScrollInPopup);
  window.removeEventListener('touchmove', keepScrollInPopup);
  // The browser hands focus back to the card's button. Opened with the mouse
  // or a tap, let it go, or the card would stay big (focus counts as "on it")
  // and its row open even after the mouse leaves.
  if (popupByPointer) popupButton.blur();
  if (!popupButton.closest('.work-list > li').matches(':hover')) closeCards();  // (the mouse may have left the row meanwhile)
  popupCard = popupButton = null;
});

// Opened with a project's address (?p=…): show it straight away
const linkedProject = new URLSearchParams(location.search).get('p');
if (linkedProject) {
  const card = allCards.find((c) => projectId(c) === linkedProject);
  if (card) requestAnimationFrame(() => openProject(card, { push: false }));
  else history.replaceState(null, '', location.pathname);
}

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
  const off = Site.offsetY();  // the logo's pieces use page coordinates on phones
  // How far the ring has to travel to cross the whole logo
  const reach = Math.max(...heroLogoPieces.map((pc) => Math.hypot(pc.cx - x, pc.cy - y - off))) + DRIP.band;
  hero.drip = { mode, x, y: y + off, start, reach, done: false };
  background.addDrop(x, y, start);  // the background ripples from the same spot
  watchShadow();                     // (its shadow on the water reacts too)
  wakeHero();
}

// Called every frame by the logo's loop: what happens when a drop finishes
function checkDrip(now) {
  const d = hero.drip;
  if (!d || now < d.start + (d.reach / DRIP.speed) * 1000) return;  // still playing
  if (d.mode === 'in') {
    hero.drip = null;                 // logo has formed
    if (d.intro && !isPhone) startIntroText(now);  // now the menu and other text flow in
    return;
  }
  // 'out': the logo has dissolved
  if (!d.done) {
    d.done = true;
    goTo('#work', true);              // glide to the work list
  } else if (hero.progress >= 1) {
    hero.drip = null;                 // arrived: scrolling back up brings the logo back on the wind
  } else if (!Site.isGliding()) {
    // The glide was stopped before the logo scrolled away (or, on phones,
    // the page has arrived at the work list): let it form again
    startDrip('in', d.x, d.y - Site.offsetY(), now);
  }
}

// ---- Drop trails: a soft blur on the side each drop is moving toward ----
// Each drop gets a tiny SVG filter: a blurred, shifted, faint copy of itself
// behind the sharp drop. Only the shift and softness change each frame.
const dropDefs = document.querySelector('svg defs');
heroLogoPieces.filter((pc) => pc.isDrop).forEach((pc, k) => {
  const shape = pc.el.querySelector('path');  // the filter goes on the shape; its group moves (core.js)
  if (!shape || !dropDefs) return;

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
  shape.setAttribute('filter', `url(#${filter.id})`);
  pc.trail = {
    id: filter.id,
    blur: filter.querySelector('feGaussianBlur'),
    offset: filter.querySelector('feOffset'),
    last: '',
  };
});

function updateDropTrail(pc, vx, vy, speed) {
  if (!pc.trail || perf.lite) return;
  const k = FLOW.trailReach / (FLOW.sway * 0.7);
  const dx = vx * k;
  const dy = vy * k;
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
    if (pc.isDrop && !reduceMotion && !isPhone) {  // (phones: the logo rests still)
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
  const away = hero.progress >= 1 || isPhone;  // blown away (phones: the logo only moves during its water drop)
  if (!away || hero.drip) requestAnimationFrame(heroFrame);
  else hero.running = false;  // logo is gone: nothing to animate
}

// ---- Clicking the logo: it dissolves like a drop fell on it, then the page goes to the work list ----
function dripLogo(x, y) {
  if (reduceMotion) { goTo('#work', false); return; }
  if (isPhone) { goTo('#work', true); return; }  // phones: no dissolve, just scroll to the work list
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
  // (phones: only the logo animates; the menu and corner text are simply there)
  if (!isPhone) introPieces().forEach((pc) => { pc.click = 1; pc.clickIn = true; pc.clickWater = null; renderPiece(pc); });
  // The drop falls on the middle of the mark (the three drops)
  const mark = heroLogo.querySelector('.logo-mark').getBoundingClientRect();
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
    windLines(workLines, pWorkIn, pWorkOut);
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
    windLines(contactLines, pContact);
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
  if (isPhone) { phoneGoTo(hash, smooth); return; }
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
// 6. HOVER EXTRAS — work-list arrows
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

if (isPhone) startPhone();  // phones: hooks of their own (section 8), instead of the timeline below
else {
Site.onMeasure.push(() => {
  screenH = window.innerHeight;
  scrollSpace.style.height = `${(TIMELINE.end + 1) * screenH}px`;  // page length for the scroll
  [heroScene, workScene, contactScene].forEach((s) => { s.style.visibility = ''; s.lastVisibility = ''; });
  measureLogo(heroLogoPieces, true);   // big logo: right end goes first
  [heroTextPieces, workPieces, contactPieces, arrowPieces].forEach(measureOrder);
  heroLogoPieces.forEach((pc) => { pc.hoverScale = 1; });  // the big logo gets the full hover
});
Site.onRedraw.push(() => {
  lastProgress.clear();  // positions (or lighter mode) changed: every group must redraw
  update(smoothY);
});
window.addEventListener('scroll', startTick, { passive: true });
}
Site.onHoverFrame.push(arrowsFrame);  // (the lines bend by themselves, core.js)
Site.onPointer.push(() => { if (hero.progress < 1) wakeHero(); });
Site.onLite.push((lite) => {
  heroLogoPieces.forEach((pc) => {     // the soft trail on the logo drops
    const shape = pc.trail && pc.el.querySelector('path');
    if (shape) shape.setAttribute('filter', lite ? 'none' : `url(#${pc.trail.id})`);
  });
});

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
  if (!reduceMotion && !isPhone) {
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
if (!isPhone) update(smoothY);

setInterval(updateTime, 30 * 1000);  // keep the corner clock ticking

// Crossing the phone size (turning a tablet, resizing a window) switches
// between the two versions: simplest is to reload the page
window.matchMedia(`(max-width: ${PHONE.width - 0.02}px)`).addEventListener('change', () => location.reload());

// =========================================================================
// 8. PHONES — the calm, normally scrolling version for small screens
// =========================================================================
// The scenes sit one after another and the page scrolls like any page.
// Nothing flows in or moves: the only animation is the logo forming out of a
// water drop when the page first opens (section 3), and taps make a ripple
// in the background. Pieces remember their place on the PAGE
// (Site.offsetY), so the ripples and glass line up while scrolling. The page
// background itself is burgundy down to the work list and cream below (a
// clean edge, no blend), painted here rather than by the sections, so the
// ripple canvas behind the text shows everywhere.

function startPhone() {
  Site.scrolls = true;
  Site.ownBackground = true;  // core.js leaves the page background to us
  Site.offsetY = pageScroll;  // (core.js: the scroll position, read once per scroll)
  Site.isGliding = () => {
    if (phoneGlideTo !== null && Math.abs(window.scrollY - phoneGlideTo) < 2) phoneGlideTo = null;  // arrived
    return phoneGlideTo !== null;
  };
  // The drops of the pattern: burgundy on the cream part of the page
  Site.creamAt = (x, y) => y + window.scrollY > creamLine;

  Site.onMeasure.push(() => {
    measureLogo(heroLogoPieces, true);
    [heroTextPieces, workPieces, contactPieces].forEach(measureOrder);
    creamLine = workScene.offsetTop;
    document.body.style.background =
      `linear-gradient(${COLOR.burgundy} ${creamLine}px, ${COLOR.cream} ${creamLine}px)`;  // two flat colors, clean edge
  });
  Site.onRedraw.push(() => {
    [...workPieces, ...contactPieces].forEach((pc) => place(pc, 0));  // everything simply in place
    renderHeroLogo();
    phoneHeader(true);
  });
  window.addEventListener('scroll', () => phoneHeader(), { passive: true });
  ['wheel', 'touchstart', 'keydown'].forEach((type) =>
    window.addEventListener(type, () => { phoneGlideTo = null; }, { passive: true }));
}

// The top bar (no background): once the cream reaches the middle of the bar,
// the menu turns burgundy and the small logo appears
function phoneHeader(force = false) {
  const light = window.scrollY + 35 > creamLine;
  if (light === root.classList.contains('is-light') && !force) return;
  root.classList.toggle('is-light', light);
  root.classList.toggle('is-scrolled', light);
  headerLogo.inert = !light;
  headerPieces.forEach((pc) => place(pc, light ? 0 : 1));
  if (glassReady) updateGlass();
}

// Menu jumps on phones: the browser's own smooth scroll to the section
function phoneGoTo(hash, smooth) {
  const el = hash === '#top' ? null : document.querySelector(hash);
  const top = el ? el.offsetTop : 0;
  const animate = smooth && !reduceMotion;
  phoneGlideTo = animate ? Math.min(top, document.documentElement.scrollHeight - window.innerHeight) : null;
  window.scrollTo({ top, behavior: animate ? 'smooth' : 'instant' });
  if (smooth) focusScene(hash);
}
