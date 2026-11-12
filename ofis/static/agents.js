// Ajan Ofisi · agents.js
'use strict';
// ======================================================================
//  Karakterler
// ======================================================================
// label: ofiste görünen komik Türkçe ad. Anahtar (Claude, Argon…) iş yönlendirmesinde kullanılır, değişmez.
// Patron (ofisi kullanan kişi): iç anahtar sabit, görünen ad ayarlardaki "owner" alanından gelir.
const OWNER = 'Patron';
const PRESET = {
  Claude: { label: 'Kâhya Klod', shirt: '#ff6fb5', pants: '#4b3f72', hair: '#6b4232', skin: '#f6cfb4', style: 'short', tie: '#7c3aed', role: 'Yönetici · Claude Code', desk: MANAGER_DESK },
  Argon:  { label: 'Pikselci Pakize', shirt: '#8b5cf6', pants: '#3f3566', hair: '#2a1f45', skin: '#e9b896', style: 'long', phones: '#ff6fb5', role: 'Argon · Gemini 4 · görsel ve tasarım', desk: SEATS[0] },
  Opus:   { label: 'Okumuş Opuz Hoca', shirt: '#f6a04d', pants: '#5a4466', hair: '#8a4f2c', skin: '#f6d6bd', style: 'bun', glasses: true, role: 'Opus · Claude Opus 5.5 · zor kod işleri', desk: SEATS[1] },
  Sonnet: { label: 'Şipşak Sönmez', shirt: '#34c3a0', pants: '#3a4f63', hair: '#e2dcef', skin: '#dda983', style: 'spiky', glasses: true, role: 'Sonnet · Claude Sonnet 5.5 · hızlı kod işleri', desk: SEATS[2] },
  [OWNER]: { label: OWNER, shirt: '#5b6cff', pants: '#2f2a4a', hair: '#2a1f1a', skin: '#e8b994', style: 'short', hat: '#ff6fb5', hoodie: true, role: 'Patron · işleri o verir' },
  // ekip toplantısı uzmanları (masaları yok; toplantı odasında otururlar)
  'Mimar':    { label: 'Mimar Sinan Jr.', shirt: '#6366f1', pants: '#3f3566', hair: '#3b2418', skin: '#f1c7a5', style: 'short', glasses: true, role: 'Mimar · yazılım mimarı', desk: null },
  'Ürün':     { label: 'Pazarcı Pembe', shirt: '#f472b6', pants: '#4b3f72', hair: '#7a4b2a', skin: '#e9b896', style: 'curly', role: 'Ürün · ürün yöneticisi', desk: null },
  'Tasarım':  { label: 'Renkli Rengin', shirt: '#a855f7', pants: '#3f3566', hair: '#d9a25a', skin: '#f6d6bd', style: 'ponytail', phones: '#34c3a0', role: 'Tasarım · UI/UX ve marka', desk: null },
  'Güvenlik': { label: 'Bekçi Bekir', shirt: '#64748b', pants: '#2f2a4a', hair: '#2a1f1a', skin: '#d39a74', style: 'short', hat: '#334155', role: 'Güvenlik · güvenlik uzmanı', desk: null },
  'Kalite':   { label: 'Titiz Tülin', shirt: '#22c55e', pants: '#3a4f63', hair: '#5a3a2e', skin: '#efc3a2', style: 'bun', glasses: true, role: 'Kalite · test ve kalite', desk: null },
  'DevOps':   { label: 'Sunucu Sungur', shirt: '#0ea5e9', pants: '#3a4f63', hair: '#2a1f45', skin: '#e8b994', style: 'spiky', phones: '#ff6fb5', role: 'DevOps · performans ve altyapı', desk: null },
  'Raportör': { label: 'Katip Kâmil', shirt: '#fb923c', pants: '#4b3f72', hair: '#4a3426', skin: '#f6cfb4', style: 'long', glasses: true, role: 'Raportör · toplantı tutanağı', desk: null },
};
// Claude Code alt ajanları (stajyerler) sırayla bu adları alır
const INTERN_NAMES = ['Çaycı Çetin', 'Ayakçı Ayhan', 'Fotokopici Fikret', 'Meraklı Mahmut', 'Acemi Ahmet', 'Telaşlı Tülay',
  'Uykucu Ufuk', 'Lafazan Leman', 'Şaşkın Şükrü', 'Simitçi Selim', 'Dalgın Dilek', 'Kaytarık Kaya'];
// Ofiste görünen ad: karakterin etiketi, yoksa hazır etiketi, yoksa kendi adı
const nick = name => (CHARS.get(name) && CHARS.get(name).label) || (PRESET[name] && PRESET[name].label) || name;
const INTERN_LOOKS = [
  { shirt: '#7cc4ff', style: 'ponytail', hair: '#d9a25a' }, { shirt: '#ffa6c9', style: 'curly', hair: '#3b2418' },
  { shirt: '#b9a6ff', style: 'short', hair: '#5a3a2e', hat: '#34c3a0' }, { shirt: '#7fe0c4', style: 'long', hair: '#7a4b2a' },
  { shirt: '#ffc98b', style: 'spiky', hair: '#2a1f45' },
];

