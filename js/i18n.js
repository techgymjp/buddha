// 日本語 / English
// 言語は ?lang=ja|en → 保存した設定 → 端末の言語 の順で決める

const DICT = {
  ja: {
    pageTitle: '空飛ぶ仏像',
    pageDesc: 'お金を吸い込め！仏の力で天まで昇れ！ 仏像が賽銭・小判・硬貨を吸い込み、そのエネルギーで天へ昇っていく3Dブラウザゲーム',
    catch: 'お金を吸い込め！<br>仏の力で天まで昇れ！',
    logo1: '空飛ぶ', logo2: '仏像',
    start: 'スタート', loading: '読み込み中 {p}%',
    howBtn: '遊び方', langBtn: 'English',
    soundOn: '♪ 音あり', soundOff: '× 音なし',
    bestTitle: '最高到達 {m}m',
    hudMax: '最高高度', hudBest: '👑 ベスト', hudAlt: '高度', hudRise: '上昇',
    pause: '一時停止',
    howTitle: '遊び方',
    howRules: [
      '操作は<b>左右の移動だけ</b>（スワイプ／PCは ← →）。硬貨は<b>自動で吸い込む</b>',
      '上に連なる<b>硬貨の道をたどって</b>吸い込むほど加速して昇る',
      'お金を吸うたびに<b>加速</b>。連続で吸うほど加速が強くなる',
      '仏像には<b>重力</b>がかかり、硬貨を吸うと<b>逆重力</b>で押し上げられる。取らないと落ちていき、<b>画面の下まで落ちたらアウト</b>',
      '<b>カラス</b>は決まった高さを横切って飛ぶ。落ちながら<b>上から踏みつける</b>と撃ち落としてジャンプ（浮力アップ）。下や横からぶつかると即アウト！',
    ],
    lgZeni: '<b>銅銭</b>（天保通寳）<br>¥10・少し加速',
    lgKoban: '<b>小判</b><br>¥300・大きく加速',
    lgGori: '<b>黄金の御利益コイン</b><br>加速度が増して超加速・吸引範囲アップ',
    lgCrow: '<b>カラス</b><br>決まった高さを横切る。上から踏むと撃ち落としてジャンプ。下や横からぶつかると即アウト',
    evo: '木造仏 → 黒漆の仏像 → 光背の巨大化 → 鎌倉の大仏 → 黄金の大仏',
    storm: 'ステージ終盤の<b>賽銭の嵐</b>で14枚吸い込むと<b>巨大な大仏</b>に変身！',
    close: '閉じる',
    resAlt: '到達高度', resMoney: '獲得した賽銭',
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
    start: 'START', loading: 'Loading {p}%',
    howBtn: 'How to play', langBtn: '日本語',
    soundOn: '♪ Sound on', soundOff: '× Sound off',
    bestTitle: 'Best altitude {m}m',
    hudMax: 'Max', hudBest: '👑 Best', hudAlt: 'Alt.', hudRise: '↑',
    pause: 'Paused',
    howTitle: 'How to play',
    howRules: [
      'You only <b>move left and right</b> (swipe / ← → on PC). Coins are <b>sucked in automatically</b>',
      '<b>Follow the trail of coins</b> above you — the more you absorb, the faster you climb',
      'Every coin gives a <b>boost</b>, and chains of coins boost even harder',
      '<b>Gravity</b> pulls the statue down; coins give it <b>anti-gravity</b>. Miss them and you fall — <b>drop off the bottom of the screen and it’s over</b>',
      '<b>Crows</b> fly across at fixed heights. <b>Stomp them from above</b> while falling to knock them out and bounce up. Hit one from below or the side and it’s game over!',
    ],
    lgZeni: '<b>Copper coin</b> (Tenpō Tsūhō)<br>¥10 · small boost',
    lgKoban: '<b>Koban gold piece</b><br>¥300 · big boost',
    lgGori: '<b>Golden blessing coin</b><br>stronger lift, super boost, wider suction',
    lgCrow: '<b>Crow</b><br>crosses at a fixed height. Stomp from above to bounce; hit from below or the side and you’re out',
    evo: 'Wooden → Black Lacquer → Grand Halo → Great Buddha of Kamakura → Golden Great Buddha',
    storm: 'In the <b>coin storm</b> before each new stage, absorb 14 coins to transform into a <b>giant Great Buddha</b>!',
    close: 'Close',
    resAlt: 'Altitude reached', resMoney: 'Offerings collected',
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
