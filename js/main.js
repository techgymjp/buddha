// 空飛ぶ仏像 3D — お金を吸い込め！仏の力で天まで昇れ！
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildBuddha, makeCoinMesh, makeCrow, glowTexture, dotTexture } from './models.js?v=202611101801';
import { World, UNIT_M, makeLightPillars } from './world.js?v=202611101801';
import { AudioEngine } from './audio.js?v=202611101801';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('flyingBuddha3d.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('flyingBuddha3d.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// ---------- 定数 ----------
const STAGES = [
  { name: '地上の寺院', goal: 1800, curse: 0.07, foeRate: 0.08, foes: ['crow'], grav: 2.3 },
  { name: '山頂',       goal: 1500, curse: 0.11, foeRate: 0.13, foes: ['crow', 'crow', 'thunder'], grav: 3.1 },
  { name: '雲海',       goal: 1800, curse: 0.15, foeRate: 0.16, foes: ['thunder', 'crow'], grav: 3.6 },
  { name: '天空',       goal: 2100, curse: 0.19, foeRate: 0.18, foes: ['thunder'], grav: 4.1 },
  { name: '極楽浄土',   goal: 2400, curse: 0.22, foeRate: 0, foes: [], grav: 4.6 },
];
let acc = 0; STAGES.forEach((s) => { s.start = acc; acc += s.goal; });
const FORMS = [
  { lv: 1, name: '木造仏', need: 0, scale: 0.95 },
  { lv: 2, name: '黒漆の仏像', need: 12000, minStage: 0, scale: 1.0 },
  { lv: 3, name: '光背の仏像', need: 30000, minStage: 1, scale: 1.05 },
  { lv: 4, name: '千手観音', need: 55000, minStage: 2, scale: 1.1 },
  { lv: 5, name: '黄金の大仏', need: 85000, minStage: 3, scale: 1.35 },
];
const COINS = {
  zeni: { money: 10, r: 0.46, boost: 5.5, w: 70 },
  koban: { money: 300, r: 0.6, boost: 6, w: 9 },
  goriyaku: { money: 500, r: 0.45, boost: 16, w: 2.2 },
  noroi: { money: 0, r: 0.38, boost: -5, w: 0 },
};
const FEVER_AT = 0.82, HENSHIN_NEED = 14;
const XB = 5.6;           // 左右の移動範囲
const VIEW_H = 17.5, VIEW_W = 12;

// ---------- レンダラー ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('nogl').classList.remove('hidden'); $('title').classList.add('hidden');
  throw e;
}
const isMobile = matchMedia('(pointer: coarse)').matches;
// 画質レベル（重ければ自動で下げる）：[解像度の上限, ブルームの有無]
const QUALITY = [[1.75, true], [1.4, true], [1.15, true], [1.0, false], [0.8, false]];
let quality = isMobile ? 2 : 0;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[quality][0]));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 3000);
const world = new World(renderer, scene);
const pillars = makeLightPillars(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.4, 0.93);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ゲーム画面はスマホと同じ縦長の枠。PCでは画面中央に縦長で表示する
const APP_ASPECT = 9 / 19.5;
let appW = 390, appH = 844;
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  if (W / H <= 0.62) { appW = W; appH = H; } // スマホの縦画面はそのまま全面
  else { appH = H; appW = Math.round(H * APP_ASPECT); }
  const app = $('app'); app.style.width = appW + 'px'; app.style.height = appH + 'px';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[quality][0]));
  renderer.setSize(appW, appH, false);
  composer.setPixelRatio ? composer.setPixelRatio(renderer.getPixelRatio()) : null;
  composer.setSize(appW, appH);
  bloom.resolution.set(appW / 2, appH / 2);
  bloom.enabled = QUALITY[quality][1];
  camera.aspect = appW / appH; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const audio = new AudioEngine(store.get('muted', false));
function toggleSound() { audio.setMuted(!audio.muted); store.set('muted', audio.muted); updateSoundBtns(); }
function updateSoundBtns() { for (const id of ['soundBtn', 'pauseSound']) $(id).textContent = audio.muted ? '× 音なし' : '♪ 音あり'; }
updateSoundBtns();
// 音はゲーム開始前にすべて作っておく（スマホで音が切れないように）
$('startBtn').disabled = true;
audio.preload((k) => { $('startBtn').textContent = `読み込み中 ${Math.round(k * 100)}%`; }).then(() => {
  $('startBtn').disabled = false; $('startBtn').textContent = 'スタート';
});

// ---------- 仏像 ----------
const buddhaRoot = new THREE.Group(); scene.add(buddhaRoot);
const modelCache = {};
let model = null;
function setModel(lv) {
  if (!modelCache[lv]) modelCache[lv] = buildBuddha(lv);
  if (model) buddhaRoot.remove(model);
  model = modelCache[lv];
  buddhaRoot.add(model);
}
setModel(1);
const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffc860, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }));
aura.position.set(0, 1.2, -0.3); buddhaRoot.add(aura);
// 吸い上げの渦（仏像の真下に伸びる黄金の竜巻）
const swirl = new THREE.Group(); scene.add(swirl);
const vortexTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 6; i++) { // 斜めの光の筋
    const x = i * 256 / 6;
    const lg = g.createLinearGradient(x, 0, x + 40, 0);
    lg.addColorStop(0, 'rgba(255,220,130,0)'); lg.addColorStop(0.5, 'rgba(255,240,190,1)'); lg.addColorStop(1, 'rgba(255,220,130,0)');
    g.save(); g.transform(1, 0, -0.6, 1, 0, 0); g.fillStyle = lg; g.fillRect(x, 0, 40, 256); g.fillRect(x + 256, 0, 40, 256); g.restore();
  }
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.75, 'rgba(0,0,0,.6)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
const vortexMat = new THREE.MeshBasicMaterial({ map: vortexTex, color: 0xffd889, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const vortex = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1, 1, 40, 1, true), vortexMat);
vortex.geometry.translate(0, -0.5, 0); vortex.geometry.rotateX(Math.PI); // 細い端を口に、上へ広がる漏斗
swirl.add(vortex);
const vortex2 = new THREE.Mesh(vortex.geometry, vortexMat.clone()); vortex2.material.opacity = 0.3; swirl.add(vortex2);
const swirlRings = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.rotation.x = -Math.PI / 2 + 0.45; swirl.add(m); swirlRings.push(m);
}