const CHARS = new Map();
const INTERNS = new Map();
let internNo = 0;

function freeDesk() {
  const used = new Set([...CHARS.values()].map(c => c.desk));
  return SEATS.find(d => !used.has(d)) || null;
}
function freeHotSeat() {
  const used = new Set([...CHARS.values()].map(c => c.hot));
  return HOT_SEATS.find(s => !used.has(s)) || HOT_SEATS[0];
}

function ensureChar(name, model, extra) {
  if (!name) name = 'Ajan';
  if (CHARS.has(name)) return CHARS.get(name);
  const h = hashNum(name);
  const p = PRESET[name] || { shirt: `hsl(${h % 360} 70% 70%)`, pants: '#4b3f72', hair: '#4a3426', skin: '#efc3a2', style: 'short', role: model || 'agy ajanı' };
  const c = Object.assign({
    name, ...p, desk: p.desk === undefined ? freeDesk() : p.desk, x: 0, y: 0, dir: 'down', moving: false, seated: false, lounge: false,
    path: [], queue: [], cur: null, at: null, bubble: null, active: new Set(), title: '', step: '', queued: 0,
    busyUntil: 0, busyLabel: '', nextIdle: performance.now() + rand(2000, 9000), phase: (h % 100) / 17, chatUntil: 0, chatCool: 0, mug: false,
  }, extra || {});
  if (/^#/.test(c.shirt)) { c.shirtS = shade(c.shirt, -0.18); c.shirtL = shade(c.shirt, 0.35); } else { c.shirtS = c.shirt; c.shirtL = '#ffffff'; }
  c.skinS = shade(c.skin, -0.12); c.hairS = shade(c.hair, -0.2); c.hairL = shade(c.hair, 0.25); c.pantsS = shade(c.pants, -0.2);
  if (!c.desk && !c.hot && c.temp) c.hot = freeHotSeat();
  if (c.spawnAt) { c.x = c.spawnAt.x; c.y = c.spawnAt.y; c.at = c.spawnAt; }
  else { const s = seatSpot(c); c.x = s.x; c.y = s.y; c.at = s; c.seated = !!s.seat; }
  c.el = document.createElement('div'); c.el.className = 'who';
  c.el.innerHTML = `<div class="bubble" hidden></div><div class="tag" style="--c:${c.shirt}">${esc(c.label || name)}</div>`;
  c.elBubble = c.el.firstChild;
  ov.appendChild(c.el);
  CHARS.set(name, c);
  return c;
}
function removeChar(c) { releasePoi(c); c.el.remove(); CHARS.delete(c.name); }

const seatSpot = c => c.desk ? { x: c.desk.deskX - 6, y: c.desk.deskY - 3, seat: true, face: 'down' }
  : c.hot ? { ...c.hot } : c.name === OWNER ? POIS[5].spot : { x: 200, y: 140, face: 'down' };
const visitSpot = c => c.desk ? { ...c.desk.visit } : c.hot ? { x: c.hot.x + (c.hot.face === 'left' ? 10 : -10), y: c.hot.y, face: c.hot.face === 'left' ? 'left' : 'right' } : { x: c.x + 12, y: c.y, face: 'left' };
const near = (c, s) => Math.abs(c.x - s.x) < 1 && Math.abs(c.y - s.y) < 1;
const working = (c, now) => c.active.size > 0 || c.busyUntil > now;
function releasePoi(c) { POIS.forEach(p => { if (p.by === c.name) p.by = null; }); }

// eylemler
const goto = spot => ({
  isGoto: true,
  start(c) {
    releasePoi(c); c.seated = false; c.lounge = false; c.mug = false; c.playing = false; c.book = false;
    c.path = (c.at && near(c, spot) && near(c, c.at)) ? [] : findPath(c.x, c.y, spot);
    c.at = null;
    if (spot.poi) spot.poi.by = c.name;
  },
  update(c, dt) {
    if (step(c, dt)) {
      c.at = spot; c.dir = spot.face || 'down'; c.moving = false;
      if (spot.seat) c.seated = true;
      if ((spot.poi && spot.poi.lounge) || spot.sit) c.lounge = true;   // kanepe, tabure, toplantı sandalyesi
      if (spot.poi && spot.poi.mug) c.mug = true;
      if (spot.poi && spot.poi.play) c.playing = true;
      if (spot.poi && spot.poi.book) c.book = true;
      if (spot.poi && spot.poi.social) trySocial(c);
      if (typeof onArrive === 'function') onArrive(c, spot);
      return true;
    }
    return false;
  },
});
const wait = s => ({ start(c, now) { this.t = now + s * 1000; }, update(c, dt, now) { return now >= this.t; } });
const say = (text, s, kind) => ({ start(c, now) { c.bubble = { text, kind, until: now + s * 1000 }; }, update: () => true });
const call = fn => ({ start(c) { fn(c); }, update: () => true });

function step(c, dt) {
  if (!c.path.length) { c.moving = false; return true; }
  const p = c.path[0], dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), s = SPEED * dt;
  if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left'; else if (d > 0) c.dir = dy > 0 ? 'down' : 'up';
  if (d <= s) { c.x = p.x; c.y = p.y; c.path.shift(); } else { c.x += dx / d * s; c.y += dy / d * s; }
  c.moving = true;
  return !c.path.length;
}
function interrupt(c) { c.queue = []; c.chatUntil = 0; if (c.cur && !c.cur.isGoto) c.cur = null; }

