import * as THREE from 'three';
import { createCar } from './car.js';
import { Track } from './track.js';
import { Vehicle } from './physics.js';
import { aiInput } from './ai.js';
import { audio } from './audio.js';
import { ui } from './ui.js';
import { save } from './storage.js';
import { Effects } from './effects.js';
import { environment } from './env.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { TRACKS, RIVALS, REWARDS, WEATHER, DIFFICULTIES, findPart, computeSpecs } from './config.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
const clock = new THREE.Clock();

// ---------------------------------------------------------------- showroom
const showroom = new THREE.Scene();
showroom.background = new THREE.Color(0x070b13);
showroom.fog = new THREE.Fog(0x070b13, 16, 48);
const showRings = [];
{
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.45, 0.35, 64),
    new THREE.MeshStandardMaterial({ color: 0x111925, metalness: 0.75, roughness: 0.25 })
  );
  platform.position.y = -0.18;
  platform.receiveShadow = true;
  showroom.add(platform);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: 0x48e6ff }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.01;
  showroom.add(ring); showRings.push(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(0.72);
  ring2.material = new THREE.MeshBasicMaterial({ color: 0xff3e9d, transparent: true, opacity: 0.55 });
  showroom.add(ring2); showRings.push(ring2);
  const grid = new THREE.GridHelper(90, 45, 0x1c4c63, 0x102431);
  grid.position.y = -0.36;
  showroom.add(grid);
  showroom.add(new THREE.HemisphereLight(0x9fd8ff, 0x0a1018, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(5, 9, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
  showroom.add(key);
  const cyan = new THREE.PointLight(0x48e6ff, 65, 22, 2); cyan.position.set(-5, 2, -3);
  const pink = new THREE.PointLight(0xff3e9d, 50, 22, 2); pink.position.set(5, 2, 3);
  showroom.add(cyan, pink);
  // Studio reflections on every painted surface.
  showroom.environment = environment(renderer, {
    top: 0x1c2c47, bottom: 0x0a1018, accent: 0x48e6ff, sun: 0xffffff,
  });
  // Cinematic top light and rim strips for the showroom turntable.
  const top = new THREE.SpotLight(0xffffff, 140, 26, 0.62, 0.45, 1.6);
  top.position.set(0, 12, 1); top.target.position.set(0, 0, 0);
  showroom.add(top, top.target);
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 7),
      new THREE.MeshBasicMaterial({ color: sx < 0 ? 0x48e6ff : 0xff3e9d })
    );
    strip.position.set(sx * 5.2, 2.6, 0);
    showroom.add(strip);
  }
}

// ---------------------------------------------------------------- cinematic pipeline
// Bloom + filmic tone mapping + FXAA gives the whole game a consistent,
// high-end look: emissive lamps, boost flames and neon actually glow.
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(showroom, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.62, 0.72);
const outputPass = new OutputPass();
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(outputPass);
composer.addPass(fxaa);
function resizePipeline() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = renderer.getPixelRatio();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  fxaa.material.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr));
}
resizePipeline();

// ---------------------------------------------------------------- state
let mode = 'loading';
let previewCar = null;
let previewAngle = 0.6;
let dragging = false, dragX = 0;
let race = null;
let cameraMode = 0;
let shake = 0;
const keys = {};
let lastCountdown = null;
let previewBusy = false;

window.__apex = { get race() { return race; }, get mode() { return mode; }, save };

ui.init();
ui.onStart = startRace;
ui.onGarage = () => { if (mode !== 'menu') { clearRace(); mode = 'garage'; } };
ui.onConfigChange = () => rebuildPreview().catch(err => {
  console.error(err);
  ui.toast('MODEL FAILED TO LOAD', true);
});
ui.onResume = () => { if (mode === 'pause') { mode = 'race'; ui.show('race'); } };
ui.onRestart = () => startRace(race?.opts || {
  trackId: ui.selectedTrack, laps: ui.laps, rivals: ui.rivals,
  mode: ui.mode, weather: ui.weather, difficulty: ui.difficulty,
});
ui.onQuit = quitRace;
ui.onCamera = cycleCamera;
ui.onRespawn = () => { if (race && mode === 'race') { race.player.respawn(); ui.toast('RESPAWNED'); } };
ui.onPause = togglePause;

// ---------------------------------------------------------------- helpers
async function rebuildPreview() {
  if (previewBusy) return;
  previewBusy = true;
  try {
    if (previewCar) previewCar.dispose();
    previewCar = await createCar(save.setup, { isPlayer: true });
    showroom.add(previewCar.group);
    ui.renderMenu();
  } finally { previewBusy = false; }
}