// ---------- パーティクル ----------
const MAXP = 1600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, map: dotTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
points.frustumCulled = false; scene.add(points);
const parts = [];
const tmpC = new THREE.Color();
function emit(x, y, z, color, n, speed, life = 0.8, gravity = 0) {
  tmpC.set(color);
  for (let i = 0; i < n && parts.length < MAXP; i++) {
    const d = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
    parts.push({ x, y, z, vx: d.x, vy: d.y, vz: d.z, life: life * (0.6 + Math.random() * 0.4), max: life, r: tmpC.r, g: tmpC.g, b: tmpC.b, grav: gravity });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt; if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = Math.pow(0.4, dt); p.vx *= k; p.vy *= k; p.vz *= k;
  }
  for (let i = 0; i < MAXP; i++) {
    const p = parts[i];
    if (p) { pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z; const f = p.life / p.max; pCol[i * 3] = p.r * f; pCol[i * 3 + 1] = p.g * f; pCol[i * 3 + 2] = p.b * f; }
    else { pPos[i * 3 + 1] = -1e5; }
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  pGeo.setDrawRange(0, Math.max(1, parts.length));
}

// 空気中の粒（世界に固定＝流れることで速度を感じる）
const MOTES = 500;
const mGeo = new THREE.BufferGeometry();
const mPos = new Float32Array(MOTES * 3);
mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
const motes = new THREE.Points(mGeo, new THREE.PointsMaterial({ size: 0.12, map: dotTexture, color: 0xfff4d0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
motes.frustumCulled = false; scene.add(motes);
function resetMotes(cy) { for (let i = 0; i < MOTES; i++) { mPos[i * 3] = (Math.random() - 0.5) * 50; mPos[i * 3 + 1] = cy + (Math.random() - 0.5) * 60; mPos[i * 3 + 2] = -30 + Math.random() * 45; } }

// スピード線
const LINES = 90;
const lineMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.04, 1), lineMat, LINES);
lines.frustumCulled = false; scene.add(lines);
const lineData = Array.from({ length: LINES }, () => ({ x: 0, y: 0, z: 0, k: 0 }));
function resetLine(L, cy, h, anywhere) {
  const side = Math.random() < 0.5 ? -1 : 1;
  L.x = side * (2 + Math.random() * 16); L.z = -8 + Math.random() * 18; L.k = 0.6 + Math.random() * 0.8;
  L.y = anywhere ? cy + (Math.random() - 0.5) * h * 2 : cy + h + Math.random() * h;
}
lineData.forEach((L) => resetLine(L, 0, 20, true));

// 衝撃波リング
const shockwaves = [];
function shockwave(x, y, color = 0xffe08a, size = 6, inward = false) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inward ? 0.86 : 0.7, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x, y, inward ? 0.6 : 0); if (!inward) m.rotation.x = -Math.PI / 2 + 0.35; scene.add(m);
  shockwaves.push({ m, t: 0, size, inward });
}
// 口へ吸い込まれる輪（大きな輪が口元へ縮む）
const inhaleRing = (size, color = 0xfff0b0) => shockwave(mouthW.x, mouthW.y, color, size, true);
// 周りから光の粒が口へ吸い込まれる
function inhale(n, radius, color = 0xffe3a0) {
  tmpC.set(color);
  const bvy = G ? G.v / UNIT_M : 0;
  for (let i = 0; i < n && parts.length < MAXP; i++) {
    const a = Math.random() * Math.PI * 2, r = radius * (0.6 + Math.random() * 0.6);
    const dx = Math.cos(a), dy = Math.abs(Math.sin(a)) * 0.8 + 0.2; // 主に上から
    const life = 0.32 + Math.random() * 0.12, sp = r / life * 1.5;
    parts.push({ x: mouthW.x + dx * r, y: mouthW.y + dy * r, z: mouthW.z + (Math.random() - 0.5) * r * 0.5, vx: -dx * sp, vy: -dy * sp + bvy, vz: 0, life, max: life, r: tmpC.r, g: tmpC.g, b: tmpC.b, grav: 0 });
  }
}

// ---------- 浮き文字・バナー ----------
const floaters = [];
function floatText(x, y, z, text, color = '#fff', size = 22, life = 0.9) {
  return; // プレイ中は文章を出さない
  const el = document.createElement('div'); el.className = 'fl'; el.textContent = text;
  el.style.color = color; el.style.fontSize = size + 'px';
  $('floaters').appendChild(el);
  floaters.push({ el, p: new THREE.Vector3(x, y, z), life, max: life });
}
const proj = new THREE.Vector3();
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.life -= dt; f.p.y += dt * 1.2;
    if (f.life <= 0) { f.el.remove(); floaters.splice(i, 1); continue; }
    proj.copy(f.p).project(camera);
    f.el.style.left = ((proj.x + 1) / 2 * appW) + 'px';
    f.el.style.top = ((1 - proj.y) / 2 * appH) + 'px';
    f.el.style.opacity = Math.min(1, f.life / f.max * 2.5);
  }
}
let bannerT = 0;
function banner(main, sub = '', color = '') {
  return; // プレイ中は文章を出さない
  $('banner').innerHTML = `<div class="b1 gold">${main}</div>${sub ? `<div class="b2">${sub}</div>` : ''}`;
  if (color) $('banner').querySelector('.b1').style.filter = `drop-shadow(0 4px 0 ${color}) drop-shadow(0 0 16px rgba(255,180,60,.8))`;
  bannerT = 1.8;
}
let flashV = 0;
function flash(v) { flashV = Math.max(flashV, v); }

// ---------- 入力：押すと吸引／離すと停止、押したまま左右スワイプで移動 ----------
const input = { down: false, lastX: 0, dragPx: 0, left: false, right: false, key: false };
const canvas = $('c');
canvas.addEventListener('pointerdown', (e) => {
  audio.init();
  if (state !== 'play') return;
  input.down = true; input.lastX = e.clientX;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => { if (input.down) { input.dragPx += e.clientX - input.lastX; input.lastX = e.clientX; } });
const release = () => { input.down = false; };
canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = true;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = true;
  if (k === ' ') { e.preventDefault(); audio.init(); }
  if (k === 'Enter' && !e.repeat) { audio.init(); if (state === 'title' && audio.ready) startGame(); else if (state === 'result') $('resNext').click(); }
  if ((k === 'p' || k === 'P' || k === 'Escape') && !e.repeat) togglePause();
  if ((k === 'm' || k === 'M') && !e.repeat) toggleSound();
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
});
window.addEventListener('blur', () => { input.down = input.key = input.left = input.right = false; if (state === 'play') togglePause(); });

// ---------- 画面遷移 ----------
let state = 'title';
let best = store.get('best', { score: 0, alt: 0 });
const show = (id, on) => $(id).classList.toggle('hidden', !on);
function refreshBest() {
  $('bestTitle').textContent = best.score ? `ベストスコア ${best.score.toLocaleString()} ／ 最高到達 ${best.alt.toLocaleString()}m` : '';
  $('bestHud').textContent = best.score.toLocaleString();
}
refreshBest();
$('startBtn').addEventListener('click', () => { if (!audio.ready) return; audio.init(); startGame(); });
$('howBtn').addEventListener('click', () => { audio.init(); show('how', true); });
$('howClose').addEventListener('click', () => show('how', false));
$('soundBtn').addEventListener('click', () => { audio.init(); toggleSound(); });
$('pauseSound').addEventListener('click', toggleSound);
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', togglePause);
$('quitBtn').addEventListener('click', () => { show('pause', false); toTitle(); });
$('resTitleBtn').addEventListener('click', toTitle);
$('resNext').addEventListener('click', () => {
  show('result', false);
  if (resultKind === 'clear') nextStage(); else startGame();
});

function togglePause() {
  if (state === 'play') { state = 'paused'; show('pause', true); }
  else if (state === 'paused') { state = 'play'; show('pause', false); }
}

