import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const h = React.createElement;

// --- 1. 常數定義 (Constants) ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 800;
const PLAYER_SPEED = 4.5; 
const PLAYER_WIDTH = 44;
const PLAYER_HEIGHT = 44;
const PLAYER_START_HEALTH = 250;

const ENEMY_TYPES = {
  SCOUT: { width: 32, height: 32, speed: 2.0, health: 1, fireRate: 120 },
  BOMBER: { width: 60, height: 50, speed: 1.0, health: 8, fireRate: 180 },
  ACE: { width: 42, height: 42, speed: 2.5, health: 4, fireRate: 80 },
  BOSS: { width: 180, height: 120, speed: 0.8, health: 120, fireRate: 50 }
};

const COLORS = {
  PLAYER: '#3b82f6',
  ENEMY_SCOUT: '#ef4444',
  ENEMY_BOMBER: '#991b1b',
  ENEMY_ACE: '#f59e0b',
  ENEMY_BOSS: '#7f1d1d',
  PLAYER_BULLET: '#60a5fa',
  ENEMY_BULLET: '#fca5a5',
  POWERUP_WEAPON: '#fbbf24',
  POWERUP_HEALTH: '#10b981',
  EXPLOSION: ['#f59e0b', '#ef4444', '#7f1d1d']
};

const LEVEL_THRESHOLDS = [1500, 4500, 9000];

// --- 2. 音效服務 (Audio Service) ---
class AudioService {
  constructor() {
    this.ctx = null;
    this.bgmGain = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShoot() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(450, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
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
    gain.gain.setValueAtTime(isBoss ? 0.5 : 0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (isBoss ? 1.2 : 0.25));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
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

  playStageClear() {
    this.init();
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.12 + 0.3);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.12);
      osc.stop(this.ctx.currentTime + i * 0.12 + 0.3);
    });
  }

  playVictory() {
    this.init();
    if (!this.ctx) return;
    const melody = [523, 523, 523, 523, 415, 466, 523, 466, 523];
    melody.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.2);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.2);
      osc.stop(this.ctx.currentTime + i * 0.2 + 0.4);
    });
  }

  startBGM() {
    this.init();
    if (!this.ctx) return;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.04;
    this.bgmGain.connect(this.ctx.destination);
    const interval = setInterval(() => {
      if (!this.ctx || !this.bgmGain) return;
      const osc = this.ctx.createOscillator();
      const freq = [65, 65, 73, 55][Math.floor(Date.now() / 600) % 4];
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(); osc.stop(this.ctx.currentTime + 0.6);
    }, 600);
    return () => { clearInterval(interval); if (this.bgmGain) this.bgmGain.disconnect(); };
  }
}
const audio = new AudioService();

// --- 3. Gemini 服務 (Gemini Service) ---
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
      contents: `Generate a dramatic short mission briefing for Level ${level} of a 1945 style airplane shooter. Level 1: Sea. Level 2: Mountain. Level 3: City. Use Traditional Chinese for content.`,
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
  } catch (error) {
    console.error("Gemini failed:", error);
    return defaults[level - 1] || defaults[0];
  }
}

