// 3Dモデル：仏像（5形態）、硬貨（4種）、カラス、雷雲
import * as THREE from 'three';

const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP","WenQuanYi Zen Hei",serif';

// ---------- テクスチャ生成ユーティリティ ----------
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, colors, rmin, rmax) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.random() * colors.length | 0];
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rmin + Math.random() * (rmax - rmin), 0, 7); g.fill();
  }
}
// 浮き彫り文字（明るい面＋影）
function embossText(g, s, x, y, size, light, dark, bump) {
  g.font = `900 ${size}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (bump) { g.fillStyle = '#fff'; g.fillText(s, x, y); return; }
  g.fillStyle = dark; g.fillText(s, x + size * 0.04, y + size * 0.05);
  g.fillStyle = light; g.fillText(s, x, y);
}

export const glowTexture = canvasTex(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,240,200,.6)'); r.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
export const dotTexture = canvasTex(64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

// 曼荼羅（光背の文様）
export const mandalaTexture = canvasTex(1024, 1024, (g, w) => {
  const c = w / 2;
  g.translate(c, c);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  const ring = (r, lw) => { g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); };
  ring(500, 10); ring(470, 4); ring(330, 6); ring(300, 3); ring(190, 5);
  // 蓮弁
  for (let i = 0; i < 24; i++) {
    g.save(); g.rotate(i / 24 * Math.PI * 2);
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, -335); g.quadraticCurveTo(46, -400, 0, -465); g.quadraticCurveTo(-46, -400, 0, -335); g.stroke();
    g.beginPath(); g.arc(0, -485, 7, 0, 7); g.fill();
    g.restore();
  }
  for (let i = 0; i < 48; i++) {
    g.save(); g.rotate(i / 48 * Math.PI * 2);
    g.lineWidth = 3; g.beginPath(); g.moveTo(0, -195); g.quadraticCurveTo(18, -245, 0, -296); g.quadraticCurveTo(-18, -245, 0, -195); g.stroke();
    g.restore();
  }
  for (let i = 0; i < 120; i++) { g.save(); g.rotate(i / 120 * Math.PI * 2); g.beginPath(); g.arc(0, -316, 4, 0, 7); g.fill(); g.restore(); }
  // 放射光
  g.globalAlpha = 0.5;
  for (let i = 0; i < 72; i++) { g.save(); g.rotate(i / 72 * Math.PI * 2); g.lineWidth = 2; g.beginPath(); g.moveTo(0, -60); g.lineTo(0, -185); g.stroke(); g.restore(); }
  g.globalAlpha = 1;
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 190);
  r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, 190, 0, 7); g.fill();
}, true);

// ---------- 材質 ----------
const woodTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d6a468'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w, a = 0.08 + Math.random() * 0.18;
    g.strokeStyle = `rgba(${150 + Math.random() * 30 | 0},${100 + Math.random() * 20 | 0},50,${a})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * 0.02 + i) * 10 + Math.sin(y * 0.07) * 3, y);
    g.stroke();
  }
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;

export const MAT = {
  wood: new THREE.MeshStandardMaterial({ color: 0xffe2b8, map: woodTex, roughness: 0.55, metalness: 0, bumpMap: woodTex, bumpScale: 0.6, envMapIntensity: 0.5 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0xb98a55, map: woodTex, roughness: 0.7 }),
  gold: new THREE.MeshPhysicalMaterial({ color: 0xf5b847, metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.15, emissive: 0x2a1400, emissiveIntensity: 0.5 }),
  goldWarm: new THREE.MeshPhysicalMaterial({ color: 0xe0953a, metalness: 1, roughness: 0.3, clearcoat: 0.4, emissive: 0x2a1000, emissiveIntensity: 0.5 }),
  goldGreat: new THREE.MeshPhysicalMaterial({ color: 0xf7c04e, metalness: 1, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0x2e1800, emissiveIntensity: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a0d04, roughness: 0.6 }),
  lotus: new THREE.MeshPhysicalMaterial({ color: 0xf7b2cd, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffe0ee), emissive: 0x401020, emissiveIntensity: 0.25 }),
  urna: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 2 }),
};

