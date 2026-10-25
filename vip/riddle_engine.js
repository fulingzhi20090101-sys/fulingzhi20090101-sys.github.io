'use strict';

class RiddleEngine {
    constructor(riddles, userId, container) {
        this.riddles = riddles;
        this.userId = userId;
        this.container = container;
        this.cycleDays = 3;
        this.riddlesPerCycle = 3;
        this.maxAttempts = 2;
    }

    _epoch() { return new Date('2026-10-25').getTime(); }

    _today() { return new Date().toISOString().slice(0, 10); }

    _daysSinceEpoch() {
        const now = new Date(this._today()).getTime();
        return Math.floor((now - this._epoch()) / 86400000);
    }

    getCurrentCycle() {
        return Math.floor(this._daysSinceEpoch() / this.cycleDays);
    }

    getDaysLeft() {
        const days = this._daysSinceEpoch();
        return this.cycleDays - (days % this.cycleDays);
    }

    getCurrentRiddles() {
        const cycle = this.getCurrentCycle();
        const start = (cycle * this.riddlesPerCycle) % this.riddles.length;
        const result = [];
        for (let i = 0; i < this.riddlesPerCycle; i++) {
            result.push(this.riddles[(start + i) % this.riddles.length]);
        }
        return result;
    }

    _stateKey(riddleId) {
        return 'vip_riddle_' + this.userId + '_' + riddleId;
    }

    _getState(riddleId) {
        try {
            return JSON.parse(localStorage.getItem(this._stateKey(riddleId)) || 'null');
        } catch(e) { return null; }
    }

    _setState(riddleId, state) {
        try { localStorage.setItem(this._stateKey(riddleId), JSON.stringify(state)); } catch(e) {}
    }

    _syncState(riddleId, state) {
        _apiPost('/api/daily/' + this.userId, {
            type: 'riddle_' + riddleId,
            date: this._today(),
            value: JSON.stringify(state)
        });
    }

    showRiddleMenu() {
        const riddles = this.getCurrentRiddles();
        const daysLeft = this.getDaysLeft();

        let html = '<div class="section-label">🧩 每期谜语</div>';
        html += '<div style="font-size:0.8rem;color:#95a5a6;margin-bottom:10px;padding:0 4px">每3天更新 · 剩余 ' + daysLeft + ' 天</div>';
        html += '<div class="quiz-menu" style="grid-template-columns:1fr">';

        riddles.forEach((r, i) => {
            const state = this._getState(r.id);
            const solved = state && state.solved;
            const failed = state && !state.solved && state.attempts >= this.maxAttempts;
            const attempted = state && state.attempts > 0 && !state.solved && !failed;

            let cls = 'quiz-menu-item';
            if (solved) cls += ' done';
            if (failed) cls += ' done';

            let badge = '';
            if (solved) badge = '<div class="done-badge">✅ 已答对 +' + r.reward + '铜钱</div>';
            else if (failed) badge = '<div class="done-badge" style="color:#e74c3c">❌ 已用完机会</div>';
            else if (attempted) badge = '<div class="done-badge" style="color:#e67e22">⚠️ 还有1次机会</div>';

            html += '<div class="' + cls + '" onclick="riddleEngine.startRiddle(' + i + ')">';
            html += '<div class="icon">🧩</div>';
            html += '<div class="title">谜语 ' + (i + 1) + '（' + r.reward + '铜钱）</div>';
            html += '<div class="desc" style="margin-top:6px;font-size:0.85rem;line-height:1.4">' + this._escHtml(r.riddle) + '</div>';
            html += badge;
            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    startRiddle(index) {
        const riddles = this.getCurrentRiddles();
        const r = riddles[index];
        if (!r) return;

        const state = this._getState(r.id);
        if (state && state.solved) return;
        if (state && state.attempts >= this.maxAttempts) return;

        this._currentRiddle = r;
        this._currentIndex = index;

        const attemptsUsed = state ? state.attempts : 0;
        const remaining = this.maxAttempts - attemptsUsed;

        const shuffled = this._shuffle([...r.options.map((o, i) => ({ ...o, idx: i }))]);

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">🧩 谜语 ' + (index + 1) + '</div>';
        html += '<div style="font-size:0.8rem;color:#95a5a6;margin-bottom:8px">奖励：' + r.reward + '铜钱 · 剩余' + remaining + '次机会</div>';
        html += '<div style="font-size:1.2rem;margin:20px 0;line-height:1.6;font-weight:bold">' + this._escHtml(r.riddle) + '</div>';
        html += '<div class="quiz-options" style="grid-template-columns:1fr">';
        shuffled.forEach(opt => {
            html += '<button class="quiz-option word" style="font-size:1rem;text-align:left;padding:14px 16px" onclick="riddleEngine.checkAnswer(' + opt.idx + ')">';
            html += this._escHtml(opt.zh) + ' <span style="color:#95a5a6;font-size:0.85rem">' + this._escHtml(opt.en) + '</span>';
            html += '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    checkAnswer(chosenIdx) {
        const r = this._currentRiddle;
        if (!r) return;

        const correct = chosenIdx === r.answer;
        let state = this._getState(r.id) || { attempts: 0, solved: false };
        state.attempts++;

        if (correct) {
            state.solved = true;
            state.solvedDate = this._today();
            this._setState(r.id, state);
            this._syncState(r.id, state);

            if (typeof VipCurrency !== 'undefined') {
                VipCurrency.addCopper(this.userId, r.reward, '谜语答对');
            }

            let html = '<div class="quiz-result correct">';
            html += '<div class="result-icon">🎉</div>';
            html += '<div class="result-msg">答对了！</div>';
            html += '<div style="font-size:1.2rem;margin:10px 0">' + this._escHtml(r.options[r.answer].zh) + ' (' + this._escHtml(r.options[r.answer].en) + ')</div>';
            html += '<div class="result-msg">获得 ' + r.reward + ' 铜钱！</div>';
            html += '<button class="quiz-btn" onclick="showQuizMenu()">返回</button>';
            html += '</div>';
            this.container.innerHTML = html;
        } else {
            this._setState(r.id, state);
            this._syncState(r.id, state);
            const remaining = this.maxAttempts - state.attempts;

            let html = '<div class="quiz-result wrong">';
            html += '<div class="result-icon">❌</div>';
            html += '<div class="result-msg">答错了！</div>';

            if (remaining > 0) {
                html += '<div style="color:#e67e22;font-size:0.9rem;margin:10px 0">还有 ' + remaining + ' 次机会，可以再试！</div>';
                html += '<button class="quiz-btn" onclick="riddleEngine.startRiddle(' + this._currentIndex + ')">再试一次</button>';
                html += '<button class="quiz-btn secondary" onclick="showQuizMenu()">先回去想想</button>';
            } else {
                html += '<div style="color:#e74c3c;font-size:0.9rem;margin:10px 0">机会已用完</div>';
                html += '<div style="font-size:1rem;margin:10px 0">正确答案：' + this._escHtml(r.options[r.answer].zh) + ' (' + this._escHtml(r.options[r.answer].en) + ')</div>';
                html += '<button class="quiz-btn" onclick="showQuizMenu()">返回</button>';
            }

            html += '</div>';
            this.container.innerHTML = html;
        }

        if (typeof renderCurrencyBar === 'function') {
            const bar = document.getElementById('currencyBar');
            if (bar) renderCurrencyBar(bar, this.userId);
        }
    }

    _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    _escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
