
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 800;

// Speed scaled down even further for better accessibility
export const PLAYER_SPEED = 3.5; 
export const PLAYER_WIDTH = 44;
export const PLAYER_HEIGHT = 44;
export const PLAYER_START_HEALTH = 250; // Increased health

export const ENEMY_TYPES = {
  SCOUT: { width: 32, height: 32, speed: 1.8, health: 1, fireRate: 120 },
  BOMBER: { width: 60, height: 50, speed: 0.8, health: 8, fireRate: 180 },
  ACE: { width: 42, height: 42, speed: 2.2, health: 4, fireRate: 80 },
  BOSS: { width: 180, height: 120, speed: 0.6, health: 120, fireRate: 50 }
};

export const COLORS = {
  PLAYER: '#3b82f6',
  ENEMY_SCOUT: '#ef4444',
  ENEMY_BOMBER: '#991b1b',
  ENEMY_ACE: '#f59e0b',
  ENEMY_BOSS: '#7f1d1d',
  PLAYER_BULLET: '#60a5fa',
  ENEMY_BULLET: '#fca5a5',
  POWERUP_WEAPON: '#fbbf24',
  POWERUP_HEALTH: '#10b981',
  POWERUP_SHIELD: '#8b5cf6',
  EXPLOSION: ['#f59e0b', '#ef4444', '#7f1d1d']
};

export const LEVEL_THRESHOLDS = [1500, 4000, 8000]; // Slightly lowered score thresholds
