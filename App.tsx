import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { QuestionCard } from './components/QuestionCard';
import { FooterBar } from './components/FooterBar';
import { QUIZ_DATA } from './quizData';
import { GameState, Question, GameMode, Difficulty, LeaderboardEntry } from './types';
import { GAME_DURATION_SECONDS, QUESTIONS_PER_GAME } from './constants';
import { Trophy, Play, RotateCcw, AlertCircle, Bot, User, Brain, Zap, Shield, Swords, Save, Crown, ChevronLeft, ListOrdered, LogOut, Keyboard } from 'lucide-react';

// --- CONSTANTS & CONFIG ---

const LEADERBOARD_KEY = 'quiz_leaderboard';
const LAST_RESET_KEY = 'quiz_last_reset';
const MAX_LEADERBOARD_ENTRIES = 10;

// Sound Resources
const SOUND_CORRECT = "https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.m4a"; // Ding/Chime
const SOUND_WRONG = "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.m4a"; // Error Buzz
const SOUND_TICK = "https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.m4a"; // Short Click

// AI Configuration based on Difficulty
const AI_CONFIG: Record<Difficulty, { accuracy: number; minDelay: number; maxDelay: number }> = {
  1: { accuracy: 0.50, minDelay: 6, maxDelay: 10 },   // Easy
  2: { accuracy: 0.65, minDelay: 5, maxDelay: 8 },    // Medium
  3: { accuracy: 0.75, minDelay: 3.5, maxDelay: 6 },  // Hard
  4: { accuracy: 0.85, minDelay: 2, maxDelay: 4 },    // Expert
};

// --- UTILITIES ---

// Hook for smooth number counting animation
const useAnimatedCounter = (targetValue: number, duration: number = 800) => {
  const [displayValue, setDisplayValue] = useState(targetValue);

  useEffect(() => {
    let startValue = displayValue;
    // Immediate snap on reset (e.g., new game)
    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }
    
    if (startValue === targetValue) return;

    const startTime = performance.now();
    
    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic function for smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 3);
      
      const current = startValue + (targetValue - startValue) * ease;
      setDisplayValue(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }, [targetValue]); 

  return displayValue;
};

// Shuffle and pick weighted questions
const getWeightedQuestions = (allQuestions: Question[]): Question[] => {
  const eastAsia = allQuestions.filter(q => q.region === 'EastAsia');
  const others = allQuestions.filter(q => q.region !== 'EastAsia');

  const shuffle = (arr: Question[]) => {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const shuffledEastAsia = shuffle(eastAsia);
  const shuffledOthers = shuffle(others);

  const selectedQuestions: Question[] = [];
  const selectedCountries = new Set<string>();
  const targetEastAsiaCount = 10;
  
  for (const q of shuffledEastAsia) {
    if (selectedQuestions.length >= targetEastAsiaCount) break;
    if (!selectedCountries.has(q.country)) {
      selectedQuestions.push(q);
      selectedCountries.add(q.country);
    }
  }

  for (const q of shuffledOthers) {
    if (selectedQuestions.length >= QUESTIONS_PER_GAME) break;
    if (!selectedCountries.has(q.country)) {
      selectedQuestions.push(q);
      selectedCountries.add(q.country);
    }
  }
  
  return shuffle(selectedQuestions);
};

// Unified Scoring Logic
const calculateNewScoreState = (
  currentScore: number,
  currentConsecutive: number,
  isCorrect: boolean,
  isHintUsed: boolean
): { score: number; consecutive: number } => {
  let newScore = currentScore;
  let newConsecutive = currentConsecutive;

  if (isCorrect) {
    if (isHintUsed) {
      newConsecutive = 0;
      // No points added if hint was used, making the -100 hint cost permanent for this question.
    } else {
      const comboBonus = currentConsecutive * 25;
      newScore += (100 + comboBonus);
      newConsecutive += 1;
    }
  } else {
    // Deduct 50 points for wrong answer.
    // Removed Math.max(0, ...) to allow negative scores as requested.
    newScore = newScore - 50;
    newConsecutive = 0;
  }

  return { score: newScore, consecutive: newConsecutive };
};

// --- LEADERBOARD HELPERS ---

const getLeaderboard = (): LeaderboardEntry[] => {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLeaderboard = (entries: LeaderboardEntry[]) => {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
};

const checkWeeklyReset = () => {
  const lastResetStr = localStorage.getItem(LAST_RESET_KEY);
  const now = new Date();
  
  // Calculate the most recent Monday 00:00
  const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)
  const distanceToMonday = (currentDay + 6) % 7; // Days since Monday
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - distanceToMonday);
  lastMonday.setHours(0, 0, 0, 0);

  // If last reset was BEFORE the most recent Monday, trigger reset
  if (!lastResetStr || parseInt(lastResetStr) < lastMonday.getTime()) {
    console.log("Weekly reset triggered");
    localStorage.removeItem(LEADERBOARD_KEY);
    localStorage.setItem(LAST_RESET_KEY, now.getTime().toString());
  }
};