// ---------- 仏像 ----------
const sph = new THREE.SphereGeometry(1, 24, 16);
const sphLow = new THREE.SphereGeometry(1, 10, 8);
function blob(mat, x, y, z, sx, sy, sz, parent, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(sph, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  parent.add(m); return m;
}
function capsule(mat, a, b, r, parent) {
  const len = a.distanceTo(b);
  const geo = new THREE.CapsuleGeometry(r, len, 6, 14);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(m); return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 螺髪（ひと粒ずつ）
function curls(parent, mat, cx, cy, cz, R, count, minY, curlR) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y), th = golden * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    // 前は生え際を高く、後ろは低く
    const lim = z > 0 ? minY + z * 0.35 : minY - 0.25;
    if (y > lim) pts.push(V(x, y, z));
  }
  const geo = new THREE.SphereGeometry(curlR, 10, 8);
  const im = new THREE.InstancedMesh(geo, mat, pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 0.75);
  pts.forEach((p, i) => {
    q.setFromUnitVectors(V(0, 0, 1), p);
    m4.compose(V(cx + p.x * R, cy + p.y * R, cz + p.z * R), q, s);
    im.setMatrixAt(i, m4);
  });
  parent.add(im);
  return im;
}

function boatHaloGeometry(h, wdt, flames) {
  const s = new THREE.Shape();
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const t = i / N * Math.PI * 2;
    // 舟形（上が尖った涙形）
    let x = Math.sin(t) * wdt * (0.55 + 0.45 * Math.cos(t * 0.5) ** 2) ;
    let y = -Math.cos(t) * h * 0.5;
    x *= 1 - Math.max(0, -Math.cos(t)) * 0.55 * (1 - Math.abs(Math.sin(t)));
    const k = flames ? 1 + 0.06 * Math.abs(Math.sin(t * 9)) : 1;
    if (i === 0) s.moveTo(x * k, y * k); else s.lineTo(x * k, y * k);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -0.03);
  return g;
}

/**
 * 仏像を組み立てる
 * lv: 1木造仏 2金色 3光背巨大化 4千手観音 5黄金の大仏
 */
