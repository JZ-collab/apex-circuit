import * as THREE from 'three';

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function particleCloud(max, texture, additive) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { map: { value: texture } },
    vertexShader: `
      attribute float size; attribute float alpha; attribute vec3 color;
      varying float vAlpha; varying vec3 vColor;
      void main() {
        vAlpha = alpha; vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (340.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; varying float vAlpha; varying vec3 vColor;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vColor, t.a * vAlpha);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

/** Lightweight smoke, sparks and rain. All pools are fixed-size. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.texture = softDot();
    this.smoke = particleCloud(260, this.texture, false);
    this.sparks = particleCloud(140, this.texture, true);
    scene.add(this.smoke, this.sparks);
    this.smokePool = [];
    this.sparkPool = [];
    this.rain = null;
    this.rainOn = false;
    this.time = 0;
  }

  emit(pool, x, y, z, vx, vy, vz, life, size, color) {
    if (pool.length >= (pool === this.smokePool ? 260 : 140)) pool.shift();
    pool.push({ x, y, z, vx, vy, vz, life, max: life, size, color: new THREE.Color(color) });
  }

  tyreSmoke(x, y, z, strength, color = 0xcfd6e2) {
    const n = Math.min(4, 1 + Math.floor(strength * 3));
    for (let i = 0; i < n; i++) {
      this.emit(this.smokePool,
        x + (Math.random() - 0.5) * 0.5, y + 0.1, z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.4, 0.6 + Math.random() * 1.1, (Math.random() - 0.5) * 1.4,
        0.55 + Math.random() * 0.5, 0.55 + Math.random() * 0.5, color);
    }
  }

  burst(x, y, z, amount = 10) {
    for (let i = 0; i < amount; i++) {
      this.emit(this.sparkPool, x, y, z,
        (Math.random() - 0.5) * 9, Math.random() * 6 + 1, (Math.random() - 0.5) * 9,
        0.25 + Math.random() * 0.4, 0.3 + Math.random() * 0.4,
        Math.random() > 0.4 ? 0xffd36b : 0xff6a3d);
    }
  }

  setRain(on) {
    this.rainOn = on;
    if (on && !this.rain) {
      const N = 900;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 90;
        pos[i * 3 + 1] = Math.random() * 45;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x9fd8ff, size: 0.35, transparent: true, opacity: 0.5, depthWrite: false,
      }));
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
    }
    if (this.rain) this.rain.visible = on;
  }

  update(dt, camera) {
    this.time += dt;
    for (const [pool, points, drag, gravity] of [
      [this.smokePool, this.smoke, 1.4, 0.3],
      [this.sparkPool, this.sparks, 2.6, -11],
    ]) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.life -= dt;
        if (p.life <= 0) { pool.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy += gravity * dt;
        const d = Math.exp(-drag * dt);
        p.vx *= d; p.vz *= d;
      }
      const pos = points.geometry.attributes.position.array;
      const col = points.geometry.attributes.color.array;
      const size = points.geometry.attributes.size.array;
      const alpha = points.geometry.attributes.alpha.array;
      pool.forEach((p, i) => {
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.color.r; col[i * 3 + 1] = p.color.g; col[i * 3 + 2] = p.color.b;
        size[i] = p.size * (1 + (1 - p.life / p.max) * 1.4);
        alpha[i] = Math.min(1, (p.life / p.max) * 1.5) * (pool === this.smokePool ? 0.38 : 0.9);
      });
      points.geometry.setDrawRange(0, pool.length);
      points.geometry.attributes.position.needsUpdate = true;
      points.geometry.attributes.color.needsUpdate = true;
      points.geometry.attributes.size.needsUpdate = true;
      points.geometry.attributes.alpha.needsUpdate = true;
    }

    if (this.rain && this.rain.visible && camera) {
      const pos = this.rain.geometry.attributes.position.array;
      const cx = camera.position.x, cz = camera.position.z;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] -= (28 + (i % 7)) * dt;
        pos[i] += 2.5 * dt;
        if (pos[i + 1] < 0) pos[i + 1] = 42;
        if (pos[i] - cx > 45) pos[i] -= 90;
        if (pos[i] - cx < -45) pos[i] += 90;
        if (pos[i + 2] - cz > 45) pos[i + 2] -= 90;
        if (pos[i + 2] - cz < -45) pos[i + 2] += 90;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.smoke, this.sparks);
    if (this.rain) this.scene.remove(this.rain);
    this.smoke.geometry.dispose(); this.smoke.material.dispose();
    this.sparks.geometry.dispose(); this.sparks.material.dispose();
    this.rain?.geometry.dispose(); this.rain?.material.dispose();
    this.texture.dispose();
  }
}