function togglePause() {
  if (mode === 'race') { mode = 'pause'; ui.show('pause'); }
  else if (mode === 'pause') { mode = 'race'; ui.show('race'); }
}

function cycleCamera() {
  cameraMode = (cameraMode + 1) % 4;
  ui.toast(['CHASE CAM', 'CLOSE CAM', 'HOOD CAM', 'CINEMATIC CAM'][cameraMode]);
}

function clearRace() {
  if (!race) return;
  race.effects?.dispose();
  race.ghostVisual?.dispose();
  race.track.dispose();
  race.cars.forEach(c => c.visual.dispose());
  race = null;
}

function quitRace() {
  clearRace();
  mode = 'menu';
  audio.setEngine(0, 0, 0, false);
  ui.show('menu');
}

function rivalSetup(rival, index, difficulty) {
  return {
    ...save.setup,
    car: rival.car, engine: index === 0 ? 'v10' : index < 3 ? 'v8' : 'v6',
    paint: rival.paint, accent: 'a2', number: rival.number,
    spoiler: index < 2 ? 'wing' : 'none', underglow: 'off', tint: 't0',
    wheels: 'wheel-dark', bodyKit: 'stock', nitro: index < 2 ? 'n2' : 'n1',
    tires: index < 2 ? 'slick' : 'sport', suspension: 'lowered', drivetrain: 'awd',
  };
}

function ghostAt(samples, value, key) {
  if (!samples || samples.length < 2) return null;
  if (value <= samples[0][key]) return samples[0];
  const last = samples[samples.length - 1];
  if (value >= last[key]) return last;
  let lo = 0, hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][key] < value) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const t = (value - a[key]) / ((b[key] - a[key]) || 1);
  let dh = b.h - a.h;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return {
    t: a.t + (b.t - a.t) * t,
    d: a.d + (b.d - a.d) * t,
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    h: a.h + dh * t,
  };
}

async function startRace(opts) {
  audio.ensure();
  const o = typeof opts === 'string'
    ? { trackId: opts, laps: ui.laps, rivals: ui.rivals, mode: ui.mode, weather: ui.weather, difficulty: ui.difficulty }
    : { ...opts };
  clearRace();
  const def = TRACKS.find(t => t.id === o.trackId) || TRACKS[0];
  const weatherDef = WEATHER.find(w => w.id === o.weather) || WEATHER[0];
  const diff = DIFFICULTIES.find(d => d.id === o.difficulty) || DIFFICULTIES[1];
  const trial = o.mode === 'trial';
  const rivalCount = trial ? 0 : Math.max(0, Math.min(o.rivals ?? 5, RIVALS.length));
  o.laps = Math.max(1, o.laps || 2);

  const track = new Track(def);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(def.fog);
  scene.environment = environment(renderer, {
    top: def.skyTop, bottom: def.skyBot, accent: def.accent,
    sun: def.night ? 0xa9c6ff : 0xfff0dc, night: !!def.night,
  });
  const near = Math.round(140 * weatherDef.fog);
  scene.fog = new THREE.Fog(def.fog, near, Math.round(540 * weatherDef.fog));
  scene.add(track.build(weatherDef));
  const effects = new Effects(scene);
  effects.setRain(weatherDef.rain);

  const entries = [{ name: 'YOU', isPlayer: true, color: '#b8ff5c' }];
  for (let i = 0; i < rivalCount; i++) entries.push({ ...RIVALS[i], isPlayer: false, index: i });

  const built = await Promise.all(entries.map(async (entry, i) => {
    const setup = entry.isPlayer ? { ...save.setup } : rivalSetup(entry, i - 1, diff);
    const specs = computeSpecs(setup);
    const visual = await createCar(setup, { isPlayer: entry.isPlayer });
    scene.add(visual.group);
    const lateral = i === 0 ? -3.2 : (i % 2 ? 3.2 : -3.2);
    const distance = -7 - (i - 1) * 7;
    const vehicle = new Vehicle(specs, track, {
      x: 0, z: 0, heading: 0, name: entry.name, color: entry.color, grip: weatherDef.grip,
    });
    vehicle.placeAtDistance(distance, lateral);
    vehicle.boostCharge = specs.boostCap;
    return {
      ...entry, vehicle, visual, specs, grid: i,
      skill: entry.isPlayer ? 1 : (entry.skill || 1) * diff.skill,
      phase: i * 1.7, useBoost: !entry.isPlayer && specs.boost > 0 && i < 4,
      rubber: 1,
    };
  }));

  const player = built[0].vehicle;
  player.onHit = severity => {
    audio.hit(severity);
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    effects.burst(player.x - fx * 1.3, 0.8, player.z - fz * 1.3, Math.round(5 + severity * 12));
    shake = Math.max(shake, severity * 0.5);
  };
  player.onShift = () => audio.beep(320, 0.05, 0.09, 'triangle');
  player.onLap = (lap, time) => {
    if (lap <= o.laps) { ui.toast(`LAP ${lap} — ${time.toFixed(2)}s`); audio.beep(900, 0.12, 0.18); }
  };

  // Ghost replay for time trial.
  const savedGhost = trial ? save.getGhost(def.id) : null;
  let ghostVisual = null;
  if (savedGhost && savedGhost.samples?.length) {
    ghostVisual = await createCar(savedGhost.setup || save.setup, { ghost: true });
    scene.add(ghostVisual.group);
  }

  race = {
    opts: o, def, weather: weatherDef, diff, trial, track, scene, effects,
    cars: built, player, ghostVisual, ghostData: savedGhost,
    recording: [], lastRecord: -1, ghostDelta: null, ghostState: null,
    laps: o.laps, time: 0, countdown: 3.4, finished: false,
    boostWasOn: false, lastBoostBeep: -10,
  };
  mode = 'race';
  cameraMode = 0;
  shake = 0;
  lastCountdown = null;
  camera.position.set(player.x, 5, player.z - 10);
  ui.show('race');
  ui.setRaceInfo(o.mode || 'race', o.weather || 'dry', o.laps);
  ui.hud({
    mode: o.mode, lap: 1, laps: o.laps, time: 0, best: null, pos: 1, total: built.length,
    speed: 0, gear: 1, rpm: 900, redline: player.specs.redline,
    boost: player.boostCharge, boostCap: player.specs.boostCap, damage: 0, delta: null,
  });
  ui.minimap(track, built.map(c => c.vehicle), player, null);
}

