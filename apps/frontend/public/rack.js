// This module is re-fetched (via a cache-busted URL) every time the rack view
// remounts, since ES modules only ever evaluate once per exact URL otherwise.
// The previous instance's own global listeners and render loop would
// otherwise keep running forever against its now-detached DOM/scene.
window.__rackTeardown__?.();

const stage = document.querySelector('three-d-stage');
const { THREE: T } = await stage.ready;

const RECIPIENT_NAME = window.__RECIPIENT_NAME__ || '';

const M = {
  steelBlue: new T.MeshStandardMaterial({ name: 'staal-blauw', color: 0x224f82, roughness: 0.42, metalness: 0.35 }),
  chrome: new T.MeshStandardMaterial({ name: 'chroom', color: 0xc6d2de, roughness: 0.28, metalness: 0.4 }),
  accent: new T.MeshStandardMaterial({ name: 'oranje', color: 0xa43d41, roughness: 0.45, metalness: 0.08 }),
  paper: new T.MeshStandardMaterial({ name: 'papier-wit', color: 0xf4f7fa, roughness: 0.85, metalness: 0 }),
  cardBlue: new T.MeshStandardMaterial({ name: 'kaart-blauw', color: 0x2b5aa0, roughness: 0.8, metalness: 0 }),
};

const WIRE_R = 0.0035;
const wireGeo = new T.CylinderGeometry(WIRE_R, WIRE_R, 1, 8);
wireGeo.name = 'draad';

// All wire bars share one of three materials. Rather than one Mesh per bar
// (500+ draw calls, each duplicated again in the shadow pass — the actual
// cause of the slowdown), every bar's transform is collected here and
// folded into a single InstancedMesh per material per tier.
function barMatrix(a, b, r = 1) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b);
  const dir = new T.Vector3().subVectors(B, A);
  const quat = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
  const pos = A.clone().addScaledVector(dir, 0.5);
  return new T.Matrix4().compose(pos, quat, new T.Vector3(r, dir.length(), r));
}
function newBarCollector() { return { steelBlue: [], chrome: [], accent: [] }; }
function pushBar(collector, worldMat, key, a, b, r = 1) {
  collector[key].push(worldMat.clone().multiply(barMatrix(a, b, r)));
}
function buildBarInstances(collector, tier, ti) {
  const specs = [['steelBlue', M.steelBlue], ['chrome', M.chrome], ['accent', M.accent]];
  for (const [key, mat] of specs) {
    const arr = collector[key];
    if (!arr.length) continue;
    const im = new T.InstancedMesh(wireGeo, mat, arr.length);
    im.name = `draad-instanced-${key}-${ti + 1}`;
    arr.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    tier.add(im);
  }
}

// ---- one wire pocket, opening toward +Z, back panel at z = 0 ----
const W = 0.11, H = 0.15, D = 0.03;
const cardGeo = new T.BoxGeometry(0.104, 0.147, 0.0014);
cardGeo.name = 'ansichtkaart';
const faceGeoPortrait = new T.BoxGeometry(0.096, 0.138, 0.0006);
faceGeoPortrait.name = 'kaart-voorzijde-portret';
const faceGeoLandscape = new T.BoxGeometry(0.138, 0.096, 0.0006);
faceGeoLandscape.name = 'kaart-voorzijde-landschap';
const faceGeo = faceGeoPortrait; // back plate keeps the physical card's own (portrait) footprint

