const TAU = Math.PI * 2;

// Vector Mathematics Helpers
class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
  add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
  mult(n) { return new Vec2(this.x * n, this.y * n); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  cross(v) { return this.x * v.y - this.y * v.x; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() {
    const m = this.mag();
    return m === 0 ? new Vec2(0, 0) : new Vec2(this.x / m, this.y / m);
  }
  perp() { return new Vec2(-this.y, this.x); }
}

// Geometry Generation Helper functions
function getCentroidAndArea(vertices) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    const factor = p1.x * p2.y - p2.x * p1.y;
    area += factor;
    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-4) {
    let sx = 0, sy = 0;
    for (const p of vertices) { sx += p.x; sy += p.y; }
    return { cx: sx / n, cy: sy / n, area: 0 };
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { cx, cy, area: Math.abs(area) };
}

function generateSquareVertices(size) {
  const h = size / 2;
  return [
    { x: -h, y: -h },
    { x: h, y: -h },
    { x: h, y: h },
    { x: -h, y: h }
  ];
}

function generateTriangleVertices(size) {
  return [
    { x: 0, y: -size * 1.15 },
    { x: size * 0.96, y: size * 0.55 },
    { x: -size * 0.96, y: size * 0.55 }
  ];
}

function generateRegularPolygonVertices(sides, r) {
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return verts;
}

function generateCapsuleVertices(len, r) {
  const verts = [];
  const segments = 4;
  // Right cap
  for (let i = 0; i <= segments; i++) {
    const angle = -Math.PI / 2 + (i / segments) * Math.PI;
    verts.push({
      x: len / 2.2 + Math.cos(angle) * r,
      y: Math.sin(angle) * r
    });
  }
  // Left cap
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI / 2 + (i / segments) * Math.PI;
    verts.push({
      x: -len / 2.2 + Math.cos(angle) * r,
      y: Math.sin(angle) * r
    });
  }
  return verts;
}

function generateStarVertices(size) {
  const verts = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = (i % 2 === 0) ? size : size * 0.44;
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return verts;
}

