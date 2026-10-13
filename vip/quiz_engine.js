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
        this.timerInterval = null;
        this.timeLeft = 0;
        this.mode = null;
        this.onScoreChange = null;

        this.roundSize = 10;
        this.roundQuestions = [];
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.wrongQueue = [];
        this.roundStartTime = 0;
        this.dailyCap = 150;
        this._syncDailyEarned();
    }

    _todayKey() { return 'vip_daily_earned_' + this.userId + '_' + new Date().toISOString().slice(0, 10); }

    _getTodayEarned() {
        try { return parseInt(localStorage.getItem(this._todayKey()) || '0', 10); } catch(e) { return 0; }
    }

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

    // ── Start a round of 10 questions ──
    startRound(mode) {
        this.mode = mode;
        this.roundQuestions = this.shuffle(this.allChars).slice(0, this.roundSize);
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.wrongQueue = [];
        this.score = 0;
        this.total = 0;
        this.streak = 0;
        this.roundStartTime = Date.now();
        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        this._nextRoundQuestion();
    }

    _nextRoundQuestion() {
        if (this.roundIndex < this.roundQuestions.length) {
            this._generateQuestion(this.mode, this.roundQuestions[this.roundIndex]);
        } else if (this.wrongQueue.length > 0) {
            const nextWrong = this.wrongQueue.shift();
            this._generateQuestion(this.mode, nextWrong);
        } else {
            this._showRoundResult();
        }
    }

    _generateQuestion(mode, target) {
        switch (mode) {
            case 'listenChooseChar': this._listenChooseChar(target); break;
            case 'listenFillBlank': this._listenFillBlank(target); break;
            case 'charToPinyin': this._charToPinyin(target); break;
            case 'pinyinToChar': this._pinyinToChar(target); break;
            case 'formWord': this._formWord(target); break;
            case 'wordMeaning': this._wordMeaning(target); break;
            default: this._charToPinyin(target);
        }
    }

    // ── Quiz Type 1: Listen and choose character ──
    _listenChooseChar(target) {
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;

        const blankWord = word.split('').map(ch => ch === target.char ? '＿' : ch).join('');

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">🎧 听词选字</div>';
        html += '<div class="quiz-prompt">听一听，选出空缺的字</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-target-word">' + blankWord + '</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkRoundAnswer(\'' + this._esc(o.char) + '\', \'' + this._esc(target.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
    }

    // ── Quiz Type 2: Listen and fill blank ──
    _listenFillBlank(target) {
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const blankWord = word.replace(target.char, '＿');
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">🔊 听句填空</div>';
        html += '<div class="quiz-prompt">听词语，选出空缺的字</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-target-word">' + blankWord + '</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkRoundAnswer(\'' + this._esc(o.char) + '\', \'' + this._esc(target.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
    }

    // ── Quiz Type 3: See character, choose pinyin ──
    _charToPinyin(target) {
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.pinyin;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">📝 看字选拼音</div>';
        html += '<div class="quiz-prompt">这个字的拼音是什么？</div>';
        html += '<div class="quiz-big-char">' + target.char + '</div>';
        html += '<div class="quiz-options pinyin-options">';
        options.forEach(o => {
            html += '<button class="quiz-option pinyin" onclick="quiz.checkRoundAnswer(\'' + this._esc(o.pinyin) + '\', \'' + this._esc(target.char) + '\')">' + o.pinyin + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    // ── Quiz Type 4: See pinyin, choose character ──
    _pinyinToChar(target) {
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">🔤 看拼音选字</div>';
        html += '<div class="quiz-prompt">这个拼音对应哪个字？</div>';
        html += '<div class="quiz-big-pinyin">' + target.pinyin + '</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkRoundAnswer(\'' + this._esc(o.char) + '\', \'' + this._esc(target.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    // ── Quiz Type 5: Match pairs (standalone, not in rounds) ──
    matchPairs() {
        this.mode = 'match';
        const selected = this.shuffle(this.allChars).slice(0, 4);
        const charButtons = this.shuffle([...selected]);
        const pinyinButtons = this.shuffle([...selected]);

        this._matchState = {
            pairs: selected,
            matched: [],
            selectedChar: null,
        };

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">🧩 汉字连连看</div>';
        html += '<div class="quiz-prompt">点击汉字和对应拼音配对</div>';
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
                document.querySelector('.char-btn[data-char="' + state.selectedChar + '"]').classList.add('matched');
                btn.classList.add('matched');
                document.querySelector('.char-btn[data-char="' + state.selectedChar + '"]').disabled = true;
                btn.disabled = true;
                state.selectedChar = null;

                if (state.matched.length === state.pairs.length) {
                    this.score += 4;
                    this.total += 4;
                    if (this.onScoreChange) this.onScoreChange(this.score, this.total);
                    const reward = this._canEarnMore() ? 4 : 0;
                    if (reward > 0) {
                        if (typeof VipCurrency !== 'undefined') VipCurrency.addCopper(this.userId, reward, '连连看配对');
                        this._addTodayEarned(reward);
                    }
                    setTimeout(() => this.showResult(true, reward > 0 ? '全部配对成功！+' + reward + '文' : '全部配对成功！（今日已达上限）'), 500);
                }
            } else {
                btn.classList.add('wrong');
                setTimeout(() => btn.classList.remove('wrong'), 400);
                this.total++;
                if (this.onScoreChange) this.onScoreChange(this.score, this.total);
            }
            document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('selected'));
            state.selectedChar = null;
        }
    }

    // ── Quiz Type 6: Timed challenge (standalone, not in rounds) ──
    timedChallenge() {
        this.mode = 'timed';
        this.score = 0;
        this.total = 0;
        this.timeLeft = 30;

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            const timerEl = document.getElementById('timedTimer');
            if (timerEl) timerEl.textContent = this.timeLeft + '秒';
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                const earned = this._getTodayEarned();
                const remaining = Math.max(0, this.dailyCap - earned);
                const rawReward = this.score * 2;
                const reward = Math.min(rawReward, remaining);
                this.showTimedResult(reward, rawReward > reward);
            }
        }, 1000);

        this._nextTimedQuestion();
    }

    _nextTimedQuestion() {
        if (this.timeLeft <= 0) return;
        const target = this.allChars[Math.floor(Math.random() * this.allChars.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.pinyin;

        let html = '<div class="quiz-question timed">';
        html += '<div class="timed-header">';
        html += '<span class="quiz-type-label">⚡ 限时挑战</span>';
        html += '<span id="timedTimer" class="timed-timer">' + this.timeLeft + '秒</span>';
        html += '<span class="timed-score">✓' + this.score + '</span>';
        html += '</div>';
        html += '<div class="quiz-big-char">' + target.char + '</div>';
        html += '<div class="quiz-options pinyin-options">';
        options.forEach(o => {
            html += '<button class="quiz-option pinyin" onclick="quiz.checkTimedAnswer(\'' + this._esc(o.pinyin) + '\')">' + o.pinyin + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    checkTimedAnswer(answer) {
        this.total++;
        if (answer === this.currentAnswer) {
            this.score++;
            this.streak++;
        } else {
            this.streak = 0;
        }
        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        this._nextTimedQuestion();
    }

    showTimedResult(reward, capped) {
        let html = '<div class="quiz-result">';
        html += '<div class="result-icon">⚡</div>';
        html += '<h3>限时挑战结束！</h3>';
        html += '<div class="result-score">' + this.score + ' / ' + this.total + '</div>';
        html += '<div class="result-msg">答对 ' + this.score + ' 题';
        if (reward > 0) html += '，获得 ' + reward + ' 文铜钱！';
        if (capped) html += '<br><span style="color:#e67e22;font-size:0.85rem">今日赚钱已达上限，可继续学习但不再获得铜钱</span>';
        html += '</div>';
        html += '<button class="quiz-btn" onclick="quiz.timedChallenge()">再来一次</button>';
        html += '<button class="quiz-btn secondary" onclick="showQuizMenu()">返回选择</button>';
        html += '</div>';
        this.container.innerHTML = html;

        if (reward > 0 && typeof VipCurrency !== 'undefined') {
            VipCurrency.addCopper(this.userId, reward, '限时挑战答对' + this.score + '题');
            this._addTodayEarned(reward);
            if (typeof renderCurrencyBar === 'function') {
                const bar = document.getElementById('currencyBar');
                if (bar) renderCurrencyBar(bar, this.userId);
            }
        }
        this._logRound('限时挑战', Math.floor((Date.now() - (this.roundStartTime || Date.now())) / 1000), reward, this.score, this.total);
    }

    // ── Quiz Type 7: Form words ──
    _formWord(target) {
        const charsWithWords = this.allChars.filter(c => c.words && c.words.length > 0);
        if (!target.words || target.words.length === 0) {
            target = charsWithWords[Math.floor(Math.random() * charsWithWords.length)];
        }
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const otherChar = word.replace(target.char, '');

        if (!otherChar) { this._charToPinyin(target); return; }

        const wrongChars = this.pick(this.allChars, 3, target.char).map(c => c.char);
        const options = this.shuffle([otherChar, ...wrongChars]);
        this.currentAnswer = otherChar;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">📖 组词练习</div>';
        html += '<div class="quiz-prompt">选一个字和它组成词语</div>';
        html += '<div class="quiz-big-char">' + target.char + ' + ？</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkRoundAnswer(\'' + this._esc(o) + '\', \'' + this._esc(target.char) + '\')">' + o + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    // ── Quiz Type 8: Listen and choose word ──
    _wordMeaning(target) {
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const wrongWords = wrong.map(w => w.words[Math.floor(Math.random() * w.words.length)]);
        const options = this.shuffle([word, ...wrongWords]);
        this.currentAnswer = word;

        let html = '<div class="quiz-question">';
        html += this._roundProgress();
        html += '<div class="quiz-type-label">👂 听音选词</div>';
        html += '<div class="quiz-prompt">听一听，选出你听到的词语</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-options word-options">';
        options.forEach(o => {
            html += '<button class="quiz-option word" onclick="quiz.checkRoundAnswer(\'' + this._esc(o) + '\', \'' + this._esc(target.char) + '\')">' + o + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
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

    // ── Round answer checking ──
    checkRoundAnswer(answer, targetChar) {
        this.total++;
        const correct = answer === this.currentAnswer;

        if (correct) {
            this.score++;
            this.roundCorrect++;
            this.streak++;
            this.roundIndex++;
        } else {
            this.streak = 0;
            const target = this.allChars.find(c => c.char === targetChar);
            if (target) this.wrongQueue.push(target);
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

    // ── Round result ──
    _showRoundResult() {
        const elapsed = Math.floor((Date.now() - this.roundStartTime) / 1000);
        const earned = this._getTodayEarned();
        const remaining = Math.max(0, this.dailyCap - earned);
        const rawReward = this.roundCorrect * 2;
        const reward = Math.min(rawReward, remaining);
        const capped = rawReward > remaining;

        if (reward > 0 && typeof VipCurrency !== 'undefined') {
            VipCurrency.addCopper(this.userId, reward, '做题' + this.roundSize + '道答对' + this.roundCorrect + '题');
            this._addTodayEarned(reward);
        }

        this._logRound(this.mode, elapsed, reward, this.roundCorrect, this.total);

        let html = '<div class="quiz-result correct">';
        html += '<div class="result-icon">🎉</div>';
        html += '<h3>本组完成！</h3>';
        html += '<div class="result-score">' + this.roundCorrect + ' / ' + this.roundSize + '</div>';
        html += '<div style="margin:10px 0;font-size:0.9rem;color:#7f8c8d">';
        html += '用时：' + formatSeconds(elapsed);
        html += '</div>';
        if (reward > 0) {
            html += '<div class="result-msg">获得 ' + reward + ' 文铜钱！</div>';
        }
        if (capped) {
            html += '<div style="color:#e67e22;font-size:0.85rem;margin:8px 0">今日赚钱已达上限（' + this.dailyCap + '文），可继续学习但不再获得铜钱</div>';
        }
        html += '<div style="font-size:0.8rem;color:#95a5a6;margin:5px 0">今日已赚：' + this._getTodayEarned() + '/' + this.dailyCap + '文</div>';
        html += '<button class="quiz-btn" onclick="quiz.startRound(\'' + this.mode + '\')">再来一组</button>';
        html += '<button class="quiz-btn secondary" onclick="showQuizMenu()">返回选择</button>';
        html += '</div>';
        this.container.innerHTML = html;

        if (typeof renderCurrencyBar === 'function') {
            const bar = document.getElementById('currencyBar');
            if (bar) renderCurrencyBar(bar, this.userId);
        }
    }

    _logRound(mode, seconds, earned, correct, total) {
        try {
            const key = 'vip_quiz_log_' + this.userId;
            const logs = JSON.parse(localStorage.getItem(key) || '[]');
            logs.unshift({
                mode, seconds, earned, correct, total,
                date: new Date().toISOString().slice(0, 10),
                time: Date.now()
            });
            if (logs.length > 500) logs.length = 500;
            localStorage.setItem(key, JSON.stringify(logs));
        } catch(e) {}
    }

    // ── Legacy single-question methods (for match pairs / timed) ──
    checkAnswer(answer) {
        this.total++;
        const correct = answer === this.currentAnswer;

        if (correct) {
            this.score++;
            this.streak++;
        } else {
            this.streak = 0;
        }

        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        this.showResult(correct, correct
            ? '答对了！'
            : '答错了，正确答案是：' + this.currentAnswer
        );
    }

    showResult(correct, message) {
        let html = '<div class="quiz-result ' + (correct ? 'correct' : 'wrong') + '">';
        html += '<div class="result-icon">' + (correct ? '✅' : '❌') + '</div>';
        html += '<div class="result-msg">' + message + '</div>';
        if (this.streak >= 3) {
            html += '<div class="streak">🔥 连续答对 ' + this.streak + ' 题！</div>';
        }
        html += '<button class="quiz-btn" onclick="nextQuestion()">下一题</button>';
        html += '</div>';
        this.container.innerHTML = html;

        if (typeof renderCurrencyBar === 'function') {
            const bar = document.getElementById('currencyBar');
            if (bar) renderCurrencyBar(bar, this.userId);
        }
    }

    randomQuestion(mode) {
        if (mode === 'matchPairs' || mode === 'timedChallenge') {
            this[mode]();
        } else {
            this.startRound(mode);
        }
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _esc(s) {
        return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
}
