/**
 * Bubble Wrap Pop — Satisfying Relaxation Game
 * Logic implementation using Vanilla JS & Web Audio API
 */

// ==========================================================================
// 1. Audio Manager (Web Audio API Synthesizer)
// ==========================================================================
class SoundManager {
  constructor() {
    this.muted = localStorage.getItem('bubble_muted') === 'true';
    this.audioCtx = null;
    this.updateMuteUI();
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('bubble_muted', this.muted);
    this.updateMuteUI();
    
    // Play a tiny confirmation sound when unmuting
    if (!this.muted) {
      this.playPop(300); 
    }
    return this.muted;
  }

  updateMuteUI() {
    const soundOnIcon = document.getElementById('sound-on-icon');
    const soundOffIcon = document.getElementById('sound-off-icon');
    if (soundOnIcon && soundOffIcon) {
      if (this.muted) {
        soundOnIcon.classList.add('hidden');
        soundOffIcon.classList.remove('hidden');
      } else {
        soundOnIcon.classList.remove('hidden');
        soundOffIcon.classList.add('hidden');
      }
    }
  }

  /**
   * Synthesizes a realistic "pop" sound using a frequency sweep and noise click
   * @param {number} [customFreq] - Optional custom pitch frequency
   */
  playPop(customFreq) {
    if (this.muted) return;
    this.init();
    
    // Resume audio context if browser suspended it
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    
    // --- 1. SINE PITCH SWEEP (The main air pop resonance) ---
    const osc = this.audioCtx.createOscillator();
    const gainOsc = this.audioCtx.createGain();
    
    const baseFreq = customFreq || (180 + Math.random() * 50); // slight variation
    osc.type = 'sine';
    
    // Start high, sweep down fast
    osc.frequency.setValueAtTime(baseFreq * 3.5, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.035);
    
    // Short exponential decay envelope
    gainOsc.gain.setValueAtTime(0.45, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
    
    osc.connect(gainOsc);
    gainOsc.connect(this.audioCtx.destination);
    
    // --- 2. NOISE TRANSVERSE (The crisp plastic snap) ---
    // Tiny noise buffer (12ms of white noise)
    const bufferSize = this.audioCtx.sampleRate * 0.012;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // High-pass filter for the plastic texture click
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);
    
    const gainNoise = this.audioCtx.createGain();
    gainNoise.gain.setValueAtTime(0.28, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.005, now + 0.012);
    
    noiseSource.connect(filter);
    filter.connect(gainNoise);
    gainNoise.connect(this.audioCtx.destination);
    
    // Start and play transients
    osc.start(now);
    osc.stop(now + 0.09);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.015);
  }

  /**
   * Plays a success chime sequence when a sheet is fully popped
   */
  playLevelUp() {
    if (this.muted) return;
    this.init();
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const arpeggio = [329.63, 392.00, 523.25, 659.25]; // E5, G5, C6, E6
    
    arpeggio.forEach((freq, index) => {
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.07);
      
      gainNode.gain.setValueAtTime(0.18, now + index * 0.07);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * 0.07 + 0.25);
      
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      
      osc.start(now + index * 0.07);
      osc.stop(now + index * 0.07 + 0.28);
    });
  }
}

// Instantiate Sound Manager
const sound = new SoundManager();


// ==========================================================================
// 2. Global Game State
// ==========================================================================
const state = {
  // Config
  gameMode: 'timed', // 'timed' or 'zen'
  gameActive: false,
  score: 0,
  timeLeft: 60,
  level: 1,
  bubblesLeft: 100,
  totalBubbles: 100,
  sheetsCleared: 0,
  
  // Combo configuration
  comboCount: 0,
  maxCombo: 0,
  lastPopTime: 0,
  comboDuration: 1000, // ms to sustain combo
  
  // Storage
  bestScore: parseInt(localStorage.getItem('bubble_best_score') || '0', 10),
  totalPops: parseInt(localStorage.getItem('bubble_total_pops') || '0', 10),
  
  // Timer Reference
  timerInterval: null
};


// ==========================================================================
// 3. Canvas Elements and 2D Particle Loop
// ==========================================================================
const pCanvas = document.getElementById('particleCanvas');
const pCtx = pCanvas.getContext('2d');
const cCanvas = document.getElementById('confettiCanvas');
const cCtx = cCanvas.getContext('2d');

let particles = [];
let confettis = [];
let isAnimActive = false;