function generateRandomConvexPolygon(sides, radius) {
  const angles = [];
  for (let i = 0; i < sides; i++) {
    angles.push(Math.random() * Math.PI * 2);
  }
  angles.sort((a, b) => a - b);
  return angles.map(angle => {
    const r = radius * (0.6 + Math.random() * 0.45);
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
}

// SAT Collision functions
function collideCircleCircle(A, B) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.hypot(dx, dy);
  const rSum = A.r + B.r;
  if (d >= rSum || d === 0) return null;

  const nx = dx / d;
  const ny = dy / d;
  const depth = rSum - d;
  const cx = A.x + nx * A.r;
  const cy = A.y + ny * A.r;

  return {
    normal: new Vec2(nx, ny),
    depth,
    contact: new Vec2(cx, cy)
  };
}

function projectPolygon(vertices, axis) {
  let min = axis.dot(vertices[0]);
  let max = min;
  for (let i = 1; i < vertices.length; i++) {
    const p = axis.dot(vertices[i]);
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}

function getOverlap(p1, p2) {
  return Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
}

function collideCirclePolygon(circle, poly) {
  const verts = poly.getGlobalVertices();
  let minOverlap = Infinity;
  let collisionNormal = null;

  // Check poly edge normals
  for (let i = 0; i < verts.length; i++) {
    const next = verts[(i + 1) % verts.length];
    const edge = { x: next.x - verts[i].x, y: next.y - verts[i].y };
    const normal = new Vec2(-edge.y, edge.x).normalize();

    const projPoly = projectPolygon(verts, normal);
    const projCircle = {
      min: normal.dot(circle) - circle.r,
      max: normal.dot(circle) + circle.r
    };

    const overlap = getOverlap(projPoly, projCircle);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      collisionNormal = normal;
    }
  }

  // Check axis from circle center to closest vertex
  let closestVert = verts[0];
  let minDist = Math.hypot(circle.x - closestVert.x, circle.y - closestVert.y);
  for (let i = 1; i < verts.length; i++) {
    const d = Math.hypot(circle.x - verts[i].x, circle.y - verts[i].y);
    if (d < minDist) {
      minDist = d;
      closestVert = verts[i];
    }
  }

  const normal = new Vec2(closestVert.x - circle.x, closestVert.y - circle.y).normalize();
  const projPoly = projectPolygon(verts, normal);
  const projCircle = {
    min: normal.dot(circle) - circle.r,
    max: normal.dot(circle) + circle.r
  };

  const overlap = getOverlap(projPoly, projCircle);
  if (overlap <= 0) return null;

  if (overlap < minOverlap) {
    minOverlap = overlap;
    collisionNormal = normal;
  }

  const dir = { x: poly.x - circle.x, y: poly.y - circle.y };
  if (collisionNormal.dot(dir) < 0) {
    collisionNormal = collisionNormal.mult(-1);
  }

  const contact = new Vec2(circle.x + collisionNormal.x * circle.r, circle.y + collisionNormal.y * circle.r);

  return {
    normal: collisionNormal,
    depth: minOverlap,
    contact
  };
}

function collidePolygonPolygon(A, B) {
  const vertsA = A.getGlobalVertices();
  const vertsB = B.getGlobalVertices();

  let minOverlap = Infinity;
  let collisionNormal = null;

  // Test axes of A
  for (let i = 0; i < vertsA.length; i++) {
    const next = vertsA[(i + 1) % vertsA.length];
    const edge = { x: next.x - vertsA[i].x, y: next.y - vertsA[i].y };
    const normal = new Vec2(-edge.y, edge.x).normalize();

    const projA = projectPolygon(vertsA, normal);
    const projB = projectPolygon(vertsB, normal);

    const overlap = getOverlap(projA, projB);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      collisionNormal = normal;
    }
  }

  // Test axes of B
  for (let i = 0; i < vertsB.length; i++) {
    const next = vertsB[(i + 1) % vertsB.length];
    const edge = { x: next.x - vertsB[i].x, y: next.y - vertsB[i].y };
    const normal = new Vec2(-edge.y, edge.x).normalize();

    const projA = projectPolygon(vertsA, normal);
    const projB = projectPolygon(vertsB, normal);

    const overlap = getOverlap(projA, projB);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      collisionNormal = normal;
    }
  }

  const dir = { x: B.x - A.x, y: B.y - A.y };
  if (collisionNormal.dot(dir) < 0) {
    collisionNormal = collisionNormal.mult(-1);
  }

  // Find contact support vertex
  let bestDist = Infinity;
  const contact = new Vec2(0, 0);
  for (const v of vertsB) {
    const d = v.x * -collisionNormal.x + v.y * -collisionNormal.y;
    if (d < bestDist) {
      bestDist = d;
      contact.copy(v);
    }
  }

  return {
    normal: collisionNormal,
    depth: minOverlap,
    contact
  };
}

function checkCollision(A, B) {
  if (A.type === 'circle' && B.type === 'circle') {
    return collideCircleCircle(A, B);
  } else if (A.type === 'circle' && B.type === 'polygon') {
    return collideCirclePolygon(A, B);
  } else if (A.type === 'polygon' && B.type === 'circle') {
    const res = collideCirclePolygon(B, A);
    if (res) res.normal = res.normal.mult(-1);
    return res;
  } else {
    return collidePolygonPolygon(A, B);
  }
}

// Synthesizes impact sounds using AudioContext
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  setMuted(m) { this.muted = m; }
  playImpact(velocity) {
    if (this.muted) return;
    const vol = Math.min(velocity / 340, 0.22);
    if (vol < 0.015) return;

    this.ensure();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130 + Math.random() * 90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playPop() {
    if (this.muted) return;
    this.ensure();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.06);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }
}

