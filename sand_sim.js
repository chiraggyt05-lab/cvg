/**
 * SandLab — Falling Sand Physics Simulator
 * Cellular Automata engine with HTML5 Canvas hardware scaling & Web Audio synthesis
 */

// ==========================================================================
// 1. Audio Synthesizer (Procedural Sound Generator)
// ==========================================================================
class SoundSynth {
  constructor() {
    this.muted = localStorage.getItem('sand_muted') === 'true';
    this.audioCtx = null;
    
    // Nodes
    this.sandGain = null;
    this.waterGain = null;
    this.lavaGain = null;
    
    this.updateMuteUI();
  }

  init() {
    if (this.audioCtx) return;
    
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = this.audioCtx.currentTime;

    // --- 1. SAND POURING SYNTH (Filtered pinkish noise crackle) ---
    const bufferSize = 2 * this.audioCtx.sampleRate;
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const sandNoise = this.audioCtx.createBufferSource();
    sandNoise.buffer = noiseBuffer;
    sandNoise.loop = true;

    const sandFilter = this.audioCtx.createBiquadFilter();
    sandFilter.type = 'bandpass';
    sandFilter.frequency.setValueAtTime(1400, now);
    sandFilter.Q.setValueAtTime(1.5, now);

    this.sandGain = this.audioCtx.createGain();
    this.sandGain.gain.setValueAtTime(0, now);

    sandNoise.connect(sandFilter);
    sandFilter.connect(this.sandGain);
    this.sandGain.connect(this.audioCtx.destination);
    sandNoise.start(0);

    // --- 2. WATER FLOWING SYNTH (Low gurgling LFO modulator) ---
    const waterOsc = this.audioCtx.createOscillator();
    waterOsc.type = 'sine';
    waterOsc.frequency.setValueAtTime(95, now);

    const waterMod = this.audioCtx.createOscillator();
    waterMod.type = 'sine';
    waterMod.frequency.setValueAtTime(6, now); // LFO Speed

    const waterModGain = this.audioCtx.createGain();
    waterModGain.gain.setValueAtTime(12, now); // Depth

    this.waterGain = this.audioCtx.createGain();
    this.waterGain.gain.setValueAtTime(0, now);

    waterMod.connect(waterModGain);
    waterModGain.connect(waterOsc.frequency);
    waterOsc.connect(this.waterGain);
    this.waterGain.connect(this.audioCtx.destination);
    waterOsc.start(0);
    waterMod.start(0);

    // --- 3. LAVA BUBBLING SYNTH (Deep lowpass rumble) ---
    const lavaNoise = this.audioCtx.createBufferSource();
    lavaNoise.buffer = noiseBuffer;
    lavaNoise.loop = true;

    const lavaFilter = this.audioCtx.createBiquadFilter();
    lavaFilter.type = 'lowpass';
    lavaFilter.frequency.setValueAtTime(90, now);

    this.lavaGain = this.audioCtx.createGain();
    this.lavaGain.gain.setValueAtTime(0, now);

    lavaNoise.connect(lavaFilter);
    lavaFilter.connect(this.lavaGain);
    this.lavaGain.connect(this.audioCtx.destination);
    lavaNoise.start(0);
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('sand_muted', this.muted);
    this.updateMuteUI();
    return this.muted;
  }

  updateMuteUI() {
    const soundOn = document.getElementById('sound-on-icon');
    const soundOff = document.getElementById('sound-off-icon');
    if (soundOn && soundOff) {
      if (this.muted) {
        soundOn.classList.add('hidden');
        soundOff.classList.remove('hidden');
      } else {
        soundOn.classList.remove('hidden');
        soundOff.classList.add('hidden');
      }
    }
  }

  /**
   * Adjusts volume gains smoothly based on simulation updates
   */
  updateActivitySounds(pouringSandCount, flowingWaterCount, flowingLavaCount) {
    if (this.muted) {
      this.silenceAll();
      return;
    }
    this.init();

    if (this.audioCtx.state === 'suspended') return;
    const now = this.audioCtx.currentTime;

    // Sand volume target
    const targetSandVal = Math.min(0.12, pouringSandCount * 0.001);
    this.sandGain.gain.setTargetAtTime(targetSandVal, now, 0.08);

    // Water volume target
    const targetWaterVal = Math.min(0.08, flowingWaterCount * 0.0006);
    this.waterGain.gain.setTargetAtTime(targetWaterVal, now, 0.15);

    // Lava volume target
    const targetLavaVal = Math.min(0.08, flowingLavaCount * 0.0008);
    this.lavaGain.gain.setTargetAtTime(targetLavaVal, now, 0.15);
  }

