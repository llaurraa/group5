import { Question } from './types';

export const GAME_DURATION_SECONDS = 10;
export const QUESTIONS_PER_GAME = 20; // Modified from 30 to 20 per user request

export const SOUTH_AFRICA_QUESTION: Question = {
  id: 3,
  country: "南非 (South Africa)",
  capital: "普勒托利亞",
  flagCode: "za",
  flagUrl: "https://flagcdn.com/w640/za.png", 
  questionText: "哪個氣候為副熱帶高地氣候的國家，國旗的 Y 字形代表國家整合，且以曼德拉的彩虹國度精神著稱？",
  isCapitalQuestion: true, 
  options: [
    { id: 'A', label: 'A', text: '奈及利亞', isCorrect: false },
    { id: 'B', label: 'B', text: '南非', isCorrect: true },
    { id: 'C', label: 'C', text: '巴西', isCorrect: false },
    { id: 'D', label: 'D', text: '澳洲', isCorrect: false },
  ]
};