// Physics dynamic body
class PhysicsBody {
  constructor(x, y, shapeType, size = 26) {
    this.x = x;
    this.y = y;
    this.shapeType = shapeType;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.angVel = 0;

    this.restitution = 0.24; // bounce
    this.friction = 0.16; // sliding friction
    this.isStatic = false;

    const hues = [0, 45, 130, 195, 275, 335];
    const hue = hues[Math.floor(Math.random() * hues.length)] + Math.floor(Math.random() * 20 - 10);
    this.color = `hsl(${hue}, 88%, 60%)`;
    this.colorLight = `hsl(${hue}, 88%, 72%)`;

    if (shapeType === 'circle') {
      this.type = 'circle';
      this.r = size;
      const area = Math.PI * size * size;
      this.mass = area * 0.04;
      this.inertia = 0.5 * this.mass * size * size;
    } else {
      this.type = 'polygon';
      let localVerts = [];

      if (shapeType === 'square') {
        localVerts = generateSquareVertices(size * 1.7);
      } else if (shapeType === 'triangle') {
        localVerts = generateTriangleVertices(size * 1.9);
      } else if (shapeType === 'pentagon') {
        localVerts = generateRegularPolygonVertices(5, size * 1.22);
      } else if (shapeType === 'hexagon') {
        localVerts = generateRegularPolygonVertices(6, size * 1.22);
      } else if (shapeType === 'capsule') {
        localVerts = generateCapsuleVertices(size * 1.8, size * 0.62);
      } else if (shapeType === 'star') {
        localVerts = generateRegularPolygonVertices(5, size * 1.25);
        this.starDrawVerts = generateStarVertices(size * 1.25);
      } else {
        localVerts = generateRandomConvexPolygon(5 + Math.floor(Math.random() * 3), size * 1.25);
      }

      const { cx, cy, area } = getCentroidAndArea(localVerts);
      this.vertices = localVerts.map(v => ({ x: v.x - cx, y: v.y - cy }));

      this.mass = area * 0.04;
      let rSqSum = 0;
      this.vertices.forEach(v => { rSqSum += v.x * v.x + v.y * v.y; });
      const avgRadiusSq = rSqSum / this.vertices.length;
      this.inertia = 0.55 * this.mass * avgRadiusSq;
    }
  }

  getGlobalVertices() {
    if (this.type !== 'polygon') return null;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return this.vertices.map(v => ({
      x: this.x + (v.x * cos - v.y * sin),
      y: this.y + (v.x * sin + v.y * cos)
    }));
  }

