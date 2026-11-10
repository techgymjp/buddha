// 音まわり：効果音と、シタール・タンプーラ・シンギングボウルの瞑想BGM
// スマホで音が切れないよう、すべての音はゲーム開始前に AudioBuffer として作っておき、再生時は流すだけにする

const SR = 44100;
const SA = 138.59; // 主音 Sa = C#3
// ブーパーリー（五音音階：Sa Re Ga Pa Dha）
const SITAR_STEPS = [-5, -3, 0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const semi = (n) => SA * 2 * Math.pow(2, n / 12);
const idle = () => new Promise((r) => setTimeout(r, 0));

// ---------- 合成の部品（オンライン/オフラインどちらのコンテキストでも使える） ----------
function tone(ctx, dest, t, freq, dur, type = 'sine', vol = 0.15, slide = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBuf(ctx, dur) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur)), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function noise(ctx, dest, t, dur, f0, f1, vol) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, dur);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest); src.start(t);
}
// 金属の「チン」：非整数倍音が速く減衰する
function metal(ctx, dest, t, f, gain, decay = 0.35) {
  const out = ctx.createGain(); out.gain.value = gain; out.connect(dest);
  const ratios = [1, 2.32, 3.68, 5.12, 6.9], amps = [0.5, 0.36, 0.24, 0.14, 0.08];
  ratios.forEach((r, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.004);
    const g = ctx.createGain(); const d = decay / (1 + i * 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amps[i], t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02);
  });
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 0.012);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
  const cg = ctx.createGain(); cg.gain.setValueAtTime(0.5, t); cg.gain.linearRampToValueAtTime(0, t + 0.012);
  src.connect(hp).connect(cg).connect(out); src.start(t);
}
// シンギングボウル / クリスタルボウル（非整数倍音＋うなり）
function bowl(ctx, dest, t, f, gain, crystal, rubbed) {
  const ratios = crystal ? [1, 2.0, 3.01] : [1, 2.76, 5.4, 8.93];
  const amps = crystal ? [1, 0.12, 0.05] : [1, 0.5, 0.26, 0.12];
  const dur = crystal ? 12 : 10;
  const out = ctx.createGain(); out.gain.value = gain; out.connect(dest);
  ratios.forEach((r, i) => {
    for (const det of [-1, 1]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = f * r + det * (0.6 + i * 0.7);
      const g = ctx.createGain(), atk = rubbed ? 2.5 : 0.008;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amps[i] * 0.5, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i * 0.6));
      o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.1);
    }
  });
  if (!rubbed) tone(ctx, out, t, f * 6.3, 0.3, 'triangle', 0.06);
}
function thump(ctx, dest, t, k = 1) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * k, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.4);
}
async function offline(dur, fn) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new C(1, Math.ceil(SR * dur), SR);
  fn(oc, oc.destination);
  return oc.startRendering();
}

// ---------- 撥弦（カープラス・ストロング法）でシタール / タンプーラ ----------
function pluckBuffer(f0, f1, dur, opts = {}) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  const size = Math.ceil(SR / Math.min(f0, f1)) + 4;
  const line = new Float32Array(size);
  const L0 = SR / f0;
  let prev = 0;
  for (let i = 0; i < Math.ceil(L0); i++) { const r = Math.random() * 2 - 1; prev = prev * 0.35 + r * 0.65; line[i] = prev; }
  let w = Math.ceil(L0) % size;
  const glideStart = (opts.glideStart || 0.05) * SR, glideLen = (opts.glide || 0) * SR;
  const loss = opts.loss || 0.9965, buzz = opts.buzz == null ? 0.55 : opts.buzz;
  for (let i = 0; i < n; i++) {
    let f = f1;
    if (glideLen > 0) {
      if (i <= glideStart) f = f0;
      else { const u = Math.min(1, (i - glideStart) / glideLen); f = f0 + (f1 - f0) * u * u * (3 - 2 * u); }
    }
    let rp = w - SR / f; while (rp < 0) rp += size;
    const i0 = Math.floor(rp), fr = rp - i0;
    const a = line[i0 % size], b = line[(i0 + 1) % size], c = line[(i0 + 2) % size];
    const y = ((a + (b - a) * fr) + (b + (c - b) * fr)) * 0.5 * loss;
    line[w] = y; w = (w + 1) % size;
    out[i] = y + buzz * (Math.tanh(y * 5) * 0.25 - y * 0.15); // 駒の非線形（サワリ）のビリつき
  }
  const fade = Math.floor(SR * 0.08);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

