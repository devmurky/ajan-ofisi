// Ajan Ofisi · app.js
'use strict';
// ======================================================================
//  Ses
// ======================================================================
let audio = null, soundOn = false;
try { soundOn = localStorage.getItem('ofis-ses') === '1'; } catch {}
const soundBtn = document.getElementById('soundBtn');
function paintSound() { soundBtn.textContent = soundOn ? 'Ses açık' : 'Ses kapalı'; soundBtn.classList.toggle('on', soundOn); }
paintSound();
soundBtn.onclick = () => { soundOn = !soundOn; paintSound(); try { localStorage.setItem('ofis-ses', soundOn ? '1' : '0'); } catch {} if (soundOn) chime('ok'); };
let replaying = false;
function chime(kind) {
  if (!soundOn || replaying) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'ok' ? [880, 1175, 1568] : kind === 'warn' ? [660, 520] : [440, 330];
    notes.forEach((f, i) => {
      const o = audio.createOscillator(), v = audio.createGain(), t0 = audio.currentTime + i * 0.12;
      o.type = 'sine'; o.frequency.value = f;
      v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(0.12, t0 + 0.02); v.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      o.connect(v).connect(audio.destination); o.start(t0); o.stop(t0 + 0.4);
    });
  } catch {}
}

// ======================================================================
//  Olaylar
// ======================================================================
const jobs = new Map();
let feed = [];
const projects = new Set();
const allEvents = [];
const claudeLog = [];

const boss = () => ensureChar('Claude');

// ayarlar (ofis/ayarlar.json, Faz 3'te panelden düzenlenir)
let settings = {};
async function loadSettings() {
  try { settings = await (await fetch('/api/settings')).json(); } catch { settings = {}; }
  PRESET[OWNER].label = ownerName();
  const oc = CHARS.get(OWNER); if (oc) oc.label = ownerName();
  applySettings();
}
// Patronun görünen adı (Ayarlar → Karakterler → Patron); boşsa "Patron"
const ownerName = () => String(settings.owner || '').trim() || OWNER;
// applySettings extras.js'te tanımlı (ayarlar paneli)

function meeting(text) {
  const b = boss();
  meetingUntil = performance.now() + 16000;
  const team = [...CHARS.values()].filter(c => c !== b && !c.active.size && !c.temp && c.name !== OWNER);
  interrupt(b);
  b.queue.push(goto(MEET_HOST), say(short(text, 110), 6, 'pink'), wait(7));
  team.forEach((c, i) => {
    interrupt(c);
    c.queue.push(goto(MEET[i % MEET.length]), wait(6), say(pick(['Anlaşıldı', 'Tamamdır', 'Başlayalım', 'Not aldım']), 2), wait(1.5));
    c.nextIdle = performance.now() + 16000;
  });
}

// ---------- birden çok Claude Code oturumu ----------
// İlk görülen oturum ana "Claude" (yönetici masası); diğerleri "Claude 2", "Claude 3"… olarak boş masalara oturur.
const claudeSessions = new Map(); // oturum -> karakter adı
const EXTRA_CLAUDE = ['#ffa6d3', '#f472b6', '#e879f9'];
function claudeFor(ev, live, hist) {
  const s = ev.session || '';
  if (!s) return boss();
  if (!claudeSessions.size) claudeSessions.set(s, 'Claude');
  const recent = Date.now() - new Date(ev.ts || Date.now()).getTime() < 30 * 60 * 1000;
  if (!claudeSessions.has(s)) {
    if (!recent) return null; // eski, başka oturumdan kalma olay
    claudeSessions.set(s, 'Claude ' + (claudeSessions.size + 1));
  }
  const name = claudeSessions.get(s);
  if (name === 'Claude') return boss();
  let c = CHARS.get(name);
  if (!c) {
    if (!recent) return null;
    const i = claudeSessions.size % EXTRA_CLAUDE.length;
    c = ensureChar(name, '', {
      extraClaude: true, label: ['İkiz Klod', 'Kuzen Klod', 'Yedek Klod', 'Nöbetçi Klod', 'Gececi Klod', 'Hafta Sonu Klod'][(claudeSessions.size - 2 + 6) % 6], role: name + ' · Claude Code · ayrı oturum', shirt: EXTRA_CLAUDE[i], pants: '#4b3f72',
      hair: pick(['#6b4232', '#2a1f45', '#8a4f2c']), skin: '#f6cfb4', style: pick(['short', 'spiky', 'curly']), tie: '#7c3aed',
      desk: freeDesk(), spawnAt: live ? ENTRANCE : null,
    });
    if (live) c.queue.push(say('Yeni oturum açtım', 2.4, 'pink'));
  }
  c.lastSeen = Date.now();
  return c;
}
// 20 dakikadır sessiz ek Claude'lar ofisten çıkar
setInterval(() => {
  for (const c of [...CHARS.values()]) {
    if (!c.extraClaude || Date.now() - (c.lastSeen || 0) < 20 * 60 * 1000 || c.leaving) continue;
    c.leaving = true; interrupt(c); c.busyUntil = 0;
    c.queue.push(say('Oturumum bitti, görüşürüz', 2.4, 'pink'), goto(ENTRANCE), call(removeChar));
  }
}, 60 * 1000);

// uzun işlerde esneme
setInterval(() => {
  const now = performance.now();
  for (const c of CHARS.values()) {
    if (!c.active.size || !c.seated || (c.bubble && now < c.bubble.until) || document.hidden) continue;
    const j = jobs.get([...c.active][0]);
    const st = j && j.start ? new Date(j.start.ts).getTime() : 0;
    if (st && Date.now() - st > 150000 && Math.random() < 0.35) {
      c.mood = { kind: 'yawn', until: now + 1600 };
      c.bubble = { text: pick(['Hıı… uzun bir iş', 'Bu iş biraz sürecek', 'Bir kahve iyi gelirdi']), until: now + 2600, kind: 'chat' };
    }
  }
}, 15000);

// ---------- ekip toplantısı ----------
// meeting-start → uzmanlar toplantı odasına oturur · iş olayları (meeting alanlı) → sandalyede çalışır
// raportör ekranın yanına geçer · meeting-done → rapor kartı, kutlama, uzmanlar çıkar
const meetings = new Map();   // id -> { id, start, done, reporter, roles: Map(ajan -> {title, model, state, job, summary}) }
let currentMeeting = null;
const ROLE_STATE = { waiting: 'bekliyor', running: 'inceliyor', done: 'bitti', blocked: 'izin', fail: 'hata', cancelled: 'iptal' };

