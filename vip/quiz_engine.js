'use strict';

class QuizEngine {
    constructor(chars, userId, container) {
        this.allChars = chars;
        this.userId = userId;
        this.container = container;
        this.score = 0;
        this.total = 0;
        this.streak = 0;
        this.currentAnswer = null;
        this.currentQuestionId = null;
        this.mode = null;
        this.onScoreChange = null;
        this.onRoundComplete = null;

        this.roundSize = 10;
        this.roundQuestions = [];
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.firstTryCorrect = 0;
        this.wrongQueue = [];
        this._isRetry = false;
        this._currentQuestion = null;
        this.roundStartTime = 0;
        this.dailyCap = 150;
        this._syncDailyEarned();
    }

    _todayKey() { return 'vip_daily_earned_' + this.userId + '_' + new Date().toISOString().slice(0, 10); }
    _getTodayEarned() { try { return parseInt(localStorage.getItem(this._todayKey()) || '0', 10); } catch(e) { return 0; } }
    _addTodayEarned(amount) {
        const newVal = this._getTodayEarned() + amount;
        try { localStorage.setItem(this._todayKey(), String(newVal)); } catch(e) {}
        const date = new Date().toISOString().slice(0, 10);
        _apiPost('/api/daily/' + this.userId, { type: 'quiz_earned', date: date, value: newVal });
    }
    _syncDailyEarned() {
        const date = new Date().toISOString().slice(0, 10);
        _apiGet('/api/daily/' + this.userId + '?type=quiz_earned&date=' + date).then(data => {
            if (data && typeof data.value === 'number' && data.value > 0) {
                try { localStorage.setItem(this._todayKey(), String(data.value)); } catch(e) {}
            }
        });
    }
    _canEarnMore() { return this._getTodayEarned() < this.dailyCap; }

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    pick(arr, n, exclude) {
        const filtered = exclude ? arr.filter(c => c.char !== exclude) : arr;
        return this.shuffle(filtered).slice(0, n);
    }