  silenceAll() {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (this.sandGain) this.sandGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.waterGain) this.waterGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.lavaGain) this.lavaGain.gain.setTargetAtTime(0, now, 0.05);
  }

  /**
   * Dynamic explosion shockwave sound
   */
  playExplosion() {
    if (this.muted) return;
    this.init();
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    const now = this.audioCtx.currentTime;
    
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.65);
    
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.75);
  }

  /**
   * Steam hiss splash noise
   */
  playSteamHiss() {
    if (this.muted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3500, now);
    osc.frequency.setValueAtTime(3200, now + 0.05);
    
    gainNode.gain.setValueAtTime(0.04, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

const sound = new SoundSynth();


// ==========================================================================
// 2. Simulator Grid Setup
// ==========================================================================
const CELL_SIZE = 4; // Screen pixel scale factor
let cols = 0;
let rows = 0;

let grid = null;      // Holds material cell types
let colorGrid = null; // Holds cached grain colors for 60fps rendering
let visited = null;   // Visited array to prevent double updates per frame

// Material Constants
const TYPE_EMPTY = 0;
const TYPE_SAND_YELLOW = 1;
const TYPE_SAND_WHITE = 2;
const TYPE_SAND_RED = 3;
const TYPE_SAND_BLUE = 4;
const TYPE_SAND_BLACK = 5;
const TYPE_SAND_RAINBOW = 6;
const TYPE_STONE = 7;
const TYPE_WATER = 8;
const TYPE_LAVA = 9;
const TYPE_GLASS = 10;
const TYPE_STEAM = 11;

const MATERIALS = {
  [TYPE_EMPTY]: { name: 'Air', colorRgb: [15, 23, 42], colorHex: '#0f172a' },
  [TYPE_SAND_YELLOW]: { name: 'Yellow Sand', colorRgb: [245, 158, 11], colorHex: '#f59e0b', powder: true },
  [TYPE_SAND_WHITE]: { name: 'White Sand', colorRgb: [241, 245, 249], colorHex: '#f1f5f9', powder: true },
  [TYPE_SAND_RED]: { name: 'Red Sand', colorRgb: [239, 68, 68], colorHex: '#ef4444', powder: true },
  [TYPE_SAND_BLUE]: { name: 'Blue Sand', colorRgb: [56, 189, 248], colorHex: '#38bdf8', powder: true },
  [TYPE_SAND_BLACK]: { name: 'Black Sand', colorRgb: [71, 85, 105], colorHex: '#475569', powder: true },
  [TYPE_SAND_RAINBOW]: { name: 'Rainbow Sand', colorRgb: [236, 72, 153], colorHex: '#ec4899', powder: true },
  [TYPE_STONE]: { name: 'Stone', colorRgb: [148, 163, 184], colorHex: '#94a3b8', solid: true },
  [TYPE_WATER]: { name: 'Water', colorRgb: [14, 165, 233], colorHex: '#0ea5e9', liquid: true },
  [TYPE_LAVA]: { name: 'Lava', colorRgb: [249, 115, 22], colorHex: '#f97316', liquid: true },
  [TYPE_GLASS]: { name: 'Glass', colorRgb: [165, 243, 252], colorHex: '#a5f3fc', solid: true },
  [TYPE_STEAM]: { name: 'Steam', colorRgb: [203, 213, 225], colorHex: '#cbd5e1', gas: true }
};


// ==========================================================================
// 3. User Parameters and Controls state
// ==========================================================================
const state = {
  activeMaterial: TYPE_SAND_YELLOW,
  brushSize: 12,
  flowRate: 60,
  activeTool: 'draw', // 'draw', 'explosion', 'wind', 'vacuum', 'fountain'
  isPaused: false,
  rainMode: false,
  slowMoMode: false,
  timeSpeed: 1.0,
  gravityDir: 'down', // 'down', 'none', 'up', 'left', 'right'
  windActive: false
};


// ==========================================================================
// 4. Initialization and Resizing
// ==========================================================================
const canvas = document.getElementById('sandCanvas');
const ctx = canvas.getContext('2d');

// Buffer canvases for lightning fast ImageData scaling
let bufferCanvas = document.createElement('canvas');
let bufferCtx = bufferCanvas.getContext('2d');

function initSimulator() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  canvas.width = w;
  canvas.height = h;

  // Compute scale grid cells based on window bounds
  // Cap at 280x200 grid for max mobile updating speed
  const newCols = Math.min(280, Math.ceil(w / CELL_SIZE));
  const newRows = Math.min(200, Math.ceil(h / CELL_SIZE));

  if (cols !== newCols || rows !== newRows) {
    const oldGrid = grid;
    const oldColorGrid = colorGrid;
    const oldCols = cols;
    const oldRows = rows;

    grid = new Int8Array(newCols * newRows);
    colorGrid = new Int32Array(newCols * newRows);
    visited = new Uint8Array(newCols * newRows);

    cols = newCols;
    rows = newRows;

    bufferCanvas.width = newCols;
    bufferCanvas.height = newRows;

    // Retain previous simulation designs on resize
    if (oldGrid) {
      const minC = Math.min(oldCols, newCols);
      const minR = Math.min(oldRows, newRows);
      for (let y = 0; y < minR; y++) {
        for (let x = 0; x < minC; x++) {
          const oldIdx = y * oldCols + x;
          const newIdx = y * newCols + x;
          grid[newIdx] = oldGrid[oldIdx];
          colorGrid[newIdx] = oldColorGrid[oldIdx];
        }
      }
    }
  }
}

window.addEventListener('resize', initSimulator);
initSimulator();


// ==========================================================================
// 5. Materials Color Variation & Rainbow Wheel Ticks
// ==========================================================================
/**
 * Calculates a slightly randomized RGB color around material color to give grains realistic textures
 */
function getMaterialVariantColor(type, customHue = 0) {
  const mat = MATERIALS[type];
  if (!mat) return 0;
  
  let rgb = [...mat.colorRgb];
  
  // Rainbow shifting colors logic
  if (type === TYPE_SAND_RAINBOW) {
    rgb = hslToRgb(customHue / 360, 0.85, 0.55);
  }

  // Soft deviation
  const variance = type === TYPE_LAVA ? 30 : 15;
  const r = Math.min(255, Math.max(0, rgb[0] + Math.floor((Math.random() - 0.5) * variance)));
  const g = Math.min(255, Math.max(0, rgb[1] + Math.floor((Math.random() - 0.5) * variance)));
  const b = Math.min(255, Math.max(0, rgb[2] + Math.floor((Math.random() - 0.5) * variance)));

  return (r << 16) | (g << 8) | b;
}

/**
 * HSL color converter helper for rainbows
 */
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}


