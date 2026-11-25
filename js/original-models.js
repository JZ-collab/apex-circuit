import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Original, code-authored car bodies ("creator series") — no third-party
 * model files. Every panel is real geometry, so it responds to the same
 * paint, lighting, shadows and reflections as the imported CC0 cars.
 */

const MAT = {
  glass: () => new THREE.MeshPhysicalMaterial({
    color: 0x09131f, metalness: 0.15, roughness: 0.06, transparent: true,
    opacity: 0.78, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2,
  }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x0b0e14, metalness: 0.45, roughness: 0.42 }),
  carbon: () => new THREE.MeshStandardMaterial({ color: 0x141922, metalness: 0.68, roughness: 0.28 }),
  head: () => new THREE.MeshStandardMaterial({ color: 0xeafcff, emissive: 0x9fe9ff, emissiveIntensity: 3.4, roughness: 0.2 }),
  tail: () => new THREE.MeshStandardMaterial({ color: 0x4a0812, emissive: 0xff2436, emissiveIntensity: 2.6, roughness: 0.25 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xdbe9f5, metalness: 1, roughness: 0.12, envMapIntensity: 2.8 }),
};

function keep(mesh) { mesh.userData.keepMaterial = true; return mesh; }

function add(root, geo, mat, pos, rot, kept = true) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  if (kept) keep(m);
  root.add(m);
  return m;
}

// Wheel placeholders give createCar() exact hub positions; they stay hidden.
function wheelAnchors(root, x = 0.84, z = 1.34, y = 0.32) {
  const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12);
  for (const [name, sx, sz] of [
    ['wheel-front-left', 1, 1], ['wheel-front-right', -1, 1],
    ['wheel-rear-left', 1, -1], ['wheel-rear-right', -1, -1],
  ]) {
    const m = new THREE.Mesh(geo, MAT.dark());
    m.name = name;
    m.position.set(sx * x, y, sz * z);
    m.rotation.z = Math.PI / 2;
    m.visible = false;
    keep(m);
    root.add(m);
  }
}

function lights(root, width, frontZ, rearZ, y = 0.62) {
  for (const sx of [-1, 1]) {
    add(root, new RoundedBoxGeometry(0.42, 0.13, 0.1, 2, 0.04), MAT.head(),
      [sx * width * 0.34, y, frontZ]);
    add(root, new RoundedBoxGeometry(0.36, 0.11, 0.08, 2, 0.03), MAT.tail(),
      [sx * width * 0.35, y + 0.02, rearZ]);
  }
}

function grille(root, width, frontZ, y = 0.5) {
  add(root, new RoundedBoxGeometry(width * 0.62, 0.26, 0.08, 2, 0.03), MAT.dark(), [0, y, frontZ + 0.02]);
  for (let i = -3; i <= 3; i++) {
    add(root, new THREE.BoxGeometry(0.025, 0.2, 0.1), MAT.chrome(), [i * width * 0.075, y, frontZ + 0.07]);
  }
}

function mirrors(root, width, y = 1.02) {
  for (const sx of [-1, 1]) {
    add(root, new THREE.BoxGeometry(0.16, 0.05, 0.06), MAT.carbon(), [sx * (width * 0.56), y, 0.55], [0, sx * 0.25, 0]);
    add(root, new RoundedBoxGeometry(0.22, 0.12, 0.11, 2, 0.035), MAT.glass(), [sx * (width * 0.62), y + 0.03, 0.55]);
  }
}

function cabin(root, w, h, d, y, z) {
  const glass = MAT.glass();
  add(root, new RoundedBoxGeometry(w, h, d, 3, 0.16), glass, [0, y, z]);
  // Pillars keep the greenhouse from looking like a plain glass block.
  const pillar = MAT.carbon();
  for (const sx of [-1, 1]) {
    add(root, new THREE.BoxGeometry(0.07, h * 0.98, 0.09), pillar, [sx * w * 0.49, y, z + d * 0.35], [0, 0, sx * 0.18]);
    add(root, new THREE.BoxGeometry(0.07, h * 0.98, 0.09), pillar, [sx * w * 0.49, y, z - d * 0.35], [0, 0, -sx * 0.18]);
  }
}

function buildGT(root, accent) {
  const body = new THREE.MeshPhysicalMaterial({ color: 0x3ba7ff, metalness: 0.62, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6 });
  add(root, new RoundedBoxGeometry(1.86, 0.56, 4.24, 4, 0.2), body, [0, 0.52, 0], null, false);
  add(root, new RoundedBoxGeometry(1.72, 0.22, 1.36, 3, 0.1), body, [0, 0.83, 1.28], null, false);
  add(root, new RoundedBoxGeometry(1.8, 0.18, 0.92, 3, 0.07), body, [0, 0.78, -1.55], null, false);
  cabin(root, 1.58, 0.62, 1.92, 1.09, -0.18);
  lights(root, 1.86, 2.12, -2.12);
  grille(root, 1.86, 2.13);
  mirrors(root, 1.86);
  add(root, new RoundedBoxGeometry(1.94, 0.1, 3.5, 2, 0.04), MAT.carbon(), [0, 0.27, 0]);
  add(root, new RoundedBoxGeometry(1.9, 0.22, 0.28, 2, 0.06), MAT.carbon(), [0, 0.34, -2.16]);
  // Hood vents and accent blade.
  for (const sx of [-1, 1]) {
    add(root, new THREE.BoxGeometry(0.32, 0.02, 0.16), MAT.dark(), [sx * 0.5, 0.945, 0.85]);
    add(root, new THREE.BoxGeometry(0.06, 0.015, 1.3), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 }), [sx * 0.32, 0.95, 1.25]);
  }
  add(root, new RoundedBoxGeometry(1.72, 0.06, 0.3, 2, 0.025), MAT.carbon(), [0, 1.42, -1.86], [-0.12, 0, 0]);
  for (const sx of [-1, 1]) add(root, new THREE.BoxGeometry(0.05, 0.28, 0.06), MAT.carbon(), [sx * 0.6, 1.29, -1.86]);
  wheelAnchors(root);
}

