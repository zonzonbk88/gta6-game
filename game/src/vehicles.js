// Cars: one arcade physics step shared by traffic, police and the player,
// plus the traffic brain — lane discipline on the street grid, turns at
// intersections, and queueing behind whatever is in the way.

import { TILE, PITCH, CAR_RADIUS, TRAFFIC_SPEED } from './config.js';
import { Rng } from './random.js';

export const DIRS = [
  { x: 1, y: 0 },   // east
  { x: 0, y: 1 },   // south
  { x: -1, y: 0 },  // west
  { x: 0, y: -1 },  // north
];

export const CAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d',
  '#8338ec', '#ff70a6', '#70d6ff', '#ffd670', '#e0fbfc',
  '#98c1d9', '#ee6c4d', '#93e1d8', '#ffa69e', '#5e60ce',
];

let nextCarId = 1;

export class Car {
  constructor(x, y, angle, color, kind = 'traffic') {
    this.id = nextCarId++;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.color = color;
    this.kind = kind;               // 'traffic' | 'parked' | 'cop'
    this.driver = kind === 'traffic' ? 'traffic' : null;
    this.health = 100;
    this.dir = angle === Math.PI / 2 ? 1 : angle === -Math.PI / 2 ? 3 : angle === Math.PI ? 2 : 0;
    this.turnCooldown = 0;
    this.honkTimer = 0;
    this.smoke = 0;
  }
  get moving() {
    return Math.abs(this.speed) > 4;
  }
}

/**
 * Advance one car. steer in [-1, 1], throttle in [-1, 1] (negative reverses).
 * Returns the impact speed when the car struck a building, else 0.
 */
export function stepCarPhysics(car, dt, steer, throttle, topSpeed, world) {
  const accel = throttle >= 0 ? 190 : 150;
  car.speed += throttle * accel * dt;
  car.speed -= car.speed * 0.55 * dt;                       // drag
  if (throttle === 0) car.speed -= car.speed * 1.4 * dt;    // engine braking
  if (car.speed > topSpeed) car.speed = topSpeed;
  if (car.speed < -topSpeed * 0.38) car.speed = -topSpeed * 0.38;

  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * 1.9 * grip * dt * (car.speed >= 0 ? 1 : -1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = world.collideCircle(nx, ny, CAR_RADIUS);
  let impact = 0;
  const moved = Math.hypot(nx - fixed.x, ny - fixed.y);
  if (moved > 2) {
    impact = Math.abs(car.speed) * (moved / 10);
    car.speed *= 0.25;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  return impact;
}

/** Push overlapping cars apart; returns the hardest impact seen. */
export function resolveCarPairs(cars) {
  let hardest = 0;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = CAR_RADIUS * 2 - 3;
      if (d2 === 0 || d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > hardest) hardest = rel;
      const mid = (a.speed + b.speed) / 2;
      a.speed = mid;
      b.speed = mid;
    }
  }
  return hardest;
}

/** The lane centre a car in direction `dir` should hold on a road centred at c. */
export function laneCoord(dir, c) {
  // Right-hand traffic: heading east keeps south of centre, and so on.
  if (dir === 0) return c + 32;
  if (dir === 2) return c - 32;
  if (dir === 1) return c - 32;
  return c + 32;
}