// ==========================================================================
// 6. Cellular Automata Physics Equations
// ==========================================================================
let steamHissCooldown = 0;

function updatePhysics() {
  visited.fill(0);
  
  if (steamHissCooldown > 0) steamHissCooldown--;

  // Configure update traversal directions based on gravity direction
  // to make sure sand falls down naturally without teleporting in one step.
  const isUp = state.gravityDir === 'up';
  const isLeft = state.gravityDir === 'left';
  const isRight = state.gravityDir === 'right';
  const isNone = state.gravityDir === 'none';

  let yStart = rows - 1;
  let yEnd = -1;
  let yStep = -1;

  if (isUp) {
    yStart = 0;
    yEnd = rows;
    yStep = 1;
  }

  // Iterate columns randomly on each row to prevent falling sand bias
  const xOrder = new Int32Array(cols);
  for (let i = 0; i < cols; i++) xOrder[i] = i;

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  // Sound counters
  let activeSand = 0;
  let activeWater = 0;
  let activeLava = 0;

  for (let y = yStart; y !== yEnd; y += yStep) {
    shuffle(xOrder);
    for (let i = 0; i < cols; i++) {
      const x = xOrder[i];
      const idx = y * cols + x;
      const type = grid[idx];

      if (type === TYPE_EMPTY || visited[idx] === 1) continue;

      // Update positions based on materials properties
      if (MATERIALS[type].powder) {
        if (updatePowder(x, y, idx, type)) activeSand++;
      } else if (MATERIALS[type].liquid) {
        if (type === TYPE_WATER) {
          if (updateWater(x, y, idx)) activeWater++;
        } else if (type === TYPE_LAVA) {
          if (updateLava(x, y, idx)) activeLava++;
        }
      } else if (MATERIALS[type].gas) {
        updateGas(x, y, idx);
      }
    }
  }

  // Trigger sound engine
  sound.updateActivitySounds(activeSand, activeWater, activeLava);
}

/**
 * Sand Gravity & Sliding Slopes Physics
 */
