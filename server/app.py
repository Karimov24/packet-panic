import sqlite3, secrets, time, re
from collections import deque, Counter
from flask import Flask, request, jsonify

app = Flask(__name__, static_folder='../game', static_url_path='')
DB = 'scores.db'
runs = {}
last_submit = {}
rejected = deque(maxlen=8)
missed = Counter()

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

with conn() as c:
    c.execute('CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY, initials TEXT, score INTEGER, ts REAL)')

def ip():
    xf = request.headers.get('X-Forwarded-For', '')
    return (xf.split(',')[0].strip() or request.headers.get('CF-Connecting-IP') or request.remote_addr)

def reject(reason, d, code=400):
    raw = d.get('name')
    nm = re.sub(r'[^A-Za-z0-9 _\-]', '', str(raw if raw is not None else 'Anonymous'))[:12] or '???'
    rejected.appendleft({'name': nm, 'reason': reason, 'score': str(d.get('score'))[:8]})
    print('REJECTED:', reason, nm, d.get('score'))
    return jsonify(error=reason), code

KINDS = set('zfwgbmh')

def replay(log, elapsed):
    if not isinstance(log, list) or not (1 <= len(log) <= 4000):
        return None, 'bad log'
    score, combo, lives = 0, 1, 3
    prev_t, last_tap, plain, flood, ended = -1, -1000, 0, 0, False
    streak = 0
    got5, got10, got20 = False, False, False

    for e in log:
        if ended:
            return None, 'events after game over'
        if not (isinstance(e, list) and len(e) == 2 and isinstance(e[0], (int, float))
                and isinstance(e[1], str) and e[1] in KINDS):
            return None, 'bad log'
        t, k = e
        if t < prev_t:
            return None, 'bad timing'
        prev_t = t

        if k in 'zfw':
            if t - last_tap < 30:
                return None, 'too fast'
            last_tap = t

        if k in 'fm':
            flood += 1
        else:
            plain += 1

        if k == 'z':
            score += 10 * combo
            combo = min(combo + 1, 8)
            streak += 1
        elif k == 'f':
            score += 3
            streak += 1
        elif k == 'g':
            score += 1
            streak += 1
        elif k == 'm':
            score = max(0, score - 5)
            streak = 0
        elif k == 'h':
            # Streak reward validation
            if streak >= 20 and not got20:
                got20 = True
                lives = 3
            elif streak >= 10 and not got10:
                if lives < 3:
                    got10 = True
                    lives = min(3, lives + 1)
            elif streak >= 5 and not got5:
                if lives < 3:
                    got5 = True
                    lives = min(3, lives + 1)
        else:
            lives -= 1
            combo = 1
            streak = 0
            if lives <= 0:
                ended = True

    if not ended:
        return None, 'game not over'
    if prev_t > elapsed * 1000 + 2000:
        return None, 'log longer than run'
    if plain > elapsed / 0.50 + 6 or flood > elapsed / 0.50 * 0.8 + 8:
        return None, 'too many events'
    return score, ''

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.post('/api/start')
def start():
    token = secrets.token_urlsafe(16)
    runs[token] = (time.time(), ip())
    return jsonify(token=token)

@app.post('/api/score')
def score():
    d = request.get_json(silent=True) or {}
    token, name, s = d.get('token'), d.get('name'), d.get('score')
    run = runs.pop(token, None)
    if not run:
        return reject('bad token', d)

    if name is not None:
        if not isinstance(name, str):
            return reject('bad name', d)
        name = re.sub(r'\s+', ' ', name).strip()
        if not re.fullmatch(r'[A-Za-z0-9 _\-]{1,12}', name) or name.lower().startswith('anonymous'):
            return reject('bad name', d)

    if not isinstance(s, int) or s < 0:
        return reject('bad score', d)

    calc, why = replay(d.get('log'), time.time() - run[0])
    if calc is None:
        return reject(why, d)
    if calc != s:
        return reject('log mismatch', d)

    if time.time() - last_submit.get(ip(), 0) < 4:
        return reject('rate limited', d, 429)
    last_submit[ip()] = time.time()

    with conn() as c:
        if name is None:
            count = c.execute("SELECT COUNT(*) FROM scores WHERE initials LIKE 'Anonymous %'").fetchone()[0]
            name = 'Anonymous %d' % (count + 1)
        cur = c.execute('INSERT INTO scores (initials, score, ts) VALUES (?,?,?)', (name, calc, time.time()))
        new_id = cur.lastrowid
        rank = c.execute('SELECT COUNT(*) FROM scores WHERE score > ?', (calc,)).fetchone()[0] + 1

    ms = d.get('misses')
    if isinstance(ms, list):
        for m in ms[:4]:
            if isinstance(m, dict) and 'text' in m and isinstance(m['text'], str):
                missed[m['text'][:40]] += 1
            elif isinstance(m, str):
                missed[m[:40]] += 1

    return jsonify(ok=True, id=new_id, name=name, rank=rank)

@app.get('/api/top')
def top():
    with conn() as c:
        rows = c.execute('SELECT id, initials AS name, score FROM scores ORDER BY score DESC, id ASC LIMIT 10').fetchall()
    return jsonify([dict(r) for r in rows])

@app.get('/api/stats')
def stats():
    with conn() as c:
        n = c.execute('SELECT COUNT(*) FROM scores').fetchone()[0]
    return jsonify(plays=n, rejected=list(rejected), missed=missed.most_common(5))

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000)