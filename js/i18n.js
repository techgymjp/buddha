// 日本語 / English
// 言語は ?lang=ja|en → 保存した設定 → 端末の言語 の順で決める

const DICT = {
  ja: {
    pageTitle: '空飛ぶ仏像',
    pageDesc: 'お金を吸い込め！仏の力で天まで昇れ！ 仏像が賽銭・小判・硬貨を吸い込み、そのエネルギーで天へ昇っていく3Dブラウザゲーム',
    catch: 'お金を吸い込め！<br>仏の力で天まで昇れ！',
    logo1: '空飛ぶ', logo2: '仏像',
    start: 'スタート', loading: '読み込み中 {p}%', finishing: '仕上げ中 {p}%',
    howBtn: '遊び方', langBtn: 'English',
    soundOn: '♪ 音あり', soundOff: '× 音なし',
    bestTitle: '最高到達 {m}m',
    hudMax: '最高高度', hudBest: '👑 ベスト', hudAlt: '高度', hudRise: '上昇',
    pause: '一時停止',
    howTitle: '遊び方',
    howRules: [
      '<i>↔</i><span><b>左右に動かす</b></span>',
      '<i>🪙</i><span><b>硬貨を吸って昇る</b></span>',
      '<i>🐦</i><span>落ちてもカラスを<b>踏めば大ジャンプ</b>（3連続で大仏に）</span>',
      '<i>⬇</i><span><b>下に落ちたらアウト</b></span>',
    ],
    lgZeni: '<b>銅銭</b>　↑',
    lgKoban: '<b>小判</b>　↑↑',
    lgGori: '<b>御利益コイン</b>　↑↑↑',
    lgCrow: '<b>八咫烏</b>　踏むと大仏に変身',
    evo: '',
    storm: '<b>賽銭の嵐</b>で大仏に変身！',
    close: '閉じる',
    resAlt: '到達高度', resMoney: '獲得した賽銭',
    templeBtn: 'お寺', templeTitle: 'お寺', walletLbl: 'お寺の財布', donate: '寄進する', built: '建立済み', inOrder: '順に建立', skinTitle: '仏像を選ぶ',
    bName: ['山門', '灯籠の参道', '本堂', '鐘楼', '五重塔', '大仏殿'],
    bEff: ['吸引範囲アップ・達磨を解放', 'お守り＋1（カラスに1回耐える）', '300mからスタート・白衣観音を解放', '硬貨の浮力アップ', '800mからスタート・吸引範囲アップ・不動明王を解放', 'お守り＋1'],
    skins: ['仏像（進化する）', '達磨', '白衣観音', '不動明王'],
    toTemple: 'お寺へ +¥{a}（財布 ¥{w}）',
    share: '📷 記録をシェア', shareText: '空飛ぶ仏像で {m}m まで昇った！ 称号：{r}',
    again: 'もう一度遊ぶ', toTitle: 'タイトルに戻る', resume: '再開',
    fell: '墜落…', crowHit: 'カラスに激突…',
    newBest: '最高到達高度 更新！', rankLabel: '称号：{r}',
    reached: '到達：{s}', bestLine: '最高到達 <b>{m}m</b>',
    stage: '第{n}天 {name}',
    stages: ['地上の寺院', '山頂', '雲海', '天空', '極楽浄土'],
    forms: ['木造仏', '黒漆の仏像', '光背の仏像', '鎌倉の大仏', '黄金の大仏'],
    giant: '巨大大仏',
    ranks: ['煩悩まみれ', '修行僧', '天部', '明王', '菩薩', '如来'],
    noglTitle: 'WebGLが使えません', noglText: 'このゲームは3D表示（WebGL）に対応したブラウザで遊べます。',
  },
  en: {
    pageTitle: 'Flying Buddha',
    pageDesc: 'Suck up the coins and rise to heaven with the power of the Buddha! A 3D browser game where a flying Buddha statue absorbs offerings to climb ever higher.',
    catch: 'Suck up the coins!<br>Ride Buddha power to heaven!',
    logo1: 'FLYING', logo2: 'BUDDHA',
    start: 'START', loading: 'Loading {p}%', finishing: 'Finishing {p}%',
    howBtn: 'How to play', langBtn: '日本語',
    soundOn: '♪ Sound on', soundOff: '× Sound off',
    bestTitle: 'Best altitude {m}m',
    hudMax: 'Max', hudBest: '👑 Best', hudAlt: 'Alt.', hudRise: '↑',
    pause: 'Paused',
    howTitle: 'How to play',
    howRules: [
      '<i>↔</i><span><b>Move left / right</b></span>',
      '<i>🪙</i><span><b>Suck up coins to climb</b></span>',
      '<i>🐦</i><span>Falling? <b>Stomp a crow to bounce</b> (3 in a row = giant Buddha)</span>',
      '<i>⬇</i><span><b>Fall off the bottom = out</b></span>',
    ],
    lgZeni: '<b>Copper coin</b>　↑',
    lgKoban: '<b>Koban</b>　↑↑',
    lgGori: '<b>Blessing coin</b>　↑↑↑',
    lgCrow: '<b>Golden crow</b>　stomp to become a giant Buddha',
    evo: '',
    storm: 'A <b>coin storm</b> turns you into a giant Buddha!',
    close: 'Close',
    resAlt: 'Altitude reached', resMoney: 'Offerings collected',
    templeBtn: 'Temple', templeTitle: 'Your Temple', walletLbl: 'Temple funds', donate: 'Donate', built: 'Built', inOrder: 'Build in order', skinTitle: 'Choose your statue',
    bName: ['Sanmon Gate', 'Lantern Path', 'Main Hall', 'Bell Tower', 'Five-story Pagoda', 'Great Buddha Hall'],
    bEff: ['Wider suction · unlocks Daruma', '+1 charm (survive one crow hit)', 'Start at 300m · unlocks White-robed Kannon', 'Stronger coin lift', 'Start at 800m · wider suction · unlocks Fudō Myōō', '+1 charm'],
    skins: ['Buddha (evolves)', 'Daruma', 'White-robed Kannon', 'Fudō Myōō'],
    toTemple: 'To the temple +¥{a} (funds ¥{w})',
    share: '📷 Share my record', shareText: 'I climbed to {m}m in Flying Buddha! Title: {r}',
    again: 'Play again', toTitle: 'Back to title', resume: 'Resume',
    fell: 'You fell…', crowHit: 'Hit by a crow…',
    newBest: 'New best altitude!', rankLabel: 'Title: {r}',
    reached: 'Reached: {s}', bestLine: 'Best altitude <b>{m}m</b>',
    stage: 'Heaven {n} · {name}',
    stages: ['Temple Grounds', 'Mountain Peak', 'Sea of Clouds', 'High Heavens', 'Pure Land'],
    forms: ['Wooden Buddha', 'Black Lacquer Buddha', 'Grand Halo Buddha', 'Great Buddha of Kamakura', 'Golden Great Buddha'],
    giant: 'Giant Great Buddha',
    ranks: ['Worldly Soul', 'Novice Monk', 'Deva', 'Wisdom King', 'Bodhisattva', 'Tathāgata'],
    noglTitle: 'WebGL is not available', noglText: 'This game needs a browser that supports 3D graphics (WebGL).',
  },
};

function detect() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ja' || q === 'en') return q;
  try { const s = localStorage.getItem('flyingBuddha3d.lang'); if (s === 'ja' || s === 'en') return s; } catch (e) { /* ignore */ }
  return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export let lang = detect();

// 文字列を取り出す（{name} を差し込む）
export function t(key, vars = {}) {
  let v = DICT[lang][key];
  if (v == null) v = DICT.ja[key];
  if (typeof v !== 'string') return v;
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem('flyingBuddha3d.lang', l); } catch (e) { /* ignore */ }
  applyStatic();
}

// HTML の固定の文字を差し替える（data-i18n / data-i18n-html）
export function applyStatic() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  const desc = document.querySelector('meta[name="description"]'); if (desc) desc.content = t('pageDesc');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  const rules = document.getElementById('rules');
  if (rules) rules.innerHTML = t('howRules').map((r) => `<li>${r}</li>`).join('');
  document.body.classList.toggle('lang-en', lang === 'en');
}
