// Tidewater's city plan: a seeded street grid of named pastel blocks, a park
// every few blocks, palm trees on the walks, sand and water down the east
// edge, and the collision shapes every moving thing tests against.
//
// Tile types: 0 road, 1 sidewalk, 2 building lot, 3 park, 4 sand, 5 water.

import { TILE, WORLD_COLS, WORLD_ROWS, WORLD_W, WORLD_H, PITCH, BEACH_COL } from './config.js';
import { Rng } from './random.js';

export const T_ROAD = 0;
export const T_WALK = 1;
export const T_LOT = 2;
export const T_PARK = 3;
export const T_SAND = 4;
export const T_WATER = 5;

const BUILDING_NAMES = [
  'Hotel Marbella', 'Hotel Coralina', 'Hotel Delfín', 'Hotel Sirena',
  'Palms Grand Casino', 'Banco del Puerto', 'Torre Nácar', 'Farmacia Vida',
  'Mercado Central', 'Cine Riviera', 'Club La Ola', 'Café Brisa',
  'Tacos El Faro', 'Joyas Perla', 'Galería Azul', 'Marina Suites',
  'Oficinas del Muelle', 'Bar El Ancla', 'Hotel La Perla', 'Torre Coral',
  'Banco Tidewater', 'Librería Marea', 'Gimnasio Ola', 'Hotel Faro Blanco',
  'Pizzería Nona', 'Floristería Lila', 'Hotel Palma Real', 'Cine Coral',
  'Hotel Brisa Alta', 'Dulces Marisol', 'Torre Miramar', 'Café del Muelle',
];

const PALETTE = [
  { wall: '#f2a65a', roof: '#c97b3d' },
  { wall: '#e07a5f', roof: '#b3553f' },
  { wall: '#81b29a', roof: '#5d8a74' },
  { wall: '#f2cc8f', roof: '#c9a35f' },
  { wall: '#6d8ea0', roof: '#4d6a7a' },
  { wall: '#e5989b', roof: '#bc7377' },
  { wall: '#a8dadc', roof: '#79aeb0' },
  { wall: '#f4f1de', roof: '#c9c4a8' },
];

