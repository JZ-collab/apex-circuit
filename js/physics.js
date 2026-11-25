import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const WHEEL_RADIUS = 0.32;

/** Arcade vehicle dynamics shared by the player and every rival. */
export class Vehicle {
  constructor(specs, track, { x, z, heading, name = 'YOU', color = '#48e6ff' } = {}) {
    this.specs = specs;
    this.track = track;
    this.name = name;
    this.color = color;
    this.x = x; this.z = z;
    this.heading = heading;
    this.vx = 0; this.vz = 0;
    this.speed = 0;
    this.steer = 0;
    this.accel = 0;
    this.slip = 0;
    this.gear = 1;
    this.rpm = 900;
    this.shiftTimer = 0;
    this.hint = 0;
    this.prevDist = track.nearest(x, z).sample.dist;
    this.totalDist = 0;
    this.lap = 1;
    this.finished = false;
    this.finishTime = null;
    this.bestLap = null;
    this.lapStart = 0;
    this.offTrack = false;
    this.hit = 0;
    this.reverse = false;
  }

  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  step(dt, input, raceTime) {
    const s = this.specs;
    const throttle = clamp(input.throttle || 0, 0, 1);
    const brake = clamp(input.brake || 0, 0, 1);
    const steerInput = clamp(input.steer || 0, -1, 1);
    const handbrake = !!input.handbrake;

    // --- gearbox -----------------------------------------------------------
    this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    const absSpeed = Math.hypot(this.vx, this.vz);
    if (this.reverse) {
      this.gear = -1;
      this.rpm = 900 + Math.min(absSpeed * 130, 3200) + throttle * 900;
    } else {
      const ratio = s.ratios[Math.min(this.gear - 1, s.ratios.length - 1)] * s.final;
      const wheelRpm = absSpeed / (2 * Math.PI * WHEEL_RADIUS) * 60;
      this.rpm = clamp(Math.max(850 + throttle * 1200, wheelRpm * ratio), 850, s.redline);
      if (this.shiftTimer <= 0) {
        if (this.rpm > s.redline * 0.94 && this.gear < s.ratios.length) {
          this.gear++; this.shiftTimer = s.shift; this.rpm *= 0.72;
          this.onShift?.();
        } else if (this.rpm < s.redline * 0.34 && this.gear > 1) {
          this.gear--; this.shiftTimer = s.shift * 0.7;
          this.onShift?.();
        }
      }
    }
    if (absSpeed < 1.2 && brake > 0.5 && throttle < 0.1 && !this.reverse) this.reverse = true;
    if (this.reverse && throttle > 0.5 && absSpeed < 1.5) this.reverse = false;

    // --- longitudinal force ------------------------------------------------
    let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let vLong = this.vx * fx + this.vz * fz;
    const grip = s.grip * (this.offTrack ? 0.72 : 1);
    let engineForce = 0;
    if (this.shiftTimer <= 0 && throttle > 0) {
      const ratio = this.reverse ? 3.4 : s.ratios[Math.min(this.gear - 1, s.ratios.length - 1)] * s.final;
      const gearFactor = ratio / 3.4;
      engineForce = s.hp * 42 * throttle * gearFactor * s.resp * s.accel;
      const tractionCap = 9.81 * grip * (s.drive === 'awd' ? 1.65 : 1.35) * (s.mass + 200);
      engineForce = Math.min(engineForce, tractionCap);
      const top = this.reverse ? 9 : s.topSpeed;
      engineForce *= Math.max(0, 1 - Math.max(0, vLong) / top);
    }
    const dragForce = s.drag * 1.4 * vLong * Math.abs(vLong) + 45 * vLong;
    const brakeForce = brake * 17 * grip * (s.mass + 200);
    let acc = (engineForce - dragForce - brakeForce) / (s.mass + 200);
    acc = clamp(acc, -24, 20);
    this.accel = acc;
    vLong += acc * dt;

    if (this.reverse) vLong = clamp(vLong, -9, 0.5);

    // Rebuild world velocity from the old frame.
    let rx = fz, rz = -fx;
    const vLatOld = this.vx * rx + this.vz * rz;
    let vx = fx * vLong + rx * vLatOld;
    let vz = fz * vLong + rz * vLatOld;

    // --- steering ----------------------------------------------------------
    const speedFactor = Math.min(Math.abs(vLong) / 7, 1);
    const highSpeed = 1 - Math.min(Math.abs(vLong) / 95, 0.5);
    const steerRate = steerInput * 2.15 * s.handling * speedFactor * highSpeed * (handbrake ? 1.45 : 1) * s.oversteer;
    this.steer = THREE.MathUtils.lerp(this.steer, steerInput, Math.min(1, dt * 9));
    this.heading += steerRate * dt * (vLong < -0.5 ? -1 : 1);

    // Re-project velocity into the new frame and let tires kill lateral slip.
    fx = Math.sin(this.heading); fz = Math.cos(this.heading);
    rx = fz; rz = -fx;
    let lat = vx * rx + vz * rz;
    let lon = vx * fx + vz * fz;
    const gripLat = 7.6 * s.grip * s.slip * (handbrake ? 0.2 : 1) * (this.offTrack ? 0.65 : 1);
    lat *= Math.exp(-gripLat * dt);
    this.slip = Math.abs(lat);
    vx = fx * lon + rx * lat;
    vz = fz * lon + rz * lat;

    // --- integrate ---------------------------------------------------------
    this.vx = vx; this.vz = vz;
    this.x += vx * dt;
    this.z += vz * dt;
    this.speed = lon;

    // --- track limits ------------------------------------------------------
    const near = this.track.nearest(this.x, this.z, this.hint);
    this.hint = near.index;
    this.near = near;
    this.offTrack = near.dist > this.track.half - 0.4;
    const limit = this.track.half + 0.6;
    if (near.dist > limit) {
      const s2 = near.sample;
      const rightX = s2.tz, rightZ = -s2.tx;
      const over = near.dist - limit;
      const sign = near.lateral >= 0 ? 1 : -1;
      this.x -= rightX * over * sign;
      this.z -= rightZ * over * sign;
      this.vx *= 0.55; this.vz *= 0.55;
      this.speed *= 0.55;
      this.hit = Math.min(1, this.hit + 0.35);
      this.onHit?.();
    }
    this.hit = Math.max(0, this.hit - dt * 1.4);

    // --- lap progress ------------------------------------------------------
    const d = near.sample.dist;
    let delta = d - this.prevDist;
    if (delta > this.track.length / 2) delta -= this.track.length;
    if (delta < -this.track.length / 2) delta += this.track.length;
    if (Math.abs(delta) < this.track.length / 3) this.totalDist += delta;
    this.prevDist = d;
    const newLap = clamp(Math.floor(Math.max(0, this.totalDist) / this.track.length) + 1, 1, 99);
    if (newLap > this.lap) {
      const lapTime = raceTime - this.lapStart;
      if (lapTime > 3 && (!this.bestLap || lapTime < this.bestLap)) this.bestLap = lapTime;
      this.lapStart = raceTime;
      this.onLap?.(this.lap, lapTime);
    }
    this.lap = newLap;
  }

  respawn() {
    const s = this.track.sample(this.hint);
    const lateral = clamp(this.near?.lateral || 0, -this.track.half * 0.5, this.track.half * 0.5);
    this.x = s.x + s.tz * lateral;
    this.z = s.z - s.tx * lateral;
    this.heading = s.angle;
    this.vx = this.vz = this.speed = 0;
    this.reverse = false;
    this.gear = 1;
  }

  placeAtDistance(distance, lateral = 0) {
    const d = ((distance % this.track.length) + this.track.length) % this.track.length;
    const idx = Math.floor(d / this.track.length * this.track.count);
    const s = this.track.sample(idx);
    this.x = s.x + s.tz * lateral;
    this.z = s.z - s.tx * lateral;
    this.heading = s.angle;
    this.hint = idx;
    this.prevDist = s.dist;
    this.totalDist = 0;
    this.lap = 1;
  }
}
