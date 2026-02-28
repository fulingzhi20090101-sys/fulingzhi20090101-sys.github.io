'use strict';
// ================================================================
// games/carrace.js – CarRace mini-game
// ================================================================

class CarRace {
    constructor(canvas, laneCount) {
        this.canvas    = canvas;
        this.ctx       = canvas.getContext('2d');
        this.laneCount = laneCount;
        this.W = 800;
        this.H = 556;

        // Road layout
        this.roadX = 150;
        this.roadW = 500;
        this.laneW = this.roadW / laneCount;

        // Car dimensions
        this.carW = 38;
        this.carH = 62;

        // Player
        this.playerLane = Math.floor(laneCount / 2);
        this.playerY    = this.H - 110;

        // Game state
        this.score      = 0;
        this.speed      = 3.0;
        this.running    = false;
        this.enemies    = [];
        this.spawnTimer = 0;
        this.roadOffset = 0;
        this._raf       = null;

        this._keyHandler = (e) => this._onKey(e);
    }

    start() {
        this.running = true;
        document.addEventListener('keydown', this._keyHandler);
        if (window.activateTimer) window.activateTimer();
        this._loop();
    }

    stop() {
        this.running = false;
        document.removeEventListener('keydown', this._keyHandler);
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    }

    _onKey(e) {
        if (!this.running) return;
        if (e.key === 'ArrowLeft' && this.playerLane > 0) {
            this.playerLane--;
            e.preventDefault();
        } else if (e.key === 'ArrowRight' && this.playerLane < this.laneCount - 1) {
            this.playerLane++;
            e.preventDefault();
        }
    }

    _laneX(lane) {
        return this.roadX + lane * this.laneW + this.laneW / 2;
    }

    _spawnInterval() {
        return Math.max(35, 90 - Math.floor(this.score * 0.4));
    }

    _spawnEnemy() {
        const colors = ['#e74c3c','#3498db','#e67e22','#9b59b6','#1abc9c','#f39c12','#e91e63'];
        this.enemies.push({
            lane:   Math.floor(Math.random() * this.laneCount),
            y:      -this.carH,
            color:  colors[Math.floor(Math.random() * colors.length)],
            passed: false,
        });
    }

    _update() {
        // Speed ramps up with score
        this.speed = Math.min(16.0, 3.0 + this.score * 0.06);

        // Scroll road markings
        this.roadOffset = (this.roadOffset + this.speed) % 56;

        // Spawn enemies
        this.spawnTimer++;
        if (this.spawnTimer >= this._spawnInterval()) {
            this._spawnEnemy();
            this.spawnTimer = 0;
        }

        const py = this.playerY;
        for (const e of this.enemies) {
            e.y += this.speed;

            // Skip already-passed enemies (no more collision)
            if (e.passed) continue;

            // Score: enemy cleared the player's bottom edge
            if (e.y > py + this.carH / 2 + 8) {
                e.passed = true;
                this.score++;
                if (window.onCarRaceScore) window.onCarRaceScore(this.score);
                continue;
            }

            // Collision: same lane, overlapping Y
            if (e.lane === this.playerLane) {
                if (Math.abs(e.y - py) < this.carH - 6) {
                    this.stop();
                    if (window.onCarRaceOver) window.onCarRaceOver(this.score);
                    return;
                }
            }
        }

        // Remove off-screen enemies
        this.enemies = this.enemies.filter(e => e.y < this.H + 100);
    }

    _draw() {
        const ctx = this.ctx;
        const { W, H, roadX, roadW, laneW, laneCount } = this;

        // Grass
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, W, H);

