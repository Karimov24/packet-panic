document.title = 'Default Deny';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 240, H = 320;
const F8 = "8px 'Press Start 2P', monospace";
const F16 = "16px 'Press Start 2P', monospace";
const GREEN = '#33ff66', AMBER = '#ffd400', RED = '#ff4d4d', CYAN = '#4de1ff', WHITE = '#ffffff';
const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
try { if (document.fonts) document.fonts.load(F8); } catch (e) {}

/* ---------- Death Screen MP3 ---------- */
const deathMusic = new Audio('death.mp3');
deathMusic.loop = true;
deathMusic.preload = 'auto';
function startDeathMusic() {
  try {
    deathMusic.currentTime = 0;
    const p = deathMusic.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
function stopDeathMusic() {
  try { deathMusic.pause(); deathMusic.currentTime = 0; } catch (e) {}
}

let token = null, board = [], overAt = 0;
let runLog = [], missLog = [], runT0 = 0;
let namePending = false, myId = null, myName = '', myRank = 0, postMsg = '';
let helpPage = 0;

let streak = 0;
let gotStreak5 = false, gotStreak10 = false, gotStreak20 = false;
let streakBanner = '', streakBannerT = 0;

/* ---------- Boss + Ability State ---------- */
let boss = null;
let bossDefeatedLevels = {};
let dpiT = 0, copT = 0, copCd = 0;
let quarantine = 0, purges = 0;
let lasers = [];
let offer = [], cardsAt = 0;

const BOSSES = [
  { title: 'ZERO-DAY: LOG4SHELL', tokens: ['${jndi:', 'ldap:', 'evil.io}'] },
  { title: 'ZERO-DAY: WANNACRY', tokens: ['SMBv1', 'ETERNAL', 'LOCKED$'] },
  { title: 'ZERO-DAY: SOLARWINDS', tokens: ['SUNBURST', 'DLL', 'C2.evil'] },
  { title: 'ZERO-DAY: STUXNET', tokens: ['LNK', 'PLC', 'ROTOR'] },
];

const ABILITIES = [
  { id: 'dpi', name: 'DPI SCAN', type: 'TIMED 15S', color: CYAN,
    lines: ['SLOW-MO 30%', 'THREATS GLOW', 'AND GET TAGGED'] },
  { id: 'quar', name: 'QUARANTINE', type: 'PASSIVE', color: GREEN,
    lines: ['NEXT BREACH', 'IS ABSORBED', 'STACKS TO 2'] },
  { id: 'purge', name: 'IPS PURGE', type: 'ACTIVE', color: AMBER,
    lines: ['WIPES ALL', 'THREATS NOW', 'SPACE OR BTN', 'HOLDS UP TO 2'] },
  { id: 'ai', name: 'AI COPILOT', type: 'TIMED 20S', color: '#c58bff',
    lines: ['LASER SNIPES', 'A THREAT', 'EVERY 3S'] },
];

function logEv(k) {
  if (runLog.length < 4000) runLog.push([Math.round(performance.now() - runT0), k]);
}
function seenHelp() { try { return localStorage.getItem('dd_seen') === '1'; } catch (e) { return false; } }
function markSeen() { try { localStorage.setItem('dd_seen', '1'); } catch (e) {} }

async function startRun() {
  try { token = (await (await fetch('/api/start', { method: 'POST' })).json()).token; }
  catch (e) { token = null; }
}
async function loadBoard() {
  try { board = await (await fetch('/api/top')).json(); } catch (e) {}
}

/* ---------- Name Modal ---------- */
const box = document.createElement('div');
box.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
  'background:rgba(0,0,0,.82);z-index:10;font-family:"Press Start 2P",monospace;color:#33ff66';
box.innerHTML =
  '<div style="border:2px solid #ff4d4d;background:#050505;padding:16px;width:min(86vw,320px);text-align:center">' +
  '<div style="font-size:11px;color:#ff4d4d;margin-bottom:12px;line-height:1.4">IDENTITY PROTOCOL</div>' +
  '<input id="nm" maxlength="12" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="AGENT NAME" ' +
  'style="width:100%;box-sizing:border-box;padding:10px;background:#000;color:#ffd400;border:2px solid #33ff66;' +
  'font-family:inherit;font-size:11px;text-align:center;outline:none">' +
  '<div id="nmErr" style="font-size:8px;color:#ffd400;min-height:12px;margin:10px 0"></div>' +
  '<button id="nmOk" style="font-family:inherit;font-size:10px;padding:9px;margin:4px;background:#33ff66;color:#000;border:0;cursor:pointer">SUBMIT</button>' +
  '<button id="nmSkip" style="font-family:inherit;font-size:10px;padding:9px;margin:4px;background:#000;color:#4de1ff;border:2px solid #4de1ff;cursor:pointer">SKIP</button>' +
  '<div style="font-size:7px;margin-top:10px;color:#888888">SKIPPING ASSIGNS ANONYMOUS #ID</div></div>';

if (document.body) document.body.appendChild(box);
else window.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));

const nm = box.querySelector('#nm'), nmErr = box.querySelector('#nmErr');

function showNameBox() {
  if (!token) { loadBoard(); return; }
  namePending = true;
  setTimeout(() => {
    if (!namePending) return;
    nm.value = ''; nmErr.textContent = '';
    box.style.display = 'flex';
    if (!coarse) nm.focus();
  }, 1600);
}

