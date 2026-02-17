
export type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER' | 'MISSION_BRIEFING' | 'LEVEL_CLEAR' | 'GAME_WIN';

export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  width: number;
  height: number;
  speed: number;
}

export interface Player extends Entity {
  health: number;
  maxHealth: number;
  score: number;
  weaponLevel: number;
  fireCooldown: number;
}

export interface Enemy extends Entity {
  type: 'SCOUT' | 'BOMBER' | 'ACE' | 'BOSS';
  health: number;
  maxHealth: number;
  fireCooldown: number;
  bulletType: 'NORMAL' | 'SPREAD' | 'BOSS_CIRCLE' | 'BOSS_BURST';
  phase?: number;
}

export interface Bullet extends Entity {
  damage: number;
  isPlayerBullet: boolean;
  vx: number;
  vy: number;
}

export interface PowerUp extends Entity {
  type: 'WEAPON' | 'HEALTH' | 'SHIELD';
}

export interface Particle extends Point {
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface GameBriefing {
  title: string;
  description: string;
  difficulty: string;
}
