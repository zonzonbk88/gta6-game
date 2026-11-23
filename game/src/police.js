// The Tidewater PD: interceptors that spawn off-screen on real streets,
// hunt the player's predicted position, ram, box in, and fill the bust
// meter when they are close and the player is slow.

import { COP_SPEED, BUST_RANGE } from './config.js';
import { Car, stepCarPhysics, angleDiff, clamp } from './vehicles.js';

export class Police {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.spawnTimer = 0;
  }

  wantedCount(stars) {
    return [0, 1, 2, 3, 4, 6][stars] || 0;
  }

  spawnPoint(px, py) {
    const world = this.world;
    const streets = world.streetCentersX();
    const avenues = world.avenueCentersY();
    for (let tries = 0; tries < 24; tries++) {
      const vertical = this.rng.chance(0.5);
      let x;
      let y;
      if (vertical) {
        x = this.rng.pick(streets);
        y = py + this.rng.pick([-1, 1]) * this.rng.range(620, 820);
      } else {
        y = this.rng.pick(avenues);
        x = px + this.rng.pick([-1, 1]) * this.rng.range(620, 820);
      }
      x = clamp(x, 70, 2690);
      y = clamp(y, 70, 2490);
      if (Math.hypot(x - px, y - py) < 540) continue;
      if (!world.isRoadPx(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  /**
   * Advance the pursuit. `target` is {x, y, speed, angle} of the player
   * (or their car). Returns { seen, nearCount } for the heat/bust rules.
   */
  update(dt, stars, target, events) {
    const want = this.wantedCount(stars);
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      const at = this.spawnPoint(target.x, target.y);
      if (at) {
        const cop = new Car(at.x, at.y, Math.atan2(target.y - at.y, target.x - at.x), '#f5f6fa', 'cop');
        cop.driver = 'police';
        this.cars.push(cop);
        this.spawnTimer = 1.1;
      } else {
        this.spawnTimer = 0.4;
      }
    }
    if (this.cars.length > want) {
      // Extras peel off and despawn once they are far away.
      for (let i = this.cars.length - 1; i >= 0 && this.cars.length > want; i--) {
        if (Math.hypot(this.cars[i].x - target.x, this.cars[i].y - target.y) > 700) this.cars.splice(i, 1);
      }
      if (this.cars.length > want && stars === 0) this.cars.length = want;
    }

    let seen = false;
    let nearCount = 0;
    const topSpeed = COP_SPEED * (0.82 + stars * 0.055);
    for (const cop of this.cars) {
      const dx = target.x - cop.x;
      const dy = target.y - cop.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 560) seen = true;
      if (dist < BUST_RANGE) nearCount++;

      // Recycle a cop who has fallen hopelessly behind.
      if (dist > 1500 && want > 0) {
        const at = this.spawnPoint(target.x, target.y);
        if (at) {
          cop.x = at.x;
          cop.y = at.y;
          cop.speed = 0;
        }
      }

      // Aim at where the player will be, not where they are.
      const lead = Math.min(0.85, dist / 700);
      const aimX = target.x + Math.cos(target.angle || 0) * (target.speed || 0) * lead;
      const aimY = target.y + Math.sin(target.angle || 0) * (target.speed || 0) * lead;
      const desired = Math.atan2(aimY - cop.y, aimX - cop.x);
      const diff = angleDiff(desired, cop.angle);
      let steer = clamp(diff * 1.7, -1, 1);
      let throttle = 1;
      if (Math.abs(diff) > 2.5 && dist < 130) {
        throttle = -1; // overshot: back up and swing round
        steer = clamp(-diff, -1, 1);
      }
      if (dist < 52 && target.speed < 30) throttle = 0.25; // pinning the player
      const impact = stepCarPhysics(cop, dt, steer, throttle, topSpeed, this.world);
      if (impact > 110) events.push({ type: 'crash', x: cop.x, y: cop.y, impact, car: cop });
    }
    return { seen, nearCount };
  }
}