// ---------------------------------------------------------------- input
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (mode === 'race' || mode === 'pause') { audio.ensure(); togglePause(); }
  } else if (e.code === 'KeyC') cycleCamera();
  else if (e.code === 'KeyR') { if (race && mode === 'race') race.player.respawn(); }
  else if (e.code === 'KeyM') ui.setMuted(audio.toggle());
  else if (e.code === 'Enter' && mode === 'menu') ui.start();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

canvas.addEventListener('pointerdown', e => {
  if (mode === 'menu' || mode === 'garage') { dragging = true; dragX = e.clientX; audio.ensure(); }
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  previewAngle -= (e.clientX - dragX) * 0.008;
  dragX = e.clientX;
});
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('resize', resizePipeline);

function playerInput() {
  const left = keys.KeyA || keys.ArrowLeft || ui.touch.left;
  const right = keys.KeyD || keys.ArrowRight || ui.touch.right;
  return {
    throttle: (keys.KeyW || keys.ArrowUp || ui.touch.throttle) ? 1 : 0,
    brake: (keys.KeyS || keys.ArrowDown || ui.touch.brake) ? 1 : 0,
    steer: (left ? 1 : 0) - (right ? 1 : 0),
    handbrake: !!keys.Space || !!ui.touch.handbrake,
    boost: !!(keys.ShiftLeft || keys.ShiftRight || keys.KeyN || ui.touch.boost),
  };
}

// ---------------------------------------------------------------- camera
const camDesired = new THREE.Vector3();
const camLook = new THREE.Vector3();
const lookCurrent = new THREE.Vector3();

