// 空飛ぶ仏像 3D — お金を吸い込め！仏の力で天まで昇れ！
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildBuddha, makeCoinMesh, makeCrow, glowTexture, dotTexture } from './models.js';
import { World, UNIT_M, makeLightPillars } from './world.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('flyingBuddha3d.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('flyingBuddha3d.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
};

// ---------- 定数 ----------
const STAGES = [
  { name: '地上の寺院', goal: 400, curse: 0.07, foeRate: 0.2, foes: ['crow'], drain: 4.5 },
  { name: '山頂',       goal: 500, curse: 0.11, foeRate: 0.3, foes: ['crow', 'crow', 'thunder'], drain: 5.5 },
  { name: '雲海',       goal: 600, curse: 0.15, foeRate: 0.38, foes: ['thunder', 'crow'], drain: 6.5 },
  { name: '天空',       goal: 700, curse: 0.19, foeRate: 0.42, foes: ['thunder'], drain: 7.5 },
  { name: '極楽浄土',   goal: 800, curse: 0.22, foeRate: 0, foes: [], drain: 8 },
];
let acc = 0; STAGES.forEach((s) => { s.start = acc; acc += s.goal; });
const FORMS = [
  { lv: 1, name: '木造仏', need: 0, scale: 0.95 },
  { lv: 2, name: '金色の仏像', need: 250, scale: 1.0 },
  { lv: 3, name: '光背の仏像', need: 1200, scale: 1.05 },
  { lv: 4, name: '千手観音', need: 3500, scale: 1.1 },
  { lv: 5, name: '黄金の大仏', need: 8000, scale: 1.35 },
];
const COINS = {
  zeni: { money: 10, energy: 3, r: 0.46, boost: 0.45, w: 70 },
  koban: { money: 300, energy: 14, r: 0.6, boost: 3.5, w: 9 },
  goriyaku: { money: 500, energy: 30, r: 0.45, boost: 10, w: 2.2 },
  noroi: { money: 0, energy: -18, r: 0.38, boost: 0, w: 0 },
};
const FEVER_AT = 0.78, HENSHIN_NEED = 25;
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
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

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const audio = new AudioEngine(store.get('muted', false));
function toggleSound() { audio.setMuted(!audio.muted); store.set('muted', audio.muted); updateSoundBtns(); }
function updateSoundBtns() { for (const id of ['soundBtn', 'pauseSound']) $(id).textContent = audio.muted ? '× 音なし' : '♪ 音あり'; }
updateSoundBtns();

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
// 吸引の渦
const swirl = new THREE.Group(); scene.add(swirl);
const swirlRings = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  swirl.add(m); swirlRings.push(m);
}
const swirlDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: glowTexture, color: 0xffd070, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
swirl.add(swirlDisc);

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
function shockwave(x, y, color = 0xffe08a, size = 6) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x, y, 0); m.rotation.x = -Math.PI / 2 + 0.35; scene.add(m);
  shockwaves.push({ m, t: 0, size });
}

