'use strict';
// ================================================================
// main.js – Xiaobawang launcher: state machine, UI, avatars
// ================================================================

// ── Constants ──
const USERS = ['Zhaoyi', 'Zhaolin', 'Jerry', 'Min'];

const ALL_AVATARS = [
    ['Zhaoyi', '女孩'],  ['Boy',    '男孩'],  ['Jerry',  '老鼠'],  ['Min',   '女士'],
    ['Hamster','仓鼠'],  ['Cat',    '猫咪'],  ['Rabbit', '兔子'],  ['Bear',  '熊'],
    ['Panda',  '熊猫'],  ['Fox',    '狐狸'],  ['Alien',  '外星人'],['Robot', '机器人'],
];

const GAMES = [
    { key: 'balloon',  title: '气球打字', desc: '气球飘上来，打字击破它！', disabled: true  },
    { key: 'trekjump', title: '恐龙跳跳', desc: '跳过障碍，越跑越快！',     disabled: true  },
    { key: 'carrace',  title: '赛车竞速', desc: '躲开敌车，冲向终点！',     disabled: false },
    { key: 'frogjump', title: '青蛙跳台', desc: '跳上平台，收集宝石！',     disabled: true  },
];

const LS_AVATARS = 'xbw_user_avatars';
const LS_SCORES  = 'xbw_scores';

// ── App state ──
let state           = '';
let currentUser     = null;
let iconSelectFor   = null;
let pendingGame     = null;
let sessionDuration = 0;
let sessionTimeLeft = 0;
let sessionRunning  = false;
let currentScore    = 0;
let timerIntervalId = null;

let userAvatars = (() => {
    try {
        const s = JSON.parse(localStorage.getItem(LS_AVATARS) || '{}');
        return { Zhaoyi: 'Zhaoyi', Zhaolin: 'Hamster', Jerry: 'Jerry', Min: 'Min', ...s };
    } catch { return { Zhaoyi: 'Zhaoyi', Zhaolin: 'Hamster', Jerry: 'Jerry', Min: 'Min' }; }
})();

let allScores = (() => {
    try { return JSON.parse(localStorage.getItem(LS_SCORES) || '{}'); }
    catch { return {}; }
})();

// ── DOM refs ──
const canvas          = document.getElementById('gameCanvas');
const screenContainer = document.getElementById('screen-container');
const tbUserBtn       = document.getElementById('tb-user-btn');
const tbTimer         = document.getElementById('tb-timer');
const tbScoreDisplay  = document.getElementById('tb-score-display');
const tbBackBtn       = document.getElementById('tb-back-btn');

const screens = {};
['user-select','icon-select','main-menu','time-select','cr-start','cr-gameover'].forEach(id => {
    screens[id] = document.getElementById('screen-' + id);
});

// ── Screen helpers ──
function showScreen(name) {
    canvas.style.display = 'none';
    screenContainer.style.display = '';
    for (const [k, el] of Object.entries(screens)) {
        el.style.display = k === name ? 'flex' : 'none';
    }
}

function showCanvas() {
    screenContainer.style.display = 'none';
    canvas.style.display = 'block';
}

// ── State machine ──
function setState(newState) {
    state = newState;
    updateTitleBar();
    if      (newState === 'user-select')  buildUserSelect();
    else if (newState === 'icon-select')  buildIconSelect();
    else if (newState === 'main-menu')    buildMainMenu();
    else if (newState === 'time-select')  buildTimeSelect();
    else if (newState === 'cr-start')     buildCrStart();
    else if (newState === 'cr-playing')   { showCanvas(); startCarRace(); }
    else if (newState === 'cr-gameover')  buildCrGameover();
}