const isHighScore = (score: number): boolean => {
  if (score <= 0) return false;
  const leaderboard = getLeaderboard();
  if (leaderboard.length < MAX_LEADERBOARD_ENTRIES) return true;
  // Check if score is higher than the lowest score
  return score > leaderboard[leaderboard.length - 1].score;
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  
  const [gameState, setGameState] = useState<GameState>({
    status: 'start',
    gameMode: 'single',
    difficulty: 2,
    score: 0,
    computerScore: 0,
    consecutiveCorrect: 0,
    computerConsecutiveCorrect: 0,
    currentQuestionIndex: 0,
    totalQuestions: QUESTIONS_PER_GAME,
    timeLeft: GAME_DURATION_SECONDS,
    selectedOptionId: null,
    isAnswerRevealed: false,
    isPaused: false,
    isHintActive: false,
    isExitConfirmOpen: false,
  });

  const [bgOffset, setBgOffset] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [isScoreSaved, setIsScoreSaved] = useState(false);

  // Audio Refs
  const correctAudio = useRef<HTMLAudioElement | null>(null);
  const wrongAudio = useRef<HTMLAudioElement | null>(null);
  const tickAudio = useRef<HTMLAudioElement | null>(null);

  // Animated Scores for Vertical Bars
  const displayScore = useAnimatedCounter(gameState.score);
  const displayCompScore = useAnimatedCounter(gameState.computerScore);

  // AI Logic Refs
  const aiAnsweredRef = useRef(false);
  const aiTriggerTimeRef = useRef(0);

  // Initialize Audio
  useEffect(() => {
    correctAudio.current = new Audio(SOUND_CORRECT);
    wrongAudio.current = new Audio(SOUND_WRONG);
    tickAudio.current = new Audio(SOUND_TICK);

    // Set volumes
    if (correctAudio.current) correctAudio.current.volume = 0.6;
    if (wrongAudio.current) wrongAudio.current.volume = 0.5;
    if (tickAudio.current) tickAudio.current.volume = 0.2; // Softer tick
  }, []);

  const playSound = (type: 'correct' | 'wrong' | 'tick') => {
    const audio = type === 'correct' ? correctAudio.current : 
                  type === 'wrong' ? wrongAudio.current : 
                  tickAudio.current;
    
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => {
        // Handle autoplay policy restriction silently or log
        // console.warn("Audio play blocked", e);
      });
    }
  };

  // Keyboard Lock for Fullscreen (Prevent Escape from exiting fullscreen)
  useEffect(() => {
    const lockKeys = async () => {
      // Check if Navigator Keyboard Lock API is available
      if ('keyboard' in navigator && 'lock' in (navigator as any).keyboard) {
        try {
          await (navigator as any).keyboard.lock(['Escape']);
        } catch (e) {
          console.log("Keyboard lock failed (may need user interaction or fullscreen)", e);
        }
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        lockKeys();
      }
    };

    // Attempt to lock on mount, click, keydown, and fullscreen change
    lockKeys();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('mousedown', lockKeys);
    window.addEventListener('keydown', lockKeys);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('mousedown', lockKeys);
      window.removeEventListener('keydown', lockKeys);
    };
  }, []);

  // Background Parallax & Initialization
  useEffect(() => {
    // Check for weekly reset on mount
    checkWeeklyReset();

    const interval = setInterval(() => {
      setBgOffset(prev => (prev + 0.5) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Initialize AI for new question
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.gameMode === 'pve') {
      aiAnsweredRef.current = false;
      const config = AI_CONFIG[gameState.difficulty];
      const range = config.maxDelay - config.minDelay;
      const delay = config.minDelay + Math.random() * range;
      aiTriggerTimeRef.current = GAME_DURATION_SECONDS - delay;
    }
  }, [gameState.currentQuestionIndex, gameState.status, gameState.gameMode, gameState.difficulty]);

  // --- HANDLERS ---

  const handleModeSelect = (mode: GameMode) => {
    if (mode === 'single') {
      startPlaying('single', 2);
    } else {
      setGameState(prev => ({ ...prev, status: 'difficulty_select', gameMode: 'pve' }));
    }
  };

  const handleDifficultySelect = (diff: Difficulty) => {
    startPlaying('pve', diff);
  };

  const startPlaying = (mode: GameMode, diff: Difficulty) => {
    setActiveQuestions(getWeightedQuestions(QUIZ_DATA));
    setGameState({
      status: 'playing',
      gameMode: mode,
      difficulty: diff,
      score: 0,
      computerScore: 0,
      consecutiveCorrect: 0,
      computerConsecutiveCorrect: 0,
      currentQuestionIndex: 0,
      totalQuestions: QUESTIONS_PER_GAME,
      timeLeft: GAME_DURATION_SECONDS,
      selectedOptionId: null,
      isAnswerRevealed: false,
      isPaused: false,
      isHintActive: false,
      isExitConfirmOpen: false,
    });
    // Reset submission state
    setPlayerName('');
    setIsScoreSaved(false);
  };

  const handleRestartGame = () => {
    // Fully reset state to initial values
    setGameState({
      status: 'start',
      gameMode: 'single',
      difficulty: 2,
      score: 0,
      computerScore: 0,
      consecutiveCorrect: 0,
      computerConsecutiveCorrect: 0,
      currentQuestionIndex: 0,
      totalQuestions: QUESTIONS_PER_GAME,
      timeLeft: GAME_DURATION_SECONDS,
      selectedOptionId: null,
      isAnswerRevealed: false,
      isPaused: false,
      isHintActive: false,
      isExitConfirmOpen: false,
    });
    setActiveQuestions([]);
    setPlayerName('');
    setIsScoreSaved(false);
  };

  const handleViewLeaderboard = () => {
    setGameState(prev => ({ ...prev, status: 'leaderboard' }));
  };

  // Score Submission
  const handleSaveScore = () => {
    if (!playerName.trim()) return;
    
    const leaderboard = getLeaderboard();
    const newEntry: LeaderboardEntry = {
      name: playerName.trim().substring(0, 10), // Limit name length
      score: gameState.score,
      timestamp: Date.now()
    };

    leaderboard.push(newEntry);
    // Sort descending by score
    leaderboard.sort((a, b) => b.score - a.score);
    // Keep top N
    const updatedLeaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
    
    saveLeaderboard(updatedLeaderboard);
    setIsScoreSaved(true);
    
    // Automatically go to leaderboard view after saving
    setTimeout(() => {
        setGameState(prev => ({ ...prev, status: 'leaderboard' }));
    }, 500);
  };

  // Game Flow Handlers
  const handleExitRequest = () => {
    if (gameState.status === 'playing') {
      setGameState(prev => ({ ...prev, isExitConfirmOpen: true }));
    }
  };

  const handleConfirmExit = () => {
    setGameState(prev => ({ ...prev, status: 'start', isExitConfirmOpen: false }));
    setActiveQuestions([]);
  };

  const handleCancelExit = () => {
    setGameState(prev => ({ ...prev, isExitConfirmOpen: false }));
  };

  const handleNext = useCallback(() => {
    setGameState(prev => {
      const nextIndex = prev.currentQuestionIndex + 1;
      if (nextIndex >= prev.totalQuestions) {
         return { ...prev, status: 'finished' };
      }
      return {
        ...prev,
        currentQuestionIndex: nextIndex,
        timeLeft: GAME_DURATION_SECONDS,
        selectedOptionId: null,
        isAnswerRevealed: false,
        isPaused: false,
        isHintActive: false,
      };
    });
  }, []);

  const executeAIAnswer = useCallback((currentState: GameState) => {
    if (aiAnsweredRef.current) return currentState;
    aiAnsweredRef.current = true;
    
    const config = AI_CONFIG[currentState.difficulty];
    const isCorrect = Math.random() < config.accuracy;
    
    const { score: newComputerScore, consecutive: newComputerConsecutive } = calculateNewScoreState(
      currentState.computerScore,
      currentState.computerConsecutiveCorrect,
      isCorrect,
      false
    );
    
    return {
      ...currentState,
      computerScore: newComputerScore,
      computerConsecutiveCorrect: newComputerConsecutive
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    if (gameState.isAnswerRevealed || gameState.isPaused || gameState.isExitConfirmOpen) return;

    if (gameState.timeLeft <= 0) {
      playSound('wrong'); // Timeout penalty
      setGameState(prev => {
        let nextState = prev.gameMode === 'pve' ? executeAIAnswer(prev) : prev;
        return {
          ...nextState,
          consecutiveCorrect: 0,
          // Timeout penalty: deduct 50, allowing negative scores.
          score: prev.score - 50,
          isAnswerRevealed: true,
        };
      });
      setTimeout(() => handleNext(), 1500);
      return;
    }

    if (gameState.gameMode === 'pve' && !aiAnsweredRef.current) {
       if (gameState.timeLeft <= aiTriggerTimeRef.current) {
         setGameState(prev => executeAIAnswer(prev));
       }
    }

    const timer = setInterval(() => {
      playSound('tick'); // Continuous tick
      setGameState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.timeLeft, gameState.isAnswerRevealed, gameState.isPaused, gameState.isExitConfirmOpen, gameState.status, gameState.gameMode, handleNext, executeAIAnswer]);

  const handlePause = () => {
    if (gameState.isAnswerRevealed || gameState.isExitConfirmOpen) return; 
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleHint = () => {
    if (gameState.isAnswerRevealed || gameState.isPaused || gameState.isHintActive || gameState.isExitConfirmOpen) return;
    playSound('correct'); // Hint activation sound as requested (positive feedback)
    setGameState(prev => ({
      ...prev,
      score: prev.score - 100, // Direct deduction, allows negative
      isHintActive: true,
    }));
  };

  const handleSelectOption = (id: string) => {
    if (gameState.isAnswerRevealed || gameState.isPaused || gameState.isExitConfirmOpen) return;
    
    const currentData = activeQuestions[gameState.currentQuestionIndex];
    if (!currentData) return;

    const isCorrect = currentData.options.find(o => o.id === id)?.isCorrect;

    // Play Sound immediately
    if (isCorrect) playSound('correct');
    else playSound('wrong');

    setGameState(prev => {
      const { score: newScore, consecutive: newConsecutive } = calculateNewScoreState(
        prev.score,
        prev.consecutiveCorrect,
        !!isCorrect,
        prev.isHintActive
      );
      
      let nextState = {
        ...prev,
        selectedOptionId: id,
        isAnswerRevealed: true,
        score: newScore,
        consecutiveCorrect: newConsecutive
      };

      if (prev.gameMode === 'pve' && !aiAnsweredRef.current) {
        nextState = executeAIAnswer(nextState);
      }
      return nextState;
    });

    setTimeout(() => handleNext(), 1500);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.status !== 'playing') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePause();
      } else if (e.code === 'KeyH') {
        handleHint();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        if (gameState.isExitConfirmOpen) {
          handleCancelExit();
        } else {
          handleExitRequest();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, gameState.isExitConfirmOpen, handlePause, handleHint, handleExitRequest, handleCancelExit]);

  const currentQuestionData = activeQuestions[gameState.currentQuestionIndex] || activeQuestions[0];

  // Dynamic Scale Calculation for Vertical Bars
  // Base scale 2000, grows dynamically.
  const maxScale = Math.max(gameState.score, gameState.computerScore, 2000) * 1.2;
  // Ensure percentages don't break with negative values
  const playerPct = Math.max(0, Math.min((gameState.score / maxScale) * 100, 100));
  const compPct = Math.max(0, Math.min((gameState.computerScore / maxScale) * 100, 100));

  // --- RENDER HELPERS ---

  // 1. Start Screen
  if (gameState.status === 'start') {
    return (
      <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center p-6 bg-transparent">
        <Background bgOffset={bgOffset} />
        
        {/* Transparent Container */}
        <div className="z-10 flex flex-col items-center gap-8 animate-float w-full max-w-5xl">
          {/* Bigger Logo: w-32 -> w-48/w-64 */}
          <div className="relative w-48 h-48 md:w-64 md:h-64 mb-2">
             {/* Glow Effect */}
             <div className="absolute inset-0 bg-white/40 blur-3xl rounded-full animate-pulse-fast"></div>
             <img 
               src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Globe%20Showing%20Europe-Africa.png" 
               alt="Earth"
               className="w-full h-full object-cover drop-shadow-2xl"
             />
          </div>
          
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-5xl md:text-8xl font-black text-white tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)] text-shadow-lg">
              地理知識王
            </h1>
            <p className="text-brand-dark/80 text-2xl font-bold tracking-wide drop-shadow-sm">
              挑戰世界，探索地圖
            </p>
          </div>

          {/* Glass Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <button onClick={() => handleModeSelect('single')} className="group relative w-full p-8 bg-white/20 hover:bg-white/40 border border-white/30 rounded-3xl backdrop-blur-md transition-all duration-300 active:scale-95 flex flex-col items-center gap-4 hover:shadow-xl hover:shadow-brand-sky/20">
               <div className="p-4 bg-white/40 rounded-full group-hover:scale-110 transition-transform shadow-inner">
                  <User className="w-12 h-12 text-brand-dark" />
                </div>
                <div className="flex flex-col items-center text-center text-brand-dark">
                   <span className="text-3xl font-bold tracking-wide">單人挑戰</span>
                   <span className="text-lg mt-1 font-medium opacity-80">自我挑戰，刷新紀錄</span>
                </div>
            </button>

            <button onClick={() => handleModeSelect('pve')} className="group relative w-full p-8 bg-white/20 hover:bg-white/40 border border-white/30 rounded-3xl backdrop-blur-md transition-all duration-300 active:scale-95 flex flex-col items-center gap-4 hover:shadow-xl hover:shadow-brand-peach/20">
                <div className="p-4 bg-white/40 rounded-full group-hover:scale-110 transition-transform shadow-inner">
                  <Bot className="w-12 h-12 text-brand-dark" />
                </div>
                <div className="flex flex-col items-center text-center text-brand-dark">
                   <span className="text-3xl font-bold tracking-wide">電腦對戰</span>
                   <span className="text-lg mt-1 font-medium opacity-80">與 AI 競速，爭奪冠軍</span>
                </div>
            </button>

            <button onClick={handleViewLeaderboard} className="group relative w-full p-8 bg-white/20 hover:bg-white/40 border border-white/30 rounded-3xl backdrop-blur-md transition-all duration-300 active:scale-95 flex flex-col items-center gap-4 hover:shadow-xl hover:shadow-brand-sun/20">
                <div className="p-4 bg-white/40 rounded-full group-hover:scale-110 transition-transform shadow-inner">
                  <ListOrdered className="w-12 h-12 text-brand-sun" />
                </div>
                <div className="flex flex-col items-center text-center text-brand-dark">
                   <span className="text-3xl font-bold tracking-wide">排行榜</span>
                   <span className="text-lg mt-1 font-medium opacity-80">單人模式歷史高分</span>
                </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Difficulty Selection Screen
  if (gameState.status === 'difficulty_select') {
    return (
      <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center p-6 bg-transparent">
        <Background bgOffset={bgOffset} />
        
        {/* Transparent Container */}
        <div className="z-10 flex flex-col items-center gap-8 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-500">
           <div className="text-center mb-4">
             <div className="w-24 h-24 bg-white/30 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-lg border border-white/40">
               <Bot className="w-12 h-12 text-white" />
             </div>
             <h2 className="text-5xl font-black text-white tracking-widest drop-shadow-md">選擇難度</h2>
             <p className="text-brand-dark text-xl mt-3 font-bold">選擇您的電腦對手強度</p>
           </div>

           {/* Transparent Grid */}
           <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
             {[
               { id: 1, label: '輕鬆 (Easy)', desc: '適合新手，節奏較慢', icon: Brain, color: 'emerald' },
               { id: 2, label: '普通 (Medium)', desc: '標準挑戰，各半機率', icon: Shield, color: 'blue' },
               { id: 3, label: '困難 (Hard)', desc: '反應迅速，極少犯錯', icon: Swords, color: 'orange' },
               { id: 4, label: '專家 (Expert)', desc: '幾乎完美，極限競速', icon: Zap, color: 'red' },
             ].map((diff) => (
               <button 
                 key={diff.id} 
                 onClick={() => handleDifficultySelect(diff.id as Difficulty)} 
                 className={`group relative w-full p-8 bg-white/30 hover:bg-white/50 rounded-3xl transition-all active:scale-95 flex items-center gap-6 backdrop-blur-md border border-white/40 shadow-sm hover:shadow-xl`}
               >
                  <div className={`w-16 h-16 rounded-2xl bg-white/40 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform`}>
                    <diff.icon className={`w-8 h-8 text-${diff.color}-600`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-brand-dark font-bold text-2xl">{diff.label}</div>
                    <div className="text-brand-dark/70 text-lg mt-1 font-medium">{diff.desc}</div>
                  </div>
               </button>
             ))}
           </div>

           <button onClick={() => setGameState(prev => ({ ...prev, status: 'start' }))} className="mt-8 text-white/80 hover:text-white text-lg font-bold transition-colors p-4 drop-shadow-md">
              返回主選單
           </button>
        </div>
      </div>
    );
  }

  // 3. Leaderboard Screen
  if (gameState.status === 'leaderboard') {
    const leaderboard = getLeaderboard();
    return (
      <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center p-6 bg-transparent">
        <Background bgOffset={bgOffset} />
        
        {/* White Glass Container */}
        <div className="z-10 w-full max-w-3xl h-[85vh] bg-white/20 backdrop-blur-xl rounded-[3rem] border border-white/40 p-10 flex flex-col shadow-2xl relative overflow-hidden text-brand-dark">
           
           {/* Header */}
           <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 bg-white/40 rounded-full flex items-center justify-center mb-4 shadow-lg border border-white/50">
                <Trophy className="w-12 h-12 text-brand-sun" />
              </div>
              <h2 className="text-4xl font-black text-white tracking-wider drop-shadow-md">每週排行榜</h2>
              <p className="text-brand-dark/70 text-sm mt-2 font-bold">每週一 00:00 自動重置</p>
           </div>

           {/* List */}
           <div className="flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
             {leaderboard.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-brand-dark/50 gap-4">
                 <ListOrdered className="w-20 h-20" />
                 <span className="text-2xl font-bold">暫無記錄，快來挑戰！</span>
               </div>
             ) : (
               leaderboard.map((entry, index) => (
                 // Transparent Rows
                 <div key={index} className={`flex items-center p-5 rounded-2xl ${index === 0 ? 'bg-brand-sun/30 border border-brand-sun/20' : index === 1 ? 'bg-slate-200/40' : index === 2 ? 'bg-orange-300/30' : 'bg-white/30'} transition-transform hover:scale-[1.01]`}>
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl font-black text-xl mr-5 ${index < 3 ? 'text-brand-dark bg-white/40' : 'text-slate-500 bg-white/20'}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-brand-dark font-bold text-2xl truncate">{entry.name}</div>
                      <div className="text-brand-dark/60 text-sm mt-1 font-medium">
                        {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <div className="text-3xl font-black text-brand-sun tabular-nums drop-shadow-sm">
                      {entry.score}
                    </div>
                 </div>
               ))
             )}
           </div>

           {/* Footer */}
           <div className="mt-8 pt-6 w-full">
             <button onClick={() => setGameState(prev => ({ ...prev, status: 'start' }))} className="w-full py-5 bg-white/40 hover:bg-white/60 text-brand-dark rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-colors backdrop-blur-md shadow-sm border border-white/40">
               <ChevronLeft className="w-8 h-8" />
               返回主選單
             </button>
           </div>
        </div>
      </div>
    );
  }

  // 4. Game Over Screen
  if (gameState.status === 'finished') {
    const isWin = gameState.gameMode === 'pve' && gameState.score > gameState.computerScore;
    const isDraw = gameState.gameMode === 'pve' && gameState.score === gameState.computerScore;
    const canSubmitScore = gameState.gameMode === 'single' && isHighScore(gameState.score) && !isScoreSaved;
    
    return (
      <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center p-6 bg-transparent">
        <Background bgOffset={bgOffset} />
        
        {/* White Glass Container */}
        <div className="z-10 w-full max-w-3xl bg-white/20 backdrop-blur-2xl rounded-[3rem] border border-white/40 p-12 flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-300">
          
          {/* Huge Trophy */}
          <div className="w-40 h-40 bg-brand-sun rounded-full flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(255,183,3,0.6)] animate-bounce border-4 border-white/50">
            <Trophy className="w-20 h-20 text-white fill-white" />
          </div>

          <h2 className="text-5xl font-black text-white mb-4 drop-shadow-md">挑戰完成！</h2>
          
          {gameState.gameMode === 'pve' ? (
             <div className="mb-8 w-full">
               <p className={`text-4xl font-bold mb-8 drop-shadow-sm ${isWin ? 'text-green-600' : isDraw ? 'text-gray-600' : 'text-red-500'}`}>
                 {isWin ? "你獲勝了！" : isDraw ? "平手！" : "電腦獲勝！"}
               </p>
               <div className="flex justify-around bg-white/30 rounded-3xl p-8 border border-white/20">
                 <div className="flex flex-col">
                   <span className="text-brand-dark/60 text-sm uppercase tracking-wider mb-2 font-bold">你的得分</span>
                   <span className="text-6xl font-black text-brand-dark drop-shadow-sm">{gameState.score}</span>
                 </div>
                 <div className="w-px bg-brand-dark/10"></div>
                 <div className="flex flex-col">
                   <span className="text-brand-dark/60 text-sm uppercase tracking-wider mb-2 font-bold">電腦得分</span>
                   <span className="text-6xl font-black text-brand-dark drop-shadow-sm">{gameState.computerScore}</span>
                 </div>
               </div>
             </div>
          ) : (
             <div className="flex flex-col gap-2 mb-8 w-full">
              <p className="text-brand-dark/80 text-xl mb-2 font-bold">單人挑戰結束</p>
              <div className="bg-white/30 rounded-3xl p-10 mb-4 backdrop-blur-md border border-white/20">
                <span className="text-brand-dark/60 text-lg uppercase tracking-widest block mb-4 font-bold">最終得分</span>
                {/* Huge Score Font */}
                <span className="text-8xl font-black text-brand-dark drop-shadow-sm">
                  {gameState.score}
                </span>
              </div>
              
              {/* High Score Submission Form - Transparent Inputs */}
              {canSubmitScore ? (
                <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 mt-4">
                  <div className="bg-brand-sun/20 rounded-2xl p-6 backdrop-blur-md border border-brand-sun/30">
                     <div className="flex items-center justify-center gap-3 mb-4 text-brand-sun font-bold text-xl drop-shadow-sm">
                       <Crown className="w-8 h-8 fill-current" />
                       <span>新高分紀錄！</span>
                     </div>
                     <div className="flex gap-3">
                       <input 
                         type="text" 
                         value={playerName}
                         onChange={(e) => setPlayerName(e.target.value)}
                         maxLength={10}
                         placeholder="輸入名字"
                         // Light Input
                         className="flex-1 h-16 bg-white/60 rounded-xl px-4 text-2xl text-brand-dark placeholder-brand-dark/40 text-center outline-none focus:bg-white/90 transition-all font-bold border border-white/40"
                       />
                       <button 
                         onClick={handleSaveScore}
                         disabled={!playerName.trim()}
                         className="h-16 w-16 bg-brand-sun hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center shadow-md"
                       >
                         <Save className="w-8 h-8" />
                       </button>
                     </div>
                  </div>
                  
                  {/* Skip Button - Transparent */}
                  <button 
                    onClick={handleRestartGame}
                    className="w-full py-5 bg-white/40 hover:bg-white/60 text-brand-dark hover:text-black rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 backdrop-blur-sm border border-white/30"
                  >
                    <LogOut className="w-6 h-6" />
                    跳過並退出
                  </button>
                </div>
              ) : isScoreSaved ? (
                 <div className="text-green-600 font-bold text-2xl mt-4 flex items-center justify-center gap-3 drop-shadow-sm">
                   <CheckCircle className="w-8 h-8" /> 已儲存紀錄
                 </div>
              ) : null}
             </div>
          )}

          {!canSubmitScore && (
            <div className="w-full flex gap-4 mt-4">
              <button 
                onClick={handleRestartGame}
                // Bigger Buttons
                className="flex-1 py-6 bg-white/80 hover:bg-white text-brand-dark rounded-3xl font-black text-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <RotateCcw className="w-8 h-8" strokeWidth={3} />
                {canSubmitScore ? "略過" : "主選單"}
              </button>
              {gameState.gameMode === 'single' && (
                <button 
                   onClick={handleViewLeaderboard}
                   className="flex-none w-24 bg-white/30 hover:bg-white/50 text-brand-dark rounded-3xl flex items-center justify-center backdrop-blur-md border border-white/30"
                >
                  <ListOrdered className="w-10 h-10" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Safety Check
  if (gameState.status === 'playing' && !currentQuestionData) {
    return null;
  }

  // 5. Playing Screen
  return (
    <div className="relative w-full h-screen overflow-hidden flex justify-center bg-transparent">
      <Background bgOffset={bgOffset} />

      {/* Main Game Container - Transparent */}
      <div className="relative w-full max-w-6xl h-full flex flex-col z-10 font-sans">
        
        <TopBar 
          gameMode={gameState.gameMode}
          timeLeft={gameState.timeLeft} 
          isPaused={gameState.isPaused}
          onPause={handlePause}
          onHint={handleHint}
          onExit={handleExitRequest}
        />

        {/* --- VERTICAL SIDEBARS (UPDATED: High Contrast) --- */}
        
        {/* Left Sidebar: Player */}
        <div className="absolute left-6 md:left-10 top-28 bottom-28 w-24 flex flex-col items-center z-[9999] pointer-events-none transition-all duration-300">
          <div className="mb-4 flex flex-col items-center bg-white/50 p-3 rounded-xl backdrop-blur-md w-full border border-white/60 shadow-sm">
            <span className="text-xs font-black text-black tracking-wider mb-1">YOU</span>
            <span className="text-4xl font-black text-black drop-shadow-sm tabular-nums">{displayScore}</span>
          </div>
          <div className="flex-1 w-6 bg-white/20 rounded-full relative overflow-hidden shadow-inner border border-white/30">
            <div 
              className="absolute bottom-0 w-full bg-gradient-to-t from-brand-sky via-blue-500 to-blue-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(142,202,230,0.8)]"
              style={{ height: `${playerPct}%` }}
            />
          </div>
        </div>

        {/* Right Sidebar: Computer */}
        {gameState.gameMode === 'pve' && (
          <div className="absolute right-6 md:right-10 top-28 bottom-28 w-24 flex flex-col items-center z-[9999] pointer-events-none transition-all duration-300">
            <div className="mb-4 flex flex-col items-center bg-white/50 p-3 rounded-xl backdrop-blur-md w-full border border-white/60 shadow-sm">
              <span className="text-xs font-black text-red-900 tracking-wider mb-1">CPU</span>
              <span className="text-4xl font-black text-black drop-shadow-sm tabular-nums">{displayCompScore}</span>
            </div>
            <div className="flex-1 w-6 bg-white/20 rounded-full relative overflow-hidden shadow-inner border border-white/30">
               <div 
                 className="absolute bottom-0 w-full bg-gradient-to-t from-red-600 via-red-500 to-orange-400 rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                 style={{ height: `${compPct}%` }}
               />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col justify-center items-center px-4 md:px-40 w-full relative z-10 transition-all duration-300">
          <QuestionCard 
            question={currentQuestionData}
            selectedOptionId={gameState.selectedOptionId}
            isAnswerRevealed={gameState.isAnswerRevealed}
            isHintActive={gameState.isHintActive}
            onSelectOption={handleSelectOption}
          />
          
          {gameState.isPaused && !gameState.isExitConfirmOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md rounded-3xl border border-white/50">
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="p-4 rounded-full bg-white/80 backdrop-blur-xl shadow-lg">
                  <Play className="w-10 h-10 text-brand-dark fill-current ml-1" />
                </div>
                <div className="text-brand-dark font-black text-3xl tracking-[0.2em] drop-shadow-md">
                  PAUSED
                </div>
              </div>
            </div>
          )}

          {gameState.isExitConfirmOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">確定要退出嗎？</h3>
                  <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    您確定要退出挑戰嗎？<br/>您的進度將會遺失。
                  </p>
                  <div className="flex gap-3 w-full">
                    <button onClick={handleCancelExit} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors active:scale-95">取消</button>
                    <button onClick={handleConfirmExit} className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-95">確認退出</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <FooterBar 
          current={gameState.currentQuestionIndex + 1}
          total={gameState.totalQuestions}
        />
      </div>

      {/* Keyboard Shortcuts Panel - Transparent Light */}
      {gameState.status === 'playing' && (
        <div className="hidden 2xl:flex fixed right-10 top-1/2 -translate-y-1/2 flex-col gap-4 p-6 bg-white/20 backdrop-blur-md rounded-3xl shadow-lg animate-in fade-in slide-in-from-right-10 duration-700 border border-white/30">
          <div className="flex items-center gap-2 mb-2 text-brand-dark pb-3 border-b border-brand-dark/10">
            <Keyboard className="w-5 h-5" />
            <span className="font-bold tracking-wider text-sm">快捷鍵指南</span>
          </div>
          
          <div className="space-y-4">
            <ShortcutRow keys={['1', '2', '3', '4']} label="選擇答案" />
            <ShortcutRow keys={['H']} label="使用提示" />
            <ShortcutRow keys={['Space']} label="暫停 / 繼續" />
            <ShortcutRow keys={['E']} label="退出挑戰" />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for shortcuts
const ShortcutRow = ({ keys, label }: { keys: string[], label: string }) => (
  <div className="flex items-center justify-between gap-8 group">
    <span className="text-brand-dark/80 text-sm font-medium tracking-wide group-hover:text-brand-dark transition-colors">{label}</span>
    <div className="flex gap-1.5">
      {keys.map((k, i) => (
        <kbd key={i} className="min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-white/40 rounded-[4px] text-[10px] font-bold text-brand-dark font-mono shadow-sm group-hover:bg-white/60 transition-all">
          {k}
        </kbd>
      ))}
    </div>
  </div>
);

// Updated Bright Background Component
const Background = ({ bgOffset }: { bgOffset: number }) => (
  <>
    {/* Vibrant Gradient Base (Z-Index -1) */}
    <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-brand-sky via-[#FCD5CE] to-brand-peach"></div>
    
    {/* Moving Map Texture - White overlay mode */}
    <div 
      className="absolute inset-0 z-0 opacity-15 pointer-events-none mix-blend-overlay"
      style={{
        backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')`,
        backgroundSize: 'cover',
        backgroundPosition: `${bgOffset}% center`,
        filter: 'invert(1)', // Invert black map to white for light background
      }}
    />

    {/* Floating Geometric Shapes/Glows - White/Light */}
    <div className="absolute top-[10%] left-[10%] w-[20vw] h-[20vw] bg-white/20 rounded-full blur-[80px] animate-float z-0 pointer-events-none"></div>
    <div className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] bg-brand-sun/20 rounded-full blur-[100px] animate-float-delayed z-0 pointer-events-none"></div>
    
    {/* Floating Particles (Dots) */}
    <div className="absolute top-[30%] left-[20%] w-3 h-3 bg-white/60 rounded-full animate-pulse-fast z-0 pointer-events-none"></div>
    <div className="absolute bottom-[40%] right-[30%] w-2 h-2 bg-white/50 rounded-full animate-float z-0 pointer-events-none"></div>
    <div className="absolute top-[60%] left-[80%] w-4 h-4 bg-white/40 rounded-full animate-float-delayed z-0 pointer-events-none"></div>
    
    {/* Subtle Grid Pattern Overlay */}
    <div className="absolute inset-0 z-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none"></div>
  </>
);

const CheckCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);

export default App;