export class Traffic {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.cars = [];
    // Parked cars first — they never move until stolen.
    for (const spot of world.parkedSpots) {
      if (rng.chance(0.62)) {
        const car = new Car(spot.x, spot.y, spot.angle, rng.pick(CAR_COLORS), 'parked');
        this.cars.push(car);
      }
    }
    this.streetsX = world.streetCentersX();
    this.avenuesY = world.avenueCentersY();
  }

  spawnTrafficNear(px, py, count) {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 80) {
      const vertical = this.rng.chance(0.5);
      const dir = this.rng.int(0, 3);
      let x;
      let y;
      if (vertical || dir === 1 || dir === 3) {
        const cx = this.rng.pick(this.streetsX);
        x = laneCoord(dir === 1 || dir === 3 ? dir : 1, cx);
        y = py + this.rng.range(-950, 950);
        if (Math.abs(y - py) < 420) continue;
        const car = new Car(x, Math.max(60, Math.min(y, 2500)), dir === 3 ? -Math.PI / 2 : Math.PI / 2, this.rng.pick(CAR_COLORS));
        car.dir = dir === 3 ? 3 : 1;
        car.speed = TRAFFIC_SPEED * 0.8;
        this.cars.push(car);
      } else {
        const cy = this.rng.pick(this.avenuesY);
        y = laneCoord(dir, cy);
        x = px + this.rng.range(-950, 950);
        if (Math.abs(x - px) < 420) continue;
        const car = new Car(Math.max(60, Math.min(x, 2740)), y, dir === 2 ? Math.PI : 0, this.rng.pick(CAR_COLORS));
        car.dir = dir;
        car.speed = TRAFFIC_SPEED * 0.8;
        this.cars.push(car);
      }
      placed++;
    }
  }

  /** Distance to the nearest blocker ahead of `car`, or Infinity. */
  blockerAhead(car, allCars, extra) {
    const hx = Math.cos(car.angle);
    const hy = Math.sin(car.angle);
    let best = Infinity;
    const test = (ox, oy, r) => {
      const dx = ox - car.x;
      const dy = oy - car.y;
      const fwd = dx * hx + dy * hy;
      if (fwd < 6 || fwd > 96) return;
      const lat = Math.abs(-dx * hy + dy * hx);
      if (lat < r + 14 && fwd - r < best) best = fwd - r;
    };
    for (const other of allCars) {
      if (other !== car) test(other.x, other.y, CAR_RADIUS);
    }
    if (extra) for (const p of extra) test(p.x, p.y, 12);
    return best;
  }

  update(dt, playerPos, allCars, peds, events) {
    const world = this.world;
    for (const car of this.cars) {
      if (car.kind !== 'traffic' || car.driver !== 'traffic') continue;
      car.turnCooldown -= dt;

      // Keep the fleet near the player: recycle cars left far behind.
      const distP = Math.hypot(car.x - playerPos.x, car.y - playerPos.y);
      if (distP > 1250) {
        this.respawn(car, playerPos);
        continue;
      }

      const d = DIRS[car.dir];
      // Lateral lane target.
      let steer = 0;
      if (d.x !== 0) {
        const cy = this.nearest(this.avenuesY, car.y);
        const target = laneCoord(car.dir, cy);
        steer = clampSteer((target - car.y) * 0.02 + angleDiff(car.angle, d.x > 0 ? 0 : Math.PI) * 0.9);
      } else {
        const cx = this.nearest(this.streetsX, car.x);
        const target = laneCoord(car.dir, cx);
        steer = clampSteer((car.x - target) * 0.02 + angleDiff(car.angle, d.y > 0 ? Math.PI / 2 : -Math.PI / 2) * 0.9);
      }

      // Turns at intersections.
      if (car.turnCooldown <= 0) {
        const ix = this.nearest(this.streetsX, car.x);
        const iy = this.nearest(this.avenuesY, car.y);
        if (Math.abs(car.x - ix) < 26 && Math.abs(car.y - iy) < 26) {
          const aheadX = car.x + d.x * TILE * 2.2;
          const aheadY = car.y + d.y * TILE * 2.2;
          const roadAhead = world.isRoadPx(aheadX, aheadY);
          const roll = this.rng.next();
          if (!roadAhead || roll > 0.52) {
            const left = (car.dir + 3) % 4;
            const right = (car.dir + 1) % 4;
            const canLeft = world.isRoadPx(car.x + DIRS[left].x * TILE * 2.2, car.y + DIRS[left].y * TILE * 2.2);
            const canRight = world.isRoadPx(car.x + DIRS[right].x * TILE * 2.2, car.y + DIRS[right].y * TILE * 2.2);
            if (canLeft && (!canRight || this.rng.chance(0.5))) car.dir = left;
            else if (canRight) car.dir = right;
            else if (!roadAhead) car.dir = (car.dir + 2) % 4;
          }
          car.turnCooldown = 1.4;
        }
      }

      // Speed: cruise, slowed by whatever is ahead; honk when stuck.
      const ahead = this.blockerAhead(car, allCars, peds);
      let throttle = 1;
      if (ahead < 30) throttle = -0.4;
      else if (ahead < 62) throttle = 0.05;
      else if (ahead < 96) throttle = 0.45;
      if (ahead < 34 && Math.abs(car.speed) < 6) {
        car.honkTimer += dt;
        if (car.honkTimer > 1.6) {
          car.honkTimer = -this.rng.range(1, 4);
          events.push({ type: 'honk', x: car.x, y: car.y });
        }
      } else {
        car.honkTimer = Math.max(0, car.honkTimer - dt);
      }
      const impact = stepCarPhysics(car, dt, steer, throttle, TRAFFIC_SPEED * this.carTopFactor(car), world);
      if (impact > 90) events.push({ type: 'crash', x: car.x, y: car.y, impact, car });
    }
  }

  carTopFactor(car) {
    return 0.85 + ((car.id * 37) % 40) / 100;
  }

  nearest(list, v) {
    let best = list[0];
    let bd = Infinity;
    for (const item of list) {
      const d = Math.abs(item - v);
      if (d < bd) {
        bd = d;
        best = item;
      }
    }
    return best;
  }

  respawn(car, playerPos) {
    const vertical = this.rng.chance(0.5);
    car.dir = this.rng.int(0, 3);
    if (vertical) {
      const cx = this.rng.pick(this.streetsX);
      car.dir = this.rng.chance(0.5) ? 1 : 3;
      car.x = laneCoord(car.dir, cx);
      car.y = clamp(playerPos.y + this.rng.pick([-1, 1]) * this.rng.range(760, 1000), 70, 2490);
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const cy = this.rng.pick(this.avenuesY);
      car.dir = this.rng.chance(0.5) ? 0 : 2;
      car.y = laneCoord(car.dir, cy);
      car.x = clamp(playerPos.x + this.rng.pick([-1, 1]) * this.rng.range(760, 1000), 70, 2740);
      car.angle = car.dir === 0 ? 0 : Math.PI;
    }
    car.speed = TRAFFIC_SPEED * 0.7;
    car.turnCooldown = 1;
  }
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
export function clampSteer(v) {
  return clamp(v, -1, 1);
}
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
