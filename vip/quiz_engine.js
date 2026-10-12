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
    }

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

    // ── Quiz Type 1: Listen and choose character ──
    listenChooseChar() {
        this.mode = 'listenChar';
        const target = this.allChars[Math.floor(Math.random() * this.allChars.length)];
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const wrong = this.pick(this.allChars, 3, target.char);

        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">🎧 听词选字</div>';
        html += '<div class="quiz-prompt">听一听，选出正确的字</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-target-word">"<span class="blank">？</span>"中的<span class="highlight">' + target.char + '</span></div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkAnswer(\'' + this._esc(o.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
    }

    // ── Quiz Type 2: Listen and fill blank ──
    listenFillBlank() {
        this.mode = 'listenFill';
        const target = this.allChars[Math.floor(Math.random() * this.allChars.length)];
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const blankWord = word.replace(target.char, '＿');
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">🎧 听句填空</div>';
        html += '<div class="quiz-prompt">听词语，选出空缺的字</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-target-word">' + blankWord + '</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkAnswer(\'' + this._esc(o.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
    }

    // ── Quiz Type 3: See character, choose pinyin ──
    charToPinyin() {
        this.mode = 'charPinyin';
        const target = this.allChars[Math.floor(Math.random() * this.allChars.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.pinyin;

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">📝 看字选拼音</div>';
        html += '<div class="quiz-prompt">这个字的拼音是什么？</div>';
        html += '<div class="quiz-big-char">' + target.char + '</div>';
        html += '<div class="quiz-options pinyin-options">';
        options.forEach(o => {
            html += '<button class="quiz-option pinyin" onclick="quiz.checkAnswer(\'' + this._esc(o.pinyin) + '\')">' + o.pinyin + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    // ── Quiz Type 4: See pinyin, choose character ──
    pinyinToChar() {
        this.mode = 'pinyinChar';
        const target = this.allChars[Math.floor(Math.random() * this.allChars.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const options = this.shuffle([target, ...wrong]);
        this.currentAnswer = target.char;

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">📝 看拼音选字</div>';
        html += '<div class="quiz-prompt">这个拼音对应哪个字？</div>';
        html += '<div class="quiz-big-pinyin">' + target.pinyin + '</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkAnswer(\'' + this._esc(o.char) + '\')">' + o.char + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    // ── Quiz Type 5: Match pairs (simplified 4-pair version) ──
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
                    setTimeout(() => this.showResult(true, '全部配对成功！+4'), 500);
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

    // ── Quiz Type 6: Timed challenge ──
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
                const reward = this.score * 2;
                this.showTimedResult(reward);
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

    showTimedResult(reward) {
        let html = '<div class="quiz-result">';
        html += '<div class="result-icon">⚡</div>';
        html += '<h3>限时挑战结束！</h3>';
        html += '<div class="result-score">' + this.score + ' / ' + this.total + '</div>';
        html += '<div class="result-msg">答对 ' + this.score + ' 题';
        if (reward > 0) html += '，获得 ' + reward + ' 文铜钱！';
        html += '</div>';
        html += '<button class="quiz-btn" onclick="quiz.timedChallenge()">再来一次</button>';
        html += '<button class="quiz-btn secondary" onclick="showQuizMenu()">返回选择</button>';
        html += '</div>';
        this.container.innerHTML = html;

        if (reward > 0 && typeof VipCurrency !== 'undefined') {
            VipCurrency.addCopper(this.userId, reward, '限时挑战答对' + this.score + '题');
            if (typeof renderCurrencyBar === 'function') {
                const bar = document.getElementById('currencyBar');
                if (bar) renderCurrencyBar(bar, this.userId);
            }
        }
    }

    // ── Quiz Type 7: Form words ──
    formWord() {
        this.mode = 'formWord';
        const charsWithMultiWords = this.allChars.filter(c => c.words && c.words.length > 0);
        const target = charsWithMultiWords[Math.floor(Math.random() * charsWithMultiWords.length)];
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const otherChar = word.replace(target.char, '');

        if (!otherChar) { this.charToPinyin(); return; }

        const wrongChars = this.pick(this.allChars, 3, target.char).map(c => c.char);
        const options = this.shuffle([otherChar, ...wrongChars]);
        this.currentAnswer = otherChar;

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">🔤 组词练习</div>';
        html += '<div class="quiz-prompt">选一个字和它组成词语</div>';
        html += '<div class="quiz-big-char">' + target.char + ' + ？</div>';
        html += '<div class="quiz-options">';
        options.forEach(o => {
            html += '<button class="quiz-option" onclick="quiz.checkAnswer(\'' + this._esc(o) + '\')">' + o + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
    }

    // ── Quiz Type 8: Choose word for meaning ──
    wordMeaning() {
        this.mode = 'wordMeaning';
        const target = this.allChars[Math.floor(Math.random() * this.allChars.length)];
        const word = target.words[Math.floor(Math.random() * target.words.length)];
        const wrong = this.pick(this.allChars, 3, target.char);
        const wrongWords = wrong.map(w => w.words[Math.floor(Math.random() * w.words.length)]);
        const options = this.shuffle([word, ...wrongWords]);
        this.currentAnswer = word;

        let html = '<div class="quiz-question">';
        html += '<div class="quiz-type-label">📖 听音选词</div>';
        html += '<div class="quiz-prompt">听一听，选出你听到的词语</div>';
        html += '<button class="speak-btn" onclick="quiz.speak(\'' + this._esc(word) + '\', 0.7)">🔊 再听一次</button>';
        html += '<div class="quiz-options word-options">';
        options.forEach(o => {
            html += '<button class="quiz-option word" onclick="quiz.checkAnswer(\'' + this._esc(o) + '\')">' + o + '</button>';
        });
        html += '</div></div>';

        this.container.innerHTML = html;
        setTimeout(() => this.speak(word, 0.7), 300);
    }

    // ── Answer checking ──
    checkAnswer(answer) {
        this.total++;
        const correct = answer === this.currentAnswer;

        if (correct) {
            this.score++;
            this.streak++;
            const reward = 2;
            if (typeof VipCurrency !== 'undefined') {
                VipCurrency.addCopper(this.userId, reward, '答题奖励');
            }
        } else {
            this.streak = 0;
        }

        if (this.onScoreChange) this.onScoreChange(this.score, this.total);

        const correctChar = this.allChars.find(c => c.char === this.currentAnswer || c.pinyin === this.currentAnswer);
        this.showResult(correct, correct
            ? '答对了！+2文铜钱'
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

    // Random question from current mode or all modes
    randomQuestion(mode) {
        if (mode === 'all') {
            const modes = ['listenChooseChar', 'listenFillBlank', 'charToPinyin', 'pinyinToChar', 'matchPairs', 'formWord', 'wordMeaning'];
            mode = modes[Math.floor(Math.random() * modes.length)];
        }
        this[mode]();
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