// ---------- 浮き文字・バナー ----------
const floaters = [];
function floatText(x, y, z, text, color = '#fff', size = 22, life = 0.9) {
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
    f.el.style.left = ((proj.x + 1) / 2 * window.innerWidth) + 'px';
    f.el.style.top = ((1 - proj.y) / 2 * window.innerHeight) + 'px';
    f.el.style.opacity = Math.min(1, f.life / f.max * 2.5);
  }
}
let bannerT = 0;
function banner(main, sub = '', color = '') {
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
  if (k === ' ' || k === 'z' || k === 'Z') { e.preventDefault(); audio.init(); if (state === 'play') input.key = true; }
  if (k === 'Enter' && !e.repeat) { audio.init(); if (state === 'title') startGame(); else if (state === 'result') $('resNext').click(); }
  if ((k === 'p' || k === 'P' || k === 'Escape') && !e.repeat) togglePause();
  if ((k === 'm' || k === 'M') && !e.repeat) toggleSound();
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
  if (k === ' ' || k === 'z' || k === 'Z') input.key = false;
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
$('startBtn').addEventListener('click', () => { audio.init(); startGame(); });
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
    stage: 0, money: 0, score: 0, form: 0, energy: 80, maxCombo: 0, henshins: 0,
    bx: 0, by: 0.8, bvx: 0, v: 0, camY: 3, mouth: 0,
    coins: [], foes: [], spawnY: 4, foeAcc: 0,
    combo: 0, comboT: 0, gori: 0, curse: 0, inv: 0, dai: 0,
    fever: false, feverCount: 0, stageMoney: 0, fovKick: 0, shake: 0, time: 0,
  };
}
function startGame() {
  clearWorldObjects();
  G = newGameState();
  setModel(1);
  resetMotes(G.camY);
  show('title', false); show('hud', true); show('panel', true);
  beginStage(0);
}
function beginStage(i) {
  G.stage = i;
  G.energy = Math.max(G.energy, 75);
  G.fever = false; G.feverCount = 0; G.stageMoney = 0; G.dai = 0; G.gori = 0; G.curse = 0;
  setModel(FORMS[G.form].lv);
  state = 'play';
  $('stageName').textContent = `第${i + 1}天 ${STAGES[i].name}`;
  $('goalLbl').textContent = `目標 ${(STAGES[i].start + STAGES[i].goal).toLocaleString()}m`;
  banner(`第${i + 1}天`, STAGES[i].name);
  audio.gong();
}
function nextStage() { show('hud', true); show('panel', true); beginStage(G.stage + 1); }
function toTitle() {
  show('result', false); show('pause', false); show('hud', false); show('panel', false); show('title', true);
  clearWorldObjects();
  G = null; state = 'title';
  refreshBest();
}
function clearWorldObjects() {
  if (!G) return;
  for (const c of G.coins) scene.remove(c.obj);
  for (const f of G.foes) scene.remove(f.obj);
}