// ---------- ゲーム状態 ----------
let G = null;
function newGameState() {
  return {
    stage: 0, money: 0, score: 0, form: 0, maxCombo: 0, henshins: 0,
    bx: 0, by: 1.2, bvx: 0, v: 14, camY: 4.8, mouth: 0,
    coins: [], foes: [], path: null, foeAcc: 0, accSm: 0, thrust: 0, lift: 0,
    combo: 0, comboT: 0, gori: 0, curse: 0, inv: 0, dai: 0,
    fever: false, feverCount: 0, stageMoney: 0, fovKick: 0, shake: 0, time: 0,
  };
}
function startGame() {
  clearWorldObjects();
  G = newGameState();
  setModel(1);
  resetMotes(G.camY);
  show('title', false); show('hud', true);
  beginStage(0);
}
function beginStage(i) {
  G.stage = i;
  G.v = Math.max(G.v, 14);
  G.fever = false; G.feverCount = 0; G.stageMoney = 0; G.dai = 0; G.gori = 0; G.curse = 0;
  setModel(FORMS[G.form].lv);
  state = 'play';
  $('stageName').textContent = `第${i + 1}天 ${STAGES[i].name}`;
  world.refreshEnv(altM());
  banner(`第${i + 1}天`, STAGES[i].name);
  audio.gong();
}
function nextStage() { show('hud', true); beginStage(G.stage + 1); }
function toTitle() {
  show('result', false); show('pause', false); show('hud', false); show('title', true);
  clearWorldObjects();
  G = null; state = 'title';
  refreshBest();
}
function clearWorldObjects() {
  if (!G) return;
  for (const c of G.coins) freeCoin(c);
  for (const f of G.foes) { scene.remove(f.obj); if (f.warn) f.warn.remove(); }
}

// ---------- 生成：仏像の上に連なる硬貨の道 ----------
const STEP = 2.0; // 道の硬貨の間隔（ユニット）：1枚ずつはっきり離す
// 硬貨は使い回す（毎回作ると、スマホで引っかかりの原因になる）
const coinPool = { zeni: [], koban: [], goriyaku: [], noroi: [] };
function freeCoin(c) { c.obj.visible = false; coinPool[c.type].push(c.obj); }
function addCoin(type, x, y, z = 0) {
  x = THREE.MathUtils.clamp(x, -XB, XB);
  let obj = coinPool[type].pop();
  if (!obj) { obj = makeCoinMesh(type); scene.add(obj); }
  obj.visible = true;
  obj.position.set(x, y, z); obj.scale.setScalar(1.15);
  G.coins.push({ type, obj, x, y, z, vx: 0, vy: 0, spin: Math.random() * 6, ph: Math.random() * 6, pulled: false });
}
// 硬貨の道は左右の「車線」を通る。真ん中を通るのは車線を移るときだけなので、左右に動かないと取れない
const LANE = 3.4;
function newSegment(P) {
  if (G.fever) { P.mode = 'storm'; P.left = 999; P.side = P.x > 0 ? 1 : -1; return; }
  const r = Math.random();
  P.side = Math.random() < 0.6 ? -(P.side || 1) : (P.side || 1); // 多くの場合、反対側の車線へ
  P.cx = P.side * LANE;
  P.ph = 0;
  if (r < 0.28) { P.mode = 'wave'; P.left = 9 + (Math.random() * 6 | 0); P.amp = 0.8 + Math.random() * 1.2; P.freq = 0.35 + Math.random() * 0.2; }
  else if (r < 0.48) { P.mode = 'cross'; P.left = 6 + (Math.random() * 4 | 0); } // 反対側の車線へ斜めに渡る
  else if (r < 0.62) { P.mode = 'helix'; P.left = 8 + (Math.random() * 6 | 0); }
  else if (r < 0.76) { P.mode = 'zigzag'; P.left = 10 + (Math.random() * 6 | 0); P.tx = -P.side * LANE; }
  else if (r < 0.9) { P.mode = 'branch'; P.left = 8 + (Math.random() * 5 | 0); P.good = Math.random() < 0.5 ? -1 : 1; P.cx = 0; }
  else if (G.time > 4) { P.mode = 'gap'; P.left = 1 + (Math.random() * 2 | 0) + (G.stage >> 1); }
  else { P.mode = 'wave'; P.left = 8; P.amp = 1; P.freq = 0.4; }
}
function extendPath(limitY) {
  const st = STAGES[G.stage];
  if (!G.path) G.path = { x: LANE, y: G.by + 2.4, mode: 'wave', left: 8, amp: 0.8, freq: 0.4, ph: 0, cx: LANE, side: 1, n: 0 };
  const P = G.path;
  while (P.y < limitY) {
    if (P.left-- <= 0) newSegment(P);
    P.y += STEP; P.ph += 1; P.n++;
    let z = 0;
    switch (P.mode) {
      case 'wave': P.x = P.cx + Math.sin(P.ph * P.freq * 2) * P.amp; break;
      case 'cross': P.x += (P.cx - P.x) * 0.35; break;
      case 'line': P.x += P.slope * STEP; if (Math.abs(P.x) > XB - 0.6) P.slope *= -1; break;
      case 'helix': P.x = P.cx + Math.sin(P.ph * 0.7) * 1.4; z = Math.cos(P.ph * 0.7) * 1.2; break;
      case 'zigzag': P.x = P.x > 0 ? -LANE - Math.random() : LANE + Math.random(); break; // 左右の車線に交互
      case 'storm': if (P.ph % 10 === 0) P.side = -P.side; P.x = P.side * 3.6; break;
    }
    P.x = THREE.MathUtils.clamp(P.x, -XB + 0.4, XB - 0.4);
    if (P.mode === 'gap') continue;
    if (P.mode === 'storm') { // 賽銭の嵐：太い硬貨の帯
      for (const off of [-1.4, 0, 1.4]) addCoin(Math.random() < 0.14 ? 'koban' : 'zeni', P.x + off, P.y + (Math.random() - 0.5) * 0.3);
      continue;
    }
    if (P.mode === 'branch') { // 分かれ道：片方は小判まじり
      const spread = Math.min(LANE, (P.left < 3 ? P.left : 3) * 1.3);
      for (const side of [-1, 1]) {
        const good = side === P.good;
        const x = P.x + side * spread;
        const type = good ? (P.n % 3 === 0 ? 'koban' : 'zeni') : 'zeni'; // 分かれ道：片方は小判まじり
        addCoin(type, x, P.y);
      }
      continue;
    }
    let type = 'zeni';
    if (P.n % 6 === 0) type = 'koban';
    else if (Math.random() < 0.016 + G.stage * 0.003) type = 'goriyaku';
    addCoin(type, P.x, P.y, z);
  }
}
function spawnFoe(cy, halfH) {
  const st = STAGES[G.stage];
  if (!st.foes.length) return;
  const kind = st.foes[Math.random() * st.foes.length | 0];
  if (kind === 'crow') {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const obj = makeCrow(); obj.scale.setScalar(1.3);
    const y = G.by + 7 + Math.random() * 5;
    obj.position.set(-dir * 12, y, 0.3); obj.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(obj);
    // 飛んでくる1秒前に、来る側の画面端に「！」を出す
    const warn = document.createElement('div'); warn.className = 'crow-warn'; warn.textContent = '！'; warn.style[dir > 0 ? 'left' : 'right'] = '6px';
    $('floaters').appendChild(warn);
    G.foes.push({ kind, obj, x: -dir * 12, y, vx: dir * (3 + Math.random() * 1.5 + G.stage * 0.4), t: 0, r: 0.45, warn, warnT: 1.0 });
  } else {
    const obj = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.cloudTexture(['rgba(120,124,140,.95)', 'rgba(70,72,90,.7)']), transparent: true, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1); s.scale.set(4 + Math.random() * 2, 2.6, 1); obj.add(s);
    }
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xc0d8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowS.scale.set(7, 5, 1); obj.add(glowS);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xeef4ff, fog: false });
    const bolt = new THREE.Mesh(new THREE.BufferGeometry(), boltMat); bolt.visible = false; obj.add(bolt);
    const x = (Math.random() - 0.5) * 2 * (XB - 1);
    const y = cy + halfH + 3;
    obj.position.set(x, y, -0.5); scene.add(obj);
    G.foes.push({ kind, obj, x, y, vx: (Math.random() - 0.5) * 1.2, t: Math.random() * 1.5, glowS, bolt });
  }
}
function boltGeometry() {
  const pts = []; let x = 0;
  for (let y = 0; y > -24; y -= 1.4) { pts.push(new THREE.Vector3(x, y, 0)); x += (Math.random() - 0.5) * 1.1; }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.09, 5);
}