function updatePowder(x, y, idx, type) {
  // Get gravity direction vectors
  const vec = getGravityVector();
  const targetX = x + vec.x;
  const targetY = y + vec.y;

  if (isValid(targetX, targetY)) {
    const destIdx = targetY * cols + targetX;
    const destType = grid[destIdx];

    // 1. Fall directly down into empty space
    if (destType === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return true;
    }
    
    // 2. Sink in liquids (sand sinks in water / lava)
    if (MATERIALS[destType].liquid) {
      swapCells(idx, destIdx);
      return true;
    }
  }

  // 3. Slide down diagonals slopes
  const diagX = Math.random() < 0.5 ? -1 : 1;
  
  // Vector diagonals based on gravity direction
  let sX1 = x + vec.x + diagX;
  let sY1 = y + vec.y + (vec.x !== 0 ? diagX : 0);
  let sX2 = x + vec.x - diagX;
  let sY2 = y + vec.y - (vec.x !== 0 ? diagX : 0);

  if (vec.x !== 0) {
    // Sideways gravity swaps diagonals coordinates
    sX1 = x + vec.x;
    sY1 = y + diagX;
    sX2 = x + vec.x;
    sY2 = y - diagX;
  }

  // Try first diagonal
  if (isValid(sX1, sY1)) {
    const destIdx = sY1 * cols + sX1;
    const destType = grid[destIdx];
    if (destType === TYPE_EMPTY || MATERIALS[destType].liquid) {
      swapCells(idx, destIdx);
      return true;
    }
  }

  // Try second diagonal
  if (isValid(sX2, sY2)) {
    const destIdx = sY2 * cols + sX2;
    const destType = grid[destIdx];
    if (destType === TYPE_EMPTY || MATERIALS[destType].liquid) {
      swapCells(idx, destIdx);
      return true;
    }
  }

  return false;
}

/**
 * Water flow dynamics (flows fast horizontally)
 */
function updateWater(x, y, idx) {
  const vec = getGravityVector();
  const targetX = x + vec.x;
  const targetY = y + vec.y;

  if (isValid(targetX, targetY)) {
    const destIdx = targetY * cols + targetX;
    const destType = grid[destIdx];
    
    // 1. Direct fall
    if (destType === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return true;
    }
    
    // 2. Reaction with Lava below
    if (destType === TYPE_LAVA) {
      triggerLavaWaterReaction(idx, destIdx);
      return true;
    }
  }

  // 3. Check diagonals
  const diagX = Math.random() < 0.5 ? -1 : 1;
  let sX1 = x + vec.x + diagX;
  let sY1 = y + vec.y + (vec.x !== 0 ? diagX : 0);
  
  if (vec.x !== 0) {
    sX1 = x + vec.x;
    sY1 = y + diagX;
  }

  if (isValid(sX1, sY1)) {
    const destIdx = sY1 * cols + sX1;
    if (grid[destIdx] === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return true;
    }
  }

  // 4. Horizontal spread (flowing sideways)
  // Water checks multiple steps to flow faster
  const flowDir = Math.random() < 0.5 ? -1 : 1;
  const flowStepX = vec.x === 0 ? flowDir : 0;
  const flowStepY = vec.x !== 0 ? flowDir : 0;

  const flowDist = 4; // Flow rate speed cells
  let furthestX = x;
  let furthestY = y;

  for (let step = 1; step <= flowDist; step++) {
    const checkX = x + flowStepX * step;
    const checkY = y + flowStepY * step;
    if (isValid(checkX, checkY) && grid[checkY * cols + checkX] === TYPE_EMPTY) {
      furthestX = checkX;
      furthestY = checkY;
    } else {
      break;
    }
  }

  if (furthestX !== x || furthestY !== y) {
    const destIdx = furthestY * cols + furthestX;
    swapCells(idx, destIdx);
    return true;
  }

  // 5. Flow reaction with adjacent Lava
  const neighbors = getNeighbors(x, y);
  for (let n of neighbors) {
    if (grid[n] === TYPE_LAVA) {
      triggerLavaWaterReaction(idx, n);
      return true;
    }
  }

  return false;
}

/**
 * Lava flow dynamics (viscous, burns, sets off steam)
 */
function updateLava(x, y, idx) {
  // Lava flows slowly (20% update speed tick)
  if (Math.random() > 0.18) return false;

  const vec = getGravityVector();
  const targetX = x + vec.x;
  const targetY = y + vec.y;

  if (isValid(targetX, targetY)) {
    const destIdx = targetY * cols + targetX;
    const destType = grid[destIdx];
    
    // 1. Direct fall
    if (destType === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return true;
    }
    
    // 2. React with water below
    if (destType === TYPE_WATER) {
      triggerLavaWaterReaction(destIdx, idx);
      return true;
    }
  }

  // 3. React with adjacent elements (Water / Sand)
  const neighbors = getNeighbors(x, y);
  for (let n of neighbors) {
    const nType = grid[n];
    if (nType === TYPE_WATER) {
      triggerLavaWaterReaction(n, idx);
      return true;
    }
    // Lava melts sand into stone/glass or darkens it
    if (MATERIALS[nType] && MATERIALS[nType].powder) {
      if (Math.random() < 0.05) {
        grid[n] = Math.random() < 0.4 ? TYPE_GLASS : TYPE_STONE;
        colorGrid[n] = getMaterialVariantColor(grid[n]);
      } else {
        // Scorch color darkening
        const c = colorGrid[n];
        const r = Math.max(10, ((c >> 16) & 255) - 30);
        const g = Math.max(10, ((c >> 8) & 255) - 30);
        const b = Math.max(10, (c & 255) - 30);
        colorGrid[n] = (r << 16) | (g << 8) | b;
      }
    }
  }

  // 4. Slow horizontal flow
  const flowDir = Math.random() < 0.5 ? -1 : 1;
  const sX = x + (vec.x === 0 ? flowDir : 0);
  const sY = y + (vec.x !== 0 ? flowDir : 0);

  if (isValid(sX, sY)) {
    const destIdx = sY * cols + sX;
    if (grid[destIdx] === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return true;
    }
  }

  return false;
}