async function sendScore(name) {
  const t = token; token = null;
  box.style.display = 'none';
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t, name, score, log: runLog, misses: missLog })
    });
    if (res.ok) {
      const j = await res.json();
      myId = j.id; myName = j.name; myRank = j.rank;
    } else {
      let j2 = {};
      try { j2 = await res.json(); } catch (e) {}
      postMsg = j2.cheat ? ('CHEAT LOGGED: ' + String(j2.alias).toUpperCase()) : 'REJECTED';
    }
  } catch (e) { postMsg = 'OFFLINE'; }
  namePending = false;
  loadBoard();
}

function submitName() {
  const v = nm.value.replace(/\s+/g, ' ').trim();
  if (!v) { nmErr.textContent = 'TYPE A NAME OR SKIP'; return; }
  if (!/^[A-Za-z0-9 _-]{1,12}$/.test(v)) { nmErr.textContent = 'LETTERS NUMBERS _ - ONLY'; return; }
  if (/^anonymous/i.test(v)) { nmErr.textContent = 'PREFIX RESERVED'; return; }
  sendScore(v);
}
box.querySelector('#nmOk').addEventListener('click', submitName);
box.querySelector('#nmSkip').addEventListener('click', () => sendScore(null));
nm.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });

/* ---------- Audio Helpers ---------- */
let localAudioCtx = null;
function getAudio() {
  if (typeof audio === 'function') {
    try { audio(); } catch (e) {}
  }
  try {
    localAudioCtx = localAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (localAudioCtx && localAudioCtx.state === 'suspended') localAudioCtx.resume();
    return localAudioCtx;
  } catch (e) {
    return null;
  }
}

function playHealTone(full) {
  const a = getAudio();
  if (!a) return;
  try {
    const t0 = a.currentTime;
    const notes = full ? [261.6, 329.6, 392.0, 523.2, 659.2] : [392.0, 523.2, 659.2];
    notes.forEach((f, idx) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const start = t0 + idx * 0.08;
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.2, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + (full ? 0.35 : 0.22));
      o.connect(g); g.connect(a.destination);
      o.start(start); o.stop(start + (full ? 0.38 : 0.25));
    });
  } catch (e) {}
}

function blip(freq, dur, type, vol) {
  const a = getAudio();
  if (!a) return;
  try {
    const t0 = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(freq * 0.4, t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) {}
}

function deathSound() {
  const a = getAudio();
  if (!a) return;
  try {
    const t0 = a.currentTime, g = a.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    g.connect(a.destination);
    [180, 110, 55].forEach(f => {
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(25, t0 + 1.4);
      o.connect(g); o.start(t0); o.stop(t0 + 1.6);
    });
  } catch (e) {}
}

/* ---------- Content ---------- */
const GOOD = [
  'TCP :443 HTTPS', 'TCP :22 SSH admin', 'UDP :53 DNS', 'TCP :80 GET /home',
  'paypal.com', 'github.com', 'TCP :443 login OK', 'NTP :123 time sync',
];
const BAD = [
  { t: "' OR 1=1 --", why: 'SQL Injection breaks DB logic', tag: 'SQLI' },
  { t: "'; DROP TABLE users", why: 'SQL Injection drops table', tag: 'SQLI' },
  { t: '<script>alert(1)', why: 'XSS script payload', tag: 'XSS' },
  { t: 'TCP :23 telnet', why: 'Telnet sends plaintext data', tag: 'PLAINTEXT' },
  { t: 'TCP :3389 RDP', why: 'Open RDP invites ransomware', tag: 'RDP EXPOSED' },
  { t: '../../etc/passwd', why: 'Directory Traversal reads files', tag: 'TRAVERSAL' },
  { t: 'admin:admin login', why: 'Default unhardened login', tag: 'DEFAULT CRED' },
  { t: 'TCP :445 SMB', why: 'Open SMB enables network worms', tag: 'SMB WORM' },
];
const LOOKALIKE = [
  { t: 'paypa1-login.com', why: 'Phishing: 1 instead of l', tag: 'PHISHING' },
  { t: 'g00gle-security.com', why: 'Phishing: 0 instead of o', tag: 'PHISHING' },
  { t: 'arnazon.com', why: 'Typosquat: rn looks like m', tag: 'TYPOSQUAT' },
  { t: 'micros0ft-support.net', why: 'Phishing domain disguise', tag: 'PHISHING' },
];
const SCAN = [
  { t: 'SCAN :21 :22 :23', why: 'Port scan probing entry', tag: 'RECON' },
  { t: 'SCAN :80 :443 :8080', why: 'Reconnaissance probe', tag: 'RECON' },
];

const HELP = [
  { h: 'YOU ARE THE FIREWALL', lines: [
    ['INCOMING PACKETS FALL', GREEN], ['TOWARD YOUR SERVERS.', GREEN], ['', ''],
    ['MALICIOUS PACKETS', RED], ['TAP TO BLOCK THEM!', RED], ['', ''],
    ['SAFE TRAFFIC', GREEN], ['LET PASS TO NETWORK', GREEN], ['', ''],
    ['BE ALERT:', AMBER], ['NEVER TAP EVERYTHING BLINDLY', AMBER],
  ] },
  { h: 'SPOTTING THREATS', lines: [
    ["' OR 1=1 --  <SCRIPT>", RED], ['= SQLI & XSS EXPLOITS', '#cccccc'], ['', ''],
    ['../../ PASSWD', RED], ['= DIRECTORY TRAVERSAL', '#cccccc'], ['', ''],
    ['TELNET :23  SMB :445', RED], ['= INSECURE PROTOCOLS', '#cccccc'], ['', ''],
    ['PAYPA1  G00GLE', RED], ['= PHISHING LOOKALIKES', '#cccccc'], ['', ''],
    ['SCAN :80 :443', RED], ['= RECON PROBES', '#cccccc'],
  ] },
  { h: 'ZERO-DAY BOSS WAVES', lines: [
    ['EVERY 5TH LEVEL:', RED], ['A ZERO-DAY DESCENDS', RED], ['', ''],
    ['TAP ALL 3 RED TOKENS', CYAN], ['BEFORE IT BREACHES!', CYAN], ['', ''],
    ['WIN = PICK 1 OF 2 CARDS:', GREEN], ['', ''],
    ['DPI SCAN  QUARANTINE', AMBER], ['IPS PURGE  AI COPILOT', AMBER], ['', ''],
    ['SPACE OR [PURGE] = BOMB', WHITE],
  ] },
];

let state = 'title', packets = [], parts = [], score = 0, lives = 3, combo = 1, level = 1, banner = 0;
let spawnT = 0, speed = 14, last = performance.now();
let stars = Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 5 + Math.random() * 15 }));

