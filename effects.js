export function createEffects(isMuted) {
  let audioContext = null;

  function initAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext?.state === 'suspended') audioContext.resume();
  }

  function playTone(type) {
    if (isMuted()) return;
    initAudio();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const settings = {
      click: [340, .035, 'sine'], draw: [440, .06, 'triangle'], win: [620, .1, 'triangle'],
      lose: [170, .12, 'square'], bigWin: [880, .2, 'triangle']
    }[type] || [400, .06, 'sine'];
    oscillator.type = settings[2];
    oscillator.frequency.setValueAtTime(settings[0], now);
    if (type === 'win' || type === 'bigWin') {
      oscillator.frequency.exponentialRampToValueAtTime(settings[0] * 1.8, now + settings[1]);
    }
    gain.gain.setValueAtTime(.07, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + settings[1]);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[1]);
  }

  function vibrate(type) {
    if (!navigator.vibrate) return;
    navigator.vibrate({ win: 70, lose: [35, 40, 35], bigWin: [80, 40, 80] }[type] || 0);
  }

  function launchConfetti(amount) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['var(--accent)', 'var(--win)', 'var(--draw)', 'var(--lose)'];
    for (let index = 0; index < amount; index++) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.top = `${-20 - Math.random() * 100}px`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty('--x', `${(Math.random() - .5) * 240}px`);
      piece.style.setProperty('--r', `${Math.random() * 900 - 450}deg`);
      piece.style.animationDelay = `${Math.random() * .22}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1500);
    }
  }

  return { initAudio, playTone, vibrate, launchConfetti };
}
