// The HUD and the screens around the game: cash and wanted stars, health
// and speed, the bust meter, mission prompts and subtitles, the minimap
// with its blips, and the title / busted / wasted / paused panels.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, GAME_TITLE, HERO_NAME, CITY_NAME } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd60a';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,214,10,0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

export class Hud {
  draw(ctx, s) {
    // Cash and job count, top left.
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    roundRect(ctx, 16, 14, 218, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${s.cash.toLocaleString('en-US')}`, 30, 46);
    ctx.fillStyle = '#e8edf2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Deliveries done: ${s.jobs}`, 30, 68);

    // Wanted stars, top right — flash while the heat is fresh.
    const flash = s.heatFresh && Math.floor(s.time * 5) % 2 === 0;
    for (let i = 0; i < 5; i++) {
      star(ctx, VIEW_W - 34 - i * 34, 36, 13, i < s.stars && !flash);
    }

    // Health and, when driving, the car's health and speed, bottom left.
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    roundRect(ctx, 16, VIEW_H - 84, 218, 68, 10);
    ctx.fill();
    ctx.fillStyle = '#e8edf2';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(s.driving ? 'SOL — IN CAR' : 'SOL — ON FOOT', 30, VIEW_H - 60);
    ctx.fillStyle = '#3a4350';
    ctx.fillRect(30, VIEW_H - 50, 150, 10);
    ctx.fillStyle = s.health > 30 ? '#e63946' : '#ff5964';
    ctx.fillRect(30, VIEW_H - 50, 150 * Math.max(0, s.health) / 100, 10);
    if (s.driving) {
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText(`${Math.round(Math.abs(s.speed) * 0.36)}`, 188, VIEW_H - 32);
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('km/h', 190, VIEW_H - 20);
      ctx.fillStyle = '#3a4350';
      ctx.fillRect(30, VIEW_H - 34, 150, 6);
      ctx.fillStyle = '#90e0ef';
      ctx.fillRect(30, VIEW_H - 34, 150 * Math.max(0, s.carHealth) / 100, 6);
    }

    // Bust meter, centre top, only while it is filling.
    if (s.bust > 1) {
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      roundRect(ctx, VIEW_W / 2 - 130, 16, 260, 34, 9);
      ctx.fill();
      ctx.fillStyle = '#e8edf2';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED METER', VIEW_W / 2, 30);
      ctx.fillStyle = '#3a4350';
      ctx.fillRect(VIEW_W / 2 - 110, 36, 220, 7);
      ctx.fillStyle = '#2e7dff';
      ctx.fillRect(VIEW_W / 2 - 110, 36, 220 * Math.min(100, s.bust) / 100, 7);
      ctx.textAlign = 'left';
    }

    // Mission banner: objective, distance, and the clock on a delivery.
    if (s.missionLabel) {
      ctx.fillStyle = 'rgba(10,14,20,0.55)';
      roundRect(ctx, VIEW_W / 2 - 240, VIEW_H - 118, 480, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      let label = `${s.missionLabel}   ·   ${Math.round(s.missionDist)} m`;
      if (s.missionTimer !== null) label += `   ·   ${Math.max(0, Math.ceil(s.missionTimer))}s`;
      ctx.fillText(label, VIEW_W / 2, VIEW_H - 92);
      ctx.textAlign = 'left';
    }

    // Context prompt ("Press E to drive").
    if (s.prompt) {
      ctx.fillStyle = 'rgba(10,14,20,0.65)';
      roundRect(ctx, VIEW_W / 2 - 150, VIEW_H - 168, 300, 34, 9);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.prompt, VIEW_W / 2, VIEW_H - 146);
      ctx.textAlign = 'left';
    }

    // Dom's voice: the story subtitle along the bottom.
    if (s.subtitle) {
      ctx.font = 'italic 16px system-ui, sans-serif';
      const w = Math.min(760, ctx.measureText(s.subtitle).width + 44);
      ctx.fillStyle = 'rgba(8,10,14,0.72)';
      roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 62, w, 34, 9);
      ctx.fill();
      ctx.fillStyle = '#ffe8a3';
      ctx.textAlign = 'center';
      ctx.fillText(s.subtitle, VIEW_W / 2, VIEW_H - 40);
      ctx.textAlign = 'left';
    }

