import * as THREE from "three";

const canvas = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0d0f14, 0.05);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
camera.position.set(0, 2.2, 10);

const GOLD = new THREE.Color(0xffc23d);
const RED = new THREE.Color(0xff4d5e);
const MINT = new THREE.Color(0x33e0b8);
const ACCENTS = [GOLD, RED, MINT];

// ---- Hex arena floor -------------------------------------------------------
// Instanced hexagonal pillars on an axial hex grid. A ripple runs out from the
// centre, and a handful of "lit" tiles pulse in the accent colours.
const HEX_R = 0.62;           // tile radius
const RINGS = 13;             // grid radius in tiles
const hexGeo = new THREE.CylinderGeometry(HEX_R * 0.94, HEX_R * 0.94, 1, 6);
hexGeo.translate(0, -0.5, 0); // top face at y = 0
const hexMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.45 });
const cells = [];
for (let q = -RINGS; q <= RINGS; q++) {
  for (let r = Math.max(-RINGS, -q - RINGS); r <= Math.min(RINGS, -q + RINGS); r++) {
    const x = HEX_R * Math.sqrt(3) * (q + r / 2);
    const z = HEX_R * 1.5 * r;
    cells.push({ x, z, d: Math.hypot(x, z), lit: Math.random() < 0.07, accent: ACCENTS[Math.floor(Math.random() * 3)], phase: Math.random() * Math.PI * 2 });
  }
}
const floor = new THREE.InstancedMesh(hexGeo, hexMat, cells.length);
floor.position.set(0, -2.6, -6);
scene.add(floor);
const base = new THREE.Color(0x181b26);
const tmp = new THREE.Object3D();
const tmpColor = new THREE.Color();

// Glowing outlines on top of every tile give the board its HUD look.
const edgeGeo = new THREE.EdgesGeometry(new THREE.CylinderGeometry(HEX_R * 0.94, HEX_R * 0.94, 0.001, 6));
const edgePositions = [];
const edgeArr = edgeGeo.attributes.position.array;
for (const c of cells) {
  for (let i = 0; i < edgeArr.length; i += 3) edgePositions.push(edgeArr[i] + c.x, edgeArr[i + 1] + 0.01, edgeArr[i + 2] + c.z);
}
const edgeLines = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3)),
  new THREE.LineBasicMaterial({ color: 0x3a3f55, transparent: true, opacity: 0.55 })
);
floor.add(edgeLines);

// ---- Hologram core ---------------------------------------------------------
const core = new THREE.Group();
scene.add(core);

const glowMat = (color, intensity = 1) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: 0.2, roughness: 0.4 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2030, metalness: 0.75, roughness: 0.32 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x2c3042, metalness: 0.6, roughness: 0.4 });
const goldMetal = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.25, emissive: 0x3a2600, emissiveIntensity: 0.6 });

// Game controller (the centrepiece): extruded body outline with grips,
// d-pad, four glowing face buttons, two thumbsticks and a light bar.
function makeController() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.9, 0.62);
  s.lineTo(0.9, 0.62);
  s.bezierCurveTo(1.45, 0.62, 1.7, 0.2, 1.65, -0.35);
  s.bezierCurveTo(1.6, -0.95, 1.25, -1.15, 1.0, -0.95);
  s.bezierCurveTo(0.8, -0.8, 0.65, -0.45, 0.45, -0.42);
  s.lineTo(-0.45, -0.42);
  s.bezierCurveTo(-0.65, -0.45, -0.8, -0.8, -1.0, -0.95);
  s.bezierCurveTo(-1.25, -1.15, -1.6, -0.95, -1.65, -0.35);
  s.bezierCurveTo(-1.7, 0.2, -1.45, 0.62, -0.9, 0.62);
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 28 });
  bodyGeo.center();
  g.add(new THREE.Mesh(bodyGeo, darkMat));
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 40), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 }));
  g.add(outline);

  const FRONT = 0.31;
  // D-pad
  const dpad = new THREE.Group();
  dpad.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.08), trimMat));
  dpad.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.08), trimMat));
  dpad.position.set(-0.95, 0.12, FRONT);
  g.add(dpad);
  // Face buttons
  const btnGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.08, 20).rotateX(Math.PI / 2);
  [[0, 0.17, GOLD], [0.17, 0, RED], [0, -0.17, MINT], [-0.17, 0, new THREE.Color(0xf1f2f6)]].forEach(([x, y, c]) => {
    const b = new THREE.Mesh(btnGeo, glowMat(c, 0.9));
    b.position.set(0.95 + x, 0.12 + y, FRONT);
    g.add(b);
  });
  // Thumbsticks
  [-0.45, 0.45].forEach((x) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 28).rotateX(Math.PI / 2), trimMat);
    base.position.set(x, -0.2, FRONT);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.12, 28).rotateX(Math.PI / 2), darkMat);
    cap.position.set(x, -0.2, FRONT + 0.08);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 32), glowMat(GOLD, 0.8));
    rim.position.set(x, -0.2, FRONT + 0.14);
    g.add(base, cap, rim);
  });
  // Light bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.04), glowMat(MINT, 1.4));
  bar.position.set(0, 0.42, FRONT);
  g.add(bar);
  g.scale.setScalar(1.05);
  return g;
}

