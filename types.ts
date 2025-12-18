export interface Option {
  id: string;
  label: string; // A, B, C, D
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: number;
  country: string;
  capital: string;
  flagCode: string;
  flagUrl: string;
  questionText: string;
  isCapitalQuestion: boolean; 
  options: Option[];
  region?: string; // Added for weighted randomization (EastAsia vs Other)
}

export type GameStatus = 'start' | 'difficulty_select' | 'playing' | 'finished' | 'leaderboard'; // Added 'leaderboard'
export type GameMode = 'single' | 'pve'; 
export type Difficulty = 1 | 2 | 3 | 4; 

export interface GameState {
  status: GameStatus; 
  gameMode: GameMode; 
  difficulty: Difficulty; 
  score: number;
  computerScore: number; 
  consecutiveCorrect: number;
  computerConsecutiveCorrect: number; 
  currentQuestionIndex: number;
  totalQuestions: number;
  timeLeft: number;
  selectedOptionId: string | null;
  isAnswerRevealed: boolean;
  isPaused: boolean;
  isHintActive: boolean; 
  isExitConfirmOpen: boolean; 
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  timestamp: number;
}