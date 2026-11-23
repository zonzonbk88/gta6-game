// Tidewater Heat — the hand-in program for the gta6-01 bounty (Node 22,
// standard library only, no build step).
//
// The game itself is the static site in game/: index.html plus ES modules,
// playable offline in a desktop browser. This program copies game/ and
// screenshots/ into the output directory and writes dossier.json there
// with the kit's vendored buildDossier, passing the gate's own caps so a
// tree the scorer would refuse fails here first instead of at grading.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, mirrored so this program refuses exactly what the
// scorer refuses: dossier text budget, screenshot count and size, and
// the game tree's file count, byte total and path length.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });

const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), shotsDir, { recursive: true });
}

const dossier = buildDossier(outDir, GATE_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
