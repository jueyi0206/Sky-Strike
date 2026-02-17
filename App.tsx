
import React, { useState, useEffect } from 'react';
import { GameState, GameBriefing } from './types';
import { getMissionBriefing } from './services/geminiService';
import { audio } from './services/audioService';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [isPaused, setIsPaused] = useState(false);
  const [briefing, setBriefing] = useState<GameBriefing | null>(null);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [weaponLevel, setWeaponLevel] = useState(1);

  useEffect(() => {
    let stopBgm: (() => void) | undefined;
    if (gameState === 'PLAYING' && !isPaused) {
      stopBgm = audio.startBGM();
    }
    return () => stopBgm?.();
  }, [gameState, isPaused]);

  const startMission = async (level: number) => {
    setIsPaused(false);
    setGameState('MISSION_BRIEFING');
    setCurrentLevel(level);
    const b = await getMissionBriefing(level);
    setBriefing(b);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setGameState('GAME_OVER');
  };

  const handleLevelClear = (finalScore: number, finalWeaponLevel: number) => {
    setScore(finalScore);
    setWeaponLevel(finalWeaponLevel); // 保存武器等級到 App 狀態
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="relative w-[480px] h-[800px] bg-black rounded-lg shadow-2xl overflow-hidden border-4 border-neutral-800">
        
        {/* UI Overlay for Pause */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-4 right-4 z-30">
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 transition-all"
            >
              {isPaused ? (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M8 5v14l11-7z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              )}
            </button>
          </div>
        )}

        {gameState === 'PLAYING' && isPaused && (
          <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center animate-fadeIn">
            <h2 className="retro-font text-3xl text-yellow-500 mb-8">PAUSED</h2>
            <button 
              onClick={() => setIsPaused(false)}
              className="px-8 py-3 bg-yellow-500 text-black font-bold retro-font text-xs rounded-sm"
            >
              RESUME
            </button>
          </div>
        )}

        {gameState === 'MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-8 text-center animate-fadeIn">
            <h1 className="retro-font text-4xl mb-2 text-red-600 animate-pulse">SKY STRIKE</h1>
            <h2 className="retro-font text-xl mb-12 text-blue-500 tracking-tighter">PHOENIX RISING</h2>
            <button onClick={() => startMission(1)} className="px-8 py-4 bg-red-600 hover:bg-red-700 transition-colors retro-font text-lg rounded-sm transform hover:scale-105">INSERT COIN</button>
            <div className="mt-12 text-neutral-500 text-sm flex flex-col gap-2 uppercase font-bold tracking-widest">
              <p>WASD / 滑鼠 / 方向鍵 移動</p>
              <p>自動射擊已開啟</p>
              <p>武器共 5 段升級</p>
            </div>
          </div>
        )}

        {gameState === 'MISSION_BRIEFING' && briefing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-10 animate-fadeIn">
            <div className="border-2 border-blue-600 p-6 w-full bg-blue-950/20">
              <h2 className="text-blue-500 font-bold mb-1 uppercase tracking-widest text-xs">Stage {currentLevel}</h2>
              <h1 className="text-2xl font-bold mb-4 retro-font text-white">{briefing.title}</h1>
              <p className="text-neutral-300 leading-relaxed mb-6 italic border-l-4 border-red-600 pl-4">{briefing.description}</p>
              <div className="flex justify-between items-center mb-8 bg-black/50 p-2">
                <span className="text-xs uppercase text-neutral-500">威脅度:</span>
                <span className="text-red-500 font-bold tracking-widest uppercase">{briefing.difficulty}</span>
              </div>
              <button onClick={() => setGameState('PLAYING')} className="w-full py-4 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold uppercase tracking-widest retro-font text-sm">出擊!</button>
            </div>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <GameCanvas 
            level={currentLevel} 
            isPaused={isPaused}
            initialScore={score}
            initialWeaponLevel={weaponLevel}
            onGameOver={handleGameOver} 
            onLevelClear={handleLevelClear}
          />
        )}

        {gameState === 'LEVEL_CLEAR' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-950/90 z-20 p-8 text-center animate-fadeIn">
            <h1 className="retro-font text-4xl mb-4 text-yellow-500">任務完成</h1>
            <p className="text-neutral-300 mb-8 uppercase tracking-[0.3em]">幹得好，飛行員。</p>
            <div className="mb-8">
              <p className="text-xs text-neutral-500 mb-1">目前得分</p>
              <p className="text-4xl font-black text-white">{score.toLocaleString()}</p>
            </div>
            <button onClick={() => startMission(currentLevel + 1)} className="px-8 py-4 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors uppercase tracking-widest retro-font text-xs">下一個任務</button>
          </div>
        )}

        {gameState === 'GAME_WIN' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/90 z-20 p-8 text-center animate-fadeIn">
             <div className="bg-black/40 p-10 border-4 border-yellow-500 backdrop-blur-md shadow-2xl rounded-lg w-full max-w-sm">
                <h1 className="retro-font text-4xl mb-6 text-yellow-400 drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] animate-bounce">完全勝利</h1>
                <p className="text-white mb-8 uppercase tracking-[0.2em] font-bold text-sm text-blue-100">和平重歸天際</p>
                <div className="mb-10 bg-black/30 p-4 rounded border border-white/10">
                  <p className="text-xs text-blue-300 mb-2 uppercase tracking-widest">最終得分</p>
                  <p className="text-5xl font-black text-white retro-font tracking-tight">{score.toLocaleString()}</p>
                </div>
                <button onClick={resetGame} className="w-full py-4 bg-yellow-500 text-blue-950 font-bold hover:bg-yellow-400 transition-all uppercase tracking-widest retro-font text-xs transform hover:scale-[1.02] shadow-lg border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1">返回基地</button>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-8 text-center animate-fadeIn">
            <h1 className="retro-font text-5xl mb-4 text-red-600">擊墜</h1>
            <p className="retro-font text-xl mb-8">最終得分</p>
            <p className="text-5xl font-black text-white mb-12">{score.toLocaleString()}</p>
            <button onClick={() => { setScore(0); setWeaponLevel(1); startMission(1); }} className="px-10 py-5 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors uppercase tracking-widest retro-font text-xs">重新部署</button>
            <button onClick={resetGame} className="mt-6 text-neutral-500 hover:text-white transition-colors text-xs uppercase underline tracking-widest">主選單</button>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