// Shared postcard back: one canvas texture, redrawn whenever a compliment is written.
const backCanvas = document.createElement('canvas');
backCanvas.width = 960; backCanvas.height = 1360;
const backCtx = backCanvas.getContext('2d');
const backTex = new T.CanvasTexture(backCanvas);
backTex.colorSpace = T.SRGBColorSpace;
// Lays text out exactly like wrapText but keeps each line's source character range,
// so a caret/selection index can be mapped back to an (x, y) on the canvas.
function layoutText(ctx, text, maxWidth) {
  const lines = [];
  let idx = 0;
  const paragraphs = text.split('\n');
  paragraphs.forEach((para, pi) => {
    const words = para.split(' ');
    let line = '', lineStart = idx;
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push({ str: line, startIdx: lineStart });
        idx += line.length + 1;
        lineStart = idx;
        line = word;
      } else line = test;
    });
    lines.push({ str: line, startIdx: lineStart });
    idx = lineStart + line.length;
    if (pi < paragraphs.length - 1) idx += 1;
  });
  return lines;
}
function coordForIndex(ctx, lines, x, y, lineHeight, charIndex) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (charIndex <= l.startIdx + l.str.length || i === lines.length - 1) {
      const within = Math.max(0, Math.min(l.str.length, charIndex - l.startIdx));
      return { x: x + ctx.measureText(l.str.slice(0, within)).width, y: y + i * lineHeight };
    }
  }
  return { x, y };
}
// The back plate's geometry stays portrait-shaped (the physical card), but writing mode
// rolls the whole card 90°, so this draws its layout pre-rotated -90° into that portrait
// canvas — after the roll it reads upright, as a normal landscape postcard back.
const TEXT_X = 60, TEXT_Y = 70, TEXT_LINE_H = 54, TEXT_FONT = '400 42px Montserrat, sans-serif';
const COMPLIMENT_MIN_LEN = 10;
const COMPLIMENT_MAX_LINES = 16;
const COMPLIMENT_WRAP_CHARS = 28;
// Mirrors layoutText's greedy word-wrap but by character count instead of measured
// pixel width, so the 16-line cap matches the "28 chars per line" rule regardless
// of the canvas's actual (font-metric-based) wrap points.
function wrapLinesByChars(text, maxChars) {
  const lines = [];
  text.split('\n').forEach((para) => {
    const words = para.split(' ');
    let line = '';
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (test.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    lines.push(line);
  });
  return lines;
}
let stampProgress = 0;
let addressProgress = 0;
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function drawScribbleLine(ctx, x0, x1, y, revealFrac) {
  if (revealFrac <= 0) return;
  const w = (x1 - x0) * Math.min(1, revealFrac);
  const steps = Math.max(2, Math.floor(w / 6));
  ctx.beginPath();
  for (let s = 0; s <= steps; s++) {
    const x = x0 + (w * s) / steps;
    const y2 = y + Math.sin(s * 1.7 + x0 * 0.01) * 4 + Math.sin(s * 0.6) * 2;
    if (s === 0) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
  }
  ctx.stroke();
}
function renderBack(text, caretIdx, selStart, selEnd) {
  const w = backCanvas.width, h = backCanvas.height;
  backCtx.save();
  backCtx.clearRect(0, 0, w, h);
  backCtx.translate(w / 2, h / 2);
  backCtx.rotate(-Math.PI / 2);
  backCtx.translate(-h / 2, -w / 2);
  const lw = h, lh = w; // logical landscape canvas size once rotated
  backCtx.fillStyle = '#f4f7fa'; backCtx.fillRect(0, 0, lw, lh);
  backCtx.strokeStyle = '#224F82'; backCtx.lineWidth = 4;
  backCtx.strokeRect(24, 24, lw - 48, lh - 48);
  backCtx.beginPath(); backCtx.moveTo(lw * 0.55, 40); backCtx.lineTo(lw * 0.55, lh - 40); backCtx.stroke();
  backCtx.setLineDash([10, 10]);
  for (let i = 0; i < 4; i++) {
    const y = lh * 0.42 + i * 70;
    backCtx.beginPath(); backCtx.moveTo(lw * 0.6, y); backCtx.lineTo(lw - 60, y); backCtx.stroke();
  }
  backCtx.setLineDash([]);
  if (addressProgress > 0) {
    backCtx.strokeStyle = '#224F82';
    backCtx.lineWidth = 3;
    backCtx.lineCap = 'round';
    backCtx.lineJoin = 'round';
    const lineLens = [0.72, 0.5, 0.38, 0.22];
    for (let i = 0; i < 4; i++) {
      const y = lh * 0.42 + i * 70 - 14;
      const x0 = lw * 0.6, x1 = lw - 60;
      const target = x0 + (x1 - x0) * lineLens[i];
      const localT = Math.max(0, Math.min(1, addressProgress * 4 - i));
      if (i === 0 && RECIPIENT_NAME) {
        backCtx.save();
        backCtx.beginPath();
        backCtx.rect(x0, y - 40, (x1 - x0) * localT, 50);
        backCtx.clip();
        backCtx.font = '400 34px Montserrat, sans-serif';
        backCtx.fillStyle = '#224F82';
        backCtx.fillText(RECIPIENT_NAME, x0, y);
        backCtx.restore();
      } else {
        drawScribbleLine(backCtx, x0, target, y, localT);
      }
    }
  }
  backCtx.strokeRect(lw - 190, 60, 130, 170);
  if (stampProgress > 0) {
    const cx = lw - 190 + 65, cy = 60 + 85;
    const s = easeOutBack(stampProgress);
    backCtx.save();
    backCtx.translate(cx, cy);
    backCtx.rotate(-8 * Math.PI / 180);
    backCtx.scale(s, s);
    backCtx.globalAlpha = Math.min(1, stampProgress * 1.6);
    backCtx.fillStyle = '#FFC857';
    backCtx.fillRect(-55, -75, 110, 150);
    backCtx.strokeStyle = '#ffffff';
    backCtx.lineWidth = 3;
    backCtx.setLineDash([6, 6]);
    backCtx.strokeRect(-55, -75, 110, 150);
    backCtx.setLineDash([]);
    backCtx.strokeStyle = '#224F82';
    backCtx.lineWidth = 3;
    backCtx.beginPath(); backCtx.arc(0, -5, 34, 0, Math.PI * 2); backCtx.stroke();
    backCtx.beginPath(); backCtx.moveTo(-50, 40); backCtx.lineTo(50, 40); backCtx.stroke();
    backCtx.beginPath(); backCtx.moveTo(-50, 55); backCtx.lineTo(50, 55); backCtx.stroke();
    backCtx.restore();
  }
  backCtx.font = TEXT_FONT;
  const maxWidth = lw * 0.55 - 100;
  const lines = layoutText(backCtx, text || '', maxWidth);
  if (selStart != null && selEnd != null && selStart !== selEnd) {
    const from = Math.min(selStart, selEnd), to = Math.max(selStart, selEnd);
    backCtx.fillStyle = 'rgba(20, 48, 98, 0.28)';
    lines.forEach((l, i) => {
      const lineEnd = l.startIdx + l.str.length;
      const s = Math.max(from, l.startIdx), e = Math.min(to, lineEnd);
      if (s >= e) return;
      const x0 = TEXT_X + backCtx.measureText(l.str.slice(0, s - l.startIdx)).width;
      const x1 = TEXT_X + backCtx.measureText(l.str.slice(0, e - l.startIdx)).width;
      backCtx.fillRect(x0, TEXT_Y + i * TEXT_LINE_H, Math.max(2, x1 - x0), 46);
    });
  }
  backCtx.fillStyle = '#0d1f3f';
  backCtx.textAlign = 'left'; backCtx.textBaseline = 'top';
  lines.forEach((l, i) => backCtx.fillText(l.str, TEXT_X, TEXT_Y + i * TEXT_LINE_H));
  if (caretIdx != null) {
    const pos = coordForIndex(backCtx, lines, TEXT_X, TEXT_Y, TEXT_LINE_H, caretIdx);
    backCtx.fillStyle = '#0d1f3f';
    backCtx.fillRect(pos.x + 3, pos.y + 2, 4, 42);
  }
  backCtx.restore();
  backTex.needsUpdate = true;
}
renderBack('');
const backMat = new T.MeshStandardMaterial({ name: 'kaart-achterzijde-materiaal', map: backTex, roughness: 0.9, metalness: 0 });

function pocket(index, faceTexture, orientation, cardName, collector, worldMat) {
  const g = new T.Group();
  g.name = `vak-${index}`;
  const x = W / 2, lip = H * 0.42;

  // A real display rack is bent from bare/chromed wire, not painted brand-blue —
  // the frame reads as chrome, CR Oranje stays the one small accent (the card lip).
  for (const px of [-x + 0.012, -0.018, 0.018, x - 0.012]) pushBar(collector, worldMat, 'chrome', [px, 0, 0], [px, H, 0]);
  for (const py of [0.014, H - 0.018]) pushBar(collector, worldMat, 'chrome', [-x, py, 0], [x, py, 0]);

  // side frames (back -> front) and front uprights
  for (const s of [-1, 1]) {
    pushBar(collector, worldMat, 'chrome', [s * x, 0.008, 0], [s * x, 0.008, D]);
    pushBar(collector, worldMat, 'chrome', [s * x, H - 0.018, 0], [s * x, lip, D]);
    pushBar(collector, worldMat, 'chrome', [s * x, 0.008, D], [s * x, lip, D]);
  }
  // bottom tray + front retaining lip
  pushBar(collector, worldMat, 'chrome', [-x, 0.008, D], [x, 0.008, D]);
  pushBar(collector, worldMat, 'chrome', [-x, 0.008, D * 0.55], [x, 0.008, D * 0.55]);
  pushBar(collector, worldMat, 'chrome', [-x, lip, D], [x, lip, D]);

  // the postcard, leaning back against the rug
  const card = new T.Mesh(cardGeo, M.paper);
  card.name = `kaart-${index}`;
  card.castShadow = true;
  card.userData.isCard = true;
  card.userData.orientation = orientation;
  card.userData.cardName = cardName;
  card.position.set(0, 0.012 + 0.147 / 2 - 0.004, 0.009);
  card.rotation.x = 0.055;
  const isLandscape = orientation === 'landscape';
  const faceMat = new T.MeshStandardMaterial({ name: `kaartbeeld-materiaal-${index}`, map: faceTexture, roughness: 0.75, metalness: 0 });
  const face = new T.Mesh(isLandscape ? faceGeoLandscape : faceGeoPortrait, faceMat);
  face.name = `kaartbeeld-${index}`;
  face.position.set(0, 0, 0.0011);
  if (isLandscape) face.rotation.z = Math.PI / 2;
  card.add(face);
  card.userData.frontTexture = faceTexture;
  const back = new T.Mesh(faceGeo, backMat);
  back.name = `kaart-achterzijde-${index}`;
  back.position.set(0, 0, -0.0011);
  back.rotation.y = Math.PI;
  card.add(back);
  g.add(card);

  return g;
}

// ---- rack ----
const rack = new T.Group();
rack.name = 'ansichtkaartenrek';

const POLE_H = 1.08, POLE_R = 0.019;
const base = new T.Mesh(new T.CylinderGeometry(0.3, 0.33, 0.028, 40), M.steelBlue);
base.name = 'voetplaat';
base.position.y = 0.014;
const collar = new T.Mesh(new T.CylinderGeometry(0.055, 0.12, 0.07, 32), M.steelBlue);
collar.name = 'voetkraag';
collar.position.y = 0.028 + 0.035 - 0.001;
const pole = new T.Mesh(new T.CylinderGeometry(POLE_R, POLE_R, POLE_H, 20), M.chrome);
pole.name = 'staander';
pole.position.y = POLE_H / 2 + 0.06;
const knob = new T.Mesh(new T.SphereGeometry(0.032, 20, 14), M.accent);
knob.name = 'knop';
knob.position.y = POLE_H + 0.06 + 0.016;
for (const m of [base, collar, pole, knob]) { m.castShadow = true; m.receiveShadow = true; }
rack.add(base, collar, pole, knob);

// ---- postcard imagery: drop real photo URLs in here — the rack cycles through
// however many you provide, repeating the list to fill every pocket. Each entry can be a
// plain URL (defaults to a portrait front) or { url, orientation: 'landscape'|'portrait', name }
// to say whether that card's FRONT photo is landscape or portrait, and its stable identifier
// (needed because `url` may be a blob: URL with no filename to recover it from). Leave empty
// to see numbered placeholder swatches in the brand palette instead (alternating orientation).
// Configured from Angular — see apps/frontend/src/app/postcard-rack/postcard-images.ts
const IMAGES = window.__POSTCARD_IMAGES__ || [];

// A card's "name" is its design filename without extension, e.g. "7" for
// /assets/cards/designs/7.svg — the only stable identifier we have per design.
// Only used as a fallback for a plain-string/URL entry; Angular-supplied
// entries carry their name explicitly (see IMAGES comment above).
function cardNameFromUrl(url) {
  if (!url) return null;
  const file = url.split('/').pop() || '';
  return file.replace(/\.[^.]+$/, '');
}

function imageEntry(i) {
  if (!IMAGES.length) return { url: null, orientation: i % 4 === 3 ? 'landscape' : 'portrait', name: null };
  const raw = IMAGES[i % IMAGES.length];
  return typeof raw === 'string'
    ? { url: raw, orientation: 'portrait', name: cardNameFromUrl(raw) }
    : { url: raw.url, orientation: raw.orientation || 'portrait', name: raw.name || cardNameFromUrl(raw.url) };
}

// Drawn onto a canvas ourselves (rather than handed straight to
// THREE.TextureLoader) because an SVG <img> uploaded directly as a WebGL
// texture rasterizes at its tiny intrinsic pixel size (its width/height
// attributes, e.g. ~400x560) — drawImage instead rasterizes the vector
// content at the destination size we choose, so the card front stays sharp.
function loadImageAsCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetH = 2000;
      const targetW = Math.round((targetH * img.naturalWidth) / img.naturalHeight) || targetH;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Card designs ship as both .svg (crisp, used elsewhere as plain <img>s) and a
// prerendered .png alongside it. The rack prefers the PNG: it's a big, cheap
// win here specifically because rasterizing these particular SVGs (dense
// vector paths plus an embedded photo layer) onto a canvas is slow, and the
// rack loads every design's texture up front. Falls back to rasterizing the
// SVG itself if no PNG counterpart exists for a design.
function loadTexture(url) {
  const pngUrl = url.replace(/\.svg$/i, '.png');
  return (pngUrl !== url ? loadImageAsCanvas(pngUrl).catch(() => loadImageAsCanvas(url)) : loadImageAsCanvas(url))
    .then((canvas) => {
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = stage._renderer.capabilities.getMaxAnisotropy();
      return tex;
    })
    .catch(() => null);
}

function placeholderTexture(i, isLandscape) {
  const palette = ['#224F82', '#A43D41', '#2b5aa0', '#f1f6fa'];
  const bg = palette[i % palette.length];
  const fg = bg === '#f1f6fa' ? '#224F82' : '#ffffff';
  const c = document.createElement('canvas');
  if (isLandscape) { c.width = 1360; c.height = 960; } else { c.width = 960; c.height = 1360; }
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = fg; ctx.lineWidth = 24;
  ctx.strokeRect(48, 48, c.width - 96, c.height - 96);
  ctx.fillStyle = fg;
  ctx.font = '700 120px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`kaart ${i + 1}`, c.width / 2, c.height / 2);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = stage._renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const TIERS = [0.40, 0.62, 0.84];
const PER_TIER = 8, R_BACK = 0.152;
const TOTAL_POCKETS = TIERS.length * PER_TIER;

const faceEntries = await Promise.all(
  Array.from({ length: TOTAL_POCKETS }, (_, i) => {
    const entry = imageEntry(i);
    const landscape = entry.orientation === 'landscape';
    const cardName = entry.name || `placeholder-${i}`;
    if (entry.url) return loadTexture(entry.url).then((t) => ({ texture: t || placeholderTexture(i, landscape), orientation: entry.orientation, cardName }));
    return Promise.resolve({ texture: placeholderTexture(i, landscape), orientation: entry.orientation, cardName });
  }),
);

const tierGroups = [];
const tierTargetRot = [];
const tierRingMats = [];
const STEP = (Math.PI * 2) / PER_TIER;

TIERS.forEach((y, ti) => {
  const tier = new T.Group();
  tier.name = `etage-${ti + 1}`;
  tier.position.y = y;
  tier.rotation.y = ti * (Math.PI / PER_TIER) * 0.9;

  tierGroups.push(tier);
  tierTargetRot.push(tier.rotation.y);

  const hub = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.026, 24), M.chrome);
  hub.name = `naaf-${ti + 1}`;
  hub.position.y = 0.02;
  hub.castShadow = true;
  const ringMat = M.steelBlue.clone();
  ringMat.name = `staal-blauw-naafring-${ti + 1}`;
  tierRingMats.push(ringMat);
  const ring = new T.Mesh(new T.TorusGeometry(0.052, 0.006, 10, 32), ringMat);
  ring.name = `naafring-${ti + 1}`;
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  tier.add(hub, ring);

  const collector = newBarCollector();
  for (let i = 0; i < PER_TIER; i++) {
    const a = (i / PER_TIER) * Math.PI * 2;
    const arm = new T.Group();
    arm.rotation.y = a;
    arm.name = `arm-${ti + 1}-${i + 1}`;
    const armMat = new T.Matrix4().makeRotationY(a);

    pushBar(collector, armMat, 'chrome', [0, 0.02, 0.045], [0, 0.024, R_BACK], 1.5);
    pushBar(collector, armMat, 'chrome', [-W / 2, 0.024, R_BACK], [W / 2, 0.024, R_BACK], 1.2);

    const entry = faceEntries[ti * PER_TIER + i];
    const pocketLocalMat = new T.Matrix4().compose(
      new T.Vector3(0, 0.024, R_BACK),
      new T.Quaternion().setFromEuler(new T.Euler(0.1, 0, 0)),
      new T.Vector3(1, 1, 1),
    );
    const pocketWorldMat = armMat.clone().multiply(pocketLocalMat);
    const p = pocket(`${ti + 1}-${i + 1}`, entry.texture, entry.orientation, entry.cardName, collector, pocketWorldMat);
    p.position.set(0, 0.024, R_BACK);
    p.rotation.x = 0.1;
    arm.add(p);
    tier.add(arm);
  }
  buildBarInstances(collector, tier, ti);
  tier.traverse((o) => { o.userData.tierIndex = ti; });
  rack.add(tier);
});