        // Grass overlay (dark strips give depth)
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, roadX, H);
        ctx.fillRect(roadX + roadW, 0, W - roadX - roadW, H);

        // Road surface
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(roadX, 0, roadW, H);

        // White edge lines
        ctx.fillStyle = 'white';
        ctx.fillRect(roadX, 0, 5, H);
        ctx.fillRect(roadX + roadW - 5, 0, 5, H);

        // Dashed yellow lane dividers (animated)
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([30, 26]);
        for (let i = 1; i < laneCount; i++) {
            const lx = roadX + i * laneW;
            ctx.beginPath();
            ctx.moveTo(lx, -56 + this.roadOffset);
            ctx.lineTo(lx, H + 56);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw enemies (scrolling down, facing player)
        for (const e of this.enemies) {
            this._drawCar(this._laneX(e.lane), e.y, e.color, false);
        }

        // Draw player car (green, facing forward)
        this._drawCar(this._laneX(this.playerLane), this.playerY, '#2ecc71', true);

        // Speed HUD
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(W - 130, H - 38, 120, 28);
        ctx.fillStyle = '#aaa';
        ctx.font = '13px monospace';
        ctx.fillText('SPD ' + this.speed.toFixed(1), W - 118, H - 18);

        // Controls hint (fades out after score > 5)
        if (this.score < 6) {
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('← → 换道', this.playerLane < 2 ? roadX + roadW/2 + 60 : roadX + roadW/2 - 60, H - 20);
            ctx.textAlign = 'left';
        }

        // Timer overlay
        if (window.drawTimerOverlay) window.drawTimerOverlay(ctx);
    }

    // Top-down car: isPlayer = front at top; enemy = front at bottom (facing player)
    _drawCar(cx, cy, color, isPlayer) {
        const ctx = this.ctx;
        const w = this.carW, h = this.carH;
        const x = cx - w / 2, y = cy - h / 2;

        // Body
        ctx.fillStyle = color;
        this._roundRect(ctx, x, y, w, h, 7);
        ctx.fill();

        // Windshield
        ctx.fillStyle = 'rgba(180,220,255,0.82)';
        if (isPlayer) {
            ctx.fillRect(x + 5, y + 8, w - 10, 15); // front (top)
        } else {
            ctx.fillRect(x + 5, y + h - 23, w - 10, 15); // front (bottom, facing down toward player)
        }

        // Rear window
        ctx.fillStyle = 'rgba(180,220,255,0.5)';
        if (isPlayer) {
            ctx.fillRect(x + 5, y + h - 20, w - 10, 11);
        } else {
            ctx.fillRect(x + 5, y + 9, w - 10, 11);
        }

        // Door line
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + h * 0.5);
        ctx.lineTo(x + w - 4, y + h * 0.5);
        ctx.stroke();

        // Wheels (4 corners)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x - 6, y + 8,       8, 14);  // front-left
        ctx.fillRect(x + w - 2, y + 8,   8, 14);  // front-right
        ctx.fillRect(x - 6, y + h - 22,  8, 14);  // rear-left
        ctx.fillRect(x + w - 2, y + h - 22, 8, 14); // rear-right

        // Headlights / tail lights
        if (isPlayer) {
            ctx.fillStyle = '#ffffaa'; // white headlights at front (top)
            ctx.fillRect(x + 4, y + 2, 9, 5);
            ctx.fillRect(x + w - 13, y + 2, 9, 5);
        } else {
            ctx.fillStyle = '#ff4444'; // red tail lights at top (enemy's rear)
            ctx.fillRect(x + 4, y + 2, 9, 5);
            ctx.fillRect(x + w - 13, y + 2, 9, 5);
            ctx.fillStyle = '#ffee66'; // headlights at bottom (enemy's front, facing player)
            ctx.fillRect(x + 4, y + h - 7, 9, 5);
            ctx.fillRect(x + w - 13, y + h - 7, 9, 5);
        }
    }

    // Manual rounded rectangle path (no reliance on ctx.roundRect)
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y,     x + w, y + r,     r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x,     y + h, x,     y + h - r, r);
        ctx.lineTo(x,     y + r);
        ctx.arcTo(x,     y,     x + r, y,          r);
        ctx.closePath();
    }

    _loop() {
        if (!this.running) return;
        this._update();
        this._draw();
        this._raf = requestAnimationFrame(() => this._loop());
    }
}

// ── Entry point called by main.js ──
function startCarRace() {
    const canvas    = document.getElementById('gameCanvas');
    const laneCount = window._crLanes || 3;
    if (window.carRaceInstance) window.carRaceInstance.stop();
    const game = new CarRace(canvas, laneCount);
    window.carRaceInstance = game;
    game.start();
}
