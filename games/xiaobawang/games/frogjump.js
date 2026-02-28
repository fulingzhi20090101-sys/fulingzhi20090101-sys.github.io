'use strict';
// ================================================================
// games/frogjump.js – FrogJump mini-game
// ================================================================

class FrogJump {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.W = 800;
        this.H = 556;

        // Frog constants
        this.FROG_FIXED_X = 130;
        this.FROG_W = 28;
        this.FROG_H = 18;
        this.JUMP_VEL  = -13.0;
        this.GRAVITY   = 0.55;
        this.MAX_FALL  = 20.0;
        this.MAX_LIVES = 5;
        this.ETOL = 8; // edge tolerance for landing

        // Platform constants
        this.PLAT_H = 16;
        this.PLAT_MIN_Y = 90;
        this.PLAT_MAX_Y = this.H - 60;

        // Speed constants
        this.SPEED_INIT = 2.5;
        this.SPEED_MAX  = 8.0;
        this.SPEED_INC  = 0.0008;

        // Moving platform
        this.MOVE_AMP  = 75;
        this.MOVE_RATE = 0.03;

        // State
        this.frogX    = this.FROG_FIXED_X;
        this.frogY    = 420;
        this.frogVY   = 0;
        this.prevY    = 420;
        this.ridingPlat = null;

        this.lives      = this.MAX_LIVES;
        this.invincible = 0;
        this.score      = 0;
        this.speed      = this.SPEED_INIT;
        this.timeAcc    = 0;

        this.platforms = [];
        this.gems      = [];
        this.walls     = [];

        this.running = false;
        this._raf    = null;
        this._keyHandler = (e) => this._onKey(e);
        this._lastTime = 0;

