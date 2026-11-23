// Tidewater Heat — shared tuning constants.
// One place for the numbers every other module reads: world geometry, the
// street grid pitch, speeds, heat values and the save-game key.

export const TILE = 64;                 // pixels per city tile
export const WORLD_COLS = 45;           // tiles across (x)
export const WORLD_ROWS = 40;           // tiles down (y)
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;

export const BLOCK = 5;                 // building tiles per block side
export const ROAD = 2;                  // road tiles between blocks
export const PITCH = BLOCK + ROAD;      // tiles from one street to the next
export const BEACH_COL = 40;            // first sand column; water follows

export const VIEW_W = 1280;             // canvas design width
export const VIEW_H = 720;              // canvas design height

export const PLAYER_RADIUS = 13;
export const PLAYER_WALK = 148;         // px per second on foot
export const PLAYER_SPRINT = 238;

export const CAR_LENGTH = 46;
export const CAR_WIDTH = 22;
export const CAR_RADIUS = 21;           // collision circle for every vehicle
export const TRAFFIC_SPEED = 128;
export const COP_SPEED = 252;           // top speed of a police interceptor
export const PLAYER_CAR_SPEED = 318;    // top speed of a player-driven car

export const HEAT_PER_STAR = 34;        // heat points per wanted star
export const MAX_STARS = 5;
export const HEAT_DECAY = 1.5;          // heat lost per second while unseen
export const BUST_RANGE = 118;          // how close a cop must be to bust
export const BUST_RATE = 26;            // bust meter per second in range

export const SAVE_KEY = 'tidewater-heat-save-v1';

export const CITY_NAME = 'Tidewater';
export const GAME_TITLE = 'TIDEWATER HEAT';
export const HERO_NAME = 'Marisol "Sol" Vega';
export const FIXER_NAME = 'Dom Reyes';
export const GARAGE_NAME = 'Reyes Auto & Salvage';
