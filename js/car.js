import * as THREE from 'three';
import { cloneModel, localBox } from './assets.js';
import { computeSpecs, findPart } from './config.js';

let glowTexture, shadowTexture, numberCache = new Map();

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function numberTexture(text, color) {
  const key = text + '|' + color;
  if (numberCache.has(key)) return numberCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = 'bold 82px Rajdhani, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  numberCache.set(key, tex);
  return tex;
}

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: opts.metalness ?? 0.45, roughness: opts.roughness ?? 0.38,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Build a fully customized car.
 * Returns { group, specs, update(dt, driveState), dispose() }.
 */
export async function createCar(setup, { isPlayer = false } = {}) {
  const specs = computeSpecs(setup);
  const modelDef = findPart('car', setup.car);
  const wheelDef = findPart('wheels', setup.wheels);
  const paint = findPart('paint', setup.paint).color;
  const accent = findPart('accent', setup.accent).color;
  const glow = findPart('underglow', setup.underglow).color;

  const root = new THREE.Group();
  root.name = 'car-root';

  const body = await cloneModel(modelDef.model);
  root.add(body);

  // Locate embedded wheels before hiding them — they tell us exactly where the hubs are.
  const wheelNodes = [];
  body.traverse(o => { if (o.isMesh && /wheel/i.test(o.name)) wheelNodes.push(o); });
  const anchors = [];
  for (const node of wheelNodes) {
    const center = localBox(node, body).getCenter(new THREE.Vector3());
    anchors.push({ pos: center, front: /front/i.test(node.name) || center.z > 0.25 });
    node.visible = false;
  }
  if (!anchors.length) {
    const z = 0.66, x = 0.36;
    anchors.push(
      { pos: new THREE.Vector3(x, 0.3, z), front: true },
      { pos: new THREE.Vector3(-x, 0.3, z), front: true },
      { pos: new THREE.Vector3(x, 0.3, -z), front: false },
      { pos: new THREE.Vector3(-x, 0.3, -z), front: false },
    );
  }

  // Paint: cloned materials so rival cars don't share the player's color.
  body.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    o.geometry = o.geometry.clone();
    o.material = o.material.clone();
    o.material.color = new THREE.Color(paint);
    o.material.metalness = 0.42;
    o.material.roughness = 0.32;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  body.position.y += specs.ride;
  body.updateWorldMatrix(true, true);
  const bodyBox = new THREE.Box3().setFromObject(body);
  const size = bodyBox.getSize(new THREE.Vector3());
  const halfW = Math.max(size.x * 0.5, 0.7);
  const length = Math.max(size.z, 2.2);
  const top = Math.max(bodyBox.max.y, 0.9);

  // Wheel assemblies.
  const wheelModel = await cloneModel(wheelDef.model);
  const wheelTemplate = wheelModel.getObjectByProperty('isMesh', true) || wheelModel.children[0];
  const spinnerGroups = [];
  const steerPivots = [];
  const radius = anchors.length ? Math.max(anchors[0].pos.y, 0.12) : 0.3;
  const wheelScale = THREE.MathUtils.clamp(radius / 0.3, 0.55, 1.35);
  for (const anchor of anchors) {
    const steer = new THREE.Group();
    steer.position.copy(anchor.pos);
    steer.position.y = radius;
    const spin = new THREE.Group();
    const mesh = wheelTemplate.clone();
    mesh.geometry = wheelTemplate.geometry.clone();
    mesh.material = wheelTemplate.material.clone();
    mesh.scale.setScalar(wheelScale);
    mesh.castShadow = true;
    spin.add(mesh);
    steer.add(spin);
    root.add(steer);
    spinnerGroups.push(spin);
    if (anchor.front) steerPivots.push(steer);
  }

  // Grounding shadow.
  if (!glowTexture) glowTexture = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.35)');
  if (!shadowTexture) shadowTexture = radialTexture('rgba(0,0,0,.6)', 'rgba(0,0,0,.25)');
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(length * 1.25, halfW * 2.7),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.55 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  // Accent stripes over the hood.
  const stripeMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.22, metalness: 0.2, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, length * 0.42), stripeMat);
    stripe.position.set(sx * halfW * 0.32, top * 0.72, length * 0.24);
    root.add(stripe);
  }

  // Rear wing / ducktail.
  const spoilerId = setup.spoiler;
  if (spoilerId === 'wing') {
    const rearZ = bodyBox.min.z * 0.78;
    const wing = box(halfW * 1.85, 0.07, 0.3, accent, { metalness: 0.6 });
    wing.position.set(0, top * 1.02, rearZ);
    wing.rotation.x = -0.12;
    root.add(wing);
    for (const sx of [-1, 1]) {
      const support = box(0.05, top * 0.3, 0.05, 0x141820);
      support.position.set(sx * halfW * 0.62, top * 0.86, rearZ);
      root.add(support);
    }
  } else if (spoilerId === 'ducktail') {
    const duck = box(halfW * 1.6, 0.045, 0.18, paint, { metalness: 0.4 });
    duck.position.set(0, top * 0.86, bodyBox.min.z * 0.9);
    duck.rotation.x = 0.22;
    root.add(duck);
  }

  // Body kit: skirts and a front splitter.
  if (setup.bodyKit !== 'stock') {
    const wide = setup.bodyKit === 'wide';
    const skirtColor = new THREE.Color(paint).multiplyScalar(0.45);
    for (const sx of [-1, 1]) {
      const skirt = box(0.09, wide ? 0.16 : 0.1, length * 0.62, skirtColor);
      skirt.position.set(sx * (halfW + (wide ? 0.07 : 0)), 0.2, -0.05);
      root.add(skirt);
      if (wide) {
        for (const anchor of anchors) {
          const flare = box(0.12, 0.22, 0.55, skirtColor);
          flare.position.set(sx * (halfW + 0.04), radius * 0.95, anchor.pos.z);
          root.add(flare);
        }
      }
    }
    const splitter = box(halfW * (wide ? 2.15 : 1.95), 0.05, 0.3, 0x10141c);
    splitter.position.set(0, 0.16, bodyBox.max.z * 0.9);
    root.add(splitter);
  }

  // Window tint (a simple tinted cabin volume).
  const tintValue = findPart('tint', setup.tint).value;
  if (tintValue > 0) {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 1.55, top * 0.24, length * 0.3),
      new THREE.MeshStandardMaterial({ color: 0x05080f, transparent: true, opacity: Math.min(tintValue * 0.75, 0.6), roughness: 0.1, metalness: 0.1, depthWrite: false })
    );
    glass.position.set(0, top * 0.73, -length * 0.05);
    root.add(glass);
  }

  // Race number on the hood.
  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: numberTexture(setup.number || '07', accent), transparent: true, depthWrite: false })
  );
  number.rotation.x = -Math.PI / 2;
  number.position.set(halfW * 0.58, top * 0.735, length * 0.2);
  root.add(number);

  // Underglow.
  let glowMeshes = [];
  if (glow) {
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture, color: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(length * 1.5, halfW * 3.4), glowMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.035;
    root.add(plane);
    glowMeshes.push(plane);
    if (isPlayer) {
      for (const sx of [-1, 1]) {
        const light = new THREE.PointLight(glow, 1.4, 5, 2);
        light.position.set(sx * halfW * 0.7, 0.25, 0);
        root.add(light);
      }
    }
  }

  let spinAngle = 0;

  function update(dt, state = {}) {
    const speed = state.speed || 0;
    const steer = state.steer || 0;
    spinAngle += (speed / Math.max(radius, 0.15)) * dt;
    for (const spin of spinnerGroups) spin.rotation.x = spinAngle;
    for (const pivot of steerPivots) pivot.rotation.y = steer * 0.42;
    // Weight transfer.
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -steer * Math.min(speed * 0.0016, 0.055), 0.12);
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, -(state.accel || 0) * 0.008, 0.1);
    if (glowMeshes.length) glowMeshes[0].material.opacity = 0.62 + Math.sin(performance.now() * 0.004) * 0.12;
  }

  function dispose() {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    root.parent?.remove(root);
  }

  return { group: root, specs, update, dispose, radius };
}
