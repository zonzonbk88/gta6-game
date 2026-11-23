// Screenshot scenes: the entry's pictures are taken from the real game by
// opening it with ?shot=<name>&seed=<n>. Each scene arranges the live
// simulation — the player's car, the police, the mission state — into a
// moment that shows several systems at once, then the main loop freezes
// and flags window.__shotReady for the camera.

import { Car } from './vehicles.js';

export function readShotRequest() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name) return null;
  return { name, seed: Number(params.get('seed') || 1) };
}

function givePlayerCar(g, x, y, angle, speed, color) {
  const car = new Car(x, y, angle, color, 'traffic');
  car.speed = speed;
  g.traffic.cars.push(car);
  g.player.enterCar(car);
  return car;
}

function addCop(g, x, y, angle, speed) {
  const cop = new Car(x, y, angle, '#f5f6fa', 'cop');
  cop.driver = 'police';
  cop.speed = speed;
  g.police.cars.push(cop);
  return cop;
}

export function applyShotScene(g, name) {
  const world = g.world;
  const streets = world.streetCentersX();
  const avenues = world.avenueCentersY();
  g.state = 'playing';

  if (name === 'chase') {
    // The cover: a three-star chase down the second avenue, package aboard.
    const cy = avenues[1] + 32;
    givePlayerCar(g, 900, cy, 0, 238, '#e63946');
    addCop(g, 700, cy - 26, 0, 232);
    addCop(g, 610, cy + 40, 0, 226);
    addCop(g, 520, cy - 6, 0, 220);
    g.heat = 112;
    g.missions.phase = 'deliver';
    g.missions.marker = { x: 2050, y: cy, label: 'DELIVER — Hotel Marbella', building: null };
    g.missions.timer = 41;
    g.missions.timeLimit = 60;
    g.missions.say('Dom: They\'re on you, Sol — lose them or lose the package!', 30);
  } else if (name === 'foot') {
    // Downtown on foot: Sol among the lunch crowd, gun holstered, palms up.
    g.player.x = streets[2] - 84;
    g.player.y = avenues[1] - 70;
    g.player.angle = 0.7;
    g.missions.say('Dom: On foot today. The garage is two blocks west when you\'re ready.', 30);
  } else if (name === 'mission') {
    // At the garage with the package loaded and the clock running.
    const f = world.garageFront;
    givePlayerCar(g, f.x + 26, f.y + 10, 0, 12, '#2a9d8f');
    g.heat = 36;
    addCop(g, f.x - 260, f.y + 120, 0.5, 60);
    g.missions.setDropoff(g.player.pos());
    g.missions.timer = 52;
  } else if (name === 'beach') {
    // The coast run: sand and water east, one interceptor closing in.
    const cx = streets[streets.length - 1] - 32;
    givePlayerCar(g, cx, 860, Math.PI / 2, 205, '#f4a261');
    addCop(g, cx - 8, 640, Math.PI / 2, 198);
    g.heat = 74;
    g.missions.say('Dom: Down the coast road, Sol — and shake that interceptor.', 30);
    g.missions.phase = 'deliver';
    g.missions.marker = { x: cx, y: 1560, label: 'DELIVER — Hotel Sirena', building: null };
    g.missions.timer = 33;
    g.missions.timeLimit = 48;
  } else {
    // 'start' and anything else: a clean opening frame by the garage.
    g.player.x = world.playerStart.x;
    g.player.y = world.playerStart.y;
    g.player.angle = -0.4;
  }
}
