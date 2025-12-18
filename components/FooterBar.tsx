import React from 'react';

interface FooterBarProps {
  current: number;
  total: number;
}

export const FooterBar: React.FC<FooterBarProps> = ({ current, total }) => {
  const progressPercentage = (current / total) * 100;

  return (
    <div className="w-full px-5 pb-8 pt-4 flex flex-col gap-3">
      {/* Progress Bar Container */}
      <div className="flex flex-col gap-1">
        {/* Changed to text-black and font-black for maximum darkness */}
        <div className="flex justify-between text-black text-xs font-black uppercase tracking-wider drop-shadow-none">
          <span>題目進度</span>
          <span>{current} / {total}</span>
        </div>
        
        {/* Transparent Track - Darkened border and background */}
        <div className="h-2.5 w-full bg-black/5 rounded-full overflow-hidden backdrop-blur-sm border border-black/20">
          <div 
            className="h-full bg-gradient-to-r from-brand-sun to-orange-500 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,183,3,0.6)]"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      
      {/* Darkened Helper Text */}
      <div className="text-center text-black text-[10px] tracking-widest font-bold opacity-70 drop-shadow-none">
         答題後自動跳轉
      </div>
    </div>
  );
};