// ── Title bar ──
function updateTitleBar() {
    // User button
    tbUserBtn.innerHTML = '';
    if (currentUser) {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 24;
        drawAvatar(c.getContext('2d'), userAvatars[currentUser] || currentUser, 12, 12, 10);
        const span = document.createElement('span');
        span.textContent = currentUser;
        tbUserBtn.append(c, span);
    } else {
        tbUserBtn.textContent = '选择用户';
    }
    tbUserBtn.onclick = () => { stopCurrentGame(); setState('user-select'); };

    // Back button
    const noBack = ['user-select', 'main-menu'];
    tbBackBtn.style.display = noBack.includes(state) ? 'none' : '';
    tbBackBtn.onclick = () => {
        if      (state === 'icon-select')  setState('user-select');
        else if (state === 'time-select')  setState('main-menu');
        else if (state === 'cr-start')     setState('main-menu');
        else if (state === 'cr-playing') {
            if (window.carRaceInstance) currentScore = window.carRaceInstance.score;
            stopCurrentGame();
            addScore('carrace', currentScore, currentUser || '?');
            setState('cr-gameover');
        }
        else setState('main-menu');
    };

    // Timer display
    if (sessionTimeLeft > 0) {
        const m = Math.floor(sessionTimeLeft / 60);
        const s = sessionTimeLeft % 60;
        tbTimer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        tbTimer.className = sessionTimeLeft <= 15 ? 'warn' : '';
        tbTimer.style.display = '';
    } else {
        tbTimer.style.display = 'none';
    }

    // Score display (gameplay only)
    if (state === 'cr-playing') {
        tbScoreDisplay.textContent = `得分: ${currentScore}`;
        tbScoreDisplay.style.display = '';
    } else {
        tbScoreDisplay.style.display = 'none';
    }
}

// ── Session timer ──
function startSession(duration) {
    sessionDuration = duration;
    sessionTimeLeft = duration;
    sessionRunning  = false;
}

function activateTimer() {
    if (timerIntervalId) clearInterval(timerIntervalId);
    sessionRunning = true;
    timerIntervalId = setInterval(() => {
        if (!sessionRunning || sessionTimeLeft <= 0) return;
        sessionTimeLeft--;
        updateTitleBar();
        if (sessionTimeLeft <= 0) {
            sessionRunning = false;
            clearInterval(timerIntervalId);
        }
    }, 1000);
}

function pauseTimer() { sessionRunning = false; }

function stopCurrentGame() {
    pauseTimer();
    if (window.carRaceInstance) {
        window.carRaceInstance.stop();
        window.carRaceInstance = null;
    }
}

// ── Leaderboard ──
function getTopScores(gameKey, n = 10) {
    return (allScores[gameKey] || []).slice(0, n);
}

function addScore(gameKey, score, user) {
    if (!allScores[gameKey]) allScores[gameKey] = [];
    allScores[gameKey].push({ score, user });
    allScores[gameKey].sort((a, b) => b.score - a.score);
    allScores[gameKey] = allScores[gameKey].slice(0, 10);
    try { localStorage.setItem(LS_SCORES, JSON.stringify(allScores)); } catch {}
}

function buildLeaderboard(gameKey, hiScore, hiUser) {
    const top = getTopScores(gameKey);
    const div = document.createElement('div');
    div.className = 'leaderboard';
    div.innerHTML = '<h3>排行榜 Top 10</h3>';
    if (!top.length) {
        const p = document.createElement('p');
        p.style.cssText = 'font-size:0.78rem;color:var(--text-dim);text-align:center;padding:8px 0';
        p.textContent = '暂无记录';
        div.appendChild(p);
        return div;
    }
    top.forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row' + (entry.score === hiScore && entry.user === hiUser ? ' highlight' : '');
        row.innerHTML =
            `<span class="lb-rank">${i + 1}</span>` +
            `<span class="lb-user">${(entry.user || '?').slice(0, 6)}</span>` +
            `<span class="lb-score">${entry.score}</span>`;
        div.appendChild(row);
    });
    return div;
}

// ================================================================
// Avatar drawing
// ================================================================
function drawAvatar(ctx, key, cx, cy, r) {
    ctx.save();
    switch (key) {
        case 'Zhaoyi':  avZhaoyi(ctx, cx, cy, r);  break;
        case 'Boy':     avBoy(ctx, cx, cy, r);      break;
        case 'Jerry':   avJerry(ctx, cx, cy, r);    break;
        case 'Min':     avMin(ctx, cx, cy, r);      break;
        case 'Hamster': avHamster(ctx, cx, cy, r);  break;
        case 'Cat':     avCat(ctx, cx, cy, r);      break;
        case 'Rabbit':  avRabbit(ctx, cx, cy, r);   break;
        case 'Bear':    avBear(ctx, cx, cy, r);     break;
        case 'Panda':   avPanda(ctx, cx, cy, r);    break;
        case 'Fox':     avFox(ctx, cx, cy, r);      break;
        case 'Alien':   avAlien(ctx, cx, cy, r);    break;
        case 'Robot':   avRobot(ctx, cx, cy, r);    break;
        default:        avJerry(ctx, cx, cy, r);
    }
    ctx.restore();
}