function meetingSeat(m, agent) {
  if (agent === m.reporter) return MEET_REPORTER;
  const i = [...m.roles.keys()].indexOf(agent);
  return i >= 0 && i < MEET.length ? MEET[i] : HOT_SEATS[(i - MEET.length + HOT_SEATS.length) % HOT_SEATS.length];
}
function meetingChar(m, agent, live) {
  const hot = meetingSeat(m, agent);
  let c = CHARS.get(agent);
  if (!c) c = ensureChar(agent, '', { temp: true, desk: null, hot, spawnAt: live ? ENTRANCE : null });
  else { c.hot = hot; c.desk = null; c.temp = true; }
  c.meeting = m.id;
  if (!live) { c.x = hot.x; c.y = hot.y; c.at = { ...hot }; c.lounge = !!hot.sit; c.seated = false; c.queue = []; c.cur = null; c.path = []; c.dir = hot.face; }
  return c;
}
function meetingStart(ev, live, hist) {
  const m = { id: ev.meeting, start: ev, done: null, reporter: ev.reporter && ev.reporter.agent, roles: new Map() };
  (ev.roles || []).forEach(r => m.roles.set(r.agent, { ...r, state: 'waiting' }));
  if (m.reporter) m.roles.set(m.reporter, { agent: m.reporter, title: 'Toplu rapor', model: ev.reporter.model, state: 'waiting', reporter: true });
  meetings.set(m.id, m);
  feed.push({ kind: 'meeting', id: m.id });
  if (hist && Date.now() - new Date(ev.ts).getTime() > 3 * 3600 * 1000) return; // eski toplantı: sadece kart
  currentMeeting = m;
  const b = boss();
  b.hosting = m.id;
  meetingUntil = performance.now() + 3 * 3600 * 1000;
  const experts = [...m.roles.values()].filter(r => !r.reporter);
  if (live) {
    interrupt(b);
    b.queue.push(goto(MEET_HOST), say(`Toplantı: ${short(ev.topic, 60)} · ${experts.length} uzman`, 4.5, 'pink'));
    experts.forEach((r, i) => {
      const c = meetingChar(m, r.agent, true);
      c.queue.push(wait(i * 0.9), say('Merhaba, ben ' + r.agent, 2), goto({ ...meetingSeat(m, r.agent) }));
    });
  } else {
    b.x = MEET_HOST.x; b.y = MEET_HOST.y; b.at = { ...MEET_HOST }; b.seated = false; b.dir = 'down'; b.queue = []; b.cur = null;
    experts.forEach(r => meetingChar(m, r.agent, false));
  }
}
function meetingJob(ev, live) {
  const m = meetings.get(ev.meeting);
  let j = jobs.get(ev.job);
  if (!j) { j = { id: ev.job, start: null, end: null, steps: [], meeting: ev.meeting }; jobs.set(ev.job, j); }
  const r = m && m.roles.get(ev.agent);
  const now = performance.now();
  if (ev.type === 'start') {
    j.start = ev;
    if (r) { r.state = 'running'; r.job = ev.job; }
    if (!m || m !== currentMeeting) return;
    const c = meetingChar(m, ev.agent, live && !CHARS.has(ev.agent));
    c.active.add(ev.job); c.title = ev.title; c.step = '';
    if (live && ev.agent === m.reporter) {
      c.queue.push(say('Bölümleri topluyorum', 2.4, 'pink'), goto({ ...MEET_REPORTER }));
      boss().bubble = { text: 'Uzmanlar bitirdi, Raportör toplu raporu yazıyor', until: now + 4000, kind: 'pink' };
    }
    return;
  }
  // bitiş
  j.end = ev;
  if (r) { r.state = ev.type; r.summary = ev.summary; }
  const c = CHARS.get(ev.agent);
  if (!c) return;
  c.active.delete(ev.job); c.step = '';
  if (!live) return;
  const verdict = (/\*\*Kısa değerlendirme:\*\*\s*(.+)/.exec(ev.summary || '') || [])[1];
  if (ev.type === 'done') {
    c.bubble = { text: short(verdict || 'Bölümümü bitirdim', 110), until: now + 7000, kind: 'chat' };
    c.mood = { kind: 'happy', until: now + 2500 };
  } else {
    c.bubble = { text: ev.reason === 'auth' ? 'Antigravity girişi gerekli' : 'Bölümümü yazamadım', until: now + 5000, kind: 'warn' };
    c.mood = { kind: 'sad', until: now + 5000 };
  }
}
function meetingDone(ev, live) {
  const m = meetings.get(ev.meeting);
  if (m) m.done = ev;
  const b = boss();
  if (b.hosting === ev.meeting) b.hosting = null;
  if (currentMeeting && currentMeeting.id === ev.meeting) currentMeeting = null;
  const people = [...CHARS.values()].filter(c => c.meeting === ev.meeting);
  if (!live) { people.forEach(removeChar); meetingUntil = 0; return; }
  meetingUntil = performance.now() + 9000;
  chime(ev.ok ? 'ok' : 'warn');
  b.bubble = { text: ev.ok ? 'Ekip raporu hazır! Proje klasörüne kaydettim' : 'Rapor hazır ama bazı bölümler eksik', until: performance.now() + 5000, kind: ev.ok ? 'ok' : 'warn' };
  b.mood = { kind: 'happy', until: performance.now() + 3000 }; burst(b);
  people.forEach((c, i) => {
    c.mood = { kind: 'happy', until: performance.now() + 3000 }; if (i % 2 === 0) burst(c);
    c.queue.push(wait(4 + i * 0.8), say(pick(['Görüşürüz', 'İyi çalışmalar', 'Kolay gelsin']), 1.8), goto(ENTRANCE), call(removeChar));
  });
  b.queue.push(wait(5), goto(seatSpot(b)));
}

function ownerVisit(text, host) {
  const now = performance.now();
  let e = CHARS.get(OWNER);
  if (!e) e = ensureChar(OWNER, '', { spawnAt: ENTRANCE, desk: null, label: ownerName() });
  const b = host || boss();
  interrupt(e);
  e.leaveAt = now + 3 * 60 * 1000;
  e.queue.push(goto(b.desk ? visitSpot(b) : MANAGER_DESK.visit), say(short(text, 80), 3.6, 'pink'),
    call(() => { b.bubble = { text: pick(['Hemen bakıyorum', 'Tamam, ekibe dağıtıyorum', 'Anlaşıldı patron']), until: performance.now() + 3000, kind: 'pink' }; }),
    wait(3.4), goto(pick(POIS.filter(p => p.lounge)).spot), wait(4));
}