/* ---------- Red Team Debrief ---------- */
let debrief = null, debriefLoading = false, debriefSeq = 0;

function rankFor(s) {
  return s >= 1800 ? 'CISO' : s >= 1000 ? 'SECURITY ENGINEER' : s >= 600 ? 'SOC ANALYST L2'
    : s >= 300 ? 'SOC ANALYST L1' : s >= 100 ? 'SCRIPT KIDDIE' : 'COMPROMISED HOST';
}

function wrap2(t) {
  const lines = [''];
  for (const w of String(t).split(' ')) {
    const cur = lines[lines.length - 1];
    const next = (cur + ' ' + w).trim();
    if (next.length <= 28) lines[lines.length - 1] = next;
    else if (lines.length < 2) lines.push(w);
  }
  return lines;
}

function localDebrief() {
  const m = missLog[missLog.length - 1];
  let tip = 'Clean defense. Watch lookalike domains.';
  if (m) tip = m.type === 'FALSE BLOCK' ? 'You blocked safe traffic. Read before you tap.' : 'Missed: ' + m.why;
  return { rank: rankFor(score), tip: wrap2(tip), source: 'local' };
}

async function loadDebrief() {
  const mine = ++debriefSeq;
  debrief = null; debriefLoading = true;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4500);
  try {
    const res = await fetch('/api/debrief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({ score, level, misses: missLog.slice(-3) })
    });
    if (!res.ok) throw new Error('bad');
    const j = await res.json();
    if (mine === debriefSeq) debrief = { rank: j.rank, tip: j.tip, source: j.source };
  } catch (e) {
    if (mine === debriefSeq) debrief = localDebrief();
  }
  clearTimeout(timer);
  if (mine === debriefSeq) debriefLoading = false;
}

function reset() {
  stopDeathMusic();
    debriefSeq++; debrief = null; debriefLoading = false;
  packets = []; parts = []; lasers = []; score = 0; lives = 3; combo = 1; level = 1; banner = 2;
  streak = 0; gotStreak5 = false; gotStreak10 = false; gotStreak20 = false;
  streakBanner = ''; streakBannerT = 0;
  boss = null; bossDefeatedLevels = {};
  dpiT = 0; copT = 0; copCd = 0; quarantine = 0; purges = 0; offer = [];
  spawnT = 0; speed = 14; state = 'play';
  myId = null; myName = ''; myRank = 0; postMsg = ''; namePending = false;
  box.style.display = 'none';
  runLog = []; missLog = []; runT0 = performance.now();
  startRun();
  if (typeof sfx !== 'undefined' && sfx.start) sfx.start();
}

const pick = a => a[Math.floor(Math.random() * a.length)];
function textW(t) { ctx.font = F8; return Math.ceil(ctx.measureText(t).width) + 10; }

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.28, v = 30 + Math.random() * 70;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, c: color });
  }
}

function setBanner(t, secs) { streakBanner = t; streakBannerT = secs; }

/* ---------- Boss ---------- */
function spawnBoss() {
  packets = [];
  const cycle = Math.floor(level / 5) - 1;
  const def = BOSSES[((cycle % BOSSES.length) + BOSSES.length) % BOSSES.length];
  ctx.font = F8;
  const widths = def.tokens.map(t => Math.ceil(ctx.measureText(t).width) + 8);
  const total = widths.reduce((a, b) => a + b, 0);
  const gap = Math.max(2, (W - 16 - total) / (def.tokens.length + 1));
  let x = 8 + gap;
  const tokens = def.tokens.map((t, i) => {
    const tk = { text: t, hit: false, x, w: widths[i] };
    x += widths[i] + gap;
    return tk;
  });
  boss = {
    title: def.title, y: -46,
    speed: 8.5 + Math.min(cycle, 4) * 1.5,
    hp: tokens.length, tokens
  };
}

function defuseToken(tok) {
  tok.hit = true;
  boss.hp--;
  const by = boss.y + 20;
  burst(tok.x + tok.w / 2, by + 8, CYAN, 12);
  if (typeof sfx !== 'undefined' && sfx.zap) sfx.zap();
  score += 25;
  logEv('k');
  if (boss.hp <= 0) {
    burst(W / 2, by + 8, AMBER, 35);
    bossDefeatedLevels[level] = true;
    boss = null;
    openCards();
  }
}