// Drawing primitives
function fc(ctx, x, y, r, c) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
}
function fe(ctx, x, y, rx, ry, c) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
}
function fr(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

// ── Zhaoyi: girl, brown hair buns, pink clips, rosy cheeks ──
function avZhaoyi(ctx, cx, cy, r) {
    fc(ctx, cx - r*0.72, cy - r*0.5, r*0.38, '#8B4513');
    fc(ctx, cx + r*0.72, cy - r*0.5, r*0.38, '#8B4513');
    fc(ctx, cx, cy, r, '#FDBCB4');
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fillStyle = '#8B4513'; ctx.fill();
    fc(ctx, cx - r*0.3, cy - r*0.1, r*0.1, '#333');
    fc(ctx, cx + r*0.3, cy - r*0.1, r*0.1, '#333');
    fc(ctx, cx - r*0.27, cy - r*0.14, r*0.035, 'white');
    fc(ctx, cx + r*0.27, cy - r*0.14, r*0.035, 'white');
    fe(ctx, cx - r*0.45, cy + r*0.15, r*0.18, r*0.12, 'rgba(255,120,120,0.45)');
    fe(ctx, cx + r*0.45, cy + r*0.15, r*0.18, r*0.12, 'rgba(255,120,120,0.45)');
    ctx.beginPath(); ctx.arc(cx, cy + r*0.22, r*0.14, 0, Math.PI);
    ctx.strokeStyle = '#c07070'; ctx.lineWidth = r/18; ctx.stroke();
    fc(ctx, cx - r*0.72, cy - r*0.5, r*0.12, '#FF69B4');
    fc(ctx, cx + r*0.72, cy - r*0.5, r*0.12, '#FF69B4');
}

// ── Boy: dark hair, angled brows ──
function avBoy(ctx, cx, cy, r) {
    fc(ctx, cx, cy, r, '#FDBCB4');
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI*1.08, 0); ctx.fillStyle = '#1a1a2e'; ctx.fill();
    fc(ctx, cx - r*0.3, cy - r*0.1, r*0.1, '#222');
    fc(ctx, cx + r*0.3, cy - r*0.1, r*0.1, '#222');
    ctx.strokeStyle = '#333'; ctx.lineWidth = r/12;
    ctx.beginPath(); ctx.moveTo(cx-r*0.45, cy-r*0.28); ctx.lineTo(cx-r*0.15, cy-r*0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+r*0.15, cy-r*0.22); ctx.lineTo(cx+r*0.45, cy-r*0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-r*0.15, cy+r*0.3); ctx.lineTo(cx+r*0.15, cy+r*0.3);
    ctx.strokeStyle = '#c07070'; ctx.lineWidth = r/18; ctx.stroke();
}