// live: animasyonla oynat · hist: geçmişten yükleniyor (zamana bağlı durumları kurma)
// Sekme gizliyken gelen olaylar live=false, hist=false ile uygulanır: durum güncellenir, animasyon birikmez.
function handle(ev, live, hist = !live) {
  const now = performance.now();
  if (ev.type === 'reset') { location.reload(); return; }
  if (ev.project) projects.add(ev.project);
  // eski kayıtlarda patron kendi adıyla geçer; hepsini sabit anahtara çevir
  if (ev.owner || (ev.agent && settings.owner && ev.agent === settings.owner)) ev.agent = OWNER;
  const b = boss();

  switch (ev.type) {
    case 'queued': {
      const c = ensureChar(ev.agent, ev.model);
      if (!jobs.has(ev.job)) { jobs.set(ev.job, { id: ev.job, queued: ev, start: null, end: null, steps: [] }); feed.push({ kind: 'job', id: ev.job }); }
      c.queued++;
      if (live) c.queue.push(say('Sıraya aldım: ' + short(ev.title, 50), 3, 'pink'));
      break;
    }
    case 'meeting-start': meetingStart(ev, live, hist); break;
    case 'meeting-done': meetingDone(ev, live); break;
    case 'start': {
      if (ev.meeting) { meetingJob(ev, live); break; }
      const c = ensureChar(ev.agent, ev.model);
      let j = jobs.get(ev.job);
      if (!j) { j = { id: ev.job, start: null, end: null, steps: [] }; jobs.set(ev.job, j); feed.push({ kind: 'job', id: ev.job }); }
      else if (j.queued) c.queued = Math.max(0, c.queued - 1);
      j.start = ev;
      c.active.add(ev.job); c.title = ev.title; c.step = '';
      if (live && c !== b) {
        interrupt(b);
        b.queue.push(goto(visitSpot(c)), say('Yeni iş: ' + short(ev.title, 70), 3.6), wait(2.8), goto(seatSpot(b)));
        interrupt(c);
        c.queue.push(say('Tamam, başlıyorum', 2), goto(seatSpot(c)));
      } else if (!live) {
        const s = seatSpot(c); c.x = s.x; c.y = s.y; c.at = s; c.seated = !!s.seat; c.path = []; c.cur = null; c.queue = []; c.lounge = false;
      }
      break;
    }
    case 'progress': {
      const c = ensureChar(ev.agent, ev.model);
      const j = jobs.get(ev.job);
      if (j) { j.steps.push(ev.label); j.lastStep = ev.label; }
      c.step = cap(ev.label || '');
      break;
    }
    case 'done': case 'blocked': case 'fail': case 'cancelled': {
      if (ev.meeting) { meetingJob(ev, live); break; }
      const c = ensureChar(ev.agent, ev.model);
      let j = jobs.get(ev.job);
      if (!j) { j = { id: ev.job, start: null, end: null, steps: [] }; jobs.set(ev.job, j); feed.push({ kind: 'job', id: ev.job }); }
      const wasQueued = !j.start && !!j.queued;
      j.end = ev;
      if (wasQueued) c.queued = Math.max(0, c.queued - 1); else { c.active.delete(ev.job); c.step = ''; }
      if (live && c !== b && ev.type === 'cancelled') {
        c.bubble = { text: wasQueued ? 'Sıradaki iş iptal edildi' : 'İptal edildi', until: now + 3000, kind: 'warn' };
        c.mood = { kind: 'sad', until: now + 4000 };
      } else if (live && c !== b) {
        const m = ev.reason === 'auth' ? ['Antigravity girişi gerekli', 'warn']
          : { done: ['Bitti!', 'ok'], blocked: ['İzin gerekiyor', 'warn'], fail: [ev.reason === 'crash' ? 'İş yarıda kesildi' : 'Bir sorun çıktı', 'err'] }[ev.type];
        chime(m[1]);
        if (ev.type !== 'done') c.mood = { kind: 'sad', until: now + 6000 };
        if (ev.reason === 'auth') b.bubble = { text: ownerName() + ", Antigravity'ye yeniden giriş yapman gerekiyor", until: now + 7000, kind: 'warn' };
        interrupt(c);
        c.queue.push(say(m[0], 2.2, m[1]), wait(1.4), goto(MANAGER_DESK.visit), say('Teslim: ' + short(ev.title, 60), 3.2, m[1]),
          call(() => { b.bubble = { text: ev.type === 'done' ? 'Teşekkürler, inceliyorum' : 'Bakıyorum, ne oldu?', until: performance.now() + 3000, kind: 'pink' }; }),
          wait(2.6));
      }
      break;
    }
    case 'claude': {
      claudeLog.push(ev); if (claudeLog.length > 40) claudeLog.shift();
      const cc = claudeFor(ev, live, hist);
      if (!cc) break;
      if (ev.project) { cc.project = ev.project; if (cc.extraClaude) cc.role = 'Claude Code · ' + ev.project; }
      if (ev.state === 'busy') {
        cc.busyUntil = now + 45000; cc.busyLabel = cap(ev.label || 'çalışıyor'); cc.busyKind = 'pink';
        if (live && /^yeni istek/.test(ev.label || '')) ownerVisit(ev.label.replace(/^yeni istek:\s*/, ''), cc);
      } else if (ev.state === 'wait') { cc.busyUntil = now + 120000; cc.busyLabel = 'Onay bekliyor: ' + short(ev.label, 50); cc.busyKind = 'warn'; if (live) chime('warn'); }
      else if (ev.state === 'idle') { cc.busyUntil = 0; cc.busyLabel = ''; if (live) cc.bubble = { text: 'Sıra sende', until: now + 3500, kind: 'pink' }; }
      if (hist) cc.busyUntil = 0;
      break;
    }
    case 'intern-start': {
      if (hist && Date.now() - new Date(ev.ts).getTime() > 30 * 60 * 1000) break;
      internNo++;
      const look = INTERN_LOOKS[internNo % INTERN_LOOKS.length];
      const name = 'Stajyer ' + internNo;
      const c = ensureChar(name, '', Object.assign({
        temp: true, label: INTERN_NAMES[(internNo - 1) % INTERN_NAMES.length], role: ev.kind ? `Claude alt ajanı · ${ev.kind}` : 'Claude alt ajanı',
        pants: '#4b3f72', skin: pick(['#f6cfb4', '#e9b896', '#d39a74']), desk: freeDesk(), spawnAt: live ? ENTRANCE : null,
      }, look));
      c.active.add(ev.id); c.title = ev.title; c.step = 'Alt görev: ' + short(ev.title, 40);
      INTERNS.set(ev.id, c);
      if (live) c.queue.push(say('Merhaba! ' + short(ev.title, 40), 2.4, 'pink'), goto(seatSpot(c)));
      break;
    }
    case 'intern-step': {
      const c = INTERNS.get(ev.id);
      if (!c) break;
      c.step = cap(ev.label || '');
      if (live && ev.warn) { c.bubble = { text: cap(ev.label || 'Onay bekliyorum'), until: now + 5000, kind: 'warn' }; chime('warn'); }
      break;
    }
    case 'intern-done': {
      const c = INTERNS.get(ev.id);
      if (!c) break;
      INTERNS.delete(ev.id);
      c.active.delete(ev.id); c.step = '';
      if (live) {
        interrupt(c);
        c.queue.push(say(ev.ok === false ? 'Takıldım' : 'Bitti!', 1.8, ev.ok === false ? 'warn' : 'ok'),
          goto(MANAGER_DESK.visit), say('Sonuçlar sende', 2.2, 'pink'), wait(1.8), goto(ENTRANCE), call(removeChar));
      } else removeChar(c);
      break;
    }
    case 'reorder': {
      queueOrder[ev.agent] = ev.order || [];
      if (live) { const c = CHARS.get(ev.agent); if (c) c.bubble = { text: 'Sıra değişti, tamam', until: now + 2200, kind: 'pink' }; }
      break;
    }
    case 'settings': { if (live) loadSettings(); break; }
    default: {
      // notlar: note | plan | review | approve | reject | summary (Claude ya da patron)
      feed.push({ kind: 'note', ev });
      if ((ev.type === 'approve' || ev.type === 'reject') && ev.job && jobs.has(ev.job)) jobs.get(ev.job).review = ev.type;
      if (!live) break;
      if (ev.agent === OWNER && (ev.type === 'approve' || ev.type === 'reject')) {
        const tgt = ev.target && CHARS.get(ev.target);
        if (ev.type === 'approve') {
          b.bubble = { text: ownerName() + ' onayladı, harika iş!', until: now + 3500, kind: 'ok' };
          if (tgt) { tgt.bubble = { text: 'Yaşasın!', until: now + 3000, kind: 'ok' }; tgt.mood = { kind: 'happy', until: now + 3500 }; burst(tgt); chime('ok'); }
        } else {
          b.bubble = { text: 'Düzeltmeyi ekibe iletiyorum', until: now + 3500, kind: 'pink' };
          if (tgt) tgt.queue.push(say('Hemen düzeltiyorum', 2.5, 'warn'));
        }
        break;
      }
      if (ev.agent === OWNER) { ownerVisit(ev.text.replace(/^Ofisten iş verdi:\s*/, 'Yeni iş: ')); break; }
      const who = ev.agent ? ensureChar(ev.agent) : b;
      if (ev.type === 'plan') { meeting(ev.text); break; }
      const kind = { approve: 'ok', reject: 'warn' }[ev.type] || 'pink';
      who.bubble = { text: short(ev.text, 110), until: now + 5000, kind };
      const tgt = ev.target && CHARS.get(ev.target);
      if (tgt && ev.type === 'approve') tgt.queue.push(say('Süper!', 2, 'ok'));
      if (tgt && ev.type === 'reject') tgt.queue.push(say('Hemen düzeltiyorum', 2.5, 'warn'));
    }
  }
  if (live) scheduleRender();
}

