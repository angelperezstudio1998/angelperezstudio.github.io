// =========================================================================
// Angel Studio — water-intro.js (the home page's logo rising out of the
// water, drawn with WebGL; home.js starts it with waterIntro())
// =========================================================================
//
// Seen from above, like a hand coming out of water, but the water is
// burgundy and the logo is a flat, solid shape (it never bends). It comes
// up toward you out of the burgundy, growing a little, its shadow on the
// floor below moving away and softening as it lifts. When it breaks the
// surface it's covered in burgundy liquid, which runs off its flat top: the
// middle of each letter clears first, the liquid pulling back to the edges
// in streaks, a few beads left behind, then pouring over the edges into the
// water (with light catching it) and sending ripples out. Then the real
// logo takes over.
//
// How: the logo is drawn once into a picture, plus soft (blurred) versions
// of it (which say how far each point is from a letter's edge, so which way
// the liquid runs). One shader works out, for every pixel, how much liquid
// is on the logo, the liquid pouring off, the light on it and the shadow.
// =========================================================================

const WATER = {
  delay: 300,      // wait after the page loads before it starts rising (ms)
  rise: 2600,      // how long it takes to come up to the surface (ms)
  from: 0.86,      // how big it starts (1 = full size): smaller = deeper
  breakAt: 0.86,   // when it breaks the surface (share of the way up)
  run: 3200,       // how long the liquid takes to run off it (ms)
  spill: 2300,     // how long the liquid keeps pouring over the edges (ms)
  ripples: 8,      // ripples the water makes as it pours off
  handover: 450,   // crossfade to the real logo (ms)
};

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D uLogo;   // the logo (cream)
uniform sampler2D uField;  // r: its shape, g: softly rounded (1 deep inside a letter, lower near its edges), b: very soft
uniform vec2 uRes;         // canvas size (css px)
uniform vec2 uC;           // the logo's middle (0-1)
uniform float uLogoH;      // the logo's height (share of the canvas)
uniform float uR;          // how far it has come up (0 = deep, 1 = at the surface)
uniform float uSize;       // how big it looks (it grows a little as it comes toward you)
uniform float uFilm;       // how far the liquid has run off it (0 = covered, 1 = gone)
uniform float uSpill;      // how much liquid is pouring over the edges right now (0-1)
uniform float uT;          // time (ms)
uniform vec3 uBurg, uCream;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 toLogo(vec2 uv) { return (uv - uC) / uSize + uC; }
vec3 field(vec2 luv) { return texture2D(uField, luv).rgb; }

// Which way the liquid runs here: off the letter, toward its nearest edge
vec2 runDir(vec2 luv) {
  vec2 e = 3.0 / uRes;
  vec2 g = vec2(field(luv + vec2(e.x, 0.0)).g - field(luv - vec2(e.x, 0.0)).g,
                field(luv + vec2(0.0, e.y)).g - field(luv - vec2(0.0, e.y)).g);
  return length(g) > 1e-4 ? -normalize(g) : vec2(0.0, 1.0);
}

// How much burgundy liquid is on the logo here (0 = dry, 1 = covered). It
// runs off toward the edges: the middle of each letter clears first, the
// edges last, in streaks that move outward, leaving a few beads behind.
float liquidOn(vec2 luv, vec3 f) {
  if (f.r < 0.01) return 0.0;
  vec2 d = runDir(luv);
  vec2 p = luv * uRes;
  // (smooth, large shapes: liquid holds together with rounded edges)
  float flow = noise((p - d * uT * 0.03) * 0.012) * 0.65 + noise((p - d * uT * 0.02) * 0.026) * 0.35;
  float stay = (1.0 - f.g) * 0.5 + flow * 1.1;                              // where it hangs on longest
  float q = uFilm * uFilm * (3.0 - 2.0 * uFilm);                            // (clears slowly, then faster, then the last bits)
  float sheet = smoothstep(q * 1.05 - 0.05, q * 1.05, stay) * (1.0 - smoothstep(0.82, 1.0, uFilm));  // (the last of it slides off at the end)
  // a few beads left behind, sliding out toward the edge as they go
  vec2 bp = (p - d * uT * 0.025) * 0.03;
  float bead = smoothstep(0.83, 0.86, noise(bp)) * (1.0 - smoothstep(0.6, 0.97, uFilm));
  return f.r * clamp(max(sheet, bead), 0.0, 1.0);
}
// Liquid pouring off the edges into the water: a band just outside the
// letters, flowing outward, that comes and goes
float spillAt(vec2 luv, vec3 f) {
  float band = smoothstep(0.03, 0.4, f.g) * (1.0 - f.r);
  vec2 d = luv - uC;
  vec2 p = luv * uRes;
  float flow = noise(p * 0.05 - normalize(d + 1e-5) * uT * 0.06) * 0.7 + noise(p * 0.018 + uT * 0.0005) * 0.5;
  return band * uSpill * smoothstep(0.35, 0.85, flow);
}
// The liquid's surface (for the light catching it)
float wetHeight(vec2 uv) {
  vec2 luv = toLogo(uv); vec3 f = field(luv);
  float under = f.b * (1.0 - uR) * 0.0 + f.g * smoothstep(0.35, 0.95, uR) * (1.0 - step(0.001, uFilm)) * 0.5;  // the shape pushing up under the sheet
  return liquidOn(luv, f) * 0.6 * step(0.001, uFilm) + under + spillAt(luv, f) * 0.5;  // (the edges catch the light)
}