// ── Jerry: mouse, round ears, whiskers, tiny teeth ──
function avJerry(ctx, cx, cy, r) {
    fc(ctx, cx - r*0.65, cy - r*0.72, r*0.34, '#C8A0B4');
    fc(ctx, cx + r*0.65, cy - r*0.72, r*0.34, '#C8A0B4');
    fc(ctx, cx - r*0.65, cy - r*0.72, r*0.19, '#E8C0D4');
    fc(ctx, cx + r*0.65, cy - r*0.72, r*0.19, '#E8C0D4');
    fc(ctx, cx, cy, r, '#C8A0B4');
    fc(ctx, cx - r*0.3, cy - r*0.15, r*0.11, '#1a1a60');
    fc(ctx, cx + r*0.3, cy - r*0.15, r*0.11, '#1a1a60');
    fc(ctx, cx - r*0.26, cy - r*0.19, r*0.04, 'white');
    fc(ctx, cx + r*0.26, cy - r*0.19, r*0.04, 'white');
    fc(ctx, cx, cy + r*0.1, r*0.1, '#9b4466');
    ctx.strokeStyle = '#777'; ctx.lineWidth = r/28;
    [[cx, cy+r*0.16, cx-r*0.9, cy-r*0.02],
     [cx, cy+r*0.2,  cx-r*0.9, cy+r*0.12],
     [cx, cy+r*0.16, cx+r*0.9, cy-r*0.02],
     [cx, cy+r*0.2,  cx+r*0.9, cy+r*0.12]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    fr(ctx, cx-r*0.12, cy+r*0.27, r*0.1, r*0.14, 'white');
    fr(ctx, cx+r*0.02, cy+r*0.27, r*0.1, r*0.14, 'white');
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = r/28;
    ctx.strokeRect(cx-r*0.12, cy+r*0.27, r*0.1, r*0.14);
    ctx.strokeRect(cx+r*0.02, cy+r*0.27, r*0.1, r*0.14);
}

// ── Min: fuller hair, rectangular glasses ──
function avMin(ctx, cx, cy, r) {
    fc(ctx, cx, cy, r, '#1a1a1a');
    fc(ctx, cx, cy + r*0.08, r*0.88, '#FDBCB4');
    fe(ctx, cx - r*0.88, cy + r*0.1, r*0.22, r*0.58, '#1a1a1a');
    fe(ctx, cx + r*0.88, cy + r*0.1, r*0.22, r*0.58, '#1a1a1a');
    fc(ctx, cx - r*0.3, cy, r*0.1, '#333');
    fc(ctx, cx + r*0.3, cy, r*0.1, '#333');
    ctx.strokeStyle = '#555'; ctx.lineWidth = r/16;
    ctx.strokeRect(cx - r*0.52, cy - r*0.13, r*0.4, r*0.26);
    ctx.strokeRect(cx + r*0.12, cy - r*0.13, r*0.4, r*0.26);
    ctx.beginPath(); ctx.moveTo(cx-r*0.12, cy); ctx.lineTo(cx+r*0.12, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + r*0.28, r*0.12, 0, Math.PI);
    ctx.strokeStyle = '#c07070'; ctx.lineWidth = r/20; ctx.stroke();
}

// ── Hamster: chubby cheeks, big shiny eyes, pink nose ──
function avHamster(ctx, cx, cy, r) {
    fe(ctx, cx, cy + r*0.08, r*1.08, r*0.88, '#E8C88A');
    fc(ctx, cx - r*0.62, cy - r*0.65, r*0.27, '#E8C88A');
    fc(ctx, cx + r*0.62, cy - r*0.65, r*0.27, '#E8C88A');
    fc(ctx, cx - r*0.62, cy - r*0.65, r*0.14, '#FFB6C1');
    fc(ctx, cx + r*0.62, cy - r*0.65, r*0.14, '#FFB6C1');
    fc(ctx, cx, cy, r*0.82, '#E8C88A');
    fe(ctx, cx - r*0.52, cy + r*0.2, r*0.33, r*0.24, '#F0D8A0');
    fe(ctx, cx + r*0.52, cy + r*0.2, r*0.33, r*0.24, '#F0D8A0');
    fc(ctx, cx - r*0.27, cy - r*0.1, r*0.17, '#1a1a50');
    fc(ctx, cx + r*0.27, cy - r*0.1, r*0.17, '#1a1a50');
    fc(ctx, cx - r*0.21, cy - r*0.16, r*0.065, 'white');
    fc(ctx, cx + r*0.21, cy - r*0.16, r*0.065, 'white');
    fe(ctx, cx, cy + r*0.1, r*0.1, r*0.07, '#FFB6C1');
    ctx.strokeStyle = '#c07070'; ctx.lineWidth = r/22;
    ctx.beginPath(); ctx.moveTo(cx, cy+r*0.17); ctx.lineTo(cx-r*0.12, cy+r*0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy+r*0.17); ctx.lineTo(cx+r*0.12, cy+r*0.3); ctx.stroke();
}

// ── Cat: triangular ears, green slit eyes, whiskers ──
function avCat(ctx, cx, cy, r) {
    const ears = [
        [cx-r*0.68, cy-r*0.56, cx-r*0.32, cy-r*0.98, cx-r*0.1, cy-r*0.52],
        [cx+r*0.68, cy-r*0.56, cx+r*0.32, cy-r*0.98, cx+r*0.1, cy-r*0.52],
    ];
    ctx.fillStyle = '#999';
    ears.forEach(p => { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.lineTo(p[4],p[5]); ctx.fill(); });
    ctx.fillStyle = '#FFB6C1';
    [[cx-r*0.56,cy-r*0.62,cx-r*0.35,cy-r*0.88,cx-r*0.2,cy-r*0.6],
     [cx+r*0.56,cy-r*0.62,cx+r*0.35,cy-r*0.88,cx+r*0.2,cy-r*0.6]
    ].forEach(p => { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.lineTo(p[4],p[5]); ctx.fill(); });
    fc(ctx, cx, cy, r, '#aaa');
    fe(ctx, cx-r*0.3, cy-r*0.1, r*0.12, r*0.18, '#2ecc71');
    fe(ctx, cx+r*0.3, cy-r*0.1, r*0.12, r*0.18, '#2ecc71');
    fe(ctx, cx-r*0.3, cy-r*0.1, r*0.04, r*0.16, '#111');
    fe(ctx, cx+r*0.3, cy-r*0.1, r*0.04, r*0.16, '#111');
    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath(); ctx.moveTo(cx,cy+r*0.1); ctx.lineTo(cx-r*0.1,cy+r*0.2); ctx.lineTo(cx+r*0.1,cy+r*0.2); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = r/28;
    [[cx-r*0.1,cy+r*0.15,cx-r*0.88,cy-r*0.02],
     [cx-r*0.1,cy+r*0.19,cx-r*0.88,cy+r*0.12],
     [cx+r*0.1,cy+r*0.15,cx+r*0.88,cy-r*0.02],
     [cx+r*0.1,cy+r*0.19,cx+r*0.88,cy+r*0.12]
    ].forEach(([x1,y1,x2,y2]) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
}

// ── Rabbit: long upright ears, pink eyes ──
function avRabbit(ctx, cx, cy, r) {
    fe(ctx, cx-r*0.35, cy-r*1.08, r*0.17, r*0.52, 'white');
    fe(ctx, cx+r*0.35, cy-r*1.08, r*0.17, r*0.52, 'white');
    fe(ctx, cx-r*0.35, cy-r*1.08, r*0.085, r*0.4, '#FFB6C1');
    fe(ctx, cx+r*0.35, cy-r*1.08, r*0.085, r*0.4, '#FFB6C1');
    fc(ctx, cx, cy, r, 'white');
    fc(ctx, cx-r*0.3, cy-r*0.1, r*0.13, '#FF69B4');
    fc(ctx, cx+r*0.3, cy-r*0.1, r*0.13, '#FF69B4');
    fc(ctx, cx-r*0.26, cy-r*0.14, r*0.05, 'white');
    fc(ctx, cx+r*0.26, cy-r*0.14, r*0.05, 'white');
    fc(ctx, cx, cy+r*0.14, r*0.08, '#FFB6C1');
    ctx.strokeStyle = '#FFB6C1'; ctx.lineWidth = r/20;
    ctx.beginPath(); ctx.moveTo(cx,cy+r*0.22); ctx.lineTo(cx-r*0.12,cy+r*0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+r*0.22); ctx.lineTo(cx+r*0.12,cy+r*0.34); ctx.stroke();
}

// ── Bear: brown fur, lighter muzzle ──
function avBear(ctx, cx, cy, r) {
    fc(ctx, cx-r*0.68, cy-r*0.68, r*0.3, '#8B4513');
    fc(ctx, cx+r*0.68, cy-r*0.68, r*0.3, '#8B4513');
    fc(ctx, cx-r*0.68, cy-r*0.68, r*0.15, '#A0522D');
    fc(ctx, cx+r*0.68, cy-r*0.68, r*0.15, '#A0522D');
    fc(ctx, cx, cy, r, '#8B4513');
    fe(ctx, cx, cy+r*0.2, r*0.44, r*0.32, '#D2B48C');
    fc(ctx, cx-r*0.3, cy-r*0.15, r*0.11, '#222');
    fc(ctx, cx+r*0.3, cy-r*0.15, r*0.11, '#222');
    fc(ctx, cx-r*0.26, cy-r*0.19, r*0.04, 'white');
    fc(ctx, cx+r*0.26, cy-r*0.19, r*0.04, 'white');
    fe(ctx, cx, cy+r*0.1, r*0.12, r*0.08, '#333');
    ctx.strokeStyle = '#333'; ctx.lineWidth = r/20;
    ctx.beginPath(); ctx.moveTo(cx,cy+r*0.18); ctx.lineTo(cx-r*0.1,cy+r*0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+r*0.18); ctx.lineTo(cx+r*0.1,cy+r*0.3); ctx.stroke();
}

// ── Panda: white face, black eye patches ──
function avPanda(ctx, cx, cy, r) {
    fc(ctx, cx-r*0.68, cy-r*0.68, r*0.3, '#111');
    fc(ctx, cx+r*0.68, cy-r*0.68, r*0.3, '#111');
    fc(ctx, cx, cy, r, 'white');
    fe(ctx, cx-r*0.32, cy-r*0.15, r*0.24, r*0.2, '#111');
    fe(ctx, cx+r*0.32, cy-r*0.15, r*0.24, r*0.2, '#111');
    fc(ctx, cx-r*0.3, cy-r*0.1, r*0.1, '#222');
    fc(ctx, cx+r*0.3, cy-r*0.1, r*0.1, '#222');
    fc(ctx, cx-r*0.26, cy-r*0.14, r*0.04, 'white');
    fc(ctx, cx+r*0.26, cy-r*0.14, r*0.04, 'white');
    fe(ctx, cx, cy+r*0.1, r*0.12, r*0.08, '#111');
    ctx.beginPath(); ctx.arc(cx, cy+r*0.24, r*0.12, 0, Math.PI);
    ctx.strokeStyle = '#555'; ctx.lineWidth = r/20; ctx.stroke();
}

// ── Fox: orange fur, amber eyes, cream muzzle ──
function avFox(ctx, cx, cy, r) {
    ctx.fillStyle = '#E8630A';
    [[cx-r*0.62,cy-r*0.52,cx-r*0.44,cy-r*0.98,cx-r*0.1,cy-r*0.52],
     [cx+r*0.62,cy-r*0.52,cx+r*0.44,cy-r*0.98,cx+r*0.1,cy-r*0.52]
    ].forEach(p => { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.lineTo(p[4],p[5]); ctx.fill(); });
    ctx.fillStyle = '#FFD700';
    [[cx-r*0.56,cy-r*0.58,cx-r*0.44,cy-r*0.86,cx-r*0.18,cy-r*0.6],
     [cx+r*0.56,cy-r*0.58,cx+r*0.44,cy-r*0.86,cx+r*0.18,cy-r*0.6]
    ].forEach(p => { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.lineTo(p[4],p[5]); ctx.fill(); });
    fc(ctx, cx, cy, r, '#E8630A');
    fe(ctx, cx, cy+r*0.2, r*0.44, r*0.34, '#FFF5DC');
    fc(ctx, cx-r*0.3, cy-r*0.12, r*0.14, '#DAA520');
    fc(ctx, cx+r*0.3, cy-r*0.12, r*0.14, '#DAA520');
    fc(ctx, cx-r*0.3, cy-r*0.12, r*0.07, '#333');
    fc(ctx, cx+r*0.3, cy-r*0.12, r*0.07, '#333');
    fc(ctx, cx-r*0.26, cy-r*0.16, r*0.04, 'white');
    fc(ctx, cx+r*0.26, cy-r*0.16, r*0.04, 'white');
    fc(ctx, cx, cy+r*0.1, r*0.1, '#333');
}

// ── Alien: elongated green head, large dark eyes, antenna ──
function avAlien(ctx, cx, cy, r) {
    fe(ctx, cx, cy, r*0.82, r, '#5DBB63');
    ctx.strokeStyle = '#3a9940'; ctx.lineWidth = r/16;
    ctx.beginPath(); ctx.moveTo(cx, cy-r); ctx.lineTo(cx-r*0.08, cy-r*1.38); ctx.stroke();
    fc(ctx, cx-r*0.08, cy-r*1.38, r*0.1, '#88FF88');
    fe(ctx, cx-r*0.3, cy-r*0.18, r*0.24, r*0.34, '#111');
    fe(ctx, cx+r*0.3, cy-r*0.18, r*0.24, r*0.34, '#111');
    fe(ctx, cx-r*0.26, cy-r*0.22, r*0.1, r*0.14, '#3399FF');
    fe(ctx, cx+r*0.26, cy-r*0.22, r*0.1, r*0.14, '#3399FF');
    ctx.beginPath();
    ctx.moveTo(cx-r*0.2, cy+r*0.28);
    ctx.quadraticCurveTo(cx, cy+r*0.42, cx+r*0.2, cy+r*0.28);
    ctx.strokeStyle = '#2a7a2a'; ctx.lineWidth = r/18; ctx.stroke();
    fc(ctx, cx-r*0.07, cy+r*0.18, r*0.05, '#3a9940');
    fc(ctx, cx+r*0.07, cy+r*0.18, r*0.05, '#3a9940');
}

// ── Robot: square head, blue LED eyes, speaker grill ──
function avRobot(ctx, cx, cy, r) {
    const s = r * 0.9, rr = r * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx-s+rr, cy-s); ctx.lineTo(cx+s-rr, cy-s);
    ctx.arcTo(cx+s, cy-s, cx+s, cy-s+rr, rr);
    ctx.lineTo(cx+s, cy+s-rr); ctx.arcTo(cx+s, cy+s, cx+s-rr, cy+s, rr);
    ctx.lineTo(cx-s+rr, cy+s); ctx.arcTo(cx-s, cy+s, cx-s, cy+s-rr, rr);
    ctx.lineTo(cx-s, cy-s+rr); ctx.arcTo(cx-s, cy-s, cx-s+rr, cy-s, rr);
    ctx.closePath();
    ctx.fillStyle = '#778899'; ctx.fill();
    ctx.strokeStyle = '#4a5568'; ctx.lineWidth = r/12; ctx.stroke();
    ctx.strokeStyle = '#556677'; ctx.lineWidth = r/16;
    ctx.beginPath(); ctx.moveTo(cx, cy-r*0.9); ctx.lineTo(cx, cy-r*1.35); ctx.stroke();
    fc(ctx, cx, cy-r*1.35, r*0.1, '#3399FF');
    fr(ctx, cx-r*0.44, cy-r*0.32, r*0.3, r*0.22, '#3399FF');
    fr(ctx, cx+r*0.14, cy-r*0.32, r*0.3, r*0.22, '#3399FF');
    ctx.globalAlpha = 0.28;
    fr(ctx, cx-r*0.49, cy-r*0.37, r*0.4, r*0.32, '#3399FF');
    fr(ctx, cx+r*0.09, cy-r*0.37, r*0.4, r*0.32, '#3399FF');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#556677'; ctx.lineWidth = r/22;
    for (let i = 0; i < 3; i++) {
        const ly = cy + r*(0.08 + i*0.2);
        ctx.beginPath(); ctx.moveTo(cx-r*0.5, ly); ctx.lineTo(cx+r*0.5, ly); ctx.stroke();
    }
}

// ================================================================
// Screen builders
// ================================================================

function buildUserSelect() {
    const sc = screens['user-select'];
    sc.innerHTML = '<h2 class="screen-title">你是谁？</h2>';
    const grid = document.createElement('div');
    grid.className = 'user-grid';
    USERS.forEach(name => {
        const card = document.createElement('div');
        card.className = 'user-card';
        const c = document.createElement('canvas');
        c.width = 80; c.height = 80;
        drawAvatar(c.getContext('2d'), userAvatars[name] || name, 40, 40, 32);
        const nm = document.createElement('div');
        nm.className = 'user-name';
        nm.textContent = name;
        const chg = document.createElement('button');
        chg.className = 'change-icon-btn';
        chg.textContent = '换头像';
        chg.addEventListener('click', e => { e.stopPropagation(); iconSelectFor = name; setState('icon-select'); });
        card.append(c, nm, chg);
        card.addEventListener('click', () => { currentUser = name; setState('main-menu'); });
        grid.appendChild(card);
    });
    sc.appendChild(grid);
    showScreen('user-select');
}

function buildIconSelect() {
    const sc = screens['icon-select'];
    const curAv = userAvatars[iconSelectFor] || iconSelectFor;
    sc.innerHTML = `<h2 class="screen-title">为 ${iconSelectFor} 换头像</h2>`;
    const grid = document.createElement('div');
    grid.className = 'icon-grid';
    ALL_AVATARS.forEach(([key, label]) => {
        const cell = document.createElement('div');
        cell.className = 'icon-cell' + (key === curAv ? ' selected' : '');
        const c = document.createElement('canvas');
        c.width = 70; c.height = 70;
        drawAvatar(c.getContext('2d'), key, 35, 35, 28);
        const sp = document.createElement('span');
        sp.textContent = label;
        cell.append(c, sp);
        cell.addEventListener('click', () => {
            userAvatars[iconSelectFor] = key;
            try { localStorage.setItem(LS_AVATARS, JSON.stringify(userAvatars)); } catch {}
            setState('user-select');
        });
        grid.appendChild(cell);
    });
    sc.appendChild(grid);
    const back = document.createElement('div');
    back.className = 'back-link';
    back.textContent = '← 取消';
    back.addEventListener('click', () => setState('user-select'));
    sc.appendChild(back);
    showScreen('icon-select');
}

function buildMainMenu() {
    const sc = screens['main-menu'];
    sc.innerHTML = '<h2 class="screen-title">游戏大厅</h2>';
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    GAMES.forEach(g => {
        const card = document.createElement('div');
        card.className = 'game-card';
        const title = document.createElement('div');
        title.className = 'game-title';
        title.textContent = g.title;
        const desc = document.createElement('div');
        desc.className = 'game-desc';
        desc.textContent = g.desc;
        const btn = document.createElement('button');
        btn.className = 'play-btn';
        btn.textContent = g.disabled ? '即将推出' : '开始游戏';
        btn.disabled = g.disabled;
        if (!g.disabled) {
            btn.addEventListener('click', () => { pendingGame = g.key; setState('time-select'); });
        }
        card.append(title, desc, btn);
        grid.appendChild(card);
    });
    sc.appendChild(grid);
    showScreen('main-menu');
}

function buildTimeSelect() {
    const sc = screens['time-select'];
    sc.innerHTML = '<h2 class="screen-title">选择游戏时长</h2>';
    const grid = document.createElement('div');
    grid.className = 'time-grid';
    [[60,'1 分钟'],[180,'3 分钟'],[300,'5 分钟']].forEach(([secs, label]) => {
        const btn = document.createElement('button');
        btn.className = 'time-btn';
        btn.textContent = label;
        btn.addEventListener('click', () => {
            startSession(secs);
            if (pendingGame === 'carrace') setState('cr-start');
        });
        grid.appendChild(btn);
    });
    sc.appendChild(grid);
    const back = document.createElement('div');
    back.className = 'back-link';
    back.textContent = '← 返回';
    back.addEventListener('click', () => setState('main-menu'));
    sc.appendChild(back);
    showScreen('time-select');
}

function buildCrStart() {
    const sc = screens['cr-start'];
    sc.innerHTML = '';
    let laneCount = 3;

    const h2 = document.createElement('h2');
    h2.textContent = '🏎 赛车竞速';
    h2.style.color = 'var(--accent)';
    h2.style.fontSize = '1.8rem';

    const hint = document.createElement('p');
    hint.textContent = '按 ← → 方向键换道，躲开敌车';
    hint.style.color = 'var(--text-dim)';

    const laneWrap = document.createElement('div');
    laneWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px';
    const laneLabel = document.createElement('p');
    laneLabel.textContent = '选择车道数：';
    laneLabel.style.color = 'var(--text-dim)';
    const optRow = document.createElement('div');
    optRow.className = 'option-row';
    [[3,'3 车道'],[5,'5 车道']].forEach(([n, label]) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn' + (n === 3 ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
            laneCount = n;
            optRow.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        optRow.appendChild(btn);
    });
    laneWrap.append(laneLabel, optRow);

    const goBtn = document.createElement('button');
    goBtn.className = 'big-play-btn';
    goBtn.textContent = '开始！';
    goBtn.addEventListener('click', () => { window._crLanes = laneCount; setState('cr-playing'); });

    sc.append(h2, hint, laneWrap, goBtn);
    showScreen('cr-start');
}

