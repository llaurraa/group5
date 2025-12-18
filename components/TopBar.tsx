import React from 'react';
import { Timer, Pause, Play, Lightbulb, LogOut } from 'lucide-react';
import { GameMode } from '../types';

interface TopBarProps {
  gameMode: GameMode;
  timeLeft: number;
  isPaused: boolean;
  onPause: () => void;
  onHint: () => void;
  onExit: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  gameMode, 
  timeLeft, 
  isPaused, 
  onPause, 
  onHint, 
  onExit 
}) => {
  return (
    // Transparent container
    <div className="w-full flex items-center justify-between pt-6 px-8 z-20 relative mb-4">
        {/* Left Group: Exit & Hint */}
        <div className="flex items-center gap-4">
           <button 
             onClick={onExit}
             className="p-4 rounded-2xl bg-white/20 text-white hover:bg-red-500 hover:text-white active:scale-95 transition-all backdrop-blur-md group shadow-sm border border-black/50"
             aria-label="Exit"
           >
             <LogOut className="w-7 h-7 drop-shadow-md group-hover:scale-110 transition-transform" />
           </button>

           <button 
             onClick={onHint}
             className="p-4 rounded-2xl bg-white/20 text-white hover:bg-brand-sun hover:text-white active:scale-95 transition-all backdrop-blur-md group shadow-sm border border-black/50"
             aria-label="Hint"
           >
             <Lightbulb className="w-7 h-7 fill-white/20 opacity-90 group-hover:opacity-100 transition-opacity group-hover:scale-110 drop-shadow-md" />
           </button>
        </div>

        {/* Center: Timer Badge - White Glass with Glow */}
        <div className={`absolute left-1/2 top-6 -translate-x-1/2 z-20 flex items-center justify-center w-36 h-16 rounded-3xl backdrop-blur-md transition-all duration-300 border border-white/40 ${
          timeLeft <= 5 
            ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] scale-110' 
            : timeLeft <= 10
            ? 'bg-brand-sun shadow-[0_0_30px_rgba(255,183,3,0.6)] scale-105'
            : 'bg-white/20 shadow-lg'
        }`}>
           <Timer className={`w-8 h-8 mr-3 drop-shadow-md ${timeLeft <= 5 ? 'text-white animate-spin-slow' : 'text-white'}`} />
           <span className="text-white font-black text-4xl tabular-nums drop-shadow-md">{timeLeft}</span>
        </div>

        {/* Right Group: Pause */}
        <button 
          onClick={onPause}
          className={`p-4 rounded-2xl transition-all backdrop-blur-md active:scale-95 group shadow-sm border border-black/50 ${
            isPaused 
              ? 'bg-brand-sun text-white animate-pulse' 
              : 'bg-white/20 text-white hover:bg-white/40'
          }`}
        >
          {isPaused ? <Play className="w-7 h-7 fill-current drop-shadow-md" /> : <Pause className="w-7 h-7 fill-current drop-shadow-md group-hover:scale-110 transition-transform" />}
        </button>
    </div>
  );
};