function updateRaceCamera(dt, v, countdown) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  if (countdown > 0) {
    const a = (3.4 - countdown) * 0.55 + 0.6;
    camDesired.set(v.x + Math.sin(a) * 8.5, 3.1, v.z + Math.cos(a) * 8.5);
    camLook.set(v.x, 1, v.z);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 4));
    lookCurrent.lerp(camLook, 1 - Math.exp(-dt * 6));
  } else if (cameraMode === 2) {
    camDesired.set(v.x + fx * 0.15, 1.15 + v.specs.ride, v.z + fz * 0.15);
    camLook.set(v.x + fx * 18, 1.4, v.z + fz * 18);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 30));
    lookCurrent.lerp(camLook, 1 - Math.exp(-dt * 20));
  } else if (cameraMode === 3) {
    const a = performance.now() * 0.00035;
    camDesired.set(v.x + Math.sin(a) * 11, 3.8 + Math.sin(a * 1.7) * 1.2, v.z + Math.cos(a) * 11);
    camLook.set(v.x, 1.1, v.z);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 3));
    lookCurrent.lerp(camLook, 1 - Math.exp(-dt * 5));
  } else {
    const dist = cameraMode === 0 ? 8.4 + Math.abs(v.speed) * 0.045 : 5.2;
    const height = cameraMode === 0 ? 3.6 : 2.1;
    camDesired.set(v.x - fx * dist, height, v.z - fz * dist);
    camLook.set(v.x + fx * 8, 1.4, v.z + fz * 8);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 5.5));
    lookCurrent.lerp(camLook, 1 - Math.exp(-dt * 8));
  }
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    camera.position.z += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-dt * 6);
  }
  camera.lookAt(lookCurrent);
}

function updatePreviewCamera(dt) {
  const radius = mode === 'garage' ? 6.2 : 7.4;
  if (!dragging) previewAngle += dt * 0.12;
  camera.position.set(Math.sin(previewAngle) * radius, 2.6, Math.cos(previewAngle) * radius);
  camera.lookAt(0, 0.85, 0);
  for (let i = 0; i < showRings.length; i++) showRings[i].rotation.z += dt * (i ? -0.25 : 0.16);
}

// ---------------------------------------------------------------- loop
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (race && (mode === 'race' || mode === 'pause' || mode === 'results')) {
    const r = race;

    if (mode === 'race') tickRace(r, dt);
    else audio.setEngine(0, 0, 0, false);

    for (const c of r.cars) {
      const v = c.vehicle;
      c.visual.group.position.set(v.x, 0, v.z);
      c.visual.group.rotation.y = v.heading;
      c.visual.update(dt, {
        speed: v.speed, steer: v.steer, accel: v.accel, brake: v.brake || false,
        boost: v.boosting, damage: v.damage,
      });
    }
    if (r.ghostVisual && r.ghostState) {
      r.ghostVisual.group.position.set(r.ghostState.x, 0, r.ghostState.z);
      r.ghostVisual.group.rotation.y = r.ghostState.h;
      r.ghostVisual.update(dt, { speed: 18, steer: 0, accel: 0 });
    }
    if (r.track.sun) {
      const p = r.player;
      r.track.sun.position.set(p.x + 60, 110, p.z - 40);
      r.track.sun.target.position.set(p.x, 0, p.z);
      r.track.sun.target.updateMatrixWorld();
    }
    r.effects.update(dt, camera);
    if (mode === 'race' || mode === 'pause') {
      updateRaceCamera(dt, r.player, r.countdown);
      const order = [...r.cars].sort((a, b) => b.vehicle.totalDist - a.vehicle.totalDist || a.grid - b.grid);
      ui.hud({
        mode: r.trial ? 'trial' : 'race', lap: r.player.lap, laps: r.laps, time: r.time,
        best: r.player.bestLap, pos: order.findIndex(c => c.isPlayer) + 1, total: r.cars.length,
        speed: r.player.speed, gear: r.player.gear, rpm: r.player.rpm, redline: r.player.specs.redline,
        boost: r.player.boostCharge, boostCap: r.player.specs.boostCap,
        damage: r.player.damage, delta: r.ghostDelta,
      });
      ui.minimap(r.track, r.cars.map(c => c.vehicle), r.player, r.ghostState);
    }
    renderPass.scene = r.scene;
    composer.render(dt);
  } else {
    if (previewCar) previewCar.update(dt, { speed: 0, steer: 0, accel: 0 });
    updatePreviewCamera(dt);
    renderPass.scene = showroom;
    composer.render(dt);
  }
}

