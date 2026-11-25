import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;

/** A simple racing-line controller; rivals use the same physics as the player. */
export function aiInput(vehicle, track, rival, time) {
  const near = vehicle.near || track.nearest(vehicle.x, vehicle.z, vehicle.hint);
  const speed = Math.max(0, vehicle.speed);
  const look = clamp(9 + speed * 0.62, 11, 30);
  const offset = Math.sin(time * 0.28 + rival.phase) * 2.4;
  const target = track.pointAhead(near.index, look, offset);

  let diff = Math.atan2(target.x - vehicle.x, target.z - vehicle.z) - vehicle.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const steer = clamp(diff * 1.7, -1, 1);
  const curve = track.curvature(near.index, 11);
  const targetSpeed = clamp((38 - curve * 26) * rival.skill, 11, 52);
  const throttle = speed < targetSpeed ? 1 : 0;
  const brake = speed > targetSpeed * 1.06 ? clamp((speed - targetSpeed) * 0.14, 0, 1) : 0;
  const handbrake = curve > 0.95 && speed > 30 && Math.abs(diff) > 0.35;

  return { steer, throttle, brake, handbrake };
}
