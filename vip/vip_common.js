'use strict';

const VIP_API_BASE = 'https://laofujia-api.laofujia-worker.workers.dev';
const VIP_CURRENCY_KEY = 'vip_currency_';
const VIP_TRANSACTIONS_KEY = 'vip_tx_';
const VIP_TIME_KEY = 'vip_time_';
const VIP_LOGIN_KEY = 'vip_login_';
const VIP_INITIAL_COPPER = 88;

function _apiPost(path, data) {
    return fetch(VIP_API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).then(r => r.json()).catch(() => null);
}

function _apiGet(path) {
    return fetch(VIP_API_BASE + path).then(r => r.json()).catch(() => null);
}

const VipCurrency = {
    getBalance(userId) {
        try {
            const raw = localStorage.getItem(VIP_CURRENCY_KEY + userId);
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        const initial = { copper: VIP_INITIAL_COPPER };
        this.setBalance(userId, initial);
        this._addTx(userId, VIP_INITIAL_COPPER, '初始赠送');
        return initial;
    },

    setBalance(userId, bal) {
        try { localStorage.setItem(VIP_CURRENCY_KEY + userId, JSON.stringify(bal)); } catch(e) {}
    },

    addCopper(userId, amount, reason) {
        const bal = this.getBalance(userId);
        bal.copper = (bal.copper || 0) + amount;
        this.setBalance(userId, bal);
        this._addTx(userId, amount, reason);
        _apiPost('/api/balance/' + userId, { amount, reason });
        return bal;
    },

    spendCopper(userId, amount, reason) {
        const bal = this.getBalance(userId);
        if ((bal.copper || 0) < amount) return null;
        bal.copper -= amount;
        this.setBalance(userId, bal);
        this._addTx(userId, -amount, reason);
        _apiPost('/api/balance/' + userId, { amount: -amount, reason });
        return bal;
    },

    syncFromCloud(userId) {
        return _apiGet('/api/balance/' + userId).then(remote => {
            if (remote && typeof remote.copper === 'number') {
                this.setBalance(userId, remote);
                return remote;
            }
            return null;
        });
    },

    syncTransactionsFromCloud(userId) {
        return _apiGet('/api/transactions/' + userId).then(txs => {
            if (Array.isArray(txs) && txs.length > 0) {
                try { localStorage.setItem(VIP_TRANSACTIONS_KEY + userId, JSON.stringify(txs)); } catch(e) {}
                return txs;
            }
            return null;
        });
    },

    formatBalance(bal) {
        const total = bal.copper || 0;
        const gold = Math.floor(total / 10000);
        const silver = Math.floor((total % 10000) / 1000);
        const copper = total % 1000;
        return { gold, silver, copper, total };
    },

    formatCopperDetail(copperAmount) {
        const yuanbao = Math.floor(copperAmount / 100);
        const zhongbao = Math.floor((copperAmount % 100) / 10);
        const tongbao = copperAmount % 10;
        return { yuanbao, zhongbao, tongbao };
    },

    _addTx(userId, amount, reason) {
        try {
            const key = VIP_TRANSACTIONS_KEY + userId;
            const txs = JSON.parse(localStorage.getItem(key) || '[]');
            txs.unshift({ amount, reason, time: Date.now() });
            if (txs.length > 200) txs.length = 200;
            localStorage.setItem(key, JSON.stringify(txs));
        } catch(e) {}
    },

    getTransactions(userId) {
        try {
            return JSON.parse(localStorage.getItem(VIP_TRANSACTIONS_KEY + userId) || '[]');
        } catch(e) { return []; }
    }
};

const VipTime = {
    startTracking(userId, activity) {
        this._current = { userId, activity, start: Date.now() };
    },

    stopTracking() {
        if (!this._current) return;
        const { userId, activity, start } = this._current;
        const seconds = Math.floor((Date.now() - start) / 1000);
        if (seconds < 1) { this._current = null; return; }
        try {
            const key = VIP_TIME_KEY + userId;
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (!data[activity]) data[activity] = [];
            data[activity].push({ start, seconds, date: new Date().toISOString().slice(0,10) });
            if (data[activity].length > 500) data[activity] = data[activity].slice(-500);
            localStorage.setItem(key, JSON.stringify(data));
        } catch(e) {}
        _apiPost('/api/time/' + userId, { activity, seconds });
        this._current = null;
    },

    getStats(userId) {
        try {
            const data = JSON.parse(localStorage.getItem(VIP_TIME_KEY + userId) || '{}');
            const now = Date.now();
            const dayMs = 86400000;
            const today = new Date().toISOString().slice(0,10);
            const weekAgo = new Date(now - 7 * dayMs).toISOString().slice(0,10);
            const monthAgo = new Date(now - 30 * dayMs).toISOString().slice(0,10);

            const stats = {};
            for (const activity of ['quiz', 'game']) {
                const entries = data[activity] || [];
                let day = 0, week = 0, month = 0, total = 0;
                for (const e of entries) {
                    total += e.seconds;
                    if (e.date >= monthAgo) month += e.seconds;
                    if (e.date >= weekAgo) week += e.seconds;
                    if (e.date === today) day += e.seconds;
                }
                stats[activity] = { day, week, month, total };
            }
            return stats;
        } catch(e) { return { quiz: {day:0,week:0,month:0,total:0}, game: {day:0,week:0,month:0,total:0} }; }
    }
};

const VipLogin = {
    record(userId) {
        const info = {
            time: Date.now(),
            device: this._detectDevice(),
            date: new Date().toISOString()
        };
        try { localStorage.setItem(VIP_LOGIN_KEY + userId, JSON.stringify(info)); } catch(e) {}
        _apiPost('/api/login/' + userId, { device: info.device });
    },

    getLast(userId) {
        try {
            return JSON.parse(localStorage.getItem(VIP_LOGIN_KEY + userId) || 'null');
        } catch(e) { return null; }
    },

    _detectDevice() {
        const ua = navigator.userAgent;
        if (/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/i.test(ua))) return 'iPad';
        if (/iPhone/i.test(ua)) return 'iPhone';
        if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'Android手机';
        if (/Android/i.test(ua)) return 'Android平板';
        if (/Windows/i.test(ua)) return 'Windows电脑';
        if (/Mac/i.test(ua)) return 'Mac电脑';
        if (/Linux/i.test(ua)) return 'Linux';
        return '未知设备';
    }
};

