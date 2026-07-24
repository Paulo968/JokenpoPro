import {
  CHOICES, NAMES, EMOJIS, MODE_NAMES, DIFFICULTY_NAMES, DIFFICULTY_DESCRIPTION,
  MAX_HISTORY, defaultState, normalizeState, getWinner, getComputerChoice
} from './core.js';
import { createEffects } from './effects.js';

const STORAGE_KEY = 'jokenpoData';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  menuScreen: $('#menu-screen'), gameScreen: $('#game-screen'),
  playButton: $('#play-button'), statsButton: $('#stats-button'), rulesButton: $('#rules-button'), resetButton: $('#reset-button'), backButton: $('#back-button'),
  modeSelect: $('#mode-select'), difficultySelect: $('#difficulty-select'), themeToggle: $('#theme-toggle'), soundButton: $('#sound-button'),
  difficultyMenuDescription: $('#difficulty-menu-description'), difficultyGameDescription: $('#difficulty-game-description'), modeChip: $('#game-title'),
  playerScore: $('#player-score'), computerScore: $('#computer-score'), playerRoundDots: $('#player-round-dots'), computerRoundDots: $('#computer-round-dots'),
  resultMessage: $('#result-message'), playerChoice: $('#player-choice'), computerChoice: $('#computer-choice'), playerPod: $('#player-pod'), computerPod: $('#computer-pod'),
  choiceButtons: $$('.choice-button'), historyList: $('#history-list'), liveRegion: $('#live-region'),
  rulesDialog: $('#rules-dialog'), statsDialog: $('#stats-dialog'), resetDialog: $('#reset-dialog'), statsFilter: $('#stats-filter'), statsContent: $('#stats-content'),
  resetScoreConfirm: $('#reset-score-confirm'), resetAllConfirm: $('#reset-all-confirm'), toast: $('#toast'),
  connectionDot: $('#connection-dot'), connectionText: $('#connection-text'), installRow: $('#install-row'), installButton: $('#install-button')
};

let state = defaultState();
let busy = false;
let toastTimer = null;
let saveTimer = null;
let installPrompt = null;
const effects = createEffects(() => state.isMuted);

function loadState() {
  try { state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
  catch { state = defaultState(); }
}

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.warn('Não foi possível salvar o progresso:', error); }
  }, 180);
}

function setScreen(name) {
  const gameActive = name === 'game';
  elements.menuScreen.classList.toggle('active', !gameActive);
  elements.gameScreen.classList.toggle('active', gameActive);
  if (gameActive) {
    updateGameHeader();
    renderHistory();
    setTimeout(() => elements.choiceButtons[0].focus(), 230);
  } else {
    setTimeout(() => elements.playButton.focus(), 230);
  }
}

function applySettings() {
  elements.modeSelect.value = state.mode;
  elements.difficultySelect.value = state.difficulty;
  elements.themeToggle.checked = state.theme === 'light';
  document.body.classList.toggle('light', state.theme === 'light');
  elements.soundButton.textContent = state.isMuted ? '🔇 Desligado' : '🔈 Ligado';
  elements.soundButton.setAttribute('aria-pressed', String(state.isMuted));
  $('meta[name="theme-color"]').setAttribute('content', state.theme === 'light' ? '#f7f9fd' : '#111426');
  updateDifficultyDescriptions();
  updateGameHeader();
}

function updateDifficultyDescriptions() {
  const description = DIFFICULTY_DESCRIPTION[state.difficulty];
  elements.difficultyMenuDescription.textContent = description;
  elements.difficultyGameDescription.textContent = description;
}

function updateGameHeader() {
  elements.modeChip.textContent = `${MODE_NAMES[state.mode]} · ${DIFFICULTY_NAMES[state.difficulty]}`;
  elements.playerScore.textContent = state.score.player;
  elements.computerScore.textContent = state.score.computer;
  const winsNeeded = state.mode === 'bestOf3' ? 2 : state.mode === 'bestOf5' ? 3 : 0;
  elements.playerRoundDots.textContent = winsNeeded ? '●'.repeat(state.roundWins.player) + '○'.repeat(Math.max(0, winsNeeded - state.roundWins.player)) : '';
  elements.computerRoundDots.textContent = winsNeeded ? '●'.repeat(state.roundWins.computer) + '○'.repeat(Math.max(0, winsNeeded - state.roundWins.computer)) : '';
}

function setResult(message, type = '') {
  elements.resultMessage.textContent = message;
  elements.resultMessage.className = `result-message${type ? ` ${type}` : ''}`;
  elements.liveRegion.textContent = message;
}

function toggleChoices(disabled) {
  elements.choiceButtons.forEach(button => { button.disabled = disabled; });
}

