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

const gem = new THREE.Mesh(
  new THREE.DodecahedronGeometry(1.05, 0),
  new THREE.MeshStandardMaterial({ color: 0x20232f, metalness: 0.9, roughness: 0.2, flatShading: true, emissive: 0x2a1408, emissiveIntensity: 0.6 })
);
core.add(gem);
const gemWire = new THREE.Mesh(
  new THREE.DodecahedronGeometry(1.09, 0),
  new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0.7 })
);
core.add(gemWire);

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

  gem.rotation.y = t * 0.35;
  gem.rotation.x = t * 0.2 + scroll * 3;
  gemWire.rotation.copy(gem.rotation);
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
