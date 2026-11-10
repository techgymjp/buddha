// 空飛ぶ仏像 — お金を吸い込め！仏の力で天まで昇れ！
(() => {
  'use strict';

  const W = 540, H = 960;
  const PX_PER_M = 10;
  const BUDDHA_Y = H * 0.55;      // 仏像は画面中央付近
  const PANEL_Y = H - 116;        // 下部の操作パネル
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const muteBtn = document.getElementById('mute');

  // ---------- 画面サイズ ----------
  let scale = 1, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 保存 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('flyingBuddha.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('flyingBuddha.' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } },
  };
  let best = store.get('best', { score: 0, stage: 0 });

  // ---------- サウンド ----------
  let actx = null, muted = store.get('muted', false);
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, delay = 0, slide = 0) {
    if (muted) return;
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let lastCoinSfx = 0;
  const sfx = {
    coin(p = 0) {
      const now = performance.now(); if (now - lastCoinSfx < 35) return; lastCoinSfx = now;
      tone(1700 + p * 35, 0.07, 'square', 0.035); tone(2500 + p * 35, 0.1, 'sine', 0.05, 0.04);
    },
    koban() { [1200, 1600, 2000, 2600].forEach((f, i) => tone(f, 0.15, 'triangle', 0.08, i * 0.05)); },
    goriyaku() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.35, 'triangle', 0.09, i * 0.07)); },
    curse() { tone(300, 0.5, 'sawtooth', 0.1, 0, -220); tone(207, 0.6, 'square', 0.05, 0.1, -120); },
    hit() { tone(160, 0.35, 'sawtooth', 0.12, 0, -100); },
    level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, i * 0.08)); },
    gong() { tone(110, 2.5, 'sine', 0.25); tone(220.5, 2.0, 'sine', 0.08); tone(331, 1.5, 'sine', 0.04); },
    henshin() { sfx.gong(); [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.08, 0.2 + i * 0.09)); },
  };
  function setMuted(m) { muted = m; store.set('muted', m); muteBtn.textContent = m ? '×' : '♪'; }
  setMuted(muted);
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); setMuted(!muted); });

  // ---------- 硬貨 ----------
  const COINS = {
    zeni:     { name: '銅銭',            r: 14, money: 10,  energy: 3,  w: 70 },
    koban:    { name: '小判',            r: 24, money: 300, energy: 14, w: 9 },
    goriyaku: { name: '黄金の御利益コイン', r: 20, money: 500, energy: 30, w: 2.2 },
    noroi:    { name: '呪いの銭',        r: 16, money: 0,   energy: -18, w: 0 }, // 出現率はステージ依存
  };

  // ---------- ステージ（上昇するほど世界が変わる） ----------
  const STAGES = [
    { name: '地上の寺院', goal: 250, sky: ['#4a9ee0', '#a9dbf5', '#f1fbff'], bg: ['roof', 'roof', 'pine', 'cloud'], cloud: 'rgba(255,255,255,.85)', curse: 0.07, foe: 0.20, foes: ['crow'], drain: 4.5 },
    { name: '山頂',       goal: 320, sky: ['#3b7fc4', '#9cc8e8', '#e8f3f8'], bg: ['mountain', 'mountain', 'pine', 'cloud'], cloud: 'rgba(255,255,255,.85)', curse: 0.11, foe: 0.32, foes: ['crow', 'crow', 'thunder'], drain: 5.5 },
    { name: '雲海',       goal: 400, sky: ['#5d9bd6', '#cfe6f6', '#ffffff'], bg: ['cloud', 'cloud', 'bigcloud'], cloud: 'rgba(255,255,255,.92)', curse: 0.15, foe: 0.40, foes: ['thunder', 'crow'], drain: 6.5 },
    { name: '天空',       goal: 480, sky: ['#060a2e', '#1c2f78', '#4a6fc0'], bg: ['star', 'star', 'star', 'wisp'], cloud: 'rgba(200,220,255,.25)', curse: 0.19, foe: 0.45, foes: ['thunder'], drain: 7.5 },
    { name: '極楽浄土',   goal: 560, sky: ['#f4a9c8', '#fde0a8', '#fff8e6'], bg: ['lotus', 'pcloud', 'pavilion', 'pcloud'], cloud: 'rgba(255,236,246,.9)', curse: 0.22, foe: 0.0, foes: [], drain: 8 },
  ];
  const FEVER_AT = 0.78;      // 目標高度の78%から「賽銭の嵐」
  const HENSHIN_NEED = 25;    // 嵐の中でこの枚数を吸うと大仏に変身

  // ---------- 仏像の成長 ----------
  const FORMS = [
    { lv: 1, name: '木造仏',           need: 0,    scale: 0.9 },
    { lv: 2, name: '金色の仏像',       need: 250,  scale: 1.0 },
    { lv: 3, name: '光背の仏像',       need: 1200, scale: 1.05 },
    { lv: 4, name: '千手観音',         need: 3500, scale: 1.12 },
    { lv: 5, name: '黄金の大仏',       need: 8000, scale: 1.4 },
  ];

  // ---------- 入力：押すと吸引／離すと停止、押したまま左右スワイプで移動 ----------
  const input = { ptrDown: false, lastX: 0, left: false, right: false, keySuck: false, dragDX: 0 };
  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audio();
    const p = toLocal(e);
    if (state !== 'play') { onTap(); return; }
    input.ptrDown = true; input.lastX = p.x;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.ptrDown) return;
    const p = toLocal(e);
    input.dragDX += p.x - input.lastX;
    input.lastX = p.x;
  });
  const up = () => { input.ptrDown = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    audio();
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = true;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = true;
    if (k === ' ' || k === 'z' || k === 'Z' || k === 'Enter') {
      e.preventDefault();
      if (state === 'play') input.keySuck = true; else if (!e.repeat) onTap();
    }
    if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
    if (k === 'm' || k === 'M') setMuted(!muted);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
    if (k === ' ' || k === 'z' || k === 'Z' || k === 'Enter') input.keySuck = false;
  });
  window.addEventListener('blur', () => {
    input.left = input.right = input.keySuck = input.ptrDown = false;
    if (state === 'play') togglePause();
  });

  // ---------- ゲーム状態 ----------
  let state = 'title'; // title | play | paused | clear | over | ending
  let G = null;
  let stateTime = 0;

  function newRun() {
    G = { stage: 0, money: 0, score: 0, form: 0, maxCombo: 0, energy: 70, henshinCount: 0 };
    startStage(0);
  }

  function startStage(i) {
    G.stage = i;
    G.alt = 0;
    G.energy = Math.max(G.energy, 70);
    G.combo = 0; G.comboT = 0;
    G.goriyaku = 0; G.curse = 0; G.inv = 0; G.hurt = 0; G.flash = 0;
    G.stageMoney = 0; G.feverCount = 0; G.fever = false;
    G.daibutsu = 0; G.henshinT = 0;
    G.b = { x: W / 2, y: BUDDHA_Y, vx: 0, mouth: 0, s: FORMS[G.form].scale };
    G.coins = []; G.foes = []; G.parts = []; G.texts = []; G.bg = [];
    G.spawnAcc = 0; G.foeAcc = 0; G.time = 0;
    const st = STAGES[i];
    for (let n = 0; n < (st.bg[0] === 'star' ? 60 : 9); n++) G.bg.push(makeBg(Math.random() * (H + 200) - 200));
    for (let n = 0; n < 22; n++) spawnCoin(Math.random() * (BUDDHA_Y - 150), true);
    state = 'play'; stateTime = 0;
    addText(W / 2, H * 0.3, '第' + (i + 1) + '天　' + st.name, '#fff2c0', 40, 2.2);
    sfx.gong();
  }

  function makeBg(y) {
    const st = STAGES[G.stage];
    const kind = st.bg[Math.random() * st.bg.length | 0];
    const o = { kind, y, p: 0.35 + Math.random() * 0.45, w: 90 + Math.random() * 150, side: Math.random() < 0.5 ? -1 : 1, seed: Math.random() };
    if (kind === 'roof' || kind === 'mountain' || kind === 'pine' || kind === 'pavilion') {
      // 寺院や山は画面の左右に配置して、中央の仏像を邪魔しない
      o.x = o.side < 0 ? Math.random() * 90 : W - Math.random() * 90;
      o.p = kind === 'pine' ? 0.9 : 0.6 + Math.random() * 0.2;
    } else if (kind === 'star') {
      o.x = Math.random() * W; o.p = 0.05 + Math.random() * 0.25; o.w = 1 + Math.random() * 2.2;
    } else o.x = Math.random() * W;
    return o;
  }

  function spawnCoin(y, calm) {
    const st = STAGES[G.stage];
    let type;
    if (G.fever) type = Math.random() < 0.12 ? 'koban' : 'zeni';
    else if (!calm && Math.random() < st.curse) type = 'noroi';
    else {
      const ws = [COINS.zeni.w, COINS.koban.w + G.stage, COINS.goriyaku.w];
      let r = Math.random() * (ws[0] + ws[1] + ws[2]);
      type = r < ws[0] ? 'zeni' : r < ws[0] + ws[1] ? 'koban' : 'goriyaku';
    }
    const c = COINS[type];
    // 銅銭は群れ・列で出ることが多い
    let n = 1;
    if (type === 'zeni') n = Math.random() < 0.55 ? 3 + (Math.random() * 6 | 0) : 1;
    if (type === 'noroi' && Math.random() < 0.3) n = 2;
    const cx = 30 + Math.random() * (W - 60);
    const line = Math.random() < 0.4;
    for (let i = 0; i < n; i++) {
      const x = line ? cx + (i - n / 2) * 30 : cx + (Math.random() - 0.5) * 100;
      G.coins.push({
        type, x: Math.min(W - 18, Math.max(18, x)), y: y - (line ? 0 : Math.random() * 80),
        vx: 0, vy: 0, ph: Math.random() * 6.28, spin: Math.random() * 6.28, r: c.r,
      });
    }
  }

  function spawnFoe() {
    const st = STAGES[G.stage];
    if (!st.foes.length) return;
    const kind = st.foes[Math.random() * st.foes.length | 0];
    if (kind === 'crow') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      G.foes.push({ kind, x: dir > 0 ? -40 : W + 40, y: 120 + Math.random() * 260, vx: dir * (120 + Math.random() * 80 + G.stage * 25), r: 22, t: 0 });
    } else {
      G.foes.push({ kind, x: 80 + Math.random() * (W - 160), y: -80, r: 48, t: Math.random() * 1.5, vx: (Math.random() - 0.5) * 50 });
    }
  }

  // ---------- パラメータ ----------
  const form = () => FORMS[G.form];
  const suckRadius = () => {
    if (G.daibutsu > 0) return 620;
    // 集めた額に応じて吸引範囲が広がる
    const r = 120 + Math.min(200, Math.sqrt(G.money) * 2.2) + G.form * 12;
    return G.goriyaku > 0 ? r * 1.8 : r;
  };
  const suckPower = () => 1500 + G.form * 250 + (G.goriyaku > 0 ? 1200 : 0) + (G.daibutsu > 0 ? 2500 : 0);
  const riseSpeed = () => {
    if (G.energy <= 0) return 0;
    return 100 + G.form * 14 + Math.min(40, G.energy * 0.3) + (G.goriyaku > 0 ? 80 : 0) + (G.daibutsu > 0 ? 120 : 0);
  };
  const bodyR = () => 40 * G.b.s;

  function togglePause() {
    if (state === 'play') state = 'paused';
    else if (state === 'paused') state = 'play';
  }

  function onTap() {
    if (state === 'title') newRun();
    else if (state === 'paused') state = 'play';
    else if (state === 'clear' && stateTime > 1.0) {
      if (G.stage + 1 < STAGES.length) startStage(G.stage + 1);
      else { state = 'ending'; stateTime = 0; saveBest(STAGES.length); sfx.henshin(); }
    } else if ((state === 'over' || state === 'ending') && stateTime > 1.2) { state = 'title'; stateTime = 0; }
  }

  function saveBest(stageReached) {
    if (G.score > best.score || stageReached > best.stage) {
      best = { score: Math.max(best.score, G.score), stage: Math.max(best.stage, stageReached) };
      store.set('best', best);
    }
  }

  function addText(x, y, s, color, size = 26, life = 0.9) { G.texts.push({ x, y, s, color, size, life, max: life }); }
  function burst(x, y, color, n = 8, sp = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, v = sp * (0.4 + Math.random() * 0.8);
      G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, max: 1, color, s: 2 + Math.random() * 3 });
    }
  }

  function hurt(amount, x, y, label) {
    if (G.inv > 0 || G.daibutsu > 0 || G.goriyaku > 0) return false;
    G.energy = Math.max(0, G.energy - amount);
    G.inv = 1.2; G.hurt = 0.4; G.combo = 0;
    sfx.hit();
    burst(x, y, '#444', 12, 200);
    addText(G.b.x, G.b.y - 110, label || ('法力 -' + amount), '#ff7070', 26, 1.0);
    return true;
  }

  // ---------- 更新 ----------
  function update(dt) {
    stateTime += dt;
    if (!G) return;
    if (state === 'clear' || state === 'ending') { updateParticles(dt); return; }
    if (state !== 'play') return;
    const st = STAGES[G.stage];
    const b = G.b;
    G.time += dt;

    // 左右移動（スワイプ or キー）
    if (input.dragDX) { b.x += input.dragDX * 1.25; b.vx = input.dragDX / Math.max(dt, 0.001) * 0.3; input.dragDX = 0; }
    else if (input.left || input.right) { b.vx += ((input.right - input.left) * 400 - b.vx) * Math.min(1, dt * 10); b.x += b.vx * dt; }
    else b.vx *= 0.8;
    const margin = 34 * b.s;
    b.x = Math.max(margin, Math.min(W - margin, b.x));

    // 吸引：押している間だけ。呪縛中は吸えない
    const sucking = (input.ptrDown || input.keySuck || G.daibutsu > 0) && G.curse <= 0;
    G.sucking = sucking;
    b.mouth += ((sucking ? 1 : 0) - b.mouth) * Math.min(1, dt * 12);

    // 大きさ（成長・変身の演出）
    const targetS = G.daibutsu > 0 ? 2.1 : form().scale;
    b.s += (targetS - b.s) * Math.min(1, dt * 3);

    // 法力（お金のエネルギー）で上昇
    if (!(G.goriyaku > 0 || G.daibutsu > 0)) G.energy = Math.max(0, G.energy - st.drain * dt);
    const v = riseSpeed() * (G.fever && G.daibutsu <= 0 ? 0.55 : 1);
    const ty = G.daibutsu > 0 ? H * 0.6 : BUDDHA_Y;
    if (G.energy > 0) b.y += (ty - b.y) * Math.min(1, dt * 2);
    else {
      b.y += 170 * dt;
      if (Math.floor(G.time * 4) % 4 === 0 && Math.random() < 0.1) addText(b.x, b.y - 110, '法力切れ…お金を吸え！', '#ffb0b0', 22, 0.5);
    }
    const scroll = v * dt;
    G.alt += scroll / PX_PER_M;
    G.score += Math.round(scroll / PX_PER_M * (G.daibutsu > 0 ? 3 : 1));

    if (b.y > H + 90) { gameOver(); return; }
    if (G.alt >= st.goal) { stageClear(); return; }

    // 賽銭の嵐
    if (!G.fever && G.alt >= st.goal * FEVER_AT) {
      G.fever = true;
      addText(W / 2, H * 0.32, '賽銭の嵐！', '#ffe066', 50, 1.8);
      addText(W / 2, H * 0.37, HENSHIN_NEED + '枚吸い込めば大仏に…！', '#ffffff', 24, 1.8);
      sfx.koban();
    }

    G.goriyaku = Math.max(0, G.goriyaku - dt);
    G.curse = Math.max(0, G.curse - dt);
    G.inv = Math.max(0, G.inv - dt);
    G.hurt = Math.max(0, G.hurt - dt);
    G.flash = Math.max(0, G.flash - dt);
    if (G.daibutsu > 0) G.henshinT += dt;
    G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;

    // 背景は下へ流れる
    for (const o of G.bg) {
      o.y += scroll * o.p;
      if (o.y - 220 > H) Object.assign(o, makeBg(-160 - Math.random() * 240));
    }

    // 硬貨の出現
    G.spawnAcc += scroll;
    const gap = G.fever ? 16 : 62 - G.stage * 3;
    while (G.spawnAcc > gap) { G.spawnAcc -= gap; spawnCoin(-30 - Math.random() * 40); }
    G.foeAcc += dt * st.foe * (G.alt > 25 && !G.fever ? 1 : 0);
    while (G.foeAcc > 1) { G.foeAcc -= 1; spawnFoe(); }

    // 硬貨の動き・吸引
    const R = suckRadius(), P = suckPower();
    const mx = b.x, my = b.y - 44 * b.s; // 口の位置
    const br = bodyR();
    for (let i = G.coins.length - 1; i >= 0; i--) {
      const c = G.coins[i];
      c.ph += dt * 2; c.spin += dt * (c.type === 'noroi' ? 1.5 : 4);
      c.y += scroll;
      const dx = mx - c.x, dy = my - c.y, d = Math.hypot(dx, dy) || 1;
      if (sucking && d < R) {
        const f = P * (1.15 - d / R * 0.75);
        c.vx += dx / d * f * dt; c.vy += dy / d * f * dt;
        // 渦を巻くように
        c.vx += -dy / d * f * 0.25 * dt; c.vy += dx / d * f * 0.25 * dt;
        c.vx *= 0.93; c.vy *= 0.93;
        c.pulled = true;
      } else {
        c.vx *= 0.9; c.vy *= 0.9; c.pulled = false;
        c.x += Math.sin(c.ph) * (c.type === 'noroi' ? 30 : 12) * dt;
      }
      c.x += c.vx * dt; c.y += c.vy * dt;
      // 吸い込み中は口へ、吸っていない時は体に触れたら取得
      const grab = sucking ? Math.max(18, br * 0.45) : br * 0.75;
      const gd = sucking ? d : Math.hypot(b.x - c.x, b.y - 20 * b.s - c.y);
      if (gd < grab + c.r * 0.4) { absorb(c); G.coins.splice(i, 1); continue; }
      if (c.y > H + 60 || c.x < -80 || c.x > W + 80) G.coins.splice(i, 1);
    }

    // 障害物
    for (let i = G.foes.length - 1; i >= 0; i--) {
      const f = G.foes[i];
      f.t += dt;
      f.y += scroll * (f.kind === 'crow' ? 0.4 : 1);
      if (f.kind === 'crow') {
        f.x += f.vx * dt; f.y += Math.sin(f.t * 5) * 40 * dt;
        if (Math.hypot(b.x - f.x, (b.y - 20 * b.s) - f.y) < bodyR() * 0.8 + f.r * 0.7) {
          if (G.daibutsu > 0 || G.goriyaku > 0) { G.score += 200; burst(f.x, f.y, '#fff7c0', 14); addText(f.x, f.y, 'カラス退散 +200', '#fff3a0', 22); G.foes.splice(i, 1); continue; }
          if (G.inv <= 0) {
            const stolen = Math.min(G.money, 30 + G.stage * 30);
            G.money -= stolen;
            hurt(8, f.x, f.y, 'カラスに ¥' + stolen + ' 奪われた！');
          }
        }
      } else if (f.kind === 'thunder') {
        f.x += f.vx * dt; if (f.x < 70 || f.x > W - 70) f.vx *= -1;
        const cyc = f.t % 3.4;
        f.charging = cyc > 2.2 && cyc < 2.9;
        f.striking = cyc >= 2.9;
        if (f.striking && Math.abs(b.x - f.x) < 30 + 16 * b.s && b.y > f.y) hurt(18, b.x, b.y - 40, '落雷！ 法力 -18');
        if (f.striking && !f.sounded) { tone(90, 0.35, 'square', 0.06); f.sounded = true; }
        if (!f.striking) f.sounded = false;
      }
      if (f.y > H + 120 || f.x < -120 || f.x > W + 120) G.foes.splice(i, 1);
    }

    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (let i = G.parts.length - 1; i >= 0; i--) {
      const p = G.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
      if (p.life <= 0) G.parts.splice(i, 1);
    }
    for (let i = G.texts.length - 1; i >= 0; i--) {
      const t = G.texts[i]; t.y -= 34 * dt; t.life -= dt;
      if (t.life <= 0) G.texts.splice(i, 1);
    }
    // 上昇の光の粒
    if (state === 'play' && G.energy > 0 && Math.random() < 0.7) {
      const b = G.b;
      G.parts.push({ x: b.x + (Math.random() - 0.5) * 60 * b.s, y: b.y + 40 * b.s, vx: (Math.random() - 0.5) * 30, vy: 140 + Math.random() * 80, life: 0.6, max: 0.6, color: G.daibutsu > 0 || G.goriyaku > 0 ? '#fff6a0' : '#ffd25a', s: 2 + Math.random() * 3 });
    }
  }

  function absorb(c) {
    const d = COINS[c.type];
    const b = G.b;
    if (c.type === 'noroi') {
      if (G.goriyaku > 0 || G.daibutsu > 0) {
        G.score += 150; burst(c.x, c.y, '#e0c0ff', 10);
        addText(c.x, c.y - 20, '呪い浄化 +150', '#f0d8ff', 22);
        sfx.coin(10);
        return;
      }
      const lost = Math.min(G.money, Math.floor(G.money * 0.06) + 30);
      G.money -= lost;
      G.energy = Math.max(0, G.energy + d.energy);
      G.curse = 1.3; G.hurt = 0.35; G.combo = 0;
      sfx.curse();
      burst(c.x, c.y, '#7a2fb0', 16, 220);
      addText(b.x, b.y - 120, '呪いの銭！ 呪縛で吸えない', '#e6a0ff', 26, 1.2);
      if (lost) addText(b.x, b.y - 150, '-¥' + lost, '#e6a0ff', 22, 1.2);
      return;
    }
    G.combo++; G.comboT = 0.8; G.maxCombo = Math.max(G.maxCombo, G.combo);
    const mult = 1 + Math.min(4, Math.floor(G.combo / 15));
    G.money += d.money; G.stageMoney += d.money;
    G.score += d.money * mult * (G.daibutsu > 0 ? 2 : 1);
    G.energy = Math.min(100, G.energy + d.energy);
    if (G.fever) {
      G.feverCount++;
      if (G.feverCount === HENSHIN_NEED && G.daibutsu <= 0) henshin();
    }
    if (c.type === 'koban') { sfx.koban(); addText(c.x, c.y - 20, '小判 ¥300', '#ffe066', 26, 0.9); burst(c.x, c.y, '#ffe066', 10); }
    else if (c.type === 'goriyaku') {
      sfx.goriyaku();
      G.goriyaku = 6; G.flash = 0.3;
      addText(W / 2, H * 0.36, '御利益！', '#fff6a0', 52, 1.5);
      addText(W / 2, H * 0.41, '吸引範囲アップ・呪い無効', '#ffffff', 22, 1.5);
      burst(c.x, c.y, '#fff6a0', 26, 300);
    } else {
      sfx.coin(Math.min(25, G.combo)); burst(c.x, c.y, '#d08a4a', 3, 80);
      if (G.combo % 15 === 0) addText(b.x, b.y - 130, G.combo + ' 連続吸引！ ×' + mult, '#ffffff', 26);
    }
    // 成長
    let nf = G.form;
    while (nf + 1 < FORMS.length && G.money >= FORMS[nf + 1].need) nf++;
    if (nf > G.form) {
      G.form = nf; sfx.level(); G.flash = 0.25;
      addText(W / 2, H * 0.27, '進化！', '#ffe680', 48, 1.8);
      addText(W / 2, H * 0.32, 'Lv.' + FORMS[nf].lv + '　' + FORMS[nf].name, '#ffffff', 30, 1.8);
      burst(b.x, b.y - 40, '#ffe680', 36, 320);
    }
  }

  function henshin() {
    G.daibutsu = 1; G.henshinT = 0; G.flash = 0.8; G.henshinCount++;
    sfx.henshin();
    addText(W / 2, H * 0.25, '大仏変身！！', '#ffe066', 60, 2.4);
    burst(G.b.x, G.b.y - 40, '#fff6a0', 70, 450);
  }

  function stageClear() {
    state = 'clear'; stateTime = 0;
    const bonus = Math.round(G.energy) * 10 + (G.daibutsu > 0 ? 3000 : 0);
    G.score += bonus; G.clearBonus = bonus;
    saveBest(G.stage + 1);
    sfx.gong(); setTimeout(() => sfx.level(), 300);
    burst(G.b.x, G.b.y - 30, '#ffe680', 50, 400);
  }

  function gameOver() {
    state = 'over'; stateTime = 0;
    saveBest(G.stage);
    tone(220, 0.6, 'triangle', 0.1, 0, -120); tone(165, 1.0, 'triangle', 0.1, 0.3, -80);
  }

  // ---------- 描画 ----------
  function draw(t) {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (!G || state === 'title') { drawTitle(t); return; }
    drawWorld(t);
    drawHUD();
    drawPanel(t);
    if (state === 'paused') overlay('一時停止', ['タップ / P で再開']);
    if (state === 'clear') drawClear();
    if (state === 'over') drawOver();
    if (state === 'ending') drawEnding(t);
  }

  function skyGrad(st) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, st.sky[0]); g.addColorStop(0.6, st.sky[1]); g.addColorStop(1, st.sky[2]);
    return g;
  }

  function drawWorld(t) {
    const st = STAGES[G.stage];
    ctx.fillStyle = skyGrad(st); ctx.fillRect(0, 0, W, H);
    if (G.stage === 4) drawRays(W / 2, -80, t, 'rgba(255,240,180,0.2)');
    if (G.stage === 3) drawMoon(W * 0.22, 160 + G.alt * 0.25);
    for (const o of G.bg) drawBg(o, st, t);
    if (G.stage === 0 && G.alt < 140) drawGround(G.alt * PX_PER_M * 0.8);
    if (G.stage === 1 && G.alt < 90) drawPeak(G.alt * PX_PER_M * 0.8);
    if (G.stage === 2 && G.alt < 80) drawCloudSea(G.alt * PX_PER_M * 0.8);

    const b = G.b;
    if (G.sucking) drawSuction(b.x, b.y - 44 * b.s, Math.min(suckRadius(), 700), t);
    for (const c of G.coins) drawCoin(c, t);
    for (const f of G.foes) drawFoe(f, t);
    drawBuddhaState(b.x, b.y, t);
    for (const p of G.parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const tx of G.texts) {
      ctx.globalAlpha = Math.min(1, tx.life / tx.max * 2);
      text(tx.s, tx.x, tx.y, tx.size, tx.color, 'center', true);
    }
    ctx.globalAlpha = 1;
    if (G.hurt > 0) { ctx.fillStyle = (G.curse > 0 ? 'rgba(120,0,180,' : 'rgba(255,0,0,') + G.hurt * 0.5 + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,250,220,' + Math.min(0.8, G.flash) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function drawBg(o, st, t) {
    switch (o.kind) {
      case 'cloud': drawCloud(o.x, o.y, o.w, st.cloud); break;
      case 'bigcloud': drawCloud(o.x, o.y, o.w * 2.2, 'rgba(255,255,255,.95)'); break;
      case 'pcloud': drawCloud(o.x, o.y, o.w * 1.3, st.cloud); break;
      case 'wisp': ctx.fillStyle = st.cloud; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.w, 6, 0, 0, 7); ctx.fill(); break;
      case 'star': ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.45 * Math.sin(t * 0.003 + o.seed * 40)) + ')'; ctx.fillRect(o.x, o.y, o.w, o.w); break;
      case 'roof': drawTempleRoof(o.x, o.y, 150 + o.seed * 80, o.side); break;
      case 'mountain': drawMountainSide(o.x, o.y, 160 + o.seed * 120, o.side); break;
      case 'pine': drawPine(o.x, o.y, 0.7 + o.seed * 0.6); break;
      case 'lotus': drawLotusBg(o.x, o.y, 30 + o.seed * 30); break;
      case 'pavilion': drawPavilion(o.x, o.y, 0.8 + o.seed * 0.5); break;
    }
  }

  // --- 背景パーツ ---
  function drawGround(off) {
    const y = H - 30 + off;
    ctx.fillStyle = '#7a8c5a'; ctx.fillRect(0, y, W, 500);
    ctx.fillStyle = '#d8cfb8'; ctx.fillRect(W / 2 - 70, y, 140, 500); // 参道
    // 本堂
    const hx = W / 2, hy = y - 10;
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(hx - 170, hy - 120, 340, 120);
    ctx.fillStyle = '#9a2a1a'; for (let i = 0; i < 7; i++) ctx.fillRect(hx - 160 + i * 52, hy - 120, 12, 120);
    ctx.fillStyle = '#2e2a2c';
    ctx.beginPath(); ctx.moveTo(hx - 240, hy - 110); ctx.quadraticCurveTo(hx - 150, hy - 130, hx - 110, hy - 210); ctx.lineTo(hx + 110, hy - 210); ctx.quadraticCurveTo(hx + 150, hy - 130, hx + 240, hy - 110); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a23a'; ctx.fillRect(hx - 110, hy - 214, 220, 6);
    // 賽銭箱
    ctx.fillStyle = '#5b3a1e'; ctx.fillRect(hx - 50, hy - 46, 100, 46);
    ctx.fillStyle = '#3a2410'; for (let i = 0; i < 6; i++) ctx.fillRect(hx - 46 + i * 17, hy - 44, 8, 10);
    text('賽銭', hx, hy - 12, 20, '#f2d27a', 'center');
    // 五重塔と鳥居
    drawPagoda(70, y);
    const tx = 470;
    ctx.fillStyle = '#d23a22';
    ctx.fillRect(tx - 44, y - 130, 11, 130); ctx.fillRect(tx + 33, y - 130, 11, 130);
    ctx.fillRect(tx - 60, y - 140, 120, 13); ctx.fillRect(tx - 50, y - 108, 100, 9);
    ctx.fillStyle = '#222'; ctx.fillRect(tx - 66, y - 152, 132, 12);
  }
  function drawPagoda(px, y) {
    for (let i = 0; i < 5; i++) {
      const ty = y - 44 - i * 48, w = 120 - i * 13;
      ctx.fillStyle = '#7a3a22'; ctx.fillRect(px - w * 0.28, ty, w * 0.56, 42);
      ctx.fillStyle = '#2f2a2a'; ctx.beginPath(); ctx.moveTo(px - w / 2 - 12, ty + 2); ctx.lineTo(px + w / 2 + 12, ty + 2); ctx.lineTo(px + w * 0.28, ty - 12); ctx.lineTo(px - w * 0.28, ty - 12); ctx.fill();
    }
    ctx.fillStyle = '#c9a23a'; ctx.fillRect(px - 2, y - 320, 4, 80);
  }
  function drawTempleRoof(x, y, w, side) {
    // 画面端から覗く寺院の屋根
    ctx.save(); ctx.translate(x, y); ctx.scale(side, 1);
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(-w * 0.1, 0, w * 0.6, 70);
    ctx.fillStyle = '#9a2a1a'; ctx.fillRect(-w * 0.05, 0, 9, 70); ctx.fillRect(w * 0.3, 0, 9, 70);
    ctx.fillStyle = '#2e2a2c';
    ctx.beginPath(); ctx.moveTo(-w * 0.6, 10); ctx.lineTo(w * 0.62, 10); ctx.quadraticCurveTo(w * 0.42, 0, w * 0.32, -50); ctx.lineTo(-w * 0.4, -50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a23a'; ctx.fillRect(-w * 0.4, -54, w * 0.72, 5);
    ctx.restore();
  }
  function drawMountainSide(x, y, w, side) {
    ctx.save(); ctx.translate(x, y); ctx.scale(side, 1);
    ctx.fillStyle = '#56685a';
    ctx.beginPath(); ctx.moveTo(-w, 160); ctx.lineTo(-w * 0.1, -w * 0.6); ctx.lineTo(w * 0.35, 160); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f7fa';
    ctx.beginPath(); ctx.moveTo(-w * 0.1, -w * 0.6); ctx.lineTo(-w * 0.32, -w * 0.25); ctx.lineTo(-w * 0.15, -w * 0.32); ctx.lineTo(-w * 0.02, -w * 0.22); ctx.lineTo(w * 0.07, -w * 0.33); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawPeak(off) {
    const y = H + off;
    ctx.fillStyle = '#4c5d50';
    ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(W / 2 - 40, y - 260); ctx.lineTo(W / 2 + 30, y - 230); ctx.lineTo(W + 40, y); ctx.fill();
    ctx.fillStyle = '#eef3f7';
    ctx.beginPath(); ctx.moveTo(W / 2 - 40, y - 260); ctx.lineTo(W / 2 - 100, y - 190); ctx.lineTo(W / 2 - 50, y - 200); ctx.lineTo(W / 2, y - 180); ctx.lineTo(W / 2 + 30, y - 230); ctx.fill();
    // 山頂の祠
    ctx.fillStyle = '#d23a22'; ctx.fillRect(W / 2 - 22, y - 300, 6, 46); ctx.fillRect(W / 2 + 10, y - 300, 6, 46); ctx.fillRect(W / 2 - 30, y - 304, 54, 7);
  }
  function drawCloudSea(off) {
    const y = H - 60 + off;
    ctx.fillStyle = 'rgba(255,255,255,.96)';
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(i * 80, y + (i % 2) * 20, 80, 0, 7); ctx.fill(); }
    ctx.fillRect(0, y + 20, W, 400);
  }
  function drawPine(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#5a3b22'; ctx.fillRect(-4, 0, 8, 60);
    ctx.fillStyle = '#2f5a35';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse((i - 1) * 18, -i * 18, 34 - i * 6, 12, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawPavilion(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#e8b04a'; ctx.fillRect(-50, -10, 100, 50);
    ctx.fillStyle = '#c9802a'; ctx.beginPath(); ctx.moveTo(-80, -6); ctx.quadraticCurveTo(0, -30, 80, -6); ctx.lineTo(40, -50); ctx.lineTo(-40, -50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(0, -58, 8, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawMoon(x, y) {
    ctx.fillStyle = 'rgba(255,250,220,.9)'; ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(220,215,190,.6)'; ctx.beginPath(); ctx.arc(x + 12, y - 8, 9, 0, 7); ctx.arc(x - 14, y + 14, 6, 0, 7); ctx.fill();
  }
  function drawCloud(x, y, w, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.18, 0, 0, 7);
    ctx.ellipse(x - w * 0.2, y - w * 0.1, w * 0.22, w * 0.16, 0, 0, 7);
    ctx.ellipse(x + w * 0.15, y - w * 0.13, w * 0.26, w * 0.2, 0, 0, 7);
    ctx.fill();
  }
  function drawLotusBg(x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.6;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i % 2 ? '#f7a8c8' : '#fbd0e0';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.6, r * 0.25, r * 0.6, 0, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawRays(x, y, t, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.0001);
    ctx.fillStyle = color;
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-45, 1500); ctx.lineTo(45, 1500); ctx.fill();
    }
    ctx.restore();
  }

  function drawSuction(x, y, r, t) {
    const strong = G.goriyaku > 0 || G.daibutsu > 0;
    const g = ctx.createRadialGradient(x, y, 10, x, y, r);
    g.addColorStop(0, strong ? 'rgba(255,245,160,.4)' : 'rgba(255,230,140,.3)');
    g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    // 内側へ縮む渦の輪
    ctx.strokeStyle = 'rgba(255,248,210,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = r - ((t * 0.3 + i * r / 3) % r);
      ctx.globalAlpha = (k / r) * 0.7;
      ctx.beginPath(); ctx.arc(x, y, k, 0, 7); ctx.stroke();
    }
    // 吸い込みの風の線
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + t * 0.002;
      const k = (r * 0.9) * (1 - ((t * 0.0015 + i * 0.37) % 1));
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k); ctx.lineTo(x + Math.cos(a + 0.25) * (k * 0.75), y + Math.sin(a + 0.25) * (k * 0.75)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,240,180,.35)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }

  // --- 硬貨 ---
  function squareHole(r) { ctx.rect(-r * 0.28, -r * 0.28, r * 0.56, r * 0.56); }
  function drawCoin(c, t) {
    const d = COINS[c.type];
    ctx.save(); ctx.translate(c.x, c.y);
    const sx = Math.abs(Math.cos(c.spin)) * 0.7 + 0.3;
    if (c.type === 'koban') {
      ctx.rotate(Math.sin(c.ph) * 0.2);
      ctx.shadowColor = '#fff2a0'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#f4cf43'; ctx.strokeStyle = '#a8820f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, c.r * 0.65 * sx, c.r, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(160,120,10,.55)'; ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-c.r * 0.5 * sx, i * 6); ctx.lineTo(c.r * 0.5 * sx, i * 6); ctx.stroke(); }
      if (sx > 0.6) { ctx.scale(sx, 1); text('壱両', 0, 5, 11, '#6a4a00', 'center'); }
    } else if (c.type === 'zeni') {
      ctx.scale(sx, 1);
      ctx.fillStyle = '#c47a3c'; ctx.strokeStyle = '#7a4518'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, c.r, 0, 7); squareHole(c.r); ctx.fill('evenodd'); ctx.stroke();
      ctx.strokeStyle = 'rgba(90,50,10,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, c.r * 0.72, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,180,.35)'; ctx.beginPath(); ctx.arc(-c.r * 0.45, -c.r * 0.45, c.r * 0.22, 0, 7); ctx.fill();
    } else if (c.type === 'goriyaku') {
      const pulse = 1 + 0.12 * Math.sin(t * 0.008);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, c.r * 2.4 * pulse);
      g.addColorStop(0, 'rgba(255,255,200,.9)'); g.addColorStop(1, 'rgba(255,220,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.r * 2.4 * pulse, 0, 7); ctx.fill();
      ctx.save(); ctx.rotate(t * 0.002); ctx.strokeStyle = 'rgba(255,240,150,.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(c.r * 1.15, 0); ctx.lineTo(c.r * 1.7, 0); ctx.stroke(); }
      ctx.restore();
      ctx.scale(sx, 1);
      const cg = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r); cg.addColorStop(0, '#fffbe0'); cg.addColorStop(0.5, '#ffd23a'); cg.addColorStop(1, '#c58a00');
      ctx.fillStyle = cg; ctx.strokeStyle = '#9a6a00'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, c.r, 0, 7); ctx.fill(); ctx.stroke();
      if (sx > 0.5) text('福', 0, 7, 20, '#8a3a00', 'center');
    } else { // 呪いの銭
      ctx.rotate(Math.sin(c.ph * 2) * 0.3);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, c.r * 1.9);
      g.addColorStop(0, 'rgba(120,20,160,.55)'); g.addColorStop(1, 'rgba(60,0,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.r * 1.9, 0, 7); ctx.fill();
      ctx.scale(sx, 1);
      ctx.fillStyle = '#3a2440'; ctx.strokeStyle = '#a050d0'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, c.r, 0, 7); squareHole(c.r); ctx.fill('evenodd'); ctx.stroke();
      // ひび
      ctx.strokeStyle = '#c070f0'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-c.r * 0.9, -c.r * 0.2); ctx.lineTo(-c.r * 0.4, -c.r * 0.05); ctx.lineTo(-c.r * 0.55, c.r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.r * 0.3, c.r * 0.3); ctx.lineTo(c.r * 0.7, c.r * 0.7); ctx.stroke();
      // 怪しい目
      ctx.fillStyle = '#ff4fd8';
      ctx.beginPath(); ctx.arc(-c.r * 0.5, -c.r * 0.55, 2, 0, 7); ctx.arc(c.r * 0.5, -c.r * 0.55, 2, 0, 7); ctx.fill();
      if (c.pulled && Math.random() < 0.3) { ctx.restore(); ctx.save(); ctx.translate(c.x, c.y); text('呪', 0, -c.r - 6, 16, '#e6a0ff', 'center', true); }
    }
    ctx.restore();
  }

  function drawFoe(f, t) {
    ctx.save(); ctx.translate(f.x, f.y);
    if (f.kind === 'crow') {
      ctx.scale(f.vx > 0 ? 1 : -1, 1);
      const flap = Math.sin(f.t * 14) * 0.8;
      ctx.fillStyle = '#1b1b22';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(20, -6, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(27, -8); ctx.lineTo(40, -4); ctx.lineTo(27, -2); ctx.fill();
      ctx.fillStyle = '#1b1b22';
      ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-18, -4 - 26 * flap); ctx.lineTo(10, -4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-34, -6); ctx.lineTo(-34, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(23, -8, 2.5, 0, 7); ctx.fill();
    } else {
      if (f.charging) { ctx.globalAlpha = 0.2 + 0.2 * Math.sin(t * 0.05); ctx.fillStyle = '#ffff80'; ctx.fillRect(-30, 0, 60, H); ctx.globalAlpha = 1; }
      if (f.striking) {
        ctx.strokeStyle = '#fffbd0'; ctx.lineWidth = 6; ctx.shadowColor = '#ffff60'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(0, 20); let yy = 20;
        while (yy < H) { yy += 40; ctx.lineTo((Math.random() - 0.5) * 50, yy); }
        ctx.stroke(); ctx.shadowBlur = 0;
      }
      drawCloud(0, 0, 130, '#4b4e60');
      drawCloud(6, 6, 110, '#5f6378');
      ctx.fillStyle = '#ffe24a'; ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(8, 10); ctx.lineTo(0, 22); ctx.lineTo(10, 22); ctx.lineTo(-8, 42); ctx.lineTo(-2, 26); ctx.lineTo(-10, 26); ctx.fill();
    }
    ctx.restore();
  }

  // --- 仏像 ---
  function drawBuddhaState(x, y, t) {
    const b = G.b;
    let alpha = 1;
    if (G.inv > 0 && Math.floor(t / 80) % 2) alpha = 0.5;
    drawBuddha(x, y, b.s, t, G.daibutsu > 0 ? 6 : FORMS[G.form].lv, { mouth: b.mouth, alpha, cursed: G.curse > 0, goriyaku: G.goriyaku > 0 });
  }

  const PALETTES = {
    wood: { hi: '#e0b88a', mid: '#a8743e', lo: '#5e3a18', edge: '#4a2c10', hair: '#5a3a1c', hair2: '#7a5430' },
    gold: { hi: '#fff0a8', mid: '#e2b23a', lo: '#9a6a12', edge: '#8a5c0c', hair: '#3a3050', hair2: '#5a4c78' },
    great: { hi: '#fff4b8', mid: '#eebf3c', lo: '#8a5a08', edge: '#7a4e06', hair: '#2e2840', hair2: '#4c4068' },
  };

  function drawBuddha(x, y, s, t, lv, o = {}) {
    const pal = lv === 1 ? PALETTES.wood : lv >= 5 ? PALETTES.great : PALETTES.gold;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 0.004) * 4); ctx.scale(s, s);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    // 光背
    ctx.save(); ctx.translate(0, -50);
    if (lv === 1) {
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#b07a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.stroke();
    } else {
      const big = lv >= 3;
      const R = lv === 2 ? 64 : lv === 3 ? 120 : lv === 4 ? 128 : 140;
      const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, R);
      glow.addColorStop(0, o.goriyaku || lv === 6 ? 'rgba(255,255,225,.95)' : 'rgba(255,232,150,.8)');
      glow.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
      if (big) {
        // 巨大な舟形光背（炎）
        ctx.save(); ctx.translate(0, 34);
        const boat = (k) => {
          ctx.beginPath(); ctx.moveTo(0, -R * 1.25 * k);
          ctx.bezierCurveTo(R * 0.55 * k, -R * 0.95 * k, R * 0.85 * k, -R * 0.3 * k, R * 0.72 * k, R * 0.35 * k);
          ctx.quadraticCurveTo(0, R * 0.62 * k, -R * 0.72 * k, R * 0.35 * k);
          ctx.bezierCurveTo(-R * 0.85 * k, -R * 0.3 * k, -R * 0.55 * k, -R * 0.95 * k, 0, -R * 1.25 * k);
          ctx.closePath();
        };
        // 炎の縁
        ctx.fillStyle = 'rgba(255,170,40,.55)';
        for (let i = 0; i < 18; i++) {
          const u = i / 18, a = -Math.PI / 2 + u * Math.PI * 2;
          const fx = Math.cos(a) * R * 0.78, fy = Math.sin(a) * R * (Math.sin(a) < 0 ? 1.1 : 0.5);
          const fl = 14 + 6 * Math.sin(t * 0.01 + i * 1.7);
          ctx.beginPath(); ctx.moveTo(fx - Math.sin(a) * 8, fy + Math.cos(a) * 8); ctx.lineTo(fx + Math.cos(a) * fl, fy + Math.sin(a) * fl - 6); ctx.lineTo(fx + Math.sin(a) * 8, fy - Math.cos(a) * 8); ctx.fill();
        }
        const bg = ctx.createRadialGradient(0, -R * 0.3, 10, 0, -R * 0.2, R * 1.2);
        bg.addColorStop(0, 'rgba(255,240,170,.9)'); bg.addColorStop(1, 'rgba(225,150,30,.75)');
        ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(170,100,10,.9)'; ctx.lineWidth = 2.5;
        boat(1); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(190,120,20,.6)'; ctx.lineWidth = 1.5; boat(0.82); ctx.stroke();
        ctx.restore();
      }
      ctx.rotate(t * 0.0006);
      ctx.strokeStyle = 'rgba(255,215,90,.85)'; ctx.lineWidth = 2;
      const rays = big ? 32 : 16, r0 = big ? 50 : 46, r1 = big ? R * 0.75 : 60;
      for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.stroke();
      if (lv >= 5) { // 化仏
        ctx.fillStyle = 'rgba(255,240,170,.95)';
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82, 6, 0, 7); ctx.fill(); }
      }
    }
    ctx.restore();

    const body = ctx.createLinearGradient(-40, -90, 40, 40);
    body.addColorStop(0, pal.hi); body.addColorStop(0.45, pal.mid); body.addColorStop(1, pal.lo);

    // 千手観音の腕
    if (lv === 4) {
      ctx.save(); ctx.translate(0, -22);
      const arms = 22;
      for (let i = 0; i < arms; i++) {
        const a = -Math.PI * 0.95 + (i / (arms - 1)) * Math.PI * 0.9 + Math.sin(t * 0.004 + i) * 0.03;
        for (const side of [1, -1]) {
          const aa = side > 0 ? a : -Math.PI - a;
          const L = 70 + (i % 3) * 12;
          ctx.strokeStyle = pal.lo; ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(side * 12, 0); ctx.lineTo(side * 12 + Math.cos(aa) * L, Math.sin(aa) * L); ctx.stroke();
          ctx.fillStyle = pal.hi; ctx.strokeStyle = pal.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(side * 12 + Math.cos(aa) * (L + 4), Math.sin(aa) * (L + 4), 5, 0, 7); ctx.fill(); ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
      ctx.restore();
    }

    // 台座
    if (lv === 1) {
      ctx.fillStyle = '#6b4520'; ctx.fillRect(-38, 30, 76, 14); ctx.fillStyle = '#4a2c10'; ctx.fillRect(-42, 42, 84, 6);
    } else {
      for (let i = -3; i <= 3; i++) {
        ctx.fillStyle = i % 2 ? '#f39bbd' : '#f8c0d6'; ctx.strokeStyle = '#c75b86'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(i * 11, 30, 9, 18, i * 0.18, 0, 7); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = lv >= 5 ? '#c9a23a' : '#7d4a1a'; ctx.fillRect(-36, 38, 72, 8);
    }

    // 体
    ctx.fillStyle = body; ctx.strokeStyle = pal.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 18, 42, 14, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 18); ctx.quadraticCurveTo(-34, -20, -14, -34); ctx.lineTo(14, -34); ctx.quadraticCurveTo(34, -20, 30, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = lv === 1 ? 'rgba(70,40,10,.5)' : 'rgba(120,80,10,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-14, -30); ctx.quadraticCurveTo(0, -10, 16, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, 10, 22, 0); ctx.stroke();
    if (lv === 1) { // 木目
      ctx.strokeStyle = 'rgba(80,45,15,.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-24 + i * 14, -20); ctx.quadraticCurveTo(-20 + i * 14, 0, -26 + i * 14, 16); ctx.stroke(); }
    }
    // 手
    ctx.fillStyle = body; ctx.strokeStyle = pal.edge; ctx.lineWidth = 1.5;
    if (lv === 4) { ctx.beginPath(); ctx.ellipse(0, -6, 6, 12, 0, 0, 7); ctx.fill(); ctx.stroke(); } // 合掌
    else { ctx.beginPath(); ctx.ellipse(0, 8, 16, 7, 0, 0, 7); ctx.fill(); ctx.stroke(); }   // 定印
    // 頭
    ctx.fillStyle = body; ctx.fillRect(-7, -42, 14, 10);
    ctx.beginPath(); ctx.arc(0, -58, 20, 0, 7); ctx.fill(); ctx.strokeStyle = pal.edge; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-20, -54, 5, 11, 0.1, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(20, -54, 5, 11, -0.1, 0, 7); ctx.fill(); ctx.stroke();
    if (lv === 4) { // 化仏の宝冠
      ctx.fillStyle = '#e8c14a'; ctx.strokeStyle = pal.edge;
      ctx.beginPath(); ctx.moveTo(-18, -68); ctx.lineTo(-12, -90); ctx.lineTo(-4, -76); ctx.lineTo(0, -96); ctx.lineTo(4, -76); ctx.lineTo(12, -90); ctx.lineTo(18, -68); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a3050'; ctx.beginPath(); ctx.arc(0, -64, 19, Math.PI, 0); ctx.fill();
    } else {
      ctx.fillStyle = pal.hair;
      ctx.beginPath(); ctx.arc(0, -64, 19, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -82, 9, 0, 7); ctx.fill();
      ctx.fillStyle = pal.hair2;
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) { ctx.beginPath(); ctx.arc(-14 + r * 3 + i * 5.5, -66 - r * 5, 1.8, 0, 7); ctx.fill(); }
    }
    // 顔
    ctx.fillStyle = lv === 1 ? '#7a4a20' : '#c0392b'; ctx.beginPath(); ctx.arc(0, -63, 2, 0, 7); ctx.fill();
    ctx.strokeStyle = lv === 1 ? '#3e2208' : '#6b4208'; ctx.lineWidth = 1.8;
    const mouth = o.mouth || 0;
    if (o.cursed) { // 呪縛：目が×
      for (const ex of [-7, 7]) { ctx.beginPath(); ctx.moveTo(ex - 3, -59); ctx.lineTo(ex + 3, -53); ctx.moveTo(ex + 3, -59); ctx.lineTo(ex - 3, -53); ctx.stroke(); }
    } else if (mouth > 0.5) {
      ctx.beginPath(); ctx.arc(-7, -56, 2.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(7, -56, 2.5, 0, 7); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-7, -57, 4, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(7, -57, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(-2, -49); ctx.lineTo(2, -49); ctx.stroke();
    if (mouth > 0.05) { ctx.fillStyle = '#2a1000'; ctx.beginPath(); ctx.ellipse(0, -44, 3 + mouth * 3, 1 + mouth * 4, 0, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, -47, 4, 0.3, Math.PI - 0.3); ctx.stroke(); }
    if (o.cursed) { ctx.fillStyle = 'rgba(110,30,160,.35)'; ctx.beginPath(); ctx.arc(0, -20, 60, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ---------- UI ----------
  function text(s, x, y, size, color, align = 'left', outline = false) {
    ctx.font = `bold ${size}px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif`;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    if (outline) { ctx.lineWidth = Math.max(3, size / 7); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,15,0,.85)'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function bar(x, y, w, h, v, c1, c2, label) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(x, y, w, h, h / 2); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; roundRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, v)), h - 4, (h - 4) / 2); ctx.fill();
    if (label) text(label, x + 8, y + h - 5, h - 6, '#fff', 'left', true);
  }

  // 上部：スコア・高度
  function drawHUD() {
    const st = STAGES[G.stage];
    ctx.fillStyle = 'rgba(30,10,0,.62)'; ctx.fillRect(0, 0, W, 134);
    text('スコア', 16, 26, 15, '#ffe9b0', 'left', true);
    text(G.score.toLocaleString(), 16, 56, 30, '#ffffff', 'left', true);
    text('高度', W - 16, 26, 15, '#ffe9b0', 'right', true);
    text(Math.floor(G.alt) + ' m', W - 16, 56, 30, '#ffffff', 'right', true);
    text('第' + (G.stage + 1) + '天 ' + st.name, W / 2, 26, 17, '#fff2c0', 'center', true);
    text('目標 ' + st.goal + 'm', W / 2, 50, 15, '#ffffff', 'center', true);
    // 進行バー（賽銭の嵐区間つき）
    const px = 16, pw = W - 32, py = 66;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(px, py, pw, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,60,.35)'; roundRect(px + pw * FEVER_AT, py, pw * (1 - FEVER_AT), 10, 5); ctx.fill();
    ctx.fillStyle = '#ffd84a'; roundRect(px, py, pw * Math.min(1, G.alt / st.goal), 10, 5); ctx.fill();
    // お金・形態・法力
    text('¥' + G.money.toLocaleString(), 16, 104, 22, '#ffe066', 'left', true);
    const f = G.daibutsu > 0 ? '巨大大仏' : 'Lv.' + FORMS[G.form].lv + ' ' + FORMS[G.form].name;
    text(f, W - 16, 104, 18, '#ffd0a0', 'right', true);
    const low = G.energy < 25 && Math.floor(performance.now() / 200) % 2;
    bar(16, 112, W - 32, 16, G.energy / 100, low ? '#ff4040' : '#ff9a3c', low ? '#ff8080' : '#ffe680', '法力');
    // 次の進化までのゲージ
    if (G.form + 1 < FORMS.length) {
      const a = FORMS[G.form].need, bnd = FORMS[G.form + 1].need;
      const v = (G.money - a) / (bnd - a);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(170, 96, 150, 6);
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(170, 96, 150 * Math.max(0, Math.min(1, v)), 6);
      text('次の進化', 170, 92, 11, '#fff', 'left', true);
    }
    if (G.combo >= 5) text(G.combo + ' 連続', W / 2, 160, 22, '#ffffff', 'center', true);
    if (G.fever && G.daibutsu <= 0) text('賽銭の嵐  ' + Math.min(G.feverCount, HENSHIN_NEED) + ' / ' + HENSHIN_NEED + ' 枚', W / 2, 190, 22, '#ffe066', 'center', true);
    if (G.goriyaku > 0) text('御利益 ' + G.goriyaku.toFixed(1) + '秒', W / 2, 220, 20, '#fff6a0', 'center', true);
  }

  // 下部：タップ操作
  function drawPanel(t) {
    const y = PANEL_Y;
    const g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, 'rgba(30,10,0,0)'); g.addColorStop(0.35, 'rgba(30,10,0,.45)'); g.addColorStop(1, 'rgba(30,10,0,.6)');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, H - y);
    const cx = 70, cy = y + 64;
    const on = G.sucking;
    // 吸引ボタン風の円
    ctx.fillStyle = on ? 'rgba(255,215,80,.9)' : 'rgba(255,255,255,.15)';
    ctx.strokeStyle = G.curse > 0 ? '#c070f0' : '#ffe680'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 36 + (on ? Math.sin(t * 0.02) * 3 : 0), 0, 7); ctx.fill(); ctx.stroke();
    text(G.curse > 0 ? '呪縛' : on ? '吸引中' : '吸う', cx, cy + 7, 18, on ? '#4a1a00' : '#fff', 'center', !on);
    // 左右の矢印
    for (const s of [-1, 1]) {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.moveTo(cx + s * 44, cy - 10); ctx.lineTo(cx + s * 58, cy); ctx.lineTo(cx + s * 44, cy + 10); ctx.fill();
    }
    const tx = 140;
    text('長押しで吸引、離すと停止', tx, cy - 16, 17, '#fff', 'left', true);
    text('押したまま左右スワイプで移動', tx, cy + 8, 17, '#fff', 'left', true);
    text('呪いの銭は吸うな！', tx, cy + 32, 14, '#e6a0ff', 'left', true);
    text('PC：Space 吸引 / ←→ 移動', tx + 140, cy + 32, 12, '#ffe9b0', 'left', true);
  }

  function overlay(title, lines, color = 'rgba(20,5,0,.6)') {
    ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
    text(title, W / 2, H * 0.34, 52, '#ffe680', 'center', true);
    lines.forEach((l, i) => text(l, W / 2, H * 0.44 + i * 42, 23, '#fff', 'center', true));
  }

  function drawClear() {
    const next = STAGES[G.stage + 1];
    overlay('ステージクリア！', [
      '第' + (G.stage + 1) + '天「' + STAGES[G.stage].name + '」踏破',
      'このステージの賽銭 ¥' + G.stageMoney.toLocaleString(),
      (G.daibutsu > 0 ? '大仏変身ボーナス込み ' : '残り法力ボーナス ') + '+' + G.clearBonus.toLocaleString(),
      '仏像：' + FORMS[G.form].name + '（Lv.' + FORMS[G.form].lv + '）',
      next ? '次は「' + next.name + '」へ' : 'いざ、悟りの彼方へ…',
      stateTime > 1 ? 'タップで次へ' : '',
    ], 'rgba(60,30,0,.55)');
  }

  function rank(score) {
    if (score >= 90000) return '如来';
    if (score >= 50000) return '菩薩';
    if (score >= 25000) return '明王';
    if (score >= 10000) return '天部';
    if (score >= 3000) return '修行僧';
    return '煩悩まみれ';
  }

  function drawOver() {
    overlay('墜落…', [
      '第' + (G.stage + 1) + '天「' + STAGES[G.stage].name + '」 ' + Math.floor(G.alt) + 'm',
      '集めた賽銭 ¥' + G.money.toLocaleString(),
      'スコア ' + G.score.toLocaleString() + '　最大' + G.maxCombo + '連続',
      '称号：' + rank(G.score),
      'ハイスコア ' + best.score.toLocaleString(),
      stateTime > 1.2 ? 'タップでタイトルへ' : '',
    ], 'rgba(10,0,20,.65)');
  }

  function drawEnding(t) {
    ctx.fillStyle = 'rgba(255,240,200,.6)'; ctx.fillRect(0, 0, W, H);
    drawRays(W / 2, H * 0.3, t, 'rgba(255,220,120,.25)');
    drawBuddha(W / 2, H * 0.36, 2.0, t, 6, {});
    text('成仏！', W / 2, H * 0.55, 64, '#ffe066', 'center', true);
    const lines = ['黄金の大仏は極楽浄土へ到達した', '集めた賽銭 ¥' + G.money.toLocaleString(), '最終スコア ' + G.score.toLocaleString(), '大仏変身 ' + G.henshinCount + ' 回', '称号：' + rank(G.score), stateTime > 1.2 ? 'タップでタイトルへ' : ''];
    lines.forEach((l, i) => text(l, W / 2, H * 0.62 + i * 40, 23, '#fff', 'center', true));
  }

  // タイトル（硬貨が仏像に吸い込まれ続ける）
  const TITLE_TYPES = ['zeni', 'zeni', 'zeni', 'zeni', 'koban', 'goriyaku', 'noroi'];
  const titleCoins = Array.from({ length: 30 }, () => {
    const type = TITLE_TYPES[Math.random() * TITLE_TYPES.length | 0];
    return { type, x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6, spin: Math.random() * 6, r: COINS[type].r };
  });
  function drawTitle(t) {
    ctx.fillStyle = skyGrad(STAGES[0]); ctx.fillRect(0, 0, W, H);
    drawRays(W / 2, H * 0.47, t, 'rgba(255,240,170,.2)');
    const cx = W / 2, cy = H * 0.52;
    for (const c of titleCoins) {
      if (c.type !== 'noroi') {
        const dx = cx - c.x, dy = cy - 70 - c.y, d = Math.hypot(dx, dy);
        c.x += dx / d * 2.4 - dy / d * 0.8; c.y += dy / d * 2.4 + dx / d * 0.8;
        if (d < 30) { c.x = Math.random() * W; c.y = Math.random() < 0.5 ? -20 : H + 20; }
      } else { c.ph += 0.03; c.x += Math.sin(c.ph); }
      c.spin += 0.05;
      drawCoin(c, t);
    }
    const lv = 1 + Math.floor(t / 1500) % 5;
    drawBuddha(cx, cy, 1.25 + (lv === 5 ? 0.3 : 0), t, lv, { mouth: 1 });
    text('Lv.' + lv + ' ' + FORMS[lv - 1].name, cx, cy + 95, 20, '#fff2c0', 'center', true);
    text('空飛ぶ仏像', W / 2, 140, 68, '#ffe066', 'center', true);
    text('お金を吸い込め！', W / 2, 200, 30, '#ffffff', 'center', true);
    text('仏の力で天まで昇れ！', W / 2, 240, 30, '#ffffff', 'center', true);
    if (Math.floor(t / 500) % 2) text('タップでスタート', W / 2, H * 0.68, 32, '#fff6a0', 'center', true);
    const how = [
      '長押しで吸引、離すと停止',
      '押したまま左右にスワイプで移動',
      '銅銭・小判で法力回復＆仏像が進化',
      '黄金の御利益コイン … 吸引力アップ・呪い無効',
      '呪いの銭 … 吸うと法力減少＆呪縛',
      'ステージ終盤の賽銭の嵐で' + HENSHIN_NEED + '枚 → 大仏変身！',
    ];
    ctx.fillStyle = 'rgba(30,10,0,.5)'; roundRect(24, H * 0.72, W - 48, 240, 16); ctx.fill();
    how.forEach((l, i) => text(l, W / 2, H * 0.72 + 36 + i * 35, 18, i === 4 ? '#e6a0ff' : '#fff', 'center', true));
    if (best.score > 0) text('ハイスコア ' + best.score.toLocaleString() + '（第' + best.stage + '天）', W / 2, H - 6, 15, '#fff2c0', 'center', true);
  }

  // ---------- ループ ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 動作確認用フック
  window.__buddha = { get state() { return state; }, get G() { return G; }, input, update };
})();
