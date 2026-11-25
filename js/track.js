import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#f2f6ff' : '#11151d';
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Track {
  constructor(def) {
    this.def = def;
    this.width = def.width;
    this.half = def.width / 2;
    const pts = def.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();

    const count = Math.max(220, Math.ceil(this.length / 2.4));
    this.samples = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const p = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).setY(0).normalize();
      this.samples.push({
        i, t, x: p.x, z: p.z, tx: tan.x, tz: tan.z,
        dist: t * this.length,
        angle: Math.atan2(tan.x, tan.z),
      });
    }
    this.count = count;
    this.group = null;
  }

  sample(i) { return this.samples[((i % this.count) + this.count) % this.count]; }

  atDistance(d) {
    const wrapped = ((d % this.length) + this.length) % this.length;
    return this.sample(Math.floor(wrapped / this.length * this.count));
  }

  // Closest point on the racing line, with a hint for continuity.
  nearest(x, z, hint = 0) {
    let best = -1, bestSq = Infinity;
    const scan = (from, to) => {
      for (let k = from; k <= to; k++) {
        const s = this.sample(k);
        const dx = s.x - x, dz = s.z - z;
        const d = dx * dx + dz * dz;
        if (d < bestSq) { bestSq = d; best = k; }
      }
    };
    scan(hint - 34, hint + 34);
    if (bestSq > 1600) scan(0, this.count - 1);
    const s = this.sample(best);
    const rx = s.tz, rz = -s.tx; // right of the racing line
    const lateral = (x - s.x) * rx + (z - s.z) * rz;
    return { index: best, sample: s, dist: Math.sqrt(bestSq), lateral };
  }

  pointAhead(index, distance, lateral = 0) {
    const steps = Math.max(1, Math.round(distance / (this.length / this.count)));
    const s = this.sample(index + steps);
    return {
      x: s.x + s.tz * lateral,
      z: s.z - s.tx * lateral,
      sample: s,
    };
  }

  curvature(index, look = 8) {
    const a = this.sample(index - look);
    const b = this.sample(index + look);
    let diff = b.angle - a.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff);
  }

  build() {
    const group = new THREE.Group();
    this.group = group;
    const def = this.def;
    const half = this.half;
    const samples = this.samples;

    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ color: def.ground, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    group.add(ground);

    // Road ribbon.
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= this.count; i++) {
      const s = this.sample(i);
      const rx = s.tz, rz = -s.tx;
      positions.push(s.x - rx * half, 0.005, s.z - rz * half);
      positions.push(s.x + rx * half, 0.005, s.z + rz * half);
      uvs.push(0, s.dist / 8, 1, s.dist / 8);
      if (i < this.count) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x262b36, roughness: 0.92, metalness: 0.05, side: THREE.DoubleSide }));
    road.receiveShadow = true;
    group.add(road);

    // Edge stripes and dashed center line.
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xdfe9f5, transparent: true, opacity: 0.75 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.62 });
    for (let i = 0; i < this.count; i += 2) {
      const s = this.sample(i);
      const n = this.sample(i + 2);
      const rx = s.tz, rz = -s.tx;
      const len = Math.hypot(n.x - s.x, n.z - s.z) * 1.25;
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.18, len), lineMat);
        edge.rotation.x = -Math.PI / 2;
        edge.rotation.z = -s.angle;
        edge.position.set(s.x + rx * (half - 0.35) * side, 0.02, s.z + rz * (half - 0.35) * side);
        group.add(edge);
      }
      if (i % 8 === 0) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len * 1.6), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = -s.angle;
        dash.position.set(s.x, 0.022, s.z);
        group.add(dash);
      }
    }

    // Curbs at alternating colors on the inside of corners.
    const curbA = new THREE.MeshBasicMaterial({ color: 0xe8405a });
    const curbB = new THREE.MeshBasicMaterial({ color: 0xf4f6fa });
    for (let i = 0; i < this.count; i += 3) {
      const s = this.sample(i);
      const rx = s.tz, rz = -s.tx;
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.07, 4.2), (i / 3) % 2 ? curbA : curbB);
        curb.position.set(s.x + rx * (half - 0.05) * side, 0.06, s.z + rz * (half - 0.05) * side);
        curb.rotation.y = s.angle;
        group.add(curb);
      }
    }

    // Safety barriers (instanced).
    const barrierGeo = new THREE.BoxGeometry(0.3, 0.75, 4.2);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b5, roughness: 0.6, metalness: 0.4 });
    const barrierCount = Math.ceil(this.count / 4) * 2;
    const barriers = new THREE.InstancedMesh(barrierGeo, barrierMat, barrierCount);
    const dummy = new THREE.Object3D();
    let bi = 0;
    for (let i = 0; i < this.count; i += 4) {
      const s = this.sample(i);
      for (const side of [-1, 1]) {
        dummy.position.set(s.x + s.tz * (half + 1.1) * side, 0.36, s.z - s.tx * (half + 1.1) * side);
        dummy.rotation.set(0, s.angle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        barriers.setMatrixAt(bi++, dummy.matrix);
      }
    }
    barriers.count = bi;
    barriers.castShadow = true;
    barriers.receiveShadow = true;
    group.add(barriers);

    // Start / finish line.
    const start = this.sample(0);
    const finish = new THREE.Mesh(new THREE.PlaneGeometry(this.width, 2.4), new THREE.MeshBasicMaterial({ map: checkerTexture(), side: THREE.DoubleSide }));
    finish.rotation.x = -Math.PI / 2;
    finish.rotation.z = -start.angle;
    finish.position.set(start.x, 0.03, start.z);
    group.add(finish);

    // Scenery: trees and cones, kept clear of the racing surface.
    const treeGeo = new THREE.ConeGeometry(2.2, 7, 7);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1e5c42, roughness: 1, flatShading: true });
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 1 });
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, 90);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 90);
    let placed = 0, attempts = 0;
    while (placed < 90 && attempts++ < 1600) {
      const x = (Math.random() - 0.5) * 620;
      const z = (Math.random() - 0.5) * 620;
      if (this.nearest(x, z).dist < half + 12) continue;
      const scale = 0.7 + Math.random() * 0.9;
      dummy.position.set(x, 4.2 * scale, z);
      dummy.rotation.set(0, Math.random() * 6.28, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trees.setMatrixAt(placed, dummy.matrix);
      dummy.position.set(x, 1 * scale, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    trees.count = trunks.count = placed;
    trees.castShadow = true;
    group.add(trees, trunks);

    // Gradient sky dome.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(750, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { top: { value: new THREE.Color(def.skyTop) }, bottom: { value: new THREE.Color(def.skyBot) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.3 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
      })
    );
    group.add(sky);

    // Lighting.
    const hemi = new THREE.HemisphereLight(def.skyBot, def.ground, 1.5);
    group.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
    sun.position.set(60, 110, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.camera.far = 300;
    sun.shadow.bias = -0.0008;
    group.add(sun, sun.target);
    this.sun = sun;

    return group;
  }

  dispose() {
    if (!this.group) return;
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
    this.group.parent?.remove(this.group);
    this.group = null;
  }
}