function buildCrGameover() {
    const sc = screens['cr-gameover'];
    sc.innerHTML = '';
    const score = currentScore;
    const canPlay = sessionTimeLeft > 0;

    const wrap = document.createElement('div');
    wrap.className = 'gameover-wrap';

    const left = document.createElement('div');
    left.className = 'gameover-left';

    const h2 = document.createElement('h2');
    h2.textContent = '游戏结束';
    const scoreEl = document.createElement('div');
    scoreEl.className = 'score-display';
    scoreEl.textContent = score;
    const scoreLbl = document.createElement('div');
    scoreLbl.className = 'score-label';
    scoreLbl.textContent = '本次得分';

    const btns = document.createElement('div');
    btns.className = 'gameover-btns';
    const againBtn = document.createElement('button');
    againBtn.className = 'big-play-btn';
    againBtn.textContent = '再来一局';
    againBtn.disabled = !canPlay;
    if (!canPlay) againBtn.style.cssText = 'background:var(--border);color:var(--text-dim);cursor:not-allowed';
    else againBtn.addEventListener('click', () => setState('cr-start'));
    const menuBtn = document.createElement('button');
    menuBtn.className = 'option-btn';
    menuBtn.textContent = '返回菜单';
    menuBtn.addEventListener('click', () => setState('main-menu'));
    btns.append(againBtn, menuBtn);

    left.append(h2, scoreEl, scoreLbl, btns);
    if (!canPlay) {
        const warn = document.createElement('p');
        warn.style.cssText = 'color:var(--danger);font-size:0.78rem;text-align:center';
        warn.textContent = '⏱ 游戏时间已结束，返回菜单可重新计时';
        left.appendChild(warn);
    }

    wrap.append(left, buildLeaderboard('carrace', score, currentUser || '?'));
    sc.appendChild(wrap);
    showScreen('cr-gameover');
}

// ── Game callbacks ──
window.onCarRaceOver = function(score) {
    currentScore = score;
    pauseTimer();
    addScore('carrace', score, currentUser || '?');
    setState('cr-gameover');
};

window.onCarRaceScore = function(score) {
    currentScore = score;
    tbScoreDisplay.textContent = '得分: ' + score;
};

// ── Expose timer functions to game modules ──
window.activateTimer = activateTimer;
window.pauseTimer    = pauseTimer;

// ── Init ──
updateTitleBar();
setState('user-select');