stage.setObject(rack);
const camera = stage._camera, controls = stage._controls;
// The stage's default loop renders every frame forever. Nothing here needs
// that once the scene is settled, so take over: render on demand and stop
// requesting frames once everything has come to rest.
stage._renderer.setAnimationLoop(null);
let rafHandle = null;
function wake() { if (rafHandle === null) rafHandle = requestAnimationFrame(animate); }
window.addEventListener('resize', wake);
const note = stage.shadowRoot.querySelector('.note');
if (note) note.textContent = 'Klik op een laag om in te zoomen';

const homeCamPos = camera.position.clone();
const homeLookAt = controls.target.clone();
const baseDist = homeCamPos.distanceTo(homeLookAt);
const camPosTarget = homeCamPos.clone();
const camLookTarget = homeLookAt.clone();
// The camera's "navigation" position — tier focus/home lerp only ever reads and
// writes this. camera.position itself may get an extra one-frame retreat below
// (to keep an oversized lifted card from clipping through the rack); if that
// retreat fed back into this value the retreat would compound every frame.
const navCamPos = homeCamPos.clone();

let selectedTier = null;
let pulseTier = null, pulseStart = 0;
const chooseBtn = document.getElementById('choose-card-btn');
const selectBtn = document.getElementById('select-card-btn');