  draw(ctx) {
    ctx.save();
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 10;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    ctx.beginPath();
    if (this.type === 'circle') {
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    } else {
      let drawVerts = this.vertices;
      if (this.shapeType === 'star') {
        drawVerts = this.starDrawVerts;
      }
      drawVerts.forEach((v, i) => {
        const wx = this.x + (v.x * cos - v.y * sin);
        const wy = this.y + (v.x * sin + v.y * cos);
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      });
      ctx.closePath();
    }

    const grad = ctx.createLinearGradient(this.x - 30, this.y - 30, this.x + 30, this.y + 30);
    grad.addColorStop(0, this.colorLight);
    grad.addColorStop(1, this.color);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Details inside to show roll direction
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    if (this.type === 'circle') {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + cos * this.r, this.y + sin * this.r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shapeType === 'capsule') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.x - cos * 14, this.y - sin * 14);
      ctx.lineTo(this.x + cos * 14, this.y + sin * 14);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// Resolves contact impulses and friction
function resolveCollision(A, B, normal, depth, contact) {
  const percent = 0.38; 
  const slop = 0.015; 
  const correction = Math.max(depth - slop, 0) / ((A.isStatic ? 0 : 1 / A.mass) + (B.isStatic ? 0 : 1 / B.mass)) * percent;

  if (!A.isStatic) {
    A.x -= normal.x * correction / A.mass;
    A.y -= normal.y * correction / A.mass;
  }
  if (!B.isStatic) {
    B.x += normal.x * correction / B.mass;
    B.y += normal.y * correction / B.mass;
  }

  const raX = contact.x - A.x;
  const raY = contact.y - A.y;
  const rbX = contact.x - B.x;
  const rbY = contact.y - B.y;

  const vaX = A.vx - A.angVel * raY;
  const vaY = A.vy + A.angVel * raX;
  const vbX = B.vx - B.angVel * rbY;
  const vbY = B.vy + B.angVel * rbX;

  const relVx = vbX - vaX;
  const relVy = vbY - vaY;

  const vn = relVx * normal.x + relVy * normal.y;
  if (vn > 0) return; // already separating

  // Synthesize audio click if normal impact is strong
  if (vn < -14 && window.audioEngine) {
    window.audioEngine.playImpact(Math.abs(vn));
  }

  const e = Math.min(A.restitution, B.restitution);

  const raCrossN = raX * normal.y - raY * normal.x;
  const rbCrossN = rbX * normal.y - rbY * normal.x;

  const invMassA = A.isStatic ? 0 : 1 / A.mass;
  const invMassB = B.isStatic ? 0 : 1 / B.mass;
  const invInertiaA = A.isStatic ? 0 : 1 / A.inertia;
  const invInertiaB = B.isStatic ? 0 : 1 / B.inertia;

  let denom = invMassA + invMassB + raCrossN * raCrossN * invInertiaA + rbCrossN * rbCrossN * invInertiaB;
  if (denom === 0) return;

  const j = -(1 + e) * vn / denom;

  if (!A.isStatic) {
    A.vx -= normal.x * j * invMassA;
    A.vy -= normal.y * j * invMassA;
    A.angVel -= raCrossN * j * invInertiaA;
  }
  if (!B.isStatic) {
    B.vx += normal.x * j * invMassB;
    B.vy += normal.y * j * invMassB;
    B.angVel += rbCrossN * j * invInertiaB;
  }

  // Solve friction impulse
  const tx = -normal.y;
  const ty = normal.x;
  const vt = relVx * tx + relVy * ty;

  const raCrossT = raX * ty - raY * tx;
  const rbCrossT = rbX * ty - rbY * tx;

  denom = invMassA + invMassB + raCrossT * raCrossT * invInertiaA + rbCrossT * rbCrossT * invInertiaB;
  if (denom === 0) return;

  const mu = Math.sqrt(A.friction * B.friction);
  let jt = -vt / denom;

  const maxJt = j * mu;
  jt = Math.max(-maxJt, Math.min(maxJt, jt));

  if (!A.isStatic) {
    A.vx -= tx * jt * invMassA;
    A.vy -= ty * jt * invMassA;
    A.angVel -= raCrossT * jt * invInertiaA;
  }
  if (!B.isStatic) {
    B.vx += tx * jt * invMassB;
    B.vy += ty * jt * invMassB;
    B.angVel += rbCrossT * jt * invInertiaB;
  }
}

// Main Game Controller
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    window.audioEngine = new AudioEngine();
    this.audio = window.audioEngine;

    this.bodies = [];
    this.totalSpawned = 0;
    this.activeShape = 'random';
    this.dragOver = false;

    // Setup slope line properties
    this.slopeStart = new Vec2(0, 0);
    this.slopeEnd = new Vec2(0, 0);

    this.lastTime = performance.now();
    
    // FPS stats
    this.fpsAcc = 0;
    this.fpsCount = 0;
    this.fpsDisplay = 60;

    this.resize();
    this.bindEvents();

    requestAnimationFrame(this.loop.bind(this));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.groundY = this.h - Math.max(50, this.h * 0.08);

