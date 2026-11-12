// Ajan Ofisi sunucusu
//  - events.jsonl dosyasını izler, olayları SSE ile sayfaya aktarır
//  - iş bitince / izin gerekince Windows bildirimi gösterir
//  - sayfadan gelen işleri ask-agy.ps1 ile başlatır, iptal eder, onay/düzeltme alır (token + köken denetimi)
//  - süreci ölmüş işleri "yarıda kesildi" olarak kapatır
//  - Claude Code HTTP kancalarını /api/hook ile alır
// Bağımlılık yok. Çalıştırma: node server.js  (http://localhost:4317)
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const hookCore = require('./hook-core');

const PORT = Number(process.env.OFIS_PORT || 4317);
const HOST = '127.0.0.1';
const ROOT = __dirname;
const TOOLS = path.join(os.homedir(), 'agy-tools');
const EVENTS = process.env.OFIS_EVENTS || path.join(ROOT, 'events.jsonl');
const OUT = path.join(TOOLS, 'out');
const TASKS = path.join(OUT, 'tasks');
const UPLOADS = path.join(OUT, 'uploads');
const QUEUE_DIR = path.join(ROOT, 'queue');
const STATIC = path.join(ROOT, 'static');
const SETTINGS = path.join(ROOT, 'ayarlar.json');
const ASK = path.join(TOOLS, 'ask-agy.ps1');
const HISTORY = 2500;
const MAX_BYTES = 8 * 1024 * 1024;
const TOKEN = crypto.randomBytes(24).toString('hex');
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const MODELS = new Set([
  'gemini-4-argon-low', 'gemini-4-argon-medium', 'gemini-4-argon-high',
  'claude-opus-5-5-low', 'claude-opus-5-5-medium', 'claude-opus-5-5-high',
  'claude-sonnet-5-5-low', 'claude-sonnet-5-5-medium', 'claude-sonnet-5-5-high',
]);
const END_TYPES = new Set(['done', 'blocked', 'fail', 'cancelled']);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.jsonl': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav',
};

if (!fs.existsSync(EVENTS)) fs.writeFileSync(EVENTS, '');

function log(...a) { console.log(new Date().toLocaleTimeString('tr-TR'), ...a); }

// Olay dosyası çok büyüdüyse son satırları tut
function rotate() {
  try {
    if (fs.statSync(EVENTS).size <= MAX_BYTES) return;
    const lines = fs.readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean);
    fs.appendFileSync(EVENTS + '.old', lines.slice(0, -4000).join('\n') + '\n');
    fs.writeFileSync(EVENTS, lines.slice(-4000).join('\n') + '\n');
  } catch { /* yoksay */ }
}
rotate();

function parseLines(text) {
  const events = [];
  for (const line of text.split('\n')) {
    const t = line.replace(/^﻿/, '').trim();
    if (!t) continue;
    try { events.push(JSON.parse(t)); } catch { /* yarım ya da bozuk satır */ }
  }
  return events;
}
const readAll = () => parseLines(fs.readFileSync(EVENTS, 'utf8'));
function appendEvent(ev) {
  ev.ts = ev.ts || new Date().toISOString();
  fs.appendFileSync(EVENTS, JSON.stringify(ev) + '\n');
}

// ---------- çalışan işler (pid takibi) ----------
const running = new Map(); // job -> { pid, agent, model, title, project, ts, type }
function track(ev) {
  if (!ev.job) return;
  if (ev.type === 'queued' || ev.type === 'start') {
    const prev = running.get(ev.job) || {};
    running.set(ev.job, { ...prev, pid: ev.pid || prev.pid, agent: ev.agent, model: ev.model, title: ev.title, project: ev.project, ts: prev.ts || ev.ts, type: ev.type, seenDead: 0 });
  } else if (END_TYPES.has(ev.type)) running.delete(ev.job);
}
readAll().forEach(track);

function alive(pid) {
  if (!pid) return true;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}