function tickRace(r, dt) {
  if (r.countdown > 0) {
    r.countdown -= dt;
    const n = Math.ceil(r.countdown - 0.4);
    const label = r.countdown > 0.4 ? String(Math.max(1, n)) : 'GO!';
    if (label !== lastCountdown) {
      lastCountdown = label;
      ui.countdown(label, label === 'GO!' ? 'go' : '');
      audio.beep(label === 'GO!' ? 1040 : 620, label === 'GO!' ? 0.4 : 0.14, 0.24);
    }
    if (r.countdown <= 0) { ui.countdown(''); r.time = 0; }
  } else {
    r.time += dt;
  }

  const racing = r.countdown <= 0 && !r.finished;
  const input = racing ? playerInput() : { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
  const p = r.player;
  const wasBoosting = p.boosting;
  p.step(dt, input, r.time);
  if (!wasBoosting && p.boosting && r.time - r.lastBoostBeep > 0.4) {
    audio.boostStart(); r.lastBoostBeep = r.time; shake = Math.max(shake, 0.12);
  }

  const others = r.cars.map(c => c.vehicle);
  for (const c of r.cars) {
    if (c.isPlayer) continue;
    c.rubber = THREE.MathUtils.clamp(1 + (p.totalDist - c.vehicle.totalDist) * 0.0011, 0.9, 1.13);
    const ai = racing ? aiInput(c.vehicle, r.track, c, r.time, others) : { throttle: 0, brake: 0, steer: 0 };
    c.vehicle.step(dt, ai, r.time);
  }

  audio.setEngine(p.rpm, input.throttle, p.slip, racing, p.boosting);

  // Tire smoke and boost sparks.
  if (racing && (p.slip > 2.8 || input.handbrake) && Math.abs(p.speed) > 6) {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    for (const side of [-1, 1]) {
      r.effects.tyreSmoke(p.x - fx * 1.15 + fz * side * 0.7, 0.1, p.z - fz * 1.15 - fx * side * 0.7,
        Math.min(p.slip / 8, 1));
    }
  }
  if (racing && p.boosting && Math.random() < 0.5) {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    r.effects.burst(p.x - fx * 1.6, 0.4, p.z - fz * 1.6, 2);
  }

  // Ghost recording / playback and delta.
  if (racing) {
    if (r.time - r.lastRecord >= 0.1) {
      r.lastRecord = r.time;
      r.recording.push({ t: r.time, d: p.totalDist, x: p.x, z: p.z, h: p.heading });
    }
    if (r.ghostData?.samples?.length) {
      const byTime = ghostAt(r.ghostData.samples, r.time, 't');
      const byDist = ghostAt(r.ghostData.samples, p.totalDist, 'd');
      r.ghostState = byTime;
      if (byDist) r.ghostDelta = r.time - byDist.t;
    }
  }

  if (racing && p.totalDist >= r.laps * r.track.length) finishRace();
}

function finishRace() {
  const r = race;
  if (r.finished) return;
  r.finished = true;
  mode = 'results';
  audio.setEngine(0, 0, 0, false);

  const order = [...r.cars].sort((a, b) => b.vehicle.totalDist - a.vehicle.totalDist || a.grid - b.grid);
  const position = order.findIndex(c => c.isPlayer) + 1;
  const base = r.trial ? 900 : (REWARDS[position - 1] || 600);
  const ghostBeaten = r.trial && !!r.ghostData && r.player.bestLap && (r.player.bestLap < (r.ghostData.bestLap || Infinity));
  const reward = Math.round((base + Math.max(0, Math.floor((r.laps * 120) / Math.max(r.time, 1))) + (ghostBeaten ? 1800 : 0)) * r.diff.reward);

  save.addCredits(reward);
  save.recordRace(r.def.id, r.player.bestLap, r.trial ? 1 : position, r.player.totalDist);

  let savedGhost = false;
  if (r.trial) {
    r.recording.push({ t: r.time, d: r.player.totalDist, x: r.player.x, z: r.player.z, h: r.player.heading });
    savedGhost = save.saveGhost(r.def.id, {
      time: r.time, bestLap: r.player.bestLap, setup: { ...save.setup }, samples: r.recording,
    });
    if (savedGhost) ui.toast('NEW GHOST SAVED');
  }

  ui.results(order.map(c => ({
    name: c.name, car: findPart('car', c.isPlayer ? save.setup.car : c.car).name,
    best: c.vehicle.bestLap, player: !!c.isPlayer,
  })), reward, {
    finished: true, mode: r.trial ? 'trial' : 'race',
    best: r.player.bestLap, delta: r.ghostDelta, ghostBeaten: ghostBeaten || savedGhost,
  });
  audio.beep(880, 0.5, 0.25, 'sawtooth');
}

// ---------------------------------------------------------------- boot
(async () => {
  try {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    document.getElementById('loading-text').textContent = 'BUILDING YOUR CAR…';
    await rebuildPreview();
    ui.show('menu');
    if (save.settings.mode === 'trial') {
      document.querySelectorAll('#mode-select button').forEach(b => b.classList.toggle('on', b.dataset.mode === 'trial'));
    }
  } catch (err) {
    console.error(err);
    document.getElementById('loading-text').textContent = 'FAILED TO LOAD: ' + err.message;
  }
  frame();
})();
