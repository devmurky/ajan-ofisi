// Claude Code komut kancası (yedek yol): girdiyi olaya çevirip events.jsonl dosyasına yazar.
// Asıl yol HTTP kancası (server.js /api/hook). Asla hata vermez, asla engellemez.
'use strict';
const fs = require('fs');
const path = require('path');
const { toEvents } = require('./hook-core');

const EVENTS = path.join(__dirname, 'events.jsonl');
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { buf += d; });
process.stdin.on('end', () => {
  try {
    const evs = toEvents(JSON.parse(buf.replace(/^﻿/, '').trim() || '{}'));
    if (evs.length) fs.appendFileSync(EVENTS, evs.map(e => JSON.stringify(e)).join('\n') + '\n');
  } catch { /* sessiz */ }
  process.exit(0);
});
setTimeout(() => process.exit(0), 2500);
