// 音まわり：効果音と、シタール・タンプーラ・シンギングボウルの瞑想BGM
// スマホで音が切れないよう、すべての音はゲーム開始前に AudioBuffer として作っておき、再生時は流すだけにする

const SR = 32000; // 作る音のサンプリング周波数（読み込みを速くするため控えめ）
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
// カラスの鳴き声「カァッ」：しゃがれたのこぎり波を声の共鳴（フォルマント）に通す
function caw(ctx, dest, t, k = 1) {
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(760 * k, t); o.frequency.exponentialRampToValueAtTime(540 * k, t + 0.3);
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1250; f1.Q.value = 3;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2500; f2.Q.value = 4;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(dest);
  o.start(t); o.stop(t + 0.36);
  noise(ctx, dest, t, 0.3, 1600, 1100, 0.12); // しゃがれ
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

// ---------- BGMを丸ごと書き出す（ゲーム中は途切れないループ再生だけにする） ----------
const MUSIC_SR = 32000, MUSIC_LEN = 64, MUSIC_TAIL = 7, JHALA_LEN = 4.8;
function makeIR(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
  return ir;
}
async function renderMusic(eng, layer) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const LEN = layer === 'base' ? MUSIC_LEN : JHALA_LEN;
  const oc = new C(2, Math.round((LEN + MUSIC_TAIL) * MUSIC_SR), MUSIC_SR);
  const bufCache = new Map();
  const toBuf = (v) => {
    if (!v) return null;
    if (!v.raw) return v;
    if (!bufCache.has(v)) { const b = oc.createBuffer(1, v.raw.length, SR); b.getChannelData(0).set(v.raw); bufCache.set(v, b); }
    return bufCache.get(v);
  };
  // 残響と、シタールの胴鳴り（鼻にかかった音色）
  const out = oc.createGain(); out.gain.value = 1; out.connect(oc.destination);
  const rev = oc.createConvolver(); rev.buffer = makeIR(oc, 2.8);
  const wet = oc.createGain(); wet.gain.value = 0.5; rev.connect(wet).connect(oc.destination);
  const send = oc.createGain(); send.gain.value = 0.7; out.connect(send).connect(rev);
  const sitarBus = oc.createBiquadFilter(); sitarBus.type = 'peaking'; sitarBus.frequency.value = 2600; sitarBus.Q.value = 1.2; sitarBus.gain.value = 7;
  const body = oc.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 420; body.Q.value = 1.5; body.gain.value = 4;
  sitarBus.connect(body).connect(out);
  const play = (buf, t, gain, dest, pan = 0) => {
    const b = toBuf(buf); if (!b) return;
    const src = oc.createBufferSource(); src.buffer = b;
    const g = oc.createGain(); g.gain.value = gain;
    const p = oc.createStereoPanner(); p.pan.value = pan;
    src.connect(g).connect(p).connect(dest); src.start(t);
  };
  if (layer === 'base') {
    // タンプーラ：Pa - Sa - Sa - Sa(低) の持続音
    const tan = [eng.buf.tanPa, eng.buf.tanSa, eng.buf.tanSa, eng.buf.tanLo];
    for (let t = 0, k = 0; t < MUSIC_LEN; t += 1.05, k++) play(tan[k % 4], t, 0.16, out, k % 2 ? -0.3 : 0.3);
    // ボウル
    for (let t = 0.1; t < MUSIC_LEN; t += 7 + Math.random() * 6) { const i = Math.random() * 5 | 0; play(eng.buf['bowl' + i], t, i === 1 || i === 3 ? 0.06 : 0.09, out, (Math.random() - 0.5) * 0.8); }
    // シタール：アーラープ風の即興
    let t = 2.5, idx = 2, left = 0;
    while (t < MUSIC_LEN - 1) {
      if (left <= 0) { left = 3 + (Math.random() * 6 | 0); t += 1.0 + Math.random() * 1.8; continue; }
      const step = [-2, -1, -1, 1, 1, 2][Math.random() * 6 | 0];
      let ni = Math.max(0, Math.min(SITAR_STEPS.length - 1, idx + step));
      if (left === 1) { const homes = [2, 5, 7]; ni = homes.reduce((a, b) => Math.abs(b - idx) < Math.abs(a - idx) ? b : a); }
      const meend = Math.random() < 0.38 && Math.abs(ni - idx) <= 2;
      play(eng.sitar[`${meend ? idx : ni}>${ni}`] || eng.sitar[`${ni}>${ni}`], t, 0.28, sitarBus, (Math.random() - 0.5) * 0.3);
      idx = ni; left--;
      t += [0.32, 0.45, 0.6, 0.6, 0.9, 1.25][Math.random() * 6 | 0];
    }
  } else {
    // 速く昇ったときに重ねるリズム（チカリ弦の刻み）
    for (let k = 0; k < 24; k++) play(eng.buf.chikari, k * 0.2, k % 4 === 0 ? 0.16 : 0.1, sitarBus, 0.35); // 短い刻みを繰り返す
  }
  const rendered = await oc.startRendering();
  // 曲の終わりで鳴り続けている音を頭に重ねて、つなぎ目なくループさせる
  const n = Math.round(LEN * MUSIC_SR), tail = MUSIC_TAIL * MUSIC_SR, chans = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = rendered.getChannelData(ch), o = new Float32Array(n);
    o.set(d.subarray(0, n));
    for (let i = 0; i < tail; i++) o[i % n] += d[n + i]; // 尾を頭に重ねる（短いループは何周分でも）
    chans.push(o);
  }
  return { raw2: chans, sr: MUSIC_SR };
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
      stomp: [0.7, (c, d) => { thump(c, d, 0.005, 1.2); tone(c, d, 0.005, 300, 0.25, 'square', 0.08, 900); noise(c, d, 0.02, 0.4, 300, 3000, 0.25); metal(c, d, 0.06, 2093, 0.18, 0.5); }],
      dive: [0.6, (c, d) => { noise(c, d, 0.005, 0.5, 2600, 300, 0.4); tone(c, d, 0.005, 700, 0.4, 'sine', 0.12, -450); }],
      beat: [0.6, (c, d) => { thump(c, d, 0.005, 1.1); thump(c, d, 0.2, 0.8); }],
      crowHit: [1.2, (c, d) => { caw(c, d, 0.005, 1.05); caw(c, d, 0.36, 0.95); thump(c, d, 0.005, 1.4); noise(c, d, 0.005, 0.25, 2500, 400, 0.45); tone(c, d, 0.005, 180, 0.4, 'square', 0.08, -120); }],
      fall: [1.3, (c, d) => { tone(c, d, 0.005, 900, 1.1, 'sine', 0.18, -760); noise(c, d, 0.005, 1.2, 1800, 150, 0.25); }],
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
    this.prepareMusic(); // BGMは待たずに裏で作り、できたら流し始める
  }

  // BGMを裏で書き出す（音声専用の処理なので、画面やプレイを止めない）
  async prepareMusic() {
    try {
      this.buf.musicBase = await renderMusic(this, 'base');
      this.buf.musicJhala = await renderMusic(this, 'jhala');
      this.convertAll();
      this.musicReady = true;
      if (this.ctx && !this.musicStarted) this.startMusic();
    } catch (e) { /* BGMが作れなくても遊べる */ }
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
    this.music = ctx.createGain(); this.music.gain.value = 0.6; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    const ss = ctx.createGain(); ss.gain.value = 0.25; this.sfx.connect(ss).connect(this.reverb);
    // シタールの胴鳴り
    this.setupWind();
    this.startMusic();
  }

  // 作っておいた音を、再生用コンテキストのバッファに変換
  convertAll() {
    const ctx = this.ctx; if (!ctx) return;
    const toBuf = (v) => {
      if (v && v.raw2) { const b = ctx.createBuffer(2, v.raw2[0].length, v.sr); b.getChannelData(0).set(v.raw2[0]); b.getChannelData(1).set(v.raw2[1]); return b; }
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

  // ---------- BGM：書き出しておいた曲をループ再生するだけ（描画が重くても途切れない） ----------
  startMusic() {
    const ctx = this.ctx;
    if (!this.musicReady || !this.buf.musicBase || this.buf.musicBase.raw2) return;
    this.musicStarted = true;
    const t = ctx.currentTime + 0.1;
    this.music.gain.setValueAtTime(0.0001, t); this.music.gain.exponentialRampToValueAtTime(0.6, t + 3); // 静かに流れ始める
    const base = ctx.createBufferSource(); base.buffer = this.buf.musicBase; base.loop = true;
    const jhala = ctx.createBufferSource(); jhala.buffer = this.buf.musicJhala; jhala.loop = true;
    this.jhalaGain = ctx.createGain(); this.jhalaGain.gain.value = 0;
    base.connect(this.music);
    jhala.connect(this.jhalaGain).connect(this.music);
    base.start(t); jhala.start(t);
    // 速く昇るほどリズムの層を重ねる
    this.timer = setInterval(() => {
      const I = this.intensity;
      this.jhalaGain.gain.setTargetAtTime(I > 0.4 ? Math.min(1, (I - 0.4) / 0.4) : 0, ctx.currentTime, 0.6);
    }, 250);
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
  crowHit() { this.play('crowHit'); }
  fall() { this.play('fall'); }
  stomp(ch = 1) { this.play('stomp', 1, { rate: Math.pow(2, Math.min(ch - 1, 7) / 12 * 2) }); } // 連鎖ほど高い音
  dive() { this.play('dive'); }
  beat(k = 1) { this.play('beat', 0.5 + k * 0.6); }
  boost() { /* 小判・御利益の音に含めた */ }
  thump() { /* 小判・御利益の音に含めた */ }
}
