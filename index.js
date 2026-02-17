
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const h = React.createElement;

// --- 1. 常數定義 (Constants) ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 800;
// 降低整體速度
const PLAYER_SPEED = 3.2; 
const PLAYER_WIDTH = 44;
const PLAYER_HEIGHT = 44;
const PLAYER_START_HEALTH = 250;

const ENEMY_TYPES = {
  SCOUT: { width: 32, height: 32, speed: 1.2, health: 1, fireRate: 140 },
  BOMBER: { width: 64, height: 48, speed: 0.5, health: 12, fireRate: 210 },
  ACE: { width: 40, height: 40, speed: 1.7, health: 5, fireRate: 100 },
  BOSS: { width: 180, height: 120, speed: 0.3, health: 160, fireRate: 70 }
};

const COLORS = {
  PLAYER: '#3b82f6',
  ENEMY_SCOUT: '#ef4444',
  ENEMY_BOMBER: '#7f1d1d',
  ENEMY_ACE: '#f97316',
  ENEMY_BOSS: '#450a0a',
  PLAYER_BULLET: '#60a5fa',
  ENEMY_BULLET: '#f87171',
  POWERUP_WEAPON: '#fbbf24',
  POWERUP_HEALTH: '#10b981',
  EXPLOSION: ['#f59e0b', '#ef4444', '#7f1d1d']
};

const LEVEL_THRESHOLDS = [1500, 4500, 9500];

// --- 2. 音效服務 ---
class AudioService {
  constructor() {
    this.ctx = null;
    this.bgmGain = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  playShoot() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(450, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.08);
  }
  playExplosion(isBoss = false) {
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * (isBoss ? 1.2 : 0.25);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBoss ? 600 : 300, this.ctx.currentTime);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isBoss ? 0.3 : 0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (isBoss ? 1.2 : 0.25));
    noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    noise.start();
  }
  playPowerup() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }
  startBGM() {
    this.init();
    if (!this.ctx) return;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.02;
    this.bgmGain.connect(this.ctx.destination);
    const interval = setInterval(() => {
      if (!this.ctx || !this.bgmGain) return;
      const osc = this.ctx.createOscillator();
      const freq = [65, 65, 73, 55][Math.floor(Date.now() / 600) % 4];
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.04, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(); osc.stop(this.ctx.currentTime + 0.6);
    }, 600);
    return () => { clearInterval(interval); if (this.bgmGain) this.bgmGain.disconnect(); };
  }
}
const audio = new AudioService();

// --- 3. Gemini 服務 ---
async function getMissionBriefing(level) {
  const defaults = [
    { title: "太平洋黎明", description: "突破敵軍第一道海上防線，確保後續登陸。", difficulty: "普通" },
    { title: "鋼鐵峽谷", description: "滲透山脈基地，摧毀敵方的秘密武器工廠。", difficulty: "困難" },
    { title: "最終審判", description: "直搗敵軍首部總部。為了自由，在此一搏。", difficulty: "極限" }
  ];
  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  if (!apiKey) return defaults[level - 1] || defaults[0];
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a dramatic short mission briefing for Level ${level} of a 1945 style airplane shooter. Level 1: Sea. Level 2: Mountain. Level 3: City. Use Traditional Chinese.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            difficulty: { type: Type.STRING }
          },
          required: ["title", "description", "difficulty"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) { return defaults[level - 1] || defaults[0]; }
}

