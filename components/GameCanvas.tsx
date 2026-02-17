
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  PLAYER_WIDTH, 
  PLAYER_HEIGHT, 
  PLAYER_SPEED, 
  PLAYER_START_HEALTH, 
  ENEMY_TYPES,
  COLORS,
  LEVEL_THRESHOLDS
} from '../constants';
import { Player, Enemy, Bullet, PowerUp, Particle } from '../types';
import { audio } from '../services/audioService';

interface GameCanvasProps {
  level: number;
  isPaused: boolean;
  initialScore: number;
  initialWeaponLevel: number;
  onGameOver: (score: number) => void;
  onLevelClear: (score: number, finalWeaponLevel: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ level, isPaused, initialScore, initialWeaponLevel, onGameOver, onLevelClear }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const bossActiveRef = useRef(false);
  const [tilt, setTilt] = useState(0);
  
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: CANVAS_HEIGHT - 120,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: PLAYER_SPEED,
    health: PLAYER_START_HEALTH,
    maxHealth: PLAYER_START_HEALTH,
    score: initialScore,
    weaponLevel: initialWeaponLevel,
    fireCooldown: 0
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<{x: number, y: number, size: number, speed: number}[]>([]);
  const cloudsRef = useRef<{x: number, y: number, size: number, speed: number, opacity: number}[]>([]);
  const keysPressed = useRef<Record<string, boolean>>({});