// Handle canvas resizing for Retina/High-DPI sharp rendering
function resizeCanvases() {
  const container = document.querySelector('.play-area-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  // Particle Canvas
  pCanvas.width = rect.width * dpr;
  pCanvas.height = rect.height * dpr;
  pCtx.resetTransform();
  pCtx.scale(dpr, dpr);
  pCanvas.style.width = `${rect.width}px`;
  pCanvas.style.height = `${rect.height}px`;

  // Confetti Canvas
  cCanvas.width = rect.width * dpr;
  cCanvas.height = rect.height * dpr;
  cCtx.resetTransform();
  cCtx.scale(dpr, dpr);
  cCanvas.style.width = `${rect.width}px`;
  cCanvas.style.height = `${rect.height}px`;
}

// Window resizing
window.addEventListener('resize', resizeCanvases);

/**
 * Spawns dynamic burst particles at bubble popping coordinate
 */
function spawnPopParticles(clientX, clientY) {
  const rect = pCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  
  const particleCount = 10 + Math.floor(Math.random() * 6);
  // Soft colors representing plastic shards & water droplets
  const colors = [
    'rgba(255, 255, 255, 0.85)',
    'rgba(255, 139, 148, 0.7)',  // pastel pink
    'rgba(168, 209, 255, 0.7)',  // pastel blue
    'rgba(168, 230, 207, 0.7)',  // pastel mint
    'rgba(255, 255, 255, 0.4)'
  ];

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.0, // slight upward launch bias
      radius: 1.5 + Math.random() * 3.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.93 + Math.random() * 0.04,
      gravity: 0.16,
      life: 0,
      maxLife: 25 + Math.random() * 20
    });
  }
  
  startAnimationLoop();
}

/**
 * Spawns cascading confetti shower on clear
 */
function spawnConfetti() {
  const rect = cCanvas.getBoundingClientRect();
  const confettiCount = 90;
  const colors = ['#ff8b94', '#a8e6cf', '#a8d1ff', '#ffd3b6', '#d8b4f8', '#ffffff'];

  for (let i = 0; i < confettiCount; i++) {
    confettis.push({
      x: Math.random() * rect.width,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 3,
      vy: 1.8 + Math.random() * 3.2,
      width: 5 + Math.random() * 5,
      height: 8 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      wobbleSpeed: 0.04 + Math.random() * 0.04,
      wobbleAngle: Math.random() * Math.PI * 2
    });
  }

  startAnimationLoop();
}

/**
 * Central animation manager using requestAnimationFrame
 */
function startAnimationLoop() {
  if (isAnimActive) return;
  isAnimActive = true;
  tick();
}