    this.drawMinimap(ctx, s);
  }

  drawMinimap(ctx, s) {
    const size = 186;
    const x0 = VIEW_W - size - 16;
    const y0 = VIEW_H - size - 16;
    const sx = size / WORLD_W;
    const sy = size / WORLD_H;
    ctx.save();
    roundRect(ctx, x0, y0, size, size, 10);
    ctx.clip();
    ctx.fillStyle = '#274b63';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#8a8378';
    for (const b of s.buildings) {
      ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    ctx.fillStyle = '#ecd29a';
    ctx.fillRect(x0 + 40 * 64 * sx, y0, size - 40 * 64 * sx, size);
    if (s.missionPos) {
      const pulse = 3.4 + Math.sin(s.time * 5) * 1.2;
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(x0 + s.missionPos.x * sx, y0 + s.missionPos.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of s.cops) {
      ctx.fillStyle = Math.floor(s.time * 4 + cop.id) % 2 ? '#ff2e4d' : '#2e7dff';
      ctx.fillRect(x0 + cop.x * sx - 2.4, y0 + cop.y * sy - 2.4, 4.8, 4.8);
    }
    for (const ped of s.peds) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x0 + ped.x * sx - 1, y0 + ped.y * sy - 1, 2, 2);
    }
    // The player: a white arrow that turns with them.
    const px = x0 + s.playerPos.x * sx;
    const py = y0 + s.playerPos.y * sy;
    ctx.translate(px, py);
    ctx.rotate(s.playerAngle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6.4, 0);
    ctx.lineTo(-4.4, -4);
    ctx.lineTo(-4.4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, x0, y0, size, size, 10);
    ctx.stroke();
  }

  drawTitle(ctx, s) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, 'rgba(38,16,54,0.62)');
    grad.addColorStop(0.55, 'rgba(120,40,60,0.45)');
    grad.addColorStop(1, 'rgba(16,20,34,0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText(GAME_TITLE, VIEW_W / 2, 208);
    ctx.fillStyle = '#ffffff';
    ctx.font = '21px system-ui, sans-serif';
    ctx.fillText(`${HERO_NAME} runs the packages nobody else will touch — all over ${CITY_NAME}.`, VIEW_W / 2, 252);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#ffe8a3';
    ctx.fillText('Steal cars. Beat the clock. Outrun the Tidewater PD.', VIEW_W / 2, 282);

    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    roundRect(ctx, VIEW_W / 2 - 300, 330, 600, 208, 14);
    ctx.fill();
    ctx.fillStyle = '#e8edf2';
    ctx.font = '16px system-ui, sans-serif';
    const lines = [
      'WASD / Arrows — walk and drive      Shift — sprint',
      'E — get in / out of a car      Mouse — aim, click — fire',
      'Follow the gold beacon: pick up, deliver, get paid.',
      'Crimes raise your stars. Lose the cops to cool off.',
      'P — pause      M — sound on/off',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 372 + i * 30));
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 19px system-ui, sans-serif';
    if (s.savedCash > 0) ctx.fillText(`Saved career: $${s.savedCash.toLocaleString('en-US')} · ${s.savedJobs} deliveries`, VIEW_W / 2, 532);
    ctx.fillStyle = Math.floor(s.time * 2) % 2 ? '#ffffff' : '#ffd60a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY', VIEW_W / 2, 606);
    ctx.textAlign = 'left';
  }

  drawEndScreen(ctx, kind, s) {
    ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,50,0.72)' : 'rgba(50,8,8,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'busted' ? '#7db4ff' : '#ff5964';
    ctx.font = 'bold 88px system-ui, sans-serif';
    ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(
      kind === 'busted' ? `The PD impound your ride and fine you $${s.fine}.` : `You wake up outside Clínica Santa Mar, $${s.fine} lighter.`,
      VIEW_W / 2,
      348,
    );
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.fillText('PRESS R TO GET BACK TO WORK', VIEW_W / 2, 420);
    ctx.textAlign = 'left';
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(8,10,16,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('P or Esc to keep driving', VIEW_W / 2, VIEW_H / 2 + 36);
    ctx.textAlign = 'left';
  }
}