/* ---------- Ability Cards ---------- */
function openCards() {
  const pool = ABILITIES.slice().sort(() => Math.random() - 0.5);
  offer = pool.slice(0, 2);
  cardsAt = performance.now();
  state = 'cards';
  playHealTone(true);
}

function grant(id) {
  if (id === 'dpi') { dpiT = 15; setBanner('DPI SCAN ONLINE: 15S', 2.2); }
  else if (id === 'quar') { quarantine = Math.min(2, quarantine + 1); setBanner('QUARANTINE x' + quarantine, 2.2); }
  else if (id === 'purge') { purges = Math.min(2, purges + 1); setBanner('IPS PURGE READY x' + purges, 2.2); }
  else if (id === 'ai') { copT = 20; copCd = 1.2; setBanner('AI COPILOT ONLINE: 20S', 2.2); }
  logEv('a');
}

function chooseCard(i) {
  if (!offer[i]) return;
  grant(offer[i].id);
  blip(900, 0.25, 'triangle', 0.18);
  state = 'play';
  spawnT = 1.6;
  last = performance.now();
}

function cardRect(i) { return { x: i === 0 ? 8 : 124, y: 96, w: 108, h: 150 }; }

/* ---------- IPS Purge ---------- */
function usePurge() {
  if (state !== 'play' || purges <= 0) return;
  if (boss) {
    const tok = boss.tokens.find(t => !t.hit);
    if (!tok) return;
    purges--;
    defuseToken(tok);
    blip(300, 0.4, 'sawtooth', 0.2);
    return;
  }
  const bad = packets.filter(p => p.bad);
  if (!bad.length) return;
  purges--;
  for (const p of bad) {
    burst(p.x + p.w / 2, p.y + 10, AMBER, 14);
    score += p.flood ? 3 : 5;
    streak++;
    logEv(p.flood ? 'v' : 'u');
  }
  packets = packets.filter(p => !p.bad);
  checkStreakRewards();
  setBanner('IPS PURGE EXECUTED', 1.6);
  blip(200, 0.6, 'sawtooth', 0.25);
}

function purgeBtnHit(x, y) {
  return purges > 0 && x >= W - 66 && x <= W - 4 && y >= H - 40 && y <= H - 18;
}

function spawn() {
  if (boss) return;
  const r = Math.random();
  if (level >= 4 && r < 0.08) {
    for (let i = 0; i < 4; i++)
      packets.push({ t: 'SYN', bad: true, flood: true, why: 'SYN flood exhaustion', tag: 'SYN FLOOD',
        b: 'fast', x: 10 + i * 55, x0: 0, y: -20 - i * 25, w: 44, h: 20 });
    return;
  }

  let p, b = 'norm';
  if (level <= 2) {
    p = r < 0.55 ? { t: pick(GOOD), bad: false } : { ...pick(BAD), bad: true };
  } else if (level <= 4) {
    if (r < 0.45) p = { t: pick(GOOD), bad: false };
    else if (r < 0.78) p = { ...pick(BAD), bad: true };
    else { p = { ...pick(LOOKALIKE), bad: true }; b = 'zig'; }
  } else {
    if (r < 0.42) p = { t: pick(GOOD), bad: false };
    else if (r < 0.68) p = { ...pick(BAD), bad: true };
    else if (r < 0.86) { p = { ...pick(LOOKALIKE), bad: true }; b = 'zig'; }
    else { p = { ...pick(SCAN), bad: true }; b = 'sweep'; }
  }

  p.hint = p.bad && (level <= 2 || (level === 3 && Math.random() < 0.65));
  p.w = textW(p.t); p.h = 20; p.y = -20; p.b = b;
  const room = W - p.w;
  if (b === 'zig') { p.x0 = room / 2; p.amp = Math.max(6, Math.min(35, room / 2 - 2)); p.x = p.x0; }
  else if (b === 'sweep') { p.x = 5; p.vx = 50; }
  else { p.x = 4 + Math.random() * Math.max(1, room - 8); }
  packets.push(p);
}

function checkStreakRewards() {
  if (streak >= 20 && !gotStreak20) {
    gotStreak20 = true;
    lives = 3;
    logEv('h');
    setBanner('20 STREAK: FULL SHIELD!', 2.0);
    playHealTone(true);
  } else if (streak >= 10 && !gotStreak10) {
    if (lives < 3) {
      gotStreak10 = true;
      lives = Math.min(3, lives + 1);
      logEv('h');
      setBanner('10 STREAK: +1 REPAIRED', 1.8);
      playHealTone(false);
    }
  } else if (streak >= 5 && !gotStreak5) {
    if (lives < 3) {
      gotStreak5 = true;
      lives = Math.min(3, lives + 1);
      logEv('h');
      setBanner('5 STREAK: +1 REPAIRED', 1.8);
      playHealTone(false);
    }
  }
}

function loseLife(kind) {
  if (kind === 'breach' && quarantine > 0) {
    quarantine--;
    setBanner('QUARANTINED! BREACH ABSORBED', 1.8);
    blip(500, 0.3, 'triangle', 0.18);
    return;
  }
  lives--; combo = 1; streak = 0;
  if (typeof sfx !== 'undefined') {
    if (kind === 'breach' && sfx.breach) sfx.breach();
    else if (sfx.wrong) sfx.wrong();
  }
  if (lives <= 0) {
    state = 'over'; overAt = performance.now();
    deathSound();
    startDeathMusic();
    showNameBox();
    loadDebrief();
  }
}

