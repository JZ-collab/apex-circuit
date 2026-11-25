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

  build(weather = null) {
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
    const wet = weather?.id === 'wet';
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: wet ? 0x171c25 : 0x262b36, roughness: wet ? 0.32 : 0.92,
      metalness: wet ? 0.35 : 0.05, side: THREE.DoubleSide,
    }));
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

    // Start gantry.
    const gantryMat = new THREE.MeshStandardMaterial({ color: 0x111722, metalness: 0.7, roughness: 0.35 });
    const gantryGlow = new THREE.MeshBasicMaterial({ color: def.accent });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), gantryMat);
      post.position.set(start.x + start.tz * (half + 1.4) * side, 3, start.z - start.tx * (half + 1.4) * side);
      post.castShadow = true;
      group.add(post);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.2, 0.12), gantryGlow);
      strip.position.copy(post.position); strip.position.y = 3;
      strip.position.x += start.tz * 0.28 * side;
      strip.position.z -= start.tx * 0.28 * side;
      group.add(strip);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(this.width + 3.5, 0.65, 0.55), gantryMat);
    beam.position.set(start.x, 6.1, start.z);
    beam.rotation.y = start.angle;
    group.add(beam);
    const beamGlow = new THREE.Mesh(new THREE.BoxGeometry(this.width + 2.6, 0.12, 0.62), gantryGlow);
    beamGlow.position.set(start.x, 5.72, start.z);
    beamGlow.rotation.y = start.angle;
    group.add(beamGlow);

    // Theme-specific scenery, always kept clear of the racing surface.
    const theme = def.theme || 'coast';
    const rand = (a, b) => a + Math.random() * (b - a);
    const spot = (clearance) => {
      for (let k = 0; k < 60; k++) {
        const x = rand(-330, 330), z = rand(-330, 330);
        if (this.nearest(x, z).dist > half + clearance) return { x, z };
      }
      return null;
    };

    if (theme === 'neon' || theme === 'city') {
      const count = theme === 'neon' ? 150 : 110;
      const buildings = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({
          color: theme === 'neon' ? 0x121426 : 0x2b3542,
          emissive: def.accent, emissiveIntensity: theme === 'neon' ? 0.28 : 0.04,
          roughness: 0.7, metalness: 0.25,
        }), count);
      const signs = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 0.2),
        new THREE.MeshBasicMaterial({ color: theme === 'neon' ? 0xff3e9d : 0x48e6ff }), count);
      let n = 0;
      while (n < count) {
        const p = spot(16); if (!p) break;
        const w = rand(5, 16), h = rand(8, 42), d = rand(5, 16);
        dummy.position.set(p.x, h / 2, p.z);
        dummy.rotation.set(0, rand(0, Math.PI), 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix(); buildings.setMatrixAt(n, dummy.matrix);
        dummy.position.set(p.x, rand(6, h - 2), p.z + d / 2 + 0.2);
        dummy.scale.set(w * 0.7, rand(0.4, 1.6), 1);
        dummy.updateMatrix(); signs.setMatrixAt(n, dummy.matrix);
        n++;
      }
      buildings.count = signs.count = n;
      buildings.castShadow = true;
      group.add(buildings, signs);
    } else if (theme === 'alpine') {
      const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 7, 7), new THREE.MeshStandardMaterial({ color: 0x1e5c42, roughness: 1, flatShading: true }), 110);
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 1 }), 110);
      const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 1, flatShading: true }), 60);
      let n = 0;
      while (n < 110) {
        const p = spot(12); if (!p) break;
        const sc = rand(0.7, 1.7);
        dummy.position.set(p.x, 4.2 * sc, p.z); dummy.rotation.set(0, rand(0, 6.28), 0); dummy.scale.setScalar(sc);
        dummy.updateMatrix(); trees.setMatrixAt(n, dummy.matrix);
        dummy.position.set(p.x, 1 * sc, p.z); dummy.updateMatrix(); trunks.setMatrixAt(n, dummy.matrix);
        n++;
      }
      trees.count = trunks.count = n;
      let r = 0;
      while (r < 60) {
        const p = spot(8); if (!p) break;
        const sc = rand(0.6, 2.2);
        dummy.position.set(p.x, 0.9 * sc, p.z); dummy.rotation.set(rand(0, 3), rand(0, 6.28), rand(0, 3)); dummy.scale.setScalar(sc);
        dummy.updateMatrix(); rocks.setMatrixAt(r++, dummy.matrix);
      }
      rocks.count = r;
      trees.castShadow = true;
      group.add(trees, trunks, rocks);
    } else if (theme === 'desert') {
      const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({ color: 0x8a6547, roughness: 1, flatShading: true }), 110);
      const cacti = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.55, 5, 7), new THREE.MeshStandardMaterial({ color: 0x2f6b4a, roughness: 1 }), 70);
      let n = 0;
      while (n < 110) {
        const p = spot(10); if (!p) break;
        const sc = rand(0.5, 2.4);
        dummy.position.set(p.x, 1.1 * sc, p.z); dummy.rotation.set(rand(0, 2), rand(0, 6.28), rand(0, 2)); dummy.scale.setScalar(sc);
        dummy.updateMatrix(); rocks.setMatrixAt(n++, dummy.matrix);
      }
      rocks.count = n;
      let c = 0;
      while (c < 70) {
        const p = spot(14); if (!p) break;
        const sc = rand(0.6, 1.5);
        dummy.position.set(p.x, 2.5 * sc, p.z); dummy.rotation.set(0, rand(0, 6.28), 0); dummy.scale.setScalar(sc);
        dummy.updateMatrix(); cacti.setMatrixAt(c++, dummy.matrix);
      }
      cacti.count = c;
      group.add(rocks, cacti);
    } else {
      const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 7, 7), new THREE.MeshStandardMaterial({ color: 0x1e5c42, roughness: 1, flatShading: true }), 110);
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 1 }), 110);
      let n = 0;
      while (n < 110) {
        const p = spot(12); if (!p) break;
        const sc = rand(0.7, 1.6);
        dummy.position.set(p.x, 4.2 * sc, p.z); dummy.rotation.set(0, rand(0, 6.28), 0); dummy.scale.setScalar(sc);
        dummy.updateMatrix(); trees.setMatrixAt(n, dummy.matrix);
        dummy.position.set(p.x, 1 * sc, p.z); dummy.updateMatrix(); trunks.setMatrixAt(n, dummy.matrix);
        n++;
      }
      trees.count = trunks.count = n;
      trees.castShadow = true;
      group.add(trees, trunks);
    }

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

    // Lighting — night circuits and fog/rain get a moodier setup.
    const night = !!def.night;
    const hemi = new THREE.HemisphereLight(def.skyBot, def.ground, night ? 0.95 : (weather?.id === 'fog' ? 1.9 : 1.5));
    group.add(hemi);
    const sun = new THREE.DirectionalLight(night ? 0x8fa8ff : 0xfff0dc, night ? 0.85 : (weather?.id === 'fog' ? 1.3 : 2.1));
    sun.position.set(60, 110, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.camera.far = 300;
    sun.shadow.bias = -0.0008;
    group.add(sun, sun.target);
    this.sun = sun;
    if (night) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.PointLight(def.accent, 55, 70, 2);
        lamp.position.set(start.x + start.tz * (half + 2) * side, 8, start.z - start.tx * (half + 2) * side);
        group.add(lamp);
      }
    }

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
