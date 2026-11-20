```js
/* ============================================================
   NEXORA · chat.js — VIDYA (विद्या): Kimi streaming + real voice
   + mic-reactive core + offline math brain
   ============================================================ */

const msgs  = document.getElementById('messages');
const form  = document.getElementById('chatForm');
const input = document.getElementById('chatInput');
const miniOrb = document.getElementById('miniOrb');
const speakEq = document.getElementById('speakEq');
const scrollBottom = () => msgs.scrollTop = msgs.scrollHeight;

const history = [];
const SYSTEM = { role: 'system', content:
  'You are VIDYA (Sanskrit: विद्या, "knowledge"), the witty AI guardian of NEXORA — a 3D website created and owned solely by Rishikesh Singh. ' +
  'If asked who made you, credit Rishikesh Singh proudly. Keep replies under 120 words unless code is requested. ' +
  'Use markdown code blocks for code. Be playful, occasional emojis.' };
let voiceOn = true;

function setApiBadge(live) {
  const b = document.getElementById('apiBadge');
  if (live) { b.textContent = 'kimi-k2 · LIVE'; b.className = 'model-badge live'; }
  else      { b.textContent = 'offline brain';  b.className = 'model-badge off'; }
}
/* instant status ping on load */
fetch('/api/health').then(r => r.json()).then(d => setApiBadge(d.ok)).catch(() => setApiBadge(false));

/* ---------- REAL VOICE (best-voice picker + core sync) ---------- */
let voices = [];
const loadVoices = () => voices = speechSynthesis ? speechSynthesis.getVoices() : [];
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function bestVoice() {
  return voices.find(v => /Google US English/i.test(v.name))
      || voices.find(v => v.lang === 'en-US')
      || voices.find(v => v.lang?.startsWith('en')) || voices[0];
}
document.getElementById('ttsBtn').onclick = e => {
  voiceOn = !voiceOn;
  e.target.textContent = voiceOn ? '🔊' : '🔇';
  if (!voiceOn) speechSynthesis.cancel();
};
function speak(text) {
  if (!voiceOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      text.replace(/```[\s\S]*?```/g, ' code block ').replace(/[^\x00-\x7F]/g, '').slice(0, 300));
    const v = bestVoice(); if (v) u.voice = v;
    u.rate = 1.05; u.pitch = 1.1;
    u.onstart = () => { NOVA_STATE.speaking = true;  miniOrb.classList.add('speaking');  speakEq.classList.add('on'); };
    u.onend   = () => { NOVA_STATE.speaking = false; miniOrb.classList.remove('speaking'); speakEq.classList.remove('on'); };
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- MIC-REACTIVE CORE (analyser drives the 3D) ---------- */
let micStream = null;
async function startMicFx() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const actx = startMicFx.ctx || (startMicFx.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const src = actx.createMediaStreamSource(micStream);
    const an = actx.createAnalyser(); an.fftSize = 256;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    (function loop() {
      if (!micStream) return;
      an.getByteFrequencyData(data);
      let s = 0; for (let i = 0; i < data.length; i++) s += data[i];
      NOVA_STATE.micLevel = Math.min(1, (s / data.length) / 80);
      requestAnimationFrame(loop);
    })();
  } catch (e) {}
}
function stopMicFx() {
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; NOVA_STATE.micLevel = 0; }
}

/* ---------- MESSAGE BUILDERS ---------- */
function addUser(text) {
  const d = document.createElement('div');
  d.className = 'msg user'; d.textContent = text;
  msgs.appendChild(d); scrollBottom(); blip(980, .06);
}
function showTyping() {
  const d = document.createElement('div');
  d.className = 'msg ai typing'; d.innerHTML = '<i></i><i></i><i></i>';
  msgs.appendChild(d); scrollBottom(); return d;
}
function highlight(code) {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/(\/\/.*$|#.*$)/gm, '<span class="c">$1</span>')
    .replace(/('[^'\n]*'|"[^"\n]*")/g, '<span class="s">$1</span>')
    .replace(/\b(function|return|const|let|var|def|if|elif|else|for|while|import|from|class|new|len|print|async|await)\b/g, '<span class="k">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="n">$1</span>');
}
function codeBlockHTML(lang, inner) {
  return `<div class="code-block"><div class="code-head"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>&nbsp;${lang} <button class="copy">copy</button></div><pre>${inner}</pre></div>`;
}
function renderMarkdown(src) {
  const blocks = [];
  let t = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push({ lang: lang || 'code', code: code.replace(/\n$/, '') });
    return '\u0001' + (blocks.length - 1) + '\u0001';
  });
  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  t = t.replace(/`([^`\n]+)`/g, '<code class="ic">$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/\n/g, '<br>');
  t = t.replace(/\u0001(\d+)\u0001/g, (m, i) => { const b = blocks[+i]; return codeBlockHTML(b.lang, highlight(b.code)); });
  return t;
}
msgs.addEventListener('click', e => {
  if (!e.target.classList.contains('copy')) return;
  navigator.clipboard.writeText(e.target.closest('.code-block').querySelector('pre').textContent);
  e.target.textContent = 'copied ✓'; blip(1200, .08);
  setTimeout(() => e.target.textContent = 'copy', 1500);
});
window.aiText = function (text) {
  const d = document.createElement('div');
  d.className = 'msg ai';
  const span = document.createElement('span'), caret = document.createElement('span');
  caret.className = 'caret'; d.append(span, caret); msgs.appendChild(d);
  blip(520, .06); speak(text);
  let i = 0;
  (function type() {
    if (i < text.length) { span.textContent += text[i++]; scrollBottom(); setTimeout(type, 13 + Math.random() * 20); }
    else caret.remove();
  })();
};
function createStreamBubble() {
  const d = document.createElement('div');
  d.className = 'msg ai'; d.style.maxWidth = '88%';
  const span = document.createElement('span'), caret = document.createElement('span');
  caret.className = 'caret'; d.append(span, caret); msgs.appendChild(d);
  return {
    update(t) { span.textContent = t; scrollBottom(); },
    done(full) { d.innerHTML = renderMarkdown(full); scrollBottom(); }
  };
}

/* ---------- KIMI STREAM (via secure proxy) ---------- */
async function askKimi(onToken, onStart) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [SYSTEM, ...history.slice(-10)] })
  });
  if (!res.ok || !res.body) throw new Error('api ' + res.status);
  onStart && onStart();
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (data === '[DONE]') break;
      try {
        const tok = JSON.parse(data).choices?.[0]?.delta?.content || '';
        if (tok) { full += tok; onToken(full); }
      } catch (e) {}
    }
  }
  return full;
}

/* ---------- PROCEDURAL IMAGE SYNTH ---------- */
function generateArt(seed, cv) {
  const ctx = cv.getContext('2d'), W = cv.width = 560, H = cv.height = 340;
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h = Math.imul(h ^ h >>> 15, 2246822519); h = Math.imul(h ^ h >>> 13, 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const hue = Math.floor(rnd() * 360);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, `hsl(${hue},65%,7%)`); bg.addColorStop(1, `hsl(${(hue + 70) % 360},65%,15%)`);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W, y = rnd() * H, r = 60 + rnd() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${(hue + rnd() * 140) % 360},95%,62%,.55)`); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(W / 2, H / 2, 18 + i * 22, rnd() * 6, rnd() * 6 + 3); ctx.stroke(); }
  for (let i = 0; i < 140; i++) { ctx.fillStyle = `rgba(255,255,255,${rnd() * .85})`; ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
}
function aiImage(prompt) {
  const d = document.createElement('div');
  d.className = 'msg ai'; d.style.width = '88%';
  d.innerHTML = `<div class="art-wrap"><div class="progress"><span></span></div><canvas style="display:none"></canvas>
    <div class="art-cap"><span class="cap"></span><a download="nexora-art.png">↓ save</a></div></div>`;
  msgs.appendChild(d); scrollBottom();
  d.querySelector('.cap').textContent = 'seed: "' + prompt.slice(0, 40) + '" · forged in NEXORA';
  const bar = d.querySelector('.progress span'), cv = d.querySelector('canvas');
  gsap.to(bar, { width: '100%', duration: 1.6, ease: 'power2.inOut', onComplete: () => {
    generateArt(prompt, cv);
    d.querySelector('a').href = cv.toDataURL();
    d.querySelector('.progress').remove();
    cv.style.display = 'block'; blip(1400, .12);
    gsap.from(cv, { opacity: 0, scale: .92, duration: .7, ease: 'back.out(1.6)' });
    scrollBottom();
  }});
}

/* ---------- MASTER RESPONDER ---------- */
const OWNER_REPLY = "I am VIDYA — विद्या, the Sanskrit word for knowledge — guardian of NEXORA, designed & engineered by RISHIKESH SINGH, the one and only owner of this universe 👑. Every pixel, every particle, every line of code… his vision.";
const OFFLINE = [
  "My Kimi link is offline (no key / server not running). Add your key to .env, run `npm start`, and I stream real answers ⚡",
  "Local brain active 🧠 — start the backend proxy and I upgrade to full Kimi power instantly."
];

async function respond(raw) {
  const low = raw.toLowerCase();
  const typing = showTyping();

  if (/image|picture|draw|paint|logo|art|nebula|sunset|wallpaper/.test(low)) {
    typing.remove();
    aiText("Synthesizing a visual from your prompt — every render unique 🎨");
    setTimeout(() => aiImage(raw), 700);
    return;
  }
  if (/who made you|owner|rishikesh|creator|built you|your maker|nexora|vidya/.test(low)) {
    typing.remove();
    aiText(OWNER_REPLY);
    history.push({ role: 'user', content: raw }, { role: 'assistant', content: OWNER_REPLY });
    return;
  }
  /* offline math brain 🧮 */
  if (/^[\d\s+\-*/().%]+$/.test(raw.trim()) && /\d/.test(raw) && /[+\-*/]/.test(raw)) {
    typing.remove();
    try {
      const val = Function('"use strict";return(' + raw + ')')();
      aiText(`🧮 ${raw} = **${val}** — computed locally at light speed. Rishikesh gave me a calculator heart too.`);
    } catch { aiText("That expression broke my calculator heart 💔 try something like 847 * 23 + 105"); }
    return;
  }
  if (/party mode|konami/.test(low)) {
    typing.remove();
    NOVA_STATE.party = true;
    aiText("🎉 Party mode engaged! The universe is dancing now.");
    return;
  }

  history.push({ role: 'user', content: raw });
  NOVA_STATE.thinking = true;
  try {
    let bubble = null;
    const full = await askKimi(
      t => bubble && bubble.update(t),
      () => { typing.remove(); bubble = createStreamBubble(); }
    );
    if (!bubble) { typing.remove(); bubble = createStreamBubble(); }
    bubble.done(full || '…');
    history.push({ role: 'assistant', content: full });
    setApiBadge(true);
    blip(520, .06); speak(full);
  } catch (e) {
    typing.remove();
    setApiBadge(false);
    aiText(OFFLINE[Math.floor(Math.random() * OFFLINE.length)]);
  } finally {
    NOVA_STATE.thinking = false;
  }
}

window.novaGreeting = function () {
  const t = showTyping();
  setTimeout(() => {
    t.remove();
    aiText("Welcome to NEXORA ⚡ I'm VIDYA — विद्या, knowledge itself — guardian of this universe, built by Rishikesh Singh, powered by Kimi. Ask me anything.");
  }, 900);
};

form.addEventListener('submit', e => {
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;
  addUser(v); input.value = '';
  respond(v);
});
document.querySelectorAll('.chip').forEach(ch =>
  ch.addEventListener('click', () => { addUser(ch.dataset.q); respond(ch.dataset.q); }));

/* ---------- VOICE INPUT (+ mic-reactive core) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById('micBtn');
micBtn.addEventListener('click', () => {
  if (!SR) { aiText("Voice input needs Chrome or Edge, boss 🎙️"); return; }
  const rec = new SR();
  rec.lang = 'en-US'; rec.interimResults = false;
  rec.onresult = e => { input.value = e.results[0][0].transcript; form.requestSubmit(); };
  rec.onend = () => { micBtn.classList.remove('rec'); stopMicFx(); };
  rec.onerror = () => { micBtn.classList.remove('rec'); stopMicFx(); };
  micBtn.classList.add('rec'); blip(1200, .1);
  startMicFx();          // core now dances to YOUR voice
  rec.start();
});
```

---