function setButtonsForTier(tierIndex) {
  document.querySelectorAll('.tier-row').forEach((row) => {
    row.style.display = Number(row.dataset.tier) === tierIndex ? 'flex' : 'none';
  });
  const panel = document.querySelector('.tier-controls');
  if (panel) panel.style.visibility = tierIndex === null ? 'hidden' : 'visible';
  selectBtn.style.display = tierIndex === null ? 'none' : 'block';
}

function focusOnTier(tierIndex) {
  selectedTier = tierIndex;
  pulseTier = tierIndex;
  pulseStart = performance.now();
  tierRingMats.forEach((m, i) => m.color.set(i === tierIndex ? 0xa43d41 : 0x224f82));
  if (note) note.textContent = tierIndex === null
    ? 'Klik op een laag om in te zoomen'
    : 'Selecteer de kaart die je wilt versturen';
  if (tierIndex === null) {
    camPosTarget.copy(homeCamPos);
    camLookTarget.copy(homeLookAt);
    setButtonsForTier(null);
    return;
  }
  const box = new T.Box3().setFromObject(tierGroups[tierIndex]);
  const sphere = box.getBoundingSphere(new T.Sphere());
  const dist = (sphere.radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.5;
  const dir = new T.Vector3().subVectors(homeCamPos, homeLookAt).normalize();
  camLookTarget.copy(sphere.center);
  camPosTarget.copy(sphere.center).addScaledVector(dir, dist);
  setButtonsForTier(tierIndex);
}
setButtonsForTier(null);

const raycaster = new T.Raycaster();
const pointer = new T.Vector2();

let liftedCard = null, cardAnimState = null, cardOriginalParent = null, homeCardScale = 1;
const homeCardPos = new T.Vector3(), homeCardQuat = new T.Quaternion();
const liftPos = new T.Vector3(), liftQuat = new T.Quaternion(), liftScaleVec = new T.Vector3(), homeScaleVec = new T.Vector3();
const sendTargetPos = new T.Vector3();
const sendStartQuat = new T.Quaternion(), sendEndQuat = new T.Quaternion();
let sendStart = 0;
const SEND_MS = 500;
// Eases toward how far the camera needs to retreat to fit an oversized lifted
// card on screen, instead of snapping straight to it.
let liftRetreat = 0;

function liftCard(cardMesh) {
  liftedCard = cardMesh;
  cardOriginalParent = cardMesh.parent;
  cardMesh.getWorldPosition(homeCardPos);
  cardMesh.getWorldQuaternion(homeCardQuat);
  homeCardScale = cardMesh.getWorldScale(new T.Vector3()).x;
  stage._scene.attach(cardMesh);
  cardAnimState = 'out';
  isFlipped = false;
  cardShowsBack = false;
  const panel = document.querySelector('.tier-controls');
  if (panel) panel.style.visibility = 'hidden';
  selectBtn.style.display = 'none';
  chooseBtn.style.display = 'block';
}

function returnCard() {
  cardAnimState = 'in';
  chooseBtn.style.display = 'none';
  if (note) note.style.display = '';
  complimentPanel.style.display = 'none';
  complimentSubmit.style.display = 'none';
  privacyCard.style.display = 'none';
  complimentText.value = '';
  if (complimentHint) complimentHint.textContent = '';
  isFlipped = false;
  cardShowsBack = false;
}

const complimentPanel = document.getElementById('compliment-panel');
const complimentText = document.getElementById('compliment-text');
const complimentSubmit = document.getElementById('compliment-submit');
const complimentHint = document.getElementById('compliment-hint');
const privacyCard = document.getElementById('privacy-card');
const hideFromDashboardCheckbox = document.getElementById('hide-from-dashboard-checkbox');
let isFlipped = false;
// Whether the lifted card should render back-side-up. Distinct from isFlipped:
// isFlipped also gates the live text-editing overlay (caret blink, panel
// tracking) and turns off the moment "Klaar" is clicked, but the card itself
// must keep showing its (now-stamped, addressed) back all the way through
// send — flipping it to the front mid-animation would be jarring.
let cardShowsBack = false;
const FLIP_Y = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI);
const ROLL_Z = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2);
const ROLL_Z_INV = ROLL_Z.clone().invert();
chooseBtn.addEventListener('click', () => {
  isFlipped = true;
  cardShowsBack = true;
  chooseBtn.style.display = 'none';
  if (note) note.style.display = 'none';
  complimentSubmit.style.display = 'block';
  privacyCard.style.display = 'block';
  if (document.documentElement.classList.contains('is-touch')) {
    // Mobile: a plain form below the card, not an invisible textarea tracking
    // the card's screen position (fiddly to align once the keyboard opens).
    complimentPanel.removeAttribute('style');
  }
  complimentPanel.style.display = 'block';
  complimentText.focus();
  updateComplimentValidation();
});
function refreshCard(withCaretBlink) {
  const el = complimentText;
  const hasSel = el.selectionStart !== el.selectionEnd;
  const caret = withCaretBlink && !hasSel ? el.selectionEnd : null;
  renderBack(el.value, caret, el.selectionStart, el.selectionEnd);
}
// Rejects a keystroke that would push the compliment past 16 wrapped lines
// (wrapped per the 28-chars-per-line rule) by reverting to the last value
// that still fit, restoring the caret as close to where it was as possible.
let lastValidComplimentValue = '';
function enforceComplimentLineLimit() {
  const value = complimentText.value;
  if (wrapLinesByChars(value, COMPLIMENT_WRAP_CHARS).length > COMPLIMENT_MAX_LINES) {
    const caret = complimentText.selectionStart;
    complimentText.value = lastValidComplimentValue;
    const newCaret = Math.max(0, Math.min(caret - 1, complimentText.value.length));
    complimentText.setSelectionRange(newCaret, newCaret);
  } else {
    lastValidComplimentValue = value;
  }
}
function updateComplimentValidation() {
  const len = complimentText.value.trim().length;
  const short = len < COMPLIMENT_MIN_LEN;
  complimentSubmit.disabled = short;
  if (complimentHint) {
    complimentHint.textContent = short
      ? `Nog minimaal ${COMPLIMENT_MIN_LEN - len} teken${COMPLIMENT_MIN_LEN - len === 1 ? '' : 'en'}`
      : '';
  }
}
complimentText.addEventListener('input', () => { enforceComplimentLineLimit(); updateComplimentValidation(); refreshCard(true); });
complimentText.addEventListener('select', () => refreshCard(true));
complimentText.addEventListener('click', () => refreshCard(true));
complimentText.addEventListener('keyup', () => refreshCard(true));
let selectingDrag = false;
complimentText.addEventListener('mousedown', () => {
  selectingDrag = true;
  const onMove = () => refreshCard(false);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', () => { selectingDrag = false; window.removeEventListener('mousemove', onMove); refreshCard(true); }, { once: true });
});
// Reads a texture's source pixels back out as an <img>-usable URL, whether it
// came from the TextureLoader (an HTMLImageElement with its own src) or was
// drawn on a <canvas> (the placeholder swatches).
function textureToImageSrc(tex) {
  const img = tex && tex.image;
  if (!img) return null;
  if (img instanceof HTMLCanvasElement) return img.toDataURL('image/png');
  // Every card texture today is canvas-backed (see loadTexture/placeholderTexture
  // above), so this branch shouldn't run — but if a future texture source ever
  // hands us a bare <img> instead, rasterize it to a PNG data URL too rather
  // than returning its raw src (which could be an un-decoded or .svg URL and
  // cause the same render issues we bake PNGs to avoid elsewhere).
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
// The back canvas is always drawn landscape-content-first, then rotated -90°
// into the physical (portrait) card buffer — see renderBack — because the
// real card mesh rolls 90° into landscape when flipped for writing. Reading
// backCanvas's raw pixels out as-is would show that content sideways, so
// undo the bake here: rotate +90° into a freshly-sized landscape canvas.
function landscapeBackDataUrl() {
  const w = backCanvas.width, h = backCanvas.height;
  const out = document.createElement('canvas');
  out.width = h;
  out.height = w;
  const octx = out.getContext('2d');
  octx.translate(out.width / 2, out.height / 2);
  octx.rotate(Math.PI / 2);
  octx.drawImage(backCanvas, -w / 2, -h / 2);
  return out.toDataURL('image/png');
}
let mailSending = false;
let hasSent = false;
let pendingHideFromDashboard = false;
complimentSubmit.addEventListener('click', () => {
  if (mailSending || !liftedCard || complimentText.value.trim().length < COMPLIMENT_MIN_LEN) return;
  mailSending = true;
  pendingHideFromDashboard = hideFromDashboardCheckbox.checked;
  // Stop here, not just in startSend(): the shared animate() loop redraws a
  // blinking caret every frame while isFlipped is true, which would otherwise
  // keep racing with (and winning over) stampTick/addrTick's caret-free draws.
  isFlipped = false;
  complimentPanel.style.display = 'none';
  complimentSubmit.style.display = 'none';
  privacyCard.style.display = 'none';
  // From here on the card is just being watched, not edited — render straight
  // from the text, with no caret and no selection highlight. Going through
  // refreshCard() would still forward the textarea's live selectionStart/End
  // (e.g. a word left selected from before clicking "Klaar"), baking that
  // highlight into the stamp/address animation and the final sent image.
  const finalText = complimentText.value;
  const startTs = performance.now();
  const STAMP_MS = 380;
  function stampTick(now) {
    stampProgress = Math.min(1, (now - startTs) / STAMP_MS);
    renderBack(finalText, null, null, null);
    if (stampProgress < 1) requestAnimationFrame(stampTick);
    else setTimeout(startAddress, 180);
  }
  requestAnimationFrame(stampTick);
});
function startAddress() {
  const finalText = complimentText.value;
  const addrStart = performance.now();
  const ADDRESS_MS = 650;
  function addrTick(now) {
    addressProgress = Math.min(1, (now - addrStart) / ADDRESS_MS);
    renderBack(finalText, null, null, null);
    if (addressProgress < 1) requestAnimationFrame(addrTick);
    else setTimeout(startSend, 350);
  }
  requestAnimationFrame(addrTick);
}
// Sends the actual lifted card off-frame — no return trip, no stand-in.
// The animate() loop drives the flight; finishSend() runs once it lands.
function startSend() {
  isFlipped = false;
  const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const forward = new T.Vector3();
  camera.getWorldDirection(forward);
  sendTargetPos.copy(liftedCard.position)
    .addScaledVector(right, 6)
    .addScaledVector(up, 1.2)
    .addScaledVector(forward, 1.5);
  sendStartQuat.copy(liftedCard.quaternion);
  // A quick clockwise twist (as seen by the viewer) sold by rotating around
  // the camera's forward axis — screen-space clockwise is a positive angle
  // about the axis pointing into the screen.
  const roll = new T.Quaternion().setFromAxisAngle(forward, Math.PI / 10);
  sendEndQuat.copy(sendStartQuat).premultiply(roll);
  sendStart = performance.now();
  cardAnimState = 'sent';
  wake();
}
function finishSend() {
  const frontSrc = textureToImageSrc(liftedCard.userData.frontTexture);
  const frontIsLandscape = liftedCard.userData.orientation === 'landscape';
  const cardName = liftedCard.userData.cardName;
  const backSrc = landscapeBackDataUrl();
  const text = complimentText.value.trim();
  liftedCard.visible = false;
  liftedCard = null;
  cardAnimState = null;
  stampProgress = 0;
  addressProgress = 0;
  complimentText.value = '';
  lastValidComplimentValue = '';
  updateComplimentValidation();
  hideFromDashboardCheckbox.checked = false;
  mailSending = false;
  hasSent = true;
  setButtonsForTier(null);
  if (window.__navigateToThanks__) {
    window.__navigateToThanks__({
      frontSrc,
      frontIsLandscape,
      backSrc,
      text,
      recipientName: RECIPIENT_NAME,
      cardName,
      hideFromDashboard: pendingHideFromDashboard,
    });
  }
}

function toScreenXY(v3) {
  const v = v3.clone().project(camera);
  const rect = canvasEl.getBoundingClientRect();
  return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
}
function updateComplimentPanelRect() {
  const hw = 0.052, hh = 0.0735; // cardGeo half-extents
  const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => toScreenXY(new T.Vector3(x, y, 0).applyMatrix4(liftedCard.matrixWorld)));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
  complimentPanel.style.left = left + 'px';
  complimentPanel.style.top = top + 'px';
  complimentPanel.style.width = width + 'px';
  complimentPanel.style.height = height + 'px';
  // The invisible textarea must wrap its (transparent) text at the same points as the
  // canvas-rendered postcard text, or a mouse drag over the visible 3D text lands on
  // completely different characters in the real textarea and selection looks broken.
  // Scale the canvas' font metrics (defined in logical "lw" units, see renderBack) down
  // to this box's current CSS pixel size so the browser's native word-wrap lines up.
  const lw = 1360; // logical landscape width used by renderBack or the same source
  const scale = width / lw;
  const maxTextWidth = lw * 0.55 - 100; // matches renderBack's maxWidth
  complimentText.style.fontFamily = 'Montserrat, sans-serif';
  complimentText.style.fontWeight = '400';
  complimentText.style.fontSize = (42 * scale) + 'px';
  complimentText.style.lineHeight = (TEXT_LINE_H * scale) + 'px';
  complimentText.style.paddingLeft = (TEXT_X * scale) + 'px';
  complimentText.style.paddingTop = (TEXT_Y * scale) + 'px';
  complimentText.style.paddingRight = Math.max(0, width - TEXT_X * scale - maxTextWidth * scale) + 'px';
  complimentText.style.paddingBottom = '0';
}

