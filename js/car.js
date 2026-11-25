import * as THREE from 'three';
import { cloneModel, loadCustomModel, localBox } from './assets.js';
import { buildOriginalCar } from './original-models.js';
import { computeSpecs, findPart } from './config.js';
import { save } from './storage.js';

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
export async function createCar(setup, { isPlayer = false, ghost = false } = {}) {
  const specs = computeSpecs(setup);
  const modelDef = findPart('car', setup.car);
  const wheelDef = findPart('wheels', setup.wheels);
  const paint = findPart('paint', setup.paint).color;
  const accent = findPart('accent', setup.accent).color;
  const glow = findPart('underglow', setup.underglow).color;

  const root = new THREE.Group();
  root.name = 'car-root';

  // Creator Series bodies are original geometry; "YOUR MODEL" is a user GLB;
  // everything else is one of the bundled CC0 models.
  let body;
  if (modelDef.custom && save.customModel?.data) body = await loadCustomModel(save.customModel.data);
  else if (modelDef.original) body = buildOriginalCar(modelDef.original, paint, accent);
  else body = await cloneModel(modelDef.model || 'sedan.glb');
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
  const bodyMats = [];
  body.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    o.geometry = o.geometry.clone();
    o.material = o.material.clone();
    if (!o.userData.keepMaterial) {
      o.material.color = new THREE.Color(paint);
      o.material.metalness = 0.62;
      o.material.roughness = 0.18;
      if (o.material.clearcoat !== undefined) o.material.clearcoat = 1;
      bodyMats.push({ mat: o.material, base: o.material.color.clone() });
    }
    if (o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 1.8;
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

  // Brake lamps and nitro flames.
  const brakeMats = [];
  const flames = [];
  const rearZ = bodyBox.min.z - 0.05;
  for (const sx of [-1, 1]) {
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x62121e });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.06), lampMat);
    lamp.position.set(sx * halfW * 0.56, top * 0.5, rearZ);
    root.add(lamp);
    brakeMats.push(lampMat);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7deaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(sx * halfW * 0.42, 0.36, rearZ - 0.34);
    root.add(flame);
    flames.push(flame);
  }

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

  // Ghost replay car: translucent, glowing, no lights or shadow.
  if (ghost) {
    root.traverse(o => {
      if (o.isLight) { o.intensity = 0; return; }
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.transparent = true;
        m.opacity = 0.26;
        m.depthWrite = false;
        if (m.emissive) { m.emissive = new THREE.Color(accent); m.emissiveIntensity = 0.8; }
      }
      o.castShadow = false;
    });
    glowMeshes = [];
  }

  let spinAngle = 0;
  const damageColor = new THREE.Color(0x33221c);

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

    // Brake lamps.
    const bright = state.brake ? 0xff2838 : 0x62121e;
    for (const m of brakeMats) m.color.setHex(bright);

    // Nitro flames flicker while boosting.
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      if (state.boost && !ghost) {
        f.material.opacity = 0.55 + Math.random() * 0.4;
        f.scale.y = 0.7 + Math.random() * 0.75;
        f.material.color.setHex(Math.random() > 0.5 ? 0x7deaff : 0xffa24a);
      } else {
        f.material.opacity = Math.max(0, f.material.opacity - dt * 4);
      }
    }

    // Collision damage darkens and dirties the paint.
    if (state.damage) {
      for (const { mat, base } of bodyMats) mat.color.copy(base).lerp(damageColor, Math.min(state.damage * 0.6, 0.6));
    }
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