export function buildBuddha(lv) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mat = lv === 1 ? MAT.wood : lv === 4 ? MAT.goldWarm : lv === 5 ? MAT.goldGreat : MAT.gold;
  const hairMat = mat;

  // --- 蓮台 ---
  const ped = new THREE.Group(); body.add(ped);
  const petalMat = lv === 1 ? MAT.wood : lv === 5 ? MAT.goldGreat : MAT.lotus;
  // [枚数, 半径, 高さ, 外への傾き]
  const tiers = [[18, 0.9, -0.05, 0.55], [18, 0.84, -0.22, 0.95], [14, 0.72, -0.38, 1.25]];
  tiers.forEach(([n, r, y, lean], ti) => {
    for (let i = 0; i < n; i++) {
      const a = (i + ti * 0.5) / n * Math.PI * 2;
      const p = blob(petalMat, Math.cos(a) * r, y, Math.sin(a) * r, 0.2, 0.34, 0.06, ped);
      p.rotation.order = 'YXZ';
      p.rotation.set(lean, Math.PI / 2 - a, 0);
    }
  });
  const baseMat = lv === 1 ? MAT.woodDark : MAT.goldWarm;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.3, 32), baseMat); drum.position.y = -0.55; ped.add(drum);
  const drum2 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.16, 8), baseMat); drum2.position.y = -0.76; ped.add(drum2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 8, 40), baseMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.42; ped.add(ring);

  // --- 脚（結跏趺坐） ---
  blob(mat, 0, 0.18, 0.12, 0.95, 0.24, 0.55, body);
  blob(mat, -0.62, 0.17, 0.3, 0.34, 0.22, 0.34, body);
  blob(mat, 0.62, 0.17, 0.3, 0.34, 0.22, 0.34, body);
  blob(mat, -0.32, 0.33, 0.48, 0.2, 0.08, 0.13, body, 0, 0.5);  // 足裏
  blob(mat, 0.32, 0.33, 0.48, 0.2, 0.08, 0.13, body, 0, -0.5);
  // 衣のひだ（脚）
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.07, 0.018, 6, 30, Math.PI * 0.8), mat);
    t.rotation.set(Math.PI / 2 - 0.15, 0, Math.PI * 1.1); t.position.set(0, 0.32 - i * 0.02, 0.18); t.scale.set(1.5, 0.8, 1); body.add(t);
  }

  // --- 胴 ---
  const prof = [[0.0, 0.25], [0.6, 0.27], [0.66, 0.5], [0.62, 0.85], [0.56, 1.15], [0.6, 1.35], [0.48, 1.55], [0.2, 1.66], [0, 1.68]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat);
  torso.scale.set(1, 1, 0.68); body.add(torso);
  blob(mat, -0.52, 1.36, -0.02, 0.27, 0.25, 0.27, body); // 肩
  blob(mat, 0.52, 1.36, -0.02, 0.27, 0.25, 0.27, body);
  // 衣の縁（袈裟）
  const drape = new THREE.CatmullRomCurve3([V(-0.5, 1.5, 0.12), V(-0.15, 1.2, 0.42), V(0.2, 0.8, 0.44), V(0.5, 0.55, 0.35)]);
  body.add(new THREE.Mesh(new THREE.TubeGeometry(drape, 30, 0.045, 8), mat));
  for (let i = 0; i < 4; i++) {
    const c = new THREE.CatmullRomCurve3([V(-0.45, 1.05 - i * 0.13, 0.36), V(0, 0.95 - i * 0.13, 0.46), V(0.45, 1.0 - i * 0.13, 0.36)]);
    body.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.016, 6), mat));
  }

  // --- 腕と手 ---
  if (lv === 4) {
    // 合掌
    capsule(mat, V(-0.6, 1.3, 0), V(-0.55, 0.85, 0.25), 0.12, body);
    capsule(mat, V(0.6, 1.3, 0), V(0.55, 0.85, 0.25), 0.12, body);
    capsule(mat, V(-0.55, 0.85, 0.25), V(-0.06, 1.05, 0.55), 0.1, body);
    capsule(mat, V(0.55, 0.85, 0.25), V(0.06, 1.05, 0.55), 0.1, body);
    blob(mat, -0.03, 1.2, 0.58, 0.05, 0.17, 0.09, body, 0.2);
    blob(mat, 0.03, 1.2, 0.58, 0.05, 0.17, 0.09, body, 0.2);
  } else {
    capsule(mat, V(-0.62, 1.3, 0), V(-0.68, 0.72, 0.18), 0.13, body);
    capsule(mat, V(0.62, 1.3, 0), V(0.68, 0.72, 0.18), 0.13, body);
    capsule(mat, V(-0.68, 0.72, 0.18), V(-0.18, 0.5, 0.5), 0.11, body);
    capsule(mat, V(0.68, 0.72, 0.18), V(0.18, 0.5, 0.5), 0.11, body);
    blob(mat, 0, 0.5, 0.52, 0.3, 0.08, 0.17, body); // 定印
    const th = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 16), mat); th.position.set(0, 0.6, 0.56); th.rotation.x = 0.4; body.add(th);
  }

  // --- 首・頭 ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.25, 20), mat); neck.position.y = 1.74; body.add(neck);
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.18 + i * 0.008, 0.012, 6, 24), mat); t.rotation.x = Math.PI / 2; t.position.y = 1.68 + i * 0.06; body.add(t); }
  const head = new THREE.Group(); head.position.set(0, 2.12, 0); body.add(head);
  blob(mat, 0, 0, 0, 0.4, 0.46, 0.42, head);
  blob(mat, 0, -0.24, 0.08, 0.3, 0.22, 0.3, head); // 頬〜顎
  // 耳（長い耳たぶ）
  for (const sx of [-1, 1]) {
    blob(mat, sx * 0.41, -0.06, -0.02, 0.07, 0.3, 0.13, head, 0, 0, sx * 0.08);
    blob(mat, sx * 0.43, -0.3, 0.0, 0.06, 0.1, 0.08, head);
  }
  // 顔
  const face = new THREE.Group(); face.position.set(0, 0, 0.36); head.add(face);
  for (const sx of [-1, 1]) {
    blob(mat, sx * 0.15, 0.03, 0.02, 0.11, 0.05, 0.05, face, 0, 0, -sx * 0.12); // まぶた
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 6, 18, Math.PI * 0.8), MAT.dark);
    lid.position.set(sx * 0.15, 0.045, 0.055); lid.rotation.z = Math.PI + 0.3; lid.scale.set(1, 0.35, 1); face.add(lid);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 6, 18, Math.PI * 0.75), mat);
    brow.position.set(sx * 0.15, 0.06, 0.03); brow.rotation.z = 0.4; brow.scale.set(1, 0.6, 1); face.add(brow);
  }
  blob(mat, 0, -0.06, 0.06, 0.05, 0.13, 0.07, face); // 鼻筋
  blob(mat, 0, -0.16, 0.08, 0.07, 0.04, 0.05, face); // 小鼻
  const lipU = blob(mat, 0, -0.245, 0.055, 0.075, 0.022, 0.03, face);
  const lipL = blob(mat, 0, -0.29, 0.05, 0.065, 0.026, 0.03, face);
  const mouth = blob(MAT.dark, 0, -0.265, 0.045, 0.06, 0.006, 0.02, face);
  const urna = blob(MAT.urna, 0, 0.17, 0.05, 0.025, 0.025, 0.025, face);

  // 螺髪・肉髻 / 宝冠
  if (lv === 4) {
    curls(head, hairMat, 0, 0.04, 0, 0.42, 300, 0.1, 0.04);
    const crown = new THREE.Group(); crown.position.set(0, 0.38, 0); head.add(crown);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 40), MAT.gold); band.rotation.x = Math.PI / 2; crown.add(band);
    for (let i = 0; i < 11; i++) { // 十一面
      const a = (i / 11) * Math.PI * 2;
      const hx = Math.sin(a) * 0.32, hz = Math.cos(a) * 0.32;
      blob(MAT.gold, hx * 0.9, 0.16 + (i % 2) * 0.05, hz * 0.9, 0.08, 0.1, 0.08, crown);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), MAT.gold); spike.position.set(hx, 0.08, hz); crown.add(spike);
    }
    blob(MAT.gold, 0, 0.38, 0, 0.11, 0.13, 0.11, crown);
  } else {
    curls(head, hairMat, 0, 0.04, 0, 0.42, 520, 0.12, 0.05);
    curls(head, hairMat, 0, 0.5, -0.03, 0.22, 110, -0.6, 0.045);
    blob(hairMat, 0, 0.48, -0.03, 0.21, 0.2, 0.21, head);
  }

  // --- 光背 ---
  const halo = new THREE.Group(); halo.position.set(0, 2.12, -0.5); body.add(halo);
  let glowSize = 0;
  if (lv === 1) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.05, 48), MAT.woodDark); disc.rotation.x = Math.PI / 2; halo.add(disc);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.045, 8, 48), MAT.wood); halo.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 48), MAT.wood); r2.position.z = 0.03; halo.add(r2);
  } else {
    const big = lv >= 3;
    // 頭光：輪＋放射状の光条
    halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 64), mat));
    halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.02, 8, 64), mat));
    if (lv !== 4) {
      const spokes = lv === 2 ? 48 : 72;
      const inner = 0.7, outer = lv === 2 ? 1.75 : lv === 3 ? 2.9 : 2.4;
      const rodGeo = new THREE.CylinderGeometry(0.014, 0.022, 1, 5);
      for (let i = 0; i < spokes; i++) {
        const a = i / spokes * Math.PI * 2;
        const len = (outer - inner) * (i % 2 ? 0.72 : 1);
        const rod = new THREE.Mesh(rodGeo, mat);
        rod.scale.y = len;
        rod.position.set(Math.cos(a) * (inner + len / 2), Math.sin(a) * (inner + len / 2), 0);
        rod.rotation.z = a - Math.PI / 2;
        halo.add(rod);
        if (i % 2 === 0) { const tip = new THREE.Mesh(sphLow, mat); tip.scale.setScalar(0.035); tip.position.set(Math.cos(a) * (inner + len), Math.sin(a) * (inner + len), 0); halo.add(tip); }
      }
    }
    if (big) {
      // 舟形光背（身光）
      const boat = new THREE.Mesh(boatHaloGeometry(lv === 4 ? 4.2 : 4.6, lv === 4 ? 1.6 : 1.45, true), mat);
      boat.position.set(0, -1.0, -0.12); halo.add(boat);
      const inner = new THREE.Mesh(boatHaloGeometry(3.6, 1.15, false), MAT.goldWarm);
      inner.position.set(0, -1.05, -0.06); halo.add(inner);
    }
    // 光る曼荼羅の円盤
    const mandala = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mandalaTexture, color: lv >= 5 ? 0xfff0c0 : 0xffd890, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: lv >= 5 ? 0.55 : 0.4 }));
    const ms = lv >= 5 ? 4.6 : lv === 4 ? 2.2 : 1.5;
    mandala.scale.set(ms, ms, 1); mandala.position.z = 0.05; halo.add(mandala);
    halo.userData.mandala = mandala;
    if (lv >= 5) {
      halo.add(new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.06, 8, 96), mat));
      for (let i = 0; i < 12; i++) { // 化仏
        const a = i / 12 * Math.PI * 2;
        const kb = new THREE.Group(); kb.position.set(Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0.05); halo.add(kb);
        blob(mat, 0, 0, 0, 0.1, 0.07, 0.07, kb); blob(mat, 0, 0.1, 0, 0.065, 0.08, 0.065, kb); blob(mat, 0, 0.19, 0, 0.045, 0.045, 0.045, kb);
      }
    }
    glowSize = lv >= 5 ? 7 : lv >= 3 ? 5 : 3.2;
  }

  // 千手
  if (lv === 4) {
    const arms = new THREE.Group(); arms.position.set(0, 1.2, -0.42); body.add(arms);
    const N = 21;
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < N; i++) {
        for (const side of [-1, 1]) {
          const a = -0.55 + (i / (N - 1)) * 1.75 + layer * 0.08; // 横〜斜め上に扇状
          const dir = V(side * Math.cos(a), Math.sin(a), 0);
          const L = 1.05 + layer * 0.35 + (i % 3) * 0.08;
          const sh = V(side * 0.42, 0, -layer * 0.14);
          const elbow = sh.clone().add(dir.clone().multiplyScalar(L * 0.5)).add(V(0, 0, 0.05));
          const hand = sh.clone().add(dir.clone().multiplyScalar(L));
          capsule(mat, sh, elbow, 0.055, arms);
          capsule(mat, elbow, hand, 0.045, arms);
          const h = blob(mat, hand.x, hand.y, hand.z, 0.06, 0.1, 0.035, arms, 0, 0, Math.atan2(dir.y, dir.x) - Math.PI / 2);
          if ((i + layer) % 5 === 0) { // 持物
            const w = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 16), MAT.gold); w.position.copy(h.position).add(dir.clone().multiplyScalar(0.12)); arms.add(w);
          }
        }
      }
    }
    // 背後の小さな手の円盤
    const fan = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), new THREE.MeshPhysicalMaterial({ color: 0x8a5418, metalness: 1, roughness: 0.45 }));
    fan.position.set(0, 1.4, -0.95); body.add(fan);
    const handGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.5, 4);
    for (let i = 0; i < 160; i++) {
      const a = i / 160 * Math.PI * 2;
      const m = new THREE.Mesh(handGeo, mat); m.position.set(Math.cos(a) * 2.35, 1.4 + Math.sin(a) * 2.35, -0.9); m.rotation.z = a - Math.PI / 2; body.add(m);
    }
  }

  // 後光の輝き（加算スプライト）
  if (glowSize) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25 }));
    glow.scale.set(glowSize, glowSize, 1); glow.position.set(0, 2.1, -0.7); body.add(glow);
    root.userData.glow = glow;
  }

  root.userData = { ...root.userData, mouth, lipU, lipL, halo, body, lv, mouthLocal: V(0, 1.85, 0.42) };
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return root;
}