// ======================================================================
//  Panel
// ======================================================================
const STATUS = { running: 'Çalışıyor', queued: 'Sırada', done: 'Bitti', blocked: 'İzin gerekti', fail: 'Hata', cancelled: 'İptal edildi' };
const queueOrder = {}; // ajan -> sıradaki iş kimlikleri
const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtTok = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n || 0);
const jobProject = j => (j.start && j.start.project) || (j.end && j.end.project) || (j.queued && j.queued.project) || '';
const jobState = j => j.end ? j.end.type : j.start ? 'running' : 'queued';
let hideTests = true;
try { hideTests = localStorage.getItem('ofis-testgizle') !== '0'; } catch {}
const isTest = j => /^test[-_ ]?/i.test(jobProject(j));
const visibleJob = j => !(hideTests && isTest(j));
const colorOf = name => (CHARS.get(name) || PRESET[name] || {}).shirt || '#b9a6ec';

function jobCard(j) {
  const s = j.start || j.queued || {}, e = j.end;
  const agent = (e && e.agent) || s.agent || 'Ajan';
  const st = jobState(j);
  const title = (e && e.title) || s.title || j.id;
  const meta = [fmtTime(s.ts || (e && e.ts)), jobProject(j), e ? `${e.seconds} sn` : null, e && e.tokens ? fmtTok(e.tokens) + ' token' : null, e && e.waited ? `${e.waited} sn sırada` : null].filter(Boolean).join(' · ');
  let h = `<article class="card" style="--c:${colorOf(agent)}">
    <div class="row"><b title="${esc(agent)}">${esc(nick(agent))}</b><span class="model">${esc((e && e.model) || s.model || '')}</span><span class="chip ${st}">${STATUS[st] || st}</span></div>
    <div class="title">${esc(title)}</div><div class="meta">${esc(meta)}</div>`;
  if (st === 'running') h += `<div class="step"><i></i>${esc(j.lastStep ? j.lastStep : 'başladı')}${j.steps.length ? ` · ${j.steps.length}. adım` : ''}</div>`;
  if (e && e.summary) h += `<div class="sum">${esc(e.summary)}</div><button class="more" hidden>Devamını göster</button>`;
  const imgs = e && Array.isArray(e.files) ? e.files.filter(f => f.kind === 'image') : [];
  if (imgs.length) h += `<div class="imgs">${imgs.map(f => `<a href="${esc(f.url)}" target="_blank" title="${esc(f.savedTo || f.name)}"><img loading="lazy" src="${esc(f.url)}" alt="${esc(f.name)}"></a>`).join('')}</div>`;
  const ch = e && Array.isArray(e.changed) ? e.changed : [];
  if (ch.length) h += `<details><summary>Değişen dosyalar (${ch.length})</summary><ul>${ch.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
  if (j.steps.length && e) h += `<details><summary>Adımlar (${j.steps.length})</summary><ul>${j.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
  if (e && e.report) h += `<a class="rep" href="/rapor?yol=${esc(encodeURIComponent(e.report))}" target="_blank">Raporu aç</a>`;
  // yönetim düğmeleri
  const acts = [];
  if (st === 'running' || st === 'queued') {
    if (st === 'queued') {
      const waiting = [...jobs.values()].filter(x => jobState(x) === 'queued' && ((x.queued || {}).agent === agent));
      const order = queueOrder[agent] || [];
      const first = order.length ? order[0] === j.id : waiting[0] === j;
      if (waiting.length > 1 && !first) acts.push(`<button class="act" data-act="front" data-job="${esc(j.id)}">Öne al</button>`);
    }
    acts.push(`<button class="act warn" data-act="cancel" data-job="${esc(j.id)}">İptal</button>`);
  } else if (e && e.type !== 'cancelled') {
    if (j.review === 'approve') acts.push('<span class="chip done review">Onaylandı</span>');
    else if (j.review === 'reject') acts.push('<span class="chip queued review">Düzeltme istendi</span>');
    else acts.push(`<button class="act ok" data-act="approve" data-job="${esc(j.id)}">Onayla</button><button class="act" data-act="reject" data-job="${esc(j.id)}">Düzeltme iste</button>`);
  }
  if (acts.length) h += `<div class="acts">${acts.join('')}</div>`;
  return h + '</article>';
}

// ---------- yönetim istekleri ----------
async function apiPost(url, body, raw) {
  const headers = { 'X-Ofis-Token': await getToken() };
  if (!raw) headers['Content-Type'] = 'application/json';
  else Object.assign(headers, raw.headers);
  const r = await fetch(url, { method: 'POST', headers, body: raw ? raw.body : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'İstek başarısız');
  return d;
}
function flash(btn, text) { const old = btn.textContent; btn.textContent = text; setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 2500); }
document.getElementById('feed').addEventListener('click', async e => {
  const btn = e.target.closest('.act'); if (!btn) return;
  const job = btn.dataset.job, act = btn.dataset.act;
  if (act === 'reject') { openReview(job); return; }
  if (act === 'cancel' && !confirm('Bu iş iptal edilsin mi?')) return;
  btn.disabled = true;
  try {
    if (act === 'cancel') await apiPost('/api/cancel', { job });
    else if (act === 'approve') await apiPost('/api/review', { job, action: 'approve' });
    else if (act === 'front') await apiPost('/api/queue', { job, action: 'front' });
  } catch (err) { flash(btn, err.message); }
});
function openReview(id) {
  const j = jobs.get(id); if (!j) return;
  const title = (j.end && j.end.title) || (j.start && j.start.title) || id;
  profileEl.innerHTML = `<div class="review-box"><div class="top"><div><h2>Düzeltme iste</h2><div class="role">${esc(title)} · ${esc((j.end || {}).agent || '')}</div></div><button class="x" title="Kapat">×</button></div>
    <textarea id="rvText" placeholder="Neyi değiştirmeli? Ör. arka planı daha koyu yap, yazıyı kaldır, renkleri pembeye çek."></textarea>
    <div class="row"><span class="msg" id="rvMsg"></span><button class="submit" id="rvSend" style="padding:8px 16px">Ajana geri gönder</button></div></div>`;
  modal.classList.add('on');
  const ta = document.getElementById('rvText'); ta.focus();
  document.getElementById('rvSend').onclick = async () => {
    const msg = document.getElementById('rvMsg'), send = document.getElementById('rvSend');
    send.disabled = true; msg.className = 'msg'; msg.textContent = 'Gönderiliyor…';
    try { await apiPost('/api/review', { job: id, action: 'reject', feedback: ta.value }); modal.classList.remove('on'); }
    catch (err) { msg.className = 'msg err'; msg.textContent = err.message; send.disabled = false; }
  };
}

const projFilter = document.getElementById('projFilter');
const projFilter2 = document.getElementById('projFilter2');
let filter = '';
try { filter = localStorage.getItem('ofis-proje') || ''; } catch {}
function syncFilters() {
  for (const sel of [projFilter, projFilter2]) {
    const have = new Set([...sel.options].map(o => o.value));
    [...projects].sort().forEach(p => { if (!have.has(p)) { const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o); } });
    sel.value = projects.has(filter) ? filter : '';
  }
}
const hideTestsEl = document.getElementById('hideTests');
hideTestsEl.checked = hideTests;
hideTestsEl.onchange = () => { hideTests = hideTestsEl.checked; try { localStorage.setItem('ofis-testgizle', hideTests ? '1' : '0'); } catch {} renderAll(); };
[projFilter, projFilter2].forEach(sel => sel.onchange = () => { filter = sel.value; try { localStorage.setItem('ofis-proje', filter); } catch {} renderAll(); });

