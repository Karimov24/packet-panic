import sqlite3, secrets, time, re
from flask import Flask, request, jsonify

app = Flask(__name__, static_folder='../game', static_url_path='')
DB = 'scores.db'
runs = {}          # token -> (start_time, ip)
last_submit = {}   # ip -> time

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

with conn() as c:
    c.execute('CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY, initials TEXT, score INTEGER, ts REAL)')

def ip():
    return request.headers.get('CF-Connecting-IP') or request.remote_addr

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
    token, initials, s = d.get('token'), d.get('initials', ''), d.get('score')
    run = runs.pop(token, None)  # single use
    if not run:
        return jsonify(error='bad token'), 400
    if not re.fullmatch(r'[A-Z0-9]{3}', str(initials)):
        return jsonify(error='bad initials'), 400
    if not isinstance(s, int) or s < 0:
        return jsonify(error='bad score'), 400
    elapsed = time.time() - run[0]
    if s > elapsed * 60 + 20:   # max plausible points per second
        print('REJECTED', initials, s, round(elapsed, 1))
        return jsonify(error='implausible score'), 400
    if time.time() - last_submit.get(ip(), 0) < 5:
        return jsonify(error='slow down'), 429
    last_submit[ip()] = time.time()
    with conn() as c:
        c.execute('INSERT INTO scores (initials, score, ts) VALUES (?,?,?)', (initials, s, time.time()))
    return jsonify(ok=True)

@app.get('/api/top')
def top():
    with conn() as c:
        rows = c.execute('SELECT initials, score FROM scores ORDER BY score DESC LIMIT 10').fetchall()
    return jsonify([dict(r) for r in rows])

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000)