// 世界：空、光、雲、寺院、山頂の懸造り、雲海、天空、極楽浄土
import * as THREE from 'three';
import { canvasTex, glowTexture, dotTexture, buildBuddha, MAT, mergeStatic } from './models.js?v=202611101840';

export const UNIT_M = 6; // 1ユニット = 6m

// ---------- 高度ごとの空と光（キーフレーム） ----------
const K = [
  { m: 0,    top: 0x3a76c4, hor: 0xcfe5f5, bot: 0x7d8f74, fog: 0xc2d8e8, near: 60, far: 420, sun: 0xfff0d6, sunI: 2.6, sky: 0xd6ecff, gnd: 0x6a5838, hemiI: 1.1, stars: 0, elev: 0.55 },
  { m: 1200,  top: 0x2c66b6, hor: 0xd9ecf8, bot: 0x9fb0a8, fog: 0xcfe2ef, near: 80, far: 520, sun: 0xfff2dc, sunI: 2.6, sky: 0xd6ecff, gnd: 0x7a6a50, hemiI: 1.1, stars: 0, elev: 0.5 },
  { m: 2700,  top: 0x2457a6, hor: 0xeef6fc, bot: 0xf4f8fb, fog: 0xe7f0f7, near: 70, far: 520, sun: 0xfff4e2, sunI: 2.8, sky: 0xe8f4ff, gnd: 0xd0d8e0, hemiI: 1.2, stars: 0, elev: 0.45 },
  { m: 4500, top: 0x1d3f8c, hor: 0xffd0a0, bot: 0xffe3c8, fog: 0xf2d4bb, near: 70, far: 520, sun: 0xffc488, sunI: 2.6, sky: 0xffe0c0, gnd: 0xc08060, hemiI: 1.0, stars: 0, elev: 0.14 },
  { m: 5700, top: 0x0b1440, hor: 0xe2825c, bot: 0x2c1c3c, fog: 0x6a4a68, near: 60, far: 600, sun: 0xff9a60, sunI: 1.8, sky: 0x8a6aa0, gnd: 0x302040, hemiI: 0.8, stars: 0.6, elev: 0.04 },
  { m: 6600, top: 0x02030c, hor: 0x1a2a64, bot: 0x050818, fog: 0x101832, near: 80, far: 700, sun: 0xc8d6ff, sunI: 1.3, sky: 0x4050a0, gnd: 0x101020, hemiI: 0.7, stars: 1, elev: 0.3 },
  { m: 7140, top: 0x2b1a44, hor: 0xffaa6a, bot: 0x6a3a40, fog: 0xc08a70, near: 60, far: 600, sun: 0xffd4a0, sunI: 2.2, sky: 0xffc0a0, gnd: 0x804050, hemiI: 0.9, stars: 0.35, elev: 0.2 },
  { m: 7650, top: 0xf0a2c6, hor: 0xffe6ae, bot: 0xfff0dc, fog: 0xffdcc8, near: 80, far: 900, sun: 0xfff0d0, sunI: 3.0, sky: 0xffe8f0, gnd: 0xffd0a0, hemiI: 1.3, stars: 0, elev: 0.6 },
  { m: 9600, top: 0xf8c2dc, hor: 0xfff4d4, bot: 0xffffff, fog: 0xffefe0, near: 90, far: 1100, sun: 0xfff6e0, sunI: 3.2, sky: 0xfff0f4, gnd: 0xffe0b0, hemiI: 1.4, stars: 0, elev: 0.7 },
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpC(a, b, t, out) { tmpA.setHex(a); tmpB.setHex(b); return out.copy(tmpA).lerp(tmpB, t); }

export class World {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envAlt = -9999;
    this.env = null;
    this.animated = [];
    this.buildSky();
    this.buildLights();
    this.buildTempleGrounds();
    this.buildMountains();
    this.buildKiyomizu();
    this.buildClouds();
    this.buildPureLand();
    // 動かない景色を材質ごとにまとめて描画回数を減らす
    mergeStatic(this.temple);
    mergeStatic(this.kiyomizu);
    mergeStatic(this.pureLand, this.lotusSet);
  }

  // ---------- 空 ----------
  buildSky() {
    this.skyUniforms = {
      top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0.3, 0.5, -1).normalize() }, sunColor: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top, hor, bot, sunColor; uniform vec3 sunDir; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0), 0.5)) : mix(hor, bot, pow(clamp(-h,0.0,1.0), 0.35));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.12);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    // 環境マップ用の空
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));

    // 星
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection(); if (v.y < -0.2) v.y = -v.y;
      v.multiplyScalar(1300); pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
    // 月
    const moonTex = canvasTex(256, 256, (g, w) => {
      const r = g.createRadialGradient(w * 0.45, w * 0.45, 10, w / 2, w / 2, w * 0.36);
      r.addColorStop(0, '#fffbe8'); r.addColorStop(1, '#d8d2b8'); g.fillStyle = r; g.beginPath(); g.arc(w / 2, w / 2, w * 0.36, 0, 7); g.fill();
      g.fillStyle = 'rgba(160,150,120,.35)'; [[0.42, 0.4, 0.07], [0.58, 0.55, 0.05], [0.5, 0.62, 0.04], [0.38, 0.58, 0.035]].forEach(([x, y, r2]) => { g.beginPath(); g.arc(w * x, w * y, w * r2, 0, 7); g.fill(); });
      const glow = g.createRadialGradient(w / 2, w / 2, w * 0.35, w / 2, w / 2, w / 2); glow.addColorStop(0, 'rgba(255,250,220,.4)'); glow.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = glow; g.fillRect(0, 0, w, w);
    });
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false, opacity: 0 }));
    this.moon.scale.set(160, 160, 1);
    this.scene.add(this.moon);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.position.set(30, 60, 40);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    // 仏像を照らす暖色の補助光
    this.key = new THREE.PointLight(0xffd090, 14, 18, 1.6);
    this.scene.add(this.key);
    this.scene.fog = new THREE.Fog(0xffffff, 60, 400);
  }

  // 高度に応じて空・霧・光を更新
  update(altM, camPos, t) {
    let i = 0; while (i < K.length - 2 && altM > K[i + 1].m) i++;
    const a = K[i], b = K[i + 1];
    const u = THREE.MathUtils.clamp((altM - a.m) / (b.m - a.m), 0, 1);
    const s = u * u * (3 - 2 * u);
    const U = this.skyUniforms;
    lerpC(a.top, b.top, s, U.top.value); lerpC(a.hor, b.hor, s, U.hor.value); lerpC(a.bot, b.bot, s, U.bot.value);
    lerpC(a.sun, b.sun, s, U.sunColor.value);
    lerpC(a.fog, b.fog, s, this.scene.fog.color);
    this.scene.fog.near = THREE.MathUtils.lerp(a.near, b.near, s);
    this.scene.fog.far = THREE.MathUtils.lerp(a.far, b.far, s);
    lerpC(a.sun, b.sun, s, this.sun.color); this.sun.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, s) * 0.8;
    lerpC(a.sky, b.sky, s, this.hemi.color); lerpC(a.gnd, b.gnd, s, this.hemi.groundColor); this.hemi.intensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, s) * 0.45;
    const elev = THREE.MathUtils.lerp(a.elev, b.elev, s);
    U.sunDir.value.set(0.45, elev, -1).normalize();
    this.sun.position.copy(camPos).addScaledVector(U.sunDir.value, 100);
    this.sun.target.position.copy(camPos);
    const st = THREE.MathUtils.lerp(a.stars, b.stars, s);
    this.stars.material.opacity = st;
    this.stars.visible = st > 0.01;
    this.moon.material.opacity = st;
    this.moon.position.copy(camPos).add(new THREE.Vector3(-380, 420, -900));
    this.sky.position.copy(camPos); this.stars.position.copy(camPos);

    // 環境マップ（金属の映り込み）を時々作り直す
    if (!this.env) this.refreshEnv(altM);
    for (const f of this.animated) f(t, camPos);
  }

  // 環境マップ（金属の映り込み）を作り直す。重い処理なのでステージの切り替え時だけ行う
  refreshEnv(altM) {
    this.envAlt = altM;
    const old = this.env;
    this.env = this.pmrem.fromScene(this.envScene, 0.02);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.75;
    if (old) old.dispose();
  }

  // ---------- 寺院の境内 ----------
  buildTempleGrounds() {
    const G = new THREE.Group(); this.scene.add(G); this.temple = G;
    // 地面（石畳と苔）
    const groundTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#7d7a68'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 48) {
        const o = (y / 32) % 2 ? 24 : 0;
        g.fillStyle = `hsl(40,${6 + Math.random() * 6}%,${42 + Math.random() * 14}%)`;
        g.fillRect(x + o + 2, y + 2, 44, 28);
      }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2.4; G.add(ground);
    const grass = new THREE.Mesh(new THREE.RingGeometry(70, 900, 48), new THREE.MeshStandardMaterial({ color: 0x4d6a34, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -2.3; G.add(grass);

    // 大きな賽銭鉢（仏像のスタート地点）
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, -2.4], [2.2, -2.4], [2.6, -1.6], [3.0, -0.6], [3.3, -0.3], [3.1, -0.25], [2.6, -0.9], [0, -0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 48), MAT.goldWarm);
    G.add(bowl);
    const coinsIn = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.1, 40), new THREE.MeshPhysicalMaterial({ color: 0xe0a840, metalness: 1, roughness: 0.4, bumpMap: canvasTex(128, 128, (g, w) => { g.fillStyle = '#888'; g.fillRect(0, 0, w, w); for (let i = 0; i < 80; i++) { g.fillStyle = Math.random() < 0.5 ? '#fff' : '#333'; g.beginPath(); g.arc(Math.random() * w, Math.random() * w, 5 + Math.random() * 7, 0, 7); g.fill(); } }, false), bumpScale: 4 }));
    coinsIn.position.y = -0.55; G.add(coinsIn);

    // 石段と境内の段々
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9c968a, roughness: 0.9 });
    for (let i = 0; i < 26; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 1.3), stoneMat);
      st.position.set(0, -2.15 + i * 0.5, -8 - i * 1.3); G.add(st);
    }
    const terrace = (y, z, w, d) => { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), stoneMat); t.position.set(0, y - 1, z); G.add(t); };
    terrace(11, -62, 120, 46);
    for (let i = 0; i < 20; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 1.2), stoneMat); st.position.set(0, 11 + i * 0.6, -86 - i * 1.2); G.add(st); }
    terrace(23, -125, 160, 60);

    // 本堂・中門・五重塔
    const h1 = this.makeHall(30, 18, 9, 0x9a2a1c, 1); h1.position.set(0, 11, -62); G.add(h1);
    const h2 = this.makeHall(46, 26, 12, 0x8e2418, 2); h2.position.set(0, 23, -130); G.add(h2);
    const p1 = this.makePagoda(5, 7); p1.position.set(-38, 11, -70); G.add(p1);
    const p2 = this.makePagoda(3, 6); p2.position.set(44, 23, -120); G.add(p2);
    const gate = this.makeHall(16, 8, 6, 0xa8301e, 1); gate.position.set(0, -2.4, -2 - 26 * 1.3 - 4); gate.scale.setScalar(0.8); G.add(gate);
    // 鳥居
    const torii = this.makeTorii(); torii.position.set(0, 5.9, -31); torii.scale.setScalar(0.9); G.add(torii);

    // 灯籠と桜
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff9a40, emissiveIntensity: 3 });
    for (let i = 0; i < 8; i++) {
      for (const sx of [-1, 1]) {
        const l = this.makeLantern(stoneMat, lightMat); l.position.set(sx * 8.5, -2.4 + i * 1.6, -9 - i * 4.2); G.add(l);
      }
    }
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (12 + Math.random() * 60), z = -6 - Math.random() * 120;
      const y = z < -40 ? (z < -95 ? 23 : 11) : -2.4;
      const tr = this.makeSakura(1 + Math.random() * 0.8); tr.position.set(x, y, z); G.add(tr);
    }
    // 遠景の杉林
    const cedarMat = new THREE.MeshStandardMaterial({ color: 0x24402a, roughness: 1 });
    const cg = new THREE.ConeGeometry(3, 14, 7);
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160;
      const c = new THREE.Mesh(cg, cedarMat); c.position.set(Math.cos(a) * r, 4, Math.sin(a) * r - 60); c.scale.setScalar(0.8 + Math.random() * 1.4); G.add(c);
    }
  }

  roofGeometry(W, D, H, R, up = 0.35, sag = 0.18) {
    const pos = [], idx = [], uv = [];
    const N = 10;
    const faces = [
      [[-W / 2, 0, D / 2], [W / 2, 0, D / 2], [-R, H, 0], [R, H, 0]],
      [[W / 2, 0, -D / 2], [-W / 2, 0, -D / 2], [R, H, 0], [-R, H, 0]],
      [[W / 2, 0, D / 2], [W / 2, 0, -D / 2], [R, H, 0], [R, H, 0]],
      [[-W / 2, 0, -D / 2], [-W / 2, 0, D / 2], [-R, H, 0], [-R, H, 0]],
    ];
    for (const [e0, e1, r0, r1] of faces) {
      const base = pos.length / 3;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const u = i / N, v = j / N;
        const ex = e0[0] + (e1[0] - e0[0]) * u, ez = e0[2] + (e1[2] - e0[2]) * u;
        const rx = r0[0] + (r1[0] - r0[0]) * u, rz = r0[2] + (r1[2] - r0[2]) * u;
        const x = ex + (rx - ex) * v, z = ez + (rz - ez) * v;
        let y = H * v - H * sag * Math.sin(Math.PI * v);
        y += up * Math.pow(Math.abs(2 * u - 1), 6) * (1 - v) * H; // 軒反り
        pos.push(x, y, z); uv.push(u * W / 2, v * 3);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = base + j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  get roofMat() {
    if (!this._roofMat) {
      const t = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = '#3b3f47'; g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 16) { g.fillStyle = '#2a2d33'; g.fillRect(x, 0, 5, h); g.fillStyle = '#50555e'; g.fillRect(x + 6, 0, 3, h); }
        for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 3); }
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this._roofMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide });
    }
    return this._roofMat;
  }

  makeHall(W, D, H, pillarColor, stories) {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.9 });
    const redMat = new THREE.MeshStandardMaterial({ color: pillarColor, roughness: 0.6 });
    const goldTrim = MAT.goldWarm;
    let y = 0;
    for (let s = 0; s < stories; s++) {
      const w = W * (1 - s * 0.22), d = D * (1 - s * 0.22), h = H * (s ? 0.7 : 1);
      const box = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, h, d * 0.8), wallMat); box.position.y = y + h / 2; g.add(box);
      const n = Math.max(4, Math.round(w / 3.2));
      const pg = new THREE.CylinderGeometry(0.32, 0.36, h, 10);
      for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(pg, redMat); p.position.set(-w * 0.45 + (w * 0.9) * i / n, y + h / 2, sz * d * 0.44); g.add(p);
      }
      // 格子戸と金具
      const lat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, h * 0.08, 0.2), redMat); lat.position.set(0, y + h * 0.92, d * 0.41); g.add(lat);
      const tr = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.18, 0.25), goldTrim); tr.position.set(0, y + h, d * 0.45); g.add(tr);
      const roofH = h * 0.75;
      const roof = new THREE.Mesh(this.roofGeometry(w * 1.25, d * 1.35, roofH, w * 0.28), this.roofMat); roof.position.y = y + h - 0.2; g.add(roof);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.6, 0.8), this.roofMat); ridge.position.y = y + h - 0.2 + roofH; g.add(ridge);
      for (const sx of [-1, 1]) { // 鴟尾
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), goldTrim); sh.scale.set(0.6, 1.4, 0.6); sh.position.set(sx * w * 0.3, y + h + roofH + 0.4, 0); g.add(sh);
      }
      y += h + roofH * 0.55;
    }
    // 提灯
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 16), new THREE.MeshStandardMaterial({ color: 0xc8301e, emissive: 0xff4020, emissiveIntensity: 0.8, roughness: 0.6 }));
    lantern.position.set(0, H * 0.55, D * 0.5); g.add(lantern);
    const base = new THREE.Mesh(new THREE.BoxGeometry(W * 1.05, 1.2, D * 1.05), new THREE.MeshStandardMaterial({ color: 0x8a857a, roughness: 0.9 })); base.position.y = -0.4; g.add(base);
    return g;
  }

  makePagoda(tiers, w) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa8341f, roughness: 0.65 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xefe6d0, roughness: 0.9 });
    let y = 0;
    for (let i = 0; i < tiers; i++) {
      const ww = w * (1 - i * 0.09), h = 4.5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(ww, h, ww), wallMat); b.position.y = y + h / 2; g.add(b);
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), bodyMat); p.position.set(x * ww / 2, y + h / 2, z * ww / 2); g.add(p); }
      const r = new THREE.Mesh(this.roofGeometry(ww * 2.1, ww * 2.1, 2.6, 0.01, 0.5, 0.25), this.roofMat); r.position.y = y + h - 0.3; g.add(r);
      y += h + 1.4;
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 12, 8), MAT.goldWarm); spire.position.y = y + 6; g.add(spire);
    for (let i = 0; i < 9; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.75 - i * 0.03, 0.1, 6, 18), MAT.goldWarm); t.rotation.x = Math.PI / 2; t.position.y = y + 2 + i * 0.85; g.add(t); }
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), MAT.gold); jewel.position.y = y + 12.4; g.add(jewel);
    return g;
  }

  makeTorii() {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xd13a1e, roughness: 0.55 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1c1a1a, roughness: 0.5 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 14, 14), red); p.position.set(sx * 6, 7, 0); g.add(p); }
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(15, 0.7, 0.6), red); nuki.position.y = 11; g.add(nuki);
    const kasagi = new THREE.Mesh(this.roofGeometry(18, 1.6, 0.6, 9, 0.9, 0), black); kasagi.position.y = 13.4; g.add(kasagi);
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(17, 0.8, 1.1), red); shimaki.position.y = 13.2; g.add(shimaki);
    return g;
  }

  makeLantern(stoneMat, lightMat) {
    const g = new THREE.Group();
    const add = (geo, m, y) => { const x = new THREE.Mesh(geo, m); x.position.y = y; g.add(x); return x; };
    add(new THREE.CylinderGeometry(0.6, 0.8, 0.5, 6), stoneMat, 0.25);
    add(new THREE.CylinderGeometry(0.22, 0.28, 2, 8), stoneMat, 1.5);
    add(new THREE.CylinderGeometry(0.7, 0.5, 0.35, 6), stoneMat, 2.6);
    add(new THREE.BoxGeometry(0.75, 0.7, 0.75), lightMat, 3.1);
    add(new THREE.ConeGeometry(1.0, 0.8, 6), stoneMat, 3.85);
    add(new THREE.SphereGeometry(0.18, 8, 6), stoneMat, 4.35);
    return g;
  }

  get sakuraMats() {
    if (!this._sak) this._sak = [new THREE.MeshStandardMaterial({ color: 0xf8bcd0, roughness: 0.85, emissive: 0x401020, emissiveIntensity: 0.2 }), new THREE.MeshStandardMaterial({ color: 0xffd6e2, roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 1 })];
    return this._sak;
  }
  makeSakura(s) {
    const g = new THREE.Group();
    const [p1, p2, trunk] = this.sakuraMats;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 6, 7), trunk); t.position.y = 3; g.add(t);
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(geo, i % 2 ? p1 : p2);
      c.position.set((Math.random() - 0.5) * 6, 6 + Math.random() * 3, (Math.random() - 0.5) * 5);
      c.scale.setScalar(1.6 + Math.random() * 1.6); g.add(c);
    }
    g.scale.setScalar(s);
    return g;
  }

  // ---------- 山々 ----------
  buildMountains() {
    const mk = (x, z, R, H, seed) => {
      const geo = new THREE.ConeGeometry(R, H, 72, 24, true);
      const p = geo.attributes.position, col = [];
      const c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const hr = (vy + H / 2) / H;
        const ang = Math.atan2(vz, vx);
        const n = Math.sin(ang * 5 + seed) * 0.08 + Math.sin(ang * 13 + seed * 2) * 0.04 + Math.sin(hr * 9 + ang * 3) * 0.03;
        const k = 1 + n * (0.3 + hr);
        p.setXYZ(i, vx * k, vy + (hr > 0.98 ? 0 : n * H * 0.1), vz * k);
        if (hr > 0.78 + n) c.setHex(0xf3f5f8); else if (hr > 0.45 + n) c.setHex(0x6c6a62).lerp(new THREE.Color(0x8a8a80), Math.random() * 0.3); else c.setHex(0x2f4a2c).lerp(new THREE.Color(0x3d5a36), Math.random() * 0.5);
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
      m.position.set(x, H / 2 - 4, z);
      this.scene.add(m);
    };
    [[-190, -340, 210, 430, 1], [230, -400, 250, 490, 2], [-30, -560, 320, 470, 3], [130, -240, 130, 320, 4], [-300, -260, 170, 350, 5], [360, -260, 170, 330, 6], [-190, -330, 110, 280, 8]].forEach((a) => mk(...a));
  }

  // 清水の舞台風の懸造り
  buildKiyomizu() {
    const g = new THREE.Group(); g.position.set(70, 0, -260); this.scene.add(g); this.kiyomizu = g;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
    const top = 376;
    // 舞台の背後にそびえる山（舞台はこの斜面に張り出して建つ）
    // 上は舞台が張り出す急な山頂、下は地上まで続く岩の柱（ふもとが手前の境内まで広がらないように）
    const apexY = top + 14, apexZ = -14, H = 120, R = 55;
    const slopeY = (x, z) => apexY - (H / R) * Math.hypot(x, z - apexZ); // 斜面の高さ
    const paint = (geo, rocky) => {
      const pos = geo.attributes.position, col = [], c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vz = pos.getZ(i), ang = Math.atan2(vz, vx);
        const n = Math.sin(ang * 7 + 1) * 0.03 + Math.sin(ang * 17) * 0.015;
        pos.setX(i, vx * (1 + n)); pos.setZ(i, vz * (1 + n));
        if (Math.random() < rocky) c.setHex(0x6e6a5e).lerp(new THREE.Color(0x8a867a), Math.random() * 0.4); else c.setHex(0x2d4a2b).lerp(new THREE.Color(0x46623a), Math.random() * 0.6);
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    };
    const peak = paint(new THREE.ConeGeometry(R, H, 64, 16, true), 0.25);
    peak.position.set(0, apexY - H / 2, apexZ); g.add(peak);
    const trunkH = apexY - H + 20;
    const trunk = paint(new THREE.CylinderGeometry(R * 0.9, 50, trunkH, 64, 12, true), 0.7);
    trunk.position.set(0, apexY - H - trunkH / 2 + 0.5, apexZ); g.add(trunk);
    // 懸造り：柱は斜面まで届く
    const pg = new THREE.CylinderGeometry(0.45, 0.5, 1, 8);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
      const x = -12 + i * 4, z = 4 + j * 4;
      const len = top - slopeY(x, z) + 1.5;
      const p = new THREE.Mesh(pg, wood); p.scale.y = len; p.position.set(x, top - len / 2, z); g.add(p);
    }
    for (let k = 0; k < 8; k++) { // 貫（横木）
      const y = top - 4 - k * 6;
      for (let j = 0; j < 5; j++) {
        const z = 4 + j * 4;
        if (slopeY(0, z) > y - 1) continue;
        const bm = new THREE.Mesh(new THREE.BoxGeometry(25, 0.45, 0.45), wood); bm.position.set(0, y, z); g.add(bm);
      }
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 20), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 })); deck.position.set(0, top, 12); g.add(deck);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 0.3), wood); rail.position.set(0, top + 1.6, 21.8); g.add(rail);
    const hall = this.makeHall(26, 16, 7, 0x6a3020, 1); hall.position.set(0, top + 0.5, 4); g.add(hall);
    // 斜面の杉と桜
    const cedarMat = new THREE.MeshStandardMaterial({ color: 0x24402a, roughness: 1 });
    const cg = new THREE.ConeGeometry(2.2, 10, 7);
    for (let i = 0; i < 70; i++) {
      const ang = -Math.PI * 0.95 + Math.random() * Math.PI * 0.9 + Math.PI; // 手前側の斜面
      const r = 20 + Math.random() * 33;
      const x = Math.cos(ang) * r, z = apexZ - Math.sin(ang) * r;
      if (Math.abs(x) < 16 && z > -6 && z < 24) continue; // 舞台の下は空ける
      const t = new THREE.Mesh(cg, cedarMat); t.position.set(x, slopeY(x, z) + 4, z); t.scale.setScalar(0.8 + Math.random() * 0.8); g.add(t);
    }
    for (const [x, z] of [[-20, 2], [18, 0], [-24, 12], [22, 14]]) { const tr = this.makeSakura(1.1); tr.position.set(x, slopeY(x, z) - 0.5, z); g.add(tr); }
  }

  // ---------- 雲 ----------
  cloudTexture(tint) {
    return canvasTex(256, 256, (g, w) => {
      for (let i = 0; i < 26; i++) {
        const x = w * (0.22 + Math.random() * 0.56), y = w * (0.3 + Math.random() * 0.42), r = w * (0.1 + Math.random() * 0.16);
        const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
        gr.addColorStop(0, tint[0]); gr.addColorStop(0.6, tint[1]); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    });
  }
  buildClouds() {
    const white = [0, 1, 2].map(() => new THREE.SpriteMaterial({ map: this.cloudTexture(['rgba(255,255,255,.95)', 'rgba(225,232,242,.6)']), transparent: true, depthWrite: false, fog: true }));
    const pink = [0, 1].map(() => new THREE.SpriteMaterial({ map: this.cloudTexture(['rgba(255,245,240,.95)', 'rgba(255,200,215,.55)']), transparent: true, depthWrite: false, fog: true }));
    const gold = new THREE.SpriteMaterial({ map: this.cloudTexture(['rgba(255,250,225,.95)', 'rgba(255,215,150,.55)']), transparent: true, depthWrite: false, fog: true });
    this.passClouds = [];
    const add = (mats, x, y, z, s) => {
      const sp = new THREE.Sprite(mats[Math.random() * mats.length | 0]);
      sp.position.set(x, y, z); sp.scale.set(s, s * 0.6, 1); this.scene.add(sp); return sp;
    };
    // 各高度の雲
    for (let i = 0; i < 110; i++) {
      const y = 12 + Math.random() * 1090;
      const near = Math.random() < 0.12;
      const z = near ? 4 + Math.random() * 8 : -70 - Math.random() * 300;
      const x = near ? (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 10) : (Math.random() - 0.5) * 500;
      const mats = y > 1080 ? pink : y > 760 && y < 940 ? [gold] : white;
      const sp = add(mats, x, y, z, near ? 10 + Math.random() * 10 : 40 + Math.random() * 90);
      if (near) { sp.material = sp.material.clone(); sp.material.opacity = 0.4; this.passClouds.push(sp); }
    }
    // 山頂の下に広がる雲海
    for (let i = 0; i < 45; i++) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 380;
      add(white, Math.cos(a) * r, 292 + Math.random() * 10, -Math.abs(Math.sin(a) * r * 0.8) - 80, 50 + Math.random() * 70);
    }
    const seaTex = this.cloudTexture(['rgba(255,255,255,1)', 'rgba(235,240,248,.9)']);
    seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(6, 6);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ map: seaTex, color: 0xf4f7fb, transparent: true, opacity: 0.95, depthWrite: false }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 300, -300); this.scene.add(sea);
    // 雲海ステージ：入道雲の塔
    for (let t = 0; t < 10; t++) {
      const x = (Math.random() - 0.5) * 300, z = -80 - Math.random() * 220;
      for (let k = 0; k < 8; k++) add(white, x + (Math.random() - 0.5) * 30, 460 + k * 20 + Math.random() * 12, z + (Math.random() - 0.5) * 20, 50 + Math.random() * 40);
    }
    // 極楽浄土の雲の床
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 460;
      add(Math.random() < 0.6 ? pink : [gold], Math.cos(a) * r, 1080 + Math.random() * 40 + (Math.random() < 0.3 ? Math.random() * 300 : 0), Math.sin(a) * r * 0.7 - 200, 50 + Math.random() * 90);
    }
  }

  // ---------- 極楽浄土 ----------
  buildPureLand() {
    const g = new THREE.Group(); this.scene.add(g); this.pureLand = g; this.lotusSet = new Set();
    // 雲間に浮かぶ巨大な黄金の仏
    const giant = buildBuddha(5);
    giant.scale.setScalar(80); giant.position.set(0, 1060, -560);
    giant.traverse((o) => { if (o.material && o.material.fog !== undefined) { /* 霧で薄れすぎないように */ } });
    g.add(giant); this.giant = giant; this.lotusSet.add(giant);
    // 宮殿
    const palaceY = 1200;
    for (const [x, z, s] of [[0, -160, 1.4], [-70, -200, 1], [75, -210, 1], [-140, -260, 0.8], [150, -270, 0.8]]) {
      const h = this.makeHall(30, 18, 9, 0xd0a040, 2); h.position.set(x, palaceY, z); h.scale.setScalar(s);
      h.traverse((o) => { if (o.isMesh && o.material === this.roofMat) o.material = MAT.goldWarm; });
      g.add(h);
    }
    // 黄金の大階段
    const stair = new THREE.MeshStandardMaterial({ color: 0xf0d090, metalness: 0.6, roughness: 0.35 });
    for (let i = 0; i < 30; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(30 - i * 0.3, 0.8, 2), stair); s.position.set(0, 1170 + i * 1.0, -100 - i * 2); g.add(s); }
    // 浮かぶ蓮の花
    const petal = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 40; i++) {
      const f = new THREE.Group();
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, ring = k % 2;
        const p = new THREE.Mesh(petal, MAT.lotus); p.scale.set(0.5, 1.1, 0.16);
        p.position.set(Math.cos(a) * (0.8 + ring * 0.3), 0.5, Math.sin(a) * (0.8 + ring * 0.3));
        p.rotation.order = 'YXZ'; p.rotation.set(0.5 + ring * 0.5, Math.PI / 2 - a, 0); f.add(p);
      }
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xffe080, emissive: 0xffc040, emissiveIntensity: 0.8 })); core.position.y = 0.6; f.add(core);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshStandardMaterial({ color: 0x4a8a50, roughness: 0.7, side: THREE.DoubleSide })); pad.rotation.x = -Math.PI / 2; f.add(pad);
      const side = Math.random() < 0.5 ? -1 : 1;
      f.position.set(side * (10 + Math.random() * 60), 1120 + Math.random() * 400, -10 - Math.random() * 120);
      f.scale.setScalar(1 + Math.random() * 2.5);
      f.rotation.x = 0.3;
      g.add(f); this.lotusSet.add(f);
      const ph = Math.random() * 6;
      this.animated.push((t) => { f.rotation.y = t * 0.0002 + ph; f.position.y += Math.sin(t * 0.001 + ph) * 0.005; });
    }
  }
}

// ---------- 光の柱（神々しい光線） ----------
export function makeLightPillars(scene) {
  const tex = canvasTex(64, 256, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, 'rgba(255,230,160,0)'); lg.addColorStop(0.5, 'rgba(255,245,210,1)'); lg.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.2, 'rgba(0,0,0,0)'); v.addColorStop(0.8, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const pillars = [];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25, side: THREE.DoubleSide, fog: false, color: 0xffe0a0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3 + Math.random() * 5, 120), mat);
    m.userData.ox = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 30);
    m.userData.oz = -10 - Math.random() * 50;
    m.userData.ph = Math.random() * 6;
    scene.add(m); pillars.push(m);
  }
  return pillars;
}
export { glowTexture, dotTexture };