function renderFeed() {
  const el = document.getElementById('feed');
  const items = feed.slice().reverse().filter(it => {
    if (it.kind === 'meeting') {
      const m = meetings.get(it.id); if (!m) return false;
      const pj = m.start.project || '';
      if (hideTests && /^test[-_ ]?/i.test(pj)) return false;
      return !filter || pj === filter;
    }
    if (it.kind !== 'job') {
      const pj = it.ev.project || (it.ev.job && jobs.has(it.ev.job) ? jobProject(jobs.get(it.ev.job)) : '');
      if (hideTests && /^test[-_ ]?/i.test(pj)) return false;
      return !filter || pj === filter;
    }
    const j = jobs.get(it.id);
    return visibleJob(j) && (!filter || jobProject(j) === filter);
  }).slice(0, 150);
  if (!items.length) { el.innerHTML = '<div class="empty">Henüz iş yok.</div>'; return; }
  el.innerHTML = items.map(it => it.kind === 'job' ? jobCard(jobs.get(it.id)) : it.kind === 'meeting' ? meetingCard(meetings.get(it.id))
    : `<div class="note ${esc(it.ev.type)}"><time>${fmtTime(it.ev.ts)}</time><b>${esc(it.ev.agent === OWNER ? ownerName() : (it.ev.agent || 'Claude'))}:</b> ${esc(it.ev.text)}</div>`).join('');
  el.querySelectorAll('.sum').forEach(s => {
    const btn = s.nextElementSibling;
    if (s.scrollHeight > s.clientHeight + 2) { btn.hidden = false; btn.onclick = () => { const o = s.classList.toggle('open'); btn.textContent = o ? 'Daralt' : 'Devamını göster'; }; }
  });
}
function meetingCard(m) {
  const s = m.start, d = m.done;
  const st = d ? (d.ok ? 'done' : 'blocked') : 'running';
  const roles = [...m.roles.values()];
  const meta = [fmtTime(s.ts), s.project, `${roles.filter(r => !r.reporter).length} uzman`, d ? `${Math.round((d.seconds || 0) / 60 * 10) / 10} dk` : null].filter(Boolean).join(' · ');
  let h = `<article class="card meeting" style="--c:#8b5cf6">
    <div class="row"><b>Ekip toplantısı</b><span class="chip ${st}">${d ? (d.ok ? 'Rapor hazır' : 'Rapor eksik') : 'Toplantıda'}</span></div>
    <div class="title">${esc(s.topic)}</div><div class="meta">${esc(meta)}</div>
    <div class="roles">${roles.map(r => `<span class="rchip ${r.state}" title="${esc(r.title || '')} · ${esc(r.model || '')}"><i style="background:${colorOf(r.agent)}"></i>${esc(nick(r.agent))}<em>${ROLE_STATE[r.state] || r.state}</em></span>`).join('')}</div>`;
  if (d && d.summary) h += `<div class="sum">${esc(d.summary)}</div><button class="more" hidden>Devamını göster</button>`;
  if (d && d.url) h += `<a class="rep" href="/rapor?yol=${esc(encodeURIComponent(d.url))}" target="_blank">Raporu aç</a><div class="meta" style="margin-top:4px">${esc(d.report || '')}</div>`;
  return h + '</article>';
}
function imagesOf(pred) {
  const list = [];
  for (const j of jobs.values()) {
    if (!j.end || !Array.isArray(j.end.files) || !pred(j)) continue;
    j.end.files.filter(f => f.kind === 'image').forEach(f => list.push({ f, j }));
  }
  return list.sort((a, b) => String(b.j.end.ts).localeCompare(String(a.j.end.ts)));
}
function renderGallery() {
  const el = document.getElementById('gallery');
  const list = imagesOf(j => visibleJob(j) && (!filter || jobProject(j) === filter));
  el.innerHTML = list.length ? list.map(({ f, j }) => `<a class="gitem" href="${esc(f.url)}" target="_blank" title="${esc(f.savedTo || f.name)}">
      <img loading="lazy" src="${esc(f.url)}" alt="${esc(f.name)}"><div>${esc(short(j.end.title, 40))}<small>${esc(nick(j.end.agent))} · ${esc(jobProject(j))} · ${fmtTime(j.end.ts)}</small></div></a>`).join('')
    : '<div class="empty">Henüz görsel yok. Argon\'a bir görsel işi ver.</div>';
}
function renderStats() {
  const today = new Date().toDateString();
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  let run = 0, queued = 0, done = 0, aJobs = 0, aSec = 0, aTok = 0;
  for (const j of jobs.values()) {
    const st = jobState(j);
    if (!visibleJob(j) && st !== 'running' && st !== 'queued') continue;
    if (st === 'running') run++;
    if (st === 'queued') queued++;
    if (j.end) {
      if (j.end.type === 'done' && new Date(j.end.ts).toDateString() === today) done++;
      if (/argon/.test(j.end.model || '') && new Date(j.end.ts) >= monday) { aJobs++; aSec += j.end.seconds || 0; aTok += j.end.tokens || 0; }
    }
  }
  document.getElementById('sRun').textContent = run;
  document.getElementById('sQueue').textContent = queued;
  document.getElementById('sDone').textContent = done;
  document.getElementById('sArgon').textContent = `${aJobs} iş · ${Math.round(aSec / 60)} dk · ${fmtTok(aTok)} token`;
  // kota uyarısı: eşiğin %80'i sarı, tamamı kırmızı
  const lim = Number(settings.argonWeeklyWarn) || 25;
  const chip = document.getElementById('argonChip');
  chip.classList.toggle('warn', aJobs >= lim * 0.8 && aJobs < lim);
  chip.classList.toggle('over', aJobs >= lim);
  chip.title = `Pazartesiden bu yana Argon ile biten işler · uyarı eşiği ${lim} iş (Ayarlar'dan değişir)`;
}
function statusText(c, now) {
  if (c.active.size) return [c.step || ('Çalışıyor: ' + c.title), true];
  if (c.busyUntil > now) return [c.busyLabel + (c.project ? ` · ${c.project}` : ''), true];
  if (c.chatUntil > now) return ['Mola sohbetinde', false];
  if (c.moving) return ['Ofiste dolaşıyor', false];
  const p = POIS.find(p => p.by === c.name);
  return [p ? p.name + ' başında' : 'Masasında', false];
}
function renderRoster() {
  const el = document.getElementById('roster');
  const now = performance.now();
  el.innerHTML = [...CHARS.values()].map(c => {
    const [st, busy] = statusText(c, now);
    return `<div class="agent" data-name="${esc(c.name)}"><span class="dot" style="background:${c.shirt}"></span><div><b>${esc(c.label || c.name)}</b> <span class="role">${esc(c.role)}</span></div>${c.queued ? `<span class="q">${c.queued} sırada</span>` : '<span></span>'}<div class="now${busy ? ' busy' : ''}">${esc(st)}</div></div>`;
  }).join('');
}
document.getElementById('roster').onclick = e => { const a = e.target.closest('.agent'); if (a) openProfile(a.dataset.name); };
function renderAll() { syncFilters(); renderFeed(); renderGallery(); renderStats(); renderRoster(); renderDirList(); }
let renderTimer = null;
function scheduleRender() { if (!renderTimer) renderTimer = setTimeout(() => { renderTimer = null; renderAll(); }, 120); }
setInterval(renderRoster, 800);

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t.dataset.tab));
});