// ---------- パラメータ ----------
const form = () => FORMS[G.form];
const bScale = () => (G.dai > 0 ? 2.1 : form().scale);
function suckR() {
  if (G.dai > 0) return 14;
  const r = 3.1 + Math.min(4, Math.sqrt(G.money) * 0.04) + G.form * 0.25;
  return G.gori > 0 ? r * 1.7 : r;
}
const suckPow = () => 42 + G.form * 6 + (G.gori > 0 ? 30 : 0) + (G.dai > 0 ? 60 : 0);
// 最高速度（仏像が大きいほど・御利益中・大仏で上がる）
function maxSpeed() {
  let vm = 18 + G.stage * 1.5 + G.form * 2 + (G.gori > 0 ? 18 : 0) + (G.dai > 0 ? 22 : 0);
  if (G.fever && G.dai <= 0) vm = Math.min(vm, 20); // 賽銭の嵐では吸い込む時間をつくる
  return vm;
}
const altM = () => Math.max(0, G.by * UNIT_M);
window.__altM = () => altM();

// ---------- 更新 ----------
const mouthW = new THREE.Vector3();
let viewHalfH = 11, viewDist = 24;

function update(dt) {
  G.time += dt;
  const st = STAGES[G.stage];
  const S = bScale();

  // 左右移動
  const unitsPerPx = (2 * viewHalfH * camera.aspect) / appW;
  if (input.dragPx) { const dx = input.dragPx * unitsPerPx * 1.25; G.bx += dx; G.bvx = dx / Math.max(dt, 1e-3); input.dragPx = 0; }
  else if (input.left || input.right) { G.bvx += ((input.right - input.left) * 9 - G.bvx) * Math.min(1, dt * 10); G.bx += G.bvx * dt; }
  else G.bvx *= Math.pow(0.02, dt);
  G.bx = THREE.MathUtils.clamp(G.bx, -XB, XB);

  // 吸引（押している間だけ・呪縛中は不可）
  const sucking = G.curse <= 0; // 吸い込みは常に自動（呪縛中だけ止まる）
  G.sucking = sucking;
  G.mouth += ((sucking ? 1 : 0) - G.mouth) * Math.min(1, dt * 12);

  // 上昇の勢い：吸った硬貨で加速し、吸わなければ重力で減速する
  if (G.dai > 0) G.v += 25 * dt;
  else G.v += ((G.gori > 0 ? 18 * Math.min(1, G.gori / 2) : 0) - st.grav) * dt; // 黄金の御利益コインで加速度が増す
  const vm = maxSpeed();
  if (G.v > vm) G.v += (vm - G.v) * Math.min(1, 2 * dt);
  G.v = Math.min(G.v, vm + 10); // 上乗せの加速は最高速度+10m/sまで
  G.v = Math.max(-9, G.v);
  if (G.v < 0 && Math.random() < dt * 1.2) floatText(G.bx, G.by + 3.2, 0, '勢いが尽きた…硬貨を吸え！', '#ffb0b0', 18, 0.8);
  G.by += (G.v / UNIT_M) * dt;
  G.score += Math.max(0, G.v) * dt * (G.dai > 0 ? 3 : 1) | 0;

  // 段階の判定
  const stageAlt = altM() - st.start;
  if (stageAlt >= st.goal) { stageClear(); return; }
  if (!G.fever && stageAlt >= st.goal * FEVER_AT) {
    G.fever = true;
    banner('賽銭の嵐！', `${HENSHIN_NEED}枚吸い込めば大仏に…！`);
    audio.koban();
  }

  G.gori = Math.max(0, G.gori - dt); G.curse = Math.max(0, G.curse - dt); G.inv = Math.max(0, G.inv - dt);
  G.comboT -= dt;
  if (G.comboT <= 0 && G.combo > 0) {
    if (G.combo >= 5) { // 途切れた：周りの光がはらはらと散る
      const n = Math.min(40, G.combo);
      for (let k = 0; k < n && parts.length < MAXP; k++) { const a = Math.random() * 6.28, r = 1.4 * bScale(); parts.push({ x: G.bx + Math.cos(a) * r, y: G.by + 1.2 * bScale() + Math.sin(a) * r * 0.5, z: Math.sin(a) * 0.4, vx: Math.cos(a) * 0.8, vy: -1.5 - Math.random() * 2 + G.v / UNIT_M, vz: 0, life: 0.9, max: 0.9, r: 0.75, g: 0.65, b: 0.45, grav: 3 }); }
    }
    G.combo = 0;
  }
  G.fovKick *= Math.pow(0.15, dt); G.shake *= Math.pow(0.05, dt);

  // カメラ追従（落下中は追わない）
  // 加速度を平滑化 → 加速した分だけ仏像が画面の上へ押し出され、カメラが遅れて追いつく
  const accel = (G.v - (G.prevV ?? G.v)) / Math.max(dt, 1e-3); G.prevV = G.v;
  G.accSm += (accel - G.accSm) * Math.min(1, dt * 6);
  const liftTarget = THREE.MathUtils.clamp(G.accSm * 0.09, -0.6, 2.8);
  G.lift += (liftTarget - G.lift) * Math.min(1, dt * (liftTarget > G.lift ? 9 : 2.2));
  G.thrust = Math.max(G.gori > 0 || G.dai > 0 ? 1.2 : 0, G.thrust - dt * 2.2);
  G.surge = (G.surge || 0) * Math.pow(0.002, dt);
  const camTarget = G.by + 3.6 - G.lift; // 仏像は画面の下寄り（上に続く硬貨の道を見せる）
  if (camTarget > G.camY) G.camY += (camTarget - G.camY) * Math.min(1, dt * 5); // 落ちるときはカメラは追わない
  if (G.by < G.camY - viewHalfH - 3.5) { gameOver(); return; }

  // 硬貨の道を先まで敷く
  extendPath(G.camY + viewHalfH + 12);
  G.foeAcc += dt * st.foeRate * (altM() > 60 && !G.fever ? 1 : 0);
  while (G.foeAcc > 1) { G.foeAcc -= 1; spawnFoe(G.camY, viewHalfH); }

  // 硬貨：空中に止まっている。吸引中は仏像の上方の範囲から口へ引き寄せる
  const R = suckR(), P = suckPow();
  mouthW.set(G.bx, G.by + 2.7 * S, -0.2);           // 吸い込み口は頭上
  const tx = G.bx, ty = G.by + 2.7 * S;
  const cx = G.bx, cy = ty + R * 0.75;          // 吸引範囲は仏像の上に伸びる
  const rx = Math.min(R * 0.3, 1.5) + (G.dai > 0 ? 6 : 0), ry = R * 1.4; // 真上の細い柱だけを吸う // 横幅は細く：左右に動いて狙う
  G.suck = { cx, cy, rx, ry, tx, ty };
  const bvy = G.v / UNIT_M;
  const damp = Math.pow(0.02, dt);
  for (let i = G.coins.length - 1; i >= 0; i--) {
    const c = G.coins[i];
    c.spin += dt * (c.pulled ? 14 : c.type === 'noroi' ? 1.5 : 2.2); c.ph += dt * 2;
    const ex = (c.x - cx) / rx, ey = (c.y - cy) / ry;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1e-3;
    if (sucking && (c.pulled || ex * ex + ey * ey < 1)) {
      // 仏像の頭上へ向かって飛んでいく（近づくほど速く、少し渦を巻く）
      const ux = dx / d, uy = dy / d;
      const speed = 6 + 22 * (1 - Math.min(1, d / (R * 1.8))) + (G.gori > 0 || G.dai > 0 ? 8 : 0);
      const swirl = Math.min(1, d / 2) * 2.5 * Math.sin(c.ph * 2);
      const wantX = ux * speed - uy * swirl, wantY = uy * speed + ux * swirl;
      let rvx = c.vx - G.bvx * 0.7, rvy = c.vy - bvy;
      const k = Math.min(1, dt * 7);
      rvx += (wantX - rvx) * k; rvy += (wantY - rvy) * k;
      c.vx = rvx + G.bvx * 0.7; c.vy = rvy + bvy;
      c.pulled = true;
      if (Math.random() < dt * 12) emit(c.x, c.y, c.z, c.type === 'noroi' ? 0x9a40ff : 0xffe6a0, 1, 0.4, 0.35);
    } else {
      c.vx *= Math.pow(0.05, dt); c.vy *= Math.pow(0.05, dt); c.pulled = false;
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.pulled) c.z += (-0.35 - c.z) * Math.min(1, dt * 6); // 仏像より奥を通って頭上へ
    const grab = sucking ? 0.45 * S + COINS[c.type].r * 0.3 : 0.55 * S;
    const gd = sucking ? d : Math.hypot(G.bx - c.x, G.by + 1.0 * S - c.y);
    if (gd < grab) { absorb(c); freeCoin(c); G.coins.splice(i, 1); continue; }
    if (c.y < G.camY - viewHalfH - 4) { freeCoin(c); G.coins.splice(i, 1); continue; }
    c.obj.position.set(c.x, c.y + (c.pulled ? 0 : Math.sin(c.ph) * 0.06), c.z);
    const shrink = c.pulled ? THREE.MathUtils.clamp(d / 1.6, 0.2, 1) : 1; // 頭上で小さくなって消える
    c.obj.scale.setScalar(1.15 * shrink);
    c.obj.userData.mesh.rotation.set(Math.sin(c.ph) * 0.3, c.spin, Math.sin(c.ph * 0.7) * 0.15);
    if (c.obj.userData.glow && c.type === 'goriyaku') c.obj.userData.glow.material.opacity = 0.7 + Math.sin(G.time * 6) * 0.2;
  }

  // 障害物
  for (let i = G.foes.length - 1; i >= 0; i--) {
    const f = G.foes[i];
    f.t += dt;
    if (f.kind === 'crow') {
      if (f.warnT > 0) { // 警告中はまだ飛んでこない
        f.warnT -= dt;
        proj.set(0, f.y, 0.3).project(camera);
        f.warn.style.top = ((1 - proj.y) / 2 * appH) + 'px';
        if (f.warnT <= 0) { f.warn.remove(); f.warn = null; }
        continue;
      }
      f.x += f.vx * dt; f.y += Math.sin(f.t * 4) * 0.6 * dt;
      f.obj.position.set(f.x, f.y, 0.3);
      const flap = Math.sin(f.t * 16) * 0.9;
      f.obj.userData.wings[0].rotation.x = -flap; f.obj.userData.wings[1].rotation.x = flap;
      if (Math.hypot(G.bx - f.x, G.by + 1.0 * S - f.y) < 0.6 * S + f.r) {
        if (G.dai > 0 || G.gori > 0) { G.score += 200; emit(f.x, f.y, 0, 0xfff0c0, 24, 6); scene.remove(f.obj); G.foes.splice(i, 1); continue; }
        // カラスに当たったら即アウト
        audio.hit(); flash(0.5); G.shake = 1;
        emit(f.x, f.y, 0, 0x222228, 30, 6, 1);
        gameOver('カラスに当たった！'); return;
      }
      if (Math.abs(f.x) > 16) { scene.remove(f.obj); G.foes.splice(i, 1); continue; }
    } else {
      f.x += f.vx * dt; if (Math.abs(f.x) > XB) f.vx *= -1;
      f.obj.position.x = f.x;
      const cyc = f.t % 3.4;
      const charging = cyc > 2.2 && cyc < 2.9, striking = cyc >= 2.9;
      f.glowS.material.opacity = charging ? 0.3 + Math.random() * 0.5 : striking ? 1 : 0;
      if (striking && !f.struck) {
        f.struck = true; f.bolt.geometry.dispose(); f.bolt.geometry = boltGeometry(); f.bolt.visible = true;
        audio.thunder(); flash(0.25);
        if (Math.abs(G.bx - f.x) < 0.6 + 0.4 * S && G.by < f.y && G.by > f.y - 24) hurt(10, '落雷！ 失速');
      }
      if (!striking) { f.struck = false; f.bolt.visible = false; }
      if (f.y < G.camY - viewHalfH - 8) { scene.remove(f.obj); G.foes.splice(i, 1); continue; }
    }
  }

}

