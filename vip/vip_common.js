'use strict';

const VIP_CURRENCY_KEY = 'vip_currency_';
const VIP_TRANSACTIONS_KEY = 'vip_tx_';
const VIP_TIME_KEY = 'vip_time_';
const VIP_LOGIN_KEY = 'vip_login_';
const VIP_INITIAL_COPPER = 88;

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
        return bal;
    },

    spendCopper(userId, amount, reason) {
        const bal = this.getBalance(userId);
        if ((bal.copper || 0) < amount) return null;
        bal.copper -= amount;
        this.setBalance(userId, bal);
        this._addTx(userId, -amount, reason);
        return bal;
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
        try {
            const info = {
                time: Date.now(),
                device: this._detectDevice(),
                date: new Date().toISOString()
            };
            localStorage.setItem(VIP_LOGIN_KEY + userId, JSON.stringify(info));
        } catch(e) {}
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

function formatSeconds(s) {
    if (s < 60) return s + '秒';
    if (s < 3600) return Math.floor(s/60) + '分' + (s%60 ? s%60+'秒' : '');
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    return h + '小时' + (m ? m+'分' : '');
}

function renderCurrencyBar(container, userId) {
    const bal = VipCurrency.getBalance(userId);
    const fmt = VipCurrency.formatBalance(bal);
    container.innerHTML = '';
    container.className = 'currency-bar';

    const items = [];
    if (fmt.gold > 0) items.push({ icon: '🟡', label: fmt.gold + '两金', cls: 'gold' });
    if (fmt.silver > 0) items.push({ icon: '⚪', label: fmt.silver + '两银', cls: 'silver' });
    items.push({ icon: '🟤', label: fmt.copper + '文铜钱', cls: 'copper' });

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

    if (fmt.gold > 0) html += '<div>🟡 金元宝 × ' + fmt.gold + '（' + fmt.gold + '两黄金）</div>';
    if (fmt.silver > 0) html += '<div>⚪ 银元宝 × ' + fmt.silver + '（' + fmt.silver + '两白银）</div>';
    html += '<div style="margin-top:8px;font-weight:bold">🟤 铜钱明细：</div>';
    if (copperDetail.yuanbao > 0) html += '<div>&nbsp;&nbsp;咸丰元宝 × ' + copperDetail.yuanbao + '（' + copperDetail.yuanbao * 100 + '文）</div>';
    if (copperDetail.zhongbao > 0) html += '<div>&nbsp;&nbsp;咸丰重宝 × ' + copperDetail.zhongbao + '（' + copperDetail.zhongbao * 10 + '文）</div>';
    if (copperDetail.tongbao > 0) html += '<div>&nbsp;&nbsp;咸丰通宝 × ' + copperDetail.tongbao + '（' + copperDetail.tongbao + '文）</div>';
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
