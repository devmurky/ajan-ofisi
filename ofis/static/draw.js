// Ajan Ofisi · draw.js
'use strict';
// ======================================================================
//  Çizim: arka plan (statik)
// ======================================================================
function P(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
function drawBackground() {
  const b = bg.getContext('2d');
  const R = (x, y, w, h, col) => { b.fillStyle = col; b.fillRect(x, y, w, h); };
  // ofis zemini: pastel parke
  for (let y = WALL; y < H; y += 6) {
    const off = ((y / 6) % 3) * 13;
    for (let x = -off; x < W; x += 40) { R(x, y, 40, 6, ((x + off) / 40 + y / 6) % 2 ? '#f7eaf3' : '#f4e4ef'); R(x, y + 5, 40, 1, '#ecd7e6'); R(x + 39, y, 1, 6, '#ecd7e6'); }
  }
  // mutfak: dama karo
  for (let y = WALL; y < 144; y += 8) for (let x = 0; x < 96; x += 8) R(x, y, 8, 8, ((x + y) / 8) % 2 ? '#ffffff' : '#fde3f1');
  R(96, WALL, 1, 96, '#f0d6e8');
  // toplantı odası halısı
  R(300, WALL, 84, 100, '#ece4ff');
  for (let y = WALL + 4; y < 148; y += 8) for (let x = 302; x < 384; x += 8) R(x, y, 1, 1, '#ddd0fb');
  // oturma köşesi halısı
  R(4, 186, 88, 46, '#ffd6eb'); R(6, 188, 84, 42, '#ffe6f3');
  for (let x = 10; x < 88; x += 6) { R(x, 192, 2, 2, '#ffc4e1'); R(x + 3, 224, 2, 2, '#ffc4e1'); }
  // giriş paspası
  R(98, 48, 20, 5, '#ff9fd0'); R(100, 49, 16, 3, '#ffb8dc');

  // duvar
  R(0, 0, W, WALL, '#e8defc');
  for (let x = 0; x < W; x += 12) R(x, 0, 6, 30, '#e4d8fb');
  R(0, 30, W, 14, '#f4efff'); R(0, 30, W, 1, '#d9ccf7');
  for (let x = 4; x < W; x += 24) R(x, 33, 16, 8, '#efe8ff');
  R(0, 44, W, 4, '#cbb8f7'); R(0, 44, W, 1, '#ddd0fb');
  R(0, 0, W, 2, '#d3c4f6');
  // mutfak duvarı karoları
  for (let y = 18; y < 34; y += 4) for (let x = 0; x < 74; x += 6) R(x + ((y / 4) % 2) * 3, y, 5, 3, '#fff3fa');
  // pencere çerçeveleri (gökyüzü her karede çizilir)
  for (const [wx, wy, ww, wh] of WINDOWS) {
    R(wx - 3, wy - 3, ww + 6, wh + 6, '#ffffff'); R(wx - 2, wy - 2, ww + 4, wh + 4, '#efe8ff');
    R(wx - 5, wy + wh + 2, ww + 10, 3, '#ffffff'); R(wx - 5, wy + wh + 5, ww + 10, 1, '#d9ccf7');
  }
  // perdeler
  for (const [wx, wy, ww, wh] of WINDOWS.slice(1)) {
    for (let i = 0; i < 4; i++) { R(wx - 9 + i, wy - 4, 1, wh + 8, i % 2 ? '#ffc1df' : '#ffb3d6'); R(wx + ww + 5 + i, wy - 4, 1, wh + 8, i % 2 ? '#ffc1df' : '#ffb3d6'); }
    R(wx - 10, wy - 6, ww + 20, 2, '#cbb8f7');
  }
  // giriş kapısı
  R(98, 12, 20, 34, '#cbb8f7'); R(100, 14, 16, 32, '#ffffff'); R(102, 17, 12, 10, '#e9f4ff'); R(102, 17, 12, 1, '#d4e8ff');
  R(112, 31, 2, 2, '#ff6fb5'); R(100, 14, 16, 1, '#f3edff');
  // beyaz tahta
  R(174, 7, 44, 26, '#cbb8f7'); R(176, 9, 40, 22, '#ffffff');
  R(180, 13, 16, 2, '#8b5cf6'); R(180, 17, 24, 2, '#ff6fb5'); R(180, 21, 12, 2, '#34c3a0'); R(194, 25, 18, 2, '#f6a04d');
  R(204, 12, 9, 7, '#f3edff'); R(205, 13, 7, 1, '#b9a6ec'); R(205, 15, 5, 1, '#b9a6ec');
  R(178, 31, 36, 2, '#e2d8f8'); R(196, 30, 6, 1, '#ff6fb5');
  // saat
  R(219, 9, 18, 11, '#ffffff'); R(220, 10, 16, 9, '#fff0f8');
  // toplantı odası duvar tablosu
  R(303, 10, 10, 14, '#ffffff'); R(304, 11, 8, 12, '#ffd1e8'); R(306, 14, 4, 4, '#8b5cf6');
  R(368, 10, 12, 10, '#ffffff'); R(369, 11, 10, 8, '#d8f3ff'); R(371, 15, 6, 3, '#34c3a0');
  // bölge yazıları için küçük tabelalar
  R(4, 4, 22, 7, '#ffffff'); R(5, 5, 20, 5, '#ff8cc6');
  R(330, 38, 22, 4, '#8b5cf6');
}
const WINDOWS = [[36, 8, 32, 18], [124, 6, 46, 26], [238, 6, 46, 26]];

// ======================================================================
//  Çizim: dinamik öğeler
// ======================================================================
function skyAt(h) {
  const mode = (settings && settings.sky) || 'auto';
  if (mode === 'day') h = 12; else if (mode === 'night') h = 23;
  if (raining() && h >= 6 && h < 20) return { top: '#9aa6c9', bot: '#c8cfe3', night: false, rain: true };
  if (h >= 6 && h < 8) return { top: '#ffc6d9', bot: '#ffe8d6', night: false };
  if (h >= 8 && h < 17) return { top: '#a9d6ff', bot: '#e6f4ff', night: false };
  if (h >= 17 && h < 20) return { top: '#ff9fc6', bot: '#ffd2b0', night: false };
  return { top: '#2e2463', bot: '#4b3a8a', night: true };
}
function drawWindows(t, sky) {
  for (const [wx, wy, ww, wh] of WINDOWS) {
    g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
    const grd = g.createLinearGradient(0, wy, 0, wy + wh); grd.addColorStop(0, sky.top); grd.addColorStop(1, sky.bot);
    g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
    if (sky.night) {
      for (let i = 0; i < 6; i++) { const sx = wx + ((i * 37 + wx) % ww), sy = wy + ((i * 13) % (wh - 4)) + 1; P(sx, sy, 1, 1, (Math.floor(t * 2 + i) % 5) ? '#ffffff' : '#ffd1e8'); }
      P(wx + ww - 10, wy + 4, 5, 5, '#fff6d6'); P(wx + ww - 9, wy + 4, 4, 1, '#ffffff');
    } else {
      for (let i = 0; i < 3; i++) {
        const cx = wx + ((t * (3 + i) + i * 47 + wx * 3) % (ww + 30)) - 18, cy = wy + 3 + i * 6;
        P(cx, cy + 2, 16, 3, '#ffffff'); P(cx + 3, cy, 8, 3, '#ffffff'); P(cx + 2, cy + 4, 12, 1, '#f1f7ff');
      }
      // binalar silüeti
      for (let x = wx; x < wx + ww; x += 7) { const bh = 3 + ((x * 7) % 6); P(x, wy + wh - bh, 6, bh, 'rgba(155,135,220,.35)'); }
    }
    if (raining()) drawRain(t, wx, wy, ww, wh);
    if (seasonOn()) for (let i = 0; i < 4; i++) P(wx + ((i * 13 + Math.floor(t * 6)) % ww), wy + ((i * 5 + Math.floor(t * 9)) % wh), 1, 1, '#ffffff');
    g.restore();
    P(wx + ww / 2 - 1, wy, 2, wh, '#ffffff'); P(wx, wy + wh / 2 - 1, ww, 2, '#ffffff');
  }
}

// Toplantı ekranı: bugün biten işler, ajan başına bir sütun (5 saniyede bir yeniden sayılır)
let tvCache = { at: 0, bars: [] };
function todayBars() {
  const now = performance.now();
  if (now - tvCache.at < 5000) return tvCache.bars;
  const today = new Date().toDateString(), counts = new Map();
  for (const j of jobs.values()) {
    if (!j.end || j.end.type !== 'done' || new Date(j.end.ts).toDateString() !== today) continue;
    if (typeof visibleJob === 'function' && !visibleJob(j)) continue;
    counts.set(j.end.agent, (counts.get(j.end.agent) || 0) + 1);
  }
  tvCache = { at: now, bars: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
  return tvCache.bars;
}
function drawTV(t, meetingOn) {
  P(316, 7, 48, 28, '#4b3f72'); P(318, 9, 44, 24, meetingOn ? '#fff0f8' : '#f6f1ff');
  // ekip toplantısı sürerken: uzman başına bir kutu (gri bekliyor, pembe inceliyor, yeşil bitti, kırmızı hata)
  if (typeof currentMeeting !== 'undefined' && currentMeeting) {
    const rs = [...currentMeeting.roles.values()];
    const cols = { waiting: '#d8cdf4', running: Math.floor(t * 3) % 2 ? '#ff6fb5' : '#ffb8dc', done: '#34c3a0', blocked: '#f6a04d', fail: '#e0446a', cancelled: '#b9a6ec' };
    rs.forEach((r, i) => {
      const x = 321 + (i % 4) * 10, y = 12 + Math.floor(i / 4) * 9;
      P(x, y, 8, 7, cols[r.state] || '#d8cdf4');
      if (r.reporter) P(x + 2, y + 2, 4, 3, '#ffffff');
    });
    const done = rs.filter(r => r.state === 'done').length;
    P(320, 30, 40, 2, '#e9dfff'); P(320, 30, Math.round(40 * done / Math.max(1, rs.length)), 2, '#8b5cf6');
    P(338, 35, 4, 3, '#4b3f72');
    return;
  }
  const bars = todayBars();
  if (bars.length) {
    const max = Math.max(...bars.map(b => b[1]));
    const bw = Math.min(7, Math.floor(36 / bars.length) - 2);
    bars.forEach(([agent, n], i) => {
      const h = Math.max(2, Math.round(n / max * 17));
      const col = (CHARS.get(agent) || PRESET[agent] || {}).shirt || '#b9a6ec';
      P(322 + i * (bw + 2), 29 - h, bw, h, /^#/.test(col) ? col : '#b9a6ec');
    });
    P(320, 30, 40, 1, '#cbb8f7');
    if (meetingOn && Math.floor(t * 2) % 2) P(356, 11, 3, 3, '#ff6fb5');
  } else {
    P(330, 15, 20, 10, '#d9ccf7'); P(334, 18, 12, 4, '#ffffff');
  }
  P(338, 35, 4, 3, '#4b3f72');
}

// ---------- ortam: mevsim ışıkları, yağmur, gün ışığı ----------
const LIGHT_COLS = ['#ff6fb5', '#8b5cf6', '#34c3a0', '#f6a04d', '#7cc4ff'];
function seasonOn() {
  const s = (settings && settings.season) || 'auto';
  return s === 'on' || (s === 'auto' && [11, 0, 1].includes(new Date().getMonth()));
}
function drawSeasonLights(t) {
  if (!seasonOn()) return;
  for (let x = 4, i = 0; x < W; x += 9, i++) {
    const sag = Math.round(Math.sin(i * 1.3) * 1);
    P(x, 4 + sag, 6, 1, '#7c6aa8');
    const on = (Math.floor(t * 2) + i) % 3 !== 0;
    P(x + 2, 5 + sag, 2, 2, on ? LIGHT_COLS[i % LIGHT_COLS.length] : '#d8cdf4');
  }
}
function raining() { return ((settings && settings.weather) || 'clear') === 'rain'; }
function drawRain(t, wx, wy, ww, wh) {
  g.fillStyle = 'rgba(255,255,255,.6)';
  for (let i = 0; i < 9; i++) {
    const x = wx + ((i * 11 + Math.floor(t * 40) * (1 + i % 3)) % ww), y = wy + ((i * 7 + Math.floor(t * 90)) % wh);
    g.fillRect(x, y, 1, 3);
  }
}
function daylightTint(h) {
  const s = (settings && settings.sky) || 'auto';
  if (s !== 'auto') return null;
  if (h >= 6 && h < 10) return 'rgba(255,190,150,.05)';
  if (h >= 17 && h < 20) return 'rgba(255,120,180,.07)';
  return null;
}

function drawSteam(x, y, t, seed) {
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.2 + i / 3 + seed) % 1;
    const sx = x + Math.round(Math.sin((ph + i) * 6) * 1.5), sy = y - Math.round(ph * 7);
    g.fillStyle = `rgba(255,255,255,${0.85 * (1 - ph)})`; g.fillRect(sx, sy, 1, 1);
  }
}

// ---------- mobilya (derinliğe göre sıralanır) ----------
function drawCounter(t) {
  P(0, 34, 74, 4, '#ffffff'); P(0, 34, 74, 1, '#fdfbff'); P(0, 38, 74, 20, '#c9b3f5'); P(0, 57, 74, 1, '#ad93ec');
  for (let x = 2; x < 72; x += 18) { P(x, 40, 16, 15, '#d4c2f8'); P(x + 13, 46, 1, 4, '#8b5cf6'); }
  // kahve makinesi
  P(11, 18, 16, 16, '#6a5a9c'); P(12, 19, 14, 6, '#8d7cc4'); P(14, 21, 3, 2, '#ff6fb5'); P(19, 21, 3, 2, '#7fe0c4');
  P(13, 27, 12, 1, '#4b3f72'); P(17, 28, 4, 6, '#3b2a5c'); P(16, 30, 6, 4, '#ffffff'); P(17, 31, 4, 2, '#8a4f2c');
  drawSteam(19, 29, t, 0.1);
  // lavabo, meyve kasesi, kettle
  P(46, 34, 14, 3, '#e6eef8'); P(52, 29, 2, 5, '#cfd8e6'); P(52, 29, 5, 1, '#cfd8e6');
  P(32, 30, 8, 4, '#ffffff'); P(33, 28, 2, 2, '#ff6fb5'); P(36, 28, 2, 2, '#f6a04d'); P(35, 27, 2, 2, '#7fe0c4');
  P(64, 27, 7, 7, '#ff8cc6'); P(65, 25, 5, 2, '#ff6fb5'); P(71, 29, 2, 2, '#ff8cc6');
}
function drawFridge() {
  P(75, 12, 20, 46, '#d8cdf4'); P(76, 13, 18, 44, '#ffffff'); P(76, 28, 18, 1, '#e2d8f8');
  P(91, 17, 1, 8, '#cbb8f7'); P(91, 32, 1, 12, '#cbb8f7');
  P(79, 16, 3, 3, '#ff6fb5'); P(84, 18, 2, 3, '#8b5cf6'); P(80, 34, 6, 4, '#fff3a6');
}
function drawKitchenTable() {
  P(36, 106, 26, 2, 'rgba(109,40,217,.10)');
  P(34, 94, 28, 5, '#ffffff'); P(34, 98, 28, 1, '#e2d8f8'); P(46, 99, 4, 8, '#cbb8f7'); P(42, 106, 12, 2, '#cbb8f7');
  P(39, 91, 3, 3, '#ff9fd0'); P(53, 92, 4, 2, '#ffffff'); P(54, 90, 2, 2, '#7fe0c4');
}
function drawStools() {
  for (const x of [26, 66]) { P(x - 3, 104, 8, 2, '#ff8cc6'); P(x, 106, 2, 5, '#cbb8f7'); }
}
function drawSofa() {
  P(10, 186, 58, 2, 'rgba(109,40,217,.12)');
  P(10, 166, 56, 10, '#ff8cc6'); P(10, 166, 56, 2, '#ffa6d3');
  P(12, 176, 52, 9, '#ffa6d3'); P(12, 176, 52, 2, '#ffbfdf');
  for (const x of [28, 46]) P(x, 168, 1, 8, '#f472b6');
  P(7, 170, 6, 15, '#f472b6'); P(63, 170, 6, 15, '#f472b6'); P(7, 170, 6, 2, '#ff8cc6'); P(63, 170, 6, 2, '#ff8cc6');
  P(15, 169, 8, 6, '#c4b5fd'); P(53, 169, 8, 6, '#7fe0c4');
}
function drawCoffeeTable(t) {
  P(22, 194, 32, 4, '#ffffff'); P(22, 197, 32, 1, '#e2d8f8'); P(24, 198, 2, 7, '#cbb8f7'); P(50, 198, 2, 7, '#cbb8f7');
  P(27, 191, 8, 3, '#8b5cf6'); P(28, 190, 8, 1, '#ff6fb5'); P(44, 190, 3, 4, '#ffffff'); drawSteam(45, 189, t, 0.6);
}
function drawArcade(t) {
  P(72, 188, 16, 34, '#7c3aed'); P(72, 188, 16, 3, '#ff6fb5'); P(74, 192, 12, 10, '#2a1f45');
  const k = Math.floor(t * 3) % 4;
  P(76, 194 + k, 3, 2, '#ff6fb5'); P(81, 198 - k, 3, 2, '#7fe0c4'); P(75, 200, 10, 1, '#8b5cf6');
  P(74, 204, 12, 4, '#a78bfa'); P(76, 205, 2, 2, '#ff6fb5'); P(81, 205, 2, 2, '#fff3a6');
  P(74, 210, 12, 12, '#6d28d9');
}
function drawBookshelf() {
  P(0, 146, 12, 54, '#d8c6f8'); P(0, 146, 12, 2, '#e9dfff');
  const cols = ['#8b5cf6', '#ff6fb5', '#34c3a0', '#f6a04d', '#7cc4ff'];
  for (let y = 150; y < 196; y += 11) { P(1, y + 8, 10, 2, '#bfa8f0'); for (let i = 0; i < 4; i++) P(2 + i * 2, y + (i % 2), 2, 8 - (i % 2), cols[(i + y) % 5]); }
}
function drawCooler() {
  P(300, 176, 10, 24, '#ffffff'); P(300, 176, 10, 1, '#e2d8f8'); P(301, 166, 8, 11, '#bfe1ff'); P(302, 167, 2, 8, '#e3f2ff');
  P(302, 184, 2, 2, '#7cc4ff'); P(306, 184, 2, 2, '#ff6fb5'); P(301, 192, 8, 6, '#efe8ff');
}
function drawPrinter(t) {
  P(328, 200, 26, 2, 'rgba(109,40,217,.10)');
  P(330, 186, 22, 14, '#ffffff'); P(330, 186, 22, 2, '#efe8ff'); P(333, 191, 16, 2, '#cbb8f7'); P(347, 188, 2, 1, Math.floor(t * 2) % 2 ? '#7fe0c4' : '#34c3a0');
  P(334, 182, 14, 5, '#fdfbff'); P(335, 183, 8, 1, '#d9ccf7');
}
function drawMeetingTable(t, meetingOn) {
  P(318, 104, 46, 2, 'rgba(109,40,217,.10)');
  P(316, 78, 48, 18, '#ffffff'); P(316, 78, 48, 1, '#fdfbff'); P(316, 96, 48, 8, '#e3d6ff'); P(316, 103, 48, 1, '#cbb8f7');
  P(322, 82, 8, 5, '#cbb8f7'); P(323, 83, 6, 3, meetingOn ? '#ffd1e8' : '#efe8ff');
  P(348, 84, 6, 4, '#ffffff'); P(349, 85, 4, 1, '#d9ccf7'); P(338, 88, 3, 3, '#ff9fd0');
  if (meetingOn) drawSteam(339, 87, t, 0.3);
}
function drawMeetingChairs() {
  for (const s of MEET) {
    const x = s.x, y = s.y;
    if (s.face === 'up') { P(x - 4, y - 2, 8, 6, '#c4b5fd'); P(x - 4, y + 3, 8, 2, '#a78bfa'); }
    else { P(x - 3, y - 5, 6, 8, '#c4b5fd'); P(x + (s.face === 'right' ? -4 : 3), y - 9, 1, 10, '#a78bfa'); }
  }
}
function drawGlass() {
  g.fillStyle = 'rgba(215,200,255,.28)';
  g.fillRect(296, 36, 4, 64); g.fillRect(296, 118, 4, 34); g.fillRect(296, 122, 88, 30);
  P(296, 36, 4, 1, '#cbb8f7'); P(296, 100, 4, 1, '#cbb8f7'); P(296, 118, 4, 1, '#cbb8f7');
  P(296, 122, 88, 1, '#cbb8f7'); P(296, 151, 88, 1, '#b9a6ec');
  for (let x = 312; x < 384; x += 24) P(x, 122, 1, 30, 'rgba(203,184,247,.8)');
  g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(304, 126, 10, 1); g.fillRect(330, 130, 14, 1); g.fillRect(360, 127, 8, 1);
  // kapı tabelası
  P(340, 136, 22, 6, 'rgba(255,255,255,.8)'); P(342, 138, 18, 2, '#8b5cf6');
}
function drawPlant([x, y, kind], t) {
  const sw = Math.round(Math.sin(t * 1.3 + x) * 0.6);
  P(x + 1, y + 10, 10, 2, 'rgba(109,40,217,.12)');
  P(x, y + 2, 10, 8, '#ffb3d6'); P(x, y + 2, 10, 2, '#ffc9e2'); P(x + 1, y + 9, 8, 1, '#f49ac6');
  const leaf = '#5cc08a', leafD = '#3f9a68', leafL = '#82d8a6';
  if (kind === 'tall') {
    P(x + 4, y - 18, 2, 20, leafD);
    for (let i = 0; i < 4; i++) { const ly = y - 16 + i * 5; P(x - 2 + sw, ly, 6, 3, leaf); P(x + 6 + sw, ly + 2, 6, 3, leafL); }
  } else if (kind === 'small') {
    P(x + 1 + sw, y - 4, 8, 6, leaf); P(x + 3 + sw, y - 6, 4, 3, leafL);
  } else {
    P(x + 4, y - 8, 2, 10, leafD);
    P(x - 3 + sw, y - 6, 7, 4, leaf); P(x + 6 + sw, y - 9, 7, 4, leafL); P(x - 1 + sw, y - 12, 6, 4, leafL); P(x + 5 + sw, y - 3, 7, 4, leaf);
  }
}
function drawChair(d) {
  const x = d.deskX - 6;
  P(x - 7, d.deskY - 19, 14, 13, '#a78bfa'); P(x - 6, d.deskY - 18, 12, 11, '#c4b5fd'); P(x - 6, d.deskY - 18, 12, 2, '#d8cdf4');
}
function drawDesk(d, on, t, night, queued = 0) {
  const w = d.w, x0 = d.deskX - w / 2, y = d.deskY;
  P(x0 + 2, y + 14, w, 2, 'rgba(109,40,217,.10)');
  // monitör(ler)
  const mon = (mx, my, mw, mh) => {
    P(mx, my, mw, mh, '#4b3f72'); P(mx + 1, my + 1, mw - 2, mh - 2, on ? '#ffd1e8' : '#d9ccf7');
    if (on) { const k = Math.floor(t * 4); for (let i = 0; i < 3; i++) P(mx + 2, my + 2 + i * 2, 2 + ((k + i * 3 + mx) % (mw - 5)), 1, i === 1 ? '#8b5cf6' : '#ffffff'); }
    else P(mx + 2, my + 2, 3, 1, '#ffffff');
    P(mx + mw / 2 - 1, my + mh, 3, 2, '#4b3f72'); P(mx + mw / 2 - 3, my + mh + 1, 7, 1, '#4b3f72');
  };
  mon(d.deskX + 4, y - 12, 14, 10);
  if (d.manager) mon(d.deskX + 19, y - 11, 11, 9);
  if (on) { g.fillStyle = 'rgba(255,111,181,.14)'; g.fillRect(d.deskX - 2, y - 16, 26, 16); }
  // masa
  const top = d.manager ? '#ffe0ef' : '#fff7fb', front = d.manager ? '#ffc8e1' : '#f3e6f7', edge = d.manager ? '#f4a9cd' : '#dcc6ea';
  P(x0, y, w, 4, top); P(x0, y, w, 1, '#ffffff'); P(x0, y + 4, w, 9, front); P(x0, y + 13, w, 1, edge);
  P(x0 + w - 15, y + 5, 13, 3, d.manager ? '#ffd6ea' : '#ead9f2'); P(x0 + w - 10, y + 6, 3, 1, '#b9a6ec');
  P(x0 + w - 15, y + 9, 13, 3, d.manager ? '#ffd6ea' : '#ead9f2'); P(x0 + w - 10, y + 10, 3, 1, '#b9a6ec');
  P(x0 + 1, y + 13, 2, 1, edge);
  if (d.manager) { P(x0 + 4, y + 7, 12, 2, '#8b5cf6'); P(x0 + 4, y + 7, 4, 2, '#ff6fb5'); }
  // klavye, fare, fincan, lamba
  P(d.deskX - 14, y + 1, 10, 2, '#d9cdf2'); for (let i = 0; i < 4; i++) P(d.deskX - 13 + i * 2, y + 1, 1, 1, '#ffffff');
  P(d.deskX - 2, y + 1, 2, 2, '#ffffff');
  P(x0 + 2, y - 3, 3, 3, d.manager ? '#8b5cf6' : '#ff9fd0'); P(x0 + 5, y - 2, 1, 1, d.manager ? '#8b5cf6' : '#ff9fd0');
  if (on) drawSteam(x0 + 3, y - 4, t, d.deskX / 50);
  // masa lambası
  P(x0 + w - 4, y - 9, 1, 9, '#b9a6ec'); P(x0 + w - 7, y - 11, 6, 3, '#ff8cc6');
  if (night) { const grd = g.createRadialGradient(x0 + w - 4, y - 6, 1, x0 + w - 4, y - 2, 16); grd.addColorStop(0, 'rgba(255,214,235,.55)'); grd.addColorStop(1, 'rgba(255,214,235,0)'); g.fillStyle = grd; g.fillRect(x0 + w - 22, y - 20, 36, 32); }
  // sıradaki işler: masada kağıt yığını
  for (let i = 0; i < Math.min(queued, 5); i++) { P(x0 + 7, y - 2 - i * 2, 9, 2, i % 2 ? '#f3edff' : '#ffffff'); P(x0 + 8, y - 2 - i * 2, 6, 1, '#d9ccf7'); }
  if (queued) { P(x0 + 14, y - 3 - Math.min(queued, 5) * 2, 3, 3, '#ff6fb5'); }
}

// ======================================================================
//  Çizim: karakter (konturlu, 12x22)
// ======================================================================
function charRects(c, t, now) {
  const L = [];       // [x, y, w, h, renk, kontur?]
  const O = (x, y, w, h, col) => L.push([x, y, w, h, col, true]);
  const D = (x, y, w, h, col) => L.push([x, y, w, h, col, false]);
  const dir = c.dir === 'left' || c.dir === 'right' ? 'side' : c.dir;
  const walk = c.moving ? Math.floor(t * 8 + c.phase) % 4 : -1;
  const typing = (c.seated && working(c, now)) || c.playing;   // klavye ya da atari kolu
  const talking = c.bubble && now < c.bubble.until && c.bubble.kind !== 'work';
  const blink = ((t + c.phase * 3) % 4.2) < 0.13;
  const shoes = '#3b2a5c';
  // bacaklar ve ayakkabılar
  if (c.lounge) {
    O(2, 16, 8, 3, c.pants); D(2, 16, 8, 1, c.pantsS); O(1, 19, 4, 1, shoes); O(7, 19, 4, 1, shoes);
  } else if (dir === 'side') {
    const a = walk === 1 ? [3, 7] : walk === 3 ? [7, 3] : [4, 6];
    O(a[0] - 1, 16, 3, 5, c.pantsS); O(a[1] - 1, 16, 3, 5, c.pants);
    O(a[0] - 1, 21, 4, 1, shoes); O(a[1] - 1, 21, 4, 1, shoes);
  } else {
    const ll = walk === 1 ? 4 : 5, lr = walk === 3 ? 4 : 5;
    O(3, 16, 3, ll, c.pants); O(6, 16, 3, lr, c.pants); D(6, 16, 1, lr, c.pantsS);
    O(2, 16 + ll, 4, 1, shoes); O(6, 16 + lr, 4, 1, shoes);
  }
  // gövde
  const bodyX = dir === 'side' ? 3 : 2, bodyW = dir === 'side' ? 6 : 8;
  O(bodyX, 10, bodyW, 7, c.shirt);
  D(bodyX + bodyW - 2, 10, 2, 7, c.shirtS);
  D(bodyX, 15, bodyW, 1, c.pantsS);
  if (c.hoodie) { D(bodyX + 1, 13, bodyW - 2, 2, c.shirtS); if (dir === 'down') { D(4, 10, 1, 3, '#ffffff'); D(7, 10, 1, 3, '#ffffff'); } }
  if (dir === 'down') {
    if (!c.hoodie) D(4, 10, 4, 1, c.shirtL);
    if (c.tie) { D(5, 11, 2, 4, c.tie); D(5, 11, 2, 1, shade(c.tie, 0.3)); }
  }
  // kollar
  const sw = c.moving ? (walk === 1 ? 1 : walk === 3 ? -1 : 0) : 0;
  if (dir === 'side') {
    if (c.book) { O(5, 10, 2, 4, c.shirtS); O(7, 11, 3, 4, '#8b5cf6'); D(8, 12, 1, 2, '#ffffff'); D(6, 13, 2, 1, c.skin); }
    else { O(5, 10 + Math.abs(sw), 2, 5, c.shirtS); D(5, 15 + Math.abs(sw), 2, 1, c.skin); }
  } else {
    const ty = typing ? Math.floor(t * 7 + c.phase) % 2 : 0;
    if (typing) { O(0, 10, 2, 4, c.shirt); O(10, 10, 2, 4, c.shirt); D(1, 13 - ty, 2, 1, c.skin); D(9, 12 + ty, 2, 1, c.skin); }
    else {
      O(0, 10 + sw, 2, 5, c.shirt); O(10, 10 - sw, 2, 5, c.shirtS);
      D(0, 15 + sw, 2, 1, c.skin); D(10, 15 - sw, 2, 1, c.skin);
      if (c.mug && dir === 'down') { O(10, 13, 3, 3, '#ffffff'); D(11, 14, 1, 1, '#8a4f2c'); }
    }
  }
  // boyun ve baş
  D(5, 9, 2, 1, c.skinS);
  if (dir === 'side') {
    O(3, 2, 7, 7, c.skin); O(9, 5, 1, 1, c.skin);
  } else {
    O(3, 2, 6, 7, c.skin); O(2, 5, 1, 2, c.skin); O(9, 5, 1, 2, c.skin);
  }
  // saç
  const H_ = c.hair, HS = c.hairS, HL = c.hairL;
  if (dir === 'up') {
    O(2, 1, 8, 8, H_); D(3, 2, 6, 1, HL);
    if (c.style === 'long' || c.style === 'curly') O(2, 8, 8, 4, H_);
    if (c.style === 'ponytail') O(5, 8, 2, 5, H_);
    if (c.style === 'bun') O(4, -1, 4, 3, H_);
  } else if (dir === 'side') {
    O(3, 1, 7, 3, H_); O(3, 3, 3, 4, H_); D(4, 1, 4, 1, HL);
    if (c.style === 'long') O(2, 3, 3, 8, H_);
    if (c.style === 'ponytail') O(1, 4, 2, 6, H_);
    if (c.style === 'bun') O(2, 0, 3, 3, H_);
    if (c.style === 'curly') O(2, 1, 4, 7, H_);
    if (c.style === 'spiky') { O(4, 0, 1, 1, H_); O(6, 0, 1, 1, H_); O(8, 0, 1, 1, H_); }
  } else {
    O(2, 1, 8, 3, H_); D(3, 1, 5, 1, HL); O(2, 4, 1, 2, H_); O(9, 4, 1, 2, H_);
    if (c.style === 'long') { O(1, 3, 2, 9, H_); O(9, 3, 2, 9, H_); D(1, 11, 2, 1, HS); D(9, 11, 2, 1, HS); }
    if (c.style === 'bun') O(4, -2, 4, 3, H_);
    if (c.style === 'ponytail') O(9, 2, 2, 7, H_);
    if (c.style === 'curly') { O(1, 0, 10, 4, H_); O(1, 4, 2, 4, H_); O(9, 4, 2, 4, H_); D(2, 0, 2, 1, HL); D(7, 0, 2, 1, HL); }
    if (c.style === 'spiky') { O(3, 0, 1, 1, H_); O(5, 0, 1, 1, H_); O(7, 0, 1, 1, H_); }
  }
  // yüz
  const mood = c.mood && now < c.mood.until ? c.mood.kind : '';
  if (dir === 'down') {
    if (mood === 'happy') { D(4, 5, 1, 1, '#2d1b4e'); D(7, 5, 1, 1, '#2d1b4e'); D(3, 6, 1, 1, '#2d1b4e'); D(8, 6, 1, 1, '#2d1b4e'); }
    else if (mood === 'sad') { D(4, 6, 1, 1, '#2d1b4e'); D(7, 6, 1, 1, '#2d1b4e'); D(3, 5, 2, 1, c.skinS); D(7, 5, 2, 1, c.skinS); }
    else if (mood === 'yawn') { D(4, 6, 1, 1, c.skinS); D(7, 6, 1, 1, c.skinS); D(4, 5, 1, 1, '#2d1b4e'); D(7, 5, 1, 1, '#2d1b4e'); }
    else if (blink) { D(4, 6, 1, 1, c.skinS); D(7, 6, 1, 1, c.skinS); }
    else { D(4, 5, 1, 2, '#2d1b4e'); D(7, 5, 1, 2, '#2d1b4e'); D(4, 5, 1, 1, '#5b4a7a'); D(7, 5, 1, 1, '#5b4a7a'); }
    D(3, 7, 1, 1, mood === 'happy' ? '#ff8fb4' : '#ffb3c9'); D(8, 7, 1, 1, mood === 'happy' ? '#ff8fb4' : '#ffb3c9');
    if (mood === 'happy') { D(4, 8, 4, 1, '#c2456f'); D(5, 9, 2, 1, '#c2456f'); }
    else if (mood === 'yawn') { D(5, 7, 2, 2, '#8a2f55'); D(5, 7, 2, 1, '#c2456f'); }
    else if (mood === 'sad') { D(5, 8, 2, 1, '#8a4f6a'); D(4, 9, 1, 1, '#8a4f6a'); D(7, 9, 1, 1, '#8a4f6a'); }
    else if (talking && Math.floor(t * 8) % 2) D(5, 8, 2, 1, '#c2456f'); else D(5, 8, 2, 1, c.skinS);
    if (c.glasses) { D(3, 5, 3, 1, '#3b2a5c'); D(6, 5, 3, 1, '#3b2a5c'); D(3, 6, 1, 1, '#3b2a5c'); D(8, 6, 1, 1, '#3b2a5c'); }
  } else if (dir === 'side') {
    if (!blink) D(7, 5, 1, 2, '#2d1b4e');
    D(8, 7, 1, 1, '#ffb3c9');
    if (talking && Math.floor(t * 8) % 2) D(8, 8, 1, 1, '#c2456f');
    if (c.glasses) D(6, 5, 4, 1, '#3b2a5c');
  }
  // şapka / kulaklık
  if (c.hat) {
    if (dir === 'up') O(2, 0, 8, 3, c.hat);
    else if (dir === 'side') { O(3, 0, 7, 3, c.hat); O(8, 2, 3, 1, shade(c.hat, -0.2)); }
    else { O(2, 0, 8, 3, c.hat); O(2, 3, 9, 1, shade(c.hat, -0.2)); D(3, 0, 3, 1, shade(c.hat, 0.3)); }
  }
  if (c.phones) {
    if (dir === 'side') { O(4, 4, 2, 3, c.phones); D(4, 0, 4, 1, '#3b2a5c'); }
    else { D(2, 0, 8, 1, '#3b2a5c'); O(1, 4, 2, 3, c.phones); O(9, 4, 2, 3, c.phones); }
  }
  if (c.temp && dir !== 'up') { D(3, 12, 2, 2, '#ffffff'); D(3, 12, 2, 1, '#8b5cf6'); } // stajyer kartı
  return L;
}
function drawCharAt(ctx, c, t, now, ox, oy) {
  const L = charRects(c, t, now);
  const flip = c.dir === 'left';
  const X = (x, w) => flip ? 12 - x - w : x;
  ctx.fillStyle = OUTLINE;
  for (const [x, y, w, h, , o] of L) if (o) ctx.fillRect(ox + X(x, w) - 1, oy + y - 1, w + 2, h + 2);
  for (const [x, y, w, h, col] of L) { ctx.fillStyle = col; ctx.fillRect(ox + X(x, w), oy + y, w, h); }
}
// ---------- konfeti ----------
const particles = [];
const CONFETTI = ['#ff6fb5', '#8b5cf6', '#34c3a0', '#f6a04d', '#7cc4ff', '#fff3a6'];
function burst(c) {
  for (let i = 0; i < 28; i++) particles.push({ x: c.x, y: c.y - 22, vx: rand(-34, 34), vy: rand(-70, -25), life: rand(1.2, 2), col: pick(CONFETTI) });
}
function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 110 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    g.globalAlpha = Math.min(1, p.life * 1.5); P(Math.round(p.x), Math.round(p.y), 2, 1 + (Math.round(p.life * 8) % 2), p.col);
  }
  g.globalAlpha = 1;
}

