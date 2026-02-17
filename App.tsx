
import React, { useState, useEffect } from 'react';
import { GameState, GameBriefing } from './types';
import { getMissionBriefing } from './services/geminiService';
import { audio } from './services/audioService';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [briefing, setBriefing] = useState<GameBriefing | null>(null);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [weaponLevel, setWeaponLevel] = useState(1);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      const stopBgm = audio.startBGM();
      return () => stopBgm?.();
    }
  }, [gameState]);

  const startMission = async (level: number) => {
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="relative w-[480px] h-[800px] bg-black rounded-lg shadow-2xl overflow-hidden border-4 border-neutral-800">
        
        {gameState === 'MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-8 text-center">
            <h1 className="retro-font text-4xl mb-2 text-red-600 animate-pulse">SKY STRIKE</h1>
            <h2 className="retro-font text-xl mb-12 text-blue-500 tracking-tighter">PHOENIX RISING</h2>
            
            <button 
              onClick={() => startMission(1)}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 transition-colors retro-font text-lg rounded-sm transform hover:scale-105"
            >
              INSERT COIN
            </button>

            <div className="mt-12 text-neutral-500 text-sm flex flex-col gap-2 uppercase font-bold tracking-widest">
              <p>Mouse/Arrows to Move</p>
              <p>Auto-Firing Enabled</p>
              <p>5 Weapon Stages</p>
              <p>3 Epic Bosses</p>
            </div>
          </div>
        )}

        {gameState === 'MISSION_BRIEFING' && briefing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-10 animate-fadeIn">
            <div className="border-2 border-blue-600 p-6 w-full bg-blue-950/20">
              <h2 className="text-blue-500 font-bold mb-1 uppercase tracking-widest text-xs">Stage {currentLevel}</h2>
              <h1 className="text-3xl font-bold mb-4 retro-font text-white">{briefing.title}</h1>
              <p className="text-neutral-300 leading-relaxed mb-6 italic border-l-4 border-red-600 pl-4">"{briefing.description}"</p>
              <div className="flex justify-between items-center mb-8 bg-black/50 p-2">
                <span className="text-xs uppercase text-neutral-500">Threat:</span>
                <span className="text-red-500 font-bold tracking-widest uppercase">{briefing.difficulty}</span>
              </div>
              <button 
                onClick={() => setGameState('PLAYING')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold uppercase tracking-widest retro-font text-sm"
              >
                SCRamble!
              </button>
            </div>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <GameCanvas 
            level={currentLevel} 
            initialScore={score}
            initialWeaponLevel={weaponLevel}
            onGameOver={handleGameOver} 
            onLevelClear={handleLevelClear}
          />
        )}

        {gameState === 'LEVEL_CLEAR' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-950/90 z-20 p-8 text-center animate-fadeIn">
            <h1 className="retro-font text-4xl mb-4 text-yellow-500">STAGE CLEAR</h1>
            <p className="text-neutral-300 mb-8 uppercase tracking-[0.3em]">Excellence, Pilot.</p>
            <div className="mb-8">
              <p className="text-xs text-neutral-500 mb-1">ACCUMULATED SCORE</p>
              <p className="text-4xl font-black text-white">{score.toLocaleString()}</p>
            </div>
            <button 
              onClick={() => startMission(currentLevel + 1)}
              className="px-8 py-4 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors uppercase tracking-widest retro-font text-xs"
            >
              Next Mission
            </button>
          </div>
        )}

        {gameState === 'GAME_WIN' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-600/90 z-20 p-8 text-center animate-fadeIn">
            <div className="bg-white/10 p-10 border-4 border-yellow-500 backdrop-blur-md">
                <h1 className="retro-font text-4xl mb-6 text-yellow-500 animate-bounce">VICTORY</h1>
                <p className="text-white mb-8 uppercase tracking-[0.4em] font-bold">World Peace Restored</p>
                <div className="mb-12">
                  <p className="text-xs text-blue-200 mb-1">ULTIMATE SCORE</p>
                  <p className="text-6xl font-black text-white drop-shadow-lg">{score.toLocaleString()}</p>
                </div>
                <button 
                  onClick={resetGame}
                  className="px-10 py-5 bg-yellow-500 text-blue-950 font-bold hover:bg-yellow-400 transition-colors uppercase tracking-widest retro-font text-xs"
                >
                  Hall of Fame
                </button>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-8 text-center animate-fadeIn">
            <h1 className="retro-font text-5xl mb-4 text-red-600">MAYDAY</h1>
            <p className="retro-font text-xl mb-8">FINAL SCORE</p>
            <p className="text-5xl font-black text-white mb-12">{score.toLocaleString()}</p>

            <button 
              onClick={() => {
                setScore(0);
                setWeaponLevel(1);
                startMission(1);
              }}
              className="px-10 py-5 bg-red-600 text-white font-bold hover:bg-red-700 transition-colors uppercase tracking-widest retro-font text-xs"
            >
              Re-Deploy
            </button>
            
            <button 
              onClick={resetGame}
              className="mt-6 text-neutral-500 hover:text-white transition-colors text-xs uppercase underline tracking-widest"
            >
              Return to Base
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