export class AudioEngine {
  constructor(muted) {
    this.ctx = null;
    this.muted = muted;
    this.intensity = 0;
    this.lastCoin = 0;
    this.buf = {};      // 効果音
    this.sitar = {};    // シタールの音（`${from}>${to}`）
    this.ready = false;
  }

  // ---------- 事前の音作り（ゲーム開始前） ----------
  async preload(onProgress = () => {}) {
    const tasks = [];
    const raw = (data) => ({ raw: data });
    // シタール：各音と、隣の音から滑らせる奏法（ミーンド）
    for (let i = 0; i < SITAR_STEPS.length; i++) {
      for (const d of [0, -2, -1, 1, 2]) {
        const j = i + d; if (j < 0 || j >= SITAR_STEPS.length) continue;
        tasks.push(async () => { this.sitar[`${j}>${i}`] = raw(pluckBuffer(semi(SITAR_STEPS[j]), semi(SITAR_STEPS[i]), 2.4, { glide: d ? 0.22 : 0, glideStart: 0.08, loss: 0.9975, buzz: 0.6 })); });
      }
    }
    tasks.push(async () => { this.buf.tanPa = raw(pluckBuffer(SA * 1.4983, SA * 1.4983, 4.2, { loss: 0.9992, buzz: 0.9 })); });
    tasks.push(async () => { this.buf.tanSa = raw(pluckBuffer(SA * 2, SA * 2, 4.2, { loss: 0.9992, buzz: 0.9 })); });
    tasks.push(async () => { this.buf.tanLo = raw(pluckBuffer(SA, SA, 4.2, { loss: 0.9992, buzz: 0.9 })); });
    tasks.push(async () => { this.buf.chikari = raw(pluckBuffer(SA * 4, SA * 4, 0.8, { loss: 0.994, buzz: 0.8 })); });
    // ボウル
    const bowls = [[SA * 2, false, false], [SA * 3, true, false], [SA * 2 * 1.4983, false, true], [SA * 4, true, true], [SA * 1.4983, false, false]];
    bowls.forEach(([f, crystal, rubbed], i) => tasks.push(async () => { this.buf['bowl' + i] = await offline(crystal ? 12.5 : 10.5, (c, d) => bowl(c, d, 0.01, f, 1, crystal, rubbed)); }));
    tasks.push(async () => { this.buf.gong = await offline(10.5, (c, d) => bowl(c, d, 0.01, SA, 1, false, false)); });
    // 効果音
    const fx = {
      coin: [0.6, (c, d) => { metal(c, d, 0.005, 1650, 0.32, 0.32); metal(c, d, 0.055, 1650 * 1.19, 0.22, 0.4); }],
      koban: [1.4, (c, d) => { for (let i = 0; i < 6; i++) metal(c, d, 0.005 + i * 0.025 + Math.random() * 0.02, 1150 + Math.random() * 500, 0.22, 0.5); metal(c, d, 0.05, 2600, 0.28, 0.9); thump(c, d, 0.005, 0.9); noise(c, d, 0.005, 1.0, 200, 2500, 0.25); }],
      goriyaku: [2.2, (c, d) => { [1568, 1976, 2349, 3136, 3951].forEach((f, i) => metal(c, d, 0.005 + i * 0.06, f, 0.25, 1.2)); [784, 988, 1175].forEach((f, i) => tone(c, d, 0.005 + i * 0.05, f, 0.8, 'triangle', 0.06)); thump(c, d, 0.005, 1.2); noise(c, d, 0.005, 1.4, 200, 2500, 0.35); }],
      curse: [0.9, (c, d) => { tone(c, d, 0.005, 300, 0.5, 'sawtooth', 0.09, -220); tone(c, d, 0.1, 207, 0.6, 'square', 0.04, -120); }],
      hit: [0.6, (c, d) => { tone(c, d, 0.005, 160, 0.35, 'sawtooth', 0.11, -100); noise(c, d, 0.005, 0.3, 800, 200, 0.2); }],
      thunder: [1.0, (c, d) => noise(c, d, 0.005, 0.9, 1200, 80, 0.5)],
      level: [0.8, (c, d) => [523, 659, 784, 1047].forEach((f, i) => tone(c, d, 0.005 + i * 0.08, f, 0.3, 'triangle', 0.09))],
      henshin: [2.0, (c, d) => { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(c, d, 0.2 + i * 0.09, f, 0.6, 'triangle', 0.07)); noise(c, d, 0.005, 1.5, 200, 2500, 0.4); }],
      beat: [0.6, (c, d) => { thump(c, d, 0.005, 1.1); thump(c, d, 0.2, 0.8); }],
      over: [1.5, (c, d) => { tone(c, d, 0.005, 220, 0.6, 'triangle', 0.1, -120); tone(c, d, 0.3, 165, 1.0, 'triangle', 0.1, -80); }],
    };
    for (const [k, [dur, fn]] of Object.entries(fx)) tasks.push(async () => { this.buf[k] = await offline(dur, fn); });
    for (let lv = 1; lv <= 6; lv++) tasks.push(async () => {
      const base = 1318 * Math.pow(2, lv / 12);
      this.buf['chime' + lv] = await offline(1.6, (c, d) => { metal(c, d, 0.005, base, 0.22, 1.0); metal(c, d, 0.075, base * 1.5, 0.18, 1.0); if (lv >= 3) metal(c, d, 0.145, base * 2, 0.14, 1.2); });
    });
    for (let i = 0; i < tasks.length; i++) {
      await tasks[i]();
      onProgress((i + 1) / tasks.length);
      await idle(); // 画面を固めない
    }
    this.convertAll();
    this.ready = true;
  }

  // ---------- 再生の準備（ユーザー操作の中で呼ぶ） ----------
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' }); } catch (e) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e2) { return; }
    }
    this.ctx = ctx;
    this.convertAll();

    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);
    // 残響
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
    this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55; this.reverb.connect(wet).connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
    const ms = ctx.createGain(); ms.gain.value = 0.7; this.music.connect(ms).connect(this.reverb);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    const ss = ctx.createGain(); ss.gain.value = 0.25; this.sfx.connect(ss).connect(this.reverb);
    // シタールの胴鳴り
    this.sitarBus = ctx.createBiquadFilter(); this.sitarBus.type = 'peaking'; this.sitarBus.frequency.value = 2600; this.sitarBus.Q.value = 1.2; this.sitarBus.gain.value = 7;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 420; body.Q.value = 1.5; body.gain.value = 4;
    this.sitarBus.connect(body).connect(this.music);
    this.setupWind();
    this.startMusic();
  }

  // 作っておいた音を、再生用コンテキストのバッファに変換
  convertAll() {
    const ctx = this.ctx; if (!ctx) return;
    const toBuf = (v) => {
      if (!v || !v.raw) return v;
      const b = ctx.createBuffer(1, v.raw.length, SR); b.getChannelData(0).set(v.raw); return b;
    };
    for (const k of Object.keys(this.buf)) this.buf[k] = toBuf(this.buf[k]);
    for (const k of Object.keys(this.sitar)) this.sitar[k] = toBuf(this.sitar[k]);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  play(name, gain = 1, opts = {}) {
    const ctx = this.ctx; const b = this.buf[name];
    if (!ctx || !b || b.raw) return;
    this.playBuffer(b, opts.when || ctx.currentTime + 0.005, gain, opts.dest || this.sfx, opts.pan || 0, opts.rate || 1);
  }
  playBuffer(buf, when, gain, dest, pan = 0, rate = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    let node = src.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(dest);
    src.start(when);
  }

  // ---------- BGM ----------
  startMusic() {
    const t = this.ctx.currentTime + 0.3;
    this.next = { tanpura: t, sitar: t + 2.5, bowl: t + 0.1, chikari: t + 4 };
    this.tanpuraStep = 0; this.sitarIdx = 2; this.phraseLeft = 0;
    this.timer = setInterval(() => this.schedule(), 200);
  }
  schedule() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running' || !this.ready) return;
    if (!this.next.started) { const t = ctx.currentTime + 0.2; this.next = { started: true, tanpura: t, sitar: t + 2.5, bowl: t + 0.1, chikari: t + 4 }; }
    const now = ctx.currentTime, ahead = now + 1.2; // 先読みを長めにして、描画が重くても途切れない
    for (const k of ['tanpura', 'sitar', 'bowl', 'chikari']) if (this.next[k] < now - 0.5) this.next[k] = now + 0.05; // 大きく遅れたら追いつく
    const I = this.intensity;
    while (this.next.tanpura < ahead) {
      const b = [this.buf.tanPa, this.buf.tanSa, this.buf.tanSa, this.buf.tanLo][this.tanpuraStep % 4];
      this.playBuffer(b, this.next.tanpura, 0.16, this.music, this.tanpuraStep % 2 ? -0.3 : 0.3);
      this.tanpuraStep++; this.next.tanpura += 1.05;
    }
    while (this.next.bowl < ahead) {
      const i = Math.random() * 5 | 0;
      this.playBuffer(this.buf['bowl' + i], this.next.bowl, i === 1 || i === 3 ? 0.06 : 0.09, this.music, (Math.random() - 0.5) * 0.8);
      this.next.bowl += 7 + Math.random() * 7 - I * 3;
    }
    while (this.next.sitar < ahead) {
      if (this.phraseLeft <= 0) { this.phraseLeft = 3 + (Math.random() * (5 + I * 6) | 0); this.next.sitar += 1.2 + Math.random() * 2.5 * (1 - I * 0.7); continue; }
      const step = [-2, -1, -1, 1, 1, 2][Math.random() * 6 | 0];
      let idx = Math.max(0, Math.min(SITAR_STEPS.length - 1, this.sitarIdx + step));
      if (this.phraseLeft === 1) { const homes = [2, 5, 7]; idx = homes.reduce((a, b) => Math.abs(b - this.sitarIdx) < Math.abs(a - this.sitarIdx) ? b : a); }
      const meend = Math.random() < 0.38 && Math.abs(idx - this.sitarIdx) <= 2;
      const b = this.sitar[`${meend ? this.sitarIdx : idx}>${idx}`] || this.sitar[`${idx}>${idx}`];
      this.playBuffer(b, this.next.sitar, 0.28, this.sitarBus, (Math.random() - 0.5) * 0.3);
      this.sitarIdx = idx; this.phraseLeft--;
      this.next.sitar += [0.32, 0.45, 0.6, 0.6, 0.9, 1.25][Math.random() * 6 | 0] * (1 - I * 0.45);
    }
    while (this.next.chikari < ahead) {
      if (I > 0.45) { this.playBuffer(this.buf.chikari, this.next.chikari, 0.05 + (I - 0.45) * 0.12, this.sitarBus, 0.4); this.next.chikari += 0.26 - (I - 0.45) * 0.12; }
      else this.next.chikari += 0.5;
    }
  }

  // ---------- 風切り音 ----------
  setupWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let x = 0; for (let i = 0; i < len; i++) { x = x * 0.98 + (Math.random() * 2 - 1) * 0.2; d[i] = x; }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.Q.value = 0.8; this.windFilter.frequency.value = 300;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.sfx); src.start();
  }
  setWind(v) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.02 + v * v * 0.5, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(250 + v * 1400, t, 0.2);
  }

  // ---------- 効果音（作っておいた音を流すだけ） ----------
  coin(p = 0) {
    const now = performance.now(); if (now - this.lastCoin < 28) return; this.lastCoin = now;
    this.play('coin', 1, { rate: Math.pow(2, Math.min(p, 24) / 24) * (1 + (Math.random() - 0.5) * 0.04), pan: (Math.random() - 0.5) * 0.5 });
  }
  koban() { this.play('koban'); }
  goriyaku() { this.play('goriyaku'); }
  chime(lv = 1) { this.play('chime' + Math.max(1, Math.min(6, Math.round(lv)))); }
  curse() { this.play('curse'); }
  hit() { this.play('hit'); }
  thunder() { this.play('thunder'); }
  level() { this.play('level'); }
  gong() { this.play('gong', 0.35); }
  henshin() { this.play('gong', 0.35); this.play('henshin'); }
  over() { this.play('over'); }
  beat(k = 1) { this.play('beat', 0.5 + k * 0.6); }
  boost() { /* 小判・御利益の音に含めた */ }
  thump() { /* 小判・御利益の音に含めた */ }
}