/**
 * Steam gas dynamics (rises upwards, dissipates)
 */
function updateGas(x, y, idx) {
  // Gas moves up (against gravity)
  const vec = getGravityVector();
  // Reverse gravity direction
  const targetX = x - vec.x;
  const targetY = y - vec.y;

  // Dissipation chance (3.5% per tick)
  if (Math.random() < 0.035) {
    grid[idx] = TYPE_EMPTY;
    colorGrid[idx] = 0;
    return;
  }

  // Rise directly
  if (isValid(targetX, targetY)) {
    const destIdx = targetY * cols + targetX;
    if (grid[destIdx] === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return;
    }
  }

  // Diagonal drift
  const diagX = Math.random() < 0.5 ? -1 : 1;
  const sX = x - vec.x + (vec.x === 0 ? diagX : 0);
  const sY = y - vec.y + (vec.x !== 0 ? diagX : 0);

  if (isValid(sX, sY)) {
    const destIdx = sY * cols + sX;
    if (grid[destIdx] === TYPE_EMPTY) {
      swapCells(idx, destIdx);
      return;
    }
  }
}

/**
 * Handles Lava & Water physical interaction
 */
function triggerLavaWaterReaction(waterIdx, lavaIdx) {
  // Lava cools to Stone
  grid[lavaIdx] = TYPE_STONE;
  colorGrid[lavaIdx] = getMaterialVariantColor(TYPE_STONE);
  
  // Water turns to Steam (gas)
  grid[waterIdx] = TYPE_STEAM;
  colorGrid[waterIdx] = getMaterialVariantColor(TYPE_STEAM);
  
  // Play procedural splash audio
  if (steamHissCooldown === 0) {
    sound.playSteamHiss();
    steamHissCooldown = 8; // limit hiss rate to avoid noise clipping
  }
}


// ==========================================================================
// 7. Grid Helpers
// ==========================================================================
function isValid(x, y) {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

function swapCells(a, b) {
  const tempType = grid[a];
  const tempColor = colorGrid[a];

  grid[a] = grid[b];
  colorGrid[a] = colorGrid[b];

  grid[b] = tempType;
  colorGrid[b] = tempColor;

  visited[a] = 1;
  visited[b] = 1;
}

function getGravityVector() {
  switch (state.gravityDir) {
    case 'up': return { x: 0, y: -1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    case 'none': return { x: 0, y: 0 };
    case 'down':
    default:
      return { x: 0, y: 1 };
  }
}

function getNeighbors(x, y) {
  const list = [];
  const coords = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 }
  ];
  for (let c of coords) {
    if (isValid(c.x, c.y)) {
      list.push(c.y * cols + c.x);
    }
  }
  return list;
}


// ==========================================================================
// 8. Continuous Paint Drawing Intersections
// ==========================================================================
let mousePressed = false;
let mouseX = 0;
let mouseY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let rainbowHue = 0;