// Trophy: lathed cup on a stem and plinth, with two handles.
function makeTrophy() {
  const g = new THREE.Group();
  const profile = [[0, 0], [0.42, 0], [0.44, 0.05], [0.4, 0.3], [0.32, 0.55], [0.2, 0.68], [0.08, 0.72], [0.07, 0.9], [0.2, 0.95], [0.22, 1.0], [0.0, 1.0]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile.reverse(), 40), goldMetal);
  cup.rotation.x = Math.PI; // wide end up
  cup.position.y = 1.0;
  g.add(cup);
  [-1, 1].forEach((side) => {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 10, 24, Math.PI), goldMetal);
    handle.rotation.z = side * -Math.PI / 2;
    handle.position.set(side * 0.42, 0.72, 0);
    g.add(handle);
  });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), darkMat);
  plinth.position.y = -0.09;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.02), glowMat(GOLD, 0.6));
  plate.position.set(0, -0.09, 0.26);
  g.add(plinth, plate);
  return g;
}

// Headset: headband arc, two ear cups with glowing rings, and a mic boom.
function makeHeadset() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 12, 40, Math.PI), darkMat);
  g.add(band);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 12, 40, Math.PI * 0.5), glowMat(RED, 0.5));
  pad.rotation.z = Math.PI * 0.25;
  g.add(pad);
  [-1, 1].forEach((side) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 32).rotateZ(Math.PI / 2), darkMat);
    cup.position.set(side * 0.66, -0.08, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 10, 32).rotateY(Math.PI / 2), glowMat(RED, 1.1));
    ring.position.set(side * 0.77, -0.08, 0);
    g.add(cup, ring);
  });
  const mic = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.72, -0.2, 0.1), new THREE.Vector3(-0.7, -0.6, 0.45), new THREE.Vector3(-0.25, -0.62, 0.55)), 20, 0.025, 8), trimMat);
  const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), glowMat(RED, 1));
  micTip.position.set(-0.25, -0.62, 0.55);
  g.add(mic, micTip);
  return g;
}

// Keycap with a glowing letter on top.
function makeKey(letter) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1d2030";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#ffc23d";
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 108, 108);
  ctx.fillStyle = "#ffc23d";
  ctx.font = "bold 72px Orbitron, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const top = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.5 });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z — the letter goes on +z.
  return new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.22), [trimMat, trimMat, trimMat, trimMat, top, darkMat]);
}

const controller = makeController();
core.add(controller);

const props = [];
const addProp = (obj, pos, scale, spin, bob) => {
  obj.position.copy(pos);
  obj.scale.setScalar(scale);
  obj.userData = { base: pos.clone(), spin, bob: Math.random() * Math.PI * 2, amp: bob };
  core.add(obj);
  props.push(obj);
};
addProp(makeTrophy(), new THREE.Vector3(2.5, 1.2, -1.2), 0.85, 0.5, 0.12);
addProp(makeHeadset(), new THREE.Vector3(-2.6, -1.3, -0.6), 0.85, -0.35, 0.1);
const keys = new THREE.Group();
[["W", 0, 0.48], ["A", -0.48, 0], ["S", 0, 0], ["D", 0.48, 0]].forEach(([l, x, y]) => {
  const k = makeKey(l);
  k.position.set(x, y, 0);
  keys.add(k);
});
keys.rotation.set(-0.35, 0.4, 0.1);
addProp(keys, new THREE.Vector3(-2.4, 1.7, -1.6), 0.9, 0, 0.14);

// Hexagonal rings (a torus with 6 radial segments is a hexagon).
const rings = [];
[
  [2.0, GOLD, 0.5, 0.06],
  [2.7, RED, -0.35, 0.04],
  [3.4, MINT, 0.22, 0.03],
].forEach(([radius, color, speed, tube], i) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 4, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = Math.PI / 2 + (i - 1) * 0.45;
  ring.rotation.y = i * 0.5;
  ring.userData.speed = speed;
  // Node markers on each corner, like a radar HUD.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color }));
    node.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    ring.add(node);
  }
  core.add(ring);
  rings.push(ring);
});

// Soft additive glow behind the core.
const glow = new THREE.Mesh(
  new THREE.PlaneGeometry(9, 9),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        float d = distance(vUv, vec2(.5)) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.2) * (0.32 + 0.06 * sin(uTime * 1.5));
        vec3 col = mix(vec3(1.0, 0.3, 0.37), vec3(1.0, 0.76, 0.24), smoothstep(0.0, 0.8, d));
        gl_FragColor = vec4(col * a, a);
      }`,
  })
);
glow.position.z = -1.2;
core.add(glow);

// ---- Stage light beams -----------------------------------------------------
const beamMat = (color) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor;
      void main(){ float a = pow(vUv.y, 1.6) * 0.16; gl_FragColor = vec4(uColor * a, a); }`,
  });
