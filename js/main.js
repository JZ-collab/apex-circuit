import * as THREE from 'three';
import { createCar } from './car.js';
import { Track } from './track.js';
import { Vehicle } from './physics.js';
import { aiInput } from './ai.js';
import { audio } from './audio.js';
import { ui } from './ui.js';
import { save } from './storage.js';
import { TRACKS, RIVALS, REWARDS, findPart, computeSpecs } from './config.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
const clock = new THREE.Clock();

// ---------------------------------------------------------------- showroom
const showroom = new THREE.Scene();
showroom.background = new THREE.Color(0x070b13);
showroom.fog = new THREE.Fog(0x070b13, 16, 46);
{
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.4, 0.35, 64),
    new THREE.MeshStandardMaterial({ color: 0x111925, metalness: 0.7, roughness: 0.28 })
  );
  platform.position.y = -0.18;
  platform.receiveShadow = true;
  showroom.add(platform);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.25, 0.035, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x48e6ff })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  showroom.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(0.72);
  ring2.material = new THREE.MeshBasicMaterial({ color: 0xff3e9d, transparent: true, opacity: 0.5 });
  showroom.add(ring2);
  const grid = new THREE.GridHelper(80, 40, 0x1c4c63, 0x102431);
  grid.position.y = -0.36;
  showroom.add(grid);
  showroom.add(new THREE.HemisphereLight(0x9fd8ff, 0x0a1018, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 9, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
  showroom.add(key);
  const cyan = new THREE.PointLight(0x48e6ff, 60, 22, 2); cyan.position.set(-5, 2, -3);
  const pink = new THREE.PointLight(0xff3e9d, 45, 22, 2); pink.position.set(5, 2, 3);
  showroom.add(cyan, pink);
}

// ---------------------------------------------------------------- state
let mode = 'loading';
let previewCar = null;
let previewAngle = 0.6;
let dragging = false, dragX = 0;
let race = null;
let cameraMode = 0;
const keys = {};
let lastCountdown = null;

window.__apex = { get race() { return race; }, get mode() { return mode; } };

ui.init();
ui.onStart = startRace;
ui.onConfigChange = rebuildPreview;
ui.onResume = () => { if (mode === 'pause') { mode = 'race'; ui.show('race'); } };
ui.onRestart = () => startRace(race?.trackDef.id || ui.selectedTrack, ui.laps, ui.rivals);
ui.onQuit = quitRace;
ui.onCamera = cycleCamera;
ui.onRespawn = () => { if (race && mode === 'race') { race.player.respawn(); ui.toast('RESPAWNED'); } };
ui.onPause = togglePause;

// ---------------------------------------------------------------- helpers
async function rebuildPreview() {
  if (previewCar) previewCar.dispose();
  previewCar = await createCar(save.setup, { isPlayer: true });
  showroom.add(previewCar.group);
  ui.renderMenu();
}

function togglePause() {
  if (mode === 'race') { mode = 'pause'; ui.show('pause'); }
  else if (mode === 'pause') { mode = 'race'; ui.show('race'); }
}

function cycleCamera() {
  cameraMode = (cameraMode + 1) % 3;
  ui.toast(['CHASE CAM', 'CLOSE CAM', 'HOOD CAM'][cameraMode]);
}

function quitRace() {
  if (race) { race.track.dispose(); race.cars.forEach(c => c.visual.dispose()); race = null; }
  mode = 'menu';
  ui.show('menu');
}

function rivalSetup(rival, index) {
  return {
    ...save.setup,
    car: rival.car, engine: index === 0 ? 'v10' : index < 3 ? 'v8' : 'v6',
    paint: rival.paint, accent: 'a2', number: rival.number,
    spoiler: index < 2 ? 'wing' : 'none', underglow: 'off', tint: 't0',
    wheels: 'wheel-dark', bodyKit: 'stock',
  };
}

async function startRace(trackId, laps, rivalCount) {
  audio.ensure();
  if (race) { race.track.dispose(); race.cars.forEach(c => c.visual.dispose()); race = null; }
  const def = TRACKS.find(t => t.id === trackId) || TRACKS[0];
  const track = new Track(def);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(def.fog);
  scene.fog = new THREE.Fog(def.fog, 140, 520);
  scene.add(track.build());

  const entries = [{ name: 'YOU', isPlayer: true, color: '#b8ff5c' }];
  for (let i = 0; i < RIVALS.length && i < rivalCount; i++) entries.push({ ...RIVALS[i], isPlayer: false, index: i });

  const built = await Promise.all(entries.map(async (entry, i) => {
    const setup = entry.isPlayer ? { ...save.setup } : rivalSetup(entry, i - 1);
    const specs = computeSpecs(setup);
    const visual = await createCar(setup, { isPlayer: entry.isPlayer });
    scene.add(visual.group);
    const lateral = i === 0 ? -3.2 : (i % 2 ? 3.2 : -3.2);
    const distance = -7 - (i - 1) * 7;
    const vehicle = new Vehicle(specs, track, {
      x: 0, z: 0, heading: 0, name: entry.name, color: entry.color,
    });
    if (entry.isPlayer) vehicle.placeAtDistance(distance, lateral);
    else vehicle.placeAtDistance(distance, lateral);
    return { ...entry, vehicle, visual, specs, grid: i };
  }));

  const player = built[0].vehicle;
  player.onHit = () => audio.hit();
  player.onShift = () => audio.beep(320, 0.05, 0.09, 'triangle');
  player.onLap = (lap, time) => { if (lap <= laps) { ui.toast(`LAP ${lap} — ${time.toFixed(2)}s`); audio.beep(900, 0.12, 0.18); } };

  race = { def, track, scene, cars: built, player, laps, time: 0, countdown: 3.4, finished: false, cameraTarget: new THREE.Vector3() };
  mode = 'race';
  camera.position.set(player.x, 5, player.z - 10);
  ui.show('race');
  ui.hud({ lap: 1, laps, time: 0, best: null, pos: 1, total: built.length, speed: 0, gear: 1, rpm: 900, redline: player.specs.redline });
  ui.minimap(track, built.map(c => c.vehicle), player);
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
  else if (e.code === 'Enter' && mode === 'menu') startRace(ui.selectedTrack, ui.laps, ui.rivals);
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function playerInput() {
  const left = keys.KeyA || keys.ArrowLeft || ui.touch.left;
  const right = keys.KeyD || keys.ArrowRight || ui.touch.right;
  return {
    throttle: (keys.KeyW || keys.ArrowUp || ui.touch.throttle) ? 1 : 0,
    brake: (keys.KeyS || keys.ArrowDown || ui.touch.brake) ? 1 : 0,
    steer: (left ? 1 : 0) - (right ? 1 : 0),
    handbrake: !!keys.Space || !!ui.touch.handbrake,
  };
}

// ---------------------------------------------------------------- camera
const camDesired = new THREE.Vector3();
const camLook = new THREE.Vector3();
const lookCurrent = new THREE.Vector3();

function updateRaceCamera(dt, v) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  if (cameraMode === 2) {
    camDesired.set(v.x + fx * 0.15, 1.15 + v.specs.ride, v.z + fz * 0.15);
    camLook.set(v.x + fx * 18, 1.4, v.z + fz * 18);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 30));
    lookCurrent.lerp(camLook, 1 - Math.exp(-dt * 20));
  } else {
    const dist = cameraMode === 0 ? 8.4 + Math.abs(v.speed) * 0.045 : 5.2;
    const height = cameraMode === 0 ? 3.6 : 2.1;
    camDesired.set(v.x - fx * dist, height, v.z - fz * dist);
    camLook.set(v.x + fx * 8, 1.4, v.z + fz * 8);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 5.5));
    lookCurrent.lerp(camLook, 1 - Math.exp(-dt * 8));
  }
  camera.lookAt(lookCurrent);
}