function buildRally(root, accent) {
  const body = new THREE.MeshPhysicalMaterial({ color: 0xa8ef31, metalness: 0.38, roughness: 0.28, clearcoat: 0.6, envMapIntensity: 1.1 });
  add(root, new RoundedBoxGeometry(1.94, 0.62, 4.12, 4, 0.17), body, [0, 0.56, 0], null, false);
  add(root, new RoundedBoxGeometry(1.78, 0.24, 1.28, 3, 0.09), body, [0, 0.9, 1.3], null, false);
  cabin(root, 1.62, 0.68, 1.9, 1.16, -0.2);
  // Fender flares and raised suspension cues.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(root, new RoundedBoxGeometry(0.24, 0.34, 1.05, 2, 0.1), body,
      [sx * 0.94, 0.5, sz * 1.34], null, false);
  }
  lights(root, 1.94, 2.08, -2.06, 0.68);
  grille(root, 1.94, 2.1, 0.55);
  mirrors(root, 1.94, 1.08);
  // Rally light bar, roof scoop and exposed roll cage.
  add(root, new THREE.BoxGeometry(1.5, 0.11, 0.12), MAT.carbon(), [0, 1.62, 1.02]);
  for (const sx of [-1, 1]) add(root, new THREE.CylinderGeometry(0.11, 0.11, 0.09, 12), MAT.head(), [sx * 0.5, 1.62, 1.09], [Math.PI / 2, 0, 0]);
  add(root, new RoundedBoxGeometry(0.5, 0.18, 0.72, 2, 0.07), MAT.carbon(), [0, 1.6, -0.72]);
  for (const sx of [-1, 1]) {
    add(root, new THREE.CylinderGeometry(0.035, 0.035, 1.55, 8), MAT.chrome(), [sx * 0.62, 1.34, 0.35], [0.35, 0, 0.42]);
  }
  add(root, new RoundedBoxGeometry(2.0, 0.1, 3.6, 2, 0.04), MAT.carbon(), [0, 0.3, 0]);
  add(root, new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), body, [0, 0.72, -2.2], [Math.PI / 2, 0, 0], false);
  add(root, new THREE.BoxGeometry(0.08, 0.02, 1.4), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4 }), [0, 0.88, 1.2]);
  wheelAnchors(root, 0.9, 1.36, 0.38);
}

function buildHyper(root, accent) {
  const body = new THREE.MeshPhysicalMaterial({ color: 0xff3e9d, metalness: 0.72, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2 });
  add(root, new RoundedBoxGeometry(1.98, 0.42, 4.5, 4, 0.16), body, [0, 0.42, 0], null, false);
  add(root, new RoundedBoxGeometry(1.86, 0.16, 1.55, 3, 0.07), body, [0, 0.68, 1.35], null, false);
  cabin(root, 1.5, 0.5, 2.2, 0.92, -0.18);
  lights(root, 1.98, 2.25, -2.24, 0.54);
  grille(root, 1.98, 2.26, 0.42);
  mirrors(root, 1.98, 0.95);
  // Aggressive aero: low splitter, side intakes, diffuser and a huge wing.
  add(root, new THREE.BoxGeometry(2.1, 0.05, 0.52), MAT.carbon(), [0, 0.16, 2.18], [0.08, 0, 0]);
  for (const sx of [-1, 1]) {
    add(root, new RoundedBoxGeometry(0.18, 0.26, 1.1, 2, 0.06), MAT.carbon(), [sx * 0.94, 0.38, -0.35]);
    add(root, new THREE.BoxGeometry(0.16, 0.22, 0.5), MAT.dark(), [sx * 0.9, 0.52, 0.65]);
    add(root, new THREE.BoxGeometry(0.06, 0.5, 0.1), MAT.carbon(), [sx * 0.7, 0.72, -2.0]);
  }
  add(root, new RoundedBoxGeometry(1.96, 0.08, 0.46, 2, 0.03), MAT.carbon(), [0, 0.96, -1.95], [-0.16, 0, 0]);
  add(root, new THREE.BoxGeometry(0.58, 0.02, 1.5), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 }), [0, 0.62, 1.35]);
  wheelAnchors(root, 0.9, 1.46, 0.34);
}

export function isOriginal(id) { return id === 'apex-gt' || id === 'apex-rally' || id === 'apex-hyper'; }

export function buildOriginalCar(id, paint, accent) {
  const root = new THREE.Group();
  root.name = 'creator-series-' + id;
  const accentColor = new THREE.Color(accent || '#48e6ff');
  if (id === 'apex-rally') buildRally(root, accentColor);
  else if (id === 'apex-hyper') buildHyper(root, accentColor);
  else buildGT(root, accentColor);
  return root;
}