function hurt(amount, label) {
  if (G.inv > 0 || G.dai > 0 || G.gori > 0) return;
  G.v -= amount; // 勢いを失う
  G.inv = 1.2; G.combo = 0; G.shake = 0.5;
  audio.hit(); flash(0.2);
  floatText(G.bx, G.by + 3.6, 0, label, '#ff8a7a', 20, 1.1);
}

function absorb(c) {
  const d = COINS[c.type];
  const S = bScale();
  if (c.type === 'noroi') {
    if (G.gori > 0 || G.dai > 0) { G.score += 150; emit(c.x, c.y, 0, 0xe0c0ff, 14, 4); audio.coin(12); return; }
    const lost = Math.min(G.money, Math.floor(G.money * 0.06) + 30);
    G.money -= lost;
    G.v += d.boost; // 失速
    G.curse = 1.3; G.combo = 0; G.shake = 0.6;
    audio.curse(); flash(0.15);
    emit(c.x, c.y, 0, 0x8a20ff, 40, 6, 1);
    if (!G.cursedMsg || G.time - G.cursedMsg > 1.4) { G.cursedMsg = G.time; floatText(G.bx, G.by + 4, 0, '呪いの銭！ 呪縛で吸えない', '#e6a0ff', 20, 1.2); }
    return;
  }
  G.combo++; G.comboT = 0.85; G.maxCombo = Math.max(G.maxCombo, G.combo);
  const mult = 1 + Math.min(4, Math.floor(G.combo / 15));
  G.money += d.money; G.stageMoney += d.money;
  G.score += d.money * mult * (G.dai > 0 ? 2 : 1);
  G.v += d.boost * (1 + Math.min(G.combo, 40) * 0.015) * (G.v > maxSpeed() ? 0.3 : G.v < 0 ? 2 : 1); // 吸うたびに加速（連続ほど強く・落下中は起死回生で2倍）
  G.thrust = Math.min(2.5, G.thrust + d.boost * 0.35 + 0.15);
  G.fovKick += Math.min(1.2, d.boost * 0.9);
  // 吸った瞬間に上へ：位置を押し上げ、仏像が跳ね、カメラは遅れて追う
  G.by += 0.06 + d.boost * 0.025;
  G.surge = Math.min(1.6, (G.surge || 0) + 0.3 + d.boost * 0.1);
  G.lift = Math.min(2.8, G.lift + 0.18 + d.boost * 0.07);
  // 周りの光が口へ吸い込まれる
  inhale(4 + Math.round(d.boost * 2), 1.4 + d.boost * 0.2 * S);
  if (G.fever) { G.feverCount++; if (G.feverCount === HENSHIN_NEED && G.dai <= 0) henshin(); }
  if (c.type === 'koban') {
    audio.koban(); G.fovKick += 4; G.shake = Math.max(G.shake, 0.15);
    inhale(30, 3.2, 0xffe066);
    inhaleRing(4.5, 0xffe08a);
  } else if (c.type === 'goriyaku') {
    audio.goriyaku(); G.gori = 6; flash(0.5); G.fovKick += 16; G.shake = 0.5; G.lift = Math.min(2.8, G.lift + 1.5); G.surge = 1.6;
    banner('御利益！', '');
    inhale(70, 5, 0xfff2a0);
    inhaleRing(8, 0xfff2b0); setTimeout(() => G && inhaleRing(5, 0xfff2b0), 150);
  } else {
    audio.coin(Math.min(25, G.combo));
    if (G.combo % 5 === 0) { // 5連続ごと：光の輪が吸い込まれ、鈴が鳴る
      const lv = Math.min(6, G.combo / 5);
      inhaleRing(2.5 + lv * 0.8, lv >= 4 ? 0xfff6d0 : 0xffe08a);
      inhale(10 + lv * 6, 2 + lv * 0.4, 0xfff0b0);
      audio.chime(lv); flash(0.06 + lv * 0.02); G.fovKick += 1 + lv * 0.5;
    }
  }
  // 成長
  let nf = G.form;
  while (nf + 1 < FORMS.length && G.money >= FORMS[nf + 1].need && G.stage >= FORMS[nf + 1].minStage) nf++; // お金とステージの両方が必要
  if (nf > G.form) {
    G.form = nf;
    if (G.dai <= 0) setModel(FORMS[nf].lv);
    audio.level(); flash(0.5); G.fovKick += 6;
    banner('進化！', `Lv.${FORMS[nf].lv} ${FORMS[nf].name}`);
    inhale(120, 6, 0xffe680);
    inhaleRing(10, 0xffe6a0); setTimeout(() => G && inhaleRing(6, 0xffe6a0), 180);
  }
}