// ======================================================================
//  Profil kartı
// ======================================================================
const modal = document.getElementById('modal'), profileEl = document.getElementById('profile');
modal.onclick = e => { if (e.target === modal || e.target.closest('.x')) modal.classList.remove('on'); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('on'); });

function openProfile(name) {
  const c = CHARS.get(name); if (!c) return;
  const now = performance.now();
  const mine = [...jobs.values()].filter(j => ((j.end && j.end.agent) || (j.start && j.start.agent) || (j.queued && j.queued.agent)) === name);
  const ended = mine.filter(j => j.end);
  const ok = ended.filter(j => j.end.type === 'done').length;
  const avg = ended.length ? Math.round(ended.reduce((s, j) => s + (j.end.seconds || 0), 0) / ended.length) : 0;
  const tok = ended.reduce((s, j) => s + (j.end.tokens || 0), 0);
  const [st] = statusText(c, now);
  let kpis, list;
  if (name === 'Claude') {
    kpis = [[jobs.size, 'dağıtılan iş'], [[...jobs.values()].filter(j => j.end && j.end.type === 'done').length, 'biten iş'], [claudeLog.length, 'son adım'], [new Set(claudeLog.map(e => e.project).filter(Boolean)).size, 'proje']];
    list = claudeLog.slice().reverse().slice(0, 12).map(e => `<li><span class="t">${esc(cap(e.label || e.state))}</span><time>${esc(e.project || '')} · ${fmtTime(e.ts)}</time></li>`).join('');
  } else if (name === OWNER) {
    const notes = feed.filter(i => i.kind === 'note' && i.ev.agent === OWNER);
    kpis = [[notes.length, 'ofisten iş'], [jobs.size, 'toplam iş'], [[...jobs.values()].filter(j => j.end && j.end.type === 'done').length, 'biten iş'], [projects.size, 'proje']];
    list = notes.slice().reverse().slice(0, 10).map(i => `<li><span class="t">${esc(i.ev.text)}</span><time>${fmtTime(i.ev.ts)}</time></li>`).join('');
  } else {
    kpis = [[mine.length, 'iş'], [ended.length ? Math.round(ok / ended.length * 100) + '%' : '—', 'başarı'], [avg ? avg + ' sn' : '—', 'ortalama süre'], [fmtTok(tok), 'token']];
    list = mine.slice().sort((a, b) => String(((b.end || b.start || b.queued) || {}).ts).localeCompare(String(((a.end || a.start || a.queued) || {}).ts))).slice(0, 10)
      .map(j => { const s = jobState(j), e = j.end || j.start || j.queued; return `<li><span class="chip ${s}">${STATUS[s]}</span><span class="t">${esc(e.title || j.id)}</span><time>${esc(jobProject(j))} · ${fmtTime(e.ts)}</time></li>`; }).join('');
  }
  const imgs = imagesOf(j => j.end.agent === name).slice(0, 8);
  profileEl.innerHTML = `<div class="top"><canvas id="pcv" width="16" height="26"></canvas><div><h2>${esc(c.label || c.name)}</h2><div class="role">${esc(c.role)}</div><div class="role" style="color:var(--purple-d);margin-top:4px">${esc(st)}</div></div><button class="x" title="Kapat">×</button></div>
    <div class="kpis">${kpis.map(([v, l]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
    ${imgs.length ? `<div class="sec">Ürettiği görseller</div><div class="imgs">${imgs.map(({ f }) => `<a href="${esc(f.url)}" target="_blank"><img src="${esc(f.url)}" alt=""></a>`).join('')}</div>` : ''}
    <div class="sec" style="margin-top:12px">${name === 'Claude' ? 'Son adımlar' : name === OWNER ? 'Verdiği işler' : 'Son işler'}</div>
    <ul class="jobs">${list || '<li><span class="t">Henüz kayıt yok</span></li>'}</ul>`;
  const pc = document.getElementById('pcv').getContext('2d');
  const fake = Object.assign({}, c, { dir: 'down', moving: false, seated: false, lounge: false, bubble: null, mug: false });
  drawCharAt(pc, fake, performance.now() / 1000, now, 2, 3);
  modal.classList.add('on');
}
function charAt(px, py) {
  let best = null;
  for (const c of CHARS.values()) {
    const top = c.y - 23 + (c.seated ? 7 : 0);
    if (px >= c.x - 7 && px <= c.x + 7 && py >= top && py <= (c.seated ? c.y + 4 : c.y + 1)) if (!best || c.y > best.y) best = c;
  }
  return best;
}
function toScene(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
cv.addEventListener('click', e => { const c = charAt(...toScene(e)); if (c) openProfile(c.name); });
cv.addEventListener('mousemove', e => cv.classList.toggle('hover', !!charAt(...toScene(e))));

// ======================================================================
//  Yeni iş
// ======================================================================
let token = null;
async function getToken() {
  if (token) return token;
  const r = await fetch('/api/token'); const d = await r.json(); token = d.token;
  const dir = document.getElementById('fDir');
  if (!dir.value) { try { dir.value = localStorage.getItem('ofis-klasor') || ''; } catch {} }
  if (!dir.value) dir.value = d.home + '\\Desktop';
  return token;
}
getToken().catch(() => {});
document.getElementById('fAgent').onchange = e => { document.getElementById('fLevel').value = e.target.value.startsWith('claude-opus-5-5') ? 'high' : 'medium'; };
// şablondaki model tabanına uyan ilk ajan seçeneğini seç
function selectAgentBase(base) {
  const sel = document.getElementById('fAgent');
  const opt = [...sel.options].find(o => o.value.split('|')[0] === base);
  if (opt) sel.value = opt.value;
}

// ---------- şablonlar ----------
const TEMPLATES = [
  { name: 'Logo', agent: 'gemini-4-argon', level: 'medium', title: 'Logo',
    prompt: 'generate_image aracıyla kare bir logo üret ve klasöre logo.png adıyla kaydet.\nMarka: [MARKA ADI]\nStil: sade, modern, düz renkler, açık arka plan, ikon + kısa simge. Yazı ekleme.\nRenkler: [RENKLER]' },
  { name: 'İkon seti', agent: 'gemini-4-argon', level: 'medium', title: 'İkon seti',
    prompt: 'generate_image aracıyla 6 ikonluk bir set üret; her ikonu ayrı görsel olarak ikon-1.png … ikon-6.png adlarıyla kaydet.\nKonular: [İKON 1], [İKON 2], [İKON 3], [İKON 4], [İKON 5], [İKON 6]\nStil: aynı çizgi kalınlığı, yuvarlak köşeler, pastel mor-pembe palet, düz arka plan.' },
  { name: 'Hero görseli', agent: 'gemini-4-argon', level: 'high', title: 'Hero görseli',
    prompt: 'generate_image aracıyla 16:9 bir web sitesi hero görseli üret ve hero.png adıyla kaydet.\nKonu: [KONU]\nStil: [STİL, ör. yumuşak 3D, pastel, stüdyo ışığı]\nSol tarafta başlık metni için sade boş alan bırak. Görselde yazı olmasın.' },
  { name: 'Oyun sprite\'ı', agent: 'gemini-4-argon', level: 'medium', title: 'Sprite',
    prompt: 'generate_image aracıyla piksel sanat bir oyun karakteri sprite sayfası üret ve sprite.png adıyla kaydet.\nKarakter: [KARAKTER]\nİçerik: ön, arka, sol, sağ duruş; her yönde 2 yürüme karesi; düz tek renk arka plan, kareler eşit aralıklı.' },
  { name: 'Sosyal medya görseli', agent: 'gemini-4-argon', level: 'medium', title: 'Sosyal medya',
    prompt: 'generate_image aracıyla 1080x1080 bir Instagram gönderisi görseli üret ve post.png adıyla kaydet.\nKonu: [KONU]\nMetin (görselde aynen yazsın): "[METİN]"\nStil: [STİL]' },
  { name: 'Ürün mockup\'ı', agent: 'gemini-4-argon', level: 'high', title: 'Mockup',
    prompt: 'generate_image aracıyla gerçekçi bir ürün mockup\'ı üret ve mockup.png adıyla kaydet.\nÜrün: [ÜRÜN]\nOrtam: [ORTAM, ör. mermer masa, yumuşak gün ışığı]\nReferans görsel eklediysen ürünün tasarımını ondan al.' },
  { name: 'Görseli düzenle', agent: 'gemini-4-argon', level: 'medium', title: 'Görsel düzenleme',
    prompt: 'Aşağıya eklediğim referans görseli generate_image aracıyla düzenle ve sonucu duzenlenmis.png adıyla kaydet.\nDeğişiklik: [NE DEĞİŞSİN]' },
  { name: 'Kod: özellik ekle', agent: 'claude-opus-5-5', level: 'high', title: 'Yeni özellik',
    prompt: 'Bu projede şu özelliği ekle: [ÖZELLİK]\nÖnce ilgili dosyaları oku, mevcut yapıya uy. Terminal komutu çalıştıramazsın; sadece dosya düzenle.\nSonunda hangi dosyaları neden değiştirdiğini kısaca özetle.' },
  { name: 'Kod: hata düzelt', agent: 'claude-sonnet-5-5', level: 'medium', title: 'Hata düzeltme',
    prompt: 'Bu projedeki şu hatayı düzelt: [HATA]\nBelirtiler: [NE OLUYOR]\nKök nedeni bul, en küçük düzeltmeyi yap ve ne değiştirdiğini özetle.' },
  { name: 'Kod: test yaz', agent: 'claude-sonnet-5-5', level: 'medium', title: 'Testler',
    prompt: '[DOSYA/MODÜL] için testler yaz. Projede kullanılan test çatısına uy, kenar durumları da kapsa. Testleri çalıştıramazsın; sadece dosyaları yaz ve nasıl çalıştırılacağını özetle.' },
];
const fTemplate = document.getElementById('fTemplate');
TEMPLATES.forEach((t, i) => { const o = document.createElement('option'); o.value = i; o.textContent = t.name; fTemplate.appendChild(o); });
fTemplate.onchange = () => {
  const t = TEMPLATES[fTemplate.value]; if (!t) return;
  const pr = document.getElementById('fPrompt');
  if (pr.value.trim() && !confirm('Görev kutusundaki metin şablonla değiştirilsin mi?')) { fTemplate.value = ''; return; }
  selectAgentBase(t.agent); document.getElementById('fLevel').value = t.level;
  document.getElementById('fTitle').value = t.title; pr.value = t.prompt; pr.focus();
  const k = pr.value.indexOf('['); if (k >= 0) pr.setSelectionRange(k, pr.value.indexOf(']', k) + 1);
};

// ---------- klasör önerileri ----------
function renderDirList() {
  const dirs = [];
  try { const d = localStorage.getItem('ofis-klasor'); if (d) dirs.push(d); } catch {}
  [...jobs.values()].map(j => j.start || j.queued).filter(Boolean).sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    .forEach(s => { if (s.workdir && !dirs.includes(s.workdir) && !/test-(run|gorsel)/.test(s.workdir)) dirs.push(s.workdir); });
  document.getElementById('dirList').innerHTML = dirs.slice(0, 15).map(d => `<option value="${esc(d)}"></option>`).join('');
}

// ---------- referans görseller ----------
let refs = []; // { path, url }
const fDrop = document.getElementById('fDrop'), fFile = document.getElementById('fFile'), fRefs = document.getElementById('fRefs');
function paintRefs() {
  fRefs.innerHTML = refs.map((r, i) => `<div class="ref"><img src="${esc(r.url)}" alt=""><button type="button" data-i="${i}" title="Kaldır">×</button></div>`).join('');
}
fRefs.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); refs.splice(Number(b.dataset.i), 1); paintRefs(); };
async function addFiles(files) {
  const msg = document.getElementById('fMsg');
  for (const f of [...files].slice(0, 6 - refs.length)) {
    if (!/^image\//.test(f.type)) continue;
    msg.className = 'msg'; msg.textContent = 'Görsel yükleniyor…';
    try {
      const d = await apiPost('/api/upload', null, { headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) }, body: f });
      refs.push({ path: d.path, url: d.url }); paintRefs(); msg.textContent = '';
    } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
  }
}
fDrop.onclick = () => fFile.click();
fDrop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fFile.click(); } };
fFile.onchange = () => { addFiles(fFile.files); fFile.value = ''; };
fDrop.ondragover = e => { e.preventDefault(); fDrop.classList.add('over'); };
fDrop.ondragleave = () => fDrop.classList.remove('over');
fDrop.ondrop = e => { e.preventDefault(); fDrop.classList.remove('over'); addFiles(e.dataTransfer.files); };
document.getElementById('taskForm').onsubmit = async e => {
  e.preventDefault();
  const msg = document.getElementById('fMsg'), btn = document.getElementById('fSubmit');
  const [mBase, agentName] = document.getElementById('fAgent').value.split('|');
  const model = mBase + '-' + document.getElementById('fLevel').value;
  const body = { model, agent: agentName, workdir: document.getElementById('fDir').value.trim(), title: document.getElementById('fTitle').value.trim(), prompt: document.getElementById('fPrompt').value.trim(), refs: refs.map(r => r.path) };
  if (/\[[^\]]+\]/.test(body.prompt) && !confirm('Görevde doldurulmamış [ ] alanları var. Yine de gönderilsin mi?')) return;
  btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Gönderiliyor…';
  try {
    const r = await fetch('/api/task', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ofis-Token': await getToken() }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Gönderilemedi');
    try { localStorage.setItem('ofis-klasor', body.workdir); } catch {}
    msg.className = 'msg ok'; msg.textContent = 'İş verildi. Ajanı ofiste izleyebilirsin.';
    document.getElementById('fPrompt').value = ''; document.getElementById('fTitle').value = ''; fTemplate.value = ''; refs = []; paintRefs();
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
  btn.disabled = false;
};