function playRound(playerChoice) {
  if (busy) return;
  busy = true;
  toggleChoices(true);
  elements.playerPod.className = 'choice-pod';
  elements.computerPod.className = 'choice-pod thinking';
  elements.playerChoice.textContent = EMOJIS[playerChoice];
  elements.computerChoice.textContent = '❔';
  setResult('A IA está pensando…');
  effects.playTone('click');

  setTimeout(() => {
    const computerChoice = getComputerChoice(state);
    const winner = getWinner(playerChoice, computerChoice);
    state.aiMemory.push(playerChoice);
    state.aiMemory = state.aiMemory.slice(-60);
    state.fullHistory.push({ player: playerChoice, computer: computerChoice, winner, difficulty: state.difficulty, at: Date.now() });
    state.fullHistory = state.fullHistory.slice(-MAX_HISTORY);
    elements.computerPod.classList.remove('thinking');
    elements.computerChoice.textContent = EMOJIS[computerChoice];

    if (winner === 'player') {
      state.score.player++;
      if (state.mode !== 'free') state.roundWins.player++;
      elements.playerPod.classList.add('win');
      elements.computerPod.classList.add('lose');
      setResult('Você venceu a rodada!', 'win');
      animateScore(elements.playerScore);
      effects.playTone('win');
      effects.vibrate('win');
      effects.launchConfetti(36);
    } else if (winner === 'computer') {
      state.score.computer++;
      if (state.mode !== 'free') state.roundWins.computer++;
      elements.playerPod.classList.add('lose');
      elements.computerPod.classList.add('win');
      setResult('O PC venceu a rodada!', 'lose');
      animateScore(elements.computerScore);
      effects.playTone('lose');
      effects.vibrate('lose');
    } else {
      elements.playerPod.classList.add('draw');
      elements.computerPod.classList.add('draw');
      setResult('Empate!', 'draw');
      effects.playTone('draw');
    }

    updateGameHeader();
    renderHistory();
    saveState();
    if (!checkMatchWinner()) {
      busy = false;
      toggleChoices(false);
    }
  }, 260 + Math.random() * 310);
}

function checkMatchWinner() {
  const winsNeeded = state.mode === 'bestOf3' ? 2 : state.mode === 'bestOf5' ? 3 : 0;
  if (!winsNeeded) return false;
  let message = '';
  let playerWon = false;
  if (state.roundWins.player >= winsNeeded) {
    message = `Você venceu a série ${MODE_NAMES[state.mode]}!`;
    playerWon = true;
  } else if (state.roundWins.computer >= winsNeeded) {
    message = `O PC venceu a série ${MODE_NAMES[state.mode]}!`;
  }
  if (!message) return false;

  setResult(message, playerWon ? 'win' : 'lose');
  if (playerWon) {
    effects.launchConfetti(90);
    effects.playTone('bigWin');
    effects.vibrate('bigWin');
  }
  state.roundWins = { player: 0, computer: 0 };
  saveState();
  setTimeout(() => {
    updateGameHeader();
    setResult('Nova série: faça sua jogada!');
    busy = false;
    toggleChoices(false);
  }, 1900);
  return true;
}

function renderHistory() {
  const recent = state.fullHistory.slice(-12).reverse();
  if (!recent.length) {
    elements.historyList.innerHTML = '<div class="history-empty">As rodadas aparecerão aqui.</div>';
    return;
  }
  elements.historyList.innerHTML = recent.map(round => `
    <div class="history-item ${round.winner}">
      <span>${EMOJIS[round.player]} ${NAMES[round.player]}</span><span>×</span>
      <span>${EMOJIS[round.computer]} ${NAMES[round.computer]}</span>
      <span class="outcome">${round.winner === 'player' ? 'Vitória' : round.winner === 'computer' ? 'Derrota' : 'Empate'}</span>
    </div>`).join('');
}

