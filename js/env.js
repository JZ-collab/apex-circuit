import * as THREE from 'three';

/**
 * Procedural studio/track environment maps. No HDR downloads are needed:
 * a high-dynamic-range-ish equirectangular canvas is generated in code,
 * then prefiltered by Three.js PMREM for physically correct reflections.
 */
const cache = new Map();

function canvasEnv({ top = 0x101a2c, bottom = 0x1a2230, accent = 0x48e6ff, sun = 0xfff0dc, night = false } = {}) {
  const w = 1024, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const topC = new THREE.Color(top), botC = new THREE.Color(bottom);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `#${topC.getHexString()}`);
  grad.addColorStop(0.46, `#${botC.clone().lerp(new THREE.Color(accent), 0.22).getHexString()}`);
  grad.addColorStop(0.52, `#${botC.getHexString()}`);
  grad.addColorStop(1, '#05070c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Soft horizon light bands give metal a readable highlight sweep.
  for (const [x, color, width] of [[w * 0.18, accent, 220], [w * 0.68, sun, 160]]) {
    const g = ctx.createRadialGradient(x, h * 0.47, 4, x, h * 0.47, width);
    g.addColorStop(0, `#${new THREE.Color(color).getHexString()}`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = night ? 0.35 : 0.62;
    ctx.fillStyle = g;
    ctx.fillRect(x - width, 0, width * 2, h);
  }
  ctx.globalAlpha = 1;

  // Sun / moon disc (bloom picks this up when visible in the sky).
  ctx.fillStyle = `#${new THREE.Color(sun).getHexString()}`;
  ctx.beginPath(); ctx.arc(w * 0.68, h * 0.35, night ? 12 : 20, 0, Math.PI * 2); ctx.fill();

  // Overhead softbox strips — the classic studio reflection lines on paint.
  ctx.globalAlpha = night ? 0.28 : 0.55;
  for (let i = 0; i < 5; i++) {
    const x = 90 + i * 205;
    const g = ctx.createLinearGradient(x - 55, 0, x + 55, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 55, 22, 110, 92);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function environment(renderer, opts = {}) {
  const key = JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const source = canvasEnv(opts);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(source);
  source.dispose();
  pmrem.dispose();
  cache.set(key, target.texture);
  return target.texture;
}
