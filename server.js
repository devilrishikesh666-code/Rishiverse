**`server.js`**
```js
/* NEXORA · server.js — secure Kimi proxy: rate limit + payload guard + health cache */
import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json({ limit: '128kb' }));
app.use(express.static('.'));

const KEY     = process.env.MOONSHOT_API_KEY;
const MODEL   = process.env.KIMI_MODEL    || 'kimi-k2-0711-preview';
const API_URL = process.env.MOONSHOT_BASE || 'https://api.moonshot.cn/v1/chat/completions';
const PORT    = process.env.PORT || 3000;

const buckets = new Map();
setInterval(() => buckets.clear(), 60_000);
app.use('/api/', (req, res, next) => {
  const n = (buckets.get(req.ip) || 0) + 1;
  buckets.set(req.ip, n);
  if (n > 30) return res.status(429).json({ error: 'slow down, traveler' });
  next();
});

let health = { t: 0, ok: false };
app.get('/api/health', async (req, res) => {
  if (Date.now() - health.t < 5 * 60_000) return res.json({ ok: health.ok });
  if (!KEY) { health = { t: Date.now(), ok: false }; return res.json({ ok: false }); }
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
    });
    health = { t: Date.now(), ok: r.ok };
  } catch { health = { t: Date.now(), ok: false }; }
  res.json({ ok: health.ok });
});

app.post('/api/chat', async (req, res) => {
  if (!KEY) return res.status(500).json({ error: 'missing MOONSHOT_API_KEY in .env' });
  if (!Array.isArray(req.body.messages)) return res.status(400).json({ error: 'bad payload' });
  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify({ model: MODEL, messages: req.body.messages.slice(-12), temperature: 0.6, stream: true })
    });
    if (!upstream.ok) return res.status(upstream.status).end(await upstream.text());
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.listen(PORT, () =>
  console.log(`⚡ NEXORA live → http://localhost:${PORT}  (key ${KEY ? '✅ loaded' : '❌ missing — check .env'})`));
```

**`package.json`**
```json
{
  "name": "nexora",
  "version": "1.0.0",
  "description": "NEXORA — a 3D AI universe guarded by VIDYA. Built solely by Rishikesh Singh.",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  }
}
```

**`.env.example`** — copy to `.env`, paste your key:
```bash
MOONSHOT_API_KEY=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
KIMI_MODEL=kimi-k2-0711-preview
MOONSHOT_BASE=https://api.moonshot.cn/v1/chat/completions
PORT=3000
```

**`.gitignore`**
```gitignore
node_modules/
.env
*.log
.DS_Store
```

---