        this._initPlatforms();
    }

    // ── Initial platforms ──
    _initPlatforms() {
        this.platforms.push({
            x: 0, y: 420, w: 260, kind: 'normal',
            baseX: 0, phase: 0,
        });
        this._generateUntilFull();
    }

    // ── Start / Stop ──
    start() {
        this.running = true;
        this._lastTime = performance.now();
        document.addEventListener('keydown', this._keyHandler);
        if (window.activateTimer) window.activateTimer();
        this._loop();
    }

    stop() {
        this.running = false;
        document.removeEventListener('keydown', this._keyHandler);
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    }

    // ── Input ──
    _onKey(e) {
        if (!this.running) return;
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            if (this.frogVY === 0) {
                this.frogVY = this.JUMP_VEL;
                // Release from moving platform
                if (this.ridingPlat) {
                    this.frogX = this.FROG_FIXED_X;
                    this.ridingPlat = null;
                }
            }
        }
    }

    // ── Platform generation ──
    _rightmostX() {
        let rx = 0;
        for (const p of this.platforms) {
            const right = p.x + p.w;
            if (right > rx) rx = right;
        }
        return rx;
    }

    _generateUntilFull() {
        while (this._rightmostX() < this.W + 220) {
            this._spawnPlatform();
        }
    }

    _spawnPlatform() {
        const last = this.platforms[this.platforms.length - 1];
        const gap = 60 + Math.random() * 50;
        const pw  = 80 + Math.random() * 70;
        const nx  = last.x + last.w + gap;
        const dy  = -110 + Math.random() * 230;
        let ny    = Math.max(this.PLAT_MIN_Y, Math.min(this.PLAT_MAX_Y, last.y + dy));

        // Pick type
        const roll = Math.random();
        let kind;
        if      (roll < 0.20) kind = 'danger';
        else if (roll < 0.35) kind = 'bonus';
        else if (roll < 0.50) kind = 'moving';
        else                  kind = 'normal';

        const plat = {
            x: nx, y: ny, w: pw, kind,
            baseX: nx, phase: Math.random() * Math.PI * 2,
        };
        this.platforms.push(plat);

        // Gems (45% chance)
        if (Math.random() < 0.45) {
            this.gems.push({
                x: nx + pw / 2,
                y: ny - 20,
                baseX: nx + pw / 2,
                red: Math.random() < 0.25,
                collected: false,
            });
        }

        // Walls (only on normal, width >= 80, 25% chance)
        if (kind === 'normal' && pw >= 80 && Math.random() < 0.25) {
            this.walls.push({
                x: nx + pw * 2 / 3,
                y: ny,
                baseX: nx + pw * 2 / 3,
                active: true,
            });
        }

        // Danger platforms always get a safe sibling
        if (kind === 'danger') {
            this._spawnSibling(plat, 'normal');
        }
        // Normal platforms: 30% chance for sibling
        else if (kind === 'normal' && Math.random() < 0.30) {
            const sibKind = Math.random() < 0.25 ? 'danger' : 'normal';
            this._spawnSibling(plat, sibKind);
        }
    }

    _spawnSibling(parent, kind) {
        const sdy = (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 60);
        let sy = parent.y + sdy;
        if (Math.abs(sy - parent.y) < 60) sy = parent.y - 70;
        sy = Math.max(this.PLAT_MIN_Y, Math.min(this.PLAT_MAX_Y, sy));
        const sw = 70 + Math.random() * 60;
        const sx = parent.x + (Math.random() * 30 - 15);
        const sib = {
            x: sx, y: sy, w: sw, kind,
            baseX: sx, phase: Math.random() * Math.PI * 2,
        };
        this.platforms.push(sib);

        if (Math.random() < 0.40) {
            this.gems.push({
                x: sx + sw / 2, y: sy - 20,
                baseX: sx + sw / 2,
                red: Math.random() < 0.25,
                collected: false,
            });
        }
    }

    // ── Damage ──
    _takeDamage() {
        if (this.invincible > 0) return;
        this.lives--;
        this.invincible = 60;
        if (this.lives <= 0) {
            this.stop();
            if (window.onFrogJumpOver) window.onFrogJumpOver(this.score);
        }
    }

    // ── Update ──
    _update(dt) {
        // Speed ramp
        this.speed = Math.min(this.SPEED_MAX, this.speed + this.SPEED_INC);

        // Time-based scoring (+1/sec)
        this.timeAcc += dt;
        if (this.timeAcc >= 1.0) {
            this.score += Math.floor(this.timeAcc);
            this.timeAcc -= Math.floor(this.timeAcc);
            if (window.onFrogJumpScore) window.onFrogJumpScore(this.score);
        }

        // Invincibility countdown
        if (this.invincible > 0) this.invincible--;

        // ── Scroll everything left ──
        for (const p of this.platforms) {
            if (p.kind === 'moving') {
                p.baseX -= this.speed;
                p.phase += this.MOVE_RATE;
                p.x = p.baseX + this.MOVE_AMP * Math.sin(p.phase);
            } else {
                p.x -= this.speed;
            }
        }
        for (const g of this.gems) {
            g.baseX -= this.speed;
            g.x = g.baseX;
        }
        for (const w of this.walls) {
            w.baseX -= this.speed;
            w.x = w.baseX;
        }

        // ── Riding moving platform ──
        if (this.ridingPlat) {
            const rp = this.ridingPlat;
            // Check if platform scrolled off
            if (rp.x + rp.w < 0) {
                this.frogX = this.FROG_FIXED_X;
                this.frogVY = 0.5;
                this.ridingPlat = null;
            } else {
                this.frogX = rp.x + rp.w / 2;
                this.frogY = rp.y;
                this.frogVY = 0;
            }
        }

        // ── Frog physics ──
        this.prevY = this.frogY;
        this.frogVY = Math.min(this.MAX_FALL, this.frogVY + this.GRAVITY);
        this.frogY += this.frogVY;

        // ── Landing detection (falling) ──
        if (this.frogVY > 0 && !this.ridingPlat) {
            for (const p of this.platforms) {
                const inX = this.frogX >= p.x - this.ETOL && this.frogX <= p.x + p.w + this.ETOL;
                const crossedY = this.prevY <= p.y && this.frogY + 2 >= p.y;
                if (inX && crossedY) {
                    this.frogY = p.y;
                    this.frogVY = 0;

                    if (p.kind === 'moving') {
                        this.ridingPlat = p;
                        this.frogX = p.x + p.w / 2;
                    } else if (p.kind === 'danger') {
                        this._takeDamage();
                        if (!this.running) return;
                    } else if (p.kind === 'bonus') {
                        if (this.lives < this.MAX_LIVES) this.lives++;
                        p.kind = 'normal';
                    }
                    break;
                }
            }
        }

        // ── Standing check (not jumping, not riding) ──
        if (this.frogVY === 0 && !this.ridingPlat) {
            let supported = false;
            for (const p of this.platforms) {
                const inX = this.frogX >= p.x - this.ETOL && this.frogX <= p.x + p.w + this.ETOL;
                const onY = Math.abs(this.frogY - p.y) < 4;
                if (inX && onY) {
                    supported = true;
                    // Standing on danger
                    if (p.kind === 'danger') {
                        this._takeDamage();
                        if (!this.running) return;
                    }
                    break;
                }
            }
            if (!supported) {
                this.frogVY = 0.5;
            }
        }

        // ── Wall collision ──
        if (this.frogVY === 0) {
            const fx = this.frogX, fy = this.frogY;
            const frogL = fx - this.FROG_W / 2, frogR = fx + this.FROG_W / 2;
            const frogT = fy - this.FROG_H, frogB = fy;
            for (const w of this.walls) {
                if (!w.active) continue;
                const wL = w.x, wR = w.x + 14;
                const wT = w.y - 48, wB = w.y;
                if (frogR > wL && frogL < wR && frogB > wT && frogT < wB) {
                    w.active = false;
                    this._takeDamage();
                    if (!this.running) return;
                    break;
                }
            }
        }

        // ── Gem collection ──
        const fx = this.frogX, fy = this.frogY - this.FROG_H / 2;
        for (const g of this.gems) {
            if (g.collected) continue;
            const dx = fx - g.x, dy = fy - g.y;
            if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
                g.collected = true;
                this.score += g.red ? 1000 : 500;
                if (window.onFrogJumpScore) window.onFrogJumpScore(this.score);
            }
        }

        // ── Cleanup off-screen ──
        this.platforms = this.platforms.filter(p => p.x + p.w > -20);
        this.gems      = this.gems.filter(g => g.x > -30 && !g.collected);
        this.walls     = this.walls.filter(w => w.x > -30);

        // ── Generate new platforms ──
        this._generateUntilFull();

        // ── Fall death ──
        if (this.frogY > this.H + 20) {
            this.stop();
            if (window.onFrogJumpOver) window.onFrogJumpOver(this.score);
        }
    }

    // ── Drawing ──
    _draw() {
        const ctx = this.ctx;
        const { W, H } = this;

        // Background (dark blue sky)
        ctx.fillStyle = '#1e3264';
        ctx.fillRect(0, 0, W, H);

        // Platforms
        for (const p of this.platforms) {
            this._drawPlatform(p);
        }

        // Gems
        for (const g of this.gems) {
            if (!g.collected) this._drawGem(g);
        }

        // Walls
        for (const w of this.walls) {
            if (w.active) this._drawWall(w);
        }

        // Frog (skip some frames when invincible for flash effect)
        if (this.invincible === 0 || this.invincible % 6 < 3) {
            this._drawFrog();
        }

        // Hearts
        this._drawHearts();

        // Riding hint
        if (this.ridingPlat) {
            ctx.fillStyle = 'rgba(255,255,100,0.85)';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('按 SPACE 跳！', this.frogX, this.frogY - 32);
            ctx.textAlign = 'left';
        }

        // Speed indicator
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(W - 130, H - 36, 120, 26);
        ctx.fillStyle = '#aaa';
        ctx.font = '12px monospace';
        ctx.fillText('SPD ' + this.speed.toFixed(1), W - 118, H - 18);
    }

    _drawPlatform(p) {
        const ctx = this.ctx;
        const h = this.PLAT_H;
        let baseColor, shineColor;
        switch (p.kind) {
            case 'normal':  baseColor = '#785028'; shineColor = '#a08050'; break;
            case 'danger':  baseColor = '#b93228'; shineColor = '#e06838'; break;
            case 'bonus':   baseColor = '#28a046'; shineColor = '#50d868'; break;
            case 'moving':  baseColor = '#328cc8'; shineColor = '#60b8e8'; break;
        }
        // Base
        ctx.fillStyle = baseColor;
        this._roundRect(ctx, p.x, p.y, p.w, h, 4);
        ctx.fill();
        // Shine strip (top 5px)
        ctx.fillStyle = shineColor;
        ctx.fillRect(p.x + 2, p.y + 1, p.w - 4, 5);
    }

    _drawGem(g) {
        const ctx = this.ctx;
        const x = g.x, y = g.y;
        const color = g.red ? '#dc2828' : '#2864dc';
        const shine = g.red ? '#ff8c8c' : '#78b4ff';
        // Diamond shape
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 7, y);
        ctx.lineTo(x, y + 10);
        ctx.lineTo(x - 7, y);
        ctx.closePath();
        ctx.fill();
        // Shine
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x, y + 2);
        ctx.lineTo(x - 3, y);
        ctx.closePath();
        ctx.fill();
    }

    _drawWall(w) {
        const ctx = this.ctx;
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(w.x, w.y - 48, 14, 48);
        // Brick lines
        ctx.strokeStyle = '#a0522d';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const by = w.y - 48 + i * 12;
            ctx.beginPath();
            ctx.moveTo(w.x, by);
            ctx.lineTo(w.x + 14, by);
            ctx.stroke();
            // Vertical mortar (alternating)
            const mx = w.x + (i % 2 === 0 ? 7 : 4);
            ctx.beginPath();
            ctx.moveTo(mx, by);
            ctx.lineTo(mx, by + 12);
            ctx.stroke();
        }
    }

    _drawFrog() {
        const ctx = this.ctx;
        const fx = this.frogX, fy = this.frogY;
        const jumping = this.frogVY < -0.5;

        // Body (green ellipse)
        ctx.fillStyle = '#2ecc40';
        ctx.beginPath();
        ctx.ellipse(fx, fy - this.FROG_H / 2, this.FROG_W / 2, this.FROG_H / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#55dd66';
        ctx.beginPath();
        ctx.ellipse(fx, fy - this.FROG_H / 2 + 3, this.FROG_W / 2 - 5, this.FROG_H / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeY = fy - this.FROG_H - 2;
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(fx - 7, eyeY, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 7, eyeY, 5, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(fx - 6, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx + 8, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();

        // Legs
        ctx.strokeStyle = '#28a832';
        ctx.lineWidth = 2.5;
        if (jumping) {
            // Legs tucked up
            ctx.beginPath(); ctx.moveTo(fx - 12, fy - 2); ctx.lineTo(fx - 22, fy - 14); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fx + 12, fy - 2); ctx.lineTo(fx + 22, fy - 14); ctx.stroke();
        } else {
            // Legs resting
            ctx.beginPath(); ctx.moveTo(fx - 10, fy); ctx.lineTo(fx - 18, fy + 4); ctx.lineTo(fx - 22, fy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fx + 10, fy); ctx.lineTo(fx + 18, fy + 4); ctx.lineTo(fx + 22, fy); ctx.stroke();
        }
    }

    _drawHearts() {
        const ctx = this.ctx;
        const startX = this.W - 30;
        const startY = 22;
        for (let i = 0; i < this.MAX_LIVES; i++) {
            const hx = startX - i * 26;
            const color = i < this.lives ? '#d22828' : '#333';
            // Heart shape: two circles + triangle
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(hx - 4, startY - 3, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(hx + 4, startY - 3, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(hx - 9, startY - 1);
            ctx.lineTo(hx, startY + 10);
            ctx.lineTo(hx + 9, startY - 1);
            ctx.fill();
        }
    }

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
        const now = performance.now();
        const dt = (now - this._lastTime) / 1000; // seconds
        this._lastTime = now;
        this._update(Math.min(dt, 0.05)); // cap dt to avoid big jumps
        this._draw();
        this._raf = requestAnimationFrame(() => this._loop());
    }
}

// ── Entry point called by main.js ──
function startFrogJump() {
    const canvas = document.getElementById('gameCanvas');
    if (window.frogJumpInstance) window.frogJumpInstance.stop();
    const game = new FrogJump(canvas);
    window.frogJumpInstance = game;
    game.start();
}