// ---------- 硬貨 ----------
// 天保通寳（銅銭）：楕円・四角い穴
const TENPO = { rx: 0.3, ry: 0.46, hole: 0.075, depth: 0.05 };
function ovalShape(rx, ry, hole) {
  const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false);
  if (hole) { const h = new THREE.Path(); h.moveTo(-hole, -hole); h.lineTo(-hole, hole); h.lineTo(hole, hole); h.lineTo(hole, -hole); h.lineTo(-hole, -hole); s.holes.push(h); }
  return s;
}
function coinGeo(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 40 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function capTex(tex, rx, ry) { tex.repeat.set(1 / (2 * rx), 1 / (2 * ry)); tex.offset.set(0.5, 0.5); return tex; }

function drawTenpo(g, w, h, bump) {
  const cx = w / 2, cy = h / 2;
  if (bump) { g.fillStyle = '#777'; g.fillRect(0, 0, w, h); }
  else {
    const r = g.createRadialGradient(cx * 0.8, cy * 0.7, 10, cx, cy, h * 0.6);
    r.addColorStop(0, '#c48a52'); r.addColorStop(1, '#6d4321');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 260, ['rgba(70,120,95,.35)', 'rgba(90,60,30,.35)', 'rgba(150,170,130,.25)'], 2, 9);
  }
  // 縁
  g.lineWidth = w * 0.07; g.strokeStyle = bump ? '#fff' : '#b9824a';
  g.beginPath(); g.ellipse(cx, cy, w * 0.46, h * 0.46, 0, 0, 7); g.stroke();
  // 穴の縁
  const hs = w * 0.16;
  g.lineWidth = w * 0.045; g.strokeRect(cx - hs * 1.25, cy - hs * 1.25, hs * 2.5, hs * 2.5);
  const L = bump ? '#fff' : '#d29a5c', D = '#3a2410';
  embossText(g, '天', cx, h * 0.17, w * 0.24, L, D, bump);
  embossText(g, '保', cx, h * 0.31, w * 0.24, L, D, bump);
  embossText(g, '通', cx, h * 0.69, w * 0.24, L, D, bump);
  embossText(g, '寳', cx, h * 0.83, w * 0.24, L, D, bump);
}
const tenpoMap = capTex(canvasTex(256, 392, (g, w, h) => drawTenpo(g, w, h, false)), TENPO.rx, TENPO.ry);
const tenpoBump = capTex(canvasTex(256, 392, (g, w, h) => drawTenpo(g, w, h, true), false), TENPO.rx, TENPO.ry);

