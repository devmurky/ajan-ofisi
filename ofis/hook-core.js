// Claude Code kanca girdisini Ajan Ofisi olayına çevirir (hook.js ve server.js /api/hook ortak kullanır).
'use strict';
const path = require('path');

const SKIP = /^(mcp__ccd_|ToolSearch$|TodoWrite$|TaskCreate$|TaskUpdate$|TaskList$|TaskGet$)/;
const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const base = p => (p ? path.basename(String(p)) : '');

function label(tool, input) {
  input = input || {};
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'düzenliyor: ' + base(input.file_path || input.notebook_path);
  if (tool === 'Read') return 'okuyor: ' + base(input.file_path);
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(input.command || '');
    if (/ask-agy\.ps1/.test(cmd)) return 'ajana iş veriyor';
    if (/ofis-not\.ps1/.test(cmd)) return 'ofise not yazıyor';
    return 'komut: ' + short(input.description || cmd, 48);
  }
  if (tool === 'Grep' || tool === 'Glob') return 'arıyor: ' + short(input.pattern, 40);
  if (tool === 'WebSearch') return "web'de arıyor: " + short(input.query, 40);
  if (tool === 'WebFetch') return 'sayfa okuyor';
  if (tool === 'Skill') return 'yönerge yüklüyor: ' + short(input.skill, 30);
  if (tool === 'Artifact') return 'sayfa yayınlıyor';
  if (/^mcp__(Claude_Browser|claude-in-chrome)__/.test(tool)) return 'tarayıcıda çalışıyor';
  if (/^mcp__/.test(tool)) return 'araç: ' + short(tool.split('__').pop(), 30);
  return short(tool, 40);
}

// Alt ajanlar (stajyerler): Claude Code, alt ajanın içinden gelen her kancaya agent_id ve agent_type ekler.
// Agent aracının açıklaması (başlık) alt ajan başlayana kadar oturum başına sırada bekler; ilk SubagentStart
// ya da alt ajanın ilk adımı onu alır. Bu durum sadece uzun yaşayan sunucuda (server.js) tutulur; hook.js'te
// her çağrı yeni süreç olduğu için başlık yerine ajan türü görünür.
const pending = new Map();   // session -> [{ title, kind, ts }]
const started = new Set();   // ofise intern-start yazılmış agent_id'ler
const finished = new Set();  // intern-done yazılmış agent_id'ler
const TTL = 10 * 60 * 1000;

function takePending(session, kind) {
  const list = (pending.get(session) || []).filter(p => Date.now() - p.ts < TTL);
  let i = list.findIndex(p => p.kind === kind);
  if (i < 0) i = 0;
  const p = list.length ? list.splice(i, 1)[0] : null;
  pending.set(session, list);
  return p;
}
function trim(set) { if (set.size > 500) for (const k of [...set].slice(0, 250)) set.delete(k); }

// Alt ajan için 0, 1 ya da 2 olay döndürür (gerekirse önce intern-start).
function internEvents(h, session) {
  const id = String(h.agent_id), ev = h.hook_event_name, kind = h.agent_type || '';
  const out = [];
  const start = () => {
    if (started.has(id)) return;
    started.add(id); trim(started);
    const p = takePending(session, kind);
    out.push({ type: 'intern-start', id, title: p ? p.title : (kind ? kind + ' alt görevi' : 'Alt görev'), kind: kind || (p && p.kind) || '' });
  };
  const done = ok => {
    if (finished.has(id)) return;
    finished.add(id); trim(finished);
    out.push({ type: 'intern-done', id, ok });
  };
  if (ev === 'SubagentStart') { start(); return out; }
  if (finished.has(id)) return out;
  if (ev === 'SubagentStop') { if (started.has(id)) done(true); return out; }
  const tool = h.tool_name || '';
  if (ev === 'PreToolUse') {
    start();
    if (tool === 'SubagentHandback') { done(true); return out; }   // SubagentStop kancası yoksa da kapanır
    if (SKIP.test(tool)) return out;
    out.push({ type: 'intern-step', id, label: label(tool, h.tool_input) });
  } else if (ev === 'Notification') {
    start();
    out.push({ type: 'intern-step', id, label: 'onay bekliyor: ' + short(h.message, 50), warn: true });
  }
  return out;
}

// Bir kanca girdisini sıfır ya da daha fazla ofis olayına çevirir.
function toEvents(h) {
  if (!h || typeof h !== 'object') return [];
  const session = String(h.session_id || '').slice(0, 8);
  const ev = h.hook_event_name;
  const tool = h.tool_name || '';
  let list = [];
  if (h.agent_id) {
    list = internEvents(h, session);
  } else if (ev === 'UserPromptSubmit') {
    list = [{ type: 'claude', state: 'busy', label: 'yeni istek: ' + short(h.prompt, 70) }];
  } else if (ev === 'PreToolUse') {
    if (SKIP.test(tool)) return [];
    if (tool === 'Agent' || tool === 'Task') {
      const inp = h.tool_input || {};
      const arr = pending.get(session) || [];
      arr.push({ title: short(inp.description || 'Alt görev', 60), kind: inp.subagent_type || 'general-purpose', ts: Date.now() });
      pending.set(session, arr.slice(-20));
      list = [{ type: 'claude', state: 'busy', label: 'alt ajana iş veriyor: ' + short(inp.description, 40) }];
    } else {
      list = [{ type: 'claude', state: 'busy', label: label(tool, h.tool_input) }];
    }
  } else if (ev === 'PostToolUseFailure' && (tool === 'Agent' || tool === 'Task')) {
    takePending(session, (h.tool_input || {}).subagent_type || 'general-purpose');   // ajan hiç başlamadı
  } else if (ev === 'Notification') {
    list = [{ type: 'claude', state: 'wait', label: short(h.message || 'onay bekliyor', 70) }];
  } else if (ev === 'Stop') {
    list = [{ type: 'claude', state: 'idle', label: 'sıra sende' }];
  }
  const ts = new Date().toISOString();
  for (const o of list) {
    o.agent = 'Claude';
    o.project = base(h.cwd);
    o.session = session;
    o.ts = ts;
  }
  return list;
}

// Eski arayüz: tek olay (hook.js geriye dönük uyumluluk)
function toEvent(h) {
  const l = toEvents(h);
  return l.length ? l[l.length - 1] : null;
}

module.exports = { toEvents, toEvent, label };