function drawChar(c, t, now) {
  const bob = (!c.moving && !c.seated && Math.sin(t * 2.4 + c.phase) > 0.8) ? 1 : 0;
  const happy = c.mood && now < c.mood.until && c.mood.kind === 'happy';
  const jump = happy && !c.seated && !c.moving ? Math.round(Math.abs(Math.sin(t * 9)) * 3) : 0;
  const sx = Math.round(c.x) - 6, sy = Math.round(c.y) - 22 + (c.seated ? 7 : 0) + (c.lounge ? 3 : 0) + bob - jump;
  if (!c.seated) { g.fillStyle = 'rgba(109,40,217,.16)'; g.fillRect(sx + 1, Math.round(c.y) - 1, 10, 2); g.fillRect(sx + 2, Math.round(c.y), 8, 1); }
  drawCharAt(g, c, t, now, sx, sy);
}

// ======================================================================
//  Kare döngüsü
// ======================================================================
let meetingUntil = 0;
let last = performance.now();
function frame(now) { renderFrame(now); requestAnimationFrame(frame); }
function renderFrame(now) {
  // kare hızı düşse de (arka plan sekmesi, yavaş panel) yürüme hızı sabit kalsın
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  const t = now / 1000;
  for (const c of [...CHARS.values()]) tick(c, dt, now);
  const sky = skyAt(new Date().getHours());
  const meetingOn = meetingUntil > now;

  g.drawImage(bg, 0, 0);
  drawWindows(t, sky);
  drawTV(t, meetingOn);
  drawSeasonLights(t);

  const items = [];
  const add = (k, f) => items.push({ k, f });
  add(58, () => drawCounter(t)); add(58.1, drawFridge);
  add(107, drawStools); add(108, drawKitchenTable);
  add(181, drawSofa); add(205, () => drawCoffeeTable(t)); add(221, () => drawArcade(t)); add(199, drawBookshelf);
  add(199.5, drawCooler); add(200, () => drawPrinter(t));
  add(70, drawMeetingChairs); add(104, () => drawMeetingTable(t, meetingOn)); add(152, drawGlass);
  for (const p of PLANTS) add(p[1] + 10, () => drawPlant(p, t));
  const owners = new Map([...CHARS.values()].filter(c => c.desk).map(c => [c.desk, c]));
  for (const d of DESKS) {
    const o = owners.get(d);
    add(d.deskY - 4, () => drawChair(d));
    add(d.deskY + 14, () => drawDesk(d, !!(o && o.seated && working(o, now)), t, sky.night, o ? o.queued : 0));
  }
  for (const c of CHARS.values()) add(c.y + 0.5, () => drawChar(c, t, now));
  items.sort((a, b) => a.k - b.k).forEach(i => i.f());
  drawParticles(dt);

  const tint = sky.rain ? 'rgba(120,130,170,.08)' : daylightTint(new Date().getHours());
  if (tint && !sky.night) { g.fillStyle = tint; g.fillRect(0, 0, W, H); }
  if (sky.night) {
    g.fillStyle = 'rgba(46,26,96,.22)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const d of DESKS) { const o = owners.get(d); if (o && o.seated && working(o, now)) { const grd = g.createRadialGradient(d.deskX + 10, d.deskY - 8, 2, d.deskX + 10, d.deskY - 6, 24); grd.addColorStop(0, 'rgba(255,140,200,.35)'); grd.addColorStop(1, 'rgba(255,140,200,0)'); g.fillStyle = grd; g.fillRect(d.deskX - 16, d.deskY - 32, 52, 50); } }
    g.globalCompositeOperation = 'source-over';
  }

  // isim etiketleri ve balonlar
  const ow = ov.clientWidth;
  for (const c of CHARS.values()) {
    const top = c.y - 23 + (c.seated ? 7 : 0) + (c.lounge ? 3 : 0) - (c.style === 'bun' ? 2 : 0);
    c.el.style.top = (top / H * 100) + '%';
    let text = null, kind = '';
    if (c.bubble && now < c.bubble.until) { text = c.bubble.text; kind = c.bubble.kind || ''; }
    else if (c.active.size && !c.moving && !c.cur) { text = (c.step ? c.step : 'Çalışıyor: ' + short(c.title, 40)) + (c.queued ? `  ·  sırada ${c.queued}` : ''); kind = 'work'; }
    else if (c.busyUntil > now && c.busyLabel) { text = c.busyLabel; kind = c.busyKind || 'work'; }
    if (text === null) c.elBubble.hidden = true;
    else {
      c.elBubble.hidden = false;
      if (c.elBubble.textContent !== text) c.elBubble.textContent = text;
      const cls = 'bubble' + (kind ? ' ' + kind : '');
      if (c.elBubble.className !== cls) c.elBubble.className = cls;
    }
    const px = c.x / W * ow;
    c.el.style.left = px + 'px';
    let o = 0;
    if (!c.elBubble.hidden) { const half = c.elBubble.offsetWidth / 2; o = Math.min(Math.max(px, half + 4), ow - half - 4) - px; }
    c.elBubble.style.transform = o ? `translateX(${o}px)` : '';
    c.elBubble.style.setProperty('--o', o + 'px');
  }
}

const clock = document.createElement('div'); clock.className = 'clock';
clock.style.left = (228 / W * 100) + '%'; clock.style.top = (14.5 / H * 100) + '%';
ov.appendChild(clock);
new ResizeObserver(() => { clock.style.fontSize = Math.max(7, ov.clientWidth / W * 6) + 'px'; }).observe(ov);
const tickClock = () => { clock.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); };
setInterval(tickClock, 1000); tickClock();
drawBackground();

