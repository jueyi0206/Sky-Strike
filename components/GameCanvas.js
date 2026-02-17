
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
} from '../constants.js';
import { audio } from '../services/audioService.js';

const h = React.createElement;

const GameCanvas = ({ level, isPaused, initialScore, initialWeaponLevel, onGameOver, onLevelClear }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const frameCountRef = useRef(0);
  const bossActiveRef = useRef(false);
  const [tilt, setTilt] = useState(0);
  
  const playerRef = useRef({
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

  const enemiesRef = useRef([]);
  const bulletsRef = useRef([]);
  const powerUpsRef = useRef([]);
  const particlesRef = useRef([]);
  const starsRef = useRef([]);
  const cloudsRef = useRef([]);
  const keysPressed = useRef({});

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

  const createExplosion = (x, y, isBoss = false) => {
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
      x: CANVAS_WIDTH / 2 - config.width / 2, y: -config.height,
      width: config.width, height: config.height, speed: config.speed,
      type: 'BOSS', health: config.health + (level - 1) * 100, maxHealth: config.health + (level - 1) * 100,
      fireCooldown: config.fireRate, bulletType: 'BOSS_CIRCLE'
    });
  }, [level]);

  // --- RESTORED ARCADE DRAWING ---
  const drawPropeller = (ctx, x, y, size, color) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate((frameCountRef.current * 0.8) % (Math.PI * 2));
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke();
    ctx.restore();
  };

  const drawExhaust = (ctx, x, y, isPlayer) => {
    const flicker = Math.random() * 10;
    const grad = ctx.createLinearGradient(x, y, x, y + 15 + flicker);
    grad.addColorStop(0, isPlayer ? '#60a5fa' : '#ef4444'); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(x, y + 10, 3, 8 + flicker/2, 0, 0, Math.PI * 2); ctx.fill();
  };

  const drawPlayerPlane = (ctx, p) => {
    const { x, y, width, height } = p;
    const cx = x + width / 2; const cy = y + height / 2;
    ctx.save();
    const bankScale = 1 - Math.abs(tilt) * 0.2;
    ctx.translate(cx, cy); ctx.scale(bankScale, 1); ctx.rotate(tilt * 0.1); ctx.translate(-cx, -cy);
    // Wings
    const wingGrad = ctx.createLinearGradient(x, y, x + width, y);
    wingGrad.addColorStop(0, '#1e3a8a'); wingGrad.addColorStop(0.5, '#3b82f6'); wingGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = wingGrad; ctx.beginPath(); ctx.moveTo(x, y + height * 0.45); ctx.lineTo(x + width, y + height * 0.45);
    ctx.lineTo(x + width * 0.9, y + height * 0.55); ctx.lineTo(x + width * 0.1, y + height * 0.55); ctx.fill();
    // Fuselage
    ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.moveTo(cx, y); ctx.bezierCurveTo(cx - 12, y + 5, cx - 10, y + height, cx, y + height);
    ctx.bezierCurveTo(cx + 10, y + height, cx + 12, y + 5, cx, y); ctx.fill();
    // Propellers
    drawPropeller(ctx, cx - 14, y + 12, 14, 'rgba(255,255,255,0.4)'); drawPropeller(ctx, cx + 14, y + 12, 14, 'rgba(255,255,255,0.4)');
    drawExhaust(ctx, cx - 12, y + height - 5, true); drawExhaust(ctx, cx + 12, y + height - 5, true);
    ctx.restore();
  };

  const drawEnemyPlane = (ctx, e) => {
    const { x, y, width, height, type } = e;
    const cx = x + width / 2;
    ctx.save();
    if (type === 'BOSS') {
      ctx.fillStyle = COLORS.ENEMY_BOSS; ctx.fillRect(x, y + height * 0.4, width, height * 0.25);
      ctx.fillStyle = '#450a0a'; ctx.fillRect(x + width * 0.35, y, width * 0.3, height);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(x, y - 15, width * (e.health/e.maxHealth), 5);
    } else if (type === 'BOMBER') {
      ctx.fillStyle = COLORS.ENEMY_BOMBER; ctx.fillRect(x, y + height * 0.3, width, height * 0.2);
      ctx.fillRect(cx - 10, y, 20, height);
      drawPropeller(ctx, cx - 18, y + 15, 16, 'rgba(255,255,255,0.3)'); drawPropeller(ctx, cx + 18, y + 15, 16, 'rgba(255,255,255,0.3)');
    } else {
      ctx.fillStyle = COLORS[`ENEMY_${type}`] || '#f00';
      ctx.beginPath(); ctx.moveTo(cx, y + height); ctx.lineTo(x, y + height * 0.2); ctx.lineTo(x + width, y + height * 0.2); ctx.fill();
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
      player.fireCooldown = 12;
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    if (!bossActiveRef.current && (player.score - initialScore) >= LEVEL_THRESHOLDS[level-1]) spawnBoss();

    starsRef.current.forEach(s => { s.y += s.speed; if (s.y > CANVAS_HEIGHT) s.y = -10; });
    cloudsRef.current.forEach(c => { c.y += c.speed; if (c.y > CANVAS_HEIGHT + c.size) { c.y = -c.size; c.x = Math.random() * CANVAS_WIDTH; } });

    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.vx; b.y += b.vy; return b.y > -50 && b.y < CANVAS_HEIGHT + 50;
    });

    if (Math.random() < 0.02 && !bossActiveRef.current) {
        const types = ['SCOUT', 'BOMBER', 'ACE'];
        const typeKey = types[Math.floor(Math.random() * types.length)];
        const config = ENEMY_TYPES[typeKey];
        enemiesRef.current.push({
          x: Math.random() * (CANVAS_WIDTH - config.width), y: -config.height,
          width: config.width, height: config.height, speed: config.speed + level * 0.1,
          type: typeKey, health: config.health, maxHealth: config.health, fireCooldown: 60, bulletType: 'NORMAL'
        });
    }

    enemiesRef.current = enemiesRef.current.filter(e => {
      e.y += e.speed;
      if (e.x < player.x + player.width && e.x + e.width > player.x && e.y < player.y + player.height && e.y + e.height > player.y) {
        player.health -= 10; return false;
      }
      return e.y < CANVAS_HEIGHT + 100;
    });

    bulletsRef.current.forEach((b, bIdx) => {
      if (b.isPlayerBullet) {
        enemiesRef.current.forEach((e, eIdx) => {
          if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
            e.health -= b.damage; bulletsRef.current.splice(bIdx, 1);
            if (e.health <= 0) {
              player.score += e.type === 'BOSS' ? 5000 : 100;
              if (e.type === 'BOSS') { createExplosion(e.x + width/2, e.y + height/2, true); bossActiveRef.current = false; onLevelClear(player.score, player.weaponLevel); }
              else createExplosion(e.x, e.y);
              enemiesRef.current.splice(eIdx, 1);
            }
          }
        });
      }
    });

    if (player.health <= 0) onGameOver(player.score);
  }, [level, isPaused, initialScore, onGameOver, onLevelClear, spawnBoss, tilt]);

  const draw = useCallback((ctx) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    starsRef.current.forEach(s => ctx.fillRect(s.x, s.y, s.size, s.size));
    bulletsRef.current.forEach(b => { ctx.fillStyle = b.isPlayerBullet ? '#60a5fa' : '#f87171'; ctx.fillRect(b.x, b.y, b.width, b.height); });
    enemiesRef.current.forEach(e => drawEnemyPlane(ctx, e));
    drawPlayerPlane(ctx, playerRef.current);
  }, []);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    update(); draw(ctx);
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    const handleKeyDown = (e) => { keysPressed.current[e.key] = true; if (e.key === ' ') keysPressed.current[' '] = true; };
    const handleKeyUp = (e) => keysPressed.current[e.key] = false;
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  // HUD and Canvas UI
  return h('div', { className: 'w-full h-full relative' },
    h('canvas', { ref: canvasRef, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, className: 'w-full h-full' }),
    h('div', { className: 'absolute top-2 left-4 flex flex-col pointer-events-none' },
      h('div', { className: 'text-white font-bold text-lg' }, `SCORE: ${playerRef.current.score.toLocaleString()}`),
      h('div', { className: 'w-32 h-2 bg-black/50 border border-white/30 mt-1' },
        h('div', { className: 'h-full bg-green-500 transition-all', style: { width: `${(playerRef.current.health/playerRef.current.maxHealth)*100}%` } })
      )
    )
  );
};

export default GameCanvas;
