
import React, { useState, useEffect } from 'react';
import { getMissionBriefing } from './services/geminiService.js';
import { audio } from './services/audioService.js';
import GameCanvas from './components/GameCanvas.js';

const h = React.createElement;

const App = () => {
  const [gameState, setGameState] = useState('MENU');
  const [isPaused, setIsPaused] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [weaponLevel, setWeaponLevel] = useState(1);

  useEffect(() => {
    let stopBgm;
    if (gameState === 'PLAYING' && !isPaused) {
      stopBgm = audio.startBGM();
    }
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
    setScore(0);
    setWeaponLevel(1);
    setCurrentLevel(1);
    setGameState('MENU');
  };

  // Render UI using pure JS createElement
  return h('div', { className: 'min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 select-none' },
    h('div', { className: 'relative w-[480px] h-[800px] bg-black rounded-lg shadow-2xl overflow-hidden border-4 border-neutral-800' },
      
      gameState === 'PLAYING' && h('div', { className: 'absolute top-4 right-4 z-30' },
        h('button', { 
          onClick: () => setIsPaused(!isPaused),
          className: 'w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 transition-all'
        }, isPaused ? '▶' : '||')
      ),

      gameState === 'PLAYING' && isPaused && h('div', { className: 'absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center animate-fadeIn' },
        h('h2', { className: 'retro-font text-3xl text-yellow-500 mb-8' }, '暫停中'),
        h('button', { onClick: () => setIsPaused(false), className: 'px-8 py-3 bg-yellow-500 text-black font-bold retro-font text-xs rounded-sm' }, '返回戰場')
      ),

      gameState === 'MENU' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-4xl mb-2 text-red-600 animate-pulse' }, 'SKY STRIKE'),
        h('h2', { className: 'retro-font text-xl mb-12 text-blue-500 tracking-tighter' }, 'PHOENIX RISING'),
        h('button', { onClick: () => startMission(1), className: 'px-8 py-4 bg-red-600 hover:bg-red-700 transition-colors retro-font text-lg rounded-sm transform hover:scale-105' }, '開始任務')
      ),

      gameState === 'MISSION_BRIEFING' && briefing && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-10 animate-fadeIn' },
        h('div', { className: 'border-2 border-blue-600 p-6 w-full bg-blue-950/20' },
          h('h2', { className: 'text-blue-500 font-bold mb-1 uppercase tracking-widest text-xs' }, `Stage ${currentLevel}`),
          h('h1', { className: 'text-2xl font-bold mb-4 retro-font text-white' }, briefing.title),
          h('p', { className: 'text-neutral-300 leading-relaxed mb-6 italic border-l-4 border-red-600 pl-4' }, briefing.description),
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

      gameState === 'GAME_OVER' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-5xl mb-4 text-red-600' }, '擊墜'),
        h('p', { className: 'retro-font text-xl mb-8' }, `得分: ${score.toLocaleString()}`),
        h('button', { onClick: () => { setScore(0); setWeaponLevel(1); startMission(1); }, className: 'px-10 py-5 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors uppercase tracking-widest retro-font text-xs' }, '重新開始'),
        h('button', { onClick: resetGame, className: 'mt-6 text-neutral-500 hover:text-white transition-colors text-xs uppercase underline tracking-widest' }, '返回主選單')
      ),

      gameState === 'LEVEL_CLEAR' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-blue-950/90 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-4xl mb-4 text-yellow-500' }, '任務完成'),
        h('button', { onClick: () => startMission(currentLevel + 1), className: 'px-8 py-4 bg-yellow-500 text-black font-bold retro-font text-xs' }, '下一關')
      ),
      
      gameState === 'GAME_WIN' && h('div', { className: 'absolute inset-0 flex flex-col items-center justify-center bg-blue-600/90 z-20 p-8 text-center animate-fadeIn' },
        h('h1', { className: 'retro-font text-4xl mb-6 text-yellow-500' }, '最終勝利'),
        h('p', { className: 'text-white mb-8' }, '世界和平已恢復'),
        h('button', { onClick: resetGame, className: 'px-10 py-5 bg-yellow-500 text-blue-950 font-bold retro-font text-xs' }, '返回基地')
      )
    )
  );
};

export default App;
