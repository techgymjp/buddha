// 音まわり：効果音と、シタール・タンプーラ・シンギングボウルの瞑想BGM（すべてWeb Audioで合成）

const SA = 138.59; // 主音 Sa = C#3
// ブーパーリー（五音音階：Sa Re Ga Pa Dha）
const SITAR_STEPS = [-5, -3, 0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const semi = (n) => SA * 2 * Math.pow(2, n / 12); // シタールは Sa=C#4 基準

export class AudioEngine {
  constructor(muted) {
    this.ctx = null;
    this.muted = muted;
    this.intensity = 0;
    this.cache = new Map();
    this.lastCoin = 0;
  }

  // ユーザー操作の中で呼ぶ
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // 残響（瞑想らしい広がり）
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(4.5, 2.2);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain(); this.music.gain.value = 0.55;
    this.music.connect(this.master);
    this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.7;
    this.music.connect(this.musicSend).connect(this.reverb);

    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8;
    this.sfx.connect(this.master);
    const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.25;
    this.sfx.connect(sfxSend).connect(this.reverb);

    // シタールの胴鳴り（鼻にかかった音色）
    this.sitarBus = ctx.createBiquadFilter();
    this.sitarBus.type = 'peaking'; this.sitarBus.frequency.value = 2600; this.sitarBus.Q.value = 1.2; this.sitarBus.gain.value = 7;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 420; body.Q.value = 1.5; body.gain.value = 4;
    this.sitarBus.connect(body).connect(this.music);

    this.setupWind();
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- 撥弦（カープラス・ストロング法）でシタール / タンプーラを合成 ----------
  pluck(f0, f1, dur, opts = {}) {
    const key = [f0.toFixed(2), f1.toFixed(2), dur, opts.glide || 0, opts.kind || 's'].join('|');
    if (this.cache.has(key)) return this.cache.get(key);
    const ctx = this.ctx, sr = ctx.sampleRate;
    const n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr);
    const out = buf.getChannelData(0);
    const fmin = Math.min(f0, f1);
    const size = Math.ceil(sr / fmin) + 4;
    const line = new Float32Array(size);
    let w = 0;
    const L0 = sr / f0;
    // 弾いた瞬間のノイズ（少しだけ角を落とす）
    let prev = 0;
    for (let i = 0; i < Math.ceil(L0); i++) { const r = Math.random() * 2 - 1; prev = prev * 0.35 + r * 0.65; line[i] = prev; }
    w = Math.ceil(L0) % size;
    const glideStart = (opts.glideStart || 0.05) * sr, glideLen = (opts.glide || 0) * sr;
    const loss = opts.loss || 0.9965;
    const buzz = opts.buzz == null ? 0.55 : opts.buzz; // ジャワリ（サワリ）のビリつき
    for (let i = 0; i < n; i++) {
      let f = f0;
      if (glideLen > 0 && i > glideStart) {
        const u = Math.min(1, (i - glideStart) / glideLen);
        f = f0 + (f1 - f0) * (u * u * (3 - 2 * u));
      } else if (glideLen === 0) f = f1;
      const L = sr / f;
      let rp = w - L; while (rp < 0) rp += size;
      const i0 = Math.floor(rp), fr = rp - i0;
      const a = line[i0 % size], b = line[(i0 + 1) % size], c = line[(i0 + 2) % size];
      const s0 = a + (b - a) * fr, s1 = b + (c - b) * fr;
      let y = (s0 + s1) * 0.5 * loss;
      line[w] = y;
      w = (w + 1) % size;
      // 駒（ブリッジ）の非線形でビリビリした倍音を足す
      out[i] = y + buzz * (Math.tanh(y * 5) * 0.25 - y * 0.15);
    }
    // 頭と終わりの処理
    const fade = Math.floor(sr * 0.08);
    for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
    this.cache.set(key, buf);
    if (this.cache.size > 160) this.cache.delete(this.cache.keys().next().value);
    return buf;
  }

  playBuffer(buf, when, gain, dest, pan = 0, rate = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    let node = src.connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(dest);
    src.start(when);
  }

  // シンギングボウル / クリスタルボウル（非整数倍音＋うなり）
  bowl(when, f, gain, crystal, rubbed) {
    const ctx = this.ctx;
    const ratios = crystal ? [1, 2.0, 3.01] : [1, 2.76, 5.4, 8.93];
    const amps = crystal ? [1, 0.12, 0.05] : [1, 0.5, 0.26, 0.12];
    const dur = crystal ? 14 : 11;
    const out = ctx.createGain(); out.gain.value = gain;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.8; out.connect(pan).connect(this.music); } else out.connect(this.music);
    ratios.forEach((r, i) => {
      for (const det of [-1, 1]) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = f * r + det * (0.6 + i * 0.7); // わずかなズレがうなりを生む
        const g = ctx.createGain();
        const a = amps[i] * 0.5;
        const t0 = when, atk = rubbed ? 2.5 : 0.008;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(a, t0 + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / (1 + i * 0.6));
        o.connect(g).connect(out);
        o.start(t0); o.stop(t0 + dur + 0.1);
      }
    });
    // 打った瞬間の金属音
    if (!rubbed) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * 6.3;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.06, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      o.connect(g).connect(out); o.start(when); o.stop(when + 0.35);
    }
  }

  startMusic() {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.2;
    this.next = { tanpura: t, sitar: t + 2.5, bowl: t + 0.1, chikari: t + 4 };
    this.tanpuraStep = 0;
    this.sitarIdx = 2; // Sa
    this.phraseLeft = 0;
    this.lastPitch = semi(0);
    this.timer = setInterval(() => this.schedule(), 120);
  }

  schedule() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const ahead = ctx.currentTime + 0.4;
    const I = this.intensity;

    // タンプーラ：Pa - Sa - Sa - Sa(低) を繰り返す持続音
    while (this.next.tanpura < ahead) {
      const pattern = [SA * 1.4983, SA * 2, SA * 2, SA];
      const f = pattern[this.tanpuraStep % 4];
      const buf = this.pluck(f, f, 4.5, { loss: 0.9992, buzz: 0.9, kind: 't' });
      this.playBuffer(buf, this.next.tanpura, 0.16, this.music, this.tanpuraStep % 2 ? -0.3 : 0.3);
      this.tanpuraStep++;
      this.next.tanpura += 1.05;
    }

    // ボウル：ゆったりと
    while (this.next.bowl < ahead) {
      const choices = [[SA * 2, false], [SA * 3, true], [SA * 2 * 1.4983, false], [SA * 4, true], [SA * 1.4983, false]];
      const [f, crystal] = choices[Math.random() * choices.length | 0];
      this.bowl(this.next.bowl, f, crystal ? 0.06 : 0.09, crystal, Math.random() < 0.35);
      this.next.bowl += 7 + Math.random() * 7 - I * 3;
    }

    // シタール：アーラープ風に即興
    while (this.next.sitar < ahead) {
      if (this.phraseLeft <= 0) {
        this.phraseLeft = 3 + (Math.random() * (5 + I * 6) | 0);
        this.next.sitar += 1.2 + Math.random() * 2.5 * (1 - I * 0.7);
        continue;
      }
      // 音階上をなめらかに動く（Sa と Pa に引き寄せられる）
      let step = [-2, -1, -1, 1, 1, 2][Math.random() * 6 | 0];
      let idx = Math.max(0, Math.min(SITAR_STEPS.length - 1, this.sitarIdx + step));
      if (this.phraseLeft === 1) { // フレーズの終わりは Sa か Pa に解決
        const homes = [2, 5, 7]; idx = homes.reduce((a, b) => Math.abs(b - this.sitarIdx) < Math.abs(a - this.sitarIdx) ? b : a);
      }
      const target = semi(SITAR_STEPS[idx]);
      const meend = Math.random() < 0.38 && Math.abs(idx - this.sitarIdx) <= 2;
      const f0 = meend ? this.lastPitch : target;
      const buf = this.pluck(f0, target, 2.6, { glide: meend ? 0.18 + Math.random() * 0.15 : 0, glideStart: 0.08, loss: 0.9975, buzz: 0.6 });
      this.playBuffer(buf, this.next.sitar, 0.28, this.sitarBus, (Math.random() - 0.5) * 0.3);
      this.sitarIdx = idx; this.lastPitch = target; this.phraseLeft--;
      const beats = [0.32, 0.45, 0.6, 0.6, 0.9, 1.25];
      this.next.sitar += beats[Math.random() * beats.length | 0] * (1 - I * 0.45);
    }

    // チカリ（速く昇るほどリズムが刻まれる＝ジャーラ）
    while (this.next.chikari < ahead) {
      if (I > 0.45) {
        const buf = this.pluck(SA * 4, SA * 4, 0.8, { loss: 0.994, buzz: 0.8, kind: 'c' });
        this.playBuffer(buf, this.next.chikari, 0.05 + (I - 0.45) * 0.12, this.sitarBus, 0.4);
        this.next.chikari += 0.26 - (I - 0.45) * 0.12;
      } else this.next.chikari += 0.5;
    }
  }

  // ---------- 風切り音 ----------
  setupWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.98 + (Math.random() * 2 - 1) * 0.2; d[i] = b; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.Q.value = 0.8; this.windFilter.frequency.value = 300;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    src.start();
  }
  setWind(v) { // 0..1
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.02 + v * v * 0.5, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(250 + v * 1400, t, 0.2);
  }

  // ---------- 効果音 ----------
  tone(freq, dur, type = 'sine', vol = 0.15, delay = 0, slide = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, f0, f1, vol) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx); src.start(t);
  }
  coin(p = 0) {
    const now = performance.now(); if (now - this.lastCoin < 35) return; this.lastCoin = now;
    this.tone(1900 + p * 30, 0.06, 'square', 0.025); this.tone(2800 + p * 30, 0.14, 'sine', 0.05, 0.03);
  }
  koban() { [1200, 1600, 2000, 2600].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.07, i * 0.045)); this.boost(0.5); }
  goriyaku() { [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.08, i * 0.07)); this.boost(1); }
  curse() { this.tone(300, 0.5, 'sawtooth', 0.09, 0, -220); this.tone(207, 0.6, 'square', 0.04, 0.1, -120); }
  hit() { this.tone(160, 0.35, 'sawtooth', 0.11, 0, -100); this.noise(0.3, 800, 200, 0.2); }
  thunder() { this.noise(0.9, 1200, 80, 0.5); }
  level() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, i * 0.08)); }
  boost(k = 1) { this.noise(0.6 + k * 0.4, 200, 2500, 0.15 + k * 0.2); }
  gong() {
    if (!this.ctx) return;
    this.bowl(this.ctx.currentTime + 0.01, SA, 0.35, false, false);
  }
  henshin() { this.gong(); [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.07, 0.2 + i * 0.09)); this.boost(1.5); }
}