function tick() {
  let active = false;
  
  // Update particles
  if (particles.length > 0) {
    active = true;
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.decay;
      p.vy *= p.decay;
      p.alpha = Math.max(0, 1 - (p.life / p.maxLife));
      p.life++;
      
      pCtx.save();
      pCtx.globalAlpha = p.alpha;
      pCtx.fillStyle = p.color;
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.restore();
      
      if (p.life >= p.maxLife || p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  // Update confetti
  if (confettis.length > 0) {
    active = true;
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
    const rect = cCanvas.getBoundingClientRect();

    for (let i = confettis.length - 1; i >= 0; i--) {
      const c = confettis[i];
      c.y += c.vy;
      c.x += c.vx + Math.sin(c.wobbleAngle) * 0.4;
      c.wobbleAngle += c.wobbleSpeed;
      c.rotation += c.rotationSpeed;

      cCtx.save();
      cCtx.translate(c.x, c.y);
      cCtx.rotate(c.rotation);
      cCtx.fillStyle = c.color;
      cCtx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
      cCtx.restore();

      // Remove if falling below screen bounds
      if (c.y > rect.height + 20) {
        confettis.splice(i, 1);
      }
    }
  }

  if (active) {
    requestAnimationFrame(tick);
  } else {
    isAnimActive = false;
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
  }
}


// ==========================================================================
// 4. UI Screen Control Flows
// ==========================================================================
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const gameoverScreen = document.getElementById('gameover-screen');

function showScreen(screenId) {
  menuScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  gameoverScreen.classList.remove('active');
  
  if (screenId === 'menu') {
    menuScreen.classList.add('active');
    updateMenuHighScores();
  } else if (screenId === 'game') {
    gameScreen.classList.add('active');
    resizeCanvases();
  } else if (screenId === 'gameover') {
    gameoverScreen.classList.add('active');
  }
}


// ==========================================================================
// 5. Game Configuration & Sheet Sizing Rules
// ==========================================================================
/**
 * Resolves grid size (cols/rows) based on active Level
 */
function getGridDimensions(level) {
  // Caps level sizing for mobile responsiveness
  if (level === 1) return { cols: 8, rows: 8 };   // 64 bubbles
  if (level === 2) return { cols: 10, rows: 10 }; // 100 bubbles (Classic)
  if (level === 3) return { cols: 11, rows: 11 }; // 121 bubbles
  if (level === 4) return { cols: 12, rows: 12 }; // 144 bubbles
  return { cols: 13, rows: 13 }; // 169 bubbles maximum (keeps grid items interactive)
}


// ==========================================================================
// 6. Game Core Logic
// ==========================================================================
const bubbleGrid = document.getElementById('bubble-grid');
const sheetContainer = document.getElementById('sheet-container');

/**
 * Initializes and populates a new sheet of bubble wrap
 */
function createBubbleSheet(level) {
  // Lock grid inputs during refill transitions
  bubbleGrid.style.pointerEvents = 'none';
  
  const dim = getGridDimensions(level);
  const total = dim.cols * dim.rows;
  
  state.totalBubbles = total;
  state.bubblesLeft = total;
  
  // Set CSS grid variables
  bubbleGrid.style.setProperty('--grid-cols', dim.cols);
  bubbleGrid.style.setProperty('--grid-rows', dim.rows);
  
  // Tighter gaps on larger grids for fitting
  bubbleGrid.style.gap = dim.cols > 11 ? '5px' : dim.cols > 8 ? '7px' : '9px';
  
  // Refresh HTML contents
  bubbleGrid.innerHTML = '';
  
  // Document Fragment for high rendering performance
  const fragment = document.createDocumentFragment();
  
  for (let idx = 0; idx < total; idx++) {
    const bubbleEl = document.createElement('div');
    bubbleEl.classList.add('bubble', 'enter-animation');
    bubbleEl.setAttribute('tabindex', '0');
    
    // Row and column mapping for ripple entrance delay
    const row = Math.floor(idx / dim.cols);
    const col = idx % dim.cols;
    const delay = (row + col) * 15; // Wave effect delay
    bubbleEl.style.setProperty('--enter-delay', `${delay}ms`);
    
    // Core event handlers for pop interactions
    // Instant touch response
    bubbleEl.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      triggerPop(bubbleEl, e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    
    // Mouse clicks
    bubbleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      triggerPop(bubbleEl, e.clientX, e.clientY);
    });
    
    // Keyboard space/enter activation
    bubbleEl.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); // prevent scroll
        const rect = bubbleEl.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        triggerPop(bubbleEl, clientX, clientY);
      }
    });

    fragment.appendChild(bubbleEl);
  }
  
  bubbleGrid.appendChild(fragment);
  
  // Re-enable interactions after entrance wave
  const waveDuration = (dim.cols + dim.rows) * 15 + 300;
  setTimeout(() => {
    bubbleGrid.style.pointerEvents = 'all';
    // Remove enter animations to keep layout styling clean
    document.querySelectorAll('.bubble').forEach(b => b.classList.remove('enter-animation'));
  }, waveDuration);
  
  updateCounters();
}

/**
 * Handle bubble popping triggers
 */
function triggerPop(bubbleEl, clientX, clientY) {
  if (!state.gameActive || bubbleEl.classList.contains('popped')) return;
  
  // Mark as popped instantly
  bubbleEl.classList.add('popped', 'pop-animation');
  
  // Play synthesised audio
  sound.playPop();
  
  // Spawn physical particles
  spawnPopParticles(clientX, clientY);
  
  // Update state numbers
  state.bubblesLeft--;
  state.totalPops++;
  
  // Handle combo increments
  const now = Date.now();
  const elapsed = now - state.lastPopTime;
  
  if (elapsed < state.comboDuration) {
    state.comboCount++;
    if (state.comboCount > state.maxCombo) {
      state.maxCombo = state.comboCount;
    }
  } else {
    state.comboCount = 1;
  }
  state.lastPopTime = now;
  
  // Score calculations (Combos provide score bonus multipliers in Timed mode)
  const popPoints = state.gameMode === 'timed' ? state.comboCount : 1;
  state.score += popPoints;
  
  // Display floating popping info text
  createFloatingText(clientX, clientY, popPoints);
  
  // Grid visual vibration shake
  triggerScreenVibration();
  
  // Sync statistics and values
  updateCounters();
  
  // Save progressive details to localStorage
  localStorage.setItem('bubble_total_pops', state.totalPops);
  
  // Sheet clear evaluation
  if (state.bubblesLeft <= 0) {
    triggerSheetRefill();
  }
}

