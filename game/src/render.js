// Drawing the world: the static city (streets, walks, lots, sand, water) is
// painted once into a big offscreen canvas; each frame blits the camera's
// slice of it, then draws palms, cars, people, the player, mission markers
// and effects, all culled to the view.

import { TILE, WORLD_COLS, WORLD_ROWS, WORLD_W, VIEW_W, VIEW_H, CAR_LENGTH, CAR_WIDTH } from './config.js';
import { T_ROAD, T_WALK, T_LOT, T_PARK, T_SAND, T_WATER } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(world) {
    this.world = world;
    this.layer = document.createElement('canvas');
    this.layer.width = WORLD_W;
    this.layer.height = world.heightPx;
    this.paintStatic(this.layer.getContext('2d'));
  }

  paintStatic(ctx) {
    const world = this.world;
    ctx.fillStyle = '#2e86ab';
    ctx.fillRect(0, 0, this.layer.width, this.layer.height);
    for (let ty = 0; ty < WORLD_ROWS; ty++) {
      for (let tx = 0; tx < WORLD_COLS; tx++) {
        const t = world.tileAt(tx, ty);
        const x = tx * TILE;
        const y = ty * TILE;
        if (t === T_WATER) continue;
        if (t === T_SAND) ctx.fillStyle = '#ecd29a';
        else if (t === T_PARK) ctx.fillStyle = '#7fb069';
        else if (t === T_WALK) ctx.fillStyle = '#b8ad9c';
        else if (t === T_LOT) ctx.fillStyle = '#9a958c';
        else ctx.fillStyle = '#3c414b';
        ctx.fillRect(x, y, TILE, TILE);
        if (t === T_WALK) {
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
        if (t === T_PARK) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 8, y + 8, 5, 5);
          ctx.fillRect(x + 40, y + 34, 5, 5);
        }
      }
    }
    // Lane dashes along every street and avenue centre.
    ctx.fillStyle = '#e8c872';
    for (const cy of world.avenueCentersY()) {
      for (let x = 8; x < (40 - 1) * TILE; x += 46) ctx.fillRect(x, cy - 2, 26, 4);
    }
    ctx.fillStyle = '#dfe6ee';
    for (const cx of world.streetCentersX()) {
      for (let y = 8; y < world.heightPx - 8; y += 46) ctx.fillRect(cx - 2, y, 4, 26);
    }
    // The shoreline: a foam edge where sand meets water.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(43 * TILE - 3, 0, 5, this.layer.height);

    // Buildings: pavement shadow, walls, and a roof lifted toward the sun
    // so the blocks read as solid pastel towers from above.
    for (const b of world.buildings) {
      const lift = 6 + b.floors * 3;
      ctx.fillStyle = 'rgba(30,20,10,0.28)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - lift * 0.4, b.y - lift * 0.4, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x - lift * 0.4, b.y - lift * 0.4, b.w, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      const rows = Math.floor(b.h / 34);
      const cols = Math.floor(b.w / 34);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(b.x - lift * 0.4 + 12 + c * 34, b.y - lift * 0.4 + 12 + r * 34, 15, 10);
        }
      }
      ctx.fillStyle = 'rgba(20,16,8,0.85)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h + 16);
    }
  }

  drawPalm(ctx, palm) {
    const { x, y, s } = palm;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3 * s, y - 4 * s);
    ctx.stroke();
    ctx.strokeStyle = '#2e933c';
    ctx.lineWidth = 2.4 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + s;
      ctx.beginPath();
      ctx.moveTo(x + 3 * s, y - 4 * s);
      ctx.quadraticCurveTo(
        x + 3 * s + Math.cos(a) * 11 * s,
        y - 4 * s + Math.sin(a) * 7 * s - 3,
        x + 3 * s + Math.cos(a) * 17 * s,
        y - 4 * s + Math.sin(a) * 11 * s + 3 * s,
      );
      ctx.stroke();
    }
  }

  drawCar(ctx, car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -CAR_LENGTH / 2 + 2, -CAR_WIDTH / 2 + 3, CAR_LENGTH, CAR_WIDTH, 6);
    ctx.fill();
    const isCop = car.kind === 'cop';
    ctx.fillStyle = isCop ? '#eef1f5' : car.color;
    roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 6);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-8, -CAR_WIDTH / 2, 17, CAR_WIDTH);
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      // Light bar: red and blue halves trading flashes.
      const phase = Math.floor(time * 6 + car.id) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e4d' : '#5a1620';
      ctx.fillRect(-4, -8, 8, 6);
      ctx.fillStyle = phase ? '#16283f' : '#2e7dff';
      ctx.fillRect(-4, 2, 8, 6);
    } else {
      ctx.fillStyle = 'rgba(20,24,32,0.88)';
      roundRect(ctx, -6, -CAR_WIDTH / 2 + 3, 15, CAR_WIDTH - 6, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,210,235,0.75)';
      ctx.fillRect(2, -CAR_WIDTH / 2 + 4, 5, CAR_WIDTH - 8);
      if (car.id % 7 === 0) {
        ctx.fillStyle = '#ffd60a';
        ctx.fillRect(-3, -4, 7, 8);
      }
    }
    // Wheels and headlights.
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-CAR_LENGTH / 2 + 4, -CAR_WIDTH / 2 - 2, 9, 4);
    ctx.fillRect(-CAR_LENGTH / 2 + 4, CAR_WIDTH / 2 - 2, 9, 4);
    ctx.fillRect(CAR_LENGTH / 2 - 13, -CAR_WIDTH / 2 - 2, 9, 4);
    ctx.fillRect(CAR_LENGTH / 2 - 13, CAR_WIDTH / 2 - 2, 9, 4);
    ctx.fillStyle = '#fff6bf';
    ctx.fillRect(CAR_LENGTH / 2 - 1, -CAR_WIDTH / 2 + 2, 2, 4);
    ctx.fillRect(CAR_LENGTH / 2 - 1, CAR_WIDTH / 2 - 6, 2, 4);
    if (car.health < 45) {
      ctx.fillStyle = `rgba(60,60,60,${0.25 + 0.2 * Math.sin(time * 9 + car.id)})`;
      ctx.beginPath();
      ctx.arc(CAR_LENGTH / 2 - 4, 0, 6 + (car.health < 20 ? 5 : 0), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPed(ctx, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.pants;
      ctx.fillRect(-11, -3, 10, 6);
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-1, -4, 10, 8);
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(12, 0, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(ped.legPhase) * 5;
    ctx.strokeStyle = ped.pants;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ped.angle) * swing - Math.sin(ped.angle) * 3, Math.sin(ped.angle) * swing + Math.cos(ped.angle) * 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(ped.angle) * swing + Math.sin(ped.angle) * 3, -Math.sin(ped.angle) * swing - Math.cos(ped.angle) * 3);
    ctx.stroke();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 2.5, Math.sin(ped.angle) * 2.5, 3.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, player, time) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(player.legPhase) * 5.5;
    ctx.strokeStyle = '#1d3557';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(player.angle) * swing - Math.sin(player.angle) * 3, Math.sin(player.angle) * swing + Math.cos(player.angle) * 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(player.angle) * swing + Math.sin(player.angle) * 3, -Math.sin(player.angle) * swing - Math.cos(player.angle) * 3);
    ctx.stroke();
    ctx.fillStyle = '#06d6a0';
    ctx.beginPath();
    ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3, 4.3, 0, Math.PI * 2);
    ctx.fill();
    // The pistol, and its flash on the frames a shot lands.
    const gx = Math.cos(player.angle) * 11;
    const gy = Math.sin(player.angle) * 11;
    ctx.strokeStyle = '#22252b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(player.angle) * 5, Math.sin(player.angle) * 5);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    if (player.muzzle > 0) {
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(gx + Math.cos(player.angle) * 5, gy + Math.sin(player.angle) * 5, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Draw the whole scene. `view` carries the camera and every live list. */
  draw(ctx, view) {
    const { camX, camY, time } = view;
    ctx.fillStyle = '#2e86ab';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-camX, -camY);
    ctx.drawImage(this.layer, camX, camY, VIEW_W, VIEW_H, camX, camY, VIEW_W, VIEW_H);

    const inView = (x, y, pad = 90) => x > camX - pad && x < camX + VIEW_W + pad && y > camY - pad && y < camY + VIEW_H + pad;

    // Water shimmer.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const wy = camY + ((i * 173 + Math.floor(time * 24)) % Math.max(1, VIEW_H));
      const wx = 43 * TILE + 30 + ((i * 389) % 200);
      ctx.beginPath();
      ctx.arc(wx, wy, 13, 0.4, 2.4);
      ctx.stroke();
    }

    // Mission beacon: a pillar of light and a breathing ring.
    const marker = view.missionMarker;
    if (marker) {
      const pulse = 1 + Math.sin(time * 4) * 0.16;
      const grad = ctx.createLinearGradient(0, marker.y - 300, 0, marker.y);
      grad.addColorStop(0, 'rgba(255,214,10,0)');
      grad.addColorStop(1, 'rgba(255,214,10,0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(marker.x - 13, marker.y - 300, 26, 300);
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 30 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const palm of this.world.palms) {
      if (inView(palm.x, palm.y, 40)) this.drawPalm(ctx, palm);
    }
    for (const ped of view.peds) {
      if (inView(ped.x, ped.y, 30)) this.drawPed(ctx, ped);
    }
    for (const car of view.cars) {
      if (inView(car.x, car.y, 70)) this.drawCar(ctx, car, time);
    }
    if (!view.player.driving) this.drawPlayer(ctx, view.player, time);

    // Particles: sparks, smoke, shell casings, floating cash.
    for (const p of view.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'text') {
        ctx.fillStyle = `rgba(46,204,113,${a})`;
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(70,70,70,${a * 0.4})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.kind === 'spark' ? `rgba(255,190,60,${a})` : `rgba(200,30,40,${a})`;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
    ctx.restore();
  }
}
