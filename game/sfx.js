let actx = null, muted = false;

function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(f1, f2, dur, type = 'square', vol = 0.08, delay = 0) {
  if (muted) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur);
}

const sfx = {
  start: () => tone(300, 900, 0.2),
  zap: () => tone(900, 1500, 0.08),
  wrong: () => tone(200, 80, 0.25, 'sawtooth'),
  breach: () => tone(150, 40, 0.35, 'sawtooth', 0.1),
  level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.1, 'square', 0.07, i * 0.09)),
  over: () => [400, 300, 200, 100].forEach((f, i) => tone(f, f * 0.9, 0.2, 'triangle', 0.09, i * 0.18)),
};

function toggleMute() {
  muted = !muted;
  document.getElementById('mute').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
}