// Cursor draw trigger coordinates
function handleDraw(xStart, yStart, xEnd, yEnd) {
  // Convert window coordinates to grid cell coordinates
  const rect = canvas.getBoundingClientRect();
  
  const gX1 = Math.floor(((xStart - rect.left) / rect.width) * cols);
  const gY1 = Math.floor(((yStart - rect.top) / rect.height) * rows);
  const gX2 = Math.floor(((xEnd - rect.left) / rect.width) * cols);
  const gY2 = Math.floor(((yEnd - rect.top) / rect.height) * rows);

  // Bresenham's Line Algorithm to interpolate between drag steps
  const dx = Math.abs(gX2 - gX1);
  const dy = Math.abs(gY2 - gY1);
  const sx = (gX1 < gX2) ? 1 : -1;
  const sy = (gY1 < gY2) ? 1 : -1;
  let err = dx - dy;

  let cx = gX1;
  let cy = gY1;

  while (true) {
    applyToolAt(cx, cy);

    if (cx === gX2 && cy === gY2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

/**
 * Executes painting tools inside coordinates
 */
function applyToolAt(gridX, gridY) {
  const r = state.brushSize;
  const rSq = r * r;

  // Calculate bounding grid coordinates
  const minX = Math.max(0, gridX - r);
  const maxX = Math.min(cols - 1, gridX + r);
  const minY = Math.max(0, gridY - r);
  const maxY = Math.min(rows - 1, gridY + r);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - gridX;
      const dy = y - gridY;
      
      // Inside circle brush size
      if (dx * dx + dy * dy <= rSq) {
        const idx = y * cols + x;

        // 1. Paint Brush Tool
        if (state.activeTool === 'draw') {
          // Flow density probability filter
          if (Math.random() * 100 > state.flowRate) continue;
          
          if (grid[idx] === TYPE_EMPTY) {
            grid[idx] = state.activeMaterial;
            colorGrid[idx] = getMaterialVariantColor(state.activeMaterial, rainbowHue);
          }
        }
        
        // 2. Vacuum Eraser Tool
        else if (state.activeTool === 'vacuum') {
          grid[idx] = TYPE_EMPTY;
          colorGrid[idx] = 0;
        }

        // 3. Wind Blow Tool
        else if (state.activeTool === 'wind') {
          if (grid[idx] !== TYPE_EMPTY && !MATERIALS[grid[idx]].solid) {
            // Push cells horizontally
            const driftX = x + (Math.random() < 0.85 ? 2 : 1);
            if (isValid(driftX, y) && grid[y * cols + driftX] === TYPE_EMPTY) {
              swapCells(idx, y * cols + driftX);
            }
          }
        }
      }
    }
  }

  // 4. Explosion Shockwave tool (one click burst)
  if (state.activeTool === 'explosion') {
    sound.playExplosion();
    triggerExplosion(gridX, gridY, r * 1.6);
    triggerScreenShake();
    // Revert tool back to draw after single blast
    setActiveTool('draw');
  }
}

/**
 * Explosion shockwave pushes particles outwards
 */
function triggerExplosion(cx, cy, radius) {
  const rSq = radius * radius;
  
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(cols - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(rows - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dSq = dx * dx + dy * dy;
      
      if (dSq <= rSq) {
        const idx = y * cols + x;
        if (grid[idx] === TYPE_EMPTY) continue;
        
        // Close range vaporizes elements into steam
        if (dSq < rSq * 0.35 && grid[idx] !== TYPE_STONE) {
          grid[idx] = TYPE_STEAM;
          colorGrid[idx] = getMaterialVariantColor(TYPE_STEAM);
          continue;
        }

        // Blast radius pushes powder & liquids away
        if (!MATERIALS[grid[idx]].solid) {
          const angle = Math.atan2(dy, dx);
          // Blast distance
          const blastDist = Math.ceil(3 + Math.random() * 8);
          const pushX = Math.round(x + Math.cos(angle) * blastDist);
          const pushY = Math.round(y + Math.sin(angle) * blastDist);
          
          if (isValid(pushX, pushY) && grid[pushY * cols + pushX] === TYPE_EMPTY) {
            swapCells(idx, pushY * cols + pushX);
          }
        }
      }
    }
  }
}

// Canvas mouse/touch observers
canvas.addEventListener('mousedown', (e) => {
  mousePressed = true;
  sound.init(); // Initialize audio context on first click
  
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX;
  mouseY = e.clientY;
  lastMouseX = mouseX;
  lastMouseY = mouseY;

  handleDraw(lastMouseX, lastMouseY, mouseX, mouseY);
});

canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (mousePressed) {
    handleDraw(lastMouseX, lastMouseY, mouseX, mouseY);
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
});

window.addEventListener('mouseup', () => {
  mousePressed = false;
  sound.silenceAll();
});

