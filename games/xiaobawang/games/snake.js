'use strict';
// ================================================================
// games/snake.js – Snake mini-game
// ================================================================

class SnakeGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.W = 800;
        this.H = 556;

        // Grid: 20 columns x 20 rows, centered in canvas
        this.COLS = 20;
        this.ROWS = 20;
        this.CELL = 26; // cell size in pixels
        this.gridW = this.COLS * this.CELL; // 520
        this.gridH = this.ROWS * this.CELL; // 520
        this.offsetX = Math.floor((this.W - this.gridW) / 2); // center horizontally
        this.offsetY = Math.floor((this.H - this.gridH) / 2); // center vertically

        // Snake state
        this.snake = [{ x: 10, y: 10 }];
        this.dir   = { x: 1, y: 0 }; // moving right
        this.nextDir = { x: 1, y: 0 };
        this.food  = this._randomFood();
        this.score = 0;
        this.speed = 100; // ms per tick (lower = faster)

        this.running = false;
        this._interval = null;
        this._keyHandler = (e) => this._onKey(e);
    }

    start() {
        this.running = true;
        document.addEventListener('keydown', this._keyHandler);
        if (window.activateTimer) window.activateTimer();
        this._interval = setInterval(() => this._tick(), this.speed);
        this._draw(); // initial render
    }

    stop() {
        this.running = false;
        document.removeEventListener('keydown', this._keyHandler);
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
    }

    _onKey(e) {
        if (!this.running) return;
        const key = e.key.toLowerCase();
        let nx = this.nextDir.x, ny = this.nextDir.y;

        if ((key === 'arrowup'    || key === 'w') && this.dir.y !== 1)  { nx = 0; ny = -1; }
        else if ((key === 'arrowdown'  || key === 's') && this.dir.y !== -1) { nx = 0; ny = 1;  }
        else if ((key === 'arrowleft'  || key === 'a') && this.dir.x !== 1)  { nx = -1; ny = 0; }
        else if ((key === 'arrowright' || key === 'd') && this.dir.x !== -1) { nx = 1;  ny = 0; }
        else return;

        this.nextDir = { x: nx, y: ny };
        e.preventDefault();
    }

    _randomFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * this.COLS),
                y: Math.floor(Math.random() * this.ROWS),
            };
        } while (this.snake && this.snake.some(s => s.x === pos.x && s.y === pos.y));
        return pos;
    }

    _tick() {
        if (!this.running) return;

        // Apply direction
        this.dir = { ...this.nextDir };
        const head = this.snake[0];
        const newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };

        // Wall collision
        if (newHead.x < 0 || newHead.x >= this.COLS || newHead.y < 0 || newHead.y >= this.ROWS) {
            this._gameOver();
            return;
        }

        // Self collision
        if (this.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
            this._gameOver();
            return;
        }

        this.snake.unshift(newHead);

        // Eat food
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 10;
            this.food = this._randomFood();
            if (window.onSnakeScore) window.onSnakeScore(this.score);
            // Speed up slightly every 50 points
            if (this.score % 50 === 0 && this.speed > 50) {
                this.speed -= 5;
                clearInterval(this._interval);
                this._interval = setInterval(() => this._tick(), this.speed);
            }
        } else {
            this.snake.pop(); // remove tail
        }

        this._draw();
    }

    _gameOver() {
        this.stop();
        // Flash effect: draw one last frame with red head
        this._draw(true);
        setTimeout(() => {
            if (window.onSnakeOver) window.onSnakeOver(this.score);
        }, 300);
    }

    _draw(dead) {
        const ctx = this.ctx;
        const { W, H, CELL, offsetX, offsetY, gridW, gridH, COLS, ROWS } = this;

        // Background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, W, H);

        // Grid background
        ctx.fillStyle = '#111122';
        ctx.fillRect(offsetX, offsetY, gridW, gridH);

        // Grid lines (subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= COLS; i++) {
            const x = offsetX + i * CELL;
            ctx.beginPath(); ctx.moveTo(x, offsetY); ctx.lineTo(x, offsetY + gridH); ctx.stroke();
        }
        for (let i = 0; i <= ROWS; i++) {
            const y = offsetY + i * CELL;
            ctx.beginPath(); ctx.moveTo(offsetX, y); ctx.lineTo(offsetX + gridW, y); ctx.stroke();
        }

        // Border
        ctx.strokeStyle = '#334';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, gridW, gridH);

        // Snake body
        this.snake.forEach((seg, i) => {
            const sx = offsetX + seg.x * CELL;
            const sy = offsetY + seg.y * CELL;
            if (i === 0) {
                // Head
                ctx.fillStyle = dead ? '#e74c3c' : '#27ae60';
                this._roundRect(ctx, sx + 1, sy + 1, CELL - 2, CELL - 2, 5);
                ctx.fill();
                // Eyes
                const eyeSize = 3;
                ctx.fillStyle = 'white';
                if (this.dir.x === 1) { // right
                    ctx.beginPath(); ctx.arc(sx + CELL - 7, sy + 8, eyeSize, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(sx + CELL - 7, sy + CELL - 8, eyeSize, 0, Math.PI * 2); ctx.fill();
                } else if (this.dir.x === -1) { // left
                    ctx.beginPath(); ctx.arc(sx + 7, sy + 8, eyeSize, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(sx + 7, sy + CELL - 8, eyeSize, 0, Math.PI * 2); ctx.fill();
                } else if (this.dir.y === -1) { // up
                    ctx.beginPath(); ctx.arc(sx + 8, sy + 7, eyeSize, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(sx + CELL - 8, sy + 7, eyeSize, 0, Math.PI * 2); ctx.fill();
                } else { // down
                    ctx.beginPath(); ctx.arc(sx + 8, sy + CELL - 7, eyeSize, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(sx + CELL - 8, sy + CELL - 7, eyeSize, 0, Math.PI * 2); ctx.fill();
                }
            } else {
                // Body segment (gradient from green to darker green)
                const ratio = i / this.snake.length;
                const g = Math.floor(180 - ratio * 60);
                ctx.fillStyle = `rgb(30, ${g}, 50)`;
                this._roundRect(ctx, sx + 1, sy + 1, CELL - 2, CELL - 2, 4);
                ctx.fill();
            }
        });

        // Food
        const fx = offsetX + this.food.x * CELL + CELL / 2;
        const fy = offsetY + this.food.y * CELL + CELL / 2;
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(fx, fy, CELL / 2 - 3, 0, Math.PI * 2); ctx.fill();
        // Shine
        ctx.fillStyle = '#ff8888';
        ctx.beginPath(); ctx.arc(fx - 3, fy - 3, 4, 0, Math.PI * 2); ctx.fill();

        // Score (bottom-left HUD)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(offsetX, offsetY + gridH + 4, 140, 24);
        ctx.fillStyle = '#aaa';
        ctx.font = '13px monospace';
        ctx.fillText('长度: ' + this.snake.length, offsetX + 8, offsetY + gridH + 20);

        // Controls hint (fades after score > 0)
        if (this.score === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('方向键 / WASD 控制方向', W / 2, offsetY - 8);
            ctx.textAlign = 'left';
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
}

// ── Entry point called by main.js ──
function startSnake() {
    const canvas = document.getElementById('gameCanvas');
    if (window.snakeInstance) window.snakeInstance.stop();
    const game = new SnakeGame(canvas);
    window.snakeInstance = game;
    game.start();
}