// ---------- 生成 ----------
function spawnCoins(y) {
  const st = STAGES[G.stage];
  let type;
  if (G.fever) type = Math.random() < 0.12 ? 'koban' : 'zeni';
  else if (Math.random() < st.curse) type = 'noroi';
  else {
    const w = [COINS.zeni.w, COINS.koban.w + G.stage, COINS.goriyaku.w];
    const r = Math.random() * (w[0] + w[1] + w[2]);
    type = r < w[0] ? 'zeni' : r < w[0] + w[1] ? 'koban' : 'goriyaku';
  }
  let n = 1;
  if (type === 'zeni') n = Math.random() < 0.55 ? 3 + (Math.random() * 6 | 0) : 1;
  if (type === 'noroi' && Math.random() < 0.3) n = 2;
  const cx = (Math.random() - 0.5) * 2 * (XB - 0.3);
  const pattern = Math.random();
  for (let i = 0; i < n; i++) {
    let x, yy;
    if (pattern < 0.3) { x = cx + (i - n / 2) * 0.75; yy = y; }               // 横一列
    else if (pattern < 0.55) { x = cx + Math.sin(i * 0.9) * 1.6; yy = y + i * 0.8; } // 蛇行
    else { x = cx + (Math.random() - 0.5) * 2.4; yy = y + Math.random() * 2; }
    x = THREE.MathUtils.clamp(x, -XB, XB);
    const obj = makeCoinMesh(type);
    obj.position.set(x, yy, (Math.random() - 0.5) * 0.6);
    obj.scale.setScalar(1.15);
    scene.add(obj);
    G.coins.push({ type, obj, x, y: yy, z: obj.position.z, vx: 0, vy: 0, spin: Math.random() * 6, ph: Math.random() * 6, pulled: false });
  }
}
function spawnFoe(cy, halfH) {
  const st = STAGES[G.stage];
  if (!st.foes.length) return;
  const kind = st.foes[Math.random() * st.foes.length | 0];
  if (kind === 'crow') {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const obj = makeCrow(); obj.scale.setScalar(1.3);
    const y = G.by + 5 + Math.random() * 8;
    obj.position.set(-dir * 12, y, 0.3); obj.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(obj);
    G.foes.push({ kind, obj, x: -dir * 12, y, vx: dir * (3.5 + Math.random() * 2 + G.stage * 0.6), t: 0, r: 0.7 });
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
  const r = 2.6 + Math.min(4.2, Math.sqrt(G.money) * 0.045) + G.form * 0.25;
  return G.gori > 0 ? r * 1.7 : r;
}
const suckPow = () => 42 + G.form * 6 + (G.gori > 0 ? 30 : 0) + (G.dai > 0 ? 60 : 0);
function topSpeed() {
  let vt = 14 + G.form * 2.5 + Math.min(8, G.combo * 0.25) + (G.gori > 0 ? 14 : 0) + (G.dai > 0 ? 34 : 0);
  if (G.fever && G.dai <= 0) vt = Math.min(vt, 13);
  return vt;
}
const altM = () => Math.max(0, G.by * UNIT_M);

// ---------- 更新 ----------
const mouthW = new THREE.Vector3();
let viewHalfH = 11, viewDist = 24;

function update(dt) {
  G.time += dt;
  const st = STAGES[G.stage];
  const S = bScale();

  // 左右移動
  const unitsPerPx = (2 * viewHalfH * camera.aspect) / window.innerWidth;
  if (input.dragPx) { const dx = input.dragPx * unitsPerPx * 1.25; G.bx += dx; G.bvx = dx / Math.max(dt, 1e-3); input.dragPx = 0; }
  else if (input.left || input.right) { G.bvx += ((input.right - input.left) * 9 - G.bvx) * Math.min(1, dt * 10); G.bx += G.bvx * dt; }
  else G.bvx *= Math.pow(0.02, dt);
  G.bx = THREE.MathUtils.clamp(G.bx, -XB, XB);

  // 吸引（押している間だけ・呪縛中は不可）
  const sucking = (input.down || input.key || G.dai > 0) && G.curse <= 0;
  G.sucking = sucking;
  G.mouth += ((sucking ? 1 : 0) - G.mouth) * Math.min(1, dt * 12);

  // 法力と上昇（慣性つきの加速）
  if (G.gori <= 0 && G.dai <= 0) G.energy = Math.max(0, G.energy - st.drain * dt);
  if (G.energy > 0) {
    const vt = topSpeed();
    G.v += (vt - G.v) * (G.v < vt ? 0.75 : 1.1) * dt;
    G.v = Math.min(G.v, vt + 22); // 加速の上乗せには上限
  } else {
    G.v = Math.max(-30, G.v - 16 * dt);
    if (Math.random() < dt * 1.5) floatText(G.bx, G.by + 3, 0, '法力切れ…お金を吸え！', '#ffb0b0', 18, 0.8);
  }
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
  G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
  G.fovKick *= Math.pow(0.15, dt); G.shake *= Math.pow(0.05, dt);

  // カメラ追従（落下中は追わない）
  const lead = Math.min(3.5, Math.max(0, G.v) * 0.07);
  const camTarget = G.by + 1.6 + lead;
  if (G.energy > 0 || camTarget > G.camY) G.camY += (camTarget - G.camY) * Math.min(1, dt * 4);
  if (G.by < G.camY - viewHalfH - 3) { gameOver(); return; }

  // 硬貨の生成
  const gap = G.fever ? 0.4 : 1.55 - G.stage * 0.06;
  while (G.spawnY < G.camY + viewHalfH + 8) { spawnCoins(G.spawnY); G.spawnY += gap * (0.7 + Math.random() * 0.6); }
  G.foeAcc += dt * st.foeRate * (altM() > 60 && !G.fever ? 1 : 0);
  while (G.foeAcc > 1) { G.foeAcc -= 1; spawnFoe(G.camY, viewHalfH); }

  // 硬貨
  const R = suckR(), P = suckPow();
  mouthW.set(G.bx, G.by + 1.85 * S, 0.4 * S);
  const bvy = G.v / UNIT_M;
  const damp = Math.pow(0.012, dt);
  for (let i = G.coins.length - 1; i >= 0; i--) {
    const c = G.coins[i];
    c.spin += dt * (c.pulled ? 14 : c.type === 'noroi' ? 1.5 : 2.5); c.ph += dt * 2;
    const dx = mouthW.x - c.x, dy = mouthW.y - c.y, d = Math.hypot(dx, dy) || 1e-3;
    if (sucking && d < R) {
      // 仏像と一緒に動く座標系で引き寄せる
      let rvx = c.vx - G.bvx * 0.6, rvy = c.vy - bvy;
      const f = P * (1.2 - d / R * 0.75);
      rvx += (dx / d * f - dy / d * f * 0.3) * dt;
      rvy += (dy / d * f + dx / d * f * 0.3) * dt;
      rvx *= damp; rvy *= damp;
      c.vx = rvx + G.bvx * 0.6; c.vy = rvy + bvy;
      c.pulled = true;
      if (Math.random() < dt * 8) emit(c.x, c.y, c.z, c.type === 'noroi' ? 0x9a40ff : 0xffe6a0, 1, 0.5, 0.4);
    } else {
      c.vx *= Math.pow(0.1, dt); c.vy *= Math.pow(0.1, dt); c.pulled = false;
      c.x += Math.sin(c.ph) * (c.type === 'noroi' ? 0.7 : 0.25) * dt;
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.z += (0 - c.z) * (c.pulled ? dt * 4 : 0);
    const grab = sucking ? 0.5 * S + COINS[c.type].r * 0.4 : 0.95 * S;
    const gd = sucking ? d : Math.hypot(G.bx - c.x, G.by + 1.0 * S - c.y);
    if (gd < grab) { absorb(c); scene.remove(c.obj); G.coins.splice(i, 1); continue; }
    if (c.y < G.camY - viewHalfH - 6) { scene.remove(c.obj); G.coins.splice(i, 1); continue; }
    c.obj.position.set(c.x, c.y, c.z);
    const shrink = c.pulled ? THREE.MathUtils.clamp(d / 2.2, 0.35, 1) : 1;
    c.obj.scale.setScalar(1.15 * shrink);
    c.obj.userData.mesh.rotation.set(Math.sin(c.ph) * 0.35, c.spin, Math.sin(c.ph * 0.7) * 0.2);
    if (c.obj.userData.glow && c.type === 'goriyaku') c.obj.userData.glow.material.opacity = 0.7 + Math.sin(G.time * 6) * 0.2;
  }

  // 障害物
  for (let i = G.foes.length - 1; i >= 0; i--) {
    const f = G.foes[i];
    f.t += dt;
    if (f.kind === 'crow') {
      f.x += f.vx * dt; f.y += Math.sin(f.t * 4) * 0.6 * dt;
      f.obj.position.set(f.x, f.y, 0.3);
      const flap = Math.sin(f.t * 16) * 0.9;
      f.obj.userData.wings[0].rotation.x = -flap; f.obj.userData.wings[1].rotation.x = flap;
      if (Math.hypot(G.bx - f.x, G.by + 1.0 * S - f.y) < 0.9 * S + f.r) {
        if (G.dai > 0 || G.gori > 0) { G.score += 200; emit(f.x, f.y, 0, 0xfff0c0, 24, 6); floatText(f.x, f.y, 0, 'カラス退散 +200', '#fff3a0', 18); scene.remove(f.obj); G.foes.splice(i, 1); continue; }
        if (G.inv <= 0) {
          const stolen = Math.min(G.money, 30 + G.stage * 30);
          G.money -= stolen;
          hurt(8, `カラスに ¥${stolen} 奪われた！`);
        }
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
        if (Math.abs(G.bx - f.x) < 0.6 + 0.4 * S && G.by < f.y && G.by > f.y - 24) hurt(18, '落雷！ 法力 -18');
      }
      if (!striking) { f.struck = false; f.bolt.visible = false; }
      if (f.y < G.camY - viewHalfH - 8) { scene.remove(f.obj); G.foes.splice(i, 1); continue; }
    }
  }

  // 尾を引く光の粒（速いほど長い軌跡）
  if (G.energy > 0) {
    const n = 2 + Math.floor(Math.max(0, G.v) * 0.25);
    for (let k = 0; k < n; k++) {
      parts.length < MAXP && parts.push({ x: G.bx + (Math.random() - 0.5) * 1.4 * S, y: G.by - 0.7 * S + (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.6, vy: -0.6 - Math.random(), vz: 0, life: 0.9, max: 0.9, r: 1, g: G.dai > 0 || G.gori > 0 ? 0.95 : 0.78, b: G.dai > 0 || G.gori > 0 ? 0.7 : 0.35, grav: 0 });
    }
  }
}

function hurt(amount, label) {
  if (G.inv > 0 || G.dai > 0 || G.gori > 0) return;
  G.energy = Math.max(0, G.energy - amount);
  G.inv = 1.2; G.combo = 0; G.shake = 0.5; G.v *= 0.6;
  audio.hit(); flash(0.2);
  floatText(G.bx, G.by + 3.6, 0, label, '#ff8a7a', 20, 1.1);
}

function absorb(c) {
  const d = COINS[c.type];
  const S = bScale();
  if (c.type === 'noroi') {
    if (G.gori > 0 || G.dai > 0) { G.score += 150; emit(c.x, c.y, 0, 0xe0c0ff, 14, 4); floatText(c.x, c.y, 0, '呪い浄化 +150', '#f0d8ff', 18); audio.coin(12); return; }
    const lost = Math.min(G.money, Math.floor(G.money * 0.06) + 30);
    G.money -= lost;
    G.energy = Math.max(0, G.energy + d.energy);
    G.curse = 1.3; G.combo = 0; G.v *= 0.55; G.shake = 0.6;
    audio.curse(); flash(0.15);
    emit(c.x, c.y, 0, 0x8a20ff, 40, 6, 1);
    floatText(G.bx, G.by + 4, 0, '呪いの銭！ 呪縛で吸えない', '#e6a0ff', 20, 1.2);
    if (lost) floatText(G.bx, G.by + 3.2, 0, `-¥${lost}`, '#e6a0ff', 18, 1.2);
    return;
  }
  G.combo++; G.comboT = 0.85; G.maxCombo = Math.max(G.maxCombo, G.combo);
  const mult = 1 + Math.min(4, Math.floor(G.combo / 15));
  G.money += d.money; G.stageMoney += d.money;
  G.score += d.money * mult * (G.dai > 0 ? 2 : 1);
  G.energy = Math.min(100, G.energy + d.energy);
  G.v += d.boost; // 吸うたびに加速
  if (G.fever) { G.feverCount++; if (G.feverCount === HENSHIN_NEED && G.dai <= 0) henshin(); }
  if (c.type === 'koban') {
    audio.koban(); G.fovKick += 4; G.shake = Math.max(G.shake, 0.15);
    floatText(c.x, c.y + 0.6, 0, '小判 ¥300  加速！', '#ffe066', 22);
    emit(c.x, c.y, 0, 0xffe066, 24, 5);
    shockwave(G.bx, G.by - 0.6 * S, 0xffe08a, 5);
  } else if (c.type === 'goriyaku') {
    audio.goriyaku(); G.gori = 6; flash(0.45); G.fovKick += 10; G.shake = 0.4;
    banner('御利益！', '吸引範囲アップ・呪い無効・超加速');
    emit(c.x, c.y, 0, 0xfff2a0, 60, 9, 1.2);
    shockwave(G.bx, G.by - 0.6 * S, 0xfff2b0, 9);
  } else {
    audio.coin(Math.min(25, G.combo));
    emit(mouthW.x, mouthW.y, mouthW.z, 0xffc070, 3, 1.5, 0.5);
    if (G.combo % 15 === 0) { floatText(G.bx, G.by + 4.2, 0, `${G.combo} 連続吸引！ ×${mult}`, '#ffffff', 22); G.fovKick += 2; }
  }
  // 成長
  let nf = G.form;
  while (nf + 1 < FORMS.length && G.money >= FORMS[nf + 1].need) nf++;
  if (nf > G.form) {
    G.form = nf;
    if (G.dai <= 0) setModel(FORMS[nf].lv);
    audio.level(); flash(0.5); G.fovKick += 6;
    banner('進化！', `Lv.${FORMS[nf].lv} ${FORMS[nf].name}`);
    emit(G.bx, G.by + 1.5 * S, 0, 0xffe680, 120, 10, 1.4);
    shockwave(G.bx, G.by + 0.5, 0xffe6a0, 10);
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
  const bonus = Math.round(G.energy) * 10 + (G.dai > 0 ? 3000 : 0);
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
    `残り法力ボーナス <b>+${(Math.round(G.energy) * 10).toLocaleString()}</b>`,
    `仏像：<b>Lv.${form().lv} ${form().name}</b>`,
    `スコア <b>${G.score.toLocaleString()}</b>`,
    last ? `黄金の大仏は極楽浄土へ到達した<br>称号：<b>${rank(G.score)}</b>` : `次は「<b>${STAGES[G.stage + 1].name}</b>」へ`,
  ].join('<br>');
  $('resNext').textContent = last ? 'もう一度遊ぶ' : '次へ';
  if (last) { resultKind = 'end'; setModel(5); G.dai = 1; }
  show('result', true); show('hud', false); show('panel', false);
}
function gameOver() {
  state = 'result'; resultKind = 'over';
  input.down = input.key = false;
  saveBest();
  audio.tone(220, 0.6, 'triangle', 0.1, 0, -120); audio.tone(165, 1.0, 'triangle', 0.1, 0.3, -80);
  $('resTitle').textContent = '墜落…';
  $('resAlt').textContent = Math.floor(G.maxAlt || altM()).toLocaleString() + 'm';
  $('resMoney').textContent = G.money.toLocaleString();
  $('resRibbon').textContent = `称号：${rank(G.score)}`;
  $('resLines').innerHTML = [`第${G.stage + 1}天「${STAGES[G.stage].name}」で力尽きた`, `スコア <b>${G.score.toLocaleString()}</b>　最大 <b>${G.maxCombo}</b> 連続`, `ベストスコア <b>${best.score.toLocaleString()}</b>`].join('<br>');
  $('resNext').textContent = 'もう一度遊ぶ';
  show('result', true); show('hud', false); show('panel', false);
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
  $('goalFill').style.width = Math.min(100, (altM() - st.start) / st.goal * 100) + '%';
  const nxt = FORMS[G.form + 1];
  $('evoFill').style.width = nxt ? Math.min(100, (G.money - form().need) / (nxt.need - form().need) * 100) + '%' : '100%';
  $('energyFill').style.width = G.energy + '%';
  $('energyFill').classList.toggle('low', G.energy < 25);
  $('speedFill').style.width = Math.min(100, Math.max(0, G.v) / 60 * 100) + '%';
  let s = '';
  if (G.fever && G.dai <= 0) s = `賽銭の嵐 ${Math.min(G.feverCount, HENSHIN_NEED)} / ${HENSHIN_NEED} 枚`;
  else if (G.gori > 0) s = `御利益 ${G.gori.toFixed(1)}秒`;
  else if (G.combo >= 5) s = `${G.combo} 連続`;
  setText('status', s);
  const sb = $('suckBtn');
  sb.classList.toggle('on', !!G.sucking); sb.classList.toggle('cursed', G.curse > 0);
  setText('suckLbl', G.curse > 0 ? '呪縛' : G.sucking ? '吸引中' : '吸う');
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
    const lv = 1 + Math.floor(titleT / 3) % 5;
    if (!model || model.userData.lv !== lv) setModel(lv);
    by = 1.6; bx = 0; S = lv === 5 ? 1.35 : 1.1;
    buddhaRoot.position.set(0, by + Math.sin(t * 0.0015) * 0.15, 0);
    buddhaRoot.scale.setScalar(S);
    buddhaRoot.rotation.set(0, Math.sin(titleT * 0.3) * 0.25, 0);
    const a = titleT * 0.12;
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(Math.sin(a) * 9, by + 2.2, 15 + Math.cos(a) * 2);
    lookAt.set(0, by + 3.4, 0); camera.lookAt(lookAt);
    // 渦を巻いて吸い込まれる硬貨
    if (titleCoins.length < 40 && Math.random() < 0.5) {
      const types = ['zeni', 'zeni', 'zeni', 'koban', 'goriyaku'];
      const o = makeCoinMesh(types[Math.random() * types.length | 0]); scene.add(o);
      titleCoins.push({ o, a: Math.random() * 6.28, r: 6 + Math.random() * 4, y: by + Math.random() * 7 - 1, s: Math.random() * 6 });
    }
    for (let i = titleCoins.length - 1; i >= 0; i--) {
      const c = titleCoins[i];
      c.a += dt * (1.5 + 4 / c.r); c.r -= dt * 1.6; c.s += dt * 6;
      const my = by + 1.85 * S;
      c.y += (my - c.y) * dt * 0.8;
      c.o.position.set(Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r * 0.6 + 0.4);
      c.o.userData.mesh.rotation.set(0.3, c.s, 0);
      c.o.scale.setScalar(Math.min(1, c.r / 2));
      if (c.r < 0.4) { scene.remove(c.o); titleCoins.splice(i, 1); emit(0, my, 0.4, 0xffd070, 3, 1.2, 0.5); }
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
  buddhaRoot.position.set(bx, by + bob, 0);
  const curS = buddhaRoot.scale.x;
  buddhaRoot.scale.setScalar(curS + (S - curS) * Math.min(1, dt * 3));
  buddhaRoot.rotation.set(-speed01 * 0.12, THREE.MathUtils.clamp(-G.bvx * 0.02, -0.3, 0.3), THREE.MathUtils.clamp(-G.bvx * 0.015, -0.2, 0.2));
  const ud = model.userData;
  ud.mouth.scale.set(0.06 + G.mouth * 0.03, 0.006 + G.mouth * 0.07, 0.02 + G.mouth * 0.02);
  ud.lipL.position.y = -0.29 - G.mouth * 0.04;
  if (ud.halo) ud.halo.rotation.z += dt * (0.2 + speed01 * 1.5) * (ud.lv >= 3 ? 0.2 : 0.4);
  if (ud.glow) ud.glow.material.opacity = 0.22 + speed01 * 0.2 + (G.gori > 0 ? 0.2 : 0);
  aura.material.opacity = 0.12 + speed01 * 0.25 + (G.dai > 0 ? 0.2 : 0);
  aura.scale.setScalar(4 + speed01 * 4);
  aura.material.color.set(G.curse > 0 ? 0x9a40ff : 0xffc860);
  // 点滅（無敵時間）
  model.visible = !(G.inv > 0 && Math.floor(t / 70) % 2);

  // 吸引の渦
  swirl.visible = !!G.sucking;
  if (G.sucking) {
    const R = Math.min(suckR(), 12);
    swirl.position.copy(mouthW);
    swirlDisc.scale.setScalar(R);
    swirlRings.forEach((r, i) => {
      const k = 1 - ((t * 0.0011 + i / swirlRings.length) % 1);
      r.scale.setScalar(R * k); r.material.opacity = (1 - k) * 0.45 * (G.gori > 0 ? 1.4 : 1);
      r.rotation.z = t * 0.002;
    });
  }

  // カメラ（速度で視野が広がる＝ドリーズーム）
  const fov = 52 + speed01 * 24 + Math.min(20, G.fovKick);
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
  lineMat.opacity = Math.max(0, speed01 * 0.75 - 0.05);
  const lineSpeed = (Math.max(0, G.v) / UNIT_M) * 3.2;
  for (let i = 0; i < LINES; i++) {
    const L = lineData[i];
    L.y -= lineSpeed * L.k * dt;
    if (L.y < camY - viewHalfH * 1.6) resetLine(L, camY, viewHalfH * 1.4, false);
    const len = 0.6 + speed01 * 7 * L.k;
    p4.set(L.x, L.y, L.z); s4.set(1 + speed01, len, 1); q4.identity();
    m4.compose(p4, q4, s4); lines.setMatrixAt(i, m4);
  }
  lines.instanceMatrix.needsUpdate = true;
  updateMotesFor(camY);

  // 衝撃波
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i]; s.t += dt;
    const k = s.t / 0.7;
    s.m.scale.setScalar(1 + k * s.size); s.m.material.opacity = Math.max(0, 0.9 * (1 - k));
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
  const strength = alt > 2300 ? 0.6 : alt < 300 ? 0.45 : 0.2;
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
  motes.material.color.set(alt < 400 || alt > 2300 ? 0xffc8dc : alt > 1500 && alt < 2300 ? 0xd8e0ff : 0xfff4d0);
}

// ---------- ループ ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
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
window.__buddha = { get state() { return state; }, get G() { return G; }, input, setModel, world, camera, scene, renderer, composer };
