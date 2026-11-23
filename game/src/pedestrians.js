// Pedestrians: Tidewater's walkers. They stroll the sidewalks, parks and
// sand on real tile paths (breadth-first over walkable tiles), run from
// gunfire and fast cars, and go down when a car actually hits them.

import { TILE, WORLD_COLS, WORLD_ROWS } from './config.js';
import { T_WALK, T_PARK, T_SAND } from './world.js';

const SHIRTS = ['#ff8fa3', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b', '#a7c957', '#e0aaff', '#90e0ef', '#ffb703'];
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#6b4423'];
const PANTS = ['#264653', '#606c38', '#283618', '#7f5539', '#3d405b', '#5f0f40'];

function walkable(world, tx, ty) {
  const t = world.tileAt(tx, ty);
  return t === T_WALK || t === T_PARK || t === T_SAND;
}

/** Breadth-first path over walkable tiles; returns tile-centre waypoints. */
function findPath(world, sx, sy, tx, ty) {
  if (!walkable(world, tx, ty)) return null;
  const key = (x, y) => y * WORLD_COLS + x;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  let found = false;
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) {
      found = true;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_COLS || ny >= WORLD_ROWS) continue;
      if (prev.has(key(nx, ny)) || !walkable(world, nx, ny)) continue;
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (!found) return null;
  const tiles = [];
  let cur = [tx, ty];
  while (cur) {
    tiles.push(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  tiles.reverse();
  return tiles.map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }));
}

export class Pedestrian {
  constructor(world, rng, x, y) {
    this.x = x;
    this.y = y;
    this.angle = rng.range(0, Math.PI * 2);
    this.speed = 0;
    this.walkSpeed = rng.range(52, 84);
    this.state = 'walk';
    this.path = null;
    this.pathAt = 0;
    this.fleeFrom = null;
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.idleTimer = rng.range(0, 2);
    this.shirt = rng.pick(SHIRTS);
    this.skin = rng.pick(SKIN);
    this.pants = rng.pick(PANTS);
    this.world = world;
    this.rng = rng;
    this.legPhase = rng.range(0, 6);
  }

  scare(x, y, radius) {
    const d = Math.hypot(this.x - x, this.y - y);
    if (d < radius && this.state !== 'down') {
      this.state = 'flee';
      this.fleeFrom = { x, y };
      this.fleeTimer = this.rng.range(1.2, 2.2);
      this.path = null;
    }
  }

  knockDown() {
    if (this.state === 'down') return false;
    this.state = 'down';
    this.downTimer = 7;
    this.speed = 0;
    return true;
  }

  choosePath() {
    const ctx = Math.floor(this.x / TILE);
    const cty = Math.floor(this.y / TILE);
    for (let tries = 0; tries < 8; tries++) {
      const tx = ctx + this.rng.int(-7, 7);
      const ty = cty + this.rng.int(-7, 7);
      if (!walkable(this.world, tx, ty)) continue;
      const path = findPath(this.world, ctx, cty, tx, ty);
      if (path && path.length > 1) {
        this.path = path;
        this.pathAt = 1;
        return;
      }
    }
    this.path = null;
    this.idleTimer = this.rng.range(1, 3);
  }

  update(dt) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.state = 'walk';
        this.path = null;
      }
      return;
    }
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const dx = this.x - this.fleeFrom.x;
      const dy = this.y - this.fleeFrom.y;
      const d = Math.hypot(dx, dy) || 1;
      this.angle = Math.atan2(dy, dx);
      this.speed = 208;
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
      const fixed = this.world.collideCircle(this.x, this.y, 10);
      this.x = fixed.x;
      this.y = fixed.y;
      this.legPhase += dt * 11;
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.path = null;
      }
      return;
    }
    // Strolling.
    if (this.idleTimer > 0) {
      this.idleTimer -= dt;
      this.speed = 0;
      return;
    }
    if (!this.path || this.pathAt >= this.path.length) {
      this.choosePath();
      if (!this.path) return;
    }
    const target = this.path[this.pathAt];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 7) {
      this.pathAt++;
      return;
    }
    this.angle = Math.atan2(dy, dx);
    this.speed = this.walkSpeed;
    this.x += (dx / d) * this.speed * dt;
    this.y += (dy / d) * this.speed * dt;
    this.legPhase += dt * 7;
    if (this.rng.chance(0.0015)) this.idleTimer = this.rng.range(1.5, 4);
  }
}

export class Crowd {
  constructor(world, rng, count) {
    this.peds = [];
    let guard = 0;
    while (this.peds.length < count && guard++ < 600) {
      const tx = rng.int(1, WORLD_COLS - 2);
      const ty = rng.int(1, WORLD_ROWS - 2);
      if (!walkable(world, tx, ty)) continue;
      this.peds.push(new Pedestrian(world, rng, tx * TILE + 32, ty * TILE + 32));
    }
  }
  scareAll(x, y, radius) {
    for (const ped of this.peds) ped.scare(x, y, radius);
  }
  update(dt) {
    for (const ped of this.peds) ped.update(dt);
  }
}
