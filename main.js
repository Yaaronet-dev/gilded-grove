import * as THREE from "three";

const canvas = document.getElementById("roll");
const toggleBtn = document.getElementById("toggleRoll");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

// ---------- Lights: warm gold key, green rim ----------
scene.add(new THREE.HemisphereLight(0xfff6e0, 0x1d4a37, 0.9));
const key = new THREE.DirectionalLight(0xffe2a8, 2.2);
key.position.set(4, 5, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7fd1a0, 1.6);
rim.position.set(-6, 2, -4);
scene.add(rim);
const fill = new THREE.PointLight(0xc9a24a, 8, 20);
fill.position.set(-3, -3, 4);
scene.add(fill);

// ---------- Textures ----------
function quiltTexture({ perforated }) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#f8f4ea";
  g.fillRect(0, 0, 256, 256);
  // embossed diamond quilt
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const ox = (y / 32) % 2 ? 16 : 0;
      const grd = g.createRadialGradient(x + ox, y + 16, 1, x + ox, y + 16, 9);
      grd.addColorStop(0, "rgba(160,140,100,0.22)");
      grd.addColorStop(1, "rgba(160,140,100,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x + ox, y + 16, 9, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (perforated) {
    g.strokeStyle = "rgba(120,100,60,0.45)";
    g.lineWidth = 2;
    g.setLineDash([6, 5]);
    g.beginPath();
    g.moveTo(0, 1);
    g.lineTo(256, 1);
    g.stroke();
    // tiny gold leaf mark in the centre of each sheet
    g.setLineDash([]);
    g.fillStyle = "rgba(201,162,74,0.85)";
    g.beginPath();
    g.ellipse(128, 128, 5, 11, Math.PI / 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function endTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#f3eee0";
  g.fillRect(0, 0, 512, 512);
  // concentric layers of wound paper
  for (let r = 256; r > 90; r -= 3) {
    g.strokeStyle = `rgba(150,130,95,${0.08 + Math.random() * 0.12})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Roll ----------
const R = 1.1;         // roll radius
const W = 2.0;         // roll width
const HOLE = 0.42;     // tube radius
const SHEET_LEN = 0.9; // one perforated sheet

const root = new THREE.Group();
scene.add(root);
const spin = new THREE.Group();
root.add(spin);

const paperMat = new THREE.MeshStandardMaterial({ map: quiltTexture({ perforated: false }), roughness: 0.92 });
paperMat.map.repeat.set(8, 2);
const sideGeo = new THREE.CylinderGeometry(R, R, W, 128, 1, true).rotateZ(Math.PI / 2);
spin.add(new THREE.Mesh(sideGeo, paperMat));

const endMat = new THREE.MeshStandardMaterial({ map: endTexture(), roughness: 0.95 });
for (const side of [1, -1]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(HOLE, R, 96).rotateY(side * Math.PI / 2), endMat);
  ring.position.x = side * W / 2;
  spin.add(ring);
}

const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide });
spin.add(new THREE.Mesh(new THREE.CylinderGeometry(HOLE, HOLE, W + 0.02, 64, 1, true).rotateZ(Math.PI / 2), goldMat));
for (const side of [1, -1]) {
  const lip = new THREE.Mesh(new THREE.TorusGeometry(HOLE, 0.018, 12, 64).rotateY(Math.PI / 2), goldMat);
  lip.position.x = side * (W / 2 + 0.01);
  spin.add(lip);
}

// ---------- Unrolling sheet ----------
const COLS = 10, ROWS = 180;
const sheetGeo = new THREE.BufferGeometry();
const pos = new Float32Array((COLS + 1) * (ROWS + 1) * 3);
const uv = new Float32Array((COLS + 1) * (ROWS + 1) * 2);
const idx = [];
for (let i = 0; i < ROWS; i++) {
  for (let j = 0; j < COLS; j++) {
    const a = i * (COLS + 1) + j, b = a + 1, c = a + COLS + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
}
sheetGeo.setIndex(idx);
sheetGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
sheetGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
const sheetMat = new THREE.MeshStandardMaterial({
  map: quiltTexture({ perforated: true }),
  roughness: 0.9,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -1,
});
const sheet = new THREE.Mesh(sheetGeo, sheetMat);
root.add(sheet);

const RP = R + 0.006;     // sheet sits just above the roll surface
const A0 = -0.7;          // where the loose sheet starts on top of the roll
const ARC = RP * (Math.PI / 2 - A0);
const CLOSED = 0.22, OPEN = 3.4;

let length = CLOSED, targetLength = CLOSED;
let swingX = 0, swingXV = 0, swingZ = 0, swingZV = 0;

function updateSheet(t) {
  const total = ARC + length;
  const halfW = W / 2 - 0.015;
  for (let i = 0; i <= ROWS; i++) {
    const s = (i / ROWS) * total;
    let x0 = 0, y, z;
    if (s <= ARC) {
      const a = A0 + s / RP;
      y = RP * Math.cos(a);
      z = RP * Math.sin(a);
    } else {
      const h = s - ARC;
      const reach = Math.min(h, 1);
      y = -h;
      z = RP
        + Math.sin(h * 2.2 - t * 1.6) * 0.05 * reach        // gentle breeze
        + swingZ * h * 0.35                                 // mouse-driven sway
        + Math.pow(Math.max(0, h - (length - 0.45)), 2) * 0.9; // curl at the free end
      x0 = swingX * Math.pow(h, 1.4) * 0.18;
    }
    for (let j = 0; j <= COLS; j++) {
      const k = i * (COLS + 1) + j;
      const u = j / COLS;
      const x = -halfW + u * halfW * 2;
      const ripple = s > ARC ? Math.sin(u * Math.PI) * Math.sin(t * 2 + s * 3) * 0.015 : 0;
      pos[k * 3] = x + x0;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z + ripple;
      uv[k * 2] = u;
      uv[k * 2 + 1] = (total - s) / SHEET_LEN; // pattern stays fixed to the free end
    }
  }
  sheetGeo.attributes.position.needsUpdate = true;
  sheetGeo.attributes.uv.needsUpdate = true;
  sheetGeo.computeVertexNormals();
  sheetGeo.computeBoundingSphere();
}

// ---------- Gold dust ----------
const dustCount = 140;
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 9;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xe8cf8c, size: 0.035, transparent: true, opacity: 0.75, depthWrite: false,
}));
scene.add(dust);

// ---------- Interaction ----------
const pointer = { x: 0, y: 0 }, prev = { x: 0, y: 0 };
function onMove(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = (clientY / window.innerHeight) * 2 - 1;
}
window.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));

let isOpen = false;
function toggle() {
  isOpen = !isOpen;
  targetLength = isOpen ? OPEN : CLOSED;
  toggleBtn.textContent = isOpen ? "Roll it up" : "Unroll";
}
canvas.addEventListener("click", toggle);
toggleBtn.addEventListener("click", toggle);
if (location.hash === "#open") { toggle(); length = OPEN; }

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 0, camera.aspect < 0.9 ? 13 / camera.aspect ** 0.5 : 11);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clock = new THREE.Clock();

function frame() {
  const t = clock.getElapsedTime();

  // pointer velocity kicks the hanging sheet like a pendulum
  const vx = pointer.x - prev.x, vy = pointer.y - prev.y;
  prev.x = pointer.x; prev.y = pointer.y;
  swingXV += -vx * 2.2 - swingX * 0.06 - swingXV * 0.08;
  swingZV += vy * 1.6 - swingZ * 0.06 - swingZV * 0.08;
  swingX += swingXV; swingZ += swingZV;

  // roll follows the mouse
  const bob = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.08;
  root.rotation.y += (pointer.x * 0.75 - 0.35 - root.rotation.y) * 0.06;
  root.rotation.x += (pointer.y * 0.35 + 0.12 - root.rotation.x) * 0.06;
  root.position.y = 1.15 + bob;

  // unroll / roll up: the roll turns by exactly the paper it releases
  length += (targetLength - length) * 0.045;
  spin.rotation.x = length / R;

  updateSheet(reduceMotion ? 0 : t);

  dust.rotation.y = t * 0.02;
  dust.position.y = Math.sin(t * 0.3) * 0.2;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