// 寛永通寳（呪いの銭）
const KANEI = { r: 0.36, hole: 0.085, depth: 0.045 };
function drawKanei(g, w, h, mode) {
  const c = w / 2;
  if (mode === 'emissive') { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
  else if (mode === 'bump') { g.fillStyle = '#666'; g.fillRect(0, 0, w, h); }
  else {
    g.fillStyle = '#5b5444'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 300, ['rgba(20,18,15,.55)', 'rgba(40,35,30,.5)', 'rgba(120,110,90,.3)'], 2, 16);
  }
  g.lineWidth = w * 0.09; g.strokeStyle = mode === 'emissive' ? '#7a20c0' : mode === 'bump' ? '#fff' : '#8c7a4c';
  g.beginPath(); g.arc(c, c, w * 0.455, 0, 7); g.stroke();
  const hs = w * 0.13; g.lineWidth = w * 0.04; g.strokeRect(c - hs * 1.3, c - hs * 1.3, hs * 2.6, hs * 2.6);
  const L = mode === 'emissive' ? '#c050ff' : mode === 'bump' ? '#fff' : '#9a8a5c';
  const D = mode === 'emissive' ? '#000' : '#1a1610';
  embossText(g, '寛', c, w * 0.2, w * 0.22, L, D, mode === 'bump');
  embossText(g, '永', c, w * 0.8, w * 0.22, L, D, mode === 'bump');
  embossText(g, '通', w * 0.8, c, w * 0.22, L, D, mode === 'bump');
  embossText(g, '寳', w * 0.2, c, w * 0.22, L, D, mode === 'bump');
  if (mode === 'emissive') { // ひび割れから漏れる妖気
    g.strokeStyle = '#a030ff'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  }
}
const kaneiMap = capTex(canvasTex(256, 256, (g, w, h) => drawKanei(g, w, h, 'color')), KANEI.r, KANEI.r);
const kaneiBump = capTex(canvasTex(256, 256, (g, w, h) => drawKanei(g, w, h, 'bump'), false), KANEI.r, KANEI.r);
const kaneiEmis = capTex(canvasTex(256, 256, (g, w, h) => drawKanei(g, w, h, 'emissive')), KANEI.r, KANEI.r);

