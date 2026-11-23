// Sol Vega on foot: eight-way movement with a sprint, stepping into any
// car whose door she can reach, and a pistol that fires hitscan rounds
// toward the mouse with real consequences.

import { PLAYER_RADIUS, PLAYER_WALK, PLAYER_SPRINT } from './config.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.health = 100;
    this.car = null;
    this.speed = 0;
    this.legPhase = 0;
    this.fireCooldown = 0;
    this.muzzle = 0;
    this.stepTimer = 0;
  }

  get driving() {
    return this.car !== null;
  }
  /** The position other systems should aim at: the car, when driving. */
  pos() {
    return this.car ? { x: this.car.x, y: this.car.y } : { x: this.x, y: this.y };
  }

  updateOnFoot(dt, input, world) {
    let mx = 0;
    let my = 0;
    if (input.down('KeyW', 'ArrowUp')) my -= 1;
    if (input.down('KeyS', 'ArrowDown')) my += 1;
    if (input.down('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.down('KeyD', 'ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const top = sprint ? PLAYER_SPRINT : PLAYER_WALK;
    if (len > 0) {
      mx /= len;
      my /= len;
      this.speed = top;
      this.angle = Math.atan2(my, mx);
      this.x += mx * top * dt;
      this.y += my * top * dt;
      this.legPhase += dt * (sprint ? 11 : 8);
    } else {
      this.speed = 0;
    }
    const fixed = world.collideCircle(this.x, this.y, PLAYER_RADIUS);
    this.x = fixed.x;
    this.y = fixed.y;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
  }

  /** The car whose door is in reach, or null. */
  carInReach(cars) {
    let best = null;
    let bd = 52;
    for (const car of cars) {
      if (car.health <= 0) continue;
      const d = Math.hypot(car.x - this.x, car.y - this.y);
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    this.car = car;
    car.driver = 'player';
    if (car.kind === 'parked') car.kind = 'traffic';
  }
  exitCar() {
    const car = this.car;
    if (!car) return null;
    car.driver = car.kind === 'cop' ? 'police' : null;
    if (car.kind !== 'cop') car.kind = 'parked';
    this.car = null;
    // Step out on the left side of the car.
    const px = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
    const py = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
    this.x = px;
    this.y = py;
    return car;
  }

  /**
   * Fire one round toward (tx, ty). Returns a hit report:
   * { kind: 'ped'|'car'|'building'|'none', x, y, target }.
   */
  shoot(tx, ty, world, cars, peds) {
    if (this.fireCooldown > 0) return null;
    this.fireCooldown = 0.24;
    this.muzzle = 0.06;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);
    const ux = dx / dist;
    const uy = dy / dist;
    const maxRange = 430;
    let hit = { kind: 'none', x: this.x + ux * maxRange, y: this.y + uy * maxRange, target: null };
    for (let s = 14; s < maxRange; s += 7) {
      const x = this.x + ux * s;
      const y = this.y + uy * s;
      let struck = false;
      for (const b of world.buildingNear(x, y, 4)) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          hit = { kind: 'building', x, y, target: b };
          struck = true;
          break;
        }
      }
      if (struck) break;
      for (const ped of peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 14) {
          hit = { kind: 'ped', x, y, target: ped };
          struck = true;
          break;
        }
      }
      if (struck) break;
      for (const car of cars) {
        if (Math.hypot(car.x - x, car.y - y) < 23) {
          hit = { kind: 'car', x, y, target: car };
          struck = true;
          break;
        }
      }
      if (struck) break;
    }
    return hit;
  }
}
