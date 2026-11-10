// 空飛ぶ仏像 3D — お金を吸い込め！仏の力で天まで昇れ！
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildBuddha, buildSkin, makeCoinMesh, makeCrow, glowTexture, dotTexture } from './models.js?v=202611102118';
import { World, UNIT_M, makeLightPillars } from './world.js?v=202611102118';
import { t, lang, setLang, applyStatic } from './i18n.js?v=202611102118';
import { AudioEngine } from './audio.js?v=202611102118';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('flyingBuddha3d.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('flyingBuddha3d.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// ---------- 定数 ----------
const STAGES = [
  { name: '地上の寺院', goal: 1800, curse: 0.07, foeRate: 0.32, foes: ['crow'], grav: 6.5, scroll: 12 },
  { name: '山頂',       goal: 1500, curse: 0.11, foeRate: 0.42, foes: ['crow', 'crow', 'crow', 'thunder'], grav: 7.3, scroll: 14 },
  { name: '雲海',       goal: 1800, curse: 0.15, foeRate: 0.48, foes: ['crow', 'crow', 'thunder'], grav: 8.1, scroll: 16 },
  { name: '天空',       goal: 2100, curse: 0.19, foeRate: 0.5, foes: ['crow', 'crow', 'thunder'], grav: 8.9, scroll: 18 },
  { name: '極楽浄土',   goal: 2400, curse: 0.22, foeRate: 0.25, foes: ['crow'], grav: 9.7, scroll: 20 },
];
let acc = 0; STAGES.forEach((s) => { s.start = acc; acc += s.goal; });
const FORMS = [
  { lv: 1, name: '木造仏', need: 0, scale: 0.95 },
  { lv: 2, name: '黒漆の仏像', need: 12000, minStage: 0, scale: 1.0 },
  { lv: 3, name: '光背の仏像', need: 30000, minStage: 1, scale: 1.05 },
  { lv: 4, name: '鎌倉の大仏', need: 55000, minStage: 2, scale: 1.2 },
  { lv: 5, name: '黄金の大仏', need: 85000, minStage: 3, scale: 1.35 },
];
const COINS = {
  zeni: { money: 10, r: 0.46, boost: 18, w: 70 },  // boost: 逆重力で得る速度（m/s）
  koban: { money: 300, r: 0.6, boost: 30, w: 9 },
  goriyaku: { money: 500, r: 0.45, boost: 16, w: 2.2 },
  noroi: { money: 0, r: 0.38, boost: -5, w: 0 },
};
// 物理の定数（m/s, m/s²）
const PHYS = { g: 16, drag: 0.0042, camDown: 1.5 /* ユニット/秒 */ }; // 重力は強め：取り逃すとすぐ落ちる
const STOMP_JUMP_M = 80; // カラスを踏んだときに跳ね上がる高さ（m）
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
// 確認用：URLに ?lv=1〜5 を付けると、タイトル画面にその形態の仏像を出す
const ZOOM = Math.max(1, Math.min(3, parseFloat(new URLSearchParams(location.search).get('zoom')) || 1)); // 確認用：タイトルで仏像を拡大
const FORCE_LV = Math.max(0, Math.min(5, parseInt(new URLSearchParams(location.search).get('lv'), 10) || 0));
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
  if (isMobile || W / H <= 0.62) { appW = W; appH = H; } // タッチ端末（スマホ・タブレット）は縦横比に関係なく全面。PCだけ縦長の枠
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
window.__audio = audio;
function toggleSound() { audio.setMuted(!audio.muted); store.set('muted', audio.muted); updateSoundBtns(); }
function updateSoundBtns() { for (const id of ['soundBtn', 'pauseSound']) $(id).textContent = audio.muted ? t('soundOff') : t('soundOn'); }
applyStatic();
const stageLabel = (i) => t('stage', { n: i + 1, name: t('stages')[i] });
const formLabel = (f) => skin !== 'buddha' ? `Lv.${f.lv} ${t('skins')[SKINS.indexOf(skin)]}` : `Lv.${f.lv} ${t('forms')[f.lv - 1]}`;
updateSoundBtns();
// 音はゲーム開始前にすべて作っておく（スマホで音が切れないように）
$('startBtn').disabled = true;
audio.preload((k) => { $('startBtn').textContent = t('loading', { p: Math.round(k * 80) }); }).then(async () => {
  await warmUp((k) => { $('startBtn').textContent = t('finishing', { p: 80 + Math.round(k * 20) }); });
  $('startBtn').disabled = false; $('startBtn').textContent = t('start');
});

// ---------- 振動（音をオフにしているときは震えない） ----------
let lastVib = 0;
function vib(pattern, minGap = 0) {
  try {
    const now = performance.now();
    if (audio.muted || !navigator.vibrate || now - lastVib < minGap) return;
    lastVib = now; navigator.vibrate(pattern);
  } catch (e) { /* 振動できない端末は何もしない */ }
}
// ---------- スローモーション（ニアミスの演出） ----------
let timeScale = 1, slowT = 0;
function slowmo(sec, scale = 0.3) { slowT = Math.max(slowT, sec); timeScale = scale; }

// ---------- お寺：集めた賽銭を貯めて寄進し、境内に建物が増えていく ----------
const BUILDINGS = [
  { id: 'sanmon', cost: 3000, unlock: 'daruma' },
  { id: 'lanterns', cost: 8000 },
  { id: 'hondo', cost: 20000, unlock: 'kannon' },
  { id: 'shoro', cost: 40000 },
  { id: 'pagoda', cost: 70000, unlock: 'fudo' },
  { id: 'daibutsuden', cost: 120000 },
];
const SKINS = ['buddha', 'daruma', 'kannon', 'fudo'];
let temple = store.get('temple', { wallet: 0, built: [] });
let skin = store.get('skin', 'buddha');
const hasB = (id) => temple.built.includes(id);
const skinUnlocked = (k) => k === 'buddha' || BUILDINGS.some((b) => b.unlock === k && hasB(b.id));
if (!skinUnlocked(skin)) skin = 'buddha';
// 寄進で得られる永続的な強化
function perks() {
  return {
    suck: 1 + (hasB('sanmon') ? 0.15 : 0) + (hasB('pagoda') ? 0.15 : 0),   // 吸引範囲
    lift: hasB('shoro') ? 1.12 : 1,                                         // 硬貨の浮力
    charms: (hasB('lanterns') ? 1 : 0) + (hasB('daibutsuden') ? 1 : 0),   // お守り（カラスに耐える回数）
    start: hasB('pagoda') ? 800 : hasB('hondo') ? 300 : 0,                 // スタートの高さ（m）
  };
}

// ---------- 下準備：途中で初めて出る物を、ゲーム開始前に用意しておく ----------
// （スマホでは、初めて描く物の準備に0.1〜0.3秒かかり、プレイ中だとカクッと止まるため）
async function warmUp(onProgress = () => {}) {
  const idle = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); // 1体ごとに画面を更新する
  try {
    const tmp = new THREE.Group(); scene.add(tmp);
    for (let lv = 1; lv <= 5; lv++) { if (!modelCache[lv]) modelCache[lv] = buildBuddha(lv); onProgress(lv / 7); await idle(); } // 進化する仏像を全部作っておく
    if (skin !== 'buddha' && !modelCache[skin]) modelCache[skin] = buildSkin(skin);
    const show = [...Object.values(modelCache).filter((m) => m !== model), ghost];
    for (let i = 0; i < 2; i++) crowPool.n.push(getCrow(false)); crowPool.g.push(getCrow(true));
    for (const tp of ['zeni', 'koban', 'goriyaku']) for (let i = 0; i < 4; i++) { const o = makeCoinMesh(tp); scene.add(o); o.visible = false; coinPool[tp].push(o); show.push(o); }
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(RING_OUT, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); scene.add(m); m.visible = false; shockPool.push(m); show.push(m); }
    for (const m of show) { if (!m.parent) tmp.add(m); m.visible = true; }
    for (const o of [...crowPool.n, ...crowPool.g]) o.visible = true;
    onProgress(6 / 7); await idle();
    // 描画プログラムの準備（使えれば画面を止めない非同期の準備）
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    onProgress(1);
    for (const m of show) m.visible = false;
    for (const o of [...crowPool.n, ...crowPool.g]) o.visible = false;
    for (const m of Object.values(modelCache)) if (m.parent === tmp) tmp.remove(m);
    ghost.visible = false; if (ghost.parent !== scene) scene.add(ghost);
  } catch (e) { /* 下準備に失敗しても遊べる */ }
}

