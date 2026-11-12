// Ajan Ofisi · scene.js
'use strict';
// ======================================================================
//  Sahne ölçüleri ve yerleşim
// ======================================================================
const W = 384, H = 240, T = 8, COLS = W / T, ROWS = H / T, WALL = 48, SPEED = 40;
const cv = document.getElementById('cv');
cv.width = W; cv.height = H;
const g = cv.getContext('2d');
const ov = document.getElementById('ov');

const desk = (cx, dy, extra) => Object.assign({ deskX: cx, deskY: dy, w: 40, visit: { x: cx + 26, y: dy - 3, face: 'left' } }, extra || {});
const MANAGER_DESK = desk(196, 70, { w: 48, manager: true, visit: { x: 228, y: 67, face: 'left' } });
const SEATS = [desk(128, 112), desk(196, 112), desk(264, 112), desk(128, 160), desk(196, 160), desk(264, 160)];
const DESKS = [MANAGER_DESK, ...SEATS];
const ENTRANCE = { x: 108, y: 52, face: 'down' };
const HOT_SEATS = [
  { x: 306, y: 86, face: 'right', sit: true }, { x: 374, y: 86, face: 'left', sit: true }, { x: 306, y: 98, face: 'right', sit: true },
  { x: 374, y: 98, face: 'left', sit: true }, { x: 28, y: 104, face: 'right', sit: true }, { x: 68, y: 104, face: 'left', sit: true },
];
const MEET_HOST = { x: 340, y: 62, face: 'down' };
const MEET_REPORTER = { x: 318, y: 64, face: 'down' };   // toplantıda raportörün yeri (ekranın solu)
const MEET = [
  { x: 306, y: 86, face: 'right', sit: true }, { x: 374, y: 86, face: 'left', sit: true }, { x: 306, y: 98, face: 'right', sit: true },
  { x: 374, y: 98, face: 'left', sit: true }, { x: 330, y: 116, face: 'up', sit: true }, { x: 350, y: 116, face: 'up', sit: true },
];

const POIS = [
  { name: 'kahve makinesi', x: 19, y: 64, face: 'up', social: true, mug: true, say: ['Kahve molası', 'Bir latte daha', 'Pembe fincan benim'] },
  { name: 'buzdolabı', x: 84, y: 64, face: 'up', social: true, say: ['Atıştırmalık var mı?', 'Soğuk su lazım'] },
  { name: 'mutfak masası', x: 28, y: 104, face: 'right', social: true, mug: true, sit: true, say: ['Biraz soluklanayım'] },
  { name: 'mutfak masası', x: 68, y: 104, face: 'left', social: true, mug: true, sit: true, say: ['Bugün yoğun geçti'] },
  { name: 'kanepe', x: 22, y: 182, face: 'down', social: true, lounge: true, say: ['Beş dakika mola'] },
  { name: 'kanepe', x: 38, y: 182, face: 'down', social: true, lounge: true, say: ['Ayaklarımı uzatayım'] },
  { name: 'kanepe', x: 54, y: 182, face: 'down', social: true, lounge: true, say: ['Ne rahat kanepe'] },
  { name: 'atari makinesi', x: 80, y: 228, face: 'up', play: true, say: ['Rekoru kıracağım', 'Bir el daha!'] },
  { name: 'kitaplık', x: 17, y: 156, face: 'left', book: true, say: ['Şu kitaba bakayım', 'Tasarım kitapları burada'] },
  { name: 'su sebili', x: 305, y: 208, face: 'up', social: true, say: ['Su içmeyi unutma'] },
  { name: 'yazıcı', x: 341, y: 208, face: 'up', say: ['Çıktı alıyorum', 'Kağıt sıkıştı yine'] },
  { name: 'pencere', x: 147, y: 54, face: 'up', say: ['Hava güzel', 'Bulutlara bak'] },
  { name: 'pencere', x: 261, y: 54, face: 'up', say: ['Biraz temiz hava'] },
  { name: 'beyaz tahta', x: 206, y: 54, face: 'up', say: ['Plana bakıyorum', 'Bu oklar ne demek?'] },
];
POIS.forEach(p => { p.spot = { x: p.x, y: p.y, face: p.face, poi: p, sit: !!p.sit }; p.by = null; });