function update(dt) {
  const newLevel = 1 + Math.floor(score / 150);
  if (newLevel > level) {
    level = newLevel; banner = 2.2;
    if (typeof sfx !== 'undefined' && sfx.level) sfx.level();
  }

  if (level % 5 === 0 && !boss && !bossDefeatedLevels[level]) spawnBoss();

  if (banner > 0) banner -= dt;
  if (streakBannerT > 0) streakBannerT -= dt;
  if (dpiT > 0) dpiT = Math.max(0, dpiT - dt);
  if (copT > 0) copT = Math.max(0, copT - dt);

  const dtm = dt * (dpiT > 0 ? 0.7 : 1);

  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  parts = parts.filter(q => q.life > 0);
  for (const l of lasers) l.life -= dt;
  lasers = lasers.filter(l => l.life > 0);

  if (boss) {
    boss.y += boss.speed * dtm;
    if (boss.y > H - 24) {
      missLog.push({ type: 'ZERO-DAY BREACH', text: boss.title.replace('ZERO-DAY: ', ''), why: 'Unpatched zero-day breached firewall' });
      boss = null;
      bossDefeatedLevels[level] = true;
      logEv(quarantine > 0 ? 'q' : 'b');
      loseLife('breach');
    }
    return;
  }

  // AI Copilot
  if (copT > 0) {
    copCd -= dt;
    if (copCd <= 0) {
      let tgt = null;
      for (const p of packets) if (p.bad && p.y > 0 && (!tgt || p.y > tgt.y)) tgt = p;
      if (tgt) {
        packets.splice(packets.indexOf(tgt), 1);
        lasers.push({ x: tgt.x + tgt.w / 2, y: tgt.y + 10, life: 0.2 });
        burst(tgt.x + tgt.w / 2, tgt.y + 10, '#c58bff', 12);
        score += 10; streak++;
        logEv('c');
        checkStreakRewards();
        blip(1200, 0.15, 'square', 0.1);
        copCd = 3;
      } else {
        copCd = 0.5;
      }
    }
  }

  spawnT -= dt;
  if (spawnT <= 0) {
    spawn();
    if (level === 1) spawnT = Math.max(1.6, 2.4 - score / 400);
    else if (level <= 3) spawnT = Math.max(1.2, 2.0 - score / 500);
    else spawnT = Math.max(0.65, 1.4 - score / 600);
  }

  speed = (level === 1 ? 14 : level === 2 ? 18 : level <= 4 ? 24 : 32) + score / 14;

  for (const p of packets) {
    p.y += (p.b === 'fast' ? speed * 2.1 : speed) * dtm;
    if (p.b === 'zig') p.x = p.x0 + Math.sin(p.y / 14) * p.amp;
    if (p.b === 'sweep') {
      p.x += p.vx * dtm;
      if (p.x < 5 || p.x > W - p.w - 5) p.vx = -p.vx;
    }
  }

  const survivors = [];
  for (const p of packets) {
    if (p.y > H) {
      if (p.bad && p.flood) {
        logEv('m'); score = Math.max(0, score - 5); streak = 0;
      } else if (p.bad) {
                logEv(quarantine > 0 ? 'q' : 'b');
        missLog.push({ type: 'BREACH', text: p.t, why: p.why });
        loseLife('breach');
      } else {
        logEv('g'); score += 1;
        streak++;
        checkStreakRewards();
      }
    } else {
      survivors.push(p);
    }
  }
  packets = survivors;
}

function tap(x, y) {
  if (state === 'title') {
    if (y > 243 && y < 264 && x > 50 && x < 190) { helpPage = 0; state = 'help'; return; }
    if (!seenHelp()) { helpPage = 0; state = 'help'; return; }
    reset(); return;
  }
  if (state === 'help') {
    helpPage++;
    if (helpPage >= HELP.length) { markSeen(); reset(); }
    return;
  }
  if (state === 'cards') {
    if (performance.now() - cardsAt < 500) return;
    for (let i = 0; i < offer.length; i++) {
      const c = cardRect(i);
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) { chooseCard(i); return; }
    }
    return;
  }
  if (state === 'over') {
    if (namePending || performance.now() - overAt < 1200) return;
    if (y >= 290 && y <= 318 && x >= 30 && x <= 210) {
      stopDeathMusic();
      state = 'title'; loadBoard(); return;
    }
    reset(); return;
  }

  if (purgeBtnHit(x, y)) { usePurge(); return; }

  if (boss) {
    const by = boss.y + 20;
    for (const tok of boss.tokens) {
      if (!tok.hit && x >= tok.x - 3 && x <= tok.x + tok.w + 3 && y >= by - 8 && y <= by + 24) {
        defuseToken(tok);
        return;
      }
    }
    return;
  }

  const pad = 8;
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    if (x >= p.x - pad && x <= p.x + p.w + pad && y >= p.y - pad && y <= p.y + p.h + pad) {
      packets.splice(i, 1);
      if (p.bad) {
        logEv(p.flood ? 'f' : 'z');
        score += (p.flood ? 3 : 10 * combo);
        if (!p.flood) combo = Math.min(combo + 1, 8);
        streak++;
        checkStreakRewards();
        burst(p.x + p.w / 2, p.y + 10, p.flood ? AMBER : CYAN);
        if (typeof sfx !== 'undefined' && sfx.zap) sfx.zap();
      } else {
        logEv('w');
        missLog.push({ type: 'FALSE BLOCK', text: p.t, why: 'Safe traffic blocked' });
        burst(p.x + p.w / 2, p.y + 10, RED);
        loseLife('wrong');
      }
      return;
    }
  }
}