// Each tier starts at its own rotation offset (so pockets across tiers don't
// all line up), so the "front" pocket isn't reliably centered on-screen — a
// ray through the middle of the screen can pass through the gap between two
// cards instead of hitting one. The card nearest the camera is always the
// one currently facing the viewer, ring stagger or not, so pick by distance.
const selectFrontCardWorldPos = new T.Vector3();
selectBtn.addEventListener('click', () => {
  if (selectedTier === null || liftedCard) return;
  let front = null, bestDist = Infinity;
  tierGroups[selectedTier].traverse((o) => {
    if (!o.userData.isCard) return;
    o.getWorldPosition(selectFrontCardWorldPos);
    const d = selectFrontCardWorldPos.distanceToSquared(camera.position);
    if (d < bestDist) { bestDist = d; front = o; }
  });
  if (front) { liftCard(front); wake(); }
});

stage._renderer.domElement.addEventListener('click', (ev) => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  const rect = stage._renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  if (liftedCard) { returnCard(); return; }
  if (hasSent) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(rack, true);
  if (selectedTier !== null) {
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.isCard) o = o.parent;
      if (o && o.userData.tierIndex === selectedTier) { liftCard(o); wake(); return; }
    }
  }
  const hit = hits.find((h) => h.object.userData.tierIndex !== undefined);
  focusOnTier(hit ? hit.object.userData.tierIndex : null);
  wake();
});