function henshin() {
  G.dai = 1; G.henshins++; G.v += 25; G.fovKick += 16; G.shake = 0.8;
  setModel(5);
  flash(0.9); audio.henshin();
  banner('大仏変身！！', '天へ駆け上がれ！');
  emit(G.bx, G.by + 2, 0, 0xfff6a0, 200, 14, 1.6);
  shockwave(G.bx, G.by, 0xfff2b0, 16);
}

let resultKind = 'clear';
function stageClear() {
  state = 'result'; resultKind = 'clear';
  input.down = input.key = false;
  const bonus = Math.round(Math.max(0, G.v)) * 30 + (G.dai > 0 ? 3000 : 0);
  G.score += bonus;
  const last = G.stage + 1 >= STAGES.length;
  saveBest();
  audio.gong(); audio.level(); flash(0.4);
  $('resTitle').textContent = last ? '成仏！' : 'ステージクリア！';
  $('resAlt').textContent = Math.floor(altM()).toLocaleString() + 'm';
  $('resMoney').textContent = G.money.toLocaleString();
  $('resRibbon').textContent = G.dai > 0 ? '大仏変身ボーナス +3,000' : `第${G.stage + 1}天「${STAGES[G.stage].name}」踏破`;
  $('resLines').innerHTML = [
    `このステージの賽銭 <b>¥${G.stageMoney.toLocaleString()}</b>`,
    `勢いボーナス <b>+${(Math.round(Math.max(0, G.v)) * 30).toLocaleString()}</b>`,
    `仏像：<b>Lv.${form().lv} ${form().name}</b>`,
    `スコア <b>${G.score.toLocaleString()}</b>`,
    last ? `黄金の大仏は極楽浄土へ到達した<br>称号：<b>${rank(G.score)}</b>` : `次は「<b>${STAGES[G.stage + 1].name}</b>」へ`,
  ].join('<br>');
  $('resNext').textContent = last ? 'もう一度遊ぶ' : '次へ';
  if (last) { resultKind = 'end'; setModel(5); G.dai = 1; }
  show('result', true); show('hud', false);
}
function gameOver(reason = '') {
  state = 'result'; resultKind = 'over';
  input.down = input.key = false;
  saveBest();
  audio.over();
  $('resTitle').textContent = reason ? 'カラスに激突…' : '墜落…';
  $('resAlt').textContent = Math.floor(G.maxAlt || altM()).toLocaleString() + 'm';
  $('resMoney').textContent = G.money.toLocaleString();
  $('resRibbon').textContent = `称号：${rank(G.score)}`;
  $('resLines').innerHTML = [reason || `第${G.stage + 1}天「${STAGES[G.stage].name}」で力尽きた`, `スコア <b>${G.score.toLocaleString()}</b>　最大 <b>${G.maxCombo}</b> 連続`, `ベストスコア <b>${best.score.toLocaleString()}</b>`].join('<br>');
  $('resNext').textContent = 'もう一度遊ぶ';
  show('result', true); show('hud', false);
}
function rank(s) {
  if (s >= 90000) return '如来'; if (s >= 50000) return '菩薩'; if (s >= 25000) return '明王';
  if (s >= 10000) return '天部'; if (s >= 3000) return '修行僧'; return '煩悩まみれ';
}
function saveBest() {
  const a = Math.floor(G.maxAlt || altM());
  if (G.score > best.score || a > best.alt) { best = { score: Math.max(best.score, G.score), alt: Math.max(best.alt, a) }; store.set('best', best); }
  refreshBest();
}