// --- 4. 遊戲畫布組件 ---
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
      speed: Math.random() * 0.3 + 0.1
    }));
    cloudsRef.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 80 + 80,
      speed: Math.random() * 0.5 + 0.4,
      opacity: Math.random() * 0.1 + 0.05
    }));
  }, []);

  const createExplosion = (x, y, isBoss = false) => {
    const count = isBoss ? 60 : 15;
    for (let i = 0; i < count; i++) {
        particlesRef.current.push({
            x: x + (Math.random() - 0.5) * (isBoss ? 80 : 10),
            y: y + (Math.random() - 0.5) * (isBoss ? 80 : 10),
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color: COLORS.EXPLOSION[Math.floor(Math.random() * COLORS.EXPLOSION.length)]
        });
    }
    audio.playExplosion(isBoss);
  };

  const drawExhaust = (ctx, x, y, isPlayer) => {
    const flicker = Math.random() * 8;
    const grad = ctx.createLinearGradient(x, y, x, y + 10);
    grad.addColorStop(0, isPlayer ? '#60a5fa' : '#ef4444');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(x, y + 6, 2, 4 + flicker, 0, 0, Math.PI * 2); ctx.fill();
  };

  const drawPropeller = (ctx, x, y, size, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((frameCountRef.current * 0.6) % (Math.PI * 2));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke();
    ctx.restore();
  };

  const drawPlayerPlane = (ctx, p) => {
    const { x, y, width, height } = p;
    const cx = x + width / 2; const cy = y + height / 2;
    ctx.save();
    const bankScale = 1 - Math.abs(tilt) * 0.25;
    ctx.translate(cx, cy); ctx.scale(bankScale, 1); ctx.rotate(tilt * 0.12); ctx.translate(-cx, -cy);
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath(); ctx.moveTo(x, y + height * 0.45); ctx.lineTo(x + width, y + height * 0.45);
    ctx.lineTo(x + width * 0.85, y + height * 0.6); ctx.lineTo(x + width * 0.15, y + height * 0.6); ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.ellipse(cx, cy, width/4.5, height/2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath(); ctx.ellipse(cx, y + height*0.3, 4, 6, 0, 0, Math.PI*2); ctx.fill();
    drawPropeller(ctx, cx - 12, y + 10, 13, 'rgba(255,255,255,0.4)');
    drawPropeller(ctx, cx + 12, y + 10, 13, 'rgba(255,255,255,0.4)');
    drawExhaust(ctx, cx - 10, y + height - 5, true);
    drawExhaust(ctx, cx + 10, y + height - 5, true);
    ctx.restore();
  };

  const drawEnemyPlane = (ctx, e) => {
    const { x, y, width, height, type } = e;
    const cx = x + width / 2;
    ctx.save();
    if (type === 'BOSS') {
      ctx.fillStyle = COLORS.ENEMY_BOSS;
      ctx.fillRect(cx - width*0.15, y, width*0.3, height);
      ctx.fillRect(x, y + height * 0.4, width, height * 0.2);
      ctx.fillRect(x + width * 0.2, y + height * 0.1, width * 0.6, height * 0.1);
      ctx.fillStyle = '#111'; ctx.fillRect(cx - 10, y + height*0.2, 20, 15);
      drawExhaust(ctx, cx - 40, y + 10, false); drawExhaust(ctx, cx + 40, y + 10, false);
    } else if (type === 'BOMBER') {
      ctx.fillStyle = COLORS.ENEMY_BOMBER;
      ctx.fillRect(x, y + height * 0.35, width, 8);
      ctx.fillRect(cx - 18, y, 8, height); ctx.fillRect(cx + 10, y, 8, height);
      ctx.fillRect(cx - 20, y + height - 6, 40, 4);
      drawPropeller(ctx, cx - 14, y + 10, 14, 'rgba(255,255,255,0.3)');
      drawPropeller(ctx, cx + 14, y + 10, 14, 'rgba(255,255,255,0.3)');
    } else if (type === 'ACE') {
      ctx.fillStyle = COLORS.ENEMY_ACE;
      ctx.beginPath(); ctx.moveTo(cx, y + height); ctx.lineTo(x, y + height * 0.2); ctx.lineTo(x + width, y + height * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillRect(x, y + height * 0.2, width, 6);
      drawPropeller(ctx, cx, y + height, 12, 'rgba(255,255,255,0.4)');
    } else {
      ctx.fillStyle = COLORS.ENEMY_SCOUT;
      ctx.fillRect(cx - 4, y, 8, height); ctx.fillRect(x, y + height * 0.3, width, 4);
      ctx.fillRect(cx - 10, y + height - 4, 20, 2);
      drawPropeller(ctx, cx, y + height, 10, 'rgba(255,255,255,0.4)');
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

    // --- 武器 5 階進化邏輯 ---
    if (player.fireCooldown <= 0) {
      audio.playShoot();
      const cx = player.x + player.width/2;
      const bSpeed = 7.5;
      let cooldown = 17; 
      
      const addBullet = (offX, offY, vx, vy, dmg = 1, color = COLORS.PLAYER_BULLET) => {
        bulletsRef.current.push({ x: cx + offX - 2, y: player.y + offY, width: 4, height: 14, damage: dmg, isPlayerBullet: true, vx, vy, color });
      };

      if (player.weaponLevel === 1) {
        addBullet(0, 0, 0, -bSpeed);
      } else if (player.weaponLevel === 2) {
        addBullet(-10, 10, 0, -bSpeed);
        addBullet(10, 10, 0, -bSpeed);
      } else if (player.weaponLevel === 3) {
        addBullet(0, 0, 0, -bSpeed);
        addBullet(-16, 12, -1.6, -bSpeed);
        addBullet(16, 12, 1.6, -bSpeed);
        cooldown = 15;
      } else if (player.weaponLevel === 4) {
        addBullet(-6, 0, 0, -bSpeed, 1.5);
        addBullet(6, 0, 0, -bSpeed, 1.5);
        addBullet(-28, 15, -2.8, -bSpeed * 0.9, 1, '#22d3ee');
        addBullet(28, 15, 2.8, -bSpeed * 0.9, 1, '#22d3ee');
        cooldown = 13;
      } else if (player.weaponLevel >= 5) {
        // 滿級：覆蓋螢幕的彈幕 + 提速
        addBullet(0, -6, 0, -bSpeed * 1.2, 2.2, '#fbbf24');
        addBullet(-14, 6, -0.6, -bSpeed);
        addBullet(14, 6, 0.6, -bSpeed);
        addBullet(-30, 15, -3, -bSpeed * 0.9, 1, '#22d3ee');
        addBullet(30, 15, 3, -bSpeed * 0.9, 1, '#22d3ee');
        addBullet(-48, 28, -5, -bSpeed * 0.8, 1, '#6366f1');
        addBullet(48, 28, 5, -bSpeed * 0.8, 1, '#6366f1');
        cooldown = 9; 
      }
      player.fireCooldown = cooldown;
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    if (!bossActiveRef.current && Math.random() < 0.012) {
      const types = ['SCOUT', 'BOMBER', 'ACE'];
      const type = types[Math.floor(Math.random() * types.length)];
      const cfg = ENEMY_TYPES[type];
      enemiesRef.current.push({
        x: Math.random() * (CANVAS_WIDTH - cfg.width), y: -cfg.height, 
        width: cfg.width, height: cfg.height, speed: cfg.speed + level * 0.1, 
        health: cfg.health, maxHealth: cfg.health, type, fireCooldown: Math.random() * cfg.fireRate
      });
    }

    if (!bossActiveRef.current && (player.score - initialScore) >= LEVEL_THRESHOLDS[level-1]) {
      bossActiveRef.current = true;
      const bCfg = ENEMY_TYPES.BOSS;
      enemiesRef.current.push({
        x: CANVAS_WIDTH / 2 - bCfg.width / 2, y: -bCfg.height, 
        width: bCfg.width, height: bCfg.height, speed: bCfg.speed, 
        health: bCfg.health + (level - 1) * 80, maxHealth: bCfg.health + (level - 1) * 80, 
        type: 'BOSS', fireCooldown: 60
      });
    }

    enemiesRef.current = enemiesRef.current.filter(e => {
      if (e.type === 'BOSS') {
        if (e.y < 80) e.y += e.speed; else e.x += Math.sin(frameCountRef.current / 80) * 1.1;
        if (e.fireCooldown <= 0) {
            const bcx = e.x + e.width/2; const bcy = e.y + e.height;
            for(let i=0; i<10; i++) {
                const angle = (i/10) * Math.PI * 2 + (frameCountRef.current * 0.03);
                bulletsRef.current.push({ x: bcx, y: bcy, width: 8, height: 8, isPlayerBullet: false, vx: Math.cos(angle)*2, vy: Math.sin(angle)*2, color: COLORS.ENEMY_BULLET });
            }
            e.fireCooldown = ENEMY_TYPES.BOSS.fireRate;
        }
      } else {
        e.y += e.speed;
        if (e.fireCooldown <= 0) {
           bulletsRef.current.push({ x: e.x + e.width/2, y: e.y + e.height, width: 5, height: 10, isPlayerBullet: false, vx: 0, vy: 3.2, color: COLORS.ENEMY_BULLET });
           e.fireCooldown = ENEMY_TYPES[e.type].fireRate;
        }
      }
      e.fireCooldown--;
      if (Math.abs(e.x + e.width/2 - (player.x + player.width/2)) < (e.width + player.width)/3 && 
          Math.abs(e.y + e.height/2 - (player.y + player.height/2)) < (e.height + player.height)/3) {
        player.health -= 25; createExplosion(e.x + e.width/2, e.y + e.height/2); return false;
      }
      return e.y < CANVAS_HEIGHT + 100;
    });

    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.vx; b.y += b.vy;
      let hit = false;
      if (b.isPlayerBullet) {
        enemiesRef.current.forEach(e => {
          if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
            e.health -= b.damage; hit = true;
            if (e.health <= 0) {
              player.score += e.type === 'BOSS' ? 2500 : 100;
              createExplosion(e.x + e.width/2, e.y + e.height/2, e.type === 'BOSS');
              if (e.type === 'BOSS') { bossActiveRef.current = false; onLevelClear(player.score, player.weaponLevel); }
              else if (Math.random() < 0.15) {
                powerUpsRef.current.push({ x: e.x, y: e.y, width: 22, height: 22, type: Math.random() < 0.7 ? 'WEAPON' : 'HEALTH' });
              }
            }
          }
        });
      } else {
        if (b.x < player.x + player.width && b.x + b.width > player.x && b.y < player.y + player.height && b.y + b.height > player.y) {
          player.health -= 15; hit = true;
        }
      }
      return !hit && b.y > -50 && b.y < CANVAS_HEIGHT + 50 && b.x > -50 && b.x < CANVAS_WIDTH + 50;
    });
    enemiesRef.current = enemiesRef.current.filter(e => e.health > 0);

    powerUpsRef.current = powerUpsRef.current.filter(p => {
      p.y += 1.5;
      if (Math.abs(p.x - player.x) < 40 && Math.abs(p.y - player.y) < 40) {
        audio.playPowerup();
        if (p.type === 'WEAPON') player.weaponLevel = Math.min(5, player.weaponLevel + 1);
        else player.health = Math.min(player.maxHealth, player.health + 50);
        return false;
      }
      return p.y < CANVAS_HEIGHT;
    });
    
    // Update particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx; 
      p.y += p.vy; 
      p.life -= 0.025;
      return p.life > 0;
    });

    if (player.health <= 0) onGameOver(player.score);
  }, [level, isPaused, initialScore, onGameOver, onLevelClear]);

  const draw = useCallback((ctx) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGrad.addColorStop(0, '#020617'); skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    starsRef.current.forEach(s => { s.y += s.speed; if (s.y > CANVAS_HEIGHT) s.y = -10; ctx.fillRect(s.x, s.y, s.size, s.size); });
    cloudsRef.current.forEach(c => { 
        c.y += c.speed; if (c.y > CANVAS_HEIGHT + c.size) c.y = -c.size;
        ctx.globalAlpha = c.opacity; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(0, c.size), 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    bulletsRef.current.forEach(b => { 
        ctx.fillStyle = b.color || COLORS.PLAYER_BULLET; 
        ctx.fillRect(b.x, b.y, b.width, b.height); 
    });
    powerUpsRef.current.forEach(p => {
        ctx.fillStyle = p.type === 'WEAPON' ? '#fbbf24' : '#10b981';
        ctx.beginPath(); ctx.arc(p.x + 11, p.y + 11, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign='center'; ctx.fillText(p.type[0], p.x+11, p.y+15);
    });
    enemiesRef.current.forEach(e => drawEnemyPlane(ctx, e));
    drawPlayerPlane(ctx, playerRef.current);
    
    // Draw particles
    particlesRef.current.forEach(p => {
      if (p.life <= 0) return;
      ctx.globalAlpha = p.life; 
      ctx.fillStyle = p.color; 
      ctx.beginPath(); 
      // Ensure radius is never negative
      ctx.arc(p.x, p.y, Math.max(0, 3.5 * p.life), 0, Math.PI*2); 
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }, []);

  const loop = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { update(); draw(ctx); }
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    const kd = (e) => { keysPressed.current[e.key] = true; };
    const ku = (e) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    requestRef.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  return h('div', { className: 'w-full h-full relative overflow-hidden' },
    h('canvas', { 
        ref: canvasRef, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, 
        className: 'w-full h-full cursor-crosshair',
        onMouseMove: (e) => {
            if (isPaused) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const tx = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH - PLAYER_WIDTH/2;
            const ty = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT - PLAYER_HEIGHT/2;
            playerRef.current.x += (tx - playerRef.current.x) * 0.15;
            playerRef.current.y += (ty - playerRef.current.y) * 0.15;
            setTilt((tx - playerRef.current.x) * 0.1);
        }
    }),
    h('div', { className: 'absolute top-4 left-4 pointer-events-none' },
      h('div', { className: 'text-white font-bold text-xs retro-font mb-2' }, `SCORE: ${playerRef.current.score.toLocaleString()}`),
      h('div', { className: 'w-32 h-3 bg-red-900 border-2 border-white/40 shadow-lg' },
        h('div', { className: 'h-full bg-green-500 transition-all duration-100', style: { width: `${(playerRef.current.health/playerRef.current.maxHealth)*100}%` } })
      ),
      h('div', { className: 'text-white/80 text-[10px] mt-2 font-bold retro-font' }, `WEAPON: LV${playerRef.current.weaponLevel}`)
    )
  );
};

// --- 5. App 主組件 ---
const App = () => {
  const [gameState, setGameState] = useState('MENU');
  const [isPaused, setIsPaused] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [weaponLevel, setWeaponLevel] = useState(1);

  useEffect(() => {
    let stopBgm;
    if (gameState === 'PLAYING' && !isPaused) stopBgm = audio.startBGM();
    return () => stopBgm?.();
  }, [gameState, isPaused]);

  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (gameState === 'PLAYING' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        setIsPaused(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [gameState]);

  const startMission = async (level) => {
    setIsPaused(false);
    setGameState('MISSION_BRIEFING');
    setCurrentLevel(level);
    const b = await getMissionBriefing(level);
    setBriefing(b);
  };

  const handleGameOver = (finalScore) => {
    setScore(finalScore);
    setGameState('GAME_OVER');
  };

  const handleLevelClear = (finalScore, finalWeaponLevel) => {
    setScore(finalScore);
    setWeaponLevel(finalWeaponLevel);
    if (currentLevel < 3) setGameState('LEVEL_CLEAR');
    else { audio.playVictory(); setGameState('GAME_WIN'); }
  };

  const resetGame = () => { setScore(0); setWeaponLevel(1); setCurrentLevel(1); setGameState('MENU'); };

  return h('div', { className: 'min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 select-none' },
    h('div', { className: 'relative w-full max-w-[480px] aspect-[480/800] bg-black rounded-lg shadow-2xl overflow-hidden border-4 border-neutral-800' },
      
      gameState === 'PLAYING' && h('div', { className: 'absolute top-4 right-4 z-50' },
        h('button', { 
          onClick: () => setIsPaused(!isPaused),
          className: 'w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 transition-all text-xl'
        }, isPaused ? '▶' : '||')
      ),

      gameState === 'PLAYING' && isPaused && h('div', { className: 'absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center animate-fadeIn' },
        h('h2', { className: 'retro-font text-5xl text-yellow-500 mb-12 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]' }, '暫停'),
        h('button', { 
            onClick: () => setIsPaused(false), 
            className: 'px-12 py-4 bg-yellow-500 text-black font-bold retro-font text-sm hover:scale-110 transition-transform active:scale-95 shadow-[0_0_20px_rgba(234,179,8,0.4)]' 
        }, '繼續遊戲')
      ),

      gameState === 'MENU' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-4xl mb-2 text-red-600 animate-pulse' }, 'SKY STRIKE'),
        h('h2', { className: 'retro-font text-xl mb-12 text-blue-500 tracking-tighter' }, 'PHOENIX RISING'),
        h('button', { 
            onClick: () => startMission(1), 
            className: 'px-8 py-4 bg-red-600 hover:bg-red-700 transition-all retro-font text-lg rounded-sm transform hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.5)]' 
        }, '開始任務'),
        h('p', { className: 'mt-12 text-neutral-500 text-[10px] retro-font leading-relaxed' }, '移動滑鼠以飛行\n自動射擊已開啟\n按 P 暫停')
      ),

      gameState === 'MISSION_BRIEFING' && briefing && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-10 animate-fadeIn' },
        h('div', { className: 'border-2 border-blue-600 p-6 w-full bg-blue-950/20' },
          h('h2', { className: 'text-blue-500 font-bold mb-1 uppercase tracking-widest text-xs' }, `STAGE ${currentLevel}`),
          h('h1', { className: 'text-2xl font-bold mb-4 retro-font text-white' }, briefing.title),
          h('p', { className: 'text-neutral-300 leading-relaxed mb-6 italic border-l-4 border-red-600 pl-4 text-sm' }, briefing.description),
          h('button', { onClick: () => setGameState('PLAYING'), className: 'w-full py-4 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold uppercase tracking-widest retro-font text-sm' }, '出擊!')
        )
      ),

      gameState === 'PLAYING' && h(GameCanvas, { 
        level: currentLevel, 
        isPaused: isPaused,
        initialScore: score,
        initialWeaponLevel: weaponLevel,
        onGameOver: handleGameOver, 
        onLevelClear: handleLevelClear
      }),

      gameState === 'LEVEL_CLEAR' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-blue-950/90 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-3xl mb-4 text-yellow-500' }, '任務完成'),
        h('div', { className: 'mb-8' },
          h('p', { className: 'text-xs text-neutral-500 mb-1 retro-font' }, 'CURRENT SCORE'),
          h('p', { className: 'text-4xl font-black text-white' }, score.toLocaleString())
        ),
        h('button', { onClick: () => startMission(currentLevel + 1), className: 'px-8 py-4 bg-yellow-500 text-black font-bold retro-font text-xs hover:scale-105 transition-transform' }, '下個任務')
      ),

      gameState === 'GAME_WIN' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-blue-600/90 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-4xl mb-6 text-yellow-500 animate-bounce' }, '完全勝利'),
        h('p', { className: 'text-6xl font-black text-white mb-8' }, score.toLocaleString()),
        h('button', { onClick: resetGame, className: 'px-10 py-5 bg-yellow-500 text-blue-950 font-bold retro-font text-xs' }, '返回基地')
      ),

      gameState === 'GAME_OVER' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-5xl mb-4 text-red-600' }, '擊墜'),
        h('p', { className: 'retro-font text-xl mb-8 text-neutral-400' }, `得分: ${score.toLocaleString()}`),
        h('button', { onClick: () => { setScore(0); setWeaponLevel(1); startMission(1); }, className: 'px-10 py-5 bg-red-600 text-white font-bold retro-font text-xs' }, '重新開始'),
        h('button', { onClick: resetGame, className: 'mt-6 text-neutral-500 hover:text-white transition-colors text-xs uppercase underline' }, '主選單')
      )
    )
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(h(React.StrictMode, null, h(App)));
}