export class World {
  constructor(seed = 20261123) {
    const rng = new Rng(seed);
    this.widthPx = WORLD_W;
    this.heightPx = WORLD_H;
    this.tiles = new Uint8Array(WORLD_COLS * WORLD_ROWS);
    this.buildings = [];
    this.palms = [];
    this.parkedSpots = [];

    const names = rng.shuffled(BUILDING_NAMES);
    let nameAt = 0;
    const isParkBlock = (bx, by) => (bx * 3 + by * 5) % 6 === 3;

    for (let by = 0; by * PITCH < WORLD_ROWS; by++) {
      for (let bx = 0; bx * PITCH + 4 < BEACH_COL; bx++) {
        const park = isParkBlock(bx, by);
        // Interior of the block (local tiles 1..3) holds the building.
        const ix = bx * PITCH + 1;
        const iy = by * PITCH + 1;
        if (!park && iy + 2 < WORLD_ROWS) {
          const color = PALETTE[(bx * 7 + by * 3) % PALETTE.length];
          const b = {
            x: ix * TILE + 10,
            y: iy * TILE + 10,
            w: 3 * TILE - 20,
            h: 3 * TILE - 20,
            name: names[nameAt++ % names.length],
            wall: color.wall,
            roof: color.roof,
            floors: 2 + ((bx * 5 + by * 7) % 6),
            bx,
            by,
          };
          if (bx === 0 && by === 2) b.name = 'Reyes Auto & Salvage';
          if (bx === 4 && by === 0) b.name = 'Tidewater PD — Precinct 9';
          if (bx === 2 && by === 4) b.name = 'Clínica Santa Mar';
          this.buildings.push(b);
        }
        for (let ly = 0; ly < 5; ly++) {
          for (let lx = 0; lx < 5; lx++) {
            const tx = bx * PITCH + lx;
            const ty = by * PITCH + ly;
            if (tx >= WORLD_COLS || ty >= WORLD_ROWS) continue;
            const inner = lx >= 1 && lx <= 3 && ly >= 1 && ly <= 3;
            this.tiles[ty * WORLD_COLS + tx] = park ? T_PARK : inner ? T_LOT : T_WALK;
          }
        }
      }
    }

    for (let ty = 0; ty < WORLD_ROWS; ty++) {
      for (let tx = 0; tx < WORLD_COLS; tx++) {
        if (tx >= BEACH_COL + 3) this.tiles[ty * WORLD_COLS + tx] = T_WATER;
        else if (tx >= BEACH_COL) this.tiles[ty * WORLD_COLS + tx] = T_SAND;
        else if (tx % PITCH >= 5 || ty % PITCH >= 5) this.tiles[ty * WORLD_COLS + tx] = T_ROAD;
      }
    }

    // Palms on walks, in parks and along the sand.
    for (let ty = 0; ty < WORLD_ROWS; ty++) {
      for (let tx = 0; tx < WORLD_COLS; tx++) {
        const t = this.tiles[ty * WORLD_COLS + tx];
        if ((t === T_WALK || t === T_PARK || t === T_SAND) && rng.chance(t === T_PARK ? 0.16 : 0.055)) {
          this.palms.push({
            x: tx * TILE + rng.range(12, TILE - 12),
            y: ty * TILE + rng.range(12, TILE - 12),
            s: rng.range(0.8, 1.3),
          });
        }
      }
    }

    // Kerbside parking spots along every street and avenue.
    for (let s = 0; s * PITCH + 6 < BEACH_COL; s++) {
      const cx = (s * PITCH + 6) * TILE;
      for (let y = 90; y < WORLD_H - 90; y += 235) {
        if (rng.chance(0.72)) this.parkedSpots.push({ x: cx - 47, y: y + rng.range(-14, 14), angle: Math.PI / 2 });
        if (rng.chance(0.72)) this.parkedSpots.push({ x: cx + 47, y: y + rng.range(-14, 14), angle: -Math.PI / 2 });
      }
    }
    for (let s = 0; s * PITCH + 6 < WORLD_ROWS; s++) {
      const cy = (s * PITCH + 6) * TILE;
      for (let x = 90; x < (BEACH_COL - 1) * TILE; x += 235) {
        if (rng.chance(0.66)) this.parkedSpots.push({ x: x + rng.range(-14, 14), y: cy - 47, angle: 0 });
        if (rng.chance(0.66)) this.parkedSpots.push({ x: x + rng.range(-14, 14), y: cy + 47, angle: Math.PI });
      }
    }

    const garage = this.buildings.find((b) => b.name === 'Reyes Auto & Salvage');
    this.garageFront = { x: garage.x + garage.w + 74, y: garage.y + garage.h / 2 };
    this.playerStart = { x: garage.x + garage.w + 30, y: garage.y + garage.h / 2 + 40 };
    const hospital = this.buildings.find((b) => b.name === 'Clínica Santa Mar');
    this.hospitalFront = { x: hospital.x + hospital.w + 60, y: hospital.y + hospital.h / 2 };
    const precinct = this.buildings.find((b) => b.name === 'Tidewater PD — Precinct 9');
    this.precinctFront = { x: precinct.x - 60, y: precinct.y + precinct.h / 2 };
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_COLS || ty >= WORLD_ROWS) return T_WATER;
    return this.tiles[ty * WORLD_COLS + tx];
  }
  tileAtPx(x, y) {
    return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  }
  isRoadPx(x, y) {
    return this.tileAtPx(x, y) === T_ROAD;
  }
  /** Street centre lines (x of each north-south street, y of each avenue). */
  streetCentersX() {
    const out = [];
    for (let s = 0; s * PITCH + 6 < BEACH_COL; s++) out.push((s * PITCH + 6) * TILE);
    return out;
  }
  avenueCentersY() {
    const out = [];
    for (let s = 0; s * PITCH + 6 < WORLD_ROWS; s++) out.push((s * PITCH + 6) * TILE);
    return out;
  }
  buildingNear(x, y, pad) {
    return this.buildings.filter(
      (b) => x > b.x - pad - 200 && x < b.x + b.w + pad + 200 && y > b.y - pad - 200 && y < b.y + b.h + pad + 200,
    );
  }
  /**
   * Push a circle at (x, y) out of every building and back inside the world
   * and out of the water. Returns the corrected position.
   */
  collideCircle(x, y, r) {
    for (const b of this.buildingNear(x, y, r)) {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - nx;
      let dy = y - ny;
      let d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 === 0) {
        // Centre inside the rect: push out along the smallest exit.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
        continue;
      }
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
    }
    const waterX = (BEACH_COL + 3) * TILE;
    if (x > waterX - r) x = waterX - r;
    if (x < r) x = r;
    if (y < r) y = r;
    if (x > WORLD_W - r) x = WORLD_W - r;
    if (y > WORLD_H - r) y = WORLD_H - r;
    return { x, y };
  }
}
