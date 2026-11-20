```js
/* ============================================================
   NEXORA · core3d.js — GLSL plasma core (voice + mic reactive),
   galaxy disc, torus knot, helix, warp stars, 3D text.
   Optimizations: FPS auto-tuner, zero per-frame allocation,
   debounced resize, tab-hidden pause.
   State: NOVA_STATE { party, thinking, speaking, micLevel }
   ============================================================ */
window.NOVA_STATE = { party: false, thinking: false, speaking: false, micLevel: 0 };

const canvas   = document.getElementById('webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x050510, .022);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 200);
camera.position.set(0, 0, 10);

scene.add(new THREE.AmbientLight(0x1a1a2e, 1.4));
const keyLight = new THREE.PointLight(0x00f0ff, 2.2, 50); keyLight.position.set(6, 4, 6);
const rimLight = new THREE.PointLight(0xff2d75, 1.8, 50); rimLight.position.set(-6, -3, 4);
scene.add(keyLight, rimLight);

const core = new THREE.Group();
scene.add(core);

/* ---------- GLSL PLASMA CORE (voice/mic/thinking reactive) ---------- */
const U = {
  uTime:  { value: 0 },
  uAmp:   { value: .32 },
  uThink: { value: 0 },
  uSpeak: { value: 0 },
  uMic:   { value: 0 },
  uColA:  { value: new THREE.Color(0x8b5cf6) },
  uColB:  { value: new THREE.Color(0x00f0ff) },
  uColC:  { value: new THREE.Color(0xff2d75) }
};
const coreMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true,
  vertexShader: `
    uniform float uTime,uAmp,uThink,uSpeak,uMic;
    varying float vN; varying vec3 vNrm,vView;
    void main(){
      float sp = 1.0 + uThink*2.0 + uSpeak*1.5 + uMic*2.0;
      float n  = sin(position.x*2.1 + uTime*sp)
               * cos(position.y*2.4 + uTime*1.3*sp)
               * sin(position.z*1.9 + uTime*0.8*sp);
      vN = n;
      vec3 p = position + normal * n * uAmp * (1.0 + uThink*.6 + uSpeak*.4 + uMic*1.2);
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      vNrm = normalMatrix * normal;
      vView = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColA,uColB,uColC;
    uniform float uThink,uSpeak,uMic;
    varying float vN; varying vec3 vNrm,vView;
    void main(){
      float fres = pow(1.0 - abs(dot(normalize(vNrm), normalize(vView))), 2.2);
      vec3 col = mix(uColA, uColB, vN*0.5 + 0.5);
      col = mix(col, uColC, fres * (0.8 + uThink + uSpeak));
      gl_FragColor = vec4(col * (1.0 + uThink*.8 + uSpeak*.6 + uMic*.8), 0.95);
    }`
});
const coreGeo  = new THREE.IcosahedronGeometry(1.7, 5);
const coreMesh = new THREE.Mesh(coreGeo, coreMat);
core.add(coreMesh);

const holoMesh = new THREE.Mesh(coreGeo,
  new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: .12 }));
holoMesh.scale.setScalar(1.02);
core.add(holoMesh);

const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1),
  new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: .3 }));
core.add(cage);

/* glow sprite (canvas texture, generated once) */
function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,240,255,.55)');
  g.addColorStop(.35, 'rgba(139,92,246,.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
glow.scale.set(10, 10, 1);
core.add(glow);

/* speech pulse ring */
const speakRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, .02, 8, 120),
  new THREE.MeshBasicMaterial({ color: 0xff2d75, transparent: true, opacity: 0 }));
speakRing.rotation.x = Math.PI / 2.4;
core.add(speakRing);

/* orbit rings */
const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.4, .015, 8, 140),
  new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: .55 }));
ring1.rotation.x = Math.PI / 2.15; core.add(ring1);
const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.1, .01, 8, 140),
  new THREE.MeshBasicMaterial({ color: 0xff2d75, transparent: true, opacity: .35 }));
ring2.rotation.x = Math.PI / 1.55; ring2.rotation.y = .5; core.add(ring2);

/* satellites — shared geometry, shared materials (memory efficient) */
const satGeo  = new THREE.OctahedronGeometry(1, 0);
const satMatA = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: .9, roughness: .15, emissive: 0x003a44 });
const satMatB = new THREE.MeshStandardMaterial({ color: 0xff2d75, metalness: .9, roughness: .15, emissive: 0x44001c });
const sats = [];
for (let i = 0; i < 8; i++) {
  const s = new THREE.Mesh(satGeo, i % 2 ? satMatA : satMatB);
  s.scale.setScalar(.12 + Math.random() * .1);
  s.userData = { r: 2.6 + Math.random() * 1.8, sp: .4 + Math.random() * .6, ph: Math.random() * Math.PI * 2 };
  core.add(s); sats.push(s);
}

/* ---------- SPIRAL GALAXY DISC (left side) ---------- */
const GN = 1200;
const gPos = new Float32Array(GN * 3), gCol = new Float32Array(GN * 3);
const cA = [0, .94, 1], cB = [1, .18, .46];
for (let i = 0; i < GN; i++) {
  const r = Math.pow(Math.random(), .6) * 3.2, a = r * 2.4 + Math.random() * .5;
  gPos[i*3] = Math.cos(a) * r; gPos[i*3+1] = (Math.random() - .5) * .3; gPos[i*3+2] = Math.sin(a) * r;
  const t = r / 3.2;
  gCol[i*3] = cA[0]+(cB[0]-cA[0])*t; gCol[i*3+1] = cA[1]+(cB[1]-cA[1])*t; gCol[i*3+2] = cA[2]+(cB[2]-cA[2])*t;
}
const gGeo = new THREE.BufferGeometry();
gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
gGeo.setAttribute('color',    new THREE.BufferAttribute(gCol, 3));
const galaxy = new THREE.Points(gGeo, new THREE.PointsMaterial({ size: .04, vertexColors: true, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
galaxy.position.set(-6.5, .5, -3);
galaxy.rotation.x = .5;
scene.add(galaxy);

/* ---------- TORUS KNOT HALO (right side) ---------- */
const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, .26, 110, 14),
  new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: .16 }));
knot.position.set(6.5, -1.2, -4);
scene.add(knot);

/* ---------- DNA HELIX (left-back) ---------- */
const helix = new THREE.Group();
const sGeo  = new THREE.SphereGeometry(.05, 8, 8);
const hMatA = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
const hMatB = new THREE.MeshBasicMaterial({ color: 0xff2d75 });
for (let i = 0; i < 60; i++) {
  const t = i * .35;
  const a = new THREE.Mesh(sGeo, hMatA);
  a.position.set(Math.cos(t) * 1.1, i * .12 - 3.6, Math.sin(t) * 1.1);
  const b = new THREE.Mesh(sGeo, hMatB);
  b.position.set(Math.cos(t + Math.PI) * 1.1, i * .12 - 3.6, Math.sin(t + Math.PI) * 1.1);
  helix.add(a, b);
  if (i % 4 === 0) {
    const lg = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
    helix.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: .3 })));
  }
}
helix.position.set(5.5, 0, -5);
scene.add(helix);

/* ---------- 3D WIREFRAME "NEXORA" TEXT (fixed loader) ---------- */
let heroText = null;
if (THREE.FontLoader && THREE.TextGeometry) {
  new THREE.FontLoader().load(
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json',
    font => {
      const tg = new THREE.TextGeometry('NEXORA', {
        font, size: .72, height: .14, curveSegments: 6,
        bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2
      });
      tg.center();
      heroText = new THREE.Mesh(tg,
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: .55 }));
      heroText.position.y = -3.6;
      core.add(heroText);
    });
}

/* ---------- WARP STARFIELD ---------- */
const WN = 400;
const wPos = new Float32Array(WN * 3), wVel = new Float32Array(WN);
for (let i = 0; i < WN; i++) {
  wPos[i*3] = (Math.random() - .5) * 44;
  wPos[i*3+1] = (Math.random() - .5) * 44;
  wPos[i*3+2] = -60 + Math.random() * 70;
  wVel[i] = .1 + Math.random() * .3;
}
const wGeo = new THREE.BufferGeometry();
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
scene.add(new THREE.Points(wGeo, new THREE.PointsMaterial({ color: 0x00f0ff, size: .06, transparent: true, opacity: .7 })));

/* ---------- WAVE TERRAIN ---------- */
const terraGeo  = new THREE.PlaneGeometry(70, 36, 90, 44);
const terraBase = terraGeo.attributes.position.array.slice();
const terra = new THREE.Mesh(terraGeo,
  new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: .12 }));
terra.rotation.x = -Math.PI / 2; terra.position.y = -6;
scene.add(terra);

/* ---------- AMBIENT PARTICLES ---------- */
const N = 900, pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  const r = 4 + Math.random() * 11, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
  pos[i*3] = r * Math.sin(ph) * Math.cos(th);
  pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
  pos[i*3+2] = r * Math.cos(ph);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x8b5cf6, size: .035, transparent: true, opacity: .75 }));
scene.add(particles);

/* ---------- HOLO PANELS ---------- */
const panels = new THREE.Group(); scene.add(panels);
for (let i = 0; i < 5; i++) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.2, .8)),
    new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: .5 }));
  const a = (i / 5) * Math.PI * 2;
  edges.position.set(Math.cos(a) * 5.5, (Math.random() - .5) * 4, Math.sin(a) * 5.5 - 2);
  edges.userData = { ph: Math.random() * 6, sp: .3 + Math.random() * .4 };
  panels.add(edges);
}

/* ---------- INTERACTION ---------- */
const mouse = { x: 0, y: 0 };
addEventListener('mousemove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
}, { passive: true });
let scrollP = 0;
addEventListener('scroll', () => { scrollP = Math.min(scrollY / innerHeight, 1); }, { passive: true });

const ray = new THREE.Raycaster(), m2 = new THREE.Vector2();
const punch = { v: 1 }, shake = { v: 0 };
canvas.addEventListener('pointerdown', e => {
  m2.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(m2, camera);
  if (ray.intersectObject(coreMesh).length || ray.intersectObject(cage).length) {
    if (window.blip) { blip(120, .4, 'sawtooth', .08); blip(60, .5, 'sine', .1); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: .9 }));
    core.add(ring);
    gsap.to(ring.scale, { x: 7, y: 7, z: 7, duration: 1.1, ease: 'power3.out' });
    gsap.to(ring.material, { opacity: 0, duration: 1.1,
      onComplete: () => { core.remove(ring); ring.geometry.dispose(); ring.material.dispose(); } });
    gsap.fromTo(punch, { v: 1.3 }, { v: 1, duration: .9, ease: 'elastic.out(1,.35)' });
    gsap.fromTo(shake, { v: .3 }, { v: 0, duration: .7, ease: 'power2.out' });
  }
});

/* ---------- FPS AUTO-TUNER: never lags, even on weak GPUs ---------- */
let frameCount = 0;
setInterval(() => {
  const fps = frameCount / 2; frameCount = 0;
  if (fps < 40 && pixelRatio > 1)      { pixelRatio -= .25; renderer.setPixelRatio(pixelRatio); }
  else if (fps > 57 && pixelRatio < Math.min(devicePixelRatio, 2)) { pixelRatio += .25; renderer.setPixelRatio(pixelRatio); }
}, 2000);

/* ---------- RENDER LOOP ---------- */
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  const S = NOVA_STATE;
  const spd = S.party ? 3 : 1;
  frameCount++;

  /* smooth-state uniforms: think / speak / mic */
  U.uTime.value  = t;
  U.uThink.value += ((S.thinking ? 1 : 0) - U.uThink.value) * .06;
  U.uSpeak.value += ((S.speaking ? 1 : 0) - U.uSpeak.value) * .1;
  U.uMic.value   += ((S.micLevel  || 0)   - U.uMic.value)   * .2;

  if (S.party) {
    keyLight.color.setHSL((t * .2) % 1, 1, .6);
    rimLight.color.setHSL((t * .2 + .33) % 1, 1, .6);
  }
  coreMesh.rotation.y = t * .25 * spd;
  holoMesh.rotation.y = t * .25 * spd;
  holoMesh.rotation.x = Math.sin(t * .4) * .15;
  cage.rotation.y = -t * .12 * spd;
  cage.rotation.z = t * .07;
  ring1.rotation.z = t * .3 * spd;
  ring2.rotation.z = -t * .22 * spd;
  glow.material.opacity = .75 + Math.sin(t * 2.2) * .25 + U.uThink.value * .4 + U.uMic.value * .4;

  /* speech pulse ring follows voice */
  speakRing.material.opacity = U.uSpeak.value * .6 + U.uMic.value * .5;
  const sr = 1 + U.uSpeak.value * .35 + U.uMic.value * .6 + Math.sin(t * 6) * .04 * U.uSpeak.value;
  speakRing.scale.set(sr, sr, 1);

  sats.forEach(s => {
    const u = s.userData;
    s.position.set(Math.cos(t * u.sp * spd + u.ph) * u.r, Math.sin(t * u.sp * .7 + u.ph) * 1.2, Math.sin(t * u.sp * spd + u.ph) * u.r);
    s.rotation.x = t; s.rotation.y = t * 1.3;
  });

  galaxy.rotation.z = t * .12;
  knot.rotation.x = t * .2; knot.rotation.y = t * .15;
  helix.rotation.y = t * .5;
  if (heroText) { heroText.rotation.y = t * .3; heroText.position.y = -3.6 + Math.sin(t) * .25; }

  const wp = wGeo.attributes.position.array;
  for (let i = 0; i < WN; i++) {
    wp[i*3+2] += wVel[i] * (1 + scrollP * 10);
    if (wp[i*3+2] > 10) wp[i*3+2] = -60;
  }
  wGeo.attributes.position.needsUpdate = true;

  const tp = terraGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const ix = i * 3, x = terraBase[ix], y = terraBase[ix + 1];
    tp.array[ix + 2] = Math.sin(x * .28 + t) * Math.cos(y * .3 + t * .8) * .7;
  }
  tp.needsUpdate = true;

  panels.children.forEach(pn => {
    pn.position.y += Math.sin(t * pn.userData.sp + pn.userData.ph) * .003;
    pn.lookAt(camera.position);
  });
  particles.rotation.y = t * .02 * spd;

  /* camera: parallax + scroll dolly + shake */
  camera.position.x += (mouse.x * 1.4 - camera.position.x) * .05;
  camera.position.y += (mouse.y * 1.0 - camera.position.y) * .05;
  camera.position.z = (S.party ? 6.5 : 10) - scrollP * 2.2;
  camera.position.x += (Math.random() - .5) * shake.v;
  camera.position.y += (Math.random() - .5) * shake.v;
  camera.lookAt(0, 0, 0);

  core.position.y = scrollP * 3.4;
  core.scale.setScalar((1 - scrollP * .25) * punch.v);

  if (!document.hidden) renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* debounced resize */
let rzT;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }, 120);
});
```

---
