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
        this.roundReward = 20;
        this.roundQuestions = [];
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.wrongQueue = [];
        this.roundStartTime = 0;
        this.currentTopic = null;
        this.mode = null;
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

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    startRound(topicIndex) {
        const topic = this.topics[topicIndex];
        if (!topic) return;
        this.currentTopic = topic;
        this.mode = 'math_' + topicIndex;
        this._roundAnswers = [];
        this.roundQuestions = this.shuffle(topic.questions).slice(0, this.roundSize);
        this.roundIndex = 0;
        this.roundCorrect = 0;
        this.wrongQueue = [];
        this.score = 0;
        this.total = 0;
        this.streak = 0;
        this.roundStartTime = Date.now();
        if (this.onScoreChange) this.onScoreChange(this.score, this.total);
        this._nextQuestion();
    }

    _nextQuestion() {
        if (this.roundIndex < this.roundQuestions.length) {
            this._showQuestion(this.roundQuestions[this.roundIndex]);
        } else if (this.wrongQueue.length > 0) {
            this._showQuestion(this.wrongQueue.shift());
        } else {
            this._showRoundResult();
        }
    }

    _showQuestion(q) {
        this.currentAnswer = q.answer;
        this.currentQuestionId = 'math:' + q.q.slice(0, 40);
        const shuffled = this.shuffle([...q.options]);
        const progress = this.roundIndex + 1;
        const wrongLeft = this.wrongQueue.length;

        let html = '<div class="quiz-question">';
        html += '<div style="font-size:0.75rem;color:#95a5a6;margin-bottom:8px;text-align:right">';
        html += '第 ' + progress + '/' + this.roundSize + ' 题';
        if (wrongLeft > 0) html += '（还有' + wrongLeft + '题需要重做）';
        html += '</div>';
        html += '<div class="quiz-type-label">📐 ' + this.currentTopic.topic + '</div>';
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

        if (correct) {
            this.score++;
            this.roundCorrect++;
            this.streak++;
            this.roundIndex++;
        } else {
            this.streak = 0;
            const q = this.roundQuestions[this.roundIndex] || this.roundQuestions[0];
            this.wrongQueue.push(q);
            this.roundIndex++;
        }

        if (this.onScoreChange) this.onScoreChange(this.score, this.total);

        const msg = correct ? 'Correct!' : 'Wrong! The answer is: ' + this.currentAnswer;
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
            html += '<div class="streak">🔥 ' + this.streak + ' in a row!</div>';
        }
        if (!correct) {
            html += '<div style="color:#e67e22;font-size:0.85rem;margin-top:5px">This question will appear again until you get it right.</div>';
        }
        html += '<button class="quiz-btn" onclick="mathQuiz._nextQuestion()">Next</button>';
        html += '</div>';
        this.container.innerHTML = html;
    }

    _showRoundResult() {
        const elapsed = Math.floor((Date.now() - this.roundStartTime) / 1000);
        const earned = this._getTodayEarned();
        const remaining = Math.max(0, this.dailyCap - earned);
        const perfect = this.roundCorrect === this.roundSize && this.total === this.roundSize;
        const perfectBonus = perfect ? 5 : 0;
        const rawReward = this.roundReward + perfectBonus;
        const reward = Math.min(rawReward, remaining);
        const capped = rawReward > remaining;

        if (reward > 0 && typeof VipCurrency !== 'undefined') {
            VipCurrency.addCopper(this.userId, reward, 'Math quiz: ' + this.currentTopic.topic);
            this._addTodayEarned(reward);
        }

        this._incrementGroupsDone();
        this._flushAnswers();

        const entry = {
            mode: this.mode, seconds: elapsed, earned: reward,
            correct: this.roundCorrect, total: this.total,
            date: new Date().toISOString().slice(0, 10), time: Date.now()
        };
        try {
            const key = 'vip_quiz_log_' + this.userId;
            const logs = JSON.parse(localStorage.getItem(key) || '[]');
            logs.unshift(entry);
            if (logs.length > 500) logs.length = 500;
            localStorage.setItem(key, JSON.stringify(logs));
        } catch(e) {}
        _apiPost('/api/quiz-log/' + this.userId, { mode: this.mode, correct: this.roundCorrect, total: this.total, seconds: elapsed, earned: reward });

        const groupsDone = typeof QuizEngine !== 'undefined' ? QuizEngine.getGroupsDoneToday(this.userId) : 0;
        let html = '<div class="quiz-result correct">';
        html += '<div class="result-icon">🎉</div>';
        html += '<h3>本组完成！</h3>';
        html += '<div class="result-score">' + this.roundCorrect + ' / ' + this.roundSize + '</div>';
        html += '<div style="margin:10px 0;font-size:0.9rem;color:#7f8c8d">用时：' + formatSeconds(elapsed) + '</div>';
        if (perfect) {
            html += '<div style="color:#27ae60;font-size:0.9rem;margin:8px 0;font-weight:bold">全对！额外+5铜钱</div>';
        }
        if (reward > 0) {
            html += '<div class="result-msg">获得 ' + reward + ' 文铜钱！</div>';
        }
        if (capped) {
            html += '<div style="color:#e67e22;font-size:0.85rem;margin:8px 0">今日赚钱已达上限</div>';
        }
        html += '<div style="font-size:0.8rem;color:#95a5a6;margin:5px 0">今日已完成：' + groupsDone + '/' + (typeof QuizEngine !== 'undefined' ? QuizEngine.dailyGroupLimit : 5) + ' 组</div>';
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

    _incrementGroupsDone() {
        const date = new Date().toISOString().slice(0, 10);
        const localKey = 'vip_groups_done_' + this.userId + '_' + date;
        try {
            const count = parseInt(localStorage.getItem(localKey) || '0', 10) + 1;
            localStorage.setItem(localKey, String(count));
        } catch(e) {}
        const total = typeof QuizEngine !== 'undefined' ? QuizEngine.getGroupsDoneToday(this.userId) : parseInt(localStorage.getItem(localKey) || '0', 10);
        _apiPost('/api/daily/' + this.userId, { type: 'groups_done', date: date, value: total });
    }

    _syncDailyEarned() {
        const date = new Date().toISOString().slice(0, 10);
        _apiGet('/api/daily/' + this.userId + '?type=quiz_earned&date=' + date).then(data => {
            if (data && typeof data.value === 'number' && data.value > 0) {
                try { localStorage.setItem(this._todayKey(), String(data.value)); } catch(e) {}
            }
        });
    }
}