// 小判
const KOBAN = { rx: 0.38, ry: 0.6, depth: 0.04 };
function kiriCrest(g, x, y, s, col) {
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.06;
  // 扇形の枠
  g.beginPath(); g.arc(x, y + s * 0.9, s * 1.3, -Math.PI * 0.78, -Math.PI * 0.22); g.arc(x, y + s * 0.9, s * 0.45, -Math.PI * 0.22, -Math.PI * 0.78, true); g.closePath(); g.stroke();
  // 桐（葉と花）
  for (const dx of [-0.35, 0, 0.35]) { g.beginPath(); g.ellipse(x + dx * s, y + s * 0.05, s * 0.14, s * 0.2, dx, 0, 7); g.fill(); }
  for (const dx of [-0.35, 0, 0.35]) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + dx * s, y - s * 0.25 - k * s * 0.12, s * 0.05, 0, 7); g.fill(); }
}
function drawKoban(g, w, h, bump) {
  const cx = w / 2, cy = h / 2;
  if (bump) { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); }
  else {
    const r = g.createLinearGradient(0, 0, w, h);
    r.addColorStop(0, '#f7dc7a'); r.addColorStop(0.5, '#d9a93a'); r.addColorStop(1, '#a8761c');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }
  // 茣蓙目（横の打ち筋）
  for (let y = 4; y < h; y += 5) {
    g.strokeStyle = bump ? (y % 10 ? '#a0a0a0' : '#505050') : (y % 10 ? 'rgba(255,240,170,.45)' : 'rgba(120,80,10,.4)');
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, y + Math.sin(y) * 1.5); g.lineTo(w, y + Math.cos(y) * 1.5); g.stroke();
  }
  const ink = bump ? '#fff' : '#9a6a10';
  kiriCrest(g, cx, h * 0.13, w * 0.22, ink);
  g.save(); g.translate(cx, h * 0.87); g.rotate(Math.PI); kiriCrest(g, 0, 0, w * 0.22, ink); g.restore();
  // 中央の極印
  g.lineWidth = 3; g.strokeStyle = ink; g.fillStyle = bump ? '#bbb' : 'rgba(255,230,140,.35)';
  for (const [y0, txt] of [[0.32, ['壱', '両']], [0.6, ['光', '次']]]) {
    g.beginPath(); g.ellipse(cx, h * (y0 + 0.08), w * 0.13, h * 0.11, 0, 0, 7); g.fill(); g.stroke();
    embossText(g, txt[0], cx, h * (y0 + 0.035), w * 0.17, bump ? '#fff' : '#7a4e08', 'rgba(255,240,180,.6)', bump);
    embossText(g, txt[1], cx, h * (y0 + 0.125), w * 0.17, bump ? '#fff' : '#7a4e08', 'rgba(255,240,180,.6)', bump);
  }
  // 丸い極印
  for (const [x, y] of [[0.28, 0.4], [0.73, 0.55], [0.7, 0.65]]) {
    g.beginPath(); g.arc(w * x, h * y, w * 0.05, 0, 7); g.fillStyle = bump ? '#eee' : 'rgba(255,235,150,.7)'; g.fill(); g.stroke();
  }
}
const kobanMap = canvasTex(256, 404, (g, w, h) => drawKoban(g, w, h, false));
const kobanBump = canvasTex(256, 404, (g, w, h) => drawKoban(g, w, h, true), false);