// Mobile Touch support
canvas.addEventListener('touchstart', (e) => {
  mousePressed = true;
  sound.init();
  const touch = e.touches[0];
  mouseX = touch.clientX;
  mouseY = touch.clientY;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  handleDraw(lastMouseX, lastMouseY, mouseX, mouseY);
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  mouseX = touch.clientX;
  mouseY = touch.clientY;
  if (mousePressed) {
    handleDraw(lastMouseX, lastMouseY, mouseX, mouseY);
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}, { passive: true });

window.addEventListener('touchend', () => {
  mousePressed = false;
  sound.silenceAll();
});


// ==========================================================================
// 9. Special Feature Tools (Rain, Fountain, Wind, Screenshake)
// ==========================================================================
let screenShakeActive = false;

function triggerScreenShake() {
  canvas.style.transform = 'translate(6px, -4px)';
  setTimeout(() => {
    canvas.style.transform = 'translate(-6px, 6px)';
    setTimeout(() => {
      canvas.style.transform = 'translate(4px, -2px)';
      setTimeout(() => {
        canvas.style.transform = 'none';
      }, 50);
    }, 50);
  }, 50);
}

/**
 * Rain spawns random particles from sky
 */
function handleSkyRain() {
  if (!state.rainMode || state.isPaused) return;

  const dropsCount = Math.floor(1 + Math.random() * 3);
  for (let i = 0; i < dropsCount; i++) {
    const rx = Math.floor(Math.random() * cols);
    const ry = 0;
    const idx = ry * cols + rx;
    
    if (grid[idx] === TYPE_EMPTY) {
      grid[idx] = state.activeMaterial;
      colorGrid[idx] = getMaterialVariantColor(state.activeMaterial, rainbowHue);
    }
  }
}

/**
 * Sand Spout Fountain gushing sand continuously
 */
function handleFountainSpout() {
  if (state.activeTool !== 'fountain' || state.isPaused) return;

  const fX = Math.floor(cols / 2);
  const fY = 8;
  const radius = 3;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx*dx + dy*dy <= radius*radius) {
        const px = fX + dx;
        const py = fY + dy;
        const idx = py * cols + px;
        if (isValid(px, py) && grid[idx] === TYPE_EMPTY) {
          grid[idx] = state.activeMaterial;
          colorGrid[idx] = getMaterialVariantColor(state.activeMaterial, rainbowHue);
        }
      }
    }
  }
}


// ==========================================================================
// 10. Central Rendering & Animation Loop (ImageData)
// ==========================================================================
let lastTime = performance.now();
let fpsInterval = 0;
let fpsTimer = 0;
let totalGrains = 0;

function animLoop(time) {
  // Rainbow Hue Ticker
  rainbowHue = (rainbowHue + 1.5) % 360;

  // Calculate FPS statistics
  const dt = time - lastTime;
  lastTime = time;
  
  fpsTimer += dt;
  fpsInterval++;
  if (fpsTimer >= 1000) {
    document.getElementById('fps-counter').innerText = Math.round((fpsInterval * 1000) / fpsTimer);
    fpsInterval = 0;
    fpsTimer = 0;
  }

  // Update physics frames depending on speed sliders
  if (!state.isPaused) {
    const ticks = state.slowMoMode ? 0.25 : state.timeSpeed;
    const intTicks = Math.floor(ticks);
    const fracTicks = ticks - intTicks;
    
    // integer updates
    for (let t = 0; t < intTicks; t++) {
      updatePhysics();
    }
    // fractional chance updates
    if (Math.random() < fracTicks) {
      updatePhysics();
    }

    // Special tools ticks
    handleSkyRain();
    handleFountainSpout();
  }

  renderGrid();
  requestAnimationFrame(animLoop);
}

/**
 * Fast drawing using Canvas ImageData buffer scaling
 */
function renderGrid() {
  const imgData = bufferCtx.createImageData(cols, rows);
  const data = imgData.data;
  let count = 0;

  for (let i = 0; i < cols * rows; i++) {
    const type = grid[i];
    const pixelIdx = i * 4;

    if (type === TYPE_EMPTY) {
      data[pixelIdx] = 15;     // R
      data[pixelIdx + 1] = 23; // G
      data[pixelIdx + 2] = 42; // B
      data[pixelIdx + 3] = 255;// A
    } else {
      count++;
      const col = colorGrid[i];
      data[pixelIdx] = (col >> 16) & 255;
      data[pixelIdx + 1] = (col >> 8) & 255;
      data[pixelIdx + 2] = col & 255;
      data[pixelIdx + 3] = 255;
    }
  }

  // Write color buffers
  bufferCtx.putImageData(imgData, 0, 0);

  // Clear main viewport canvas
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw scaled buffers onto onscreen viewport canvas
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bufferCanvas, 0, 0, canvas.width, canvas.height);

  // Render brush size indicator ring
  drawBrushPreview();

  // Render Spout graphics if Fountain tool active
  if (state.activeTool === 'fountain') {
    drawFountainNozzle();
  }

  totalGrains = count;
  document.getElementById('particle-counter').innerText = totalGrains;
}

/**
 * Draws soft ring indicator showing brush size around cursor
 */
function drawBrushPreview() {
  if (mouseX <= 0 || mouseY <= 0) return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / cols;
  
  ctx.save();
  ctx.beginPath();
  // Draw circles based on scaled pixels size
  const previewRadius = state.brushSize * scaleX;
  ctx.arc(mouseX, mouseY, previewRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]); // dashed outline
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders graphical spout nozzle inside canvas top
 */
