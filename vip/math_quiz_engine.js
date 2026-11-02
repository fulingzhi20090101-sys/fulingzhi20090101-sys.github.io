'use strict';

class MathQuizEngine {
    constructor(topics, userId, container) {
        this.topics = topics;
        this.userId = userId;
        this.container = container;
        this.score = 0;
        this.total = 0;
        this.streak = 0;
        this.currentAnswer = null;
        this.currentQuestionId = null;
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
        this._currentTopicNames = [];
        this._topicFirstTry = {};
        this._topicFirstTryTotal = {};
        this.mode = null;
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

    // ── Per-topic accuracy tracking ──
    static _accuracyKey(userId) { return 'vip_math_accuracy_' + userId; }

    _getAccuracy() {
        try { return JSON.parse(localStorage.getItem(MathQuizEngine._accuracyKey(this.userId)) || '{}'); }
        catch(e) { return {}; }
    }

    _updateAccuracy(topicName, correct, total) {
        try {
            const key = MathQuizEngine._accuracyKey(this.userId);
            const acc = JSON.parse(localStorage.getItem(key) || '{}');
            if (!acc[topicName]) acc[topicName] = { correct: 0, total: 0 };
            acc[topicName].correct += correct;
            acc[topicName].total += total;
            localStorage.setItem(key, JSON.stringify(acc));
        } catch(e) {}
        _apiPost('/api/daily/' + this.userId, { type: 'math_accuracy', topic: topicName, correct: correct, total: total });
    }

    _getTopicRate(topicName) {
        const acc = this._getAccuracy();
        if (!acc[topicName] || acc[topicName].total === 0) return 0;
        return acc[topicName].correct / acc[topicName].total;
    }

    static getTopicAccuracies(topics, userId) {
        let acc = {};
        try { acc = JSON.parse(localStorage.getItem(MathQuizEngine._accuracyKey(userId)) || '{}'); }
        catch(e) {}
        return topics.map(t => {
            const a = acc[t.topic];
            return { topic: t.topic, rate: (a && a.total > 0) ? Math.round(100 * a.correct / a.total) : 0 };
        });
    }

    // ── Math group daily tracking ──
    static _mathGroupsDoneKey(userId) {
        return 'vip_math_groups_done_' + userId + '_' + new Date().toISOString().slice(0, 10);
    }
    static get dailyMathGroupLimit() { return 3; }
    static getMathGroupsDoneToday(userId) {
        try { return parseInt(localStorage.getItem(MathQuizEngine._mathGroupsDoneKey(userId)) || '0', 10); }
        catch(e) { return 0; }
    }
    _incrementMathGroupsDone() {
        const key = MathQuizEngine._mathGroupsDoneKey(this.userId);
        try {
            const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
            localStorage.setItem(key, String(count));
        } catch(e) {}
        const date = new Date().toISOString().slice(0, 10);
        _apiPost('/api/daily/' + this.userId, { type: 'math_groups_done', date: date, value: MathQuizEngine.getMathGroupsDoneToday(this.userId) });
    }
    static canDoMoreMath(userId) {
        return MathQuizEngine.getMathGroupsDoneToday(userId) < MathQuizEngine.dailyMathGroupLimit;
    }

    // ── Pick 2 topics from lowest-accuracy 50% ──
    _pickTopics() {
        const rates = this.topics.map((t, i) => ({
            index: i,
            topic: t.topic,
            rate: this._getTopicRate(t.topic)
        }));
        rates.sort((a, b) => a.rate - b.rate);
        const halfCount = Math.max(2, Math.ceil(rates.length / 2));
        const lowHalf = rates.slice(0, halfCount);
        const shuffled = this.shuffle(lowHalf);
        return [shuffled[0], shuffled[1]];
    }

    // ── Start a mixed-topic round (10 questions: 5 from each of 2 topics) ──
    startMixedRound() {
        const picked = this._pickTopics();
        this._currentTopicNames = [picked[0].topic, picked[1].topic];
        this.mode = 'math_mixed';

        const t1 = this.topics[picked[0].index];
        const t2 = this.topics[picked[1].index];
        const q1 = this.shuffle(t1.questions).slice(0, 5).map(q => ({ ...q, _topic: t1.topic }));
        const q2 = this.shuffle(t2.questions).slice(0, 5).map(q => ({ ...q, _topic: t2.topic }));

        this._roundAnswers = [];
        this.roundSize = 10;
        this.roundQuestions = this.shuffle([...q1, ...q2]);
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.firstTryCorrect = 0;
        this.wrongQueue = [];
        this._isRetry = false;
        this._currentQuestion = null;
        this._topicFirstTry = {};
        this._topicFirstTryTotal = {};
        this.score = 0;
        this.total = 0;
        this.streak = 0;
        this.roundStartTime = Date.now();
        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        this._nextQuestion();
    }

    _nextQuestion() {
        if (this.roundIndex < this.roundQuestions.length) {
            this._isRetry = false;
            this._currentQuestion = this.roundQuestions[this.roundIndex];
            this._showQuestion(this._currentQuestion);
        } else if (this.wrongQueue.length > 0) {
            this._isRetry = true;
            this._currentQuestion = this.wrongQueue.shift();
            this._showQuestion(this._currentQuestion);
        } else {
            this._showRoundResult();
        }
    }

    _showQuestion(q) {
        this.currentAnswer = q.answer;
        this.currentQuestionId = 'math:' + q.q.slice(0, 40);
        const shuffled = this.shuffle([...q.options]);
        const progress = Math.min(this.roundIndex + 1, this.roundSize);
        const wrongLeft = this.wrongQueue.length;

        let html = '<div class="quiz-question">';
        html += '<div style="font-size:0.75rem;color:#95a5a6;margin-bottom:8px;text-align:right">';
        html += '第 ' + progress + '/' + this.roundSize + ' 题';
        if (wrongLeft > 0) html += '（还有' + wrongLeft + '题需要重做）';
        html += '</div>';
        html += '<div class="quiz-type-label">📐 ' + this._escHtml(q._topic) + '</div>';
        html += '<div style="font-size:1.3rem;margin:20px 0;font-weight:bold;line-height:1.6">' + this._escHtml(q.q) + '</div>';
        html += '<div class="quiz-options">';
        shuffled.forEach(opt => {
            html += '<button class="quiz-option" style="font-size:1.1rem" onclick="mathQuiz.checkAnswer(\'' + this._esc(opt) + '\')">' + this._escHtml(opt) + '</button>';
        });
        html += '</div></div>';
        this.container.innerHTML = html;
    }

    checkAnswer(answer) {
        this.total++;
        const correct = answer === this.currentAnswer;
        this._recordAnswer(this.currentQuestionId, correct, answer, this.currentAnswer);
        const topic = this._currentQuestion._topic;

        if (correct) {
            this.score++;
            this.roundCorrect++;
            this.streak++;
            if (!this._isRetry) {
                this.firstTryCorrect++;
                this._topicFirstTry[topic] = (this._topicFirstTry[topic] || 0) + 1;
                this._topicFirstTryTotal[topic] = (this._topicFirstTryTotal[topic] || 0) + 1;
            }
            this.roundIndex++;
        } else {
            this.streak = 0;
            if (!this._isRetry) {
                this._topicFirstTryTotal[topic] = (this._topicFirstTryTotal[topic] || 0) + 1;
            }
            if (this._currentQuestion) this.wrongQueue.push(this._currentQuestion);
            this.roundIndex++;
        }

        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        const msg = correct ? '答对了！' : '答错了，正确答案是：' + this.currentAnswer;
        this._showFeedback(correct, msg);
    }

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

    _showFeedback(correct, message) {
        let html = '<div class="quiz-result ' + (correct ? 'correct' : 'wrong') + '">';
        html += '<div class="result-icon">' + (correct ? '✅' : '❌') + '</div>';
        html += '<div class="result-msg">' + message + '</div>';
        if (this.streak >= 3) {
            html += '<div class="streak">🔥 连续答对 ' + this.streak + ' 题！</div>';
        }
        if (!correct) {
            html += '<div style="color:#e67e22;font-size:0.85rem;margin-top:5px">这道题会再出现，直到答对为止</div>';
        }
        html += '<button class="quiz-btn" onclick="mathQuiz._nextQuestion()">下一题</button>';
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
            VipCurrency.addCopper(this.userId, reward, 'Math ' + this._currentTopicNames.join('+'));
            this._addTodayEarned(reward);
        }

        for (const topic of this._currentTopicNames) {
            const c = this._topicFirstTry[topic] || 0;
            const t = this._topicFirstTryTotal[topic] || 0;
            if (t > 0) this._updateAccuracy(topic, c, t);
        }

        this._incrementMathGroupsDone();
        this._flushAnswers();

        const entry = {
            mode: this.mode, seconds: elapsed, earned: reward,
            correct: this.firstTryCorrect, total: this.roundSize,
            topics: this._currentTopicNames,
            date: new Date().toISOString().slice(0, 10), time: Date.now()
        };
        try {
            const key = 'vip_quiz_log_' + this.userId;
            const logs = JSON.parse(localStorage.getItem(key) || '[]');
            logs.unshift(entry);
            if (logs.length > 500) logs.length = 500;
            localStorage.setItem(key, JSON.stringify(logs));
        } catch(e) {}
        _apiPost('/api/quiz-log/' + this.userId, { mode: this.mode, correct: this.firstTryCorrect, total: this.roundSize, seconds: elapsed, earned: reward, topics: this._currentTopicNames });

        const mathDone = MathQuizEngine.getMathGroupsDoneToday(this.userId);
        const mathLimit = MathQuizEngine.dailyMathGroupLimit;
        let html = '<div class="quiz-result correct">';
        html += '<div class="result-icon">🎉</div>';
        html += '<h3>本组完成！</h3>';
        html += '<div style="font-size:0.85rem;color:#7f8c8d;margin:8px 0">题目类型：' + this._escHtml(this._currentTopicNames.join(' + ')) + '</div>';
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
            html += '<div style="color:#e67e22;font-size:0.85rem;margin:8px 0">今日赚钱已达上限</div>';
        }
        html += '<div style="font-size:0.8rem;color:#95a5a6;margin:5px 0">数学已完成：' + mathDone + '/' + mathLimit + ' 组</div>';
        html += '<button class="quiz-btn" onclick="showQuizMenu()">返回选择</button>';
        html += '</div>';
        this.container.innerHTML = html;

        if (typeof renderCurrencyBar === 'function') {
            const bar = document.getElementById('currencyBar');
            if (bar) renderCurrencyBar(bar, this.userId);
        }
        if (this.onRoundComplete) this.onRoundComplete(this.mode);
    }

    _esc(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
    _escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}