// --- 4. 遊戲畫布組件 (GameCanvas) ---
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
      speed: Math.random() * 0.4 + 0.2
    }));
    cloudsRef.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 80 + 80,
      speed: Math.random() * 1.2 + 0.8,
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

  const drawPropeller = (ctx, x, y, size, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((frameCountRef.current * 0.9) % (Math.PI * 2));
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
    
    // Wings
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath(); ctx.moveTo(x, y + height * 0.45); ctx.lineTo(x + width, y + height * 0.45);
    ctx.lineTo(x + width * 0.85, y + height * 0.6); ctx.lineTo(x + width * 0.15, y + height * 0.6); ctx.fill();
    
    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.ellipse(cx, cy, width/4.5, height/2.2, 0, 0, Math.PI * 2); ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath(); ctx.ellipse(cx, y + height*0.3, 4, 6, 0, 0, Math.PI*2); ctx.fill();

    drawPropeller(ctx, cx - 12, y + 10, 13, 'rgba(255,255,255,0.4)');
    drawPropeller(ctx, cx + 12, y + 10, 13, 'rgba(255,255,255,0.4)');
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

    // 自動射擊邏輯
    if (player.fireCooldown <= 0) {
      audio.playShoot();
      const cx = player.x + player.width/2;
      const bSpeed = 10;
      bulletsRef.current.push({ x: cx - 2, y: player.y, width: 4, height: 14, damage: 1, isPlayerBullet: true, vx: 0, vy: -bSpeed });
      if (player.weaponLevel >= 2) {
        bulletsRef.current.push({ x: cx - 14, y: player.y + 10, width: 4, height: 14, damage: 1, isPlayerBullet: true, vx: 0, vy: -bSpeed });
        bulletsRef.current.push({ x: cx + 10, y: player.y + 10, width: 4, height: 14, damage: 1, isPlayerBullet: true, vx: 0, vy: -bSpeed });
      }
      player.fireCooldown = 12;
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    // 敵人生成
    if (!bossActiveRef.current && Math.random() < 0.02) {
      const types = ['SCOUT', 'BOMBER', 'ACE'];
      const type = types[Math.floor(Math.random() * types.length)];
      const cfg = ENEMY_TYPES[type];
      enemiesRef.current.push({
        x: Math.random() * (CANVAS_WIDTH - cfg.width), y: -cfg.height, 
        width: cfg.width, height: cfg.height, speed: cfg.speed + level * 0.2, 
        health: cfg.health, maxHealth: cfg.health, type, fireCooldown: Math.random() * cfg.fireRate
      });
    }

    // Boss 生成判定
    if (!bossActiveRef.current && (player.score - initialScore) >= LEVEL_THRESHOLDS[level-1]) {
      bossActiveRef.current = true;
      const bCfg = ENEMY_TYPES.BOSS;
      enemiesRef.current.push({
        x: CANVAS_WIDTH / 2 - bCfg.width / 2, y: -bCfg.height, 
        width: bCfg.width, height: bCfg.height, speed: bCfg.speed, 
        health: bCfg.health + (level - 1) * 60, maxHealth: bCfg.health + (level - 1) * 60, 
        type: 'BOSS', fireCooldown: 60
      });
    }

    // 更新各項實體
    enemiesRef.current = enemiesRef.current.filter(e => {
      if (e.type === 'BOSS') {
        if (e.y < 80) e.y += e.speed; else e.x += Math.sin(frameCountRef.current / 60) * 1.5;
        if (e.fireCooldown <= 0) {
            const bcx = e.x + e.width/2; const bcy = e.y + e.height;
            for(let i=0; i<8; i++) {
                const angle = (i/8) * Math.PI * 2 + (frameCountRef.current * 0.05);
                bulletsRef.current.push({ x: bcx, y: bcy, width: 8, height: 8, isPlayerBullet: false, vx: Math.cos(angle)*3, vy: Math.sin(angle)*3 });
            }
            e.fireCooldown = ENEMY_TYPES.BOSS.fireRate;
        }
      } else {
        e.y += e.speed;
        if (e.fireCooldown <= 0) {
           bulletsRef.current.push({ x: e.x + e.width/2, y: e.y + e.height, width: 5, height: 10, isPlayerBullet: false, vx: 0, vy: 5 });
           e.fireCooldown = ENEMY_TYPES[e.type].fireRate;
        }
      }
      e.fireCooldown--;
      // 碰撞檢測 (飛機對飛機)
      if (Math.abs(e.x + e.width/2 - (player.x + player.width/2)) < (e.width + player.width)/2.5 && 
          Math.abs(e.y + e.height/2 - (player.y + player.height/2)) < (e.height + player.height)/2.5) {
        player.health -= 20; createExplosion(e.x + e.width/2, e.y + e.height/2); return false;
      }
      return e.y < CANVAS_HEIGHT + 100;
    });

    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.vx; b.y += b.vy;
      let hit = false;
      if (b.isPlayerBullet) {
        enemiesRef.current.forEach(e => {
          if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
            e.health -= b.damage || 1; hit = true;
            if (e.health <= 0) {
              player.score += e.type === 'BOSS' ? 2000 : 100;
              createExplosion(e.x + e.width/2, e.y + e.height/2, e.type === 'BOSS');
              if (e.type === 'BOSS') { bossActiveRef.current = false; onLevelClear(player.score, player.weaponLevel); }
              else if (Math.random() < 0.1) {
                powerUpsRef.current.push({ x: e.x, y: e.y, width: 20, height: 20, type: Math.random() < 0.7 ? 'WEAPON' : 'HEALTH' });
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
      p.y += 2;
      if (Math.abs(p.x - player.x) < 40 && Math.abs(p.y - player.y) < 40) {
        audio.playPowerup();
        if (p.type === 'WEAPON') player.weaponLevel = Math.min(5, player.weaponLevel + 1);
        else player.health = Math.min(player.maxHealth, player.health + 40);
        return false;
      }
      return p.y < CANVAS_HEIGHT;
    });

    if (player.health <= 0) onGameOver(player.score);
  }, [level, isPaused, initialScore, onGameOver, onLevelClear]);

  const draw = useCallback((ctx) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGrad.addColorStop(0, '#020617'); skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 背景星空與雲
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    starsRef.current.forEach(s => { s.y += s.speed; if (s.y > CANVAS_HEIGHT) s.y = -10; ctx.fillRect(s.x, s.y, s.size, s.size); });
    cloudsRef.current.forEach(c => { 
        c.y += c.speed; if (c.y > CANVAS_HEIGHT + c.size) c.y = -c.size;
        ctx.globalAlpha = c.opacity; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 子彈
    bulletsRef.current.forEach(b => { 
        ctx.fillStyle = b.isPlayerBullet ? '#60a5fa' : '#fca5a5'; 
        ctx.fillRect(b.x, b.y, b.width, b.height); 
    });

    // 道具
    powerUpsRef.current.forEach(p => {
        ctx.fillStyle = p.type === 'WEAPON' ? '#fbbf24' : '#10b981';
        ctx.beginPath(); ctx.arc(p.x + 10, p.y + 10, 10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign='center'; ctx.fillText(p.type[0], p.x+10, p.y+14);
    });
    
    // 敵機
    enemiesRef.current.forEach(e => {
       ctx.fillStyle = COLORS[`ENEMY_${e.type}`] || '#ef4444';
       if (e.type === 'BOSS') {
           ctx.fillRect(e.x, e.y + e.height*0.4, e.width, e.height*0.2);
           ctx.fillRect(e.x + e.width*0.35, e.y, e.width*0.3, e.height);
           // 血條
           ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 15, e.width, 6);
           ctx.fillStyle = '#ef4444'; ctx.fillRect(e.x, e.y - 15, e.width * (e.health/e.maxHealth), 6);
       } else {
           ctx.beginPath(); ctx.moveTo(e.x + e.width/2, e.y + e.height); ctx.lineTo(e.x, e.y); ctx.lineTo(e.x + e.width, e.y); ctx.fill();
       }
    });
    
    // 玩家
    drawPlayerPlane(ctx, playerRef.current);

    // 粒子效果
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.025;
      ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI*2); ctx.fill();
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
    const kd = (e) => { keysPressed.current[e.key] = true; };
    const ku = (e) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    requestRef.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  return h('div', { className: 'w-full h-full relative overflow-hidden' },
    h('canvas', { 
        ref: canvasRef, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, 
        className: 'w-full h-full',
        onMouseMove: (e) => {
            if (isPaused) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const tx = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH - PLAYER_WIDTH/2;
            const ty = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT - PLAYER_HEIGHT/2;
            playerRef.current.x += (tx - playerRef.current.x) * 0.15;
            playerRef.current.y += (ty - playerRef.current.y) * 0.15;
            setTilt((tx - playerRef.current.x) * 0.1);
        },
        onTouchMove: (e) => {
            if (isPaused) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const touch = e.touches[0];
            const tx = ((touch.clientX - rect.left) / rect.width) * CANVAS_WIDTH - PLAYER_WIDTH/2;
            const ty = ((touch.clientY - rect.top) / rect.height) * CANVAS_HEIGHT - PLAYER_HEIGHT/2;
            playerRef.current.x += (tx - playerRef.current.x) * 0.2;
            playerRef.current.y += (ty - playerRef.current.y) * 0.2;
            setTilt((tx - playerRef.current.x) * 0.1);
        }
    }),
    h('div', { className: 'absolute top-4 left-4 pointer-events-none' },
      h('div', { className: 'text-white font-bold text-xs retro-font mb-2' }, `SCORE: ${playerRef.current.score.toLocaleString()}`),
      h('div', { className: 'w-32 h-3 bg-red-900 border-2 border-white/40' },
        h('div', { className: 'h-full bg-green-500 transition-all duration-100', style: { width: `${(playerRef.current.health/playerRef.current.maxHealth)*100}%` } })
      ),
      h('div', { className: 'text-white/50 text-[10px] mt-1 font-bold' }, `WEAPON: LV${playerRef.current.weaponLevel}`)
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
    if (currentLevel < 3) {
      audio.playStageClear();
      setGameState('LEVEL_CLEAR');
    } else {
      audio.playVictory();
      setGameState('GAME_WIN');
    }
  };

  const resetGame = () => {
    setScore(0); setWeaponLevel(1); setCurrentLevel(1); setGameState('MENU');
  };

  return h('div', { className: 'min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4' },
    h('div', { className: 'relative w-full max-w-[480px] aspect-[480/800] bg-black rounded-lg shadow-2xl overflow-hidden border-4 border-neutral-800' },
      
      gameState === 'PLAYING' && h('div', { className: 'absolute top-4 right-4 z-30' },
        h('button', { 
          onClick: () => setIsPaused(!isPaused),
          className: 'w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 transition-all text-xl'
        }, isPaused ? '▶' : '||')
      ),

      gameState === 'MENU' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-4xl mb-2 text-red-600 animate-pulse' }, 'SKY STRIKE'),
        h('h2', { className: 'retro-font text-xl mb-12 text-blue-500 tracking-tighter' }, 'PHOENIX RISING'),
        h('button', { 
            onClick: () => startMission(1), 
            className: 'px-8 py-4 bg-red-600 hover:bg-red-700 transition-all retro-font text-lg rounded-sm transform hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.5)]' 
        }, '開始任務'),
        h('p', { className: 'mt-12 text-neutral-500 text-[10px] retro-font leading-relaxed' }, '移動滑鼠或觸控以飛行\n自動射擊已開啟')
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

// --- 6. 渲染入口 ---
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(h(React.StrictMode, null, h(App)));
}