// ---------- 仏像 ----------
const buddhaRoot = new THREE.Group(); scene.add(buddhaRoot);
const modelCache = {};
let model = null;
function setModel(lv) {
  // 寄進で解放した仏像を選んでいるときは、その仏像のまま大きく育つ
  const key = skin !== 'buddha' ? skin : lv;
  if (!modelCache[key]) modelCache[key] = skin !== 'buddha' ? buildSkin(skin) : buildBuddha(lv);
  if (model) buddhaRoot.remove(model);
  model = modelCache[key];
  buddhaRoot.add(model);
}
setModel(1);
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.28, depthWrite: false });
const ghost = buildBuddha(1);
ghost.traverse((o) => { if (o.isMesh || o.isInstancedMesh) o.material = ghostMat; if (o.isSprite) o.visible = false; });
ghost.visible = false; scene.add(ghost);
let ghostRun = null; // { alt, pts: [x0, y0, x1, y1, ...] } 0.1秒ごと
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
const shockwaves = [], shockPool = [];
const RING_OUT = new THREE.RingGeometry(0.7, 1, 64), RING_IN = new THREE.RingGeometry(0.86, 1, 64);
function shockwave(x, y, color = 0xffe08a, size = 6, inward = false) {
  // 形と材質は使い回す（毎回作るとスマホで引っかかる）
  let m = shockPool.pop();
  if (!m) { m = new THREE.Mesh(RING_OUT, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); scene.add(m); }
  m.geometry = inward ? RING_IN : RING_OUT; m.material.color.set(color); m.visible = true;
  m.position.set(x, y, inward ? 0.6 : 0); m.rotation.set(inward ? 0 : -Math.PI / 2 + 0.35, 0, 0);
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
canvas.addEventListener('pointermove', (e) => {
  if (!input.down) return;
  input.dragPx += e.clientX - input.lastX; input.lastX = e.clientX;
});
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
  $('bestTitle').textContent = best.alt ? t('bestTitle', { m: best.alt.toLocaleString() }) : '';
  $('bestHud').textContent = best.alt.toLocaleString();
}
refreshBest();
$('startBtn').addEventListener('click', () => { if (!audio.ready) return; audio.init(); startGame(); });
$('langBtn').addEventListener('click', () => { setLang(lang === 'ja' ? 'en' : 'ja'); updateSoundBtns(); refreshBest(); if (audio.ready) $('startBtn').textContent = t('start'); hudCache = {}; });
$('templeBtn').addEventListener('click', () => { audio.init(); renderTemple(); show('templeScr', true); show('title', false); templeView = true; });
$('templeClose').addEventListener('click', () => { show('templeScr', false); show('title', true); templeView = false; });
// お寺の画面を開いている間は境内を見渡す。寄進した瞬間は建物へカメラが向かい、建物がせり上がる
let templeView = false, buildCine = null;
const camCur = new THREE.Vector3(0, 3, 16), lookCur = new THREE.Vector3(0, 5, 0);
const OVERVIEW = [[0, 90, 120], [0, 0, 3]];
function renderTemple() {
  $('wallet').textContent = '¥' + temple.wallet.toLocaleString();
  const next = BUILDINGS.findIndex((b) => !hasB(b.id));
  $('bList').innerHTML = BUILDINGS.map((b, i) => {
    const built = hasB(b.id), can = i === next && temple.wallet >= b.cost;
    const btn = built ? `<span class="done">${t('built')}</span>` : i === next ? `<button class="btn gold-btn mini" data-b="${b.id}" ${can ? '' : 'disabled'}>${t('donate')}</button>` : `<span class="lock">${t('inOrder')}</span>`;
    return `<div class="bld ${built ? 'is-built' : ''}"><div class="bn"><b>${t('bName')[i]}</b><small>¥${b.cost.toLocaleString()}</small><span>${t('bEff')[i]}</span></div>${btn}</div>`;
  }).join('');
  $('bList').querySelectorAll('[data-b]').forEach((el) => el.addEventListener('click', () => {
    const b = BUILDINGS.find((x) => x.id === el.dataset.b);
    if (!b || temple.wallet < b.cost) return;
    temple.wallet -= b.cost; temple.built.push(b.id); store.set('temple', temple);
    world.setBuilt(temple.built.filter((x) => x !== b.id)); // 建立の演出でせり上がらせる
    buildCine = { id: b.id, t: 0 };
    $('templeScr').classList.add('cine');                    // 演出の間はお寺の画面を隠す
    audio.gong(); vib([30, 40, 60]);
    renderTemple();
  }));
  $('skinList').innerHTML = SKINS.map((k, i) => {
    const ok = skinUnlocked(k);
    return `<button class="btn round skin ${k === skin ? 'sel' : ''}" data-s="${k}" ${ok ? '' : 'disabled'}>${ok ? t('skins')[i] : '🔒 ' + t('skins')[i]}</button>`;
  }).join('');
  $('skinList').querySelectorAll('[data-s]').forEach((el) => el.addEventListener('click', () => {
    if (!skinUnlocked(el.dataset.s)) return;
    skin = el.dataset.s; store.set('skin', skin); setModel(1); renderTemple();
  }));
}
world.setBuilt(temple.built);
$('howBtn').addEventListener('click', () => { audio.init(); show('how', true); });
$('howClose').addEventListener('click', () => show('how', false));
$('soundBtn').addEventListener('click', () => { audio.init(); toggleSound(); });
$('pauseSound').addEventListener('click', toggleSound);
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', togglePause);
$('quitBtn').addEventListener('click', () => { show('pause', false); toTitle(); });
$('resTitleBtn').addEventListener('click', toTitle);
$('shareBtn').addEventListener('click', () => shareRecord());
// 結果を1枚の画像にしてシェア（使えなければ保存）
async function shareRecord() {
  composer.render();
  const shot = renderer.domElement.toDataURL('image/jpeg', 0.9);
  const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = shot; });
  const W = 720, H = 1280, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sc = Math.max(W / img.width, H / img.height);
  g.drawImage(img, (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(20,8,2,.75)'); grd.addColorStop(0.35, 'rgba(20,8,2,.15)'); grd.addColorStop(0.62, 'rgba(20,8,2,.2)'); grd.addColorStop(1, 'rgba(20,8,2,.88)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const gold = (y0, y1) => { const gg = g.createLinearGradient(0, y0, 0, y1); gg.addColorStop(0, '#fffbe0'); gg.addColorStop(0.45, '#ffd34a'); gg.addColorStop(0.6, '#e07a10'); gg.addColorStop(1, '#ffe9a0'); return gg; };
  const font = (px) => `${px}px "Dela Gothic One", "Hiragino Sans", sans-serif`;
  const txt = (s, y, px, fill, stroke = '#3a1200') => { g.font = font(px); g.textAlign = 'center'; g.lineWidth = px * 0.14; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, W / 2, y); g.fillStyle = fill; g.fillText(s, W / 2, y); };
  txt(t('logo1') + (lang === 'en' ? ' ' : '') + t('logo2'), 120, lang === 'en' ? 70 : 84, gold(60, 130));
  const alt = Math.floor(G.maxAlt || altM());
  txt(t('resAlt'), 900, 34, '#ffe2a0');
  txt(`${alt.toLocaleString()}m`, 1010, 112, gold(910, 1020));
  txt(t('rankLabel', { r: rank(alt) }), 1085, 44, '#ffffff');
  txt(`${formLabel(form())}  ·  ¥${G.money.toLocaleString()}`, 1150, 32, '#ffe9c0');
  txt(location.host + location.pathname.replace(/index\.html$/, ''), 1230, 26, '#ffd890');
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'flying-buddha.png', { type: 'image/png' });
  const text = t('shareText', { m: alt.toLocaleString(), r: rank(alt) });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, url: location.href.split('?')[0] }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flying-buddha.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('resNext').addEventListener('click', () => {
  show('result', false); startGame();
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
    bx: 0, by: 0.35, bvx: 0, v: 0, camY: 1.6, mouth: 0, danger: 0, beatT: 0, launch: 0.9, launchedAt: 0,
    coins: [], foes: [], path: null, foeAcc: 0, accSm: 0, thrust: 0, lift: 0,
    combo: 0, comboT: 0, gori: 0, curse: 0, inv: 0, dai: 0,
    fever: false, feverCount: 0, stageMoney: 0, fovKick: 0, shake: 0, time: 0,
  };
}
function startGame() {
  clearWorldObjects();
  G = newGameState();
  G.rec = []; G.recT = 0;
  G.perk = perks(); G.charms = G.perk.charms;
  ghostRun = store.get('ghost', null);
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
  $('stageName').textContent = stageLabel(i);
  world.refreshEnv(altM());
  banner(`第${i + 1}天`, STAGES[i].name);
  audio.gong();
}
// 高度に応じたステージ（極楽浄土の先は終わりなく続く）
const LAST = STAGES.length - 1;
function stageAt(alt) { for (let i = 0; i < LAST; i++) if (alt < STAGES[i].start + STAGES[i].goal) return i; return LAST; }
// 賽銭の嵐の区間（各ステージの終わり。最後のステージ以降は一定の高度ごと）
function segmentAt(alt) {
  const i = stageAt(alt);
  if (i < LAST) return { start: STAGES[i].start, len: STAGES[i].goal, id: i };
  const s0 = STAGES[LAST].start, len = STAGES[LAST].goal, n = Math.floor((alt - s0) / len);
  return { start: s0 + n * len, len, id: LAST + n };
}
// 高度が上がると、止まらずにそのまま次のステージへ
function enterStage(i) {
  G.stage = i;
  setModel(G.dai > 0 ? 5 : FORMS[G.form].lv);
  $('stageName').textContent = stageLabel(i);
  world.refreshEnv(altM());
  audio.gong(); flash(0.35);
  shockwave(G.bx, G.by + 1, 0xfff0c0, 12);
}
function toTitle() {
  show('result', false); show('pause', false); show('hud', false); show('title', true);
  clearWorldObjects();
  G = null; state = 'title';
  refreshBest();
}
function clearWorldObjects() {
  if (!G) return;
  for (const c of G.coins) freeCoin(c);
  for (const f of G.foes) { freeFoe(f); if (f.warn) f.warn.remove(); }
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
  else if (r < 0.9) { P.mode = 'branch'; P.left = 12 + (Math.random() * 6 | 0); P.good = Math.random() < 0.5 ? -1 : 1; P.cx = 0; P.bn = 0; }
  else if (G.time > 4) { P.mode = 'gap'; P.left = 1 + (Math.random() * 2 | 0) + (G.stage >> 1); }
  else { P.mode = 'wave'; P.left = 8; P.amp = 1; P.freq = 0.4; }
}
// カラスは実際の高度に配置し、その高度で左右を行き来する（仏像についてこない）
const CROW_GAP = [28, 22, 20, 18, 23]; // カラスどうしの高さの間隔（ユニット）
function placeCrows(limitY) {
  if (G.nextCrowY == null) G.nextCrowY = G.by + 30; // 最初のカラスは十分上から
  while (G.nextCrowY < limitY) {
    const y = G.nextCrowY;
    // 間隔は指数分布：広い空白が続くことも、2羽が近い高さに続くこともある
    const gap = CROW_GAP[G.stage] / hardness(); // 高いほどカラスが増える
    G.nextCrowY += THREE.MathUtils.clamp(-Math.log(1 - Math.random()) * gap, 2.5, gap * 3.5);
    if (G.fever || !STAGES[G.stage].foes.includes('crow')) continue;
    // その高度が画面に入ってきたら、画面の端から飛び始めて横切る
    const golden = Math.random() < 0.05 + G.stage * 0.015; // まれに八咫烏（踏めば大仏に変身）
    const obj = getCrow(golden); obj.visible = false;
    G.foes.push({ kind: 'crow', golden, obj, x: 0, y, vx: 0, vy: 0, waiting: true, speed: (1.8 + Math.random() * 1.4 + G.stage * 0.2) * Math.sqrt(hardness()), bob: 0.25 + Math.random() * 0.3, t: Math.random() * 6, r: 0.5 });
  }
}
const crowPool = { n: [], g: [] };
function getCrow(golden) {
  let o = crowPool[golden ? 'g' : 'n'].pop();
  if (!o) { o = golden ? makeGoldenCrow() : makeCrow(); o.scale.setScalar(1.3); scene.add(o); }
  o.rotation.set(0, 0, 0); o.visible = true; o.userData.golden = !!golden;
  return o;
}
function freeFoe(f) {
  if (f.kind === 'crow') { f.obj.visible = false; crowPool[f.obj.userData.golden ? 'g' : 'n'].push(f.obj); }
  else scene.remove(f.obj);
}
function makeGoldenCrow() {
  const c = makeCrow();
  c.traverse((o) => { if (o.isMesh) o.material = GOLD_CROW_MAT; });
  const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffd060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.scale.set(2.4, 2.4, 1); c.add(g);
  return c;
}
const GOLD_CROW_MAT = new THREE.MeshPhysicalMaterial({ color: 0xffc040, metalness: 1, roughness: 0.25, emissive: 0x7a4a00, emissiveIntensity: 0.8, side: THREE.DoubleSide });
// 分かれ道の儲かる道を行き来するカラス
function addLaneCrow(side, y) {
  const obj = getCrow(false);
  const cx = side * LANE, x = cx + (Math.random() - 0.5) * 2;
  const vx = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random());
  obj.position.set(x, y, 0.3); obj.rotation.y = vx > 0 ? 0 : Math.PI;
  G.foes.push({ kind: 'crow', obj, x, y, vx, vy: 0, cx, range: 1.7, patrol: true, bob: 0.25, t: Math.random() * 6, r: 0.5 });
}
function extendPath(limitY) {
  placeCrows(limitY);
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
    if (P.mode === 'branch') { // 分かれ道：儲かる道（小判とカラス）と安全な道
      const spread = Math.min(LANE, (P.left < 3 ? P.left : 3) * 1.3);
      for (const side of [-1, 1]) {
        const good = side === P.good;
        const x = P.x + side * spread;
        // 儲かる道は小判だらけ、安全な道は銅銭だけ
        const type = good ? (P.n % 2 === 0 ? 'koban' : 'zeni') : 'zeni';
        addCoin(type, x, P.y);
      }
      // 儲かる道にはカラスが行き来している
      if (spread >= LANE - 0.01 && (P.bn = (P.bn || 0) + 1) % 4 === 2 && STAGES[G.stage].foes.includes('crow')) addLaneCrow(P.good, P.y + STEP * 0.5);
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
  const clouds = st.foes.filter((k) => k !== 'crow');
  if (!clouds.length) return;
  const kind = clouds[Math.random() * clouds.length | 0];
  if (kind === 'crow') {
    // 仏像より下を横切るカラス（上から落ちて踏みつけると撃ち落としてジャンプ）
    const crows = G.foes.filter((f) => f.kind === 'crow' && !f.dead);
    if (crows.length >= 2) return; // 同時に出るのは2羽まで
    const bottom = cy - halfH;
    const y = Math.max(bottom + 1.2, G.by - 1.5 - Math.random() * 4);
    if (crows.some((f) => Math.abs(f.y - y) < 3)) return; // ほかのカラスと高さをずらす（縦に並ばないように）
    const dir = crows.length && Math.random() < 0.7 ? -Math.sign(crows[0].vx) : (Math.random() < 0.5 ? 1 : -1);
    const obj = makeCrow(); obj.scale.setScalar(1.3); scene.add(obj);
    obj.rotation.y = dir > 0 ? 0 : Math.PI;
    G.foes.push({ kind, obj, x: -dir * 12, y, vx: dir * (1.8 + Math.random() * 3 + G.stage * 0.3), vy: (Math.random() - 0.5) * 0.6, bob: 0.4 + Math.random() * 0.6, t: Math.random() * 6, r: 0.5 });
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
  return STAGES[G.stage].scroll + 8 + G.form * 1.5 + (G.gori > 0 ? 16 : 0) + (G.dai > 0 ? 25 : 0);
}
const altM = () => Math.max(0, G.by * UNIT_M);
// 難しさ：1,500mを超えると高度に応じて上がっていく（終わりのない区間でもいずれ限界が来る）
const hardness = () => 1 + Math.max(0, altM() - 2000) / 11000;
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

  // スタート：賽銭鉢の上でかがんで力をため、地面を蹴ってジャンプ
  if (G.launch > 0) {
    G.launch -= dt;
    if (G.launch > 0) return;
    G.v = 32; G.launchedAt = G.time; G.rocket = G.perk.start / UNIT_M; G.surge = 1.6; G.fovKick += 8; G.shake = 0.3;
    audio.stomp(); flash(0.15);
    shockwave(G.bx, G.by - 0.7, 0xfff0c0, 8);
    emit(G.bx, G.by - 0.7, 0, 0xffe0a0, 60, 6, 0.9);
    emit(G.bx, G.by - 0.8, 0, 0xd8c8a0, 30, 4, 0.8, 4);
  }

  // ゴースト用に0.1秒ごとの位置を記録
  G.recT += dt;
  while (G.recT >= 0.1) { G.recT -= 0.1; if (G.rec.length < 12000) G.rec.push(+G.bx.toFixed(2), +G.by.toFixed(2)); }

  // 物理：重力と、硬貨で得る逆重力（上向きの力）、空気抵抗
  let up = 0;
  if (G.anti > 0) { up += G.antiA; G.anti -= dt; } // 硬貨を吸った直後の逆重力
  if (G.gori > 0) up += 22 * Math.min(1, G.gori / 1.5);     // 御利益コイン：しばらく逆重力が続く
  if (G.dai > 0) up += 32;                                   // 大仏：強い浮力
  if (G.rocket > 0) { up += 80; G.rocket -= Math.max(0, G.v) / UNIT_M * dt; if (G.rocket <= 0) { audio.gong(); flash(0.3); } } // 寄進の力で一気に駆け上がる
  const drag = PHYS.drag * G.v * Math.abs(G.v);              // 空気抵抗（落下にも上昇にも上限が生まれる）
  G.v += (up - PHYS.g * Math.sqrt(hardness()) - drag) * dt; // 高いほど重力が強い
  G.by += (G.v / UNIT_M) * dt;
  G.score += Math.max(0, G.v) * dt * (G.dai > 0 ? 3 : 1) | 0;

  // 高度に応じてステージが変わる（戻りはしない）
  const ns = stageAt(altM());
  if (ns > G.stage) enterStage(ns);
  // 賽銭の嵐：区間の終わりで起こり、次の区間に入ると収まる
  const seg = segmentAt(altM());
  if (G.segId !== seg.id) {
    if (G.segId != null && seg.id > G.segId) { G.fever = false; G.feverCount = 0; G.dai = 0; setModel(FORMS[G.form].lv); }
    G.segId = Math.max(G.segId ?? -1, seg.id);
  }
  if (!G.fever && altM() - seg.start >= seg.len * FEVER_AT && seg.id === G.segId) {
    G.fever = true;
    banner('賽銭の嵐！', `${HENSHIN_NEED}枚吸い込めば大仏に…！`);
    audio.koban();
  }

  if (G.dai > 0) { // 大仏変身は5秒で終わる
    G.daiT -= dt;
    if (G.daiT <= 0) { G.dai = 0; setModel(FORMS[G.form].lv); audio.gong(); flash(0.3); shockwave(G.bx, G.by + 1, 0xfff0c0, 8); }
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
  // カメラは仏像の実際の高度を追う：上昇はしっかり追い、落下はゆっくりしか追わない
  const camTarget = G.by + 1.4;
  if (camTarget > G.camY) G.camY += (camTarget - G.camY) * Math.min(1, dt * 6);
  else G.camY = Math.max(camTarget, G.camY - PHYS.camDown * dt);
  // 地面に落ちる、または画面の下まで落ちたらアウト
  G.danger = THREE.MathUtils.clamp(1 - (G.by - (G.camY - viewHalfH)) / 5, 0, 1);
  if (G.by < G.camY - viewHalfH + 0.6 || (G.by < 0.2 && G.v < 0)) { startDeath('fall'); return; }

  // 硬貨の道を先まで敷く
  extendPath(G.camY + viewHalfH + 12);
  G.foeAcc += dt * st.foeRate * (altM() > 60 && !G.fever ? 1 : 0);
  while (G.foeAcc > 1) { G.foeAcc -= 1; spawnFoe(G.camY, viewHalfH); }

  // 硬貨：空中に止まっている。吸引中は仏像の上方の範囲から口へ引き寄せる
  const R = suckR(), P = suckPow();
  mouthW.set(G.bx, G.by + 2.7 * S, -0.2);           // 吸い込み口は頭上
  const tx = G.bx, ty = G.by + 2.7 * S;
  const cx = G.bx, cy = ty + R * 0.75;          // 吸引範囲は仏像の上に伸びる
  const rx = Math.min(R * 0.25, 1.15) * G.perk.suck + (G.gori > 0 ? 0.8 : 0) + (G.dai > 0 ? 6 : 0), ry = R * 1.4; // 真上の細い柱だけを吸う // 横幅は細く：左右に動いて狙う
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
      if (f.dead) { // 撃ち落とされたカラスはくるくる回って落ちる
        f.vy -= 30 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        f.obj.position.set(f.x, f.y, 0.3); f.obj.rotation.z += dt * 12; f.obj.rotation.x += dt * 5;
        if (f.y < G.camY - viewHalfH - 4) { freeFoe(f); G.foes.splice(i, 1); }
        continue;
      }
      if (f.waiting) { // まだ画面に入っていない高度のカラスは待機
        if (f.y > G.camY + viewHalfH + 7) continue; // 画面に入る少し前から飛び始める
        const dir = Math.random() < 0.5 ? 1 : -1;
        f.waiting = false; f.x = -dir * (XB + 3); f.vx = dir * f.speed;
        f.obj.visible = true; f.obj.rotation.y = dir > 0 ? 0 : Math.PI;
      }
      f.x += f.vx * dt; f.y += Math.sin(f.t * 3) * f.bob * dt; // 一定の高度をまっすぐ横切る
      if (f.patrol) { if (Math.abs(f.x - f.cx) > f.range) { f.x = f.cx + Math.sign(f.x - f.cx) * f.range; f.vx = -f.vx; f.obj.rotation.y = f.vx > 0 ? 0 : Math.PI; } }
      else if (Math.abs(f.x) > XB + 0.8 && Math.sign(f.x) === Math.sign(f.vx)) { f.vx = -f.vx; f.obj.rotation.y = f.vx > 0 ? 0 : Math.PI; } // 画面の端で折り返し、その高度を行き来し続ける（落ちたときの足場になる）
      f.obj.position.set(f.x, f.y, 0.3);
      const flap = Math.sin(f.t * 16) * 0.9;
      f.obj.userData.wings[0].rotation.x = -flap; f.obj.userData.wings[1].rotation.x = flap;
      const cd = Math.hypot(G.bx - f.x, G.by + 0.7 * S - f.y), hitR = 0.55 * S + f.r * 0.7;
      // ニアミス：ぎりぎりですれ違ったら、一瞬スローになって鈴が鳴り、少し浮力をもらう
      if (!f.near && cd < hitR + 1.0) f.minD = Math.min(f.minD ?? 99, cd);
      if (!f.near && f.minD != null && cd > f.minD + 0.35) {
        f.near = true;
        slowmo(0.45, 0.3); audio.chime(4); G.v = Math.max(G.v, 0) + 5; G.surge = Math.max(G.surge || 0, 0.8);
        emit(G.bx, G.by + 1.2 * S, 0.4, 0xfff6c0, 16, 3, 0.5); vib(15);
      }
      if (cd < hitR) { // 当たり判定は見た目より少し小さく
        // 仏像の下側で当たった＝上から踏みつけた（落ちているときは踏みやすい＝救済）
        const stomp = f.y < G.by + (G.v < -3 ? 0.95 : 0.45) * S;
        if (G.inv > 0) continue; // お守りが砕けた直後は無敵
        if (stomp || G.dai > 0 || G.rocket > 0) { // 無敵なのは大仏変身中（と寄進の駆け上がり中）だけ
          // 撃ち落として、仏像はジャンプ（3秒以内に続けて踏むと連鎖で跳ねる力が増す）
          f.dead = true; f.vy = -4; f.vx = (f.x - G.bx) * 2 + (Math.random() - 0.5) * 2;
          G.chain = G.time - (G.lastStomp ?? -9) < 3 ? (G.chain || 0) + 1 : 1; G.lastStomp = G.time;
          const ch = Math.min(G.chain, 7);
          // 踏みつけの跳ね返りは一律：落下の速さに関係なく、いつも同じ高さだけ跳ね上がる
          const g = PHYS.g * Math.sqrt(hardness());
          G.v = Math.sqrt(2 * g * STOMP_JUMP_M) * 1.2;               // 空気抵抗の分を上乗せ（実測でちょうど80m）
          G.anti = 0;
          // カラスが小判をばらまく（吸い込めばお寺へのお金）
          for (let k = 0; k < 2 + ch; k++) addCoin(k === 0 || Math.random() < 0.6 ? 'koban' : 'zeni', f.x + (Math.random() - 0.5) * 2.4, f.y + 0.6 + Math.random() * 2.5);
          // 3連鎖で大仏に変身
          if (ch >= 3 && G.dai <= 0 && !f.golden) henshin();
          G.surge = 1.6; G.fovKick += 5 + ch * 1.5; G.shake = 0.3 + ch * 0.06; G.score += 300 * ch;
          G.combo++; G.comboT = 0.85; G.stomps = (G.stomps || 0) + 1;
          audio.stomp(ch); flash(0.1 + ch * 0.04); vib(25 + ch * 8);
          emit(f.x, f.y, 0, f.golden ? 0xffe070 : 0x2a2a33, 22, 5, 0.9, 6);   // 羽根が散る
          emit(G.bx, G.by - 0.6 * S, 0, 0xffe6a0, 14 + ch * 6, 3 + ch, 0.5);    // 踏み台の光
          shockwave(G.bx, G.by - 0.5 * S, ch >= 3 ? 0xfff6c0 : 0xfff0c0, 3 + ch * 1.5);
          if (f.golden && G.dai <= 0) henshin(); // 八咫烏を踏むと大仏に変身
          continue;
        }
        // 横や下からぶつかったら即アウト（激突の演出のあと結果へ）
        if (G.charms > 0) { // お守りが砕けて身代わりになる
          G.charms--; G.inv = 1.6;
          f.dead = true; f.vy = 2; f.vx = Math.sign(f.x - G.bx || 1) * 8;
          audio.chime(6); audio.hit(); flash(0.4); vib([40, 30, 40]); G.shake = 0.6;
          shockwave(G.bx, G.by + 1, 0xa0e0ff, 7); emit(G.bx, G.by + 1, 0.4, 0xc0f0ff, 40, 6, 0.8);
          continue;
        }
        startDeath('crow', f); return;
      }
      if (f.y < G.camY - viewHalfH - 3) { freeFoe(f); G.foes.splice(i, 1); continue; } // 通り過ぎたカラスは片付ける
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
      if (f.y < G.camY - viewHalfH - 8) { freeFoe(f); G.foes.splice(i, 1); continue; }
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
  // 吸うと逆重力が働く（連続ほど強く・落下中は強めに）
  // 速く昇っているときほど効きにくい（速度が暴走しないように）
  const k = (1 + Math.min(G.combo, 40) * 0.012) * (G.v < 0 ? 1.5 : THREE.MathUtils.clamp(1 - G.v / 60, 0.1, 1));
  const rest = G.anti > 0 ? G.antiA * G.anti : 0; // まだ残っている逆重力の分も足す
  G.anti = 0.3; G.antiA = (rest + d.boost * k * G.perk.lift) / 0.3;
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
    audio.koban(); vib(20); G.fovKick += 4; G.shake = Math.max(G.shake, 0.15);
    inhale(30, 3.2, 0xffe066);
    inhaleRing(4.5, 0xffe08a);
  } else if (c.type === 'goriyaku') {
    audio.goriyaku(); vib([30, 30, 60]); G.gori = 3.5; G.v = Math.max(G.v, 0) + 10; flash(0.5); G.fovKick += 16; G.shake = 0.5; G.lift = Math.min(2.8, G.lift + 1.5); G.surge = 1.6;
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
  G.dai = 1; G.daiT = 5; G.henshins++; G.v += 25; G.fovKick += 16; G.shake = 0.8;
  setModel(5);
  flash(0.9); audio.henshin();
  banner('大仏変身！！', '天へ駆け上がれ！');
  emit(G.bx, G.by + 2, 0, 0xfff6a0, 200, 14, 1.6);
  shockwave(G.bx, G.by, 0xfff2b0, 16);
}

let resultKind = 'over';
// ---------- やられ演出 ----------
function startDeath(kind, crow) {
  state = 'dying';
  G.death = { t: 0, kind, crow };
  G.spin = 0;
  if (kind === 'crow') {
    audio.crowHit(); flash(0.6); G.shake = 1.4; G.danger = 1; vib([80, 40, 140]);
    emit(crow.x, crow.y, 0.3, 0x18181e, 40, 7, 1.4, 5);        // 黒い羽根が飛び散る
    emit(crow.x, crow.y, 0.3, 0xffffff, 16, 9, 0.35);          // 衝撃の火花
    shockwave(crow.x, crow.y, 0xff6050, 5);
    G.v = -8; G.bvx = (G.bx - crow.x) * 4;                      // 弾かれて落ち始める
    crow.vx = Math.sign(crow.vx || 1) * 9; crow.flee = true;    // カラスは飛び去る
    G.death.fallSound = false;
  } else {
    audio.fall(); G.danger = 1; G.death.fallSound = true; vib([40, 60, 40]);
  }
}
function updateDying(dt) {
  const D = G.death; D.t += dt;
  const stop = D.kind === 'crow' && D.t < 0.18;                 // ぶつかった瞬間のヒットストップ
  const sdt = stop ? 0 : dt;
  if (!stop && !D.fallSound) { D.fallSound = true; audio.fall(); }
  G.v = Math.max(-45, G.v - PHYS.g * 1.3 * sdt);                // 真っ逆さまに墜落
  G.by += (G.v / UNIT_M) * sdt;
  if (G.by < 0.25) { // 地面に落ちたら止まる
    if (!D.landed) { D.landed = true; G.shake = 1; audio.hit(); emit(G.bx, 0, 0, 0xd8c8a0, 40, 5, 1, 4); }
    G.by = 0.25; G.v = 0;
  }
  G.bx += G.bvx * sdt; G.bvx *= Math.pow(0.3, sdt);
  G.spin = Math.min(1.9, G.spin + sdt * 1.6);                   // 前のめりに傾いていく
  G.camY += (G.by + 2.5 - G.camY) * Math.min(1, dt * 3);        // カメラは落ちる仏像を追う
  G.shake *= Math.pow(0.2, dt);
  G.danger = Math.max(0, 1 - D.t * 0.7);
  if (!stop && parts.length < MAXP) { // 煙の尾
    for (let k = 0; k < 3; k++) parts.push({ x: G.bx + (Math.random() - 0.5) * 0.8, y: G.by + 1.2 + Math.random(), z: (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: G.v / UNIT_M * 0.3 + 1.5, vz: 0, life: 0.9, max: 0.9, r: 0.35, g: 0.33, b: 0.3, grav: 0 });
  }
  const f = D.crow;
  if (f && f.obj) {
    f.t += dt; f.x += f.vx * dt; f.y += 3 * dt;
    f.obj.position.set(f.x, f.y, 0.3); f.obj.rotation.y = f.vx > 0 ? 0 : Math.PI;
    const flap = Math.sin(f.t * 22) * 1.0; f.obj.userData.wings[0].rotation.x = -flap; f.obj.userData.wings[1].rotation.x = flap;
  }
  if (D.t > 1.8) gameOver(D.kind === 'crow' ? 'カラスに当たった！' : '');
}
function gameOver(reason = '') {
  state = 'result'; resultKind = 'over';
  input.down = input.key = false;
  const prevBest = best.alt;
  saveBest();
  temple.wallet += G.money; store.set('temple', temple); // 集めた賽銭はお寺の財布に貯まる
  if (Math.floor(G.maxAlt || altM()) > prevBest && G.rec && G.rec.length > 20) store.set('ghost', { alt: Math.floor(G.maxAlt || altM()), pts: G.rec });
  audio.over();
  const alt = Math.floor(G.maxAlt || altM());
  const isBest = alt > prevBest;
  const head = reason ? t('crowHit') : t('fell');
  $('resTitle').textContent = head;
  // 見出しは枠に収まる範囲でできるだけ大きく（文字数で決める）
  $('resTitle').style.fontSize = `min(${Math.min(16, 88 / (head.length * (lang === 'en' ? 0.62 : 1)))}cqw, 64px)`;
  $('resAlt').textContent = alt.toLocaleString() + 'm';
  $('resMoney').textContent = G.money.toLocaleString();
  $('resRibbon').textContent = t('rankLabel', { r: rank(alt) });
  $('resLines').innerHTML = [isBest ? `<b>${t('newBest')}</b>` : t('bestLine', { m: best.alt.toLocaleString() }), t('toTemple', { a: G.money.toLocaleString(), w: temple.wallet.toLocaleString() })].join('<br>');
  $('resNext').textContent = t('again');
  show('result', true); show('hud', false);
}
// 称号は到達高度で決まる
function rank(alt) {
  const R = t('ranks');
  if (alt >= 9600) return R[5]; if (alt >= 7200) return R[4]; if (alt >= 5100) return R[3];
  if (alt >= 3300) return R[2]; if (alt >= 1800) return R[1]; return R[0];
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
  setText('score', Math.floor(Math.max(G.maxAlt || 0, altM())).toLocaleString());
  setText('alt', Math.floor(altM()).toLocaleString());
  setText('speed', Math.max(0, Math.round(G.v)).toString());
  setText('money', G.money.toLocaleString() + (G.charms > 0 ? `  🛡${G.charms}` : ''));
  setText('formName', G.dai > 0 ? t('giant') : formLabel(form()));
  setText('goalLbl', G.stage < LAST ? `▲ ${Math.max(0, Math.ceil(st.start + st.goal - altM())).toLocaleString()}m` : (best.alt > altM() ? `👑 ${best.alt.toLocaleString()}m` : '👑'));
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
    const lv = FORCE_LV || 1; // タイトルは木造仏から（確認用に ?lv=1〜5 で形態を指定できる）
    const want = skin !== 'buddha' ? skin : lv;
    if (!model || model.userData.lv !== want) setModel(lv);
    by = 1.6; bx = 0; S = lv === 5 ? 1.35 : 1.1;
    buddhaRoot.position.set(0, by + Math.sin(t * 0.0015) * 0.15, 0);
    buddhaRoot.scale.setScalar(S);
    buddhaRoot.rotation.set(0, Math.sin(titleT * 0.3) * 0.25, 0);
    const a = titleT * 0.12;
    camera.fov = 50; camera.updateProjectionMatrix();
    let wantPos, wantLook;
    if (buildCine) {
      // 建立の演出：建物へカメラが向かい、建物が光とともにせり上がる
      buildCine.t += dt;
      const [vp, vl] = world.partViews[buildCine.id];
      wantPos = new THREE.Vector3(...vp); wantLook = new THREE.Vector3(...vl);
      const rk = (buildCine.t - 0.7) / 1.3;
      if (rk > 0) {
        world.raise(buildCine.id, rk);
        if (!buildCine.fx) { buildCine.fx = true; flash(0.35); audio.level(); shockwave(vl[0], vl[1] - 6, 0xfff0c0, 18); }
        if (rk < 1 && Math.random() < 0.8) emit(vl[0] + (Math.random() - 0.5) * 16, vl[1] - 8 + Math.random() * 10, vl[2] + (Math.random() - 0.5) * 10, 0xffe6a0, 3, 4, 1.2);
      }
      if (buildCine.t > 2.8) { buildCine = null; $('templeScr').classList.remove('cine'); renderTemple(); }
    } else if (templeView) {
      wantPos = new THREE.Vector3(...OVERVIEW[0]); wantLook = new THREE.Vector3(...OVERVIEW[1]); // 境内全体を見渡す
    } else {
      wantPos = new THREE.Vector3(Math.sin(a) * 9 / ZOOM, by + 1.2 + (ZOOM - 1) * 0.6, (16 + Math.cos(a) * 2) / ZOOM);
      wantLook = new THREE.Vector3(0, by + 3.6 - (ZOOM - 1) * 1.0, 0);
    }
    const ease = Math.min(1, dt * (buildCine ? 2.2 : templeView ? 2 : 3));
    camCur.lerp(wantPos, ease); lookCur.lerp(wantLook, ease);
    camera.position.copy(camCur); camera.lookAt(lookCur);
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
    swirl.visible = false; $('danger').style.opacity = 0;
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
  const crouch = G.launch > 0 ? Math.min(1, (0.9 - G.launch) / 0.6) : 0; // スタート前にかがむ
  buddhaRoot.scale.set(G.baseS * (1 - surge * 0.035 + crouch * 0.07), G.baseS * (1 + surge * 0.08 - crouch * 0.18), G.baseS * (1 - surge * 0.035 + crouch * 0.07)); // 上へ伸びる
  // 左右に動くと進む方向へ向きを変え、少し傾く（止まると正面に戻る）
  const yawTarget = THREE.MathUtils.clamp(G.bvx * 0.11, -1.1, 1.1);
  G.yaw = (G.yaw || 0) + (yawTarget - (G.yaw || 0)) * Math.min(1, dt * 6);
  buddhaRoot.rotation.set(-speed01 * 0.12 - G.thrust * 0.04, G.yaw, -G.yaw * 0.22);
  if (state === 'dying') buddhaRoot.rotation.set(G.spin * 0.7, G.yaw, G.spin * 0.25); // やられ：前のめりに傾いて墜落
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
  const fov = state === 'dying' && G.death.kind === 'crow' && G.death.t < 0.3 ? 44 : 52 + speed01 * 24 + Math.min(20, G.fovKick) + G.thrust * 2.5;
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
    if (k >= 1) { s.m.visible = false; shockPool.push(s.m); shockwaves.splice(i, 1); }
  }
  // すれ違う雲（近くを高速で抜けていく）
  for (const c of world.passClouds) c.material.opacity = 0.25 + speed01 * 0.35;

  // 沈みかけ：画面の縁が赤く脈打ち、心音が鳴る
  const dg = G.danger || 0;
  $('danger').style.opacity = dg > 0 ? (dg * (0.55 + 0.45 * Math.sin(t * (0.008 + dg * 0.01)))).toFixed(3) : 0;
  if (state === 'play' && dg > 0.25) { G.beatT -= dt; if (G.beatT <= 0) { audio.beat(dg); G.beatT = 0.85 - dg * 0.45; } }
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
  if (slowT > 0) { slowT -= dt; if (slowT <= 0) timeScale = 1; }
  const gdt = state === 'play' ? dt * timeScale : dt;
  if (G && state === 'play') { update(gdt); }
  // ゴースト：最高記録のプレイの動きを半透明の仏像で再生
  ghost.visible = false;
  if (G && (state === 'play' || state === 'dying') && ghostRun && G.launch <= 0) {
    const k = (G.time - G.launchedAt) / 0.1, i = Math.floor(k) * 2, P = ghostRun.pts;
    if (i + 3 < P.length) {
      const u = k - Math.floor(k);
      ghost.position.set(P[i] + (P[i + 2] - P[i]) * u, P[i + 1] + (P[i + 3] - P[i + 1]) * u, -0.6);
      ghost.scale.setScalar(1);
      ghost.visible = Math.abs(ghost.position.y - G.camY) < viewHalfH + 4;
    }
  }
  if (G && state === 'dying') updateDying(dt);
  if (G && state === 'play') updateHUD();
  if (G && state === 'result') { // 結果画面では仏像の周りをゆっくり回る
    const a = now * 0.0003;
    camera.position.set(G.bx + Math.sin(a) * 10, G.by + 3, Math.cos(a) * 10 + 4);
    lookAt.set(G.bx, G.by + 2, 0); camera.lookAt(lookAt);
    buddhaRoot.position.set(G.bx, G.by, 0);
    if (resultKind === 'end') buddhaRoot.scale.setScalar(2.1);
    world.update(altM(), camera.position, now);
    audio.setWind(0);
  } else if (state !== 'paused') frameVisuals(state === 'play' ? gdt : dt, now);
  updateParts(dt);
  updateFloaters(dt);
  if (bannerT > 0) { bannerT -= dt; $('banner').style.opacity = Math.min(1, bannerT * 2); }
  if (flashV > 0) { flashV = Math.max(0, flashV - dt * 1.8); $('flash').style.opacity = flashV; }
  composer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 動作確認用
window.__buddha = { get state() { return state; }, get G() { return G; }, input, setModel, world, camera, scene, renderer, composer, step(n, dt = 1 / 60) { for (let i = 0; i < n && state === 'play'; i++) update(dt); }, restart() { show('result', false); startGame(); } };