const beams = [];
[[-9, GOLD], [9, RED], [-4, MINT], [4, GOLD]].forEach(([x, color], i) => {
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 22, 24, 1, true), beamMat(color));
  beam.geometry.translate(0, -11, 0); // pivot at the tip
  beam.position.set(x, 12, -14 - (i % 2) * 6);
  beam.userData = { base: x > 0 ? -0.35 : 0.35, phase: i * 1.3 };
  scene.add(beam);
  beams.push(beam);
});

// ---- Rising embers ---------------------------------------------------------
const EMBERS = 700;
const emberPos = new Float32Array(EMBERS * 3);
const emberCol = new Float32Array(EMBERS * 3);
const emberSpeed = new Float32Array(EMBERS);
for (let i = 0; i < EMBERS; i++) {
  emberPos[i * 3] = (Math.random() - 0.5) * 40;
  emberPos[i * 3 + 1] = Math.random() * 16 - 3;
  emberPos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 6;
  const c = ACCENTS[i % 3];
  emberCol.set([c.r, c.g, c.b], i * 3);
  emberSpeed[i] = 0.006 + Math.random() * 0.018;
}
const emberGeo = new THREE.BufferGeometry();
emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
emberGeo.setAttribute("color", new THREE.BufferAttribute(emberCol, 3));
const embers = new THREE.Points(
  emberGeo,
  new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
);
scene.add(embers);

// ---- Lights ----------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const keyLight = new THREE.PointLight(0xffc23d, 40, 30);
keyLight.position.set(3, 4, 3);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0xff4d5e, 35, 30);
rimLight.position.set(-5, 1, -2);
scene.add(rimLight);
const floorLight = new THREE.DirectionalLight(0x8899ff, 0.35);
floorLight.position.set(0, 10, 4);
scene.add(floorLight);

// ---- Input: mouse parallax + scroll progress -------------------------------
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("pointermove", (e) => {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
});
let scroll = 0;
const updateScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scroll = max > 0 ? window.scrollY / max : 0;
};
window.addEventListener("scroll", updateScroll, { passive: true });

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // On narrow screens push the core back so it sits behind the text.
  if (w < 720) core.position.set(1.2, 3.6, -10);
  else core.position.set(3.4, 0.9, 0);
}
window.addEventListener("resize", resize);
resize();
updateScroll();

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;

  // Floor ripple + pulsing lit tiles
  cells.forEach((c, i) => {
    const wave = Math.sin(c.d * 0.7 - t * 1.6) * 0.18;
    const pulse = c.lit ? 0.5 + 0.5 * Math.sin(t * 2.2 + c.phase) : 0;
    tmp.position.set(c.x, wave + pulse * 0.35, c.z);
    tmp.scale.set(1, 1.2 + wave + pulse * 0.4, 1);
    tmp.updateMatrix();
    floor.setMatrixAt(i, tmp.matrix);
    if (c.lit) tmpColor.copy(base).lerp(c.accent, 0.25 + pulse * 0.75);
    else tmpColor.copy(base).offsetHSL(0, 0, wave * 0.08);
    floor.setColorAt(i, tmpColor);
  });
  floor.instanceMatrix.needsUpdate = true;
  floor.instanceColor.needsUpdate = true;

  // Controller turns toward the pointer and rocks gently; props float and spin.
  controller.rotation.y = Math.sin(t * 0.6) * 0.45 + pointer.x * 0.35 + scroll * 4;
  controller.rotation.x = -0.2 + Math.sin(t * 0.8) * 0.12 + pointer.y * 0.2;
  controller.rotation.z = Math.sin(t * 0.5) * 0.06;
  props.forEach((p) => {
    p.rotation.y += p.userData.spin * 0.01;
    p.position.y = p.userData.base.y + Math.sin(t * 1.1 + p.userData.bob) * p.userData.amp;
  });
  rings.forEach((r) => (r.rotation.z += r.userData.speed * 0.012));
  core.position.y += Math.sin(t * 1.2) * 0.002;
  glow.lookAt(camera.position);
  glow.material.uniforms.uTime.value = t;

  beams.forEach((b) => (b.rotation.z = b.userData.base + Math.sin(t * 0.4 + b.userData.phase) * 0.25));

  const pos = emberGeo.attributes.position.array;
  for (let i = 0; i < EMBERS; i++) {
    pos[i * 3 + 1] += emberSpeed[i];
    pos[i * 3] += Math.sin(t + i) * 0.002;
    if (pos[i * 3 + 1] > 13) pos[i * 3 + 1] = -3;
  }
  emberGeo.attributes.position.needsUpdate = true;

  // Camera drifts with the pointer and orbits as you scroll the page.
  const angle = scroll * Math.PI * 0.55;
  camera.position.x = Math.sin(angle) * 10 + pointer.x * 0.8;
  camera.position.z = Math.cos(angle) * 10;
  camera.position.y = 2.2 - scroll * 1.2 - pointer.y * 0.5;
  camera.lookAt(0, 0, -3);

  renderer.render(scene, camera);
}

if (reduceMotion) {
  tick();
  window.addEventListener("resize", tick);
} else {
  renderer.setAnimationLoop(tick);
}
