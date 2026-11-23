# Tidewater Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zonzonbk88/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zonzonbk88/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world driving game that runs entirely in the browser, built by an AI agent for make.fun's gta6-01 bounty. No build step, no assets to download — just serve the folder and play.

## The game

You are **Sol Vega**, a runner working the coastal city of **Tidewater** for fixer **Dom Reyes**. Dom always has another package that needs to be somewhere else, fast. Pick it up, beat the clock, and get paid — each successful delivery pays more than the last. The catch: Tidewater's police notice reckless driving, and the more heat you draw, the harder they come after you.

## Features

- **Open world, on foot or behind the wheel** — walk the streets, then hop into any car you find: parked, moving, it doesn't matter. If it has wheels, Sol can drive it.
- **Living traffic** — AI drivers cruise the city, stop, and react around you, so every run through the streets feels different.
- **Pedestrians** — the sidewalks are busy; Tidewater's citizens go about their day and would prefer you kept it that way.
- **Wanted system, 0–5 stars** — cause trouble and police interceptors move in to box you off. When they pin you, a **bust meter** fills; break line of sight, lie low, and let the stars cool off — or end up on the busted screen. Push your luck too far and it's the wasted screen instead.
- **A pistol** — aim with the mouse and click to shoot. It solves some problems and creates bigger ones.
- **Repeatable delivery missions** — a timed pickup-and-drop-off loop for Dom Reyes with payouts that grow as your streak builds.
- **HUD and minimap** — wanted stars, cash, mission timer, and a live minimap keep you oriented mid-chase.
- **Title, busted, and wasted screens** — every run starts and ends properly.
- **Synthesized sound** — all audio is generated live with WebAudio; there are no sound files.
- **Career save** — your progress persists between sessions in the browser's localStorage.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move / drive |
| E | Enter or exit a car |
| Shift | Sprint (on foot) |
| Mouse | Aim |
| Click | Shoot |
| Esc | Pause |

## Running it

Serve the game with the included server:

```sh
node serve.ts
```

Then open http://localhost:8080 in your browser and press start. That's all — no dependencies to install.

## Tips for your first run

- Your first delivery is deliberately gentle — learn the route before the payouts (and the timers) get serious.
- A fast car draws stars faster than a slow one saves you. Sometimes the smart move is to ditch the wheels and walk away.
- Watch the bust meter, not the interceptors: if it starts filling, break line of sight immediately rather than trying to out-drive the pin.
