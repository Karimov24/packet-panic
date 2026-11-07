const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 240, H = 320;

let token = null, board = [], overAt = 0;

async function startRun() {
  try { token = (await (await fetch('/api/start', { method: 'POST' })).json()).token; }
  catch (e) { token = null; }
}
async function loadBoard() {
  try { board = await (await fetch('/api/top')).json(); } catch (e) {}
}
async function submitScore() {
  if (!token) return loadBoard();
  let ini = (prompt('INITIALS (3 letters)', 'AAA') || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'A');
  try {
    await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, initials: ini, score }) });
  } catch (e) {}
  token = null;
  loadBoard();
}

const PACKETS = [
  { t: 'TCP :443 HTTPS', bad: false },
  { t: 'TCP :22 SSH admin', bad: false },
  { t: 'UDP :53 DNS', bad: false },
  { t: 'TCP :80 GET /home', bad: false },
  { t: "' OR 1=1 --", bad: true, why: 'SQL injection: the quote breaks out of the query.' },
  { t: 'TCP :3389 RDP scan', bad: true, why: 'Open RDP is a favorite ransomware entry point.' },
  { t: 'paypa1-login.com', bad: true, why: 'Lookalike domain: "1" instead of "l".' },
  { t: '<script>alert(1)', bad: true, why: 'XSS payload injected into a page.' },
  { t: 'TCP :23 telnet', bad: true, why: 'Telnet sends passwords in plain text.' },
  { t: 'paypal.com', bad: false },
];

let state = 'title', packets = [], score = 0, lives = 3, combo = 1;
let spawnT = 0, speed = 30, lastWhy = '', shake = 0, last = performance.now();

function reset() {
  packets = []; score = 0; lives = 3; combo = 1;
  spawnT = 0; speed = 30; lastWhy = ''; state = 'play';
  startRun();
}

function spawn() {
  const p = PACKETS[Math.floor(Math.random() * PACKETS.length)];
  packets.push({ ...p, x: 10 + Math.random() * 100, y: -20, w: 120, h: 20 });
}

function loseLife(why) {
  lives--; combo = 1; shake = 8;
  if (why) lastWhy = why;
  if (lives <= 0) { state = 'over'; overAt = performance.now(); submitScore(); }
}

function update(dt) {
  spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(0.5, 1.2 - score / 500); }
  speed = 30 + score / 10;
  for (const p of packets) p.y += speed * dt;
  packets = packets.filter(p => {
    if (p.y > H) {
      if (p.bad) loseLife('BREACH: ' + p.why);
      else score += 1;
      return false;
    }
    return true;
  });
  if (shake > 0) shake -= 1;
}

function tap(x, y) {
  if (state !== 'play') {
    if (state === 'over' && performance.now() - overAt < 1500) return;
    reset(); return;
  }
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
      packets.splice(i, 1);
      if (p.bad) { score += 10 * combo; combo = Math.min(combo + 1, 8); }
      else loseLife('BLOCKED a legit packet: ' + p.t);
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

function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
  ctx.font = '10px monospace'; ctx.textAlign = 'left';
  if (state === 'play') {
    for (const p of packets) {
      ctx.fillStyle = '#143a1f'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#33ff66'; ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      ctx.fillStyle = '#33ff66'; ctx.fillText(p.t, p.x + 4, p.y + 14);
    }
    ctx.fillStyle = '#ffd400';
    ctx.fillText('SCORE ' + score, 6, 12);
    ctx.fillText('x' + combo, 110, 12);
    ctx.fillText('LIVES ' + '#'.repeat(lives), 170, 12);
  } else {
    ctx.fillStyle = '#33ff66'; ctx.textAlign = 'center'; ctx.font = '16px monospace';
    if (state === 'title') {
      ctx.fillText('PACKET PANIC', 120, 120);
      ctx.font = '10px monospace';
      ctx.fillText('TAP BAD PACKETS', 120, 150);
      ctx.fillText('LET GOOD ONES PASS', 120, 164);
      ctx.fillText('INSERT COIN (TAP)', 120, 210);
    } else {
      ctx.fillText('GAME OVER', 120, 60);
      ctx.fillText('SCORE ' + score, 120, 90);
      ctx.font = '10px monospace'; ctx.fillStyle = '#ff5555';
      wrap(lastWhy, 120, 120, 200, 13);
      ctx.fillStyle = '#ffd400';
      ctx.fillText('- TOP 5 -', 120, 185);
      board.slice(0, 5).forEach((r, i) => ctx.fillText((i + 1) + '. ' + r.initials + '  ' + r.score, 120, 203 + i * 14));
      ctx.fillStyle = '#33ff66'; ctx.fillText('TAP TO RETRY', 120, 295);
    }
  }
  ctx.restore();
}

cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect();
  tap((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
});

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
loadBoard();