const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 240, H = 320;
const F8 = "8px 'Press Start 2P', monospace";
const F16 = "16px 'Press Start 2P', monospace";
const GREEN = '#33ff66', AMBER = '#ffd400', RED = '#ff4d4d', CYAN = '#4de1ff';
if (document.fonts) document.fonts.load(F8);


let token = null, board = [], overAt = 0;
let runLog = [], missLog = [], runT0 = 0;
function logEv(k) {
  if (runLog.length < 4000) runLog.push([Math.round(performance.now() - runT0), k]);
}


async function startRun() {
  try { token = (await (await fetch('/api/start', { method: 'POST' })).json()).token; }
  catch (e) { token = null; }
}
async function loadBoard() {
  try { board = await (await fetch('/api/top')).json(); } catch (e) {}
}
async function submitScore() {
  if (!token) return loadBoard();
  let ini = null;
  while (!ini || ini.length < 3) {
    const v = prompt('ENTER 3 CHARACTERS (A-Z, 0-9)', 'AAA');
    if (v === null) { ini = 'ANO'; break; }
    ini = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  }
  try {
    await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, initials: ini, score, log: runLog, misses: missLog }) });
  } catch (e) {}
  token = null;
  loadBoard();
}


const GOOD = [
  'TCP :443 HTTPS', 'TCP :22 SSH admin', 'UDP :53 DNS', 'TCP :80 GET /home',
  'paypal.com', 'github.com', 'TCP :443 login OK', 'NTP :123 time sync',
];
const BAD = [
  { t: "' OR 1=1 --", why: 'SQL injection: the quote breaks out of the query.' },
  { t: "'; DROP TABLE users", why: 'SQL injection that tries to delete a table.' },
  { t: '<script>alert(1)', why: 'XSS payload injected into a page.' },
  { t: 'TCP :23 telnet', why: 'Telnet sends passwords in plain text.' },
  { t: 'TCP :3389 RDP', why: 'Open RDP is a favorite ransomware entry point.' },
  { t: '../../etc/passwd', why: 'Path traversal reads files outside the web root.' },
  { t: 'admin:admin login', why: 'Default credentials are tried by every bot.' },
  { t: 'TCP :445 SMB', why: 'Open SMB was the door for WannaCry.' },
];
const LOOKALIKE = [
  { t: 'paypa1-login.com', why: 'Lookalike domain: "1" instead of "l".' },
  { t: 'g00gle-security.com', why: 'Lookalike domain: zeros instead of o.' },
  { t: 'arnazon.com', why: 'Lookalike: "rn" looks like "m".' },
  { t: 'micros0ft-support.net', why: 'Lookalike domain with a zero.' },
];
const SCAN = [
  { t: 'SCAN :21 :22 :23', why: 'Port scan: one host probing many ports in a row.' },
  { t: 'SCAN :80 :443 :8080', why: 'Port scan: an attacker mapping your open services.' },
];


let state = 'title', packets = [], parts = [], score = 0, lives = 3, combo = 1, level = 1, banner = 0;
let spawnT = 0, speed = 30, lastWhy = '', shake = 0, last = performance.now();
let stars = Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 5 + Math.random() * 15 }));


function reset() {
  packets = []; parts = []; score = 0; lives = 3; combo = 1; level = 1; banner = 2;
  spawnT = 0; speed = 30; lastWhy = ''; state = 'play';
  runLog = []; missLog = []; runT0 = performance.now();
  startRun(); sfx.start();
}


const pick = a => a[Math.floor(Math.random() * a.length)];
function textW(t) { ctx.font = F8; return Math.ceil(ctx.measureText(t).width) + 10; }


function burst(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.28, v = 30 + Math.random() * 60;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, c: color });
  }
}


function spawn() {
  const r = Math.random();
  if (level >= 2 && r < 0.08) {
    for (let i = 0; i < 4; i++)
      packets.push({ t: 'SYN', bad: true, flood: true, why: 'SYN flood: a swarm of half-open connections.',
        b: 'fast', x: 10 + i * 55, x0: 0, y: -20 - i * 25, w: 44, h: 20 });
    return;
  }
  let p, b = 'norm';
  if (r < 0.45) p = { t: pick(GOOD), bad: false };
  else if (r < 0.7) p = { ...pick(BAD), bad: true };
  else if (r < 0.88 || level < 2) { p = { ...pick(LOOKALIKE), bad: true }; b = 'zig'; }
  else { p = { ...pick(SCAN), bad: true }; b = 'sweep'; }
  p.w = textW(p.t); p.h = 20; p.y = -20; p.b = b;
  const room = W - p.w;
  if (b === 'zig') { p.x0 = room / 2; p.amp = Math.max(6, Math.min(35, room / 2 - 2)); p.x = p.x0; }
  else if (b === 'sweep') { p.x = 5; p.vx = 60; }
  else { p.x = 4 + Math.random() * Math.max(1, room - 8); }
  packets.push(p);
}


function loseLife(why, kind) {
  lives--; combo = 1; shake = 8;
  if (why) lastWhy = why;
  if (kind === 'breach') sfx.breach(); else sfx.wrong();
  if (lives <= 0) { state = 'over'; overAt = performance.now(); sfx.over(); submitScore(); }
}