function drawFountainNozzle() {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / cols;
  const scaleY = rect.height / rows;

  const fx = (cols / 2) * scaleX;
  const fy = 8 * scaleY;

  ctx.save();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(fx, fy, 4 * scaleX, 0, Math.PI, true);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Start looping
requestAnimationFrame(animLoop);


// ==========================================================================
// 11. Material Selector UI Elements Populator
// ==========================================================================
const selectorGrid = document.getElementById('material-selector');

function buildMaterialSelector() {
  selectorGrid.innerHTML = '';
  
  // Exclude empty and reaction particles (Steam / Glass) from list
  const list = [
    TYPE_SAND_YELLOW,
    TYPE_SAND_WHITE,
    TYPE_SAND_RED,
    TYPE_SAND_BLUE,
    TYPE_SAND_BLACK,
    TYPE_SAND_RAINBOW,
    TYPE_STONE,
    TYPE_WATER,
    TYPE_LAVA
  ];

  list.forEach(type => {
    const mat = MATERIALS[type];
    const btn = document.createElement('button');
    btn.classList.add('material-btn');
    btn.style.setProperty('--mat-color', mat.colorHex);
    
    // Parse RGB values to set glows
    btn.style.setProperty('--mat-color-rgb', mat.colorRgb.join(','));
    
    if (type === state.activeMaterial) {
      btn.classList.add('active');
    }

    const dot = document.createElement('span');
    dot.classList.add('material-dot');
    
    const label = document.createElement('span');
    label.innerText = mat.name;

    btn.appendChild(dot);
    btn.appendChild(label);
    
    btn.addEventListener('click', () => {
      // Deactivate others
      document.querySelectorAll('.material-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeMaterial = type;
      
      // Auto switch back to draw tool if special tool was selected
      if (state.activeTool === 'vacuum' || state.activeTool === 'explosion') {
        setActiveTool('draw');
      }
    });

    selectorGrid.appendChild(btn);
  });
}

buildMaterialSelector();


// ==========================================================================
// 12. Interactive Controls event listeners
// ==========================================================================
// Brush Size Slider
const brushSlider = document.getElementById('brush-size');
const brushVal = document.getElementById('brush-size-val');
brushSlider.addEventListener('input', () => {
  state.brushSize = parseInt(brushSlider.value, 10);
  brushVal.innerText = state.brushSize;
});

// Flow Rate Slider
const flowSlider = document.getElementById('flow-rate');
const flowVal = document.getElementById('flow-rate-val');
flowSlider.addEventListener('input', () => {
  state.flowRate = parseInt(flowSlider.value, 10);
  flowVal.innerText = `${state.flowRate}%`;
});

// Play / Pause Buttons
const playPauseBtn = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
playPauseBtn.addEventListener('click', () => {
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
  } else {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
  }
});

// Clear Canvas
document.getElementById('btn-clear').addEventListener('click', () => {
  grid.fill(TYPE_EMPTY);
  colorGrid.fill(0);
  sound.silenceAll();
});

// Audio Toggle Button
document.getElementById('btn-mute').addEventListener('click', () => {
  sound.toggleMute();
});

// Slow Mo Toggle Button
const slowMoBtn = document.getElementById('btn-slow-mo');
slowMoBtn.addEventListener('click', () => {
  state.slowMoMode = !state.slowMoMode;
  slowMoBtn.classList.toggle('active', state.slowMoMode);
});

// Speed Scale Slider
const speedSlider = document.getElementById('time-speed');
const speedVal = document.getElementById('time-speed-val');
speedSlider.addEventListener('input', () => {
  state.timeSpeed = parseFloat(speedSlider.value);
  speedVal.innerText = `${state.timeSpeed}x`;
});

// Gravity direction buttons
const gravityButtons = document.querySelectorAll('.gravity-btn');
gravityButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    gravityButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.gravityDir = btn.getAttribute('data-gravity');
  });
});

// Sky Rain Mode Toggler
const rainBtn = document.getElementById('btn-rain');
rainBtn.addEventListener('click', () => {
  state.rainMode = !state.rainMode;
  rainBtn.classList.toggle('active', state.rainMode);
});

// Screenshot capture
document.getElementById('btn-screenshot').addEventListener('click', () => {
  // Hide preview cursor indicator during screenshots
  const oldMouseX = mouseX;
  const oldMouseY = mouseY;
  mouseX = mouseY = -999;
  
  // Render clean screenshot frame
  renderGrid();

  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `sand_lab_art-${Date.now()}.png`;
  link.href = dataURL;
  link.click();

  // Restore cursor positions
  mouseX = oldMouseX;
  mouseY = oldMouseY;
});


// ==========================================================================
// 13. Sidebar Special tools activation
// ==========================================================================
const toolButtons = document.querySelectorAll('.tool-btn');

function setActiveTool(tool) {
  state.activeTool = tool;
  toolButtons.forEach(btn => {
    if (btn.getAttribute('data-tool') === tool) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveTool(btn.getAttribute('data-tool'));
  });
});