// ---------- HUD ----------
let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHUD() {
  const st = STAGES[G.stage];
  setText('score', G.score.toLocaleString());
  setText('alt', Math.floor(altM()).toLocaleString());
  setText('speed', Math.max(0, Math.round(G.v)).toString());
  setText('money', G.money.toLocaleString());
  setText('formName', G.dai > 0 ? '巨大大仏' : `Lv.${form().lv} ${form().name}`);
  setText('goalLbl', `▲ ${Math.max(0, Math.ceil(st.start + st.goal - altM())).toLocaleString()}m`);
  const s = '';
  setText('status', s);
}

// ---------- 描画まわりの更新 ----------
const lookAt = new THREE.Vector3();
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
let titleT = 0;
const titleCoins = [];

function frameVisuals(dt, t) {
  let speed01 = 0, camY, bx, by, S;
  if (G && state !== 'title') {
    speed01 = THREE.MathUtils.clamp((G.v - 12) / 40, 0, 1);
    camY = G.camY; bx = G.bx; by = G.by; S = bScale();
    G.maxAlt = Math.max(G.maxAlt || 0, altM());
  }

  if (!G || state === 'title') {
    // タイトル：境内で硬貨を吸い込む仏像を、カメラがゆっくり回る
    titleT += dt;
    const lv = 1; // タイトルは木造仏から
    if (!model || model.userData.lv !== lv) setModel(lv);
    by = 1.6; bx = 0; S = lv === 5 ? 1.35 : 1.1;
    buddhaRoot.position.set(0, by + Math.sin(t * 0.0015) * 0.15, 0);
    buddhaRoot.scale.setScalar(S);
    buddhaRoot.rotation.set(0, Math.sin(titleT * 0.3) * 0.25, 0);
    const a = titleT * 0.12;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(Math.sin(a) * 9, by + 1.2, 16 + Math.cos(a) * 2);
    lookAt.set(0, by + 3.6, 0); camera.lookAt(lookAt);
    // 上に連なる硬貨が渦を巻いて口へ吸い込まれる
    if (titleCoins.length < 46 && Math.random() < 0.45) {
      const types = ['zeni', 'zeni', 'zeni', 'koban', 'zeni', 'goriyaku'];
      const o = makeCoinMesh(types[Math.random() * types.length | 0]); scene.add(o);
      titleCoins.push({ o, a: Math.random() * 6.28, r: 1.4 + Math.random() * 1.4, y: by + 10, s: Math.random() * 6, vy: 2.2 + Math.random() * 1.2 });
    }
    for (let i = titleCoins.length - 1; i >= 0; i--) {
      const c = titleCoins[i];
      const target = by + 1.85 * S;
      c.a += dt * 3.2; c.y -= c.vy * dt; c.s += dt * 7;
      const u = THREE.MathUtils.clamp((by + 10 - c.y) / (by + 10 - target), 0, 1);
      const rr = c.r * (1 - u * 0.9);
      c.o.position.set(Math.cos(c.a) * rr, c.y, Math.sin(c.a) * rr * 0.7 + 0.4);
      c.o.userData.mesh.rotation.set(0.4, c.s, 0);
      c.o.scale.setScalar(1 - u * 0.5);
      if (c.y < target) { scene.remove(c.o); titleCoins.splice(i, 1); emit(0, target, 0.4, 0xffd070, 3, 1.2, 0.5); }
    }
    model.userData.mouth.scale.y = 0.04;
    world.update(0, camera.position, t);
    for (const L of lineData) L.k = 0; lineMat.opacity = 0;
    swirl.visible = false;
    updatePillars(t, by + 10, 0);
    updateMotesFor(by);
    aura.material.opacity = 0.18;
    return;
  }
  for (const c of titleCoins) scene.remove(c.o); titleCoins.length = 0;

  // 仏像の姿勢
  const bob = Math.sin(t * 0.003) * 0.08;
  const surge = G.surge || 0;
  buddhaRoot.position.set(bx, by + bob + surge * 0.55, 0);
  G.baseS = (G.baseS || S) + (S - (G.baseS || S)) * Math.min(1, dt * 3);
  buddhaRoot.scale.set(G.baseS * (1 - surge * 0.035), G.baseS * (1 + surge * 0.08), G.baseS * (1 - surge * 0.035)); // 上へ伸びる
  // 左右に動くと進む方向へ向きを変え、少し傾く（止まると正面に戻る）
  const yawTarget = THREE.MathUtils.clamp(G.bvx * 0.11, -1.1, 1.1);
  G.yaw = (G.yaw || 0) + (yawTarget - (G.yaw || 0)) * Math.min(1, dt * 6);
  buddhaRoot.rotation.set(-speed01 * 0.12 - G.thrust * 0.04, G.yaw, -G.yaw * 0.22);
  const ud = model.userData;
  ud.mouth.scale.set(0.06 + G.mouth * 0.03, 0.006 + G.mouth * 0.07, 0.02 + G.mouth * 0.02);
  ud.lipL.position.y = -0.29 - G.mouth * 0.04;
  if (ud.halo) ud.halo.rotation.z += dt * (0.2 + speed01 * 1.5) * (ud.lv >= 3 ? 0.2 : 0.4);
  if (ud.glow) ud.glow.material.opacity = 0.22 + speed01 * 0.2 + (G.gori > 0 ? 0.2 : 0);
  const comboK = Math.min(1, G.combo / 30);
  aura.material.opacity = 0.12 + speed01 * 0.2 + comboK * 0.35 + (G.dai > 0 ? 0.2 : 0);
  aura.scale.setScalar(4 + speed01 * 3 + comboK * 4 + Math.sin(t * 0.012) * comboK * 0.6);
  // 連続数に応じて仏像の周りを回る光の粒が増える
  const orbitN = Math.min(30, G.combo);
  for (let k = 0; k < orbitN; k += 6) {
    if (parts.length >= MAXP) break;
    const a = t * 0.004 + (k / Math.max(1, orbitN)) * Math.PI * 2 + Math.random() * 0.2, r = (1.3 + comboK * 0.6) * S;
    parts.push({ x: bx + Math.cos(a) * r, y: by + 1.2 * S + Math.sin(a * 2) * 0.3 * S, z: Math.sin(a) * r * 0.6, vx: -Math.sin(a) * 1.5, vy: G.v / UNIT_M, vz: Math.cos(a) * 0.9, life: 0.35, max: 0.35, r: 1, g: 0.86 + comboK * 0.1, b: 0.5 + comboK * 0.4, grav: 0 });
  }
  aura.material.color.set(G.curse > 0 ? 0x9a40ff : 0xffc860);
  // 点滅（無敵時間）
  model.visible = !(G.inv > 0 && Math.floor(t / 70) % 2);

  // 吸い上げの渦
  swirl.visible = !!G.sucking && !!G.suck;
  if (swirl.visible) {
    const k = G.suck, base = k.ty, topY = k.cy + k.ry * 0.95;
    const h = Math.max(1, topY - base);
    swirl.position.set(bx, base, 0.3 * S);
    const boost = G.gori > 0 || G.dai > 0 ? 1.4 : 1;
    vortex.scale.set(k.rx * 0.95, h, k.rx * 0.6); vortex2.scale.set(k.rx * 0.7, h, k.rx * 0.45);
    vortexTex.offset.set(-t * 0.0012, t * 0.0016);
    vortexMat.opacity = 0.42 * boost; vortex2.material.opacity = 0.25 * boost;
    vortex2.rotation.y = -t * 0.003;
    swirlRings.forEach((r, i) => {
      const u = (t * 0.0007 + i / swirlRings.length) % 1; // 上から口へ降りてきて細くなる
      r.position.y = h * (1 - u);
      const rad = k.rx * (0.18 + 0.82 * (1 - u));
      r.scale.set(rad, rad, 1); r.material.opacity = Math.sin(u * Math.PI) * 0.6 * boost;
    });
    if (Math.random() < 0.6) { // 渦を口へ吸い込まれる光の粒
      const a2 = Math.random() * 6.28, yy = base + Math.random() * h, rr = k.rx * (0.2 + 0.8 * (yy - base) / h);
      parts.length < MAXP && parts.push({ x: bx + Math.cos(a2) * rr, y: yy, z: Math.sin(a2) * rr * 0.6, vx: -Math.sin(a2) * 2, vy: -3 - Math.random() * 2 + G.v / UNIT_M, vz: Math.cos(a2) * 1.2, life: 0.6, max: 0.6, r: 1, g: 0.88, b: 0.55, grav: 0 });
    }
  }

  // カメラ（速度で視野が広がる＝ドリーズーム）
  const fov = 52 + speed01 * 24 + Math.min(20, G.fovKick) + G.thrust * 2.5;
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 5);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  viewDist = Math.max(VIEW_H / 2 / tanH, VIEW_W / 2 / (tanH * camera.aspect));
  viewHalfH = viewDist * tanH;
  const shx = (Math.random() - 0.5) * G.shake, shy = (Math.random() - 0.5) * G.shake;
  camera.position.set(bx * 0.25 + shx, camY - viewDist * 0.1 + shy, viewDist);
  lookAt.set(bx * 0.18, camY + 0.6, 0);
  camera.lookAt(lookAt);
  camera.updateProjectionMatrix();

  // 光
  world.key.position.set(bx, by + 2.5 * S, 3.5 * S);
  world.key.intensity = 14 + speed01 * 10 + (G.dai > 0 ? 20 : 0);

  world.update(altM(), camera.position, t);
  updatePillars(t, camY, speed01);

  // スピード線
  lineMat.opacity = Math.min(0.85, Math.max(0, speed01 * 0.75 - 0.05) + G.thrust * 0.18);
  const lineSpeed = (Math.max(0, G.v) / UNIT_M) * (3.2 + G.thrust * 1.5);
  for (let i = 0; i < LINES; i++) {
    const L = lineData[i];
    L.y -= lineSpeed * L.k * dt;
    if (L.y < camY - viewHalfH * 1.6) resetLine(L, camY, viewHalfH * 1.4, false);
    const len = 0.6 + (speed01 * 7 + G.thrust * 2) * L.k;
    p4.set(L.x, L.y, L.z); s4.set(1 + speed01, len, 1); q4.identity();
    m4.compose(p4, q4, s4); lines.setMatrixAt(i, m4);
  }
  lines.instanceMatrix.needsUpdate = true;
  updateMotesFor(camY);

  // 衝撃波
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i]; s.t += dt;
    const k = s.t / (s.inward ? 0.45 : 0.7);
    if (s.inward) { s.m.position.set(mouthW.x, mouthW.y, 0.6); s.m.scale.setScalar(0.15 + (1 - k) * s.size); s.m.material.opacity = Math.max(0, 0.9 * Math.sin(Math.min(1, k) * Math.PI)); }
    else { s.m.scale.setScalar(1 + k * s.size); s.m.material.opacity = Math.max(0, 0.9 * (1 - k)); }
    if (k >= 1) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); shockwaves.splice(i, 1); }
  }
  // すれ違う雲（近くを高速で抜けていく）
  for (const c of world.passClouds) c.material.opacity = 0.25 + speed01 * 0.35;

  // 音楽の盛り上がりと風
  audio.intensity = Math.min(1, speed01 * 0.9 + (G.fever ? 0.25 : 0) + (G.dai > 0 ? 0.4 : 0));
  audio.setWind(state === 'play' ? speed01 : 0);
}

