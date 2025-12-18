import React, { useEffect } from 'react';
import { Question, Option } from '../types';
import { Check, X } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  selectedOptionId: string | null;
  isAnswerRevealed: boolean;
  isHintActive: boolean;
  onSelectOption: (id: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  selectedOptionId, 
  isAnswerRevealed, 
  isHintActive,
  onSelectOption 
}) => {
  
  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if answer is already revealed
      if (isAnswerRevealed) return;

      const key = e.key;
      // Check for keys 1, 2, 3, 4
      if (['1', '2', '3', '4'].includes(key)) {
        const index = parseInt(key) - 1;
        const option = question.options[index];
        // Ensure option exists (safeguard)
        if (option) {
          onSelectOption(option.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswerRevealed, onSelectOption, question.options]);

  const getButtonStyles = (option: Option) => {
    // Base style: Light Glass button
    const baseStyle = "relative w-full h-full min-h-[5rem] py-4 px-5 rounded-2xl flex items-center gap-4 transition-all duration-300 font-bold backdrop-blur-md group active:scale-95 outline-none border-none shadow-sm";
    
    // --- HINT STATE (Highlight correct answer before reveal) ---
    if (!isAnswerRevealed && isHintActive && option.isCorrect) {
      return `${baseStyle} bg-yellow-400/30 text-yellow-900 border border-yellow-400/50 scale-[1.02] animate-pulse`;
    }

    // --- NORMAL GAMEPLAY STATE ---
    if (!isAnswerRevealed) {
       if (selectedOptionId === option.id) {
         return `${baseStyle} bg-brand-sky text-white shadow-lg scale-[1.02]`;
       }
       // Default state: White Glass, Dark Text
       return `${baseStyle} bg-white/40 text-slate-800 hover:bg-white/70 hover:shadow-md border border-white/40`;
    }

    // --- REVEALED STATE ---
    if (option.isCorrect) {
      return `${baseStyle} bg-green-500 text-white shadow-lg scale-[1.03] z-10`;
    }

    if (selectedOptionId === option.id && !option.isCorrect) {
      return `${baseStyle} bg-red-500 text-white opacity-90`;
    }

    // Unselected options when answer is revealed
    return `${baseStyle} bg-white/20 text-slate-400 opacity-50`;
  };

  return (
    // Main Container
    <div className="relative w-full max-w-5xl mt-2 mb-4 mx-auto flex flex-col items-center">
      
      {/* Globe Icon */}
      <div className="mb-4 z-30 animate-float">
         <div className="w-20 h-20 md:w-24 md:h-24 rounded-full shadow-lg bg-white/40 backdrop-blur-md flex items-center justify-center overflow-hidden border-2 border-white/60">
           <img 
             src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Globe%20Showing%20Europe-Africa.png" 
             alt="Earth"
             className="w-full h-full object-cover scale-110 drop-shadow-md"
           />
         </div>
      </div>

      {/* Question Header Group */}
      <div className="flex flex-col items-center w-full mb-8 relative z-10 px-2">
         {/* Badge */}
         <span className="inline-block px-4 py-1.5 bg-white/60 text-brand-dark text-[10px] md:text-xs font-black rounded-full uppercase tracking-[0.2em] mb-4 shadow-sm backdrop-blur-md border border-white/50">
          GEOGRAPHY QUIZ
        </span>
        
        {/* Question Text - Changed to Black (Gray-900) */}
        <h2 className="text-gray-900 font-black text-xl md:text-3xl leading-relaxed text-center drop-shadow-[0_2px_0px_rgba(255,255,255,0.5)] max-w-4xl">
          {question.questionText}
        </h2>
      </div>

      {/* Grid for Flag + Options */}
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch relative z-20">
         
         {/* Left Col: Flag Card */}
         <div className="md:col-span-4 flex flex-col">
            <div className="w-full h-full min-h-[14rem] rounded-3xl overflow-hidden shadow-lg bg-white/30 backdrop-blur-xl flex items-center justify-center relative group transition-transform hover:scale-[1.02] duration-500 border border-white/50">
               <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>
               <img 
                src={question.flagUrl} 
                alt="Flag hint" 
                className="h-auto w-full max-h-[180px] object-contain p-6 z-10 relative drop-shadow-lg"
                loading="eager"
              />
              <div className="absolute bottom-3 text-brand-dark/60 text-xs font-mono tracking-widest uppercase font-bold">Flag Hint</div>
            </div>
         </div>

         {/* Right Col: Options Grid */}
         <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.options.map((option, index) => (
              <button
                key={option.id}
                onClick={() => !isAnswerRevealed && onSelectOption(option.id)}
                disabled={isAnswerRevealed}
                className={getButtonStyles(option)}
              >
                {/* Keyboard Shortcut Hint */}
                <span className={`absolute top-3 right-3 text-xs font-mono rounded px-1.5 py-0.5 ${
                  isAnswerRevealed || selectedOptionId === option.id ? 'bg-white/20 text-white' : 'bg-brand-dark/10 text-brand-dark/40'
                }`}>
                  {index + 1}
                </span>

                {/* Option Label Circle */}
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-sm md:text-base font-black flex-shrink-0 transition-all shadow-sm ${
                   isAnswerRevealed && option.isCorrect 
                   ? 'bg-white text-green-600' 
                   : isAnswerRevealed && selectedOptionId === option.id && !option.isCorrect
                   ? 'bg-white text-red-500'
                   : (!isAnswerRevealed && isHintActive && option.isCorrect) 
                   ? 'bg-yellow-400 text-yellow-900'
                   : selectedOptionId === option.id
                   ? 'bg-white text-brand-sky' // Selected state circle
                   : 'bg-white text-brand-dark/70 group-hover:scale-110' // Default transparent circle
                }`}>
                  {option.label}
                </div>

                {/* Option Text */}
                <span className="flex-1 text-left truncate font-bold tracking-wide text-lg md:text-2xl drop-shadow-sm">
                  {option.text}
                </span>

                {/* Icons */}
                {isAnswerRevealed && option.isCorrect && (
                  <Check className="w-6 h-6 md:w-7 md:h-7 text-white animate-bounce flex-shrink-0 drop-shadow-md" strokeWidth={4} />
                )}
                {isAnswerRevealed && selectedOptionId === option.id && !option.isCorrect && (
                  <X className="w-6 h-6 md:w-7 md:h-7 text-white flex-shrink-0 drop-shadow-md" strokeWidth={4} />
                )}
              </button>
            ))}
         </div>

      </div>
    </div>
  );
};