function onKeyDown(ev) {
  if (ev.key === 'Escape') {
    if (liftedCard) { returnCard(); wake(); return; }
    focusOnTier(null);
    wake();
    return;
  }
  if (liftedCard) return;
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
    ev.preventDefault();
    const dir = ev.key === 'ArrowUp' ? 1 : -1;
    const current = selectedTier === null ? (dir === 1 ? -1 : TIERS.length) : selectedTier;
    const next = Math.min(TIERS.length - 1, Math.max(0, current + dir));
    focusOnTier(next);
    wake();
    return;
  }
  if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
    if (selectedTier === null) return;
    ev.preventDefault();
    window.rotateTierImages(selectedTier, ev.key === 'ArrowLeft' ? -1 : 1);
  }
}
document.addEventListener('keydown', onKeyDown);

// Touch devices: hide the rotate buttons (see CSS .is-touch) and let a horizontal drag
// spin the selected tier live, 1:1 with the finger, like actually turning the rack.
const DRAG_SENS = 0.008;
let touchStartX = null, touchStartY = null, touchMoved = false, suppressNextClick = false, dragStartRot = 0;
let lastMoveX = 0, lastMoveT = 0, dragVel = 0; // dragVel: rad per ms
let inertiaTier = null, inertiaVel = 0;
const canvasEl = stage._renderer.domElement;