function drawBg(dt) {
  ctx.fillStyle = '#0a1a14';
  for (const s of stars) {
    s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
  }
}

const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
function heart(x, y, filled) {
  const s = 2;
  ctx.fillStyle = filled ? RED : '#301010';
  for (let r = 0; r < HEART.length; r++)
    for (let q = 0; q < 7; q++)
      if (HEART[r][q] === '1') ctx.fillRect(x + q * s, y + r * s, s, s);
  if (filled) { ctx.fillStyle = '#ffb3b3'; ctx.fillRect(x + s, y + s, s, s); }
}

function drawOctagon(cx, cy, r) {
  const k = r * 0.414;
  ctx.beginPath();
  ctx.moveTo(cx - k, cy - r);
  ctx.lineTo(cx + k, cy - r);
  ctx.lineTo(cx + r, cy - k);
  ctx.lineTo(cx + r, cy + k);
  ctx.lineTo(cx + k, cy + r);
  ctx.lineTo(cx - k, cy + r);
  ctx.lineTo(cx - r, cy + k);
  ctx.lineTo(cx - r, cy - k);
  ctx.closePath();
}

function drawSkull(cx, cy) {
  ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 1.5;
  drawOctagon(cx, cy, 21);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 9, Math.PI, 0, false);
  ctx.lineTo(cx + 6, cy + 5);
  ctx.lineTo(cx - 6, cy + 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(cx - 4, cy + 4, 8, 4);

  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(cx - 3.5, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3.5, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 0.5, cy + 1, 1, 2);

  ctx.fillStyle = '#000000';
  ctx.fillRect(cx - 3, cy + 6, 1.5, 2);
  ctx.fillRect(cx - 0.5, cy + 6, 1.5, 2);
  ctx.fillRect(cx + 2, cy + 6, 1.5, 2);

  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy + 8); ctx.lineTo(cx + 13, cy - 8);
  ctx.moveTo(cx - 13, cy - 8); ctx.lineTo(cx + 13, cy + 8);
  ctx.stroke();
}

const ULTRAKILL_DIAGNOSTICS = [
  'WARNING: EXTREME BREACH SUSTAINED.',
  'RUNNING SUBSYSTEM DIAGNOSTIC...',
  'ERROR: PACKET FILTER NOT RESPONDING',
  'ERROR: SYN GUARD NOT RESPONDING',
  'WARNING: FIREWALL INOPERABLE',
  'ATTEMPTING RECONSTRUCTION...',
  'INSUFFICIENT INTEGRITY',
  'INSUFFICIENT INTEGRITY',
  'INITIATING REBOOT SEQUENCE',
  'ERROR: EGRESS LINK DAMAGED',
  '-!- SYSTEM SHUTDOWN IMMINENT -!-'
];

function fitText(t, maxW, cx, y) {
  ctx.font = F8;
  const w = ctx.measureText(t).width;
  if (w <= maxW) { ctx.fillText(t, cx, y); return; }
  const size = Math.max(5, Math.floor(8 * maxW / w));
  ctx.font = size + "px 'Press Start 2P', monospace";
  ctx.fillText(t, cx, y);
  ctx.font = F8;
}

function drawCards() {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = F8; ctx.fillStyle = GREEN;
  ctx.fillText('ZERO-DAY NEUTRALIZED', 120, 40);
  ctx.fillStyle = AMBER;
  ctx.fillText('CHOOSE AN UPGRADE', 120, 62);
  offer.forEach((a, i) => {
    const c = cardRect(i);
    const cx = c.x + c.w / 2, maxW = c.w - 12;
    ctx.fillStyle = '#071410'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = a.color; ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.fillStyle = a.color;
    fitText(a.name, maxW, cx, c.y + 24);
    ctx.fillStyle = '#888888';
    fitText(a.type, maxW, cx, c.y + 40);
    ctx.fillStyle = WHITE;
    a.lines.forEach((ln, k) => fitText(ln, maxW, cx, c.y + 68 + k * 14));
    ctx.fillStyle = a.color;
    fitText(coarse ? 'TAP' : '[' + (i + 1) + ']', maxW, cx, c.y + c.h - 12);
  });
}

function drawAbilityHud() {
  ctx.textAlign = 'right'; ctx.font = F8;
  let yy = 44;
  if (dpiT > 0) { ctx.fillStyle = CYAN; ctx.fillText('DPI ' + Math.ceil(dpiT) + 's', W - 4, yy); yy += 11; }
  if (copT > 0) { ctx.fillStyle = '#c58bff'; ctx.fillText('AI ' + Math.ceil(copT) + 's', W - 4, yy); yy += 11; }
  if (quarantine > 0) { ctx.fillStyle = GREEN; ctx.fillText('QUAR x' + quarantine, W - 4, yy); yy += 11; }
}