// 黄金の御利益コイン
function drawGoriyaku(g, w, h, emissive) {
  const c = w / 2;
  const r = g.createRadialGradient(c, c, 0, c, c, c);
  if (emissive) { r.addColorStop(0, '#ffffff'); r.addColorStop(0.6, '#ffcc40'); r.addColorStop(1, '#a06000'); }
  else { r.addColorStop(0, '#fff6c8'); r.addColorStop(0.55, '#ffcf3e'); r.addColorStop(1, '#b07a00'); }
  g.fillStyle = r; g.fillRect(0, 0, w, h);
  const ink = emissive ? '#fff8d0' : '#8a5000';
  g.strokeStyle = ink; g.fillStyle = ink;
  g.lineWidth = 6; g.beginPath(); g.arc(c, c, w * 0.46, 0, 7); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, w * 0.41, 0, 7); g.stroke();
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * w * 0.435, c + Math.sin(a) * w * 0.435, 2.4, 0, 7); g.fill(); }
  // 雲文
  for (let i = 0; i < 8; i++) {
    g.save(); g.translate(c, c); g.rotate(i / 8 * Math.PI * 2);
    g.lineWidth = 3; g.beginPath(); g.arc(0, -w * 0.33, w * 0.05, 0.2, Math.PI * 1.7); g.stroke();
    g.beginPath(); g.arc(w * 0.06, -w * 0.33, w * 0.03, Math.PI, Math.PI * 2.6); g.stroke();
    g.restore();
  }
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, w * 0.27, 0, 7); g.stroke();
  embossText(g, '福', c, c + 4, w * 0.36, emissive ? '#ffffff' : '#7a4300', emissive ? '#ffd060' : 'rgba(255,250,210,.7)', false);
}
const goriMap = canvasTex(256, 256, (g, w, h) => drawGoriyaku(g, w, h, false));
const goriEmis = canvasTex(256, 256, (g, w, h) => drawGoriyaku(g, w, h, true));