// ======================================================================
//  Günün tekrarı
// ======================================================================
const replayBtn = document.getElementById('replayBtn');
let replayTimer = null;
function resetWorld() {
  jobs.clear(); feed = []; projects.clear(); claudeLog.length = 0; internNo = 0;
  for (const c of [...CHARS.values()]) {
    c.active.clear(); c.queued = 0; c.step = ''; c.busyUntil = 0; c.bubble = null;
    if (c.temp || c.extraClaude || c.name === OWNER) removeChar(c);
  }
  INTERNS.clear(); claudeSessions.clear();
  meetings.clear(); currentMeeting = null; meetingUntil = 0; boss().hosting = null;
}
// Bir günün olaylarını hızlandırılmış oynatır (tarih ve hız seçimi extras.js'te)
function startReplay(allDay, speed = 20, label = 'Tekrar') {
  const evs = allDay.filter(e => e.type !== 'claude' || e.state !== 'busy' || /^yeni istek/.test(e.label || ''));
  if (!evs.length) { replayBtn.textContent = 'O gün olay yok'; setTimeout(() => replayBtn.textContent = 'Günü oynat', 2000); return; }
  replaying = true; resetWorld(); renderAll();
  replayBtn.textContent = 'Tekrarı durdur'; replayBtn.classList.add('on');
  const bar = document.createElement('div'); bar.className = 'replay-bar'; ov.appendChild(bar);
  live.className = 'live replay'; live.lastChild.textContent = 'tekrar';
  let i = 0;
  const next = () => {
    if (i >= evs.length) { bar.textContent = 'Tekrar bitti'; replayTimer = setTimeout(() => location.reload(), 5000); return; }
    const ev = evs[i++];
    bar.textContent = `${label} · ${fmtTime(ev.ts)} · ${i}/${evs.length} · ${speed}×`;
    handle(ev, true);
    const gap = i < evs.length ? (new Date(evs[i].ts) - new Date(ev.ts)) / 1000 : 0;
    replayTimer = setTimeout(next, Math.max(300, Math.min(4500, gap * 1000 / speed)));
  };
  next();
}
replayBtn.onclick = () => {
  if (replaying) { location.reload(); return; }
  const today = new Date().toDateString();
  startReplay(allEvents.filter(e => e.ts && new Date(e.ts).toDateString() === today));
};