/**
 * Creates floating text at coordinate
 */
function createFloatingText(clientX, clientY, points) {
  const container = document.getElementById('floating-text-container');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  
  const fText = document.createElement('div');
  fText.classList.add('floating-text');
  
  if (state.gameMode === 'timed' && state.comboCount >= 3) {
    fText.innerText = `+${points} Combo x${state.comboCount}!`;
  } else {
    fText.classList.add('normal-pop');
    fText.innerText = `+1`;
  }
  
  fText.style.left = `${x}px`;
  fText.style.top = `${y}px`;
  
  container.appendChild(fText);
  
  // Remove node on animation complete
  fText.addEventListener('animationend', () => {
    fText.remove();
  });
}

/**
 * Screen vibration class triggers
 */
function triggerScreenVibration() {
  sheetContainer.classList.remove('shake');
  // force reflow
  void sheetContainer.offsetWidth;
  sheetContainer.classList.add('shake');
  
  // Hardware tactile response (if supported by device browser)
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

/**
 * Refreshes values inside the HUD labels
 */
function updateCounters() {
  document.getElementById('score-counter').innerText = state.score;
  document.getElementById('left-counter').innerText = state.bubblesLeft;
  document.getElementById('level-counter').innerText = state.level;
  
  // Score bump animation
  const scoreCounter = document.getElementById('score-counter');
  scoreCounter.classList.remove('scale-up');
  void scoreCounter.offsetWidth;
  scoreCounter.classList.add('scale-up');
  
  // Timed stats vs Zen mode togglers
  const timerBox = document.getElementById('timer-box');
  const timerVal = document.getElementById('timer-counter');
  const comboHUD = document.getElementById('combo-box');
  const comboVal = document.getElementById('combo-multiplier');
  
  if (state.gameMode === 'timed') {
    timerBox.classList.remove('hidden');
    timerVal.innerText = `${state.timeLeft}s`;
    
    if (state.comboCount >= 2) {
      comboHUD.classList.remove('combo-inactive');
      comboHUD.classList.add('combo-active');
      comboVal.innerText = `x${state.comboCount}`;
    } else {
      comboHUD.classList.remove('combo-active');
      comboHUD.classList.add('combo-inactive');
    }
  } else {
    // Zen Mode displays
    timerBox.classList.remove('hidden');
    timerVal.innerText = 'Zen 🧘';
    
    // Zen Mode Combo meter (just for pop feedback, no timer stress)
    if (state.comboCount >= 2) {
      comboHUD.classList.remove('combo-inactive');
      comboHUD.classList.add('combo-active');
      comboVal.innerText = `x${state.comboCount}`;
    } else {
      comboHUD.classList.remove('combo-active');
      comboHUD.classList.add('combo-inactive');
    }
  }
}

/**
 * Handles combo timer decay bar ticks
 */
function runComboTick() {
  if (!state.gameActive) return;
  
  if (state.comboCount >= 2) {
    const elapsed = Date.now() - state.lastPopTime;
    const pct = Math.max(0, 100 - (elapsed / state.comboDuration) * 100);
    const fill = document.getElementById('combo-bar-fill');
    if (fill) fill.style.width = `${pct}%`;
    
    if (pct <= 0) {
      state.comboCount = 1;
      updateCounters();
    }
  }
  
  requestAnimationFrame(runComboTick);
}

/**
 * Starts the countdown timer for Timed Challenge
 */
function startTimedCountdown() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  state.timerInterval = setInterval(() => {
    if (!state.gameActive) return;
    
    state.timeLeft--;
    updateCounters();
    
    // Alarm pulse when time is running out (under 10s)
    const timerCounter = document.getElementById('timer-counter');
    if (state.timeLeft <= 10) {
      timerCounter.style.color = '#ff6b8b';
      timerCounter.style.animation = 'comboPulse 0.5s infinite alternate';
    } else {
      timerCounter.style.color = '';
      timerCounter.style.animation = '';
    }
    
    if (state.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

/**
 * Sheet replenishment and transition animations
 */
function triggerSheetRefill() {
  state.sheetsCleared++;
  
  // Spawn shower confettis
  spawnConfetti();
  
  // Sound confirmation
  sound.playLevelUp();
  
  // Lock inputs
  bubbleGrid.style.pointerEvents = 'none';
  
  // Timed challenge levels scale sheet sizing up
  if (state.gameMode === 'timed') {
    state.level++;
  } else {
    // Zen level just acts as a progression counter
    state.level++;
  }
  
  // Refill animation transition overlay trigger
  const overlay = document.getElementById('refill-overlay');
  
  // Slide out old sheet
  sheetContainer.classList.add('slide-out');
  
  setTimeout(() => {
    // Activate loaders
    overlay.classList.add('active');
    
    setTimeout(() => {
      // Generate new layout sizes
      createBubbleSheet(state.level);
      
      // Hide loaders
      overlay.classList.remove('active');
      
      // Slide in new sheet
      sheetContainer.classList.remove('slide-out');
      sheetContainer.classList.add('slide-in');
      
      setTimeout(() => {
        sheetContainer.classList.remove('slide-in');
      }, 500);
      
    }, 800); // Loader displays duration
    
  }, 400); // Slide duration
}


// ==========================================================================
// 7. Game State Triggers (Start, Restart, End)
// ==========================================================================
function startGame(mode) {
  state.gameMode = mode;
  state.score = 0;
  state.level = 1;
  state.sheetsCleared = 0;
  state.comboCount = 0;
  state.maxCombo = 0;
  state.timeLeft = mode === 'timed' ? 60 : 0;
  state.gameActive = true;
  
  // Enable sound context initialization on first user tap
  sound.init();
  
  // UI controls based on active Mode
  const refillBtn = document.getElementById('btn-refill');
  const zenToggleBtn = document.getElementById('btn-zen-mode-toggle');
  
  if (mode === 'zen') {
    refillBtn.classList.remove('hidden');
    zenToggleBtn.classList.add('hidden');
  } else {
    refillBtn.classList.add('hidden');
    zenToggleBtn.classList.add('hidden');
  }
  
  // Reset time alarm styles
  const timerCounter = document.getElementById('timer-counter');
  timerCounter.style.color = '';
  timerCounter.style.animation = '';

  // Setup sheet
  createBubbleSheet(state.level);
  
  // Load Screen HUD
  showScreen('game');
  
  // Timers trigger
  if (mode === 'timed') {
    startTimedCountdown();
    runComboTick();
  } else {
    if (state.timerInterval) clearInterval(state.timerInterval);
    runComboTick();
  }
}

function endGame() {
  state.gameActive = false;
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  // Check high scores
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('bubble_best_score', state.bestScore);
  }
  
  // Fill Game Over HUD
  document.getElementById('final-score').innerText = state.score;
  document.getElementById('gameover-best').innerText = state.bestScore;
  document.getElementById('gameover-popped').innerText = state.score; // total pops matches score in timed mode
  document.getElementById('gameover-sheets').innerText = state.sheetsCleared;
  document.getElementById('gameover-combo').innerText = `x${state.maxCombo}`;
  
  showScreen('gameover');
}

function restartGame() {
  startGame(state.gameMode);
}

// ==========================================================================
// 8. Initialization & High Score Syncing
// ==========================================================================
function updateMenuHighScores() {
  document.getElementById('best-score-val').innerText = state.bestScore;
  document.getElementById('total-pops-val').innerText = state.totalPops;
}

// Initial high scores rendering
updateMenuHighScores();
showScreen('menu');


// ==========================================================================
// 9. Interactive Element Event Observers
// ==========================================================================
// Mode buttons selection
const timedBtn = document.getElementById('btn-mode-timed');
const zenBtn = document.getElementById('btn-mode-zen');

timedBtn.addEventListener('click', () => {
  timedBtn.classList.add('active');
  zenBtn.classList.remove('active');
  state.gameMode = 'timed';
});

zenBtn.addEventListener('click', () => {
  zenBtn.classList.add('active');
  timedBtn.classList.remove('active');
  state.gameMode = 'zen';
});

// Start button
document.getElementById('btn-start').addEventListener('click', () => {
  startGame(state.gameMode);
});

// Restart button
document.getElementById('btn-restart').addEventListener('click', () => {
  restartGame();
});

// Manual refill button (Zen mode exclusive)
document.getElementById('btn-refill').addEventListener('click', () => {
  if (state.gameMode === 'zen') {
    triggerSheetRefill();
  }
});

// Mute button toggler
document.getElementById('btn-mute').addEventListener('click', () => {
  sound.toggleMute();
});

// Home nav buttons
document.getElementById('btn-home').addEventListener('click', () => {
  state.gameActive = false;
  if (state.timerInterval) clearInterval(state.timerInterval);
  showScreen('menu');
});

document.getElementById('btn-menu').addEventListener('click', () => {
  showScreen('menu');
});

// Play again results button
document.getElementById('btn-play-again').addEventListener('click', () => {
  startGame(state.gameMode);
});