export const COIN_MODELS = (() => {
  const bronzeSide = new THREE.MeshStandardMaterial({ color: 0xb87a48, metalness: 0.6, roughness: 0.4, emissive: 0x3a2010, emissiveIntensity: 0.6 });
  const tenpo = {
    geo: coinGeo(ovalShape(TENPO.rx, TENPO.ry, TENPO.hole), TENPO.depth),
    mats: [new THREE.MeshStandardMaterial({ map: tenpoMap, bumpMap: tenpoBump, bumpScale: 3, metalness: 0.55, roughness: 0.42, emissiveMap: tenpoMap, emissive: 0xffffff, emissiveIntensity: 0.28 }), bronzeSide],
  };
  const kanei = {
    geo: coinGeo(ovalShape(KANEI.r, KANEI.r, KANEI.hole), KANEI.depth),
    mats: [new THREE.MeshStandardMaterial({ map: kaneiMap, bumpMap: kaneiBump, bumpScale: 3, emissiveMap: kaneiEmis, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.65 }),
      new THREE.MeshStandardMaterial({ color: 0x3a3428, metalness: 0.6, roughness: 0.7, emissive: 0x30005a, emissiveIntensity: 0.6 })],
  };
  const kobanGeo = new THREE.CylinderGeometry(1, 1, KOBAN.depth, 48, 1); kobanGeo.rotateX(Math.PI / 2); kobanGeo.scale(KOBAN.rx, KOBAN.ry, 1);
  const kobanFace = new THREE.MeshPhysicalMaterial({ map: kobanMap, bumpMap: kobanBump, bumpScale: 2.5, metalness: 1, roughness: 0.3, clearcoat: 0.3, emissiveMap: kobanMap, emissive: 0xffffff, emissiveIntensity: 0.22 });
  const kobanSide = new THREE.MeshPhysicalMaterial({ color: 0xe6b54a, metalness: 1, roughness: 0.25 });
  const koban = { geo: kobanGeo, mats: [kobanSide, kobanFace, kobanFace] };
  const goriGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 48); goriGeo.rotateX(Math.PI / 2);
  const goriFace = new THREE.MeshPhysicalMaterial({ map: goriMap, emissiveMap: goriEmis, emissive: 0xffffff, emissiveIntensity: 1.4, metalness: 1, roughness: 0.18, clearcoat: 1 });
  const goriSide = new THREE.MeshPhysicalMaterial({ color: 0xffd060, metalness: 1, roughness: 0.15, emissive: 0x8a5000, emissiveIntensity: 1 });
  const goriyaku = { geo: goriGeo, mats: [goriSide, goriFace, goriFace] };
  return { zeni: tenpo, noroi: kanei, koban, goriyaku };
})();

export function makeCoinMesh(type) {
  const m = COIN_MODELS[type];
  const mesh = new THREE.Mesh(m.geo, m.mats);
  const g = new THREE.Group(); g.add(mesh);
  g.userData.mesh = mesh;
  if (type === 'goriyaku' || type === 'noroi' || type === 'koban') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      color: type === 'noroi' ? 0x8a20ff : type === 'koban' ? 0xffc860 : 0xffd060,
      opacity: type === 'noroi' ? 0.8 : type === 'koban' ? 0.35 : 0.9,
    }));
    const sc = type === 'goriyaku' ? 2.6 : type === 'koban' ? 1.6 : 1.5;
    s.scale.set(sc, sc, 1); g.add(s); g.userData.glow = s;
  }
  return g;
}

// ---------- カラス ----------
const crowMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.3 });
export function makeCrow() {
  const g = new THREE.Group();
  blob(crowMat, 0, 0, 0, 0.45, 0.2, 0.22, g);
  blob(crowMat, 0.42, 0.1, 0, 0.17, 0.16, 0.16, g);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.4 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.66, 0.08, 0); g.add(beak);
  const eye = new THREE.Mesh(sphLow, MAT.urna); eye.scale.setScalar(0.025); eye.position.set(0.52, 0.16, 0.12); g.add(eye);
  const tail = blob(crowMat, -0.5, 0.02, 0, 0.25, 0.04, 0.14, g);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.35, 0, 0, -0.2, 0, 0.9, 0.15, 0, 0.75], 3));
  wingGeo.setIndex([0, 1, 2, 1, 3, 2]); wingGeo.computeVertexNormals();
  const wmat = crowMat.clone(); wmat.side = THREE.DoubleSide;
  const wl = new THREE.Mesh(wingGeo, wmat), wr = new THREE.Mesh(wingGeo, wmat);
  wr.scale.z = -1;
  const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); g.add(pl, pr);
  pl.position.z = 0.1; pr.position.z = -0.1;
  g.userData.wings = [pl, pr];
  return g;
}