function reap() {
  const now = Date.now();
  for (const [job, r] of running) {
    if (!r.pid) {
      // pid'siz eski işler: 6 saat sonra kapat
      if (now - new Date(r.ts).getTime() > 6 * 3600 * 1000) { appendEvent({ type: 'fail', job, agent: r.agent, model: r.model, title: r.title, project: r.project, reason: 'stale', summary: 'Sonuç kaydı yok; iş yarıda kalmış.' }); running.delete(job); }
      continue;
    }
    if (alive(r.pid)) { r.seenDead = 0; continue; }
    if (!r.seenDead) { r.seenDead = now; continue; } // sonuç olayının yazılmasına zaman tanı
    if (now - r.seenDead < 4000) continue;
    const secs = Math.round((now - new Date(r.ts).getTime()) / 1000);
    appendEvent({ type: 'fail', job, agent: r.agent, model: r.model, title: r.title, project: r.project, reason: 'crash', seconds: secs, summary: 'İşin süreci beklenmedik şekilde kapandı; iş yarıda kesildi.' });
    running.delete(job);
    log('yarıda kalan iş kapatıldı:', job);
  }
}
setInterval(reap, 5000);

// ---------- SSE ----------
const clients = new Set();
let offset = 0;
let partial = '';
function broadcast(ev) {
  const msg = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) res.write(msg);
}

// ---------- Windows bildirimi ----------
const TOAST_PS = `
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$esc = { param($s) [Security.SecurityElement]::Escape($s) }
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$(& $esc $env:OFIS_T)</text><text>$(& $esc $env:OFIS_B)</text></binding></visual><audio src='ms-winsoundevent:Notification.Default'/></toast>")
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show((New-Object Windows.UI.Notifications.ToastNotification $xml))
`;
const toastScript = path.join(os.tmpdir(), 'ajan-ofisi-toast.ps1');
fs.writeFileSync(toastScript, '﻿' + TOAST_PS);

function loadSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { return {}; } }
// Patron (ofisi kullanan kişi): olaylarda sabit OWNER anahtarıyla geçer, görünen ad ayarlardaki "owner" alanıdır.
const OWNER = 'Patron';
const cleanOwner = v => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
function ownerName() { return cleanOwner(loadSettings().owner) || OWNER; }

function toast(title, body) {
  if (process.env.OFIS_NO_TOAST || loadSettings().toast === false) return;
  try {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', toastScript], {
      env: { ...process.env, OFIS_T: String(title).slice(0, 120), OFIS_B: String(body).slice(0, 240) },
      windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('exit', code => { if (code) log('bildirim hatası:', code, err.trim().slice(0, 300)); });
    p.on('error', e => log('bildirim başlatılamadı:', e.message));
  } catch (e) { log('bildirim hatası:', e.message); }
}

function notify(ev) {
  const t = ev.title || ev.job || '';
  if (ev.type === 'done') toast(`${ev.agent} işi bitirdi`, `${t} · ${ev.seconds || 0} sn`);
  else if (ev.type === 'blocked') toast(ev.reason === 'auth' ? 'Antigravity girişi gerekli' : `${ev.agent} izin bekliyor`, t);
  else if (ev.type === 'fail') toast(`${ev.agent}: bir sorun çıktı`, t);
  else if (ev.type === 'claude' && ev.state === 'wait') toast('Claude onay bekliyor', ev.label || '');
  else if (ev.type === 'summary') toast('Günün özeti', ev.text || '');
  else if (ev.type === 'meeting-done') toast('Ekip raporu hazır', `${ev.topic || ''} · ${ev.project || ''}`);
}