function dragStart(x, y) {
  touchStartX = x;
  touchStartY = y;
  touchMoved = false;
  inertiaTier = null;
  lastMoveX = x;
  lastMoveT = performance.now();
  dragVel = 0;
  if (selectedTier !== null && !liftedCard) dragStartRot = tierGroups[selectedTier].rotation.y;
}
function dragMove(x, y) {
  if (touchStartX === null) return;
  const dx = x - touchStartX;
  if (Math.abs(dx) > 12 || Math.abs(y - touchStartY) > 12) touchMoved = true;
  if (touchMoved && selectedTier !== null && !liftedCard) {
    const rot = dragStartRot + dx * DRAG_SENS;
    tierGroups[selectedTier].rotation.y = rot;
    tierTargetRot[selectedTier] = rot;
    const now = performance.now();
    const dt = now - lastMoveT;
    if (dt > 0) dragVel = ((x - lastMoveX) * DRAG_SENS) / dt;
    lastMoveX = x; lastMoveT = now;
    wake();
  }
}
function dragEnd() {
  if (touchStartX === null) return;
  const dxFinal = lastMoveX - touchStartX;
  const isRealDrag = touchMoved && Math.abs(dxFinal) > 18;
  if (isRealDrag && selectedTier !== null && !liftedCard) {
    if (Math.abs(dragVel) > 0.0006) {
      inertiaTier = selectedTier;
      inertiaVel = Math.max(-0.006, Math.min(0.006, dragVel));
    } else {
      tierTargetRot[selectedTier] = Math.round(tierGroups[selectedTier].rotation.y / STEP) * STEP;
    }
    suppressNextClick = true;
  } else if (touchMoved && selectedTier !== null && !liftedCard) {
    tierGroups[selectedTier].rotation.y = dragStartRot;
    tierTargetRot[selectedTier] = dragStartRot;
  }
  touchStartX = null; touchStartY = null;
  wake();
}