    // Position slope relative to screen size (Tilted ~34deg)
    this.slopeStart.set(this.w * 0.05, this.h * 0.28);
    this.slopeEnd.set(this.w * 0.88, this.h * 0.78);
  }

  spawnShape(chosenType, x, y) {
    let type = chosenType || this.activeShape;
    if (type === 'random') {
      const types = ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'capsule', 'star', 'convex'];
      type = types[Math.floor(Math.random() * types.length)];
    }

    // Spawn centered above the top of the slope with a slight offset, or at specific coordinates if provided
    const sx = x !== undefined ? x : (this.slopeStart.x + 35 + Math.random() * 45);
    const sy = y !== undefined ? y : (this.slopeStart.y - 120 - Math.random() * 40);

    const body = new PhysicsBody(sx, sy, type);
    this.bodies.push(body);

    this.totalSpawned++;
    this.updateHUD();

    this.audio.playPop();

    // Fade tutorial hint
    const hint = document.getElementById('hint');
    if (hint && hint.style.opacity !== '0') {
      hint.style.opacity = '0';
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Keyboard Spawner (Spacebar)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.spawnShape();
      }
    });

    // Click on canvas to spawn/drop shape at the cursor position
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.spawnShape(this.activeShape, x, y);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const y = e.touches[0].clientY - rect.top;
        this.spawnShape(this.activeShape, x, y);
      }
    }, { passive: true });

    // Drag Start handler for spawner buttons
    document.getElementById('spawnerButtons').addEventListener('dragstart', (e) => {
      const btn = e.target.closest('.spawn-btn');
      if (!btn) return;
      e.dataTransfer.setData('text/plain', btn.dataset.shape);
      e.dataTransfer.effectAllowed = 'copy';
    });

    // Drag and drop onto the canvas
    this.canvas.addEventListener('dragenter', (e) => {
      e.preventDefault();
      this.dragOver = true;
    });

    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dragOver = true;
    });

    this.canvas.addEventListener('dragleave', () => {
      this.dragOver = false;
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dragOver = false;
      const shapeType = e.dataTransfer.getData('text/plain');
      if (shapeType) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Select the button visually
        const buttons = document.querySelectorAll('.spawn-btn');
        buttons.forEach(btn => {
          if (btn.dataset.shape === shapeType) {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.activeShape = shapeType;
          }
        });

        this.spawnShape(shapeType, x, y);
      }
    });

    // Bottom selectors UI click
    document.getElementById('spawnerButtons').addEventListener('click', (e) => {
      const btn = e.target.closest('.spawn-btn');
      if (!btn) return;
      document.querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      this.activeShape = btn.dataset.shape;
      
      // Trigger immediate spawn on click
      this.spawnShape(this.activeShape);
    });

    // Reset Button
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.bodies = [];
      this.totalSpawned = 0;
      this.updateHUD();
      this.audio.playPop();
    });

    // Mute Toggle
    const mb = document.getElementById('muteBtn');
    mb.addEventListener('click', () => {
      const muted = !this.audio.muted;
      this.audio.setMuted(muted);
      mb.textContent = muted ? '🔇' : '🔊';
      mb.classList.toggle('on', !muted);
    });
  }

  updateHUD() {
    document.getElementById('spawnedVal').textContent = this.totalSpawned.toLocaleString();
    document.getElementById('activeVal').textContent = this.bodies.length;
  }

  loop(now) {
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.033);

    // Framerate counters
    this.fpsAcc += dt;
    this.fpsCount++;
    if (this.fpsAcc >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsCount / this.fpsAcc);
      document.getElementById('fps').textContent = this.fpsDisplay + ' FPS';
      this.fpsAcc = 0;
      this.fpsCount = 0;
    }

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    // Substepping physics solver loop (6 steps per frame for high stability)
    const substeps = 6;
    const sdt = dt / substeps;

    const dx = this.slopeEnd.x - this.slopeStart.x;
    const dy = this.slopeEnd.y - this.slopeStart.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;

    // Slope equation variables
    const sA = nx;
    const sB = ny;
    const sC = -(nx * this.slopeStart.x + ny * this.slopeStart.y);

    for (let step = 0; step < substeps; step++) {
      // 1. Gravity acceleration
      for (const b of this.bodies) {
        b.vy += 650 * sdt;
      }

      // 2. Rigid body vs Rigid body collisions
      for (let i = 0; i < this.bodies.length; i++) {
        const A = this.bodies[i];
        for (let j = i + 1; j < this.bodies.length; j++) {
          const B = this.bodies[j];
          const col = checkCollision(A, B);
          if (col) {
            resolveCollision(A, B, col.normal, col.depth, col.contact);
          }
        }
      }

      // 3. Slope collisions
      for (const b of this.bodies) {
        // Project body center onto slope segment line
        const t = ((b.x - this.slopeStart.x) * dx + (b.y - this.slopeStart.y) * dy) / (len * len);
        
        // Check if shape sits directly over the inclined slope segment
        if (t >= -0.04 && t <= 1.04) {
          if (b.type === 'circle') {
            const dist = sA * b.x + sB * b.y + sC;
            if (dist < b.r) {
              const depth = b.r - dist;
              const contact = new Vec2(b.x - nx * b.r, b.y - ny * b.r);
              const slopeDummy = { isStatic: true, friction: 0.12, restitution: 0.15, x: contact.x, y: contact.y, vx: 0, vy: 0, angVel: 0 };
              resolveCollision(b, slopeDummy, new Vec2(nx, ny), depth, contact);
            }
          } else {
            const verts = b.getGlobalVertices();
            let deepestVert = null;
            let maxDepth = -Infinity;

            for (const v of verts) {
              const dist = sA * v.x + sB * v.y + sC;
              if (dist < 0) { // Penetration
                const depth = -dist;
                if (depth > maxDepth) {
                  maxDepth = depth;
                  deepestVert = v;
                }
              }
            }

            if (deepestVert) {
              const contact = new Vec2(deepestVert.x, deepestVert.y);
              const slopeDummy = { isStatic: true, friction: 0.16, restitution: 0.22, x: contact.x, y: contact.y, vx: 0, vy: 0, angVel: 0 };
              resolveCollision(b, slopeDummy, new Vec2(nx, ny), maxDepth, contact);
            }
          }
        }
      }

      // 4. Update linear & rotational movement positions
      for (const b of this.bodies) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.rotation += b.angVel * sdt;
      }
    }

    // Clean bodies falling off screen boundaries
    let changed = false;
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.y > this.h + 120 || b.x < -120 || b.x > this.w + 120) {
        this.bodies.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this.updateHUD();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // 1. Draw truss and glowing inclined slope
    this.drawSlope(ctx);

    // 2. Draw all shapes
    for (const b of this.bodies) {
      b.draw(ctx);
    }

    // 3. Draw a glowing cyan border/overlay if dragging over
    if (this.dragOver) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, this.w, this.h);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  drawSlope(ctx) {
    ctx.save();

    // Truss Support Structures
    ctx.strokeStyle = 'rgba(155, 107, 255, 0.07)';
    ctx.lineWidth = 2.5;
    const step = 42;
    for (let x = this.slopeStart.x; x <= this.slopeEnd.x; x += step) {
      const t = (x - this.slopeStart.x) / (this.slopeEnd.x - this.slopeStart.x);
      const sy = this.slopeStart.y + t * (this.slopeEnd.y - this.slopeStart.y);

      // Vertical columns to floor
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x, this.groundY);
      ctx.stroke();

      // Diagonal supports
      if (x + step <= this.slopeEnd.x) {
        ctx.beginPath();
        ctx.moveTo(x, sy);
        const nextY = this.slopeStart.y + ((x + step - this.slopeStart.x) / (this.slopeEnd.x - this.slopeStart.x)) * (this.slopeEnd.y - this.slopeStart.y);
        ctx.lineTo(x + step, nextY);
        ctx.stroke();
      }
    }

    // Outer glow layer
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.slopeStart.x, this.slopeStart.y);
    ctx.lineTo(this.slopeEnd.x, this.slopeEnd.y);
    ctx.stroke();

    // Inner glowing core
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.slopeStart.x, this.slopeStart.y);
    ctx.lineTo(this.slopeEnd.x, this.slopeEnd.y);
    ctx.stroke();

    ctx.restore();
  }
}

// Launch Simulator on load
window.addEventListener('load', () => {
  new Game();
});