function renderStats() {
  const filter = elements.statsFilter.value;
  const rounds = state.fullHistory.filter(round => filter === 'all' || round.difficulty === filter);
  const total = rounds.length;
  const wins = rounds.filter(round => round.winner === 'player').length;
  const losses = rounds.filter(round => round.winner === 'computer').length;
  const draws = total - wins - losses;
  const winRate = total ? Math.round(wins / total * 100) : 0;
  const counts = Object.fromEntries(CHOICES.map(choice => [choice, 0]));
  const moveWins = Object.fromEntries(CHOICES.map(choice => [choice, 0]));
  const nemesis = Object.fromEntries(CHOICES.map(choice => [choice, 0]));
  rounds.forEach(round => {
    counts[round.player]++;
    if (round.winner === 'player') moveWins[round.player]++;
    if (round.winner === 'computer') nemesis[round.computer]++;
  });
  const maxCount = Math.max(1, ...Object.values(counts));
  const favorite = total ? CHOICES.reduce((a, b) => counts[a] >= counts[b] ? a : b) : null;
  const best = CHOICES.filter(choice => counts[choice] >= 3)
    .sort((a, b) => moveWins[b] / counts[b] - moveWins[a] / counts[a])[0] || null;
  const worstEnemy = losses ? CHOICES.reduce((a, b) => nemesis[a] >= nemesis[b] ? a : b) : null;

  elements.statsContent.innerHTML = `
    <div class="stats-summary">
      <div class="stat-card"><span>Rodadas</span><strong>${total}</strong></div>
      <div class="stat-card"><span>Vitórias</span><strong style="color:var(--win)">${wins}</strong></div>
      <div class="stat-card"><span>Derrotas</span><strong style="color:var(--lose)">${losses}</strong></div>
      <div class="stat-card"><span>Aproveitamento</span><strong>${winRate}%</strong></div>
    </div>
    <section class="stats-section"><h3>Distribuição das suas jogadas</h3>
      <div class="bar-list">${CHOICES.map(choice => `
        <div class="bar-row"><span>${EMOJIS[choice]} ${NAMES[choice]}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${counts[choice] / maxCount * 100}%"></div></div>
          <strong>${counts[choice]}</strong></div>`).join('')}</div>
    </section>
    <section class="stats-section"><h3>Leitura tática</h3>
      <ul class="insight-list">
        <li>${total ? `Sua jogada favorita é <strong>${NAMES[favorite]}</strong>.` : 'Jogue algumas rodadas para gerar tendências.'}</li>
        <li>${best ? `Sua melhor taxa de vitória está com <strong>${NAMES[best]}</strong> (${Math.round(moveWins[best] / counts[best] * 100)}%).` : 'Use cada jogada pelo menos três vezes para descobrir sua arma mais eficiente.'}</li>
        <li>${worstEnemy ? `A jogada do PC que mais te derrotou foi <strong>${NAMES[worstEnemy]}</strong>.` : `Empates registrados: <strong>${draws}</strong>.`}</li>
      </ul>
    </section>`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function animateScore(element) {
  element.classList.remove('score-pop');
  void element.offsetWidth;
  element.classList.add('score-pop');
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  elements.connectionText.textContent = online ? 'Online' : 'Offline';
  elements.connectionDot.classList.toggle('offline', !online);
}

function resetScore() {
  state.score = { player: 0, computer: 0 };
  state.roundWins = { player: 0, computer: 0 };
  updateGameHeader();
  saveState();
  elements.resetDialog.close();
  showToast('Placar zerado.');
}

function resetAll() {
  const settings = { mode: state.mode, difficulty: state.difficulty, theme: state.theme, isMuted: state.isMuted };
  state = { ...defaultState(), ...settings };
  applySettings();
  renderHistory();
  saveState();
  elements.resetDialog.close();
  showToast('Histórico e placar apagados.');
}

function bindEvents() {
  elements.playButton.addEventListener('click', () => { effects.initAudio(); effects.playTone('click'); setScreen('game'); });
  elements.backButton.addEventListener('click', () => { effects.playTone('click'); setScreen('menu'); });
  elements.choiceButtons.forEach(button => button.addEventListener('click', () => playRound(button.dataset.choice)));
  elements.rulesButton.addEventListener('click', () => elements.rulesDialog.showModal());
  elements.statsButton.addEventListener('click', () => { elements.statsFilter.value = 'all'; renderStats(); elements.statsDialog.showModal(); });
  elements.resetButton.addEventListener('click', () => elements.resetDialog.showModal());
  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  [elements.rulesDialog, elements.statsDialog, elements.resetDialog].forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  });
  elements.statsFilter.addEventListener('change', renderStats);
  elements.resetScoreConfirm.addEventListener('click', resetScore);
  elements.resetAllConfirm.addEventListener('click', resetAll);

  elements.modeSelect.addEventListener('change', event => {
    state.mode = event.target.value;
    state.roundWins = { player: 0, computer: 0 };
    updateGameHeader();
    saveState();
  });
  elements.difficultySelect.addEventListener('change', event => {
    state.difficulty = event.target.value;
    updateDifficultyDescriptions();
    updateGameHeader();
    saveState();
  });
  elements.themeToggle.addEventListener('change', event => {
    state.theme = event.target.checked ? 'light' : 'dark';
    applySettings();
    saveState();
  });
  elements.soundButton.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    applySettings();
    if (!state.isMuted) effects.playTone('click');
    saveState();
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.gameScreen.classList.contains('active') && !$$('dialog').some(dialog => dialog.open)) setScreen('menu');
    if (!elements.gameScreen.classList.contains('active') || busy || event.ctrlKey || event.altKey || event.metaKey) return;
    const choice = { '1': 'pedra', '2': 'papel', '3': 'tesoura', '4': 'lagarto', '5': 'spock' }[event.key];
    if (choice) playRound(choice);
  });

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    elements.installRow.hidden = false;
  });
  elements.installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    elements.installRow.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    elements.installRow.hidden = true;
    showToast('Jokenpo Pro instalado!');
  });
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js')
    .catch(error => console.warn('Service Worker não registrado:', error)));
}

loadState();
applySettings();
renderHistory();
updateConnectionStatus();
bindEvents();