function planIdle(c) {
  if (c.name === OWNER) { c.queue.push(wait(10)); return; }
  const r = Math.random();
  if ((c.name === 'Claude' && r < 0.5) || r < 0.22) { c.queue.push(goto(seatSpot(c)), wait(rand(6, 14))); return; }
  const free = POIS.filter(p => !p.by || p.by === c.name);
  if (!free.length) { c.queue.push(wait(3)); return; }
  // sosyal yerlere biraz daha sık git
  const social = free.filter(p => p.social);
  const p = (social.length && Math.random() < 0.55) ? pick(social) : pick(free);
  c.queue.push(goto(p.spot));
  if (Math.random() < 0.4) c.queue.push(say(pick(p.say), 2.6));
  c.queue.push(wait(rand(5, 11)));
}

function tick(c, dt, now) {
  if (!c.cur && c.queue.length) { c.cur = c.queue.shift(); c.cur.start(c, now); }
  if (c.cur) { if (c.cur.update(c, dt, now)) c.cur = null; return; }
  if (c.chatUntil > now) return;
  if (c.hosting) return;                 // toplantıyı yönetiyor: ekran başında kalır
  if (c.temp && !c.active.size) return;
  if (working(c, now)) {
    if (!c.seated) {
      const s = seatSpot(c);
      if (near(c, s)) c.seated = !!s.seat; else c.queue.push(goto(s));
    }
    return;
  }
  if (c.name === OWNER && c.leaveAt && now > c.leaveAt) { c.leaveAt = 0; c.queue.push(say('Görüşürüz!', 2, 'pink'), goto(ENTRANCE), call(removeChar)); return; }
  if (now >= c.nextIdle) planIdle(c);
}

// ---------- mola sohbetleri (gerçek işlerden) ----------
function lastJobOf(name) {
  let best = null;
  for (const j of jobs.values()) if (j.end && j.end.agent === name && (!best || String(j.end.ts) > String(best.end.ts))) best = j;
  return best;
}
function opener(c) {
  if (c.name === 'Claude') return pick(['Ekip bugün harika gidiyor', 'Yeni işler yolda', 'Kahveden sonra inceleme var']);
  if (c.name === OWNER) return pick(['Nasıl gidiyor ekip?', 'Bugün neler bitti?']);
  const j = lastJobOf(c.name);
  if (!j) return pick(['Bugün sakin', 'Yeni iş bekliyorum', 'Kahve iyi gelir']);
  const t = short(j.end.title, 34), imgs = (j.end.files || []).filter(f => f.kind === 'image').length;
  const opts = [`Az önce "${t}" işini bitirdim`, `"${t}" ${j.end.seconds || 0} saniye sürdü`];
  if (imgs) opts.push(`${imgs} görsel ürettim, galeride duruyor`);
  if (j.end.type !== 'done') opts.push(`"${t}" işinde takıldım`);
  return pick(opts);
}
function reply(c) {
  const opts = ['Eline sağlık!', 'Süper iş', 'Klod Abi kesin onaylar'];
  const j = lastJobOf(c.name);
  if (j && j.end.type === 'done') opts.push(`Ben de "${short(j.end.title, 28)}" yaptım`);
  if (c.name === 'Argon') opts.push('Haftalık kotama dikkat etmeliyim');
  if (c.name === 'Sonnet') opts.push('Ben hızlıca hallettim bugün');
  if (c.name === 'Opus') opts.push('Zor işler bende, sorun yok');
  return pick(opts);
}
function trySocial(c) {
  const now = performance.now();
  if (c.chatCool > now || working(c, now)) return;
  for (const d of CHARS.values()) {
    if (d === c || d.moving || d.cur || d.queue.length || d.chatCool > now || working(d, now)) continue;
    if (!d.at || !d.at.poi || !d.at.poi.social) continue;
    if (Math.hypot(d.x - c.x, d.y - c.y) > 70) continue;
    c.chatCool = d.chatCool = now + 45000;
    c.chatUntil = d.chatUntil = now + 9000;
    c.dir = d.x > c.x ? 'right' : 'left'; d.dir = c.x > d.x ? 'right' : 'left';
    c.queue.push(say(opener(c), 3.2, 'chat'), wait(3.4), wait(3.4), say(reply(c), 2.8, 'chat'), wait(3));
    d.queue.push(wait(3.2), say(reply(d), 3, 'chat'), wait(3.6), say(opener(d), 3, 'chat'), wait(3));
    return;
  }
}