// Engeller (yürünemez alanlar): [x, y, w, h]
const OBST = [
  [0, 48, 74, 10], [74, 48, 20, 10],           // tezgah, buzdolabı
  [34, 94, 28, 12],                            // mutfak masası
  [8, 166, 60, 20], [22, 194, 32, 12],         // kanepe, sehpa
  [72, 190, 16, 30], [0, 148, 12, 52],         // atari, kitaplık
  [296, 48, 4, 52], [296, 118, 4, 34], [296, 148, 88, 4], // cam duvarlar (kapı: y 100-118)
  [316, 78, 48, 26],                           // toplantı masası
  [300, 178, 10, 22], [330, 188, 22, 12],      // sebil, yazıcı
  [92, 136, 10, 10], [226, 198, 10, 10], [372, 164, 10, 10], [282, 54, 10, 10], // saksılar
  ...DESKS.map(d => [d.deskX - d.w / 2, d.deskY, d.w, 14]),
];
const PLANTS = [[92, 136, 'big'], [226, 198, 'big'], [372, 164, 'tall'], [282, 54, 'small']];

// ======================================================================
//  Yürünebilirlik ızgarası ve A*
// ======================================================================
const blocked = new Uint8Array(COLS * ROWS);
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const x = c * T, y = r * T;
  let b = y < WALL;
  for (const [ox, oy, ow, oh] of OBST) if (x < ox + ow && x + T > ox && y < oy + oh && y + T > oy) { b = true; break; }
  blocked[r * COLS + c] = b ? 1 : 0;
}
const cellOf = (x, y) => [Math.max(0, Math.min(COLS - 1, Math.floor(x / T))), Math.max(0, Math.min(ROWS - 1, Math.floor(y / T)))];
function nearestFree(c, r) {
  if (!blocked[r * COLS + c]) return [c, r];
  const seen = new Set([r * COLS + c]); const q = [[c, r]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, k = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(k)) continue;
      if (!blocked[k]) return [nx, ny];
      seen.add(k); q.push([nx, ny]);
    }
  }
  return [c, r];
}
function astar(sc, sr, tc, tr) {
  const start = sr * COLS + sc, goal = tr * COLS + tc;
  if (start === goal) return [start];
  const gs = new Float64Array(COLS * ROWS).fill(Infinity), from = new Int32Array(COLS * ROWS).fill(-1);
  const open = [[Math.abs(sc - tc) + Math.abs(sr - tr), start]]; gs[start] = 0;
  const closed = new Uint8Array(COLS * ROWS);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
    if (cur === goal) break;
    if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % COLS, cy = (cur / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = ny * COLS + nx;
      if (blocked[k] || closed[k]) continue;
      const turn = from[cur] >= 0 && ((cur - from[cur]) !== (k - cur)) ? 0.2 : 0; // düz yolu sev
      const ng = gs[cur] + 1 + turn;
      if (ng < gs[k]) { gs[k] = ng; from[k] = cur; open.push([ng + Math.abs(nx - tc) + Math.abs(ny - tr), k]); }
    }
  }
  if (from[goal] < 0) return null;
  const path = [goal]; let k = goal;
  while (k !== start) { k = from[k]; path.push(k); }
  return path.reverse();
}
function findPath(x, y, to) {
  const [sc0, sr0] = cellOf(x, y), [sc, sr] = nearestFree(sc0, sr0);
  const [tc0, tr0] = cellOf(to.x, to.y), [tc, tr] = nearestFree(tc0, tr0);
  const cells = astar(sc, sr, tc, tr);
  const pts = [];
  if (cells) {
    for (const k of cells) pts.push({ x: (k % COLS) * T + T / 2, y: ((k / COLS) | 0) * T + T / 2 });
    // aynı doğrultudaki ara noktaları at
    for (let i = pts.length - 2; i > 0; i--) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) pts.splice(i, 1);
    }
    if (pts.length > 1) pts.shift(); // ilk nokta: zaten bulunduğumuz hücre
  }
  pts.push({ x: to.x, y: to.y });
  return pts;
}

// ======================================================================
//  Yardımcılar ve renkler
// ======================================================================
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
  return '#' + [r, gg, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function hashNum(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
const OUTLINE = '#3b2a5c';

