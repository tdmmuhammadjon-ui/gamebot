/**
 * Anti-Gravity: Quantum Core
 * Physics engine using Matter.js with procedural Web Audio & Particle Effects
 */

// --- Web Audio Procedural Sound Synthesizer ---
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playGravityToggle(mode) {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (mode === 'INVERTED') {
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.18);
    } else if (mode === 'NORMAL') {
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);
    } else { // ZERO_G
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(550, now + 0.1);
      osc.frequency.linearRampToValueAtTime(440, now + 0.2);
    }

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playGemPickup() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [587.33, 880, 1174.66]; // D5, A5, D6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.2);
    });
  }

  playThruster() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playExplosion() {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

// --- Main Game Engine ---
class AntiGravityGame {
  constructor() {
    this.sound = new SoundFX();
    this.container = document.getElementById('game-container');
    this.physicsCanvas = document.getElementById('physics-canvas');
    this.particlesCanvas = document.getElementById('particles-canvas');
    this.pCtx = this.particlesCanvas.getContext('2d');

    // Gravity Modes: 'NORMAL', 'INVERTED', 'ZEROG'
    this.gravityModes = ['NORMAL', 'INVERTED', 'ZEROG'];
    this.currentGravityIndex = 0;

    // Game state
    this.score = 0;
    this.combo = 1;
    this.crystalsCount = 0;
    this.isPlaying = false;
    this.isGameOver = false;

    // Screen Shake & Particles
    this.shakeIntensity = 0;
    this.particles = [];
    this.stars = [];

    // Matter.js components
    this.engine = null;
    this.render = null;
    this.runner = null;
    this.player = null;
    this.crystals = [];
    this.hazards = [];
    this.debrisList = [];

    this.initDimensions();
    this.initPhysics();
    this.initStarfield();
    this.bindEvents();
    this.setupUI();
  }

  initDimensions() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.physicsCanvas.width = this.width;
    this.physicsCanvas.height = this.height;
    this.particlesCanvas.width = this.width;
    this.particlesCanvas.height = this.height;
  }

  initStarfield() {
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.4 + 0.1,
        alpha: Math.random() * 0.8 + 0.2
      });
    }
  }

  initPhysics() {
    const { Engine, Render, Runner, Bodies, Composite } = Matter;

    // Create Engine with downward gravity initially
    this.engine = Engine.create({
      gravity: { x: 0, y: 1.1, scale: 0.001 }
    });

    // Custom Matter.js Render for custom glowing aesthetics
    this.render = Render.create({
      canvas: this.physicsCanvas,
      engine: this.engine,
      options: {
        width: this.width,
        height: this.height,
        wireframes: false,
        background: 'transparent'
      }
    });

    Render.run(this.render);
    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);

    // Build arena boundaries
    this.buildBoundaries();

    // Spawn player core
    this.spawnPlayer();

    // Spawn interactive floating physics debris
    this.spawnDebris();

    // Spawn items
    this.spawnCrystals(3);
    this.spawnHazards(2);

    // Physics collision hook
    Matter.Events.on(this.engine, 'collisionStart', (e) => this.handleCollisions(e));

    // Particle render loop
    requestAnimationFrame(() => this.particleLoop());
  }

  buildBoundaries() {
    const { Bodies, Composite } = Matter;
    const thickness = 60;
    const wallStyle = { fillStyle: '#1e293b', strokeStyle: '#475569', lineWidth: 2 };

    const topWall = Bodies.rectangle(this.width / 2, -thickness / 2 + 10, this.width, thickness, {
      isStatic: true,
      render: wallStyle,
      label: 'wall_top'
    });

    const bottomWall = Bodies.rectangle(this.width / 2, this.height + thickness / 2 - 10, this.width, thickness, {
      isStatic: true,
      render: wallStyle,
      label: 'wall_bottom'
    });

    const leftWall = Bodies.rectangle(-thickness / 2 + 10, this.height / 2, thickness, this.height, {
      isStatic: true,
      render: wallStyle,
      label: 'wall_side'
    });

    const rightWall = Bodies.rectangle(this.width + thickness / 2 - 10, this.height / 2, thickness, this.height, {
      isStatic: true,
      render: wallStyle,
      label: 'wall_side'
    });

    Composite.add(this.engine.world, [topWall, bottomWall, leftWall, rightWall]);
  }

  spawnPlayer() {
    const { Bodies, Composite } = Matter;
    const radius = 18;

    this.player = Bodies.circle(this.width / 2, this.height / 2, radius, {
      density: 0.003,
      frictionAir: 0.02,
      restitution: 0.75, // Bouncy & lively
      label: 'player',
      render: {
        fillStyle: '#38bdf8',
        strokeStyle: '#ffffff',
        lineWidth: 3
      }
    });

    Composite.add(this.engine.world, this.player);
  }

  spawnDebris() {
    const { Bodies, Composite } = Matter;
    this.debrisList = [];

    const colors = ['#6366f1', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 4; i++) {
      const size = Math.random() * 20 + 20;
      const x = Math.random() * (this.width - 100) + 50;
      const y = Math.random() * (this.height - 200) + 100;
      const color = colors[i % colors.length];

      const block = Bodies.polygon(x, y, Math.floor(Math.random() * 3 + 3), size, {
        density: 0.0015,
        frictionAir: 0.03,
        restitution: 0.8,
        label: 'debris',
        render: {
          fillStyle: color,
          strokeStyle: '#ffffff',
          lineWidth: 1.5
        }
      });

      this.debrisList.push(block);
      Composite.add(this.engine.world, block);
    }
  }

  spawnCrystals(count = 3) {
    const { Bodies, Composite } = Matter;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (this.width - 80) + 40;
      const y = Math.random() * (this.height - 220) + 110;

      const crystal = Bodies.polygon(x, y, 4, 13, {
        isSensor: true, // sensor so player passes through to collect
        isStatic: true,
        label: 'crystal',
        render: {
          fillStyle: '#f59e0b',
          strokeStyle: '#fef08a',
          lineWidth: 2
        }
      });

      this.crystals.push(crystal);
      Composite.add(this.engine.world, crystal);
    }
  }

  spawnHazards(count = 2) {
    const { Bodies, Composite } = Matter;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (this.width - 100) + 50;
      const y = Math.random() * (this.height - 250) + 120;

      const hazard = Bodies.circle(x, y, 16, {
        isStatic: true,
        isSensor: true,
        label: 'hazard',
        render: {
          fillStyle: '#ef4444',
          strokeStyle: '#fca5a5',
          lineWidth: 3
        }
      });

      // Add movement vector metadata
      hazard.customSpeed = (Math.random() * 1.5 + 1) * (Math.random() > 0.5 ? 1 : -1);
      hazard.minX = 40;
      hazard.maxX = this.width - 40;

      this.hazards.push(hazard);
      Composite.add(this.engine.world, hazard);
    }
  }

  // --- Gravity Manipulation Core ---
  cycleGravity() {
    if (this.isGameOver) return;
    this.currentGravityIndex = (this.currentGravityIndex + 1) % this.gravityModes.length;
    const mode = this.gravityModes[this.currentGravityIndex];
    this.applyGravity(mode);
  }

  applyGravity(mode) {
    const { world } = this.engine;
    const indicator = document.getElementById('gravity-indicator');
    const label = document.getElementById('gravity-text');

    indicator.className = 'gravity-indicator';

    if (mode === 'NORMAL') {
      world.gravity.y = 1.1;
      world.gravity.x = 0;
      indicator.classList.add('normal');
      label.innerText = '⬇️ GRAVITY: DOWN (1.0G)';
    } else if (mode === 'INVERTED') {
      world.gravity.y = -1.1;
      world.gravity.x = 0;
      indicator.classList.add('inverted');
      label.innerText = '⬆️ GRAVITY: UP (-1.0G)';
    } else if (mode === 'ZEROG') {
      world.gravity.y = 0;
      world.gravity.x = 0;
      indicator.classList.add('zerog');
      label.innerText = '🌀 ZERO-G: WEIGHTLESS (0.0G)';
    }

    // Audio & Haptic Feedback
    this.sound.playGravityToggle(mode);
    window.tgBridge?.hapticImpact('heavy');

    // Create wave shockwave particles
    this.createShockwave(this.player.position.x, this.player.position.y);
  }

  fireThrusterTowards(targetX, targetY) {
    if (this.isGameOver || !this.player) return;

    // Vector from player to target
    const dx = targetX - this.player.position.x;
    const dy = targetY - this.player.position.y;
    const dist = Math.hypot(dx, dy) || 1;

    const forceMagnitude = 0.025;
    const forceX = (dx / dist) * forceMagnitude;
    const forceY = (dy / dist) * forceMagnitude;

    Matter.Body.applyForce(this.player, this.player.position, { x: forceX, y: forceY });

    // Spawn thruster exhaust particles in opposite direction
    this.createExhaust(this.player.position.x, this.player.position.y, -dx / dist, -dy / dist);

    this.sound.playThruster();
    window.tgBridge?.hapticImpact('light');
  }

  // --- Collision & Event Handling ---
  handleCollisions(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const { bodyA, bodyB } = pairs[i];
      const labels = [bodyA.label, bodyB.label];

      // Player collects Crystal
      if (labels.includes('player') && labels.includes('crystal')) {
        const crystalBody = bodyA.label === 'crystal' ? bodyA : bodyB;
        this.collectCrystal(crystalBody);
      }

      // Player hits Hazard
      if (labels.includes('player') && labels.includes('hazard')) {
        this.triggerGameOver();
      }

      // Debris or wall bounce
      if (labels.includes('player') && (labels.includes('wall_top') || labels.includes('wall_bottom') || labels.includes('debris'))) {
        window.tgBridge?.hapticImpact('soft');
      }
    }
  }

  collectCrystal(crystalBody) {
    // Score calculation
    this.score += 100 * this.combo;
    this.combo += 1;
    this.crystalsCount += 1;
    this.updateHUD();

    // Haptics & Sound
    window.tgBridge?.hapticNotification('success');
    this.sound.playGemPickup();

    // Sparkles
    this.createSparkles(crystalBody.position.x, crystalBody.position.y, '#f59e0b');

    // Reposition crystal to a new safe location
    Matter.Body.setPosition(crystalBody, {
      x: Math.random() * (this.width - 80) + 40,
      y: Math.random() * (this.height - 240) + 120
    });
  }

  triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // Camera shake & explosion
    this.shakeIntensity = 20;
    this.createExplosion(this.player.position.x, this.player.position.y);
    this.sound.playExplosion();
    window.tgBridge?.hapticNotification('error');

    // Make player invisible / dissipate
    Matter.Composite.remove(this.engine.world, this.player);

    // Show Game Over modal & submit score
    setTimeout(() => {
      this.showGameOverModal();
    }, 600);
  }

  async showGameOverModal() {
    const modal = document.getElementById('gameover-modal');
    document.getElementById('final-score').innerText = this.score;
    document.getElementById('final-gems').innerText = `Quantum Crystals: ${this.crystalsCount}`;
    modal.classList.add('active');

    // Submit score securely through Telegram bridge
    const result = await window.tgBridge.submitScore(this.score, this.crystalsCount);
    if (result && result.rank) {
      document.getElementById('final-gems').innerText += ` | Global Rank #${result.rank}`;
    }
  }

  restart() {
    document.getElementById('gameover-modal').classList.remove('active');
    document.getElementById('leaderboard-modal').classList.remove('active');

    this.score = 0;
    this.combo = 1;
    this.crystalsCount = 0;
    this.isGameOver = false;
    this.updateHUD();

    // Re-spawn player
    this.spawnPlayer();
    this.applyGravity('NORMAL');
    this.currentGravityIndex = 0;
  }

  // --- Particles & Animation Loop ---
  createExhaust(x, y, dirX, dirY) {
    for (let i = 0; i < 8; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      this.particles.push({
        x: x,
        y: y,
        vx: (dirX + spread) * (Math.random() * 4 + 2),
        vy: (dirY + spread) * (Math.random() * 4 + 2),
        radius: Math.random() * 3 + 2,
        color: '#38bdf8',
        life: 1.0,
        decay: Math.random() * 0.05 + 0.04
      });
    }
  }

  createSparkles(x, y, color = '#f59e0b') {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 1,
        color: color,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  createShockwave(x, y) {
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const speed = 4;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3,
        color: '#6366f1',
        life: 1.0,
        decay: 0.04
      });
    }
  }

  createExplosion(x, y) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4 + 2,
        color: i % 2 === 0 ? '#ef4444' : '#f59e0b',
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  particleLoop() {
    const ctx = this.pCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Screen Shake effect
    if (this.shakeIntensity > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      this.container.style.transform = `translate(${sx}px, ${sy}px)`;
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity < 0.5) {
        this.shakeIntensity = 0;
        this.container.style.transform = 'none';
      }
    }

    // Update & draw background starfield
    for (const star of this.stars) {
      star.y += star.speed;
      if (star.y > this.height) star.y = 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Move hazards dynamically
    for (const h of this.hazards) {
      let nextX = h.position.x + h.customSpeed;
      if (nextX > h.maxX || nextX < h.minX) {
        h.customSpeed = -h.customSpeed;
      }
      Matter.Body.setPosition(h, { x: nextX, y: h.position.y });
    }

    // Draw Player Glow Aura
    if (this.player && !this.isGameOver) {
      const px = this.player.position.x;
      const py = this.player.position.y;
      const gradient = ctx.createRadialGradient(px, py, 5, px, py, 35);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, 35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Update & draw active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(() => this.particleLoop());
  }

  updateHUD() {
    document.getElementById('hud-score').innerText = this.score;
    document.getElementById('hud-combo').innerText = `x${this.combo}`;
  }

  bindEvents() {
    // Gravity Toggle Button
    const btnToggle = document.getElementById('btn-gravity-toggle');
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleGravity();
    });

    // Spacebar to toggle gravity
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.cycleGravity();
      }
    });

    // Tap on game container fires micro-thruster pulse towards tap point!
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.target.closest('.modal-overlay') || e.target.closest('.user-badge')) {
        return;
      }
      const rect = this.container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      this.fireThrusterTowards(clickX, clickY);
    });

    // Restart buttons
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('btn-leaderboard-restart').addEventListener('click', () => this.restart());

    // Leaderboard view button
    document.getElementById('btn-leaderboard').addEventListener('click', () => this.showLeaderboard());
    document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
      document.getElementById('leaderboard-modal').classList.remove('active');
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.initDimensions();
    });
  }

  setupUI() {
    // Setup Telegram user profile in HUD
    const user = window.tgBridge.user;
    if (user) {
      const name = user.first_name || user.username || "Commander";
      document.getElementById('hud-username').innerText = name;
      document.getElementById('user-avatar-initial').innerText = name.charAt(0).toUpperCase();
    }
  }

  async showLeaderboard() {
    const modal = document.getElementById('leaderboard-modal');
    const listEl = document.getElementById('leaderboard-content');
    listEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:12px;">Fetching quantum telemetry...</div>';
    modal.classList.add('active');

    const data = await window.tgBridge.fetchLeaderboard();
    listEl.innerHTML = '';

    if (data && data.leaderboard && data.leaderboard.length > 0) {
      data.leaderboard.forEach((item, index) => {
        const isSelf = window.tgBridge.user && item.user_id === window.tgBridge.user.id;
        const div = document.createElement('div');
        div.className = `leaderboard-item ${isSelf ? 'highlight' : ''}`;
        div.innerHTML = `
          <span class="player-rank">#${index + 1}</span>
          <span class="player-name">${item.name || item.username || 'Anonymous'}</span>
          <span class="player-score">${item.score} pts</span>
        `;
        listEl.appendChild(div);
      });
    } else {
      listEl.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:12px;">No scores logged yet. Be the first!</div>';
    }
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new AntiGravityGame();
});
