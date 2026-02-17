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
    starsRef.current = Array.from({ length: 40 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.2
    }));
  }, []);

  const createExplosion = (x, y, isBoss = false) => {
    const count = isBoss ? 50 : 12;
    for (let i = 0; i < count; i++) {
        particlesRef.current.push({
            x: x + (Math.random() - 0.5) * (isBoss ? 60 : 10),
            y: y + (Math.random() - 0.5) * (isBoss ? 60 : 10),
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            color: COLORS.EXPLOSION[Math.floor(Math.random() * COLORS.EXPLOSION.length)]
        });
    }
    audio.playExplosion(isBoss);
  };

  const drawPropeller = (ctx, x, y, size, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((frameCountRef.current * 0.8) % (Math.PI * 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke();
    ctx.restore();
  };

  const drawExhaust = (ctx, x, y, isPlayer) => {
    const flicker = Math.random() * 8;
    const grad = ctx.createLinearGradient(x, y, x, y + 15);
    grad.addColorStop(0, isPlayer ? '#60a5fa' : '#ef4444');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(x, y + 8, 3, 6 + flicker, 0, 0, Math.PI * 2); ctx.fill();
  };

  const drawPlayerPlane = (ctx, p) => {
    const { x, y, width, height } = p;
    const cx = x + width / 2; const cy = y + height / 2;
    ctx.save();
    const bankScale = 1 - Math.abs(tilt) * 0.2;
    ctx.translate(cx, cy); ctx.scale(bankScale, 1); ctx.rotate(tilt * 0.1); ctx.translate(-cx, -cy);
    
    // Wings
    ctx.fillStyle = '#1e40af';
    ctx.beginPath(); ctx.moveTo(x, y + height * 0.4); ctx.lineTo(x + width, y + height * 0.4);
    ctx.lineTo(x + width * 0.8, y + height * 0.6); ctx.lineTo(x + width * 0.2, y + height * 0.6); ctx.fill();
    
    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.ellipse(cx, cy, width/4, height/2, 0, 0, Math.PI * 2); ctx.fill();
    
    drawPropeller(ctx, cx - 12, y + 10, 12, 'rgba(255,255,255,0.4)');
    drawPropeller(ctx, cx + 12, y + 10, 12, 'rgba(255,255,255,0.4)');
    drawExhaust(ctx, cx - 10, y + height - 5, true);
    drawExhaust(ctx, cx + 10, y + height - 5, true);
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
      audio.playShoot();
      bulletsRef.current.push({ x: player.x + player.width/2 - 2, y: player.y, width: 4, height: 12, speed: 9, damage: 1, isPlayerBullet: true, vx: 0, vy: -9 });
      player.fireCooldown = 12;
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    if (Math.random() < 0.02) {
      enemiesRef.current.push({
        x: Math.random() * (CANVAS_WIDTH - 30), y: -40, width: 30, height: 30,
        speed: 2 + level * 0.2, health: 1, type: 'SCOUT'
      });
    }

    enemiesRef.current = enemiesRef.current.filter(e => {
      e.y += e.speed;
      if (Math.abs(e.x - player.x) < 30 && Math.abs(e.y - player.y) < 30) { player.health -= 20; createExplosion(e.x, e.y); return false; }
      return e.y < CANVAS_HEIGHT + 50;
    });

    bulletsRef.current = bulletsRef.current.filter(b => {
      b.y += b.vy;
      let hit = false;
      if (b.isPlayerBullet) {
        enemiesRef.current.forEach(e => {
          if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
            e.health -= b.damage; hit = true;
            if (e.health <= 0) { player.score += 100; createExplosion(e.x + e.width/2, e.y + e.height/2); }
          }
        });
      }
      return !hit && b.y > -20 && b.y < CANVAS_HEIGHT + 20;
    });
    enemiesRef.current = enemiesRef.current.filter(e => e.health > 0);

    if (player.health <= 0) onGameOver(player.score);
  }, [level, isPaused, onGameOver]);

  const draw = useCallback((ctx) => {
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    starsRef.current.forEach(s => { s.y += s.speed; if (s.y > CANVAS_HEIGHT) s.y = -10; ctx.fillRect(s.x, s.y, s.size, s.size); });
    
    bulletsRef.current.forEach(b => { ctx.fillStyle = '#60a5fa'; ctx.fillRect(b.x, b.y, b.width, b.height); });
    enemiesRef.current.forEach(e => {
       ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(e.x + e.width/2, e.y + e.height); ctx.lineTo(e.x, e.y); ctx.lineTo(e.x + e.width, e.y); ctx.fill();
    });
    
    drawPlayerPlane(ctx, playerRef.current);
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
      return p.life > 0;
    });
    ctx.globalAlpha = 1.0;
  }, []);

  const loop = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { update(); draw(ctx); }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    const kd = (e) => { keysPressed.current[e.key] = true; keysPressed.current[' '] = true; };
    const ku = (e) => keysPressed.current[e.key] = false;
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    requestRef.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  return h('div', { className: 'w-full h-full relative' },
    h('canvas', { ref: canvasRef, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, className: 'w-full h-full' }),
    h('div', { className: 'absolute top-4 left-4 pointer-events-none' },
      h('div', { className: 'text-white font-bold' }, `SCORE: ${playerRef.current.score}`),
      h('div', { className: 'w-32 h-2 bg-red-900 mt-1 border border-white/20' },
        h('div', { className: 'h-full bg-green-500', style: { width: `${(playerRef.current.health/playerRef.current.maxHealth)*100}%` } })
      )
    )
  );
};

export default GameCanvas;