canvasEl.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  dragStart(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
canvasEl.addEventListener('touchmove', (e) => {
  if (e.touches.length !== 1) return;
  dragMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
canvasEl.addEventListener('touchend', dragEnd);

let mouseDown = false;
canvasEl.addEventListener('mousedown', (e) => {
  mouseDown = true;
  dragStart(e.clientX, e.clientY);
});
function onWindowMouseMove(e) {
  if (!mouseDown) return;
  dragMove(e.clientX, e.clientY);
}
function onWindowMouseUp() {
  if (!mouseDown) return;
  mouseDown = false;
  dragEnd();
}
window.addEventListener('mousemove', onWindowMouseMove);
window.addEventListener('mouseup', onWindowMouseUp);

// Physically spins one tier by one pocket step, easing toward the target each frame.
window.rotateTierImages = function (tierIndex, dir) {
  if (tierTargetRot[tierIndex] === undefined) return;
  tierTargetRot[tierIndex] += dir * STEP;
  wake();
};

function animate() {
  const now = performance.now();
  const dt = animate._last ? now - animate._last : 16;
  animate._last = now;
  tierGroups.forEach((g, ti) => {
    if (ti === inertiaTier) {
      g.rotation.y += inertiaVel * dt;
      inertiaVel *= Math.pow(0.992, dt);
      tierTargetRot[ti] = g.rotation.y;
      if (Math.abs(inertiaVel) < 0.00012) {
        tierTargetRot[ti] = Math.round(g.rotation.y / STEP) * STEP;
        inertiaTier = null;
      }
      return;
    }
    const diff = tierTargetRot[ti] - g.rotation.y;
    g.rotation.y += Math.abs(diff) > 0.0004 ? diff * 0.12 : diff;
    let scale = 1;
    if (ti === pulseTier) {
      const t = (performance.now() - pulseStart) / 320;
      scale = t < 1 ? 1 + 0.05 * Math.sin(t * Math.PI) : 1;
      if (t >= 1) pulseTier = null;
    }
    g.scale.setScalar(scale);
  });
  navCamPos.lerp(camPosTarget, 0.09);
  camera.position.copy(navCamPos);
  controls.target.lerp(camLookTarget, 0.09);
  camera.lookAt(controls.target);
  if (liftedCard) {
    const forward = new T.Vector3();
    camera.getWorldDirection(forward);
    // The card sits 0.55 in front of the camera by default. On narrow/tall
    // viewports that's too close — the card (shown landscape while flipped for
    // writing, regardless of its own portrait/landscape photo) would run off
    // the left/right edge of the screen. Rather than pushing the card further
    // forward (which drives it into the rack behind it), retreat the camera by
    // the same amount instead: the card ends up at the exact same spot it
    // always sits at, just seen from further away.
    const liftDist = 0.55;
    const cardHalfW = 0.0735; // worst case: card rotated to landscape (see liftQuat below)
    const tanHalfH = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    const fitDist = (cardHalfW * homeCardScale * 2.3) / (tanHalfH * 0.9);
    // While the card flies back home ('in'), ease the retreat back to 0 in step
    // with it — otherwise the camera stays pulled all the way back until the
    // card has already landed, then glides in on its own afterward.
    const targetRetreat = cardAnimState === 'in' ? 0 : Math.max(0, fitDist - liftDist);
    liftRetreat += (targetRetreat - liftRetreat) * 0.12;
    if (liftRetreat > 0.0001) camera.position.addScaledVector(forward, -liftRetreat);
    const dist = liftDist + liftRetreat;
    liftPos.copy(camera.position).addScaledVector(forward, dist);
    if (window.innerWidth < 640) {
      const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      liftPos.addScaledVector(up, 0.045);
    }
    liftQuat.copy(camera.quaternion);
    if (cardShowsBack) liftQuat.multiply(FLIP_Y).multiply(ROLL_Z);
    else if (liftedCard.userData.orientation === 'landscape') liftQuat.multiply(ROLL_Z_INV);
    if (isFlipped) {
      // On mobile the compliment panel is a plain fixed form (see CSS), so skip
      // aligning the invisible textarea to the card's screen rect every frame.
      if (!selectingDrag && !document.documentElement.classList.contains('is-touch')) updateComplimentPanelRect();
      refreshCard(Math.floor(now / 500) % 2 === 0);
    }
    if (cardAnimState === 'out') {
      liftedCard.position.lerp(liftPos, 0.12);
      liftedCard.quaternion.slerp(liftQuat, 0.12);
      liftedCard.scale.lerp(liftScaleVec.setScalar(homeCardScale * 2.3), 0.12);
    } else if (cardAnimState === 'in') {
      liftedCard.position.lerp(homeCardPos, 0.15);
      liftedCard.quaternion.slerp(homeCardQuat, 0.15);
      liftedCard.scale.lerp(homeScaleVec.setScalar(homeCardScale), 0.15);
      if (liftedCard.position.distanceTo(homeCardPos) < 0.001) {
        cardOriginalParent.attach(liftedCard);
        liftedCard = null;
        cardAnimState = null;
        setButtonsForTier(selectedTier);
      }
    } else if (cardAnimState === 'sent') {
      const t = Math.min(1, (now - sendStart) / SEND_MS);
      const ease = t * t;
      liftedCard.position.lerpVectors(liftPos, sendTargetPos, ease);
      liftedCard.scale.setScalar(homeCardScale * 2.3 * (1 - ease));
      const twistEase = Math.min(1, ease / 0.4);
      liftedCard.quaternion.slerpQuaternions(sendStartQuat, sendEndQuat, twistEase);
      if (t >= 1) finishSend();
    }
  } else if (liftRetreat > 0.0001) {
    liftRetreat *= 0.85;
  }
  const dist = camera.position.distanceTo(controls.target);
  // Skip the CSS var write (and the style recalc it triggers on every
  // .tier-row button) unless the zoom overlay is actually visible and the
  // value moved enough to matter.
  if (selectedTier !== null) {
    const zoom = Math.max(0.55, Math.min(2.4, baseDist / dist));
    const cur = animate._lastZoom;
    if (cur === undefined || Math.abs(zoom - cur) > 0.004) {
      document.documentElement.style.setProperty('--rack-zoom', zoom.toFixed(3));
      animate._lastZoom = zoom;
    }
  }

  stage._renderer.render(stage._scene, camera);

  const stillActive = (
    liftedCard !== null ||
    inertiaTier !== null ||
    mouseDown ||
    touchStartX !== null ||
    pulseTier !== null ||
    liftRetreat > 0.0001 ||
    camera.position.distanceToSquared(camPosTarget) > 1e-8 ||
    controls.target.distanceToSquared(camLookTarget) > 1e-8 ||
    tierGroups.some((g, ti) => Math.abs(tierTargetRot[ti] - g.rotation.y) > 0.0001)
  );
  rafHandle = stillActive ? requestAnimationFrame(animate) : null;
}
wake();

window.__rackTeardown__ = () => {
  window.removeEventListener('resize', wake);
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
  document.removeEventListener('keydown', onKeyDown);
  if (rafHandle !== null) { cancelAnimationFrame(rafHandle); rafHandle = null; }
};