function updatePillars(t, cy, speed01) {
  const alt = G ? altM() : 0;
  const strength = alt > 6900 ? 0.6 : alt < 900 ? 0.45 : 0.2;
  for (const p of pillars) {
    p.position.set(p.userData.ox, cy + 25, p.userData.oz);
    p.lookAt(camera.position.x, p.position.y, camera.position.z);
    p.material.opacity = (0.12 + 0.1 * Math.sin(t * 0.0008 + p.userData.ph)) * strength * (1 + speed01);
  }
}
function updateMotesFor(cy) {
  for (let i = 0; i < MOTES; i++) {
    let y = mPos[i * 3 + 1];
    if (y < cy - 30) y += 60; else if (y > cy + 30) y -= 60;
    mPos[i * 3 + 1] = y;
  }
  mGeo.attributes.position.needsUpdate = true;
  const alt = G ? altM() : 0;
  motes.material.color.set(alt < 1200 || alt > 6900 ? 0xffc8dc : alt > 4500 && alt < 6900 ? 0xd8e0ff : 0xfff4d0);
}

// ---------- ループ ----------
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function adaptQuality(dt) {
  if (state !== 'play') { fpsAcc = fpsN = fpsT = 0; return; }
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT < 2.5) return;
  const fps = fpsN / fpsAcc; fpsAcc = fpsN = fpsT = 0;
  if (fps < 48 && quality < QUALITY.length - 1) { quality++; resize(); }
}
function loop(now) {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(0.05, rawDt);
  last = now;
  adaptQuality(Math.min(0.2, rawDt));
  if (G && state === 'play') { update(dt); }
  if (G && state === 'play') updateHUD();
  if (G && state === 'result') { // 結果画面では仏像の周りをゆっくり回る
    const a = now * 0.0003;
    camera.position.set(G.bx + Math.sin(a) * 10, G.by + 3, Math.cos(a) * 10 + 4);
    lookAt.set(G.bx, G.by + 2, 0); camera.lookAt(lookAt);
    buddhaRoot.position.set(G.bx, G.by, 0);
    if (resultKind === 'end') buddhaRoot.scale.setScalar(2.1);
    world.update(altM(), camera.position, now);
    audio.setWind(0);
  } else if (state !== 'paused') frameVisuals(dt, now);
  updateParts(dt);
  updateFloaters(dt);
  if (bannerT > 0) { bannerT -= dt; $('banner').style.opacity = Math.min(1, bannerT * 2); }
  if (flashV > 0) { flashV = Math.max(0, flashV - dt * 1.8); $('flash').style.opacity = flashV; }
  composer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 動作確認用
window.__buddha = { get state() { return state; }, get G() { return G; }, input, setModel, world, camera, scene, renderer, composer, step(n, dt = 1 / 60) { for (let i = 0; i < n && state === 'play'; i++) update(dt); } };