function updatePreviewCamera(dt) {
  const radius = mode === 'garage' ? 6.1 : 7.4;
  if (!dragging) previewAngle += dt * 0.12;
  camera.position.set(Math.sin(previewAngle) * radius, 2.6, Math.cos(previewAngle) * radius);
  camera.lookAt(0, 0.85, 0);
}

// ---------------------------------------------------------------- loop
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (race && (mode === 'race' || mode === 'pause' || mode === 'results')) {
    const r = race;

    if (mode === 'race') {
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
      const input = racing ? playerInput() : { throttle: 0, brake: 0, steer: 0, handbrake: false };
      const p = r.player;
      p.step(dt, input, r.time);
      for (const c of r.cars) {
        if (c.isPlayer) continue;
        const ai = racing ? aiInput(c.vehicle, r.track, c, r.time) : { throttle: 0, brake: 0, steer: 0 };
        c.vehicle.step(dt, ai, r.time);
      }

      audio.setEngine(p.rpm, input.throttle, p.slip, racing);

      if (racing && p.totalDist >= r.laps * r.track.length) finishRace();
    } else {
      audio.setEngine(0, 0, 0, false);
    }

    for (const c of r.cars) {
      const v = c.vehicle;
      c.visual.group.position.set(v.x, 0, v.z);
      c.visual.group.rotation.y = v.heading;
      c.visual.update(dt, { speed: v.speed, steer: v.steer, accel: v.accel });
    }
    if (r.track.sun) {
      const p = r.player;
      r.track.sun.position.set(p.x + 60, 110, p.z - 40);
      r.track.sun.target.position.set(p.x, 0, p.z);
      r.track.sun.target.updateMatrixWorld();
    }
    if (mode === 'race' || mode === 'pause') {
      updateRaceCamera(dt, r.player);
      const order = [...r.cars].sort((a, b) => b.vehicle.totalDist - a.vehicle.totalDist || a.grid - b.grid);
      ui.hud({
        lap: r.player.lap, laps: r.laps, time: r.time, best: r.player.bestLap,
        pos: order.findIndex(c => c.isPlayer) + 1, total: r.cars.length,
        speed: r.player.speed, gear: r.player.gear, rpm: r.player.rpm, redline: r.player.specs.redline,
      });
      ui.minimap(r.track, r.cars.map(c => c.vehicle), r.player);
    }
    renderer.render(r.scene, camera);
  } else {
    if (previewCar) previewCar.update(dt, { speed: 0, steer: 0, accel: 0 });
    updatePreviewCamera(dt);
    renderer.render(showroom, camera);
  }
}

function finishRace() {
  const r = race;
  r.finished = true;
  mode = 'results';
  const order = [...r.cars].sort((a, b) => b.vehicle.totalDist - a.vehicle.totalDist || a.grid - b.grid);
  const position = order.findIndex(c => c.isPlayer) + 1;
  const reward = (REWARDS[position - 1] || 600) + Math.max(0, Math.floor((r.laps * 100) / Math.max(r.time, 1)));
  save.addCredits(reward);
  save.recordRace(r.def.id, r.player.bestLap, position);
  ui.results(order.map(c => ({
    name: c.name, car: findPart('car', c.isPlayer ? save.setup.car : c.car).name,
    best: c.vehicle.bestLap, player: !!c.isPlayer,
  })), reward, true);
  audio.beep(880, 0.5, 0.25, 'sawtooth');
}

// ---------------------------------------------------------------- boot
(async () => {
  try {
    document.getElementById('loading-text').textContent = 'BUILDING YOUR CAR…';
    await rebuildPreview();
    ui.show('menu');
  } catch (err) {
    console.error(err);
    document.getElementById('loading-text').textContent = 'FAILED TO LOAD: ' + err.message;
  }
  frame();
})();