function pump() {
  let size;
  try { size = fs.statSync(EVENTS).size; } catch { return; }
  if (size < offset) { offset = 0; partial = ''; running.clear(); readAll().forEach(track); offset = size; broadcast({ type: 'reset' }); return; }
  if (size === offset) return;
  const fd = fs.openSync(EVENTS, 'r');
  const buf = Buffer.alloc(size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  offset = size;
  const text = partial + buf.toString('utf8');
  const cut = text.lastIndexOf('\n');
  partial = cut === -1 ? text : text.slice(cut + 1);
  if (cut !== -1) for (const ev of parseLines(text.slice(0, cut))) { track(ev); broadcast(ev); notify(ev); }
}
offset = fs.statSync(EVENTS).size;
setInterval(pump, 400);
setInterval(rotate, 10 * 60 * 1000);

// ---------- günlük özet (19:00) ----------
let lastSummaryDay = '';
setInterval(() => {
  const now = new Date();
  const day = now.toDateString();
  const hour = loadSettings().summaryHour ?? 19;
  if (now.getHours() !== hour || lastSummaryDay === day) return;
  lastSummaryDay = day;
  const evs = readAll().filter(e => e.ts && new Date(e.ts).toDateString() === day);
  if (evs.some(e => e.type === 'summary')) return;
  const ended = evs.filter(e => END_TYPES.has(e.type) && !/^test/i.test(e.project || ''));
  const done = ended.filter(e => e.type === 'done');
  const imgs = done.reduce((s, e) => s + (Array.isArray(e.files) ? e.files.filter(f => f.kind === 'image').length : 0), 0);
  const byAgent = {};
  done.forEach(e => { byAgent[e.agent] = (byAgent[e.agent] || 0) + 1; });
  const who = Object.entries(byAgent).map(([a, n]) => `${a} ${n}`).join(', ');
  const text = done.length ? `Bugün ${done.length} iş bitti${imgs ? `, ${imgs} görsel üretildi` : ''}${who ? ` (${who})` : ''}.` : 'Bugün biten iş yok.';
  appendEvent({ type: 'summary', agent: 'Claude', text });
}, 60 * 1000);

// ---------- yardımcılar ----------
function sendFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('Yok'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit = 64 * 1024, raw = false) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('çok büyük')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { const b = Buffer.concat(chunks); resolve(raw ? b : b.toString('utf8')); });
    req.on('error', reject);
  });
}
// Sayfadan gelen yazma istekleri: token + aynı köken
function authorized(req) {
  const origin = (req.headers.origin || '').replace(/^https?:\/\//, '');
  return req.headers['x-ofis-token'] === TOKEN && ALLOWED_HOSTS.has(origin);
}
async function readJson(req) { return JSON.parse(await readBody(req)); }

function findJob(id) {
  const j = { id, queued: null, start: null, end: null, reviews: [] };
  for (const ev of readAll()) {
    if (ev.job !== id) continue;
    if (ev.type === 'queued') j.queued = ev;
    else if (ev.type === 'start') j.start = ev;
    else if (END_TYPES.has(ev.type)) j.end = ev;
    else if (ev.type === 'approve' || ev.type === 'reject') j.reviews.push(ev);
  }
  return j;
}

const AGENT_RE = /^[\p{L}\p{N} _-]{1,24}$/u;
function spawnJob({ prompt, workdir, model, title, addDirs = [], agent = '' }) {
  fs.mkdirSync(TASKS, { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const promptFile = path.join(TASKS, id + '.txt');
  fs.writeFileSync(promptFile, '﻿' + prompt, 'utf8');
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ASK,
    '-PromptFile', promptFile, '-WorkDir', workdir, '-Model', model];
  const cleanTitle = String(title || '').replace(/["'`$\r\n]/g, ' ').trim().slice(0, 80);
  if (cleanTitle) args.push('-Title', cleanTitle);
  for (const d of addDirs) args.push('-AddDir', d);
  if (agent && AGENT_RE.test(agent)) args.push('-Agent', agent);
  const logFile = fs.openSync(path.join(TASKS, id + '.log'), 'w');
  // Not: Windows'ta detached:true ile başlatılan PowerShell bu ortamda çalışmıyor; ayrık başlatma yok.
  const p = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', logFile, logFile] });
  p.on('exit', () => { try { fs.closeSync(logFile); } catch { /* yoksay */ } });
  p.on('error', e => log('iş başlatılamadı:', e.message));
  return id;
}
function validDir(d) { return path.isAbsolute(d) && fs.existsSync(d) && fs.statSync(d).isDirectory(); }

// ---------- API ----------
async function apiTask(req, res) {
  const body = await readJson(req);
  const prompt = String(body.prompt || '').trim();
  const workdir = String(body.workdir || '').trim();
  const model = String(body.model || '');
  const title = String(body.title || '').trim();
  if (!prompt) return json(res, 400, { error: 'Görev boş.' });
  if (!MODELS.has(model)) return json(res, 400, { error: 'Bu model kullanılamaz.' });
  if (!validDir(workdir)) return json(res, 400, { error: 'Klasör bulunamadı: ' + workdir });
  // referans görseller: yalnızca uploads klasöründen
  const refs = (Array.isArray(body.refs) ? body.refs : []).map(String)
    .filter(p => path.resolve(p).startsWith(UPLOADS + path.sep) && fs.existsSync(p)).slice(0, 6);
  let fullPrompt = prompt;
  if (refs.length) fullPrompt += `\n\nReferans görseller (generate_image aracına ImagePaths olarak ver; düzenleme isteniyorsa kaynak görsel olarak kullan):\n${refs.map(p => '- ' + p).join('\n')}`;
  const agent = String(body.agent || '').trim();
  if (agent && !AGENT_RE.test(agent)) return json(res, 400, { error: 'Geçersiz ajan adı.' });
  const id = spawnJob({ prompt: fullPrompt, workdir, model, title, addDirs: refs.length ? [UPLOADS] : [], agent });
  appendEvent({ type: 'note', agent: OWNER, owner: true, project: path.basename(workdir), text: `Ofisten iş verdi: ${title || prompt.slice(0, 60)} (${model})` });
  json(res, 200, { ok: true, id });
}

async function apiCancel(req, res) {
  const { job } = await readJson(req);
  const r = running.get(job);
  if (!r) return json(res, 404, { error: 'Bu iş çalışmıyor ya da sırada değil.' });
  if (!r.pid) return json(res, 400, { error: 'Bu işin süreç numarası yok (eski kayıt).' });
  const k = spawn('taskkill', ['/PID', String(r.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  k.on('exit', code => {
    running.delete(job);
    appendEvent({ type: 'cancelled', job, agent: r.agent, model: r.model, title: r.title, project: r.project, wasQueued: r.type === 'queued', summary: ownerName() + ' ofisten iptal etti.' });
    log('iş iptal edildi:', job, 'taskkill çıkış', code);
  });
  json(res, 200, { ok: true });
}

async function apiReview(req, res) {
  const { job, action, feedback } = await readJson(req);
  const j = findJob(job);
  const base = j.start || j.queued;
  if (!base || !j.end) return json(res, 404, { error: 'İş bulunamadı ya da henüz bitmedi.' });
  const title = j.end.title || base.title || job;
  if (action === 'approve') {
    appendEvent({ type: 'approve', agent: OWNER, owner: true, target: j.end.agent, job, project: base.project, text: `Onayladı: ${title}` });
    return json(res, 200, { ok: true });
  }
  if (action !== 'reject') return json(res, 400, { error: 'Geçersiz işlem.' });
  const fb = String(feedback || '').trim();
  if (!fb) return json(res, 400, { error: 'Ne düzeltilmesi gerektiğini yaz.' });
  if (!base.task || !base.workdir || !MODELS.has(base.model)) return json(res, 400, { error: 'İşin ilk görevi kayıtlı değil; düzeltme yeniden verilemiyor.' });
  if (!validDir(base.workdir)) return json(res, 400, { error: 'İşin klasörü artık yok: ' + base.workdir });
  const m = /· düzeltme (\d+)$/.exec(title);
  const n = m ? Number(m[1]) + 1 : 2;
  const newTitle = title.replace(/\s*· düzeltme \d+$/, '') + ` · düzeltme ${n}`;
  const prompt = [
    'Bu bir düzeltme işi. Önceki denemeyi aşağıdaki geri bildirime göre düzelt.',
    '', '## İlk görev', base.task,
    '', '## Önceki denemenin sonucu', String(j.end.summary || '(özet yok)').slice(0, 3000),
    Array.isArray(j.end.files) && j.end.files.length ? '\nÖnceki görseller (düzeltirken generate_image aracına ImagePaths ile kaynak olarak ver):\n' + j.end.files.map(f => '- ' + (f.savedTo || f.name)).join('\n') : '',
    '', '## Düzeltme isteği', fb,
  ].join('\n');
  spawnJob({ prompt, workdir: base.workdir, model: base.model, title: newTitle, agent: base.agent });
  appendEvent({ type: 'reject', agent: OWNER, owner: true, target: j.end.agent, job, project: base.project, text: `Düzeltme istedi: ${fb.slice(0, 120)}` });
  json(res, 200, { ok: true });
}

async function apiUpload(req, res) {
  const name = decodeURIComponent(String(req.headers['x-file-name'] || 'gorsel.png'));
  const ext = path.extname(name).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return json(res, 400, { error: 'Sadece görsel (png, jpg, webp, gif) yüklenebilir.' });
  const buf = await readBody(req, 15 * 1024 * 1024, true);
  if (!buf.length) return json(res, 400, { error: 'Dosya boş.' });
  fs.mkdirSync(UPLOADS, { recursive: true });
  const safe = path.basename(name, ext).replace(/[^\w\-]+/g, '_').slice(0, 40) || 'gorsel';
  const file = `${Date.now()}-${safe}${ext}`;
  fs.writeFileSync(path.join(UPLOADS, file), buf);
  json(res, 200, { ok: true, path: path.join(UPLOADS, file), url: '/out/uploads/' + encodeURIComponent(file) });
}

// Kuyruk dosyasını düzenle (sarmalayıcı aynı dosyayı özel kilitle açar; meşgulse tekrar dene)
async function editQueue(agent, fn) {
  const file = path.join(QUEUE_DIR, String(agent).replace(/[^\w\-]/g, '_') + '.json');
  for (let i = 0; i < 40; i++) {
    let fd;
    try {
      fd = fs.openSync(file, 'r+');
      const txt = fs.readFileSync(fd, 'utf8').replace(/^﻿/, '').trim();
      let list = txt ? JSON.parse(txt) : [];
      if (!Array.isArray(list)) list = [list];
      list = fn(list);
      const out = Buffer.from(JSON.stringify(list));
      fs.ftruncateSync(fd, 0); fs.writeSync(fd, out, 0, out.length, 0);
      return list;
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      await new Promise(r => setTimeout(r, 60));
    } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* yoksay */ } }
  }
  return null;
}
async function apiQueue(req, res) {
  const { job, action } = await readJson(req);
  const r = running.get(job);
  if (!r || r.type !== 'queued') return json(res, 404, { error: 'Bu iş sırada değil.' });
  if (action !== 'front') return json(res, 400, { error: 'Geçersiz işlem.' });
  const list = await editQueue(r.agent, l => { const i = l.findIndex(x => x.job === job); if (i > 0) l.unshift(l.splice(i, 1)[0]); return l; });
  if (!list) return json(res, 409, { error: 'Kuyruk dosyası şu an meşgul, tekrar dene.' });
  appendEvent({ type: 'reorder', agent: r.agent, job, order: list.map(x => x.job) });
  json(res, 200, { ok: true, order: list.map(x => x.job) });
}

// Claude Code HTTP kancası: tarayıcıdan gelemesin diye Origin olmamalı ve içerik JSON olmalı
async function apiHook(req, res) {
  if (req.headers.origin || !/application\/json/i.test(req.headers['content-type'] || '')) return json(res, 403, { error: 'izin yok' });
  let h;
  try { h = JSON.parse(await readBody(req, 8 * 1024 * 1024)); } catch { return json(res, 200, {}); }
  const evs = hookCore.toEvents(h);
  if (evs.length) fs.appendFileSync(EVENTS, evs.map(e => JSON.stringify(e)).join('\n') + '\n');
  json(res, 200, {});
}

// ---------- ekip toplantısı ----------
const ROLE_DIR = path.join(TOOLS, 'ekip', 'roller');
const MEETING = path.join(TOOLS, 'toplanti.ps1');
function readRoles() {
  let files = [];
  try { files = fs.readdirSync(ROLE_DIR).filter(f => f.endsWith('.md')); } catch { return []; }
  return files.map(f => {
    const txt = fs.readFileSync(path.join(ROLE_DIR, f), 'utf8').replace(/^﻿/, '');
    const meta = { file: f.replace(/\.md$/, '') };
    const m = /^\s*---\s*\r?\n([\s\S]*?)\r?\n---/.exec(txt);
    if (m) for (const l of m[1].split(/\r?\n/)) { const kv = /^\s*(\w+)\s*:\s*(.+?)\s*$/.exec(l); if (kv) meta[kv[1]] = kv[2]; }
    const focus = (/^# .+\r?\n\r?\n(.+)$/m.exec(txt) || [])[1] || '';
    return { file: meta.file, ad: meta.ad || meta.file, baslik: meta.baslik || meta.ad, model: meta.model || '', sira: Number(meta.sira) || 50, raportor: meta.raportor === 'true', odak: focus, yol: path.join(ROLE_DIR, f) };
  }).sort((a, b) => a.sira - b.sira);
}
async function apiMeeting(req, res) {
  const body = await readJson(req);
  const workdir = String(body.workdir || '').trim();
  if (!validDir(workdir)) return json(res, 400, { error: 'Klasör bulunamadı: ' + workdir });
  const roles = readRoles().filter(r => !r.raportor).map(r => r.file);
  const want = (Array.isArray(body.roles) ? body.roles : []).map(String).filter(r => roles.includes(r));
  if (!want.length) return json(res, 400, { error: 'En az bir uzman seç.' });
  fs.mkdirSync(TASKS, { recursive: true });
  const id = Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const briefFile = path.join(TASKS, id + '.ozet.txt');
  fs.writeFileSync(briefFile, String(body.brief || ''), 'utf8');
  const topic = String(body.topic || 'Proje başlangıç toplantısı').replace(/["'`$\r\n]/g, ' ').trim().slice(0, 80) || 'Ekip toplantısı';
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', MEETING,
    '-WorkDir', workdir, '-BriefFile', briefFile, '-Topic', topic, '-Roles', want.join(',')];
  const logFile = fs.openSync(path.join(TASKS, id + '.toplanti.log'), 'w');
  const p = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', logFile, logFile] });
  p.on('exit', () => { try { fs.closeSync(logFile); } catch { /* yoksay */ } });
  p.on('error', e => log('toplantı başlatılamadı:', e.message));
  appendEvent({ type: 'note', agent: OWNER, owner: true, project: path.basename(workdir), text: `Ekip toplantısı istedi: ${topic} (${want.length} uzman)` });
  json(res, 200, { ok: true });
}

// Tüm olaylar (eski arşiv dahil)
function readEverything() {
  let old = [];
  try { old = parseLines(fs.readFileSync(EVENTS + '.old', 'utf8')); } catch { /* yok */ }
  return old.concat(readAll());
}
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// İstatistik: son 14 gün ajan başına biten iş, ajan özetleri, son 8 hafta Argon kullanımı
function apiStats(req, res, url) {
  const hideTests = url.searchParams.get('tests') !== '1';
  const ends = readEverything().filter(e => END_TYPES.has(e.type) && e.ts && !(hideTests && /^test[-_ ]?/i.test(e.project || '')));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); days.push(dayKey(d)); }
  const daily = {}; // ajan -> [14]
  const agents = {};
  const monday = new Date(today); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = [];
  for (let i = 7; i >= 0; i--) { const d = new Date(monday); d.setDate(d.getDate() - i * 7); weeks.push({ start: dayKey(d), t: d.getTime(), jobs: 0, tokens: 0, seconds: 0 }); }
  for (const e of ends) {
    const d = new Date(e.ts);
    const a = e.agent || 'Ajan';
    const s = agents[a] || (agents[a] = { jobs: 0, done: 0, fail: 0, blocked: 0, cancelled: 0, seconds: 0, tokens: 0, images: 0 });
    s.jobs++; s[e.type] = (s[e.type] || 0) + 1; s.seconds += e.seconds || 0; s.tokens += e.tokens || 0;
    s.images += Array.isArray(e.files) ? e.files.filter(f => f.kind === 'image').length : 0;
    const k = days.indexOf(dayKey(d));
    if (k >= 0 && e.type === 'done') (daily[a] || (daily[a] = new Array(14).fill(0)))[k]++;
    if (/argon/.test(e.model || '')) {
      for (let w = weeks.length - 1; w >= 0; w--) if (d.getTime() >= weeks[w].t) { weeks[w].jobs++; weeks[w].tokens += e.tokens || 0; weeks[w].seconds += e.seconds || 0; break; }
    }
  }
  json(res, 200, { days, daily, agents, argonWeeks: weeks.map(({ t, ...w }) => w) });
}

// Bir günün olayları (tekrar için)
function apiEvents(req, res, url) {
  const date = url.searchParams.get('date') || dayKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: 'Tarih YYYY-AA-GG olmalı.' });
  json(res, 200, readEverything().filter(e => e.ts && dayKey(new Date(e.ts)) === date));
}

async function apiSettings(req, res) {
  if (req.method === 'GET') return json(res, 200, loadSettings());
  if (!authorized(req)) return json(res, 403, { error: 'izin yok' });
  const body = await readJson(req);
  const cur = loadSettings();
  const next = { ...cur, ...body };
  if ('owner' in next) { next.owner = cleanOwner(next.owner); if (!next.owner) delete next.owner; }
  fs.writeFileSync(SETTINGS, JSON.stringify(next, null, 2));
  appendEvent({ type: 'settings' });
  json(res, 200, next);
}

// ---------- HTTP ----------
const POST_ROUTES = { '/api/task': apiTask, '/api/cancel': apiCancel, '/api/review': apiReview, '/api/upload': apiUpload, '/api/queue': apiQueue, '/api/meeting': apiMeeting };

const server = http.createServer(async (req, res) => {
  // DNS yeniden bağlama saldırılarına karşı sadece yerel Host
  if (!ALLOWED_HOSTS.has(req.headers.host || '')) { res.writeHead(403); res.end(); return; }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return sendFile(res, path.join(ROOT, 'index.html'));
    if (req.method === 'GET' && p === '/rapor') return sendFile(res, path.join(ROOT, 'rapor.html'));
    if (req.method === 'GET' && p.startsWith('/static/')) {
      const file = path.resolve(STATIC, '.' + p.slice(7));
      if (!file.startsWith(STATIC + path.sep)) { res.writeHead(403); res.end(); return; }
      return sendFile(res, file);
    }
    if (req.method === 'GET' && p === '/api/token') return json(res, 200, { token: TOKEN, home: os.homedir() });
    if (p === '/api/settings') return await apiSettings(req, res);
    if (req.method === 'GET' && p === '/api/stats') return apiStats(req, res, url);
    if (req.method === 'GET' && p === '/api/events') return apiEvents(req, res, url);
    if (req.method === 'GET' && p === '/api/roles') return json(res, 200, readRoles());
    if (req.method === 'POST' && p === '/api/hook') return await apiHook(req, res);
    if (req.method === 'POST' && POST_ROUTES[p]) {
      if (!authorized(req)) return json(res, 403, { error: 'izin yok' });
      return await POST_ROUTES[p](req, res);
    }
    if (req.method === 'GET' && p === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: history\ndata: ${JSON.stringify(readAll().slice(-HISTORY))}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (req.method === 'GET' && p.startsWith('/out/')) {
      const file = path.resolve(OUT, '.' + p.slice(4));
      if (!file.startsWith(OUT + path.sep)) { res.writeHead(403); res.end(); return; }
      return sendFile(res, file);
    }
    res.writeHead(404); res.end('Yok');
  } catch (e) {
    log('istek hatası:', p, e.message);
    if (!res.headersSent) json(res, 500, { error: String(e.message || e) });
  }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { log(`Ajan Ofisi zaten açık: http://localhost:${PORT}`); process.exit(0); }
  throw e;
});
server.listen(PORT, HOST, () => {
  log(`Ajan Ofisi: http://localhost:${PORT}`);
  log(`Olaylar: ${EVENTS}`);
});