function vipCloudSync(userId) {
    VipCurrency.syncFromCloud(userId).then(bal => {
        if (bal) {
            const bars = document.querySelectorAll('.currency-bar');
            bars.forEach(bar => renderCurrencyBar(bar, userId));
        }
    });
    VipCurrency.syncTransactionsFromCloud(userId);
}

function formatSeconds(s) {
    if (s < 60) return s + '秒';
    if (s < 3600) return Math.floor(s/60) + '分' + (s%60 ? s%60+'秒' : '');
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    return h + '小时' + (m ? m+'分' : '');
}

const _coinSvg = {
    tongbao: '<svg viewBox="0 0 28 28" width="20" height="20" style="vertical-align:middle"><circle cx="14" cy="14" r="13" fill="#b8860b" stroke="#8b6914" stroke-width="1.5"/><circle cx="14" cy="14" r="10.5" fill="none" stroke="#d4a017" stroke-width="0.8"/><rect x="11" y="11" width="6" height="6" fill="#8b6914" stroke="#6b4f0a" stroke-width="0.5"/><text x="14" y="8.5" text-anchor="middle" font-size="4.5" fill="#fff" font-weight="bold">通宝</text><text x="14" y="23" text-anchor="middle" font-size="4.5" fill="#fff" font-weight="bold">咸丰</text></svg>',
    zhongbao: '<svg viewBox="0 0 28 28" width="22" height="22" style="vertical-align:middle"><circle cx="14" cy="14" r="13" fill="#cd7f32" stroke="#a0522d" stroke-width="1.5"/><circle cx="14" cy="14" r="10.5" fill="none" stroke="#daa520" stroke-width="0.8"/><rect x="11" y="11" width="6" height="6" fill="#a0522d" stroke="#8b4513" stroke-width="0.5"/><text x="14" y="8.5" text-anchor="middle" font-size="4.5" fill="#fff" font-weight="bold">重宝</text><text x="14" y="23" text-anchor="middle" font-size="4.5" fill="#fff" font-weight="bold">咸丰</text></svg>',
    yuanbao: '<svg viewBox="0 0 28 28" width="24" height="24" style="vertical-align:middle"><circle cx="14" cy="14" r="13" fill="#8b4513" stroke="#654321" stroke-width="1.5"/><circle cx="14" cy="14" r="10.5" fill="none" stroke="#b8860b" stroke-width="0.8"/><rect x="11" y="11" width="6" height="6" fill="#654321" stroke="#4a3728" stroke-width="0.5"/><text x="14" y="8.5" text-anchor="middle" font-size="4.5" fill="#ffd700" font-weight="bold">元宝</text><text x="14" y="23" text-anchor="middle" font-size="4.5" fill="#ffd700" font-weight="bold">咸丰</text></svg>',
    silver: '<svg viewBox="0 0 32 20" width="28" height="18" style="vertical-align:middle"><ellipse cx="16" cy="14" rx="14" ry="6" fill="#c0c0c0" stroke="#a9a9a9" stroke-width="1"/><path d="M6 14 Q8 4 16 2 Q24 4 26 14" fill="#d3d3d3" stroke="#a9a9a9" stroke-width="0.8"/><path d="M10 14 Q12 7 16 5 Q20 7 22 14" fill="#e8e8e8" stroke="none"/><text x="16" y="16" text-anchor="middle" font-size="5" fill="#666" font-weight="bold">银</text></svg>',
    gold: '<svg viewBox="0 0 32 20" width="28" height="18" style="vertical-align:middle"><ellipse cx="16" cy="14" rx="14" ry="6" fill="#ffd700" stroke="#daa520" stroke-width="1"/><path d="M6 14 Q8 4 16 2 Q24 4 26 14" fill="#ffec8b" stroke="#daa520" stroke-width="0.8"/><path d="M10 14 Q12 7 16 5 Q20 7 22 14" fill="#fff8dc" stroke="none"/><text x="16" y="16" text-anchor="middle" font-size="5" fill="#8b6914" font-weight="bold">金</text></svg>',
};

