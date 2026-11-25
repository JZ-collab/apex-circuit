import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;

/** Racing-line controller. Rivals use exactly the same physics as the player. */
export function aiInput(vehicle, track, rival, time, others = []) {
  const near = vehicle.near || track.nearest(vehicle.x, vehicle.z, vehicle.hint);
  const speed = Math.max(0, vehicle.speed);
  const look = clamp(9 + speed * 0.62, 11, 32);
  const skill = rival.skill ?? 1;
  const rubber = rival.rubber ?? 1;
  let offset = Math.sin(time * 0.32 + (rival.phase ?? 0)) * 2.6;

  // Pick a line around slower cars directly ahead.
  for (const other of others) {
    if (other === vehicle) continue;
    const dx = other.x - vehicle.x, dz = other.z - vehicle.z;
    const ahead = dx * Math.sin(vehicle.heading) + dz * Math.cos(vehicle.heading);
    if (ahead < 1 || ahead > 16) continue;
    const lateral = dx * Math.cos(vehicle.heading) - dz * Math.sin(vehicle.heading);
    if (Math.abs(lateral) < 3.1) offset += lateral >= 0 ? -3.2 : 3.2;
  }
  offset = clamp(offset, -track.half * 0.62, track.half * 0.62);

  const target = track.pointAhead(near.index, look, offset);
  let diff = Math.atan2(target.x - vehicle.x, target.z - vehicle.z) - vehicle.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const steer = clamp(diff * 1.75, -1, 1);
  const curve = track.curvature(near.index, 11);
  const targetSpeed = clamp((40 - curve * 27) * skill * rubber, 12, 58);
  const throttle = speed < targetSpeed ? 1 : 0;
  const brake = speed > targetSpeed * 1.05 ? clamp((speed - targetSpeed) * 0.15, 0, 1) : 0;
  const handbrake = curve > 1.05 && speed > 32 && Math.abs(diff) > 0.38;
  const boost = !!rival.useBoost && speed > 26 && curve < 0.28 && vehicle.boostCharge > 0.5;

  return { steer, throttle, brake, handbrake, boost };
}
