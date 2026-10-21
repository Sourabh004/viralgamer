import * as THREE from "three";

const canvas = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
// Fog fades into the page's pastel background instead of black.
scene.fog = new THREE.Fog(0xeaf2f8, 12, 55);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
camera.position.set(0, 1.2, 9);

const TEAL = 0x13b5a8;
const PINK = 0xe8559c;
const VIOLET = 0x7c6cf0;
const SUN = 0xf5b83d;

// Grid floor: two grids slide toward the camera and wrap.
const grids = [];
for (let i = 0; i < 2; i++) {
  const g = new THREE.GridHelper(80, 40, VIOLET, 0xa8b8e6);
  g.material.transparent = true;
  g.material.opacity = 0.45;
  g.position.set(0, -3, -i * 80);
  scene.add(g);
  grids.push(g);
}

// Horizon sun
const sun = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec3 top = vec3(0.98, 0.78, 0.36);
        vec3 bot = vec3(0.95, 0.52, 0.72);
        vec3 col = mix(bot, top, vUv.y);
        float stripes = step(0.5, fract(vUv.y * 14.0 + uTime * 0.15));
        float cut = vUv.y < 0.55 ? stripes : 1.0;
        gl_FragColor = vec4(col, 0.7 * cut);
      }`,
  })
);
sun.position.set(0, 3, -60);
scene.add(sun);

// Central core: wireframe icosahedron around a glossy inner gem.
const core = new THREE.Group();
scene.add(core);

const shell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.9, 1),
  new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.9 })
);
core.add(shell);

const inner = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.0, 0),
  new THREE.MeshStandardMaterial({ color: PINK, emissive: 0x6a2a8a, emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.3, flatShading: true })
);
core.add(inner);

// Soft halo behind the core (normal blending so it reads on a light page).
const halo = new THREE.Mesh(
  new THREE.CircleGeometry(3.4, 64),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uA: { value: new THREE.Color(0x9ee9e1) }, uB: { value: new THREE.Color(0xd9d3ff) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uA; uniform vec3 uB;
      void main(){ float d = distance(vUv, vec2(.5)) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(mix(uA, uB, vUv.y), a * 0.55); }`,
  })
);
halo.position.z = -1.5;
core.add(halo);

const rings = [];
[
  [2.8, TEAL, 0.6],
  [3.4, PINK, -0.4],
  [4.0, VIOLET, 0.25],
].forEach(([r, color, speed], i) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.025, 8, 160),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })
  );
  ring.rotation.x = Math.PI / 2 + (i - 1) * 0.5;
  ring.rotation.y = i * 0.6;
  ring.userData.speed = speed;
  core.add(ring);
  rings.push(ring);

  // A small "satellite" cube riding each ring
  const sat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color }));
  sat.position.x = r;
  ring.add(sat);
});

// Floating debris: low-poly shapes drifting around the scene.
const debris = [];
const shapes = [
  new THREE.TetrahedronGeometry(0.35),
  new THREE.BoxGeometry(0.4, 0.4, 0.4),
  new THREE.OctahedronGeometry(0.3),
];
const debrisColors = [TEAL, PINK, VIOLET, SUN];
for (let i = 0; i < 26; i++) {
  const color = debrisColors[i % debrisColors.length];
  const m = new THREE.Mesh(
    shapes[i % shapes.length],
    i % 2 === 0
      ? new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.8 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, flatShading: true })
  );
  const angle = Math.random() * Math.PI * 2;
  const radius = 6 + Math.random() * 10;
  m.position.set(Math.cos(angle) * radius, -1 + Math.random() * 8, Math.sin(angle) * radius - 6);
  m.userData = { spin: (Math.random() - 0.5) * 0.02, bob: Math.random() * Math.PI * 2 };
  scene.add(m);
  debris.push(m);
}

// Particle field
const starCount = 900;
const starPos = new Float32Array(starCount * 3);
const starCol = new Float32Array(starCount * 3);
const palette = [new THREE.Color(TEAL), new THREE.Color(PINK), new THREE.Color(VIOLET)];
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 120;
  starPos[i * 3 + 1] = Math.random() * 50 - 2;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 120 - 20;
  const c = palette[i % 3];
  starCol.set([c.r, c.g, c.b], i * 3);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })
);
scene.add(stars);

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d6ff, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 6, 5);
scene.add(key);

// Input: mouse parallax + scroll progress
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
  if (w < 720) core.position.set(1.5, 3.5, -10);
  else core.position.set(3.2, 0.6, 0);
}
window.addEventListener("resize", resize);
resize();
updateScroll();

const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();

  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;

  for (const g of grids) {
    g.position.z += 0.06;
    if (g.position.z > 40) g.position.z -= 160;
  }

  shell.rotation.x = t * 0.15 + scroll * 4;
  shell.rotation.y = t * 0.2;
  inner.rotation.y = -t * 0.6;
  inner.rotation.z = t * 0.3;
  inner.scale.setScalar(1 + Math.sin(t * 2) * 0.06);
  halo.lookAt(camera.position);
  rings.forEach((r) => (r.rotation.z += r.userData.speed * 0.01));

  debris.forEach((m) => {
    m.rotation.x += m.userData.spin;
    m.rotation.y += m.userData.spin * 1.3;
    m.position.y += Math.sin(t + m.userData.bob) * 0.003;
  });

  stars.rotation.y = t * 0.01;
  sun.material.uniforms.uTime.value = t;

  // Camera drifts with the pointer and orbits as you scroll the page.
  const angle = scroll * Math.PI * 0.6;
  camera.position.x = Math.sin(angle) * 9 + pointer.x * 0.8;
  camera.position.z = Math.cos(angle) * 9;
  camera.position.y = 1.2 - scroll * 1.5 - pointer.y * 0.5;
  camera.lookAt(0, 0.3, -2);

  renderer.render(scene, camera);
}

if (reduceMotion) {
  tick();
  window.addEventListener("resize", tick);
} else {
  renderer.setAnimationLoop(tick);
}