  useEffect(() => {
    starsRef.current = Array.from({ length: 50 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.5 + 0.2
    }));
    cloudsRef.current = Array.from({ length: 8 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 100 + 100,
      speed: Math.random() * 1.5 + 1.0,
      opacity: Math.random() * 0.15 + 0.05
    }));
  }, []);

  const createExplosion = (x: number, y: number, isBoss: boolean = false) => {
    const count = isBoss ? 60 : 15;
    for (let i = 0; i < count; i++) {
        particlesRef.current.push({
            x: x + (isBoss ? (Math.random() - 0.5) * 80 : 0),
            y: y + (isBoss ? (Math.random() - 0.5) * 50 : 0),
            vx: (Math.random() - 0.5) * (isBoss ? 10 : 5),
            vy: (Math.random() - 0.5) * (isBoss ? 10 : 5),
            life: 1.0,
            color: COLORS.EXPLOSION[Math.floor(Math.random() * COLORS.EXPLOSION.length)]
        });
    }
    audio.playExplosion(isBoss);
  };

  const spawnBoss = useCallback(() => {
    if (bossActiveRef.current) return;
    bossActiveRef.current = true;
    const config = ENEMY_TYPES.BOSS;
    enemiesRef.current.push({
      x: CANVAS_WIDTH / 2 - config.width / 2,
      y: -config.height,
      width: config.width,
      height: config.height,
      speed: config.speed,
      type: 'BOSS',
      health: config.health + (level - 1) * 100,
      maxHealth: config.health + (level - 1) * 100,
      fireCooldown: config.fireRate,
      bulletType: 'BOSS_CIRCLE'
    });
  }, [level]);

  // --- RESTORED DETAILED GRAPHICS ---
  const drawPropeller = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((frameCountRef.current * 0.8) % (Math.PI * 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
    ctx.stroke();
    ctx.restore();
  };

  const drawExhaust = (ctx: CanvasRenderingContext2D, x: number, y: number, isPlayer: boolean) => {
    const flicker = Math.random() * 10;
    const grad = ctx.createLinearGradient(x, y, x, y + 15 + flicker);
    grad.addColorStop(0, isPlayer ? '#60a5fa' : '#ef4444');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 3, 8 + flicker/2, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawPlayerPlane = (ctx: CanvasRenderingContext2D, p: Player) => {
    const { x, y, width, height } = p;
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.save();
    const bankScale = 1 - Math.abs(tilt) * 0.2;
    ctx.translate(cx, cy);
    ctx.scale(bankScale, 1);
    ctx.rotate(tilt * 0.1);
    ctx.translate(-cx, -cy);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx + 10, cy + 20, width/2, height/2, 0, 0, Math.PI*2); ctx.fill();

    drawExhaust(ctx, cx - 12, y + height - 5, true);
    drawExhaust(ctx, cx + 12, y + height - 5, true);

    // Wings
    const wingGrad = ctx.createLinearGradient(x, y, x + width, y);
    wingGrad.addColorStop(0, '#1e3a8a'); wingGrad.addColorStop(0.5, '#3b82f6'); wingGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(x, y + height * 0.45); ctx.lineTo(x + width, y + height * 0.45);
    ctx.lineTo(x + width * 0.9, y + height * 0.55); ctx.lineTo(x + width * 0.1, y + height * 0.55);
    ctx.closePath(); ctx.fill();

    // Fuselage
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.moveTo(cx, y); ctx.bezierCurveTo(cx - 12, y + 5, cx - 10, y + height, cx, y + height);
    ctx.bezierCurveTo(cx + 10, y + height, cx + 12, y + 5, cx, y);
    ctx.fill();
    ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 1; ctx.stroke();

    // Cockpit
    const cockGrad = ctx.createRadialGradient(cx, y + 15, 2, cx, y + 15, 8);
    cockGrad.addColorStop(0, '#fff'); cockGrad.addColorStop(1, '#0891b2');
    ctx.fillStyle = cockGrad;
    ctx.beginPath(); ctx.ellipse(cx, y + 18, 4, 6, 0, 0, Math.PI*2); ctx.fill();

    drawPropeller(ctx, cx - 14, y + 12, 14, 'rgba(255,255,255,0.4)');
    drawPropeller(ctx, cx + 14, y + 12, 14, 'rgba(255,255,255,0.4)');
    ctx.restore();
  };

  const drawEnemyPlane = (ctx: CanvasRenderingContext2D, e: Enemy) => {
    const { x, y, width, height, type } = e;
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.save();
    
    if (type === 'BOSS') {
      ctx.fillStyle = COLORS.ENEMY_BOSS;
      ctx.shadowBlur = 10; ctx.shadowColor = '#000';
      ctx.fillRect(x, y + height * 0.4, width, height * 0.25);
      const bossGrad = ctx.createLinearGradient(x + width*0.3, y, x + width*0.7, y);
      bossGrad.addColorStop(0, '#450a0a'); bossGrad.addColorStop(0.5, COLORS.ENEMY_BOSS); bossGrad.addColorStop(1, '#450a0a');
      ctx.fillStyle = bossGrad; ctx.fillRect(x + width * 0.35, y, width * 0.3, height);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx - width*0.2, y + height*0.5, 10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + width*0.2, y + height*0.5, 10, 0, Math.PI*2); ctx.fill();
      drawExhaust(ctx, cx - 30, y + 10, false); drawExhaust(ctx, cx + 30, y + 10, false);
      ctx.fillStyle = '#222'; ctx.fillRect(x, y - 20, width, 6);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(x, y - 20, width * (e.health/e.maxHealth), 6);
    } else if (type === 'BOMBER') {
      ctx.fillStyle = COLORS.ENEMY_BOMBER;
      ctx.beginPath();
      ctx.moveTo(x, y + height*0.3); ctx.lineTo(x + width, y + height*0.3);
      ctx.lineTo(x + width*0.8, y + height*0.6); ctx.lineTo(x + width*0.2, y + height*0.6);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - 10, y, 20, height);
      drawPropeller(ctx, cx - 18, y + 15, 16, 'rgba(255,255,255,0.3)');
      drawPropeller(ctx, cx + 18, y + 15, 16, 'rgba(255,255,255,0.3)');
    } else {
      const colorKey = `ENEMY_${type}` as keyof typeof COLORS;
      ctx.fillStyle = (COLORS[colorKey] as string) || '#f00';
      ctx.beginPath(); ctx.moveTo(cx, y + height); ctx.lineTo(x, y + height * 0.2); ctx.lineTo(x + width, y + height * 0.2); ctx.closePath(); ctx.fill();
      drawPropeller(ctx, cx, y + height, 12, 'rgba(255,255,255,0.4)');
    }
    ctx.restore();
  };

  const update = useCallback(() => {
    if (isPaused) return;
    frameCountRef.current++;
    const player = playerRef.current;
    
    let targetTilt = 0;
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) { player.x -= player.speed; targetTilt = -1; }
    if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) { player.x += player.speed; targetTilt = 1; }
    if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) player.y -= player.speed;
    if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) player.y += player.speed;
    setTilt(prev => prev + (targetTilt - prev) * 0.1);

    player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, player.y));

    if (keysPressed.current[' '] && player.fireCooldown <= 0) {
      const cx = player.x + player.width / 2; const py = player.y; const bSpeed = 9;
      audio.playShoot();
      if (player.weaponLevel >= 1) bulletsRef.current.push({ x: cx - 2, y: py, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: 0, vy: -bSpeed });
      if (player.weaponLevel >= 2) {
        bulletsRef.current.push({ x: cx - 12, y: py + 10, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: 0, vy: -bSpeed });
        bulletsRef.current.push({ x: cx + 8, y: py + 10, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: 0, vy: -bSpeed });
      }
      if (player.weaponLevel >= 3) {
        bulletsRef.current.push({ x: cx - 18, y: py + 15, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: -1.2, vy: -bSpeed });
        bulletsRef.current.push({ x: cx + 14, y: py + 15, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: 1.2, vy: -bSpeed });
      }
      if (player.weaponLevel >= 4) bulletsRef.current.push({ x: cx - 5, y: py - 5, width: 6, height: 18, speed: bSpeed * 1.1, damage: 2, isPlayerBullet: true, vx: 0, vy: -bSpeed * 1.1 });
      if (player.weaponLevel === 5) {
        bulletsRef.current.push({ x: cx - 25, y: py + 20, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: -2.5, vy: -bSpeed });
        bulletsRef.current.push({ x: cx + 21, y: py + 20, width: 4, height: 14, speed: bSpeed, damage: 1, isPlayerBullet: true, vx: 2.5, vy: -bSpeed });
      }
      player.fireCooldown = 14;
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    if (!bossActiveRef.current && (player.score - initialScore) >= LEVEL_THRESHOLDS[level-1]) spawnBoss();

    starsRef.current.forEach(s => { s.y += s.speed; if (s.y > CANVAS_HEIGHT) s.y = -10; });
    cloudsRef.current.forEach(c => { c.y += c.speed; if (c.y > CANVAS_HEIGHT + c.size) { c.y = -c.size; c.x = Math.random() * CANVAS_WIDTH; } });

    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.vx * 0.9; b.y += b.vy * 0.9;
      return b.y > -50 && b.y < CANVAS_HEIGHT + 50;
    });

    if (Math.random() < 0.018 && !bossActiveRef.current) {
        const types: (keyof typeof ENEMY_TYPES)[] = ['SCOUT', 'BOMBER', 'ACE'];
        const config = ENEMY_TYPES[types[Math.floor(Math.random() * types.length)]];
        enemiesRef.current.push({
          x: Math.random() * (CANVAS_WIDTH - config.width), y: -config.height,
          width: config.width, height: config.height,
          speed: config.speed + (level * 0.15), type: types[Math.floor(Math.random() * types.length)] as any,
          health: config.health, maxHealth: config.health, fireCooldown: Math.random() * config.fireRate,
          bulletType: config === ENEMY_TYPES.BOMBER ? 'SPREAD' : 'NORMAL'
        });
    }

    enemiesRef.current = enemiesRef.current.filter(e => {
      if (e.type === 'BOSS') {
        if (e.y < 80) e.y += e.speed; else e.x += Math.sin(frameCountRef.current / 80) * 1.2;
        if (e.fireCooldown <= 0) {
          const bcx = e.x + e.width / 2; const bcy = e.y + e.height - 20; const bulletCount = 12 + level * 2;
          for (let i = 0; i < bulletCount; i++) {
            const angle = (i / bulletCount) * Math.PI * 2 + (frameCountRef.current * 0.05);
            bulletsRef.current.push({ x: bcx, y: bcy, width: 8, height: 8, speed: 3.5, damage: 15, isPlayerBullet: false, vx: Math.cos(angle) * 2.5, vy: Math.sin(angle) * 2.5 });
          }
          e.fireCooldown = ENEMY_TYPES.BOSS.fireRate + 20;
        }
      } else {
        e.y += e.speed;
        if (e.fireCooldown <= 0) {
          const ecx = e.x + e.width / 2; const ecy = e.y + e.height; const bSpd = 4;
          if (e.bulletType === 'NORMAL') bulletsRef.current.push({ x: ecx - 2, y: ecy, width: 4, height: 12, speed: bSpd, damage: 10, isPlayerBullet: false, vx: 0, vy: bSpd });
          else [-1, 0, 1].forEach(vx => bulletsRef.current.push({ x: ecx - 2, y: ecy, width: 5, height: 12, speed: bSpd, damage: 10, isPlayerBullet: false, vx: vx * 1.0, vy: bSpd }));
          e.fireCooldown = ENEMY_TYPES[e.type].fireRate;
        }
      }
      e.fireCooldown--;
      if (e.x < player.x + player.width && e.x + e.width > player.x && e.y < player.y + player.height && e.y + e.height > player.y) {
        player.health -= e.type === 'BOSS' ? 0.5 : 30;
        if (e.type !== 'BOSS') { createExplosion(e.x + e.width/2, e.y + e.height/2); return false; }
      }
      return e.y < CANVAS_HEIGHT + 100;
    });

    bulletsRef.current.forEach((b, bIdx) => {
      if (b.isPlayerBullet) {
        enemiesRef.current.forEach((e, eIdx) => {
          if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
            e.health -= b.damage; bulletsRef.current.splice(bIdx, 1);
            if (e.health <= 0) {
              player.score += e.type === 'BOSS' ? 5000 : 50;
              if (e.type === 'BOSS') { createExplosion(e.x + e.width/2, e.y + e.height/2, true); bossActiveRef.current = false; onLevelClear(player.score, player.weaponLevel); }
              else {
                createExplosion(e.x + e.width/2, e.y + e.height/2);
                if (Math.random() < 0.15) {
                    const type = Math.random() < 0.7 ? 'WEAPON' : 'HEALTH';
                    powerUpsRef.current.push({ x: e.x, y: e.y, width: 25, height: 25, speed: 1.2, type });
                }
              }
              enemiesRef.current.splice(eIdx, 1);
            }
          }
        });
      } else {
        if (b.x < player.x + player.width && b.x + b.width > player.x && b.y < player.y + player.height && b.y + b.height > player.y) {
          player.health -= b.damage; bulletsRef.current.splice(bIdx, 1);
        }
      }
    });

    powerUpsRef.current = powerUpsRef.current.filter(p => {
      p.y += p.speed;
      if (p.x < player.x + player.width && p.x + p.width > player.x && p.y < player.y + player.height && p.y + p.height > player.y) {
        audio.playPowerup();
        if (p.type === 'WEAPON') player.weaponLevel = Math.min(5, player.weaponLevel + 1);
        if (p.type === 'HEALTH') player.health = Math.min(player.maxHealth, player.health + 50);
        player.score += 100; return false;
      }
      return p.y < CANVAS_HEIGHT;
    });

    particlesRef.current = particlesRef.current.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; return p.life > 0; });
    if (player.health <= 0) { onGameOver(player.score); if (requestRef.current !== null) cancelAnimationFrame(requestRef.current); }
  }, [level, isPaused, initialScore, onGameOver, onLevelClear, spawnBoss, tilt]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGrad.addColorStop(0, '#020617'); skyGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#fff';
    starsRef.current.forEach(s => { ctx.globalAlpha = 0.3; ctx.fillRect(s.x, s.y, s.size, s.size); });
    cloudsRef.current.forEach(c => { ctx.globalAlpha = c.opacity; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(0, c.size), 0, Math.PI*2); ctx.fill(); });
    ctx.globalAlpha = 1.0;

    particlesRef.current.forEach(p => { 
        ctx.globalAlpha = p.life; 
        ctx.fillStyle = p.color; 
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, Math.max(0, 4 * p.life), 0, Math.PI * 2); 
        ctx.fill(); 
    });
    ctx.globalAlpha = 1.0;

    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.isPlayerBullet ? COLORS.PLAYER_BULLET : COLORS.ENEMY_BULLET;
      ctx.shadowBlur = b.isPlayerBullet ? 8 : 4; ctx.shadowColor = ctx.fillStyle as string;
      ctx.fillRect(b.x, b.y, b.width, b.height); ctx.shadowBlur = 0;
    });

    powerUpsRef.current.forEach(p => {
      ctx.fillStyle = p.type === 'WEAPON' ? COLORS.POWERUP_WEAPON : COLORS.POWERUP_HEALTH;
      ctx.beginPath(); ctx.arc(p.x + p.width/2, p.y + p.height/2, Math.max(0, p.width/2), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(p.type === 'WEAPON' ? 'W' : 'H', p.x + p.width/2, p.y + p.height/2 + 4);
    });

    enemiesRef.current.forEach(e => drawEnemyPlane(ctx, e));
    drawPlayerPlane(ctx, playerRef.current);

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = '700 16px "Space Grotesk"'; ctx.textAlign = 'left';
    ctx.fillText(`LV${level} | SCORE: ${playerRef.current.score.toLocaleString()}`, 20, 35);
    const barWidth = 140; const hpX = CANVAS_WIDTH - barWidth - 20;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hpX, 25, barWidth, 14);
    const hpPct = Math.max(0, playerRef.current.health / playerRef.current.maxHealth);
    ctx.fillStyle = hpPct > 0.3 ? '#10b981' : '#ef4444';
    ctx.fillRect(hpX, 25, barWidth * hpPct, 14);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(hpX, 25, barWidth, 14);
    ctx.fillStyle = '#fff'; ctx.font = '700 12px "Space Grotesk"';
    ctx.fillText(`POWER: STAGE ${playerRef.current.weaponLevel}`, 20, 55);
  }, [level, drawPlayerPlane, drawEnemyPlane]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    update(); draw(ctx);
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (!isPaused) { keysPressed.current[e.key] = true; keysPressed.current[' '] = true; } };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current[e.key] = false;
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop, isPaused]);

  return (
    <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full cursor-crosshair touch-none"
      onMouseMove={(e) => {
        if (isPaused) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const targetX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH - PLAYER_WIDTH / 2;
          const targetY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT - PLAYER_HEIGHT / 2;
          playerRef.current.x += (targetX - playerRef.current.x) * 0.15; playerRef.current.y += (targetY - playerRef.current.y) * 0.15;
          setTilt((targetX - playerRef.current.x) * 0.05); keysPressed.current[' '] = true;
        }
      }}
      onMouseDown={() => { if (!isPaused) keysPressed.current[' '] = true; }}
    />
  );
};

export default GameCanvas;