void main() {
  vec2 uv = vUv;
  vec2 luv = toLogo(uv); vec3 f = field(luv);
  vec4 logo = texture2D(uLogo, luv);                       // the logo itself: never bent
  float depth = 1.0 - uR;
  // Before it breaks the surface it's under the water (fading up through
  // it); after, the liquid left on it runs off
  float covered = uFilm > 0.0 ? liquidOn(luv, f) : 1.0;
  float through = uFilm > 0.0 ? 1.0 : exp(-depth * 3.2) * 0.55;            // how much of it shows through the water above it
  vec3 col = mix(uBurg, uCream, through);
  col = mix(col, mix(uBurg, vec3(0.3, 0.02, 0.05), 0.25), covered * (uFilm > 0.0 ? 1.0 : 0.0));  // the burgundy liquid on it

  // Its shadow on the floor below: close and sharp while it's deep,
  // further away and softer as it lifts toward you
  vec2 off = vec2(0.004, 0.09 * uLogoH) * mix(0.15, 1.0, uR);
  vec3 sf = field(toLogo(uv - off));
  float shadow = mix(sf.r, sf.g, uR) * mix(0.3, 0.6, uR) * smoothstep(0.0, 0.5, uR);

  // Light catching the liquid
  vec2 e = 1.0 / uRes;
  float h0 = wetHeight(uv);
  vec2 e2 = e * 2.5;  // (a little wider: a rounded edge to the liquid)
  vec3 n = normalize(vec3((wetHeight(uv - vec2(e2.x, 0.0)) - wetHeight(uv + vec2(e2.x, 0.0))) * 2.2, (wetHeight(uv - vec2(0.0, e2.y)) - wetHeight(uv + vec2(0.0, e2.y))) * 2.2, 1.0));
  vec3 L = normalize(vec3(-0.4, -0.55, 0.73));
  float facing = clamp(dot(n, L), 0.0, 1.0);
  float wetHere = clamp(h0 * 4.0, 0.0, 1.0);
  float sheen = (pow(facing, 90.0) * 0.9 + pow(facing, 10.0) * 0.08) * wetHere;

  float spill = spillAt(luv, f);
  vec3 c = vec3(0.078, 0.0, 0.012) * shadow; float a = shadow;
  float la = logo.a;
  c = col * la + c * (1.0 - la); a = la + a * (1.0 - la);
  float sa = clamp(spill, 0.0, 1.0) * 0.9;                                 // the liquid pouring off (burgundy, a little lighter where it's moving)
  vec3 spillCol = mix(uBurg, vec3(0.33, 0.04, 0.07), 0.5);
  c = spillCol * sa + c * (1.0 - sa); a = sa + a * (1.0 - sa);
  c += vec3(1.0, 0.92, 0.86) * sheen; a = max(a, sheen);
  gl_FragColor = vec4(min(c, vec3(1.0)), clamp(a, 0.0, 1.0));
}`;

// Draw the logo (clean, at rest) into a canvas of the given size, at (x, y, w, h)
function logoPicture(svg, W, H, box, color) {
  const clone = svg.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
  clone.querySelectorAll('[filter]').forEach((el) => el.removeAttribute('filter'));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', box.w);
  clone.setAttribute('height', box.h);
  clone.setAttribute('fill', color);
  clone.style.fill = color;
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, box.x, box.y, box.w, box.h);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// A soft (blurred) copy of a canvas: shrink it, then stretch it back up
function softened(src, factor) {
  const w = Math.max(2, Math.round(src.width / factor)), h = Math.max(2, Math.round(src.height / factor));
  const small = document.createElement('canvas'); small.width = w; small.height = h;
  const sc = small.getContext('2d'); sc.imageSmoothingQuality = 'high'; sc.drawImage(src, 0, 0, w, h);
  const half = document.createElement('canvas'); half.width = w * 2; half.height = h * 2;   // (two steps up: smoother)
  const hc = half.getContext('2d'); hc.imageSmoothingQuality = 'high'; hc.drawImage(small, 0, 0, w * 2, h * 2);
  const out = document.createElement('canvas'); out.width = src.width; out.height = src.height;
  const oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high'; oc.drawImage(half, 0, 0, src.width, src.height);
  return out;
}

function texture(gl, src) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// Start it: heroLogo = the .hero__logo element. Calls done() once the real logo
// has taken over. Returns false (and does nothing) if WebGL isn't available.
function waterIntro(heroLogo, { addDrop, done }) {
  const svg = heroLogo.querySelector('.logo');
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__water';
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return false;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { console.warn('water intro:', err); return false; }

  // The canvas covers the logo with room around it (for the shadow and the spill)
  const r = svg.getBoundingClientRect(), host = heroLogo.getBoundingClientRect();
  const mx = r.width * 0.22, my = r.height * 0.45;
  const cssW = r.width + mx * 2, cssH = r.height + my * 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
  Object.assign(canvas.style, { left: `${r.left - host.left - mx}px`, top: `${r.top - host.top - my}px`, width: `${cssW}px`, height: `${cssH}px` });
  canvas.width = W; canvas.height = H;
  heroLogo.classList.add('is-water');   // (the real logo waits, hidden, until the hand-over)
  heroLogo.append(canvas);

  const box = { x: mx * dpr, y: my * dpr, w: r.width * dpr, h: r.height * dpr };
  const css = getComputedStyle(document.documentElement);
  const cream = css.getPropertyValue('--cream').trim() || '#D6C7AE';
  logoPicture(svg, W, H, box, cream).then((pic) => {
    // The shape and its soft versions, packed into one picture (r, g, b)
    const soft = softened(pic, 10 * dpr), softer = softened(pic, 34 * dpr);
    const read = (c) => c.getContext('2d').getImageData(0, 0, W, H).data;
    const a0 = read(pic), a1 = read(soft), a2 = read(softer);
    const fieldData = new ImageData(W, H);
    for (let p = 0; p < W * H * 4; p += 4) {
      fieldData.data[p] = a0[p + 3];
      fieldData.data[p + 1] = Math.min(255, a1[p + 3] * 1.25);
      fieldData.data[p + 2] = Math.min(255, a2[p + 3] * 1.6);
      fieldData.data[p + 3] = 255;
    }
    const fieldCanvas = document.createElement('canvas'); fieldCanvas.width = W; fieldCanvas.height = H;
    fieldCanvas.getContext('2d').putImageData(fieldData, 0, 0);

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); texture(gl, pic);
    gl.activeTexture(gl.TEXTURE1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const ft = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ft);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fieldCanvas);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
    const U = (n) => gl.getUniformLocation(prog, n);
    gl.uniform1i(U('uLogo'), 0);
    gl.uniform1i(U('uField'), 1);
    gl.uniform2f(U('uRes'), cssW, cssH);
    gl.uniform2f(U('uC'), (mx + r.width / 2) / cssW, (my + r.height / 2) / cssH);
    gl.uniform1f(U('uLogoH'), r.height / cssH);
    const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    gl.uniform3fv(U('uBurg'), rgb(css.getPropertyValue('--burgundy').trim() || '#3B0008'));
    gl.uniform3fv(U('uCream'), rgb(cream));
    gl.viewport(0, 0, W, H);
    const u = { r: U('uR'), size: U('uSize'), film: U('uFilm'), spill: U('uSpill'), t: U('uT') };

    // The timeline
    const start = performance.now() + WATER.delay;
    const pBreak = 1 - Math.cbrt(1 - WATER.breakAt);     // (the rise eases out: when it reaches the surface)
    const tBreak = pBreak * WATER.rise;
    const end = Math.max(WATER.rise, tBreak + WATER.run, tBreak + 150 + WATER.spill);
    let rippled = false, handed = false;
    const frame = (now) => {
      const t = now - start;
      const p = Math.min(1, Math.max(0, t / WATER.rise));
      const rise = 1 - (1 - p) ** 3;
      const film = t < tBreak ? 0 : Math.max(0.001, Math.min(1, (t - tBreak) / WATER.run));
      const s = Math.min(1, Math.max(0, (t - tBreak - 150) / WATER.spill));
      gl.uniform1f(u.r, rise);
      gl.uniform1f(u.size, WATER.from + (1 - WATER.from) * rise);
      gl.uniform1f(u.film, film);
      gl.uniform1f(u.spill, Math.sin(Math.PI * Math.min(1, s * 1.15)) ** 0.8 * (s > 0 ? 1 : 0));
      gl.uniform1f(u.t, Math.max(0, t));
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // As the water pours off: ripples spread out from around the logo
      if (!rippled && t > tBreak + 250) {
        rippled = true;
        for (let k = 0; k < WATER.ripples; k++) {
          const ang = (k / WATER.ripples) * Math.PI * 2 + 0.3;
          const x = r.left + r.width / 2 + Math.cos(ang) * r.width * (0.42 + 0.1 * Math.random());
          const y = r.top + r.height / 2 + Math.sin(ang) * r.height * (0.55 + 0.1 * Math.random());
          setTimeout(() => addDrop(x, y), k * 110 + Math.random() * 90);
        }
      }
      if (t < end) { requestAnimationFrame(frame); return; }
      if (!handed) {
        handed = true;
        heroLogo.classList.remove('is-water');   // the real logo fades in…
        canvas.style.opacity = '0';               // …as the picture fades out
        setTimeout(() => { canvas.remove(); gl.getExtension('WEBGL_lose_context')?.loseContext(); }, WATER.handover + 50);
        done();
      }
    };
    requestAnimationFrame(frame);
  }).catch((err) => { console.warn('water intro:', err); heroLogo.classList.remove('is-water'); canvas.remove(); done(); });
  return true;
}