function update(dt) {
  spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(0.55, 1.2 - score / 600); }
  const newLevel = 1 + Math.floor(score / 150);
  if (newLevel > level) { level = newLevel; banner = 2; sfx.level(); }
  if (banner > 0) banner -= dt;
  speed = 30 + score / 10;


  for (const p of packets) {
    p.y += (p.b === 'fast' ? speed * 2.2 : speed) * dt;
    if (p.b === 'zig') p.x = p.x0 + Math.sin(p.y / 14) * p.amp;
    if (p.b === 'sweep') {
      p.x += p.vx * dt;
      if (p.x < 5 || p.x > W - p.w - 5) p.vx = -p.vx;
    }
  }
  packets = packets.filter(p => {
    if (p.y > H) {
      if (p.bad && p.flood) { logEv('m'); score = Math.max(0, score - 5); }
      else if (p.bad) { logEv('b'); missLog.push(p.t); loseLife('BREACH: ' + p.why, 'breach'); }
      else { logEv('g'); score += 1; }
      return false;
    }
    return true;
  });
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  parts = parts.filter(q => q.life > 0);
  if (shake > 0) shake -= 1;
}


function tap(x, y) {
  if (state !== 'play') {
    if (state === 'over' && performance.now() - overAt < 1500) return;
    reset(); return;
  }
  const pad = 6;
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    if (x >= p.x - pad && x <= p.x + p.w + pad && y >= p.y - pad && y <= p.y + p.h + pad) {
      packets.splice(i, 1);
      if (p.bad) {
        logEv(p.flood ? 'f' : 'z');
        score += (p.flood ? 3 : 10 * combo);
        if (!p.flood) combo = Math.min(combo + 1, 8);
        burst(p.x + p.w / 2, p.y + 10, p.flood ? AMBER : CYAN);
        sfx.zap();
      } else {
        logEv('w'); missLog.push(p.t);
        burst(p.x + p.w / 2, p.y + 10, RED);
        loseLife('BLOCKED a legit packet: ' + p.t, 'wrong');
      }
      return;
    }
  }
}


function wrap(text, x, y, maxW, lh) {
  let line = '';
  for (const w of text.split(' ')) {
    if (ctx.measureText(line + w).width > maxW) { ctx.fillText(line, x, y); line = ''; y += lh; }
    line += w + ' ';
  }
  ctx.fillText(line, x, y);
}


function drawBg(dt) {
  ctx.fillStyle = '#0a1a14';
  for (const s of stars) {
    s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
  }
}


function draw(dt) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawBg(dt);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
  ctx.font = F8; ctx.textAlign = 'left';
  if (state === 'play') {
    ctx.fillStyle = CYAN;
    for (let x = 0; x < W; x += 8) ctx.fillRect(x, H - 14, 4, 1);
    ctx.font = F8; ctx.fillText('FIREWALL', 4, H - 4);
    for (const p of packets) {
      const col = p.flood ? AMBER : GREEN;
      ctx.fillStyle = '#10301a'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = col; ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      ctx.fillStyle = col; ctx.fillText(p.t, p.x + 5, p.y + 14);
    }
    for (const q of parts) { ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 2, 2); }
    ctx.fillStyle = AMBER; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 4, 12);
    ctx.fillText('x' + combo, 4, 26);
    ctx.textAlign = 'right'; ctx.fillText('LV' + level, W - 4, 12);
    ctx.fillStyle = RED;
    for (let i = 0; i < lives; i++) ctx.fillRect(W - 12 - i * 11, 20, 8, 8);
    if (banner > 0) {
      ctx.textAlign = 'center'; ctx.font = F16; ctx.fillStyle = AMBER;
      ctx.fillText('LEVEL ' + level, 120, 160);
    }
  } else {
    ctx.fillStyle = GREEN; ctx.textAlign = 'center';
    if (state === 'title') {
      ctx.font = F16; ctx.fillText('PACKET', 120, 90); ctx.fillText('PANIC', 120, 112);
      ctx.font = F8; ctx.fillStyle = CYAN;
      ctx.fillText('YOU ARE THE FIREWALL', 120, 150);
      ctx.fillStyle = GREEN;
      ctx.fillText('TAP BAD PACKETS', 120, 175);
      ctx.fillText('LET GOOD ONES PASS', 120, 190);
      if (Math.floor(performance.now() / 500) % 2 === 0) { ctx.fillStyle = AMBER; ctx.fillText('INSERT COIN', 120, 235); }
      if (board[0]) { ctx.fillStyle = CYAN; ctx.fillText('BEST ' + board[0].initials + ' ' + board[0].score, 120, 280); }
    } else {
      ctx.font = F16; ctx.fillText('GAME OVER', 120, 50);
      ctx.font = F8; ctx.fillStyle = AMBER; ctx.fillText('SCORE ' + score, 120, 75);
      ctx.fillStyle = RED;
      wrap(lastWhy, 120, 105, 200, 12);
      ctx.fillStyle = CYAN; ctx.fillText('- TOP 5 -', 120, 180);
      ctx.fillStyle = AMBER;
      board.slice(0, 5).forEach((r, i) => ctx.fillText((i + 1) + '. ' + r.initials + ' ' + r.score, 120, 198 + i * 14));
      if (Math.floor(performance.now() / 500) % 2 === 0) { ctx.fillStyle = GREEN; ctx.fillText('TAP TO RETRY', 120, 295); }
    }
  }
  ctx.restore();
}


cv.addEventListener('pointerdown', e => {
  audio();
  const r = cv.getBoundingClientRect();
  tap((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
});


function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
loadBoard();