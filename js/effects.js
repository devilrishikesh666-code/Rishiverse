```js
/* ============================================================
   NEXORA · effects.js — boot preloader, sound, cursor, trail,
   glitch, scroll FX, tilt, Konami. Cached DOM, pooled trail.
   ============================================================ */

/* ---------- SOUND ---------- */
window.blip = function (f = 880, d = .08, type = 'sine', v = .05) {
  try {
    const ctx = blip.ctx || (blip.ctx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + d);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + d);
  } catch (e) {}
};

/* ---------- cached DOM ---------- */
const $ = id => document.getElementById(id);
const elBarFill = $('scrollbarFill'), elNav = $('nav'),
      elTitle = $('heroTitle'), elInput = $('chatInput');

/* ---------- TITLE SPLIT ---------- */
function splitChars(el, isGrad) {
  [...el.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const f = document.createDocumentFragment();
      n.textContent.split('').forEach(ch => {
        const s = document.createElement('span');
        s.className = 'char' + (isGrad ? ' grad' : '');
        s.innerHTML = ch === ' ' ? '&nbsp;' : ch;
        f.appendChild(s);
      });
      el.replaceChild(f, n);
    } else splitChars(n, isGrad || n.classList?.contains('grad'));
  });
}
splitChars(elTitle, false);

/* ---------- BOOT-SEQUENCE PRELOADER ---------- */
const bootLines = ['loading GLSL shaders…','igniting plasma core…','linking Kimi API…','syncing VIDYA mind…','welcome, traveler'];
let bootI = 0;
const bootTimer = setInterval(() => { $('loadLabel').textContent = bootLines[Math.min(bootI++, bootLines.length - 1)]; }, 420);

const prog = { v: 0 };
gsap.to(prog, {
  v: 100, duration: 2.2, ease: 'power2.inOut',
  onUpdate: () => $('loadPct').textContent = Math.floor(prog.v) + '%',
  onComplete: () => {
    clearInterval(bootTimer);
    gsap.to('#preloader', { yPercent: -100, duration: .9, ease: 'power4.inOut',
      onComplete: () => $('preloader').remove() });
    gsap.from('#heroTitle .char', { rotationX: -95, y: 50, opacity: 0, transformPerspective: 700,
      stagger: .045, duration: 1, ease: 'back.out(1.6)', delay: .35 });
    gsap.to('.hero-el', { opacity: 1, y: 0, duration: 1.1, stagger: .13, ease: 'power3.out', delay: .7, startAt: { y: 40 } });
    if (window.novaGreeting) setTimeout(novaGreeting, 2200);
  }
});

/* ---------- GLITCH BURSTS ---------- */
setInterval(() => {
  if (scrollY > innerHeight) return;
  elTitle.classList.add('glitching');
  setTimeout(() => elTitle.classList.remove('glitching'), 380);
}, 6000);

/* ---------- SCROLL FX ---------- */
addEventListener('scroll', () => {
  const h = document.documentElement;
  elBarFill.style.width = (scrollY / (h.scrollHeight - innerHeight) * 100) + '%';
  elNav.classList.toggle('scrolled', scrollY > 40);
}, { passive: true });

gsap.utils.toArray('.reveal').forEach(el => {
  gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 86%' } });
});
gsap.to('#webgl', { opacity: .35,
  scrollTrigger: { trigger: '#capabilities', start: 'top bottom', end: 'top 30%', scrub: true } });
gsap.utils.toArray('.stat-num').forEach(el => {
  ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true,
    onEnter: () => gsap.fromTo(el, { textContent: 0 },
      { textContent: +el.dataset.count, duration: 2, snap: { textContent: 1 }, ease: 'power2.out' }) });
});
gsap.to('.wm-track', { xPercent: -30, ease: 'none',
  scrollTrigger: { trigger: '#watermark', start: 'top bottom', end: 'bottom top', scrub: 1 } });

/* ---------- CURSOR + POOLED TRAIL ---------- */
if (matchMedia('(pointer:fine)').matches) {
  const dot = document.querySelector('.cursor-dot'), ring = document.querySelector('.cursor-ring');
  const cp = { x: 0, y: 0 }, rp = { x: 0, y: 0 };
  addEventListener('mousemove', e => {
    cp.x = e.clientX; cp.y = e.clientY;
    dot.style.left = cp.x + 'px'; dot.style.top = cp.y + 'px';
  }, { passive: true });
  (function loop() {
    rp.x += (cp.x - rp.x) * .14; rp.y += (cp.y - rp.y) * .14;
    ring.style.left = rp.x + 'px'; ring.style.top = rp.y + 'px';
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mouseover', e =>
    ring.classList.toggle('hovering', !!e.target.closest('a,button,.chip,.card,input')));

  /* particle trail with hard cap (no memory leak) */
  const tc = $('trail'), tx = tc.getContext('2d');
  const fit = () => { tc.width = innerWidth; tc.height = innerHeight; };
  fit(); addEventListener('resize', fit);
  const trail = [];
  addEventListener('mousemove', e => {
    trail.push({ x: e.clientX, y: e.clientY, l: 1 });
    if (trail.length > 160) trail.shift();
  }, { passive: true });
  (function trailLoop() {
    tx.clearRect(0, 0, tc.width, tc.height);
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i]; p.l -= .035;
      if (p.l <= 0) { trail.splice(i, 1); continue; }
      tx.beginPath();
      tx.arc(p.x, p.y, p.l * 6, 0, 7);
      tx.fillStyle = `rgba(0,240,255,${p.l * .45})`;
      tx.fill();
    }
    requestAnimationFrame(trailLoop);
  })();
} else {
  document.querySelectorAll('.cursor-dot,.cursor-ring').forEach(el => el.remove());
}

/* ---------- TILT CARDS ---------- */
document.querySelectorAll('[data-tilt]').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    gsap.to(card, { rotateY: x * 14, rotateX: -y * 14, duration: .5, ease: 'power2.out', transformPerspective: 1000 });
  });
  card.addEventListener('mouseleave', () =>
    gsap.to(card, { rotateX: 0, rotateY: 0, duration: .8, ease: 'elastic.out(1,.5)' }));
});

/* ---------- KEYBOARD + KONAMI ---------- */
addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== elInput) {
    e.preventDefault();
    elInput.focus();
    elInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let ki = 0;
addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  ki = k === KONAMI[ki] ? ki + 1 : (k === KONAMI[0] ? 1 : 0);
  if (ki === KONAMI.length) {
    ki = 0;
    NOVA_STATE.party = true;
    blip(660, .3, 'square', .06);
    setTimeout(() => blip(880, .3, 'square', .06), 150);
    if (window.aiText) aiText("🎉 PARTY MODE UNLOCKED — Rishikesh taught me this one! NEXORA is now in overdrive.");
  }
});
```

---