function renderCurrencyBar(container, userId) {
    const bal = VipCurrency.getBalance(userId);
    const fmt = VipCurrency.formatBalance(bal);
    container.innerHTML = '';
    container.className = 'currency-bar';

    const items = [];
    if (fmt.gold > 0) items.push({ icon: _coinSvg.gold, label: fmt.gold + '两金', cls: 'gold' });
    if (fmt.silver > 0) items.push({ icon: _coinSvg.silver, label: fmt.silver + '两银', cls: 'silver' });
    items.push({ icon: _coinSvg.tongbao, label: fmt.copper + '文铜钱', cls: 'copper' });

    for (const item of items) {
        const span = document.createElement('span');
        span.className = 'currency-item ' + item.cls;
        span.innerHTML = item.icon + ' ' + item.label;
        span.onclick = () => showCurrencyDetail(userId);
        container.appendChild(span);
    }
}

function showCurrencyDetail(userId) {
    const existing = document.getElementById('currency-detail-modal');
    if (existing) existing.remove();

    const bal = VipCurrency.getBalance(userId);
    const fmt = VipCurrency.formatBalance(bal);
    const copperDetail = VipCurrency.formatCopperDetail(fmt.copper);

    const modal = document.createElement('div');
    modal.id = 'currency-detail-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    let html = '<div style="background:white;padding:30px;border-radius:16px;max-width:350px;width:90%;text-align:center">';
    html += '<h3 style="margin:0 0 20px">💰 财产详情</h3>';
    html += '<div style="text-align:left;line-height:2">';

    if (fmt.gold > 0) html += '<div>' + _coinSvg.gold + ' 金元宝 × ' + fmt.gold + '（' + fmt.gold + '两黄金）</div>';
    if (fmt.silver > 0) html += '<div>' + _coinSvg.silver + ' 银元宝 × ' + fmt.silver + '（' + fmt.silver + '两白银）</div>';
    html += '<div style="margin-top:8px;font-weight:bold">铜钱明细：</div>';
    if (copperDetail.yuanbao > 0) html += '<div>&nbsp;&nbsp;' + _coinSvg.yuanbao + ' 咸丰元宝 × ' + copperDetail.yuanbao + '（' + copperDetail.yuanbao * 100 + '文）</div>';
    if (copperDetail.zhongbao > 0) html += '<div>&nbsp;&nbsp;' + _coinSvg.zhongbao + ' 咸丰重宝 × ' + copperDetail.zhongbao + '（' + copperDetail.zhongbao * 10 + '文）</div>';
    if (copperDetail.tongbao > 0) html += '<div>&nbsp;&nbsp;' + _coinSvg.tongbao + ' 咸丰通宝 × ' + copperDetail.tongbao + '（' + copperDetail.tongbao + '文）</div>';
    if (fmt.copper === 0) html += '<div>&nbsp;&nbsp;无铜钱</div>';

    html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;font-weight:bold">总计：' + fmt.total + '文铜钱</div>';
    html += '</div>';
    html += '<button onclick="this.parentElement.parentElement.remove()" style="margin-top:20px;padding:8px 24px;background:#f1c40f;border:none;border-radius:8px;font-size:1rem;cursor:pointer">关闭</button>';
    html += '</div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

function showTransactions(userId) {
    const existing = document.getElementById('tx-modal');
    if (existing) existing.remove();

    const txs = VipCurrency.getTransactions(userId);

    const modal = document.createElement('div');
    modal.id = 'tx-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    let html = '<div style="background:white;padding:30px;border-radius:16px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto">';
    html += '<h3 style="margin:0 0 15px;text-align:center">📜 交易记录</h3>';

    if (txs.length === 0) {
        html += '<p style="text-align:center;color:#95a5a6">暂无交易记录</p>';
    } else {
        html += '<div style="font-size:0.85rem">';
        for (const tx of txs.slice(0, 50)) {
            const d = new Date(tx.time);
            const dateStr = d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
            const sign = tx.amount > 0 ? '+' : '';
            const color = tx.amount > 0 ? '#27ae60' : '#e74c3c';
            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0">';
            html += '<div><div>' + tx.reason + '</div><div style="color:#95a5a6;font-size:0.75rem">' + dateStr + '</div></div>';
            html += '<div style="color:' + color + ';font-weight:bold;white-space:nowrap">' + sign + tx.amount + '文</div>';
            html += '</div>';
        }
        html += '</div>';
    }

    html += '<div style="text-align:center;margin-top:15px"><button onclick="this.parentElement.parentElement.parentElement.remove()" style="padding:8px 24px;background:#f1c40f;border:none;border-radius:8px;font-size:1rem;cursor:pointer">关闭</button></div>';
    html += '</div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
}
