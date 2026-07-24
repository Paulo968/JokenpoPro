export const CHOICES = ['pedra', 'papel', 'tesoura', 'lagarto', 'spock'];
export const NAMES = { pedra: 'Pedra', papel: 'Papel', tesoura: 'Tesoura', lagarto: 'Lagarto', spock: 'Spock' };
export const EMOJIS = { pedra: '✊', papel: '✋', tesoura: '✌️', lagarto: '🦎', spock: '🖖' };
export const RULES = {
  pedra: ['tesoura', 'lagarto'], papel: ['pedra', 'spock'], tesoura: ['papel', 'lagarto'],
  lagarto: ['spock', 'papel'], spock: ['tesoura', 'pedra']
};
export const COUNTERS = {
  pedra: ['papel', 'spock'], papel: ['tesoura', 'lagarto'], tesoura: ['pedra', 'spock'],
  lagarto: ['pedra', 'tesoura'], spock: ['papel', 'lagarto']
};
export const MODE_NAMES = { free: 'Jogo Livre', bestOf3: 'Melhor de 3', bestOf5: 'Melhor de 5' };
export const DIFFICULTY_NAMES = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', expert: 'Perito' };
export const DIFFICULTY_DESCRIPTION = {
  easy: 'Escolhas completamente aleatórias.',
  medium: 'Reage à sua última jogada, mas ainda comete erros.',
  hard: 'Analisa frequências e transições entre suas jogadas.',
  expert: 'Reconhece sequências de até três jogadas e combina vários modelos de previsão.'
};
export const MAX_HISTORY = 300;

const randomItem = items => items[Math.floor(Math.random() * items.length)];
const randomChoice = () => randomItem(CHOICES);
const counterFor = move => randomItem(COUNTERS[move]);

export function defaultState() {
  return {
    score: { player: 0, computer: 0 }, roundWins: { player: 0, computer: 0 },
    mode: 'free', difficulty: 'hard',
    theme: matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
    isMuted: false, fullHistory: [], aiMemory: []
  };
}

export function isValidRound(round) {
  return round && CHOICES.includes(round.player) && CHOICES.includes(round.computer) && ['player', 'computer', 'draw'].includes(round.winner);
}

export function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    score: { player: Number(raw.score?.player) || 0, computer: Number(raw.score?.computer) || 0 },
    roundWins: { player: Number(raw.roundWins?.player) || 0, computer: Number(raw.roundWins?.computer) || 0 },
    mode: MODE_NAMES[raw.mode] ? raw.mode : base.mode,
    difficulty: DIFFICULTY_NAMES[raw.difficulty] ? raw.difficulty : base.difficulty,
    theme: raw.theme === 'light' ? 'light' : 'dark',
    isMuted: Boolean(raw.isMuted),
    fullHistory: Array.isArray(raw.fullHistory) ? raw.fullHistory.filter(isValidRound).slice(-MAX_HISTORY) : [],
    aiMemory: Array.isArray(raw.aiMemory) ? raw.aiMemory.filter(choice => CHOICES.includes(choice)).slice(-60) : []
  };
}

export function getWinner(player, computer) {
  if (player === computer) return 'draw';
  return RULES[player].includes(computer) ? 'player' : 'computer';
}

function frequencyPrediction(history, windowSize = 24) {
  const recent = history.slice(-windowSize);
  if (!recent.length) return randomChoice();
  const counts = Object.fromEntries(CHOICES.map(choice => [choice, 0]));
  recent.forEach(choice => counts[choice]++);
  const max = Math.max(...Object.values(counts));
  return randomItem(CHOICES.filter(choice => counts[choice] === max));
}

function transitionPrediction(history) {
  if (history.length < 3) return null;
  const previous = history.at(-1);
  const counts = Object.fromEntries(CHOICES.map(choice => [choice, 0]));
  for (let index = 0; index < history.length - 1; index++) {
    if (history[index] === previous) counts[history[index + 1]]++;
  }
  const max = Math.max(...Object.values(counts));
  return max ? randomItem(CHOICES.filter(choice => counts[choice] === max)) : null;
}

function sequencePrediction(history) {
  for (let size = Math.min(3, history.length - 1); size >= 1; size--) {
    const pattern = history.slice(-size).join('|');
    const counts = Object.fromEntries(CHOICES.map(choice => [choice, 0]));
    for (let index = 0; index <= history.length - size - 1; index++) {
      if (history.slice(index, index + size).join('|') === pattern) counts[history[index + size]]++;
    }
    const max = Math.max(...Object.values(counts));
    if (max) return randomItem(CHOICES.filter(choice => counts[choice] === max));
  }
  return null;
}

export function getComputerChoice(state) {
  const history = state.aiMemory;
  if (state.difficulty === 'easy') return randomChoice();
  if (state.difficulty === 'medium') {
    return !history.length || Math.random() < .28 ? randomChoice() : counterFor(history.at(-1));
  }
  if (state.difficulty === 'hard') {
    if (history.length < 5 || Math.random() < .18) return randomChoice();
    return counterFor(transitionPrediction(history) || frequencyPrediction(history));
  }
  if (history.length < 7 || Math.random() < .12) return randomChoice();
  return counterFor(sequencePrediction(history) || transitionPrediction(history) || frequencyPrediction(history, 40));
}
