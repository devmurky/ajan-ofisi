// Ajan Ofisi · extras.js — ayarlar paneli, ofis sesleri, yakınlaştırma, istatistik, tarihli tekrar
'use strict';

// ======================================================================
//  Ayarlar
// ======================================================================
const STYLES = [['short', 'Kısa'], ['long', 'Uzun'], ['bun', 'Topuz'], ['ponytail', 'At kuyruğu'], ['curly', 'Kıvırcık'], ['spiky', 'Dikenli']];
const BASE_AGENTS = ['Claude', 'Argon', 'Opus', 'Sonnet', OWNER];
const MODEL_BASES = [['gemini-4-argon', 'Argon (görsel)'], ['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5']];
const BASE_FORM_OPTIONS = document.getElementById('fAgent').innerHTML;

function restyle(c) {
  if (/^#/.test(c.shirt)) { c.shirtS = shade(c.shirt, -0.18); c.shirtL = shade(c.shirt, 0.35); }
  c.hairS = shade(c.hair, -0.2); c.hairL = shade(c.hair, 0.25);
  const tag = c.el && c.el.querySelector('.tag');
  if (tag) { tag.style.setProperty('--c', c.shirt); tag.textContent = c.label || c.name; }
}
function applyLook(target, o) {
  if (o.shirt) target.shirt = o.shirt;
  if (o.hair) target.hair = o.hair;
  if (o.style) target.style = o.style;
  if ('glasses' in o) target.glasses = !!o.glasses;
  if ('hat' in o) target.hat = o.hat || undefined;
  if ('phones' in o) target.phones = o.phones || undefined;
  if (o.label) target.label = o.label;
}
function applySettings() {
  const ag = settings.agents || {};
  for (const [name, o] of Object.entries(ag)) {
    if (PRESET[name]) applyLook(PRESET[name], o);
    const c = CHARS.get(name);
    if (c) { applyLook(c, o); restyle(c); }
  }
  // özel ajan rolleri
  const roles = Array.isArray(settings.roles) ? settings.roles : [];
  for (const r of roles) {
    if (!r.name || BASE_AGENTS.includes(r.name)) continue;
    PRESET[r.name] = PRESET[r.name] || { pants: '#4b3f72', skin: '#efc3a2', hair: r.hair || '#4a3426' };
    Object.assign(PRESET[r.name], { shirt: r.shirt || '#b9a6ff', style: r.style || 'short', role: `${r.model} · özel rol`, custom: true });
    if (!CHARS.has(r.name)) ensureChar(r.name, r.model, { customRole: true });
    const c = CHARS.get(r.name); applyLook(c, r); c.role = `${MODEL_BASES.find(m => m[0] === r.model)?.[1] || r.model} · özel rol`; restyle(c);
  }
  for (const c of [...CHARS.values()]) if (c.customRole && !roles.some(r => r.name === c.name) && !c.active.size) removeChar(c);
  // Yeni iş formu: temel ajanlar + özel roller
  const sel = document.getElementById('fAgent'), cur = sel.value;
  sel.innerHTML = BASE_FORM_OPTIONS + roles.filter(r => r.name && !BASE_AGENTS.includes(r.name))
    .map(r => `<option value="${esc(r.model)}|${esc(r.name)}">${esc(r.name)} · özel rol</option>`).join('');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  tvCache.at = 0;
  if (typeof renderAll === 'function') renderAll();
}

function openSettings() {
  const ag = settings.agents || {};
  const roles = Array.isArray(settings.roles) ? settings.roles : [];
  const agentRow = name => {
    const c = CHARS.get(name) || PRESET[name] || {};
    const o = ag[name] || {};
    const val = (k, d) => esc(o[k] ?? c[k] ?? d);
    const me = name === OWNER;   // patron: etiket = senin adın (ayarlarda "owner")
    return `<div class="set-agent" data-name="${esc(name)}">
      <b>${esc(me ? 'Patron (sen)' : name)}</b>
      <label>${me ? 'Adın' : 'Etiket'} <input data-k="label" value="${me ? esc(ownerName()) : val('label', name)}" maxlength="20"></label>
      <label>Kıyafet <input type="color" data-k="shirt" value="${/^#/.test(c.shirt) ? val('shirt', '#b9a6ff') : '#b9a6ff'}"></label>
      <label>Saç <input type="color" data-k="hair" value="${val('hair', '#4a3426')}"></label>
      <label>Saç stili <select data-k="style">${STYLES.map(([v, l]) => `<option value="${v}"${(o.style ?? c.style) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="ck"><input type="checkbox" data-k="glasses"${(o.glasses ?? c.glasses) ? ' checked' : ''}> gözlük</label>
      <label class="ck"><input type="checkbox" data-k="hat"${(o.hat ?? c.hat) ? ' checked' : ''}> şapka</label>
      <label class="ck"><input type="checkbox" data-k="phones"${(o.phones ?? c.phones) ? ' checked' : ''}> kulaklık</label>
    </div>`;
  };
  const roleRow = (r = {}) => `<div class="set-role">
      <input data-k="name" placeholder="Ad (ör. Tasarımcı 2)" value="${esc(r.name || '')}" maxlength="24">
      <select data-k="model">${MODEL_BASES.map(([v, l]) => `<option value="${v}"${r.model === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input type="color" data-k="shirt" value="${esc(r.shirt || '#b9a6ff')}">
      <button type="button" class="act warn" data-del>Sil</button></div>`;
  const opt = (k, v, l) => `<option value="${v}"${(settings[k] || (k === 'weather' ? 'clear' : 'auto')) === v ? ' selected' : ''}>${l}</option>`;
  profileEl.innerHTML = `<div class="settings">
    <div class="top"><div><h2>Ofis ayarları</h2><div class="role">Değişiklikler açık olan tüm ofis sekmelerine yansır.</div></div><button class="x" title="Kapat">×</button></div>
    <div class="sec">Ofis</div>
    <div class="set-grid">
      <label class="ck"><input type="checkbox" id="sToast"${settings.toast === false ? '' : ' checked'}> Windows bildirimleri</label>
      <label class="ck"><input type="checkbox" id="sAmbient"${settings.ambient === false ? '' : ' checked'}> Ofis sesleri (klavye, kapı, kahve)</label>
      <label>Günlük özet saati <input type="number" id="sHour" min="0" max="23" value="${esc(settings.summaryHour ?? 19)}"></label>
      <label>Argon haftalık uyarı eşiği (iş) <input type="number" id="sArgonWarn" min="1" max="500" value="${esc(settings.argonWeeklyWarn ?? 25)}"></label>
      <label>Gökyüzü <select id="sSky">${opt('sky', 'auto', 'Saate göre')}${opt('sky', 'day', 'Hep gündüz')}${opt('sky', 'night', 'Hep gece')}</select></label>
      <label>Hava <select id="sWeather">${opt('weather', 'clear', 'Açık')}${opt('weather', 'rain', 'Yağmurlu')}</select></label>
      <label>Mevsim süsleri <select id="sSeason">${opt('season', 'auto', 'Kışın otomatik')}${opt('season', 'on', 'Açık')}${opt('season', 'off', 'Kapalı')}</select></label>
    </div>
    <div class="sec">Karakterler</div>
    ${BASE_AGENTS.map(agentRow).join('')}
    <div class="sec">Özel ajan rolleri</div>
    <div class="small" style="margin:0 4px 6px">Örn. "Tasarımcı 2" adında ikinci bir Argon. Ofiste kendi masası olur, Yeni iş sekmesinde seçilebilir.</div>
    <div id="roleList">${roles.map(roleRow).join('')}</div>
    <button type="button" class="act" id="addRole">+ Rol ekle</button>
    <div class="row" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:14px"><span class="msg" id="setMsg"></span><button class="submit" id="setSave" style="padding:8px 18px">Kaydet</button></div>
  </div>`;
  modal.classList.add('on');
  const list = document.getElementById('roleList');
  document.getElementById('addRole').onclick = () => list.insertAdjacentHTML('beforeend', roleRow());
  list.onclick = e => { const b = e.target.closest('[data-del]'); if (b) b.closest('.set-role').remove(); };
  document.getElementById('setSave').onclick = async () => {
    const msg = document.getElementById('setMsg');
    const agents = {}; let owner = '';
    profileEl.querySelectorAll('.set-agent').forEach(row => {
      const o = {}, name = row.dataset.name;
      row.querySelectorAll('[data-k]').forEach(inp => {
        const k = inp.dataset.k;
        if (inp.type === 'checkbox') o[k] = k === 'glasses' ? inp.checked : (inp.checked ? (k === 'hat' ? (PRESET[name]?.hat || '#ff6fb5') : (PRESET[name]?.phones || '#ff6fb5')) : '');
        else o[k] = inp.value.trim();
      });
      if (name === OWNER) { owner = o.label === OWNER ? '' : (o.label || ''); delete o.label; }
      if (o.label === name) delete o.label;
      agents[name] = o;
    });
    const newRoles = [...profileEl.querySelectorAll('.set-role')].map(row => {
      const r = {}; row.querySelectorAll('[data-k]').forEach(inp => { r[inp.dataset.k] = inp.value.trim(); }); return r;
    }).filter(r => r.name);
    const bad = newRoles.find(r => !/^[\p{L}\p{N} _-]{1,24}$/u.test(r.name) || BASE_AGENTS.includes(r.name) || /^(Claude \d|Stajyer)/.test(r.name));
    if (bad) { msg.className = 'msg err'; msg.textContent = `"${bad.name}" adı kullanılamaz.`; return; }
    const body = {
      toast: document.getElementById('sToast').checked, ambient: document.getElementById('sAmbient').checked,
      summaryHour: Math.max(0, Math.min(23, Number(document.getElementById('sHour').value) || 19)),
      argonWeeklyWarn: Math.max(1, Number(document.getElementById('sArgonWarn').value) || 25),
      sky: document.getElementById('sSky').value, weather: document.getElementById('sWeather').value, season: document.getElementById('sSeason').value,
      agents, roles: newRoles, owner,
    };
    try { msg.className = 'msg'; msg.textContent = 'Kaydediliyor…'; await apiPost('/api/settings', body); modal.classList.remove('on'); }
    catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
  };
}
document.getElementById('settingsBtn').onclick = openSettings;
loadSettings().finally(connect);

// ======================================================================
//  Ofis sesleri (yalnızca "Ses açık" ve ayarlarda ofis sesleri açıksa)
// ======================================================================
const ambientOn = () => soundOn && !replaying && settings.ambient !== false && !document.hidden;
function ctx() { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); return audio; }
function noise(dur, freq, q, vol, type = 'bandpass') {
  const a = ctx(), n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
  src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; v.gain.value = vol;
  src.connect(f).connect(v).connect(a.destination); src.start();
}
function tone(freqs, step, vol, type = 'triangle') {
  const a = ctx();
  freqs.forEach((fq, i) => {
    const o = a.createOscillator(), v = a.createGain(), t0 = a.currentTime + i * step;
    o.type = type; o.frequency.value = fq;
    v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(vol, t0 + 0.02); v.gain.exponentialRampToValueAtTime(0.001, t0 + step + 0.3);
    o.connect(v).connect(a.destination); o.start(t0); o.stop(t0 + step + 0.35);
  });
}
const doorChime = () => { if (ambientOn()) try { tone([988, 784], 0.22, 0.05); } catch {} };
const coffeeSound = () => { if (ambientOn()) try { noise(0.7, 500, 0.7, 0.05, 'lowpass'); } catch {} };
// kapıdan biri girince zil
const _ensureChar = ensureChar;
ensureChar = function (name, model, extra) {
  const fresh = !CHARS.has(name || 'Ajan');
  const c = _ensureChar(name, model, extra);
  if (fresh && extra && extra.spawnAt === ENTRANCE) doorChime();
  return c;
};
// kahve makinesine varınca
function onArrive(c, spot) { if (spot.poi && spot.poi.name === 'kahve makinesi') coffeeSound(); }
// çalışan ajan varken hafif klavye tıkırtısı
setInterval(() => {
  if (!ambientOn()) return;
  const now = performance.now();
  const typing = [...CHARS.values()].filter(c => c.seated && working(c, now)).length;
  if (typing && Math.random() < 0.35 + typing * 0.1) try { noise(0.025, 3200, 1.2, 0.035); } catch {}
}, 160);

// ======================================================================
//  Yakınlaştırma ve kaydırma
// ======================================================================
const stageEl = document.getElementById('stage'), worldEl = document.getElementById('world');
const view = { z: 1, x: 0, y: 0 };
function applyView() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  view.z = Math.max(1, Math.min(3, view.z));
  view.x = Math.min(0, Math.max(w - w * view.z, view.x));
  view.y = Math.min(0, Math.max(h - h * view.z, view.y));
  worldEl.style.transform = view.z === 1 ? '' : `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  stageEl.classList.toggle('zoomed', view.z > 1);
}
function zoomAt(f, cx, cy) {
  const r = stageEl.getBoundingClientRect();
  const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top;
  const nz = Math.max(1, Math.min(3, view.z * f));
  view.x = px - (px - view.x) * (nz / view.z); view.y = py - (py - view.y) * (nz / view.z); view.z = nz;
  applyView();
}
stageEl.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
document.getElementById('zoomIn').onclick = () => zoomAt(1.3);
document.getElementById('zoomOut').onclick = () => zoomAt(1 / 1.3);
document.getElementById('zoomReset').onclick = () => { view.z = 1; view.x = view.y = 0; applyView(); };
let drag = null, dragged = false;
stageEl.addEventListener('pointerdown', e => {
  if (view.z === 1 || e.target.closest('.zoom')) return;
  drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; dragged = false;
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
  view.x = drag.vx + dx; view.y = drag.vy + dy; applyView();
});
window.addEventListener('pointerup', () => { drag = null; });
// sürükleme sonrası tıklama profil açmasın
stageEl.addEventListener('click', e => { if (dragged) { e.stopPropagation(); dragged = false; } }, true);
stageEl.addEventListener('dblclick', () => { view.z = 1; view.x = view.y = 0; applyView(); });
new ResizeObserver(applyView).observe(stageEl);

// ======================================================================
//  İstatistik sekmesi
// ======================================================================
// Grafik renkleri: ajan tonlarının koyu sürümleri, doğrulayıcıdan geçmiş sıra (Sonnet, Argon, Opus, Claude); gerisi "Diğer"
const SERIES = [['Sonnet', '#0d9488'], ['Argon', '#7c3aed'], ['Opus', '#d97706'], ['Claude', '#db2777']];
const OTHER = ['Diğer', '#8a7aa8'];
const GRID = '#ece6f6', AXIS = '#cbbfe3', SURF = '#ffffff';
const fmtDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); };
const roundTop = (x, y, w, h, r) => { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
const niceMax = v => { if (v <= 4) return Math.max(1, v); const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p * 2) / 2 * p; };

function stackedChart(data) {
  const Wd = 360, Hd = 168, L = 26, B = 22, Tp = 8, Rt = 6, n = data.days.length;
  const series = SERIES.map(([name, col]) => ({ name, col, vals: data.daily[name] || new Array(n).fill(0) }));
  const otherVals = new Array(n).fill(0);
  for (const [name, vals] of Object.entries(data.daily)) if (!SERIES.some(s => s[0] === name)) vals.forEach((v, i) => { otherVals[i] += v; });
  if (otherVals.some(Boolean)) series.push({ name: OTHER[0], col: OTHER[1], vals: otherVals });
  const totals = data.days.map((_, i) => series.reduce((s, x) => s + x.vals[i], 0));
  const max = niceMax(Math.max(1, ...totals));
  const band = (Wd - L - Rt) / n, bw = Math.min(14, band - 6);
  const y = v => Tp + (Hd - Tp - B) * (1 - v / max);
  let svg = `<svg viewBox="0 0 ${Wd} ${Hd}" class="chart" role="img" aria-label="Son 14 günde ajan başına biten işler">`;
  for (const v of [0, max / 2, max]) {
    svg += `<line x1="${L}" x2="${Wd - Rt}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? GRID : AXIS}" stroke-width="1"/>`;
    svg += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" class="tick">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`;
  }
  data.days.forEach((d, i) => {
    const x = L + i * band + (band - bw) / 2;
    let acc = 0;
    const segs = series.map(s => ({ s, v: s.vals[i] })).filter(x => x.v > 0);
    segs.forEach((g2, k) => {
      const y0 = y(acc), y1 = y(acc + g2.v); acc += g2.v;
      const top = k === segs.length - 1;
      const h = Math.max(1, y0 - y1 - (top ? 0 : 2)); // 2px yüzey boşluğu
      const yy = top ? y1 : y1 + 2;
      svg += top ? `<path d="${roundTop(x, yy, bw, h, 4)}" fill="${g2.s.col}"/>` : `<rect x="${x}" y="${yy}" width="${bw}" height="${h}" fill="${g2.s.col}"/>`;
    });
    if (i === 0 || i === n - 1 || i === Math.floor(n / 2)) svg += `<text x="${L + i * band + band / 2}" y="${Hd - 6}" text-anchor="middle" class="tick">${fmtDay(d)}</text>`;
    const tip = `<b>${fmtDay(d)}</b> · ${totals[i]} iş` + segs.map(g2 => `<br><i style="background:${g2.s.col}"></i>${esc(g2.s.name)}: ${g2.v}`).join('');
    svg += `<rect x="${L + i * band}" y="${Tp}" width="${band}" height="${Hd - Tp - B}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  svg += '</svg>';
  const legend = series.filter(s => s.vals.some(Boolean)).map(s => `<span><i style="background:${s.col}"></i>${esc(s.name)} <b>${s.vals.reduce((a, b) => a + b, 0)}</b></span>`).join('');
  return { svg, legend, total: totals.reduce((a, b) => a + b, 0) };
}

function argonChart(weeks) {
  const Wd = 360, Hd = 130, L = 26, B = 22, Tp = 8, Rt = 6, n = weeks.length, col = '#7c3aed';
  const max = niceMax(Math.max(1, ...weeks.map(w => w.jobs)));
  const lim = Number(settings.argonWeeklyWarn) || 25;
  const band = (Wd - L - Rt) / n, bw = Math.min(16, band - 8);
  const y = v => Tp + (Hd - Tp - B) * (1 - Math.min(v, max) / max);
  let svg = `<svg viewBox="0 0 ${Wd} ${Hd}" class="chart" role="img" aria-label="Son 8 hafta Argon ile biten işler">`;
  for (const v of [0, max / 2, max]) {
    svg += `<line x1="${L}" x2="${Wd - Rt}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? GRID : AXIS}"/>`;
    svg += `<text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end" class="tick">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`;
  }
  if (lim <= max) svg += `<line x1="${L}" x2="${Wd - Rt}" y1="${y(lim)}" y2="${y(lim)}" stroke="#c98a12" stroke-dasharray="3 3"/><text x="${Wd - Rt}" y="${y(lim) - 3}" text-anchor="end" class="tick warn">uyarı eşiği ${lim}</text>`;
  weeks.forEach((w, i) => {
    const x = L + i * band + (band - bw) / 2;
    if (w.jobs) svg += `<path d="${roundTop(x, y(w.jobs), bw, y(0) - y(w.jobs), 4)}" fill="${col}"/>`;
    if (i === 0 || i === n - 1) svg += `<text x="${L + i * band + band / 2}" y="${Hd - 6}" text-anchor="middle" class="tick">${fmtDay(w.start)}</text>`;
    const tip = `<b>${fmtDay(w.start)} haftası</b><br>${w.jobs} iş · ${Math.round(w.seconds / 60)} dk · ${fmtTok(w.tokens)} token`;
    svg += `<rect x="${L + i * band}" y="${Tp}" width="${band}" height="${Hd - Tp - B}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  return svg + '</svg>';
}

async function renderStatsTab() {
  const el = document.getElementById('stats');
  let data;
  try { data = await (await fetch('/api/stats?tests=' + (hideTests ? '0' : '1'))).json(); }
  catch { el.innerHTML = '<div class="empty">İstatistik alınamadı.</div>'; return; }
  const rows = Object.entries(data.agents).sort((a, b) => b[1].jobs - a[1].jobs);
  const tot = rows.reduce((s, [, a]) => ({ jobs: s.jobs + a.jobs, done: s.done + (a.done || 0), secs: s.secs + a.seconds, imgs: s.imgs + a.images, tok: s.tok + a.tokens }), { jobs: 0, done: 0, secs: 0, imgs: 0, tok: 0 });
  const st = stackedChart(data);
  const thisWeek = data.argonWeeks[data.argonWeeks.length - 1] || { jobs: 0 };
  el.innerHTML = `
    <div class="kpis stat-kpis">
      <div class="kpi"><b>${tot.jobs}</b><span>toplam iş</span></div>
      <div class="kpi"><b>${tot.jobs ? Math.round(tot.done / tot.jobs * 100) + '%' : '—'}</b><span>başarı</span></div>
      <div class="kpi"><b>${tot.jobs ? Math.round(tot.secs / tot.jobs) + ' sn' : '—'}</b><span>ortalama süre</span></div>
      <div class="kpi"><b>${tot.imgs}</b><span>görsel</span></div>
    </div>
    <div class="chart-card"><div class="chart-title">Son 14 gün · biten işler <span>${st.total} iş</span></div><div class="legend">${st.legend || '<span class="small">Bu dönemde biten iş yok</span>'}</div>${st.svg}</div>
    <div class="chart-card"><div class="chart-title">Argon · son 8 hafta <span>bu hafta ${thisWeek.jobs} iş</span></div>${argonChart(data.argonWeeks)}</div>
    <div class="chart-card"><div class="chart-title">Ajanlar <span>tüm zamanlar</span></div>
      <table class="stat-table"><thead><tr><th>Ajan</th><th>İş</th><th>Başarı</th><th>Ort. süre</th><th>Token</th><th>Görsel</th></tr></thead><tbody>
      ${rows.map(([n, a]) => `<tr><td><i style="background:${(SERIES.find(s => s[0] === n) || OTHER)[1]}"></i>${esc(n)}</td><td>${a.jobs}</td><td>${a.jobs ? Math.round((a.done || 0) / a.jobs * 100) + '%' : '—'}</td><td>${a.jobs ? Math.round(a.seconds / a.jobs) + ' sn' : '—'}</td><td>${fmtTok(a.tokens)}</td><td>${a.images}</td></tr>`).join('') || '<tr><td colspan="6" class="small">Henüz iş yok</td></tr>'}
      </tbody></table></div>
    <div class="tip" id="statTip" hidden></div>`;
  const tipEl = document.getElementById('statTip');
  el.querySelectorAll('[data-tip]').forEach(r => {
    r.addEventListener('mousemove', e => {
      tipEl.innerHTML = r.dataset.tip; tipEl.hidden = false;
      const box = el.getBoundingClientRect();
      tipEl.style.left = Math.min(e.clientX - box.left + 12, box.width - 170) + 'px'; tipEl.style.top = (e.clientY - box.top + 12) + 'px';
      r.setAttribute('fill', 'rgba(139,92,246,.06)');
    });
    r.addEventListener('mouseleave', () => { tipEl.hidden = true; r.setAttribute('fill', 'transparent'); });
  });
}
let statsTimer = null;
const statsVisible = () => document.getElementById('pane-stats').classList.contains('on');
document.querySelector('.tab[data-tab="stats"]').addEventListener('click', renderStatsTab);
document.getElementById('hideTests').addEventListener('change', () => { if (statsVisible()) renderStatsTab(); });
// iş bitince istatistiği tazele (sekme açıksa)
const _handle = handle;
handle = function (ev, live, hist) {
  const r = _handle(ev, live, hist);
  if (['done', 'blocked', 'fail', 'cancelled'].includes(ev.type) && statsVisible() && !replaying) {
    clearTimeout(statsTimer); statsTimer = setTimeout(renderStatsTab, 800);
  }
  return r;
};

// ======================================================================
//  Tarihli tekrar
// ======================================================================
replayBtn.onclick = () => {
  if (replaying) { location.reload(); return; }
  const today = new Date(), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  profileEl.innerHTML = `<div class="settings"><div class="top"><div><h2>Günü oynat</h2><div class="role">Seçilen günün olayları ofiste hızlandırılmış oynar.</div></div><button class="x" title="Kapat">×</button></div>
    <div class="set-grid" style="margin-top:12px">
      <label>Gün <input type="date" id="rpDate" value="${iso(today)}" max="${iso(today)}"></label>
      <label>Hız <select id="rpSpeed"><option value="10">10×</option><option value="20" selected>20×</option><option value="60">60×</option></select></label>
    </div>
    <div class="row" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:14px"><span class="msg" id="rpMsg"></span><button class="submit" id="rpGo" style="padding:8px 18px">Oynat</button></div></div>`;
  modal.classList.add('on');
  document.getElementById('rpGo').onclick = async () => {
    const date = document.getElementById('rpDate').value, speed = Number(document.getElementById('rpSpeed').value);
    const msg = document.getElementById('rpMsg');
    try {
      const evs = await (await fetch('/api/events?date=' + encodeURIComponent(date))).json();
      if (!Array.isArray(evs) || !evs.length) { msg.className = 'msg err'; msg.textContent = 'O gün olay yok.'; return; }
      modal.classList.remove('on');
      startReplay(evs, speed, fmtDay(date));
    } catch (err) { msg.className = 'msg err'; msg.textContent = 'Olaylar alınamadı.'; }
  };
};

// ======================================================================
//  Ekip toplantısı formu (Yeni iş sekmesi)
// ======================================================================
const taskForm = document.getElementById('taskForm'), meetForm = document.getElementById('meetForm');
document.getElementById('taskMode').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#taskMode button').forEach(x => x.classList.toggle('on', x === b));
  const meet = b.dataset.mode === 'meet';
  meetForm.hidden = !meet; taskForm.hidden = meet;
  if (meet) loadRoles();
};
let rolesLoaded = false;
async function loadRoles() {
  if (rolesLoaded) return;
  const box = document.getElementById('mRoles');
  try {
    const roles = (await (await fetch('/api/roles')).json()).filter(r => !r.raportor);
    box.innerHTML = roles.map(r => `<label class="role" title="${esc(r.odak)}\n${esc(r.yol)}"><input type="checkbox" value="${esc(r.file)}" checked>
      <i style="background:${colorOf(r.ad)}"></i><span><b>${esc(r.ad)}</b> ${esc(r.baslik)}<small>${esc(r.model)}</small></span></label>`).join('');
    rolesLoaded = true;
    const dir = document.getElementById('mDir');
    if (!dir.value) dir.value = document.getElementById('fDir').value;
  } catch { box.innerHTML = '<div class="msg err">Roller alınamadı.</div>'; }
}
meetForm.onsubmit = async e => {
  e.preventDefault();
  const msg = document.getElementById('mMsg'), btn = document.getElementById('mSubmit');
  const roles = [...document.querySelectorAll('#mRoles input:checked')].map(i => i.value);
  const body = { workdir: document.getElementById('mDir').value.trim(), topic: document.getElementById('mTopic').value.trim(), brief: document.getElementById('mBrief').value.trim(), roles };
  if (!roles.length) { msg.className = 'msg err'; msg.textContent = 'En az bir uzman seç.'; return; }
  btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Toplantı başlatılıyor…';
  try {
    await apiPost('/api/meeting', body);
    try { localStorage.setItem('ofis-klasor', body.workdir); } catch {}
    msg.className = 'msg ok'; msg.textContent = 'Toplantı başladı. Uzmanlar toplantı odasına geliyor.';
    document.getElementById('mBrief').value = '';
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
  btn.disabled = false;
};