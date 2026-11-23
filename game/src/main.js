// Tidewater Heat — the game itself: boot, the loop, and every rule that
// ties the city together. Sol Vega runs packages for Dom Reyes; the player
// walks, steals, drives, delivers, and answers for all of it to the
// Tidewater PD through the heat, bust and health systems run here.

import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, SAVE_KEY,
  HEAT_PER_STAR, MAX_STARS, HEAT_DECAY, BUST_RANGE, BUST_RATE,
  PLAYER_CAR_SPEED,
} from './config.js';
import { Rng } from './random.js';
import { World } from './world.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { Traffic, stepCarPhysics, resolveCarPairs, clamp } from './vehicles.js';
import { Crowd, Pedestrian } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Missions } from './missions.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { readShotRequest, applyShotScene } from './shots.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.status = document.getElementById('status');
    this.shot = readShotRequest();

    this.world = new World(20261123);
    this.rng = new Rng(this.shot ? 5000 + this.shot.seed : 987654);
    this.input = new Input(this.canvas);
    this.sfx = new SoundFX();
    this.traffic = new Traffic(this.world, this.rng);
    this.crowd = new Crowd(this.world, this.rng, 30);
    this.police = new Police(this.world, this.rng);
    this.player = new Player(this.world.playerStart.x, this.world.playerStart.y);
    this.missions = new Missions(this.world, this.rng);
    this.renderer = new Renderer(this.world);
    this.hud = new Hud();

    this.state = this.shot ? 'playing' : 'title';
    this.time = 0;
    this.heat = 0;
    this.bust = 0;
    this.heatFresh = 0;
    this.lastSeenAt = -10;
    this.lastDamageAt = -10;
    this.invuln = 0;
    this.fine = 0;
    this.particles = [];
    this.camX = 0;
    this.camY = 0;
    this.shotFrames = 0;

    const saved = this.loadSave();
    this.cash = saved.cash;
    this.missions.jobsDone = saved.jobs;

    this.traffic.spawnTrafficNear(this.player.x, this.player.y, 13);
    if (this.shot) {
      applyShotScene(this, this.shot.name);
      if (this.shot.name === 'foot') {
        for (let i = 0; i < 9; i++) {
          this.crowd.peds.push(new Pedestrian(this.world, this.rng,
            this.player.x + this.rng.range(-190, 190), this.player.y + this.rng.range(-150, 150)));
        }
      }
    }
    this.updateCamera(1);
    window.__game = this; // a handle for automated playtests
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return { cash: Number(data.cash) || 0, jobs: Number(data.jobs) || 0 };
      }
    } catch {
      /* a fresh career */
    }
    return { cash: 0, jobs: 0 };
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: this.cash, jobs: this.missions.jobsDone }));
    } catch {
      /* private mode: play on unsaved */
    }
  }

  get stars() {
    return Math.min(MAX_STARS, Math.floor(this.heat / HEAT_PER_STAR));
  }
  addHeat(amount) {
    this.heat = Math.min(HEAT_PER_STAR * MAX_STARS + 20, this.heat + amount);
    this.heatFresh = 2.2;
  }

  allCars() {
    return [...this.traffic.cars, ...this.police.cars];
  }
  playerTarget() {
    const p = this.player.pos();
    return {
      x: p.x,
      y: p.y,
      speed: this.player.driving ? this.player.car.speed : this.player.speed,
      angle: this.player.driving ? this.player.car.angle : this.player.angle,
    };
  }

  burst(x, y, kind, n, spread = 60) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y,
        vx: this.rng.range(-spread, spread),
        vy: this.rng.range(-spread, spread),
        life: this.rng.range(0.3, 0.8),
        maxLife: 0.8,
        kind,
        size: this.rng.range(3, 7),
      });
    }
  }
  floatText(x, y, text) {
    this.particles.push({ x, y, vx: 0, vy: -34, life: 1.4, maxLife: 1.4, kind: 'text', text, size: 0 });
  }

  frame(now) {
    const rawDt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    const dt = this.shot ? 1 / 60 : rawDt;
    if (this.state !== 'paused') {
      this.time += dt;
      this.update(dt);
    } else if (this.input.tapped('KeyP', 'Escape')) {
      this.state = 'playing';
    }
    this.draw();
    this.input.endFrame();
    if (this.shot) {
      this.shotFrames++;
      if (this.shotFrames >= 55) {
        window.__shotReady = true;
        return; // freeze on the staged frame
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    const events = [];
    const target = this.playerTarget();
    const focus = this.player.pos();

    if (this.state === 'title') {
      this.traffic.update(dt, { x: this.camX + VIEW_W / 2, y: this.camY + VIEW_H / 2 }, this.allCars(), [], events);
      this.crowd.update(dt);
      this.camX = (Math.sin(this.time * 0.045) * 0.5 + 0.5) * (WORLD_W - VIEW_W);
      this.camY = (Math.cos(this.time * 0.03) * 0.5 + 0.5) * (WORLD_H - VIEW_H);
      if (this.input.tapped('Enter') || this.input.clicked) {
        this.sfx.unlock();
        this.state = 'playing';
      }
      this.handleEvents(events);
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      if (this.input.tapped('KeyR')) this.respawn();
      this.updateParticles(dt);
      return;
    }

    // --- the player ---
    if (this.player.driving) {
      const car = this.player.car;
      let steer = 0;
      let throttle = 0;
      if (this.shot) {
        throttle = 0.55;
      } else {
        if (this.input.down('KeyA', 'ArrowLeft')) steer -= 1;
        if (this.input.down('KeyD', 'ArrowRight')) steer += 1;
        if (this.input.down('KeyW', 'ArrowUp')) throttle += 1;
        if (this.input.down('KeyS', 'ArrowDown')) throttle -= 1;
      }
      const wrecked = car.health <= 0;
      const top = PLAYER_CAR_SPEED * (wrecked ? 0.22 : car.id % 5 === 0 ? 1.07 : 1);
      const impact = stepCarPhysics(car, dt, steer, throttle, top, this.world);
      if (impact > 60) {
        events.push({ type: 'crash', x: car.x, y: car.y, impact, car });
        if (car.kind === 'cop') this.addHeat(6);
      }
      if (wrecked && Math.floor(this.time * 3) % 2 === 0) {
        this.burst(car.x, car.y - 8, 'smoke', 1, 12);
      }
      if (!this.shot && this.input.tapped('KeyE')) {
        this.player.exitCar();
        this.sfx.door();
        const fixed = this.world.collideCircle(this.player.x, this.player.y, 13);
        this.player.x = fixed.x;
        this.player.y = fixed.y;
      }
      this.sfx.setEngine(Math.abs(car.speed) / PLAYER_CAR_SPEED, true);
    } else {
      this.sfx.setEngine(0, false);
      if (!this.shot) {
        this.player.updateOnFoot(dt, this.input, this.world);
        if (this.input.tapped('KeyE')) {
          const car = this.player.carInReach(this.allCars());
          if (car) this.stealCar(car);
        }
        if (this.input.mouseDown && this.player.fireCooldown <= 0) {
          this.fireGun();
        }
      }
    }

    // --- the city lives ---
    const footBlockers = this.player.driving ? this.crowd.peds : [...this.crowd.peds, { x: this.player.x, y: this.player.y }];
    this.traffic.update(dt, focus, this.allCars(), footBlockers, events);
    const sight = this.police.update(dt, this.stars, target, events);
    if (sight.seen) this.lastSeenAt = this.time;
    resolveCarPairs(this.allCars());
    this.crowd.update(dt);
    this.checkPedCarHits(events);
    this.checkPlayerRunOver(dt);

    // --- missions ---
    const mEvent = this.missions.update(dt, focus);
    if (mEvent) {
      if (mEvent.type === 'loaded') {
        this.sfx.pickup();
        this.burst(focus.x, focus.y, 'spark', 8, 40);
      } else if (mEvent.type === 'delivered') {
        this.cash += mEvent.payout;
        this.sfx.cash();
        this.floatText(focus.x, focus.y - 26, `+$${mEvent.payout}`);
        this.save();
      } else if (mEvent.type === 'failed') {
        this.sfx.bustedJingle();
      }
    }

    // --- heat, bust, health ---
    this.heatFresh = Math.max(0, this.heatFresh - dt);
    if (this.time - this.lastSeenAt > 4 && this.heat > 0) {
      this.heat = Math.max(0, this.heat - HEAT_DECAY * dt);
      if (this.heat < HEAT_PER_STAR && this.bust > 0) this.bust = Math.max(0, this.bust - 20 * dt);
    }
    const speedNow = Math.abs(target.speed);
    if (sight.nearCount > 0 && speedNow < 46) {
      this.bust += BUST_RATE * dt * (1 + (sight.nearCount - 1) * 0.45);
    } else {
      this.bust = Math.max(0, this.bust - 26 * dt);
    }
    if (this.bust >= 100) return this.onBusted();
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.time - this.lastDamageAt > 6 && this.player.health < 100) {
      this.player.health = Math.min(100, this.player.health + 3 * dt);
    }
    if (this.player.health <= 0) return this.onWasted();

    // --- sound and camera ---
    let siren = 0;
    if (this.stars > 0) {
      let nearest = Infinity;
      for (const cop of this.police.cars) nearest = Math.min(nearest, Math.hypot(cop.x - focus.x, cop.y - focus.y));
      siren = clamp(1 - nearest / 640, 0, 1);
    }
    this.sfx.setSiren(siren);
    this.sfx.updatePad(dt);
    if (!this.shot && this.input.tapped('KeyM')) this.sfx.setMuted(!this.sfx.muted);
    if (!this.shot && this.input.tapped('KeyP', 'Escape')) this.state = 'paused';

    this.handleEvents(events);
    this.updateParticles(dt);
    this.updateCamera(dt);
    if (this.status && Math.floor(this.time * 2) !== this.statusTick) {
      this.statusTick = Math.floor(this.time * 2);
      this.status.textContent = this.describeStatus();
    }
  }

  describeStatus() {
    const p = this.player.pos();
    return `Tidewater Heat. Cash $${this.cash}. Wanted level ${this.stars} of 5. ` +
      (this.player.driving ? 'Driving. ' : 'On foot. ') +
      (this.missions.marker ? `Objective: ${this.missions.marker.label}, ${Math.round(Math.hypot(this.missions.marker.x - p.x, this.missions.marker.y - p.y))} metres away.` : 'No active delivery.');
  }

  stealCar(car) {
    const wasCop = car.kind === 'cop';
    const hadDriver = car.driver === 'traffic';
    this.player.enterCar(car);
    this.sfx.unlock();
    this.sfx.door();
    if (wasCop) {
      this.addHeat(30);
      this.missions.say('Dom: You stole a POLICE car?! …Okay. I respect it. Drive.', 4);
    } else if (hadDriver) {
      this.addHeat(16);
      const ped = new Pedestrian(this.world, this.rng, car.x + 24, car.y + 10);
      ped.scare(car.x, car.y, 200);
      this.crowd.peds.push(ped);
    } else {
      this.addHeat(11);
    }
  }

  fireGun() {
    const camX = this.camX;
    const camY = this.camY;
    const tx = this.input.mouseX + camX;
    const ty = this.input.mouseY + camY;
    const hit = this.player.shoot(tx, ty, this.world, this.allCars(), this.crowd.peds);
    if (!hit) {
      this.sfx.dryFire();
      return;
    }
    this.sfx.shot();
    this.crowd.scareAll(this.player.x, this.player.y, 300);
    this.addHeat(2.5);
    if (hit.kind === 'ped' && hit.target) {
      if (hit.target.knockDown()) {
        this.addHeat(22);
        this.burst(hit.x, hit.y, 'blood', 7, 46);
      }
    } else if (hit.kind === 'car' && hit.target) {
      hit.target.health -= 13;
      this.burst(hit.x, hit.y, 'spark', 6, 55);
      if (hit.target.kind === 'cop') this.addHeat(15);
      else this.addHeat(5);
    } else if (hit.kind === 'building') {
      this.burst(hit.x, hit.y, 'spark', 3, 30);
    }
  }

  checkPedCarHits(events) {
    const cars = this.allCars();
    for (const ped of this.crowd.peds) {
      if (ped.state === 'down') continue;
      for (const car of cars) {
        const speed = Math.abs(car.speed);
        if (speed < 16) continue;
        const d = Math.hypot(ped.x - car.x, ped.y - car.y);
        if (d > 31) continue;
        if (speed > 56) {
          if (ped.knockDown()) {
            this.burst(ped.x, ped.y, 'blood', 8, 50);
            events.push({ type: 'crash', x: ped.x, y: ped.y, impact: speed * 0.5, car });
            if (car.driver === 'player') {
              this.addHeat(20);
              this.player.health = Math.max(1, this.player.health - 2);
            }
          }
        } else {
          // A nudge: the walker hops aside.
          const away = Math.atan2(ped.y - car.y, ped.x - car.x);
          ped.x += Math.cos(away) * 16;
          ped.y += Math.sin(away) * 16;
          ped.scare(car.x, car.y, 120);
        }
        break;
      }
    }
  }

  checkPlayerRunOver(dt) {
    if (this.player.driving || this.invuln > 0 || this.shot) return;
    for (const car of this.allCars()) {
      if (Math.abs(car.speed) < 52) continue;
      const d = Math.hypot(this.player.x - car.x, this.player.y - car.y);
      if (d < 30) {
        this.player.health -= 20;
        this.lastDamageAt = this.time;
        this.invuln = 0.9;
        const away = Math.atan2(this.player.y - car.y, this.player.x - car.x);
        this.player.x += Math.cos(away) * 30;
        this.player.y += Math.sin(away) * 30;
        this.sfx.crash(0.5);
        break;
      }
    }
  }

  handleEvents(events) {
    const focus = this.player.pos();
    for (const e of events) {
      const d = Math.hypot(e.x - focus.x, e.y - focus.y);
      if (e.type === 'crash') {
        if (e.car) {
          e.car.health -= e.impact * 0.14;
          if (e.car === this.player.car) {
            this.player.health -= e.impact * 0.045;
            this.lastDamageAt = this.time;
            this.burst(e.x, e.y, 'spark', 6, 60);
          }
        }
        if (d < 720) this.sfx.crash(clamp(e.impact / 260, 0.1, 0.9));
      } else if (e.type === 'honk' && d < 560) {
        this.sfx.blip(392, 0.13, 'square', 0.045);
        setTimeout(() => this.sfx.blip(330, 0.16, 'square', 0.04), 120);
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  updateCamera(dt) {
    const p = this.player.pos();
    let lookX = 0;
    let lookY = 0;
    if (this.player.driving) {
      lookX = Math.cos(this.player.car.angle) * this.player.car.speed * 0.34;
      lookY = Math.sin(this.player.car.angle) * this.player.car.speed * 0.34;
    }
    const tx = clamp(p.x + lookX - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(p.y + lookY - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    const k = this.shot ? 1 : Math.min(1, dt * 5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  onBusted() {
    this.fine = Math.min(this.cash, 150 + this.stars * 40);
    this.cash -= this.fine;
    this.state = 'busted';
    this.sfx.bustedJingle();
    this.sfx.setSiren(0);
    this.sfx.setEngine(0, false);
    this.save();
  }
  onWasted() {
    this.fine = Math.min(this.cash, 120);
    this.cash -= this.fine;
    this.state = 'wasted';
    this.sfx.setSiren(0);
    this.sfx.setEngine(0, false);
    this.save();
  }
  respawn() {
    const at = this.state === 'busted' ? this.world.precinctFront : this.world.hospitalFront;
    if (this.player.car) {
      const car = this.player.car;
      car.driver = null;
      car.kind = 'parked';
      car.speed = 0;
      this.player.car = null;
    }
    this.player.x = at.x;
    this.player.y = at.y;
    this.player.health = 100;
    this.heat = 0;
    this.bust = 0;
    this.police.cars.length = 0;
    this.state = 'playing';
    this.updateCamera(1);
  }

  draw() {
    const ctx = this.ctx;
    const focus = this.player.pos();
    this.renderer.draw(ctx, {
      camX: Math.round(this.camX),
      camY: Math.round(this.camY),
      time: this.time,
      player: this.player,
      cars: this.allCars(),
      peds: this.crowd.peds,
      particles: this.particles,
      missionMarker: this.state === 'title' ? null : this.missions.marker,
    });
    if (this.state === 'title') {
      this.hud.drawTitle(ctx, { time: this.time, savedCash: this.cash, savedJobs: this.missions.jobsDone });
      return;
    }
    const target = this.playerTarget();
    this.hud.draw(ctx, {
      time: this.time,
      cash: this.cash,
      jobs: this.missions.jobsDone,
      stars: this.stars,
      heatFresh: this.heatFresh > 0,
      health: this.player.health,
      driving: this.player.driving,
      speed: target.speed,
      carHealth: this.player.driving ? this.player.car.health : 100,
      bust: this.bust,
      missionLabel: this.missions.marker ? this.missions.marker.label : '',
      missionDist: this.missions.marker ? Math.hypot(this.missions.marker.x - focus.x, this.missions.marker.y - focus.y) : 0,
      missionTimer: this.missions.phase === 'deliver' ? this.missions.timer : null,
      missionPos: this.missions.marker,
      prompt: this.computePrompt(),
      subtitle: this.missions.subtitleVisible,
      buildings: this.world.buildings,
      cops: this.police.cars,
      peds: this.crowd.peds,
      playerPos: focus,
      playerAngle: target.angle,
    });
    if (this.state === 'busted' || this.state === 'wasted') {
      this.hud.drawEndScreen(ctx, this.state, { fine: this.fine });
    }
    if (this.state === 'paused') this.hud.drawPaused(ctx);
    // Damage vignette.
    if (this.player.health < 38 && this.state === 'playing') {
      const a = 0.24 + 0.1 * Math.sin(this.time * 6);
      const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
      grad.addColorStop(0, 'rgba(180,0,0,0)');
      grad.addColorStop(1, `rgba(180,0,0,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  computePrompt() {
    if (this.state !== 'playing' || this.shot) return '';
    if (this.player.driving) return 'E — step out';
    const car = this.player.carInReach(this.allCars());
    if (car) return car.kind === 'cop' ? 'E — steal the police car' : 'E — drive';
    return '';
  }
}

new Game();