// ======================================================================
//  Bağlantı
// ======================================================================
['Claude', 'Argon', 'Opus', 'Sonnet'].forEach(n => ensureChar(n));
const live = document.getElementById('live');
function connect() {
  const es = new EventSource('/events');
  es.addEventListener('history', m => {
    if (replaying) return;
    const evs = JSON.parse(m.data);
    allEvents.length = 0; allEvents.push(...evs);
    resetWorld();
    for (const ev of evs) handle(ev, false);
    for (const j of jobs.values()) {
      if (!j.end && j.start && Date.now() - new Date(j.start.ts).getTime() > 3 * 3600 * 1000) {
        j.end = { type: 'fail', agent: j.start.agent, model: j.start.model, title: j.start.title, ts: j.start.ts, summary: 'Sonuç kaydı yok (yarıda kalmış olabilir).' };
        const c = CHARS.get(j.start.agent); if (c) c.active.delete(j.id);
      }
    }
    renderAll();
  });
  es.onmessage = m => {
    const ev = JSON.parse(m.data); allEvents.push(ev);
    if (replaying) return;
    if (document.hidden) { handle(ev, false, false); scheduleRender(); } else handle(ev, true);
  };
  es.onopen = () => { if (!replaying) { live.className = 'live on'; live.lastChild.textContent = 'canlı'; } };
  es.onerror = () => { if (!replaying) { live.className = 'live'; live.lastChild.textContent = 'bağlantı yok'; } };
}
// connect() extras.js'in sonunda, ayarlar yüklendikten sonra çağrılır (patron adı geçmişten önce bilinsin)
requestAnimationFrame(frame);