    speak(text, rate) {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = rate || 0.8;
        const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('zh'));
        if (voices.length > 0) u.voice = voices[0];
        speechSynthesis.speak(u);
    }

    // ── Per-type daily tracking ──
    static _typeDoneKey(userId) {
        return 'vip_type_done_' + userId + '_' + new Date().toISOString().slice(0, 10);
    }

    _markTypeDone(type) {
        try {
            const key = QuizEngine._typeDoneKey(this.userId);
            const done = JSON.parse(localStorage.getItem(key) || '{}');
            done[type] = true;
            localStorage.setItem(key, JSON.stringify(done));
        } catch(e) {}
        const date = new Date().toISOString().slice(0, 10);
        _apiPost('/api/daily/' + this.userId, { type: 'type_done_' + type, date: date, value: true });
    }

    static isTypeDoneToday(userId, type) {
        try {
            const key = QuizEngine._typeDoneKey(userId);
            const done = JSON.parse(localStorage.getItem(key) || '{}');
            return !!done[type];
        } catch(e) { return false; }
    }

    static getAllTypesDone(userId) {
        try {
            const key = QuizEngine._typeDoneKey(userId);
            return JSON.parse(localStorage.getItem(key) || '{}');
        } catch(e) { return {}; }
    }

    static get chineseTypes() {
        return ['wordMeaning', 'matchPairs', 'charToPinyin', 'pinyinToChar'];
    }

    static chineseTypesDoneCount(userId) {
        const done = QuizEngine.getAllTypesDone(userId);
        return QuizEngine.chineseTypes.filter(t => done[t]).length;
    }

    // ── Start a round ──
    startRound(mode) {
        this.mode = mode;
        this._roundAnswers = [];
        this.roundSize = (mode === 'matchPairs') ? 5 : 10;
        this.roundQuestions = this.shuffle(this.allChars).slice(0, this.roundSize);
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.firstTryCorrect = 0;
        this.wrongQueue = [];
        this._isRetry = false;
        this._currentQuestion = null;
        this.score = 0;
        this.total = 0;
        this.streak = 0;
        this.roundStartTime = Date.now();
        if (this.onScoreChange) this.onScoreChange(this.score, this.total);

        if (mode === 'matchPairs') {
            this._startMatchRound();
        } else {
            this._nextRoundQuestion();
        }
    }

    _nextRoundQuestion() {
        if (this.roundIndex < this.roundQuestions.length) {
            this._isRetry = false;
            this._currentQuestion = this.roundQuestions[this.roundIndex];
            this._generateQuestion(this.mode, this._currentQuestion);
        } else if (this.wrongQueue.length > 0) {
            this._isRetry = true;
            this._currentQuestion = this.wrongQueue.shift();
            this._generateQuestion(this.mode, this._currentQuestion);
        } else {
            this._showRoundResult();
        }
    }

    _generateQuestion(mode, target) {
        switch (mode) {
            case 'charToPinyin': this._charToPinyin(target); break;
            case 'pinyinToChar': this._pinyinToChar(target); break;
            case 'wordMeaning': this._wordMeaning(target); break;
            default: this._charToPinyin(target);
        }
    }

    // ── See character, choose pinyin ──
    _charToPinyin(target) {
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.pinyin;
        this.currentQuestionId = target.char;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">📝 看字选拼音</div>';
        html += '<div class="quiz-prompt">这个字的拼音是什么？</div>';
        html += '<div class="quiz-big-char">' + target.char + '</div>';
        html += '<div class="quiz-options pinyin-options">';
        options.forEach(o => {
            html += '<button class="quiz-option pinyin" onclick="quiz.checkRoundAnswer(\'' + this._esc(o.pinyin) + '\')">' + o.pinyin + '</button>';
        });
        html += '</div></div>';
        this.container.innerHTML = html;
    }

    // ── See pinyin, choose character ──
    _pinyinToChar(target) {
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;
        this.currentQuestionId = target.char;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">🔤 看拼音选字</div>';
        html += '<div class="quiz-prompt">这个拼音对应哪个字？</div>';
        html += '<div class="quiz-big-pinyin">' + target.pinyin + '</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkRoundAnswer(\'' + this._esc(o.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';
        this.container.innerHTML = html;
    }

    // ── Listen and choose word ──
    _wordMeaning(target) {
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const wrongWords = wrong.map(w => w.words[Math.floor(Math.random() * w.words.length)]);
        const options = this.shuffle([word, ...wrongWords]);
        this.currentAnswer = word;
        this.currentQuestionId = target.char;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">👂 听音选词</div>';
        html += '<div class="quiz-prompt">听一听，选出你听到的词语</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-options word-options">';
        options.forEach(o => {
            html += '<button class="quiz-option word" onclick="quiz.checkRoundAnswer(\'' + this._esc(o) + '\')">' + o + '</button>';
        });
        html += '</div></div>';
        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
    }

    // ── Match pairs (5 pairs at once) ──
    _startMatchRound() {
        const selected = this.shuffle(this.allChars).slice(0, 5);
        const charButtons = this.shuffle([...selected]);
        const pinyinButtons = this.shuffle([...selected]);

        this._matchState = {
            pairs: selected,
            matched: [],
            selectedChar: null,
            wrongAttempts: {},
        };

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">🧩 汉字连连看</div>';
        html += '<div class="quiz-prompt">点击汉字和对应拼音配对（' + selected.length + '对）</div>';
        html += '<div class="match-grid">';
        html += '<div class="match-col">';
        charButtons.forEach(c => {
            html += '<button class="match-btn match-card char-btn" data-char="' + c.char + '" onclick="quiz.matchClick(this, \'char\', \'' + this._esc(c.char) + '\')">' + c.char + '</button>';
        });
        html += '</div>';
        html += '<div class="match-col">';
        pinyinButtons.forEach(c => {
            html += '<button class="match-btn match-card pinyin-btn" data-pinyin="' + c.pinyin + '" onclick="quiz.matchClick(this, \'pinyin\', \'' + this._esc(c.pinyin) + '\')">' + c.pinyin + '</button>';
        });
        html += '</div>';
        html += '</div></div>';
        this.container.innerHTML = html;
    }

    matchClick(btn, type, value) {
        const state = this._matchState;
        if (!state) return;

        if (type === 'char') {
            document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.selectedChar = value;
        } else if (type === 'pinyin' && state.selectedChar) {
            const pair = state.pairs.find(p => p.char === state.selectedChar && p.pinyin === value);
            if (pair) {
                state.matched.push(pair.char);
                const charBtn = document.querySelector('.char-btn[data-char="' + state.selectedChar + '"]');
                charBtn.classList.add('matched');
                btn.classList.add('matched');
                charBtn.disabled = true;
                btn.disabled = true;

                const hadWrong = (state.wrongAttempts[pair.char] || 0) > 0;
                this.roundCorrect++;
                if (!hadWrong) this.firstTryCorrect++;
                this.score++;
                this.total++;
                this._recordAnswer(pair.char, true, pair.pinyin, pair.pinyin);

                state.selectedChar = null;
                if (this.onScoreChange) this.onScoreChange(this.score, this.total);

                if (state.matched.length === state.pairs.length) {
                    setTimeout(() => this._showRoundResult(), 600);
                }
            } else {
                btn.classList.add('wrong');
                setTimeout(() => btn.classList.remove('wrong'), 400);
                if (!state.wrongAttempts[state.selectedChar]) state.wrongAttempts[state.selectedChar] = 0;
                state.wrongAttempts[state.selectedChar]++;
                this.total++;
                if (this.onScoreChange) this.onScoreChange(this.score, this.total);
            }
            document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('selected'));
            state.selectedChar = null;
        }
    }

    // ── Round progress bar ──
    _roundProgress() {
        const done = this.roundIndex;
        const total = this.roundQuestions.length;
        const wrongLeft = this.wrongQueue.length;
        let label = '第 ' + (done + 1) + '/' + total + ' 题';
        if (wrongLeft > 0) label += '（还有' + wrongLeft + '题需要重做）';
        return '<div style="font-size:0.75rem;color:#95a5a6;margin-bottom:8px;text-align:right">' + label + '</div>';
    }

    // ── Per-answer recording ──
    _recordAnswer(questionId, correct, userAnswer, correctAnswer) {
        if (!this._roundAnswers) this._roundAnswers = [];
        this._roundAnswers.push({ questionId, correct, quizType: this.mode });
        try {
            const key = 'vip_answers_' + this.userId;
            const stats = JSON.parse(localStorage.getItem(key) || '{}');
            if (!stats[questionId]) stats[questionId] = { correct: 0, wrong: 0 };
            if (correct) stats[questionId].correct++;
            else stats[questionId].wrong++;
            stats[questionId].lastSeen = Date.now();
            localStorage.setItem(key, JSON.stringify(stats));
        } catch(e) {}
    }

    _flushAnswers() {
        if (!this._roundAnswers || this._roundAnswers.length === 0) return;
        _apiPost('/api/quiz-answers/' + this.userId, { batch: this._roundAnswers });
        this._roundAnswers = [];
    }

    // ── Round answer checking ──
    checkRoundAnswer(answer) {
        this.total++;
        const correct = answer === this.currentAnswer;
        const qid = this.currentQuestionId;
        this._recordAnswer(qid, correct, answer, this.currentAnswer);

        if (correct) {
            this.score++;
            this.roundCorrect++;
            this.streak++;
            if (!this._isRetry) this.firstTryCorrect++;
            this.roundIndex++;
        } else {
            this.streak = 0;
            if (this._currentQuestion) this.wrongQueue.push(this._currentQuestion);
            this.roundIndex++;
        }

        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        const msg = correct ? '答对了！' : '答错了，正确答案是：' + this.currentAnswer;
        this._showRoundFeedback(correct, msg);
    }

    _showRoundFeedback(correct, message) {
        let html = '<div class="quiz-result ' + (correct ? 'correct' : 'wrong') + '">';
        html += '<div class="result-icon">' + (correct ? '✅' : '❌') + '</div>';
        html += '<div class="result-msg">' + message + '</div>';
        if (this.streak >= 3) {
            html += '<div class="streak">🔥 连续答对 ' + this.streak + ' 题！</div>';
        }
        if (!correct) {
            html += '<div style="color:#e67e22;font-size:0.85rem;margin-top:5px">这道题会再出现，直到答对为止</div>';
        }
        html += '<button class="quiz-btn" onclick="quiz._nextRoundQuestion()">下一题</button>';
        html += '</div>';
        this.container.innerHTML = html;
    }

    _showRoundResult() {
        const elapsed = Math.floor((Date.now() - this.roundStartTime) / 1000);
        const earned = this._getTodayEarned();
        const remaining = Math.max(0, this.dailyCap - earned);
        const perfect = this.firstTryCorrect === this.roundSize;
        const perfectBonus = perfect ? 5 : 0;
        const rawReward = (this.firstTryCorrect * 2) + perfectBonus;
        const reward = Math.min(rawReward, remaining);
        const capped = rawReward > remaining;

        if (reward > 0 && typeof VipCurrency !== 'undefined') {
            VipCurrency.addCopper(this.userId, reward, '做题' + this.roundSize + '道首次答对' + this.firstTryCorrect + '题');
            this._addTodayEarned(reward);
        }

        this._markTypeDone(this.mode);
        this._flushAnswers();
        this._logRound(this.mode, elapsed, reward, this.firstTryCorrect, this.roundSize);

        const typesDone = QuizEngine.chineseTypesDoneCount(this.userId);
        let html = '<div class="quiz-result correct">';
        html += '<div class="result-icon">🎉</div>';
        html += '<h3>本组完成！</h3>';
        html += '<div class="result-score">' + this.firstTryCorrect + ' / ' + this.roundSize + '</div>';
        html += '<div style="margin:10px 0;font-size:0.9rem;color:#7f8c8d">用时：' + formatSeconds(elapsed) + '</div>';
        html += '<div style="font-size:0.85rem;color:#7f8c8d;margin:5px 0">首次答对 ' + this.firstTryCorrect + ' 题 × 2 = ' + (this.firstTryCorrect * 2) + ' 铜钱</div>';
        if (perfect) {
            html += '<div style="color:#27ae60;font-size:0.9rem;margin:8px 0;font-weight:bold">全对！额外+5铜钱</div>';
        }
        if (reward > 0) {
            html += '<div class="result-msg">获得 ' + reward + ' 文铜钱！</div>';
        }
        if (capped) {
            html += '<div style="color:#e67e22;font-size:0.85rem;margin:8px 0">今日赚钱已达上限（' + this.dailyCap + '文），可继续学习但不再获得铜钱</div>';
        }
        html += '<div style="font-size:0.8rem;color:#95a5a6;margin:5px 0">华语已完成：' + typesDone + '/4 类</div>';
        html += '<button class="quiz-btn" onclick="showQuizMenu()">返回选择</button>';
        html += '</div>';
        this.container.innerHTML = html;

        if (typeof renderCurrencyBar === 'function') {
            const bar = document.getElementById('currencyBar');
            if (bar) renderCurrencyBar(bar, this.userId);
        }
        if (this.onRoundComplete) this.onRoundComplete(this.mode);
    }

    _logRound(mode, seconds, earned, correct, total) {
        const entry = {
            mode, seconds, earned, correct, total,
            date: new Date().toISOString().slice(0, 10),
            time: Date.now()
        };
        try {
            const key = 'vip_quiz_log_' + this.userId;
            const logs = JSON.parse(localStorage.getItem(key) || '[]');
            logs.unshift(entry);
            if (logs.length > 500) logs.length = 500;
            localStorage.setItem(key, JSON.stringify(logs));
        } catch(e) {}
        _apiPost('/api/quiz-log/' + this.userId, { mode, correct, total, seconds, earned });
    }

    _esc(s) {
        return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
}
