// The delivery loop that pays Sol's rent: collect a package, beat the
// clock across town, get paid more for every job finished — while Dom
// Reyes narrates a small story about the Harbormaster's missing cargo.

import { TILE } from './config.js';

const STORY = [
  'Dom: Sol, you drive, you don\'t ask. First run — a toolbox to the Marina. Simple.',
  'Dom: Marina boys paid double and asked for you by name. Told you.',
  'Dom: This one\'s warm. Don\'t let it sit — move, and don\'t stop for lights.',
  'Dom: The Harbormaster\'s crew lost a package. We "found" it. Take it back — full price.',
  'Dom: Cops are watching the garage now. Quick hands, clean lines, no noise.',
  'Dom: Last one, Sol. After this, we\'re square with everybody in Tidewater.',
];
const GENERIC = [
  'Dom: Another runner job. You know the city better than the satnav now.',
  'Dom: Same as always — fast, quiet, and my name stays out of it.',
  'Dom: Beach road\'s clear this time of day. Make it count.',
  'Dom: They\'re paying rush rates today. Don\'t keep them waiting.',
];

export class Missions {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.phase = 'pickup';            // 'pickup' | 'deliver' | 'cooldown'
    this.cooldown = 0;
    this.marker = null;
    this.timer = 0;
    this.timeLimit = 0;
    this.jobsDone = 0;
    this.subtitle = '';
    this.subtitleUntil = 0;
    this.now = 0;
    this.setPickup(true);
  }

  say(text, seconds = 5) {
    this.subtitle = text;
    this.subtitleUntil = this.now + seconds;
  }
  storyLine(job) {
    return job < STORY.length ? STORY[job] : GENERIC[job % GENERIC.length];
  }

  /** A point on the street in front of a building. */
  frontOf(b) {
    const world = this.world;
    const cy = b.y + b.h / 2;
    const cx = b.x + b.w / 2;
    const tries = [
      { x: b.x + b.w + 44, y: cy },
      { x: b.x - 44, y: cy },
      { x: cx, y: b.y + b.h + 44 },
      { x: cx, y: b.y - 44 },
    ];
    for (const t of tries) {
      const tile = world.tileAtPx(t.x, t.y);
      if (tile === 0 || tile === 1) return t;
    }
    return tries[0];
  }

  setPickup(first = false) {
    const garage = this.world.buildings.find((b) => b.name === 'Reyes Auto & Salvage');
    this.marker = {
      x: this.world.garageFront.x,
      y: this.world.garageFront.y,
      label: 'PICKUP — Reyes Auto & Salvage',
      building: garage,
    };
    this.phase = 'pickup';
    if (first) this.say('Dom: Come by the garage, Sol. I\'ve got work that pays.', 6);
  }

  setDropoff(fromPos) {
    const world = this.world;
    const options = world.buildings.filter((b) => {
      const f = this.frontOf(b);
      const d = Math.hypot(f.x - fromPos.x, f.y - fromPos.y);
      return d > 700 && d < 2400 && b.name !== 'Reyes Auto & Salvage';
    });
    const b = options.length ? this.rng.pick(options) : world.buildings[3];
    const f = this.frontOf(b);
    const dist = Math.hypot(f.x - fromPos.x, f.y - fromPos.y);
    this.timeLimit = Math.round(dist / 9.5) + 18;
    this.timer = this.timeLimit;
    this.marker = { x: f.x, y: f.y, label: `DELIVER — ${b.name}`, building: b };
    this.phase = 'deliver';
    this.say(this.storyLine(this.jobsDone), 6);
  }

  payout() {
    const base = 140 + this.jobsDone * 45;
    const timeBonus = Math.round(Math.max(0, this.timer) * 4);
    return base + timeBonus;
  }

  /**
   * Advance the loop. Returns an event object when something happens:
   * { type: 'loaded' } or { type: 'delivered', payout } or
   * { type: 'failed' } when the clock runs out.
   */
  update(dt, playerPos) {
    this.now += dt;
    if (this.phase === 'cooldown') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.setPickup();
      return null;
    }
    if (this.phase === 'deliver') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'cooldown';
        this.cooldown = 3;
        this.marker = null;
        this.say('Dom: Too slow. The buyer walked. Come back to the garage.', 5);
        return { type: 'failed' };
      }
    }
    if (this.marker) {
      const d = Math.hypot(playerPos.x - this.marker.x, playerPos.y - this.marker.y);
      if (d < 52) {
        if (this.phase === 'pickup') {
          this.setDropoff(playerPos);
          return { type: 'loaded' };
        }
        if (this.phase === 'deliver') {
          const pay = this.payout();
          this.jobsDone++;
          this.phase = 'cooldown';
          this.cooldown = 2.5;
          this.marker = null;
          this.say(`Dom: Clean work. $${pay} wired. Head back when you're ready.`, 5);
          return { type: 'delivered', payout: pay };
        }
      }
    }
    return null;
  }

  get subtitleVisible() {
    return this.now < this.subtitleUntil ? this.subtitle : '';
  }
}