function draw(dt) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawBg(dt);
  ctx.font = F8; ctx.textAlign = 'left';
  const blink = Math.floor(performance.now() / 450) % 2 === 0;

  if (state === 'play' || state === 'cards') {
    ctx.fillStyle = CYAN;
    for (let x = 0; x < W; x += 8) ctx.fillRect(x, H - 14, 4, 1);
    ctx.font = F8; ctx.textAlign = 'left'; ctx.fillText('FIREWALL', 4, H - 4);

    if (dpiT > 0) {
      ctx.strokeStyle = Math.floor(performance.now() / 200) % 2 ? CYAN : GREEN;
      ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
    }
    if (quarantine > 0) {
      ctx.strokeStyle = GREEN; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, H - 15.5, W - 1, 1);
    }

    if (boss) {
      const redFlash = Math.floor(performance.now() / 150) % 2 === 0;
      ctx.fillStyle = redFlash ? '#400808' : '#220000';
      ctx.fillRect(8, boss.y, W - 16, 46);
      ctx.strokeStyle = RED; ctx.lineWidth = 1.5;
      ctx.strokeRect(8.5, boss.y + 0.5, W - 17, 45);

      ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.font = F8;
      ctx.fillText(boss.title, 120, boss.y + 12);

      boss.tokens.forEach(tok => {
        ctx.fillStyle = tok.hit ? '#113311' : '#550000';
        ctx.fillRect(tok.x, boss.y + 20, tok.w, 18);
        ctx.strokeStyle = tok.hit ? GREEN : RED; ctx.lineWidth = 1;
        ctx.strokeRect(tok.x + 0.5, boss.y + 20.5, tok.w - 1, 17);
        ctx.fillStyle = tok.hit ? GREEN : WHITE;
        ctx.fillText(tok.hit ? 'OK' : tok.text, tok.x + tok.w / 2, boss.y + 32);
      });
    }

    for (const p of packets) {
      const hot = p.bad && (p.hint || dpiT > 0);
      const col = p.flood ? AMBER : (hot ? RED : GREEN);
      ctx.fillStyle = hot ? '#301010' : '#10301a'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(p.t, p.x + 5, p.y + 14);
      if (dpiT > 0 && p.bad && p.tag) {
        ctx.fillStyle = RED; ctx.font = F8;
        ctx.fillText(p.tag, p.x, p.y - 2);
      }
    }

    for (const l of lasers) {
      ctx.strokeStyle = '#c58bff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(l.x, H - 14); ctx.lineTo(l.x, l.y); ctx.stroke();
    }

    for (const q of parts) { ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 2, 2); }
    ctx.fillStyle = AMBER; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 4, 12);
    ctx.fillText('x' + combo + (streak > 2 ? ' (' + streak + ')' : ''), 4, 26);
    ctx.textAlign = 'right'; ctx.fillText('LV' + level, W - 4, 12);
    for (let i = 0; i < 3; i++) heart(W - 18 - (2 - i) * 17, 18, i < lives);
    drawAbilityHud();

    if (purges > 0) {
      ctx.strokeStyle = AMBER; ctx.lineWidth = 1;
      ctx.fillStyle = '#2a2000';
      ctx.fillRect(W - 66, H - 40, 62, 22);
      ctx.strokeRect(W - 65.5, H - 39.5, 61, 21);
      ctx.fillStyle = AMBER; ctx.textAlign = 'center';
      ctx.fillText('PURGE x' + purges, W - 35, H - 25);
    }

    if (streakBannerT > 0) {
      ctx.textAlign = 'center'; ctx.font = F8; ctx.fillStyle = GREEN;
      ctx.fillText(streakBanner, 120, 62);
    }

    if (banner > 0 && state === 'play') {
      ctx.textAlign = 'center'; ctx.font = F16; ctx.fillStyle = AMBER;
      ctx.fillText('LEVEL ' + level, 120, 160);
      const sub = (level % 5 === 0)
        ? '!! ZERO-DAY EXPLOIT !!'
        : (level <= 2 ? 'RED = MALICIOUS' : level <= 4 ? 'THREATS CAMOUFLAGED' : 'FULL SPEED - NO HINTS');
      ctx.font = F8; ctx.fillStyle = RED; ctx.fillText(sub, 120, 182);
    }

    if (state === 'cards') drawCards();
  } else if (state === 'title') {
    ctx.fillStyle = GREEN; ctx.textAlign = 'center';
    ctx.font = F16; ctx.fillText('DEFAULT', 120, 80); ctx.fillText('DENY', 120, 102);
    ctx.font = F8; ctx.fillStyle = CYAN;
    ctx.fillText('NETWORK FIREWALL SIMULATOR', 120, 140);
    ctx.fillStyle = GREEN;
    ctx.fillText('BLOCK MALICIOUS TRAFFIC', 120, 165);
    ctx.fillText('ALLOW SAFE ENTERPRISE FLOW', 120, 180);
    if (blink) { ctx.fillStyle = AMBER; ctx.fillText('TAP TO INITIALIZE', 120, 220); }
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1; ctx.strokeRect(55.5, 243.5, 129, 20);
    ctx.fillStyle = CYAN; ctx.fillText('HOW TO PLAY', 120, 257);
    if (board[0]) { ctx.fillStyle = AMBER; ctx.fillText('TOP ' + board[0].name + ' ' + board[0].score, 120, 292); }
  } else if (state === 'help') {
    const pg = HELP[helpPage];
    ctx.textAlign = 'center'; ctx.font = F8;
    ctx.fillStyle = CYAN; ctx.fillText(pg.h, 120, 24);
    ctx.fillStyle = '#777'; ctx.fillText((helpPage + 1) + '/' + HELP.length, 120, 40);
    let y = 66;
    for (const [t, c] of pg.lines) {
      if (!t) { y += 6; continue; }
      ctx.fillStyle = c; ctx.fillText(t, 120, y); y += 13;
    }
    if (blink) { ctx.fillStyle = AMBER; ctx.fillText(helpPage === HELP.length - 1 ? 'TAP TO START' : 'TAP FOR NEXT', 120, 306); }
  } else {
    const elapsed = (performance.now() - overAt) / 1000;
    if (elapsed < 1.4) {
      ctx.fillStyle = '#4a0808'; ctx.fillRect(0, 0, W, H);
      ctx.font = F8; ctx.textAlign = 'left';
      const maxLines = Math.min(ULTRAKILL_DIAGNOSTICS.length, Math.floor(elapsed * 8.5));
      for (let i = 0; i < maxLines; i++) {
        const isErr = ULTRAKILL_DIAGNOSTICS[i].startsWith('ERROR') || ULTRAKILL_DIAGNOSTICS[i].startsWith('WARNING');
        ctx.fillStyle = isErr ? '#ff3333' : '#aa2222';
        ctx.fillText(ULTRAKILL_DIAGNOSTICS[i], 8, 40 + i * 14);
      }
      return;
    }

    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#222222'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 14); ctx.lineTo(W - 10, 14);
    ctx.moveTo(10, 102); ctx.lineTo(W - 10, 102);
    ctx.stroke();

    ctx.font = F8; ctx.fillStyle = WHITE; ctx.textAlign = 'center';
    ctx.fillText('[YOU ARE DEAD]', 120, 28);

    if (Math.floor(performance.now() / 550) % 2 === 0) drawSkull(120, 60);

    ctx.font = F8; ctx.textAlign = 'center';
    if (blink) {
      ctx.fillStyle = WHITE;
      ctx.fillText(coarse ? 'TAP SCREEN TO RETRY' : 'PRESS [R] TO RESTART', 120, 92);
    }

    ctx.fillStyle = AMBER;
    ctx.fillText('SCORE: ' + score + '   LEVEL: ' + level, 120, 116);

    if (myName) {
      ctx.fillStyle = CYAN;
      ctx.fillText('IDENTITY: ' + myName.toUpperCase(), 120, 128);
      ctx.fillStyle = GREEN;
      ctx.fillText('LEADERBOARD RANK #' + myRank, 120, 139);
    } else if (postMsg) {
      ctx.fillStyle = RED; ctx.fillText(postMsg, 120, 128);
    }

        ctx.fillStyle = RED; ctx.fillText('-- REVIEW OF BREACHES --', 120, 156);
    const recentMisses = missLog.slice(-2);
    if (recentMisses.length === 0) {
      ctx.fillStyle = '#666666'; ctx.fillText('NO DIRECT BREACHES', 120, 172);
    } else {
      let my = 169;
      recentMisses.forEach(m => {
        const txt = typeof m === 'object' ? m.text : String(m);
        const why = typeof m === 'object' ? m.why : 'Breached firewall';
        ctx.fillStyle = AMBER;
        ctx.fillText(txt.slice(0, 24), 120, my);
        ctx.fillStyle = '#aaaaaa';
        fitText('> ' + why, 232, 120, my + 10);
        my += 21;
      });
    }

    ctx.fillStyle = '#c58bff';
    ctx.fillText(debrief && debrief.source === 'gemini' ? '-- RED TEAM AI DEBRIEF --' : '-- RED TEAM DEBRIEF --', 120, 214);
    if (debriefLoading || !debrief) {
      if (blink) { ctx.fillStyle = WHITE; ctx.fillText('ANALYZING BREACH...', 120, 230); }
    } else {
      ctx.fillStyle = AMBER;
      ctx.fillText(('RANK: ' + debrief.rank).slice(0, 28), 120, 226);
      ctx.fillStyle = '#cccccc';
      (debrief.tip || []).slice(0, 2).forEach((ln, i) =>
        ctx.fillText(String(ln).toUpperCase().slice(0, 28), 120, 238 + i * 11));
    }

    ctx.fillStyle = CYAN; ctx.fillText('-- LEADERBOARD --', 120, 266);
    board.slice(0, 2).forEach((r, idx) => {
      const isMe = myId !== null && r.id === myId;
      ctx.fillStyle = isMe ? WHITE : AMBER;
      ctx.fillText((isMe ? '>' : '') + (idx + 1) + '. ' + r.name.slice(0, 10) + ' ' + r.score, 120, 277 + idx * 10);
    });

    ctx.strokeStyle = CYAN;
    ctx.strokeRect(39.5, 292.5, 161, 18);
    ctx.fillStyle = CYAN;
    ctx.fillText(coarse ? 'MENU / TUTORIAL' : '[M] MENU / TUTORIAL', 120, 305);
  }
}

cv.addEventListener('pointerdown', e => {
  getAudio();
  const r = cv.getBoundingClientRect();
  tap((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
});

addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (namePending) return;
  const k = e.key;

  if (k === 'f' || k === 'F') {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  if (state === 'play' && (k === ' ' || k === 'Spacebar')) {
    e.preventDefault();
    usePurge();
  } else if (state === 'cards') {
    if (performance.now() - cardsAt < 500) return;
    if (k === '1') chooseCard(0);
    else if (k === '2') chooseCard(1);
  } else if (state === 'over') {
    if (k === 'm' || k === 'M') {
      stopDeathMusic();
      state = 'title'; loadBoard(); return;
    }
    if (k === 'r' || k === 'R') {
      if (performance.now() - overAt > 800) reset();
    }
  } else if ((state === 'title' || state === 'help') && (k === 'Enter' || k === ' ')) {
    tap(120, 0);
  }
});

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
loadBoard();