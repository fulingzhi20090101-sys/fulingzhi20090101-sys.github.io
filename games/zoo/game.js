const TILE_SIZE = 40;
let canvas, ctx;
let gameState = null;

function initGame(charId) {
    const charData = CHARACTERS.find(c => c.id === charId);
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    gameState = {
        player: {
            charId: charId,
            name: charData.name,
            emoji: charData.emoji,
            color: charData.color,
            level: 1,
            exp: 0,
            expNext: 50,
            gold: 20,
            stats: { ...charData.baseStats },
            maxHp: charData.baseStats.hp,
            maxMp: charData.baseStats.mp,
            skills: charData.skills,
            buffs: [],
            x: 0,
            y: 0,
        },
        currentMap: null,
        mapState: {},
        mode: 'explore',
        battle: null,
        dialog: null,
        message: null,
        messageTimer: 0,
        otherPlayers: {},
        moveQueue: [],
        lastMove: 0,
    };

    loadMap('ticket_office');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupInput();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function loadMap(mapId, toX, toY) {
    const map = MAPS[mapId];
    gameState.currentMap = mapId;
    if (!gameState.mapState[mapId]) {
        gameState.mapState[mapId] = {
            bosses: map.bosses ? map.bosses.map(b => ({ ...b })) : [],
        };
    }
    if (toX !== undefined) {
        gameState.player.x = toX;
        gameState.player.y = toY;
    } else {
        gameState.player.x = map.playerStart.x;
        gameState.player.y = map.playerStart.y;
    }
    showMessage(map.enterMsg);
}

function getMap() { return MAPS[gameState.currentMap]; }

function isWalkable(x, y) {
    const map = getMap();
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (tile === TILE.WALL || tile === TILE.TREE || tile === TILE.FENCE || tile === TILE.WATER || tile === TILE.EMPTY) return false;
    const ms = gameState.mapState[gameState.currentMap];
    if (ms.bosses) {
        for (const b of ms.bosses) {
            if (!b.defeated && b.x === x && b.y === y) return true;
        }
    }
    if (map.npcs) {
        for (const n of map.npcs) {
            if (n.x === x && n.y === y) return false;
        }
    }
    return true;
}

function movePlayer(dx, dy) {
    if (gameState.mode !== 'explore') return;
    const now = Date.now();
    if (now - gameState.lastMove < 150) return;
    gameState.lastMove = now;

    const nx = gameState.player.x + dx;
    const ny = gameState.player.y + dy;

    const map = getMap();
    if (map.npcs) {
        for (const n of map.npcs) {
            if (n.x === nx && n.y === ny) {
                talkToNpc(n.id);
                return;
            }
        }
    }

    const ms = gameState.mapState[gameState.currentMap];
    if (ms.bosses) {
        for (const b of ms.bosses) {
            if (!b.defeated && b.x === nx && b.y === ny) {
                startBattle(b.monsterId, b);
                return;
            }
        }
    }

    if (map.exits) {
        for (const ex of map.exits) {
            if (ex.x === nx && ex.y === ny) {
                loadMap(ex.toMap, ex.toX, ex.toY);
                return;
            }
        }
    }

    if (!isWalkable(nx, ny)) return;
    gameState.player.x = nx;
    gameState.player.y = ny;

    checkRandomEncounter();
}

function checkRandomEncounter() {
    const map = getMap();
    if (!map.encounters) return;
    const px = gameState.player.x, py = gameState.player.y;
    for (const enc of map.encounters) {
        for (const z of enc.zones) {
            if (px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) {
                if (Math.random() < enc.rate) {
                    startBattle(enc.monsterId, null);
                    return;
                }
            }
        }
    }
}

function talkToNpc(npcId) {
    const npc = NPCS[npcId];
    const idx = Math.floor(Math.random() * npc.dialogs.length);
    gameState.dialog = {
        speaker: npc.emoji + ' ' + npc.name,
        text: npc.dialogs[idx],
        onClose: null,
    };
    gameState.mode = 'dialog';
}

function showMessage(text, duration) {
    gameState.message = text;
    gameState.messageTimer = Date.now() + (duration || 3000);
}

// --- BATTLE ---

function startBattle(monsterId, bossRef) {
    const template = MONSTERS[monsterId];
    const monster = {
        ...template,
        currentHp: template.hp,
        bossRef: bossRef,
    };
    gameState.battle = {
        monster: monster,
        playerHp: gameState.player.stats.hp,
        playerMp: gameState.player.stats.mp,
        turn: 'player',
        log: [monster.dialog],
        phase: 'menu',
        animating: false,
        result: null,
    };
    gameState.mode = 'battle';
}

function battleAction(action, skillIdx) {
    const b = gameState.battle;
    if (b.turn !== 'player' || b.animating || b.result) return;

    if (action === 'attack') {
        const dmg = Math.max(1, gameState.player.stats.atk - b.monster.def + Math.floor(Math.random() * 5));
        b.monster.currentHp = Math.max(0, b.monster.currentHp - dmg);
        b.log.push('你攻击了' + b.monster.name + '，造成 ' + dmg + ' 点伤害！');
    } else if (action === 'skill') {
        const skill = gameState.player.skills[skillIdx];
        if (b.playerMp < skill.cost) {
            b.log.push('法力不足！');
            return;
        }
        b.playerMp -= skill.cost;
        if (skill.dmg < 0) {
            const heal = Math.abs(skill.dmg);
            b.playerHp = Math.min(gameState.player.maxHp, b.playerHp + heal);
            b.log.push('你使用了' + skill.name + '，恢复 ' + heal + ' 点生命！');
        } else if (skill.buff) {
            gameState.player.buffs.push({ ...skill.buff, remaining: skill.buff.turns });
            b.log.push('你使用了' + skill.name + '！' + skill.desc);
        } else {
            const dmg = Math.max(1, skill.dmg + gameState.player.stats.atk / 2 - b.monster.def / 2 + Math.floor(Math.random() * 8));
            b.monster.currentHp = Math.max(0, b.monster.currentHp - Math.floor(dmg));
            b.log.push('你使用了' + skill.name + '，造成 ' + Math.floor(dmg) + ' 点伤害！');
        }
    } else if (action === 'flee') {
        if (b.monster.isBoss) {
            b.log.push('Boss战无法逃跑！');
            return;
        }
        if (Math.random() < 0.6) {
            b.log.push('你成功逃跑了！');
            b.result = 'fled';
            setTimeout(() => endBattle(), 1000);
            return;
        } else {
            b.log.push('逃跑失败！');
        }
    }

    if (b.monster.currentHp <= 0) {
        b.log.push('你击败了' + b.monster.name + '！');
        b.result = 'won';
        const drops = b.monster.drops;
        gameState.player.exp += drops.exp;
        gameState.player.gold += drops.gold;
        b.log.push('获得 ' + drops.exp + ' 经验，' + drops.gold + ' 金币！');
        if (gameState.player.exp >= gameState.player.expNext) {
            levelUp();
            b.log.push('🎉 升级了！现在等级 ' + gameState.player.level);
        }
        if (b.monster.bossRef) {
            b.monster.bossRef.defeated = true;
        }
        setTimeout(() => endBattle(), 1500);
        return;
    }

    b.turn = 'monster';
    setTimeout(() => monsterTurn(), 600);
}

function monsterTurn() {
    const b = gameState.battle;
    let atkPower = b.monster.atk;
    let defPower = gameState.player.stats.def;
    for (const buff of gameState.player.buffs) {
        if (buff.def) defPower += buff.def;
    }
    const dmg = Math.max(1, atkPower - defPower / 2 + Math.floor(Math.random() * 4));
    b.playerHp = Math.max(0, b.playerHp - dmg);
    b.log.push(b.monster.name + '攻击了你，造成 ' + dmg + ' 点伤害！');

    for (const buff of gameState.player.buffs) {
        buff.remaining--;
    }
    gameState.player.buffs = gameState.player.buffs.filter(b => b.remaining > 0);

    if (b.playerHp <= 0) {
        b.log.push('你被击败了...');
        b.result = 'lost';
        setTimeout(() => endBattle(), 1500);
        return;
    }
    b.turn = 'player';
    b.phase = 'menu';
}

function endBattle() {
    const b = gameState.battle;
    if (b.result === 'lost') {
        gameState.player.stats.hp = Math.floor(gameState.player.maxHp * 0.3);
        gameState.player.stats.mp = Math.floor(gameState.player.maxMp * 0.3);
        loadMap('ticket_office');
        showMessage('你被传送回了售票处...', 3000);
    } else {
        gameState.player.stats.hp = b.playerHp;
        gameState.player.stats.mp = b.playerMp;
    }
    gameState.battle = null;
    gameState.player.buffs = [];
    gameState.mode = 'explore';
}

function levelUp() {
    gameState.player.level++;
    gameState.player.exp -= gameState.player.expNext;
    gameState.player.expNext = Math.floor(gameState.player.expNext * 1.5);
    gameState.player.maxHp += 15;
    gameState.player.maxMp += 8;
    gameState.player.stats.hp = gameState.player.maxHp;
    gameState.player.stats.mp = gameState.player.maxMp;
    gameState.player.stats.atk += 3;
    gameState.player.stats.def += 2;
}

// --- INPUT ---

let keysDown = {};

function setupInput() {
    document.addEventListener('keydown', e => {
        keysDown[e.key] = true;
        if (gameState.mode === 'dialog') {
            if (e.key === 'Enter' || e.key === ' ') {
                gameState.mode = 'explore';
                gameState.dialog = null;
            }
            return;
        }
        if (gameState.mode === 'battle') return;
        if (e.key === 'ArrowUp' || e.key === 'w') movePlayer(0, -1);
        if (e.key === 'ArrowDown' || e.key === 's') movePlayer(0, 1);
        if (e.key === 'ArrowLeft' || e.key === 'a') movePlayer(-1, 0);
        if (e.key === 'ArrowRight' || e.key === 'd') movePlayer(1, 0);
    });
    document.addEventListener('keyup', e => { keysDown[e.key] = false; });

    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;

        if (gameState.mode === 'dialog') {
            gameState.mode = 'explore';
            gameState.dialog = null;
            return;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        if (gameState.mode !== 'explore') return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) {
            movePlayer(dx > 0 ? 1 : -1, 0);
        } else {
            movePlayer(0, dy > 0 ? 1 : -1);
        }
    }, { passive: false });
}

// --- RENDER ---

let lastFrame = 0;
function gameLoop(ts) {
    const dt = ts - lastFrame;
    lastFrame = ts;
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState.mode === 'battle') {
        renderBattle();
    } else {
        renderMap();
        renderHUD();
        if (gameState.dialog) renderDialog();
    }
    if (gameState.message && Date.now() < gameState.messageTimer) {
        renderMessage();
    } else {
        gameState.message = null;
    }
}

function renderMap() {
    const map = getMap();
    const offsetX = Math.floor(canvas.width / 2 - gameState.player.x * TILE_SIZE - TILE_SIZE / 2);
    const offsetY = Math.floor(canvas.height / 2 - gameState.player.y * TILE_SIZE - TILE_SIZE / 2);

    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = map.tiles[y * map.width + x];
            const tr = TILE_RENDER[tile];
            const sx = offsetX + x * TILE_SIZE;
            const sy = offsetY + y * TILE_SIZE;
            if (sx > canvas.width || sy > canvas.height || sx + TILE_SIZE < 0 || sy + TILE_SIZE < 0) continue;
            ctx.fillStyle = tr.bg;
            ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            if (tr.char) {
                ctx.font = (TILE_SIZE * 0.6) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tr.char, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
            }
        }
    }

    if (map.exits) {
        for (const ex of map.exits) {
            const sx = offsetX + ex.x * TILE_SIZE;
            const sy = offsetY + ex.y * TILE_SIZE;
            ctx.font = (TILE_SIZE * 0.5) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ff9800';
            ctx.fillText('🚪', sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
        }
    }

    if (map.npcs) {
        for (const n of map.npcs) {
            const npc = NPCS[n.id];
            const sx = offsetX + n.x * TILE_SIZE;
            const sy = offsetY + n.y * TILE_SIZE;
            ctx.font = (TILE_SIZE * 0.7) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(npc.emoji, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
        }
    }

    const ms = gameState.mapState[gameState.currentMap];
    if (ms.bosses) {
        for (const b of ms.bosses) {
            if (b.defeated) continue;
            const mon = MONSTERS[b.monsterId];
            const sx = offsetX + b.x * TILE_SIZE;
            const sy = offsetY + b.y * TILE_SIZE;
            ctx.font = (TILE_SIZE * 0.8) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mon.emoji, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#e74c3c';
            ctx.fillText('BOSS', sx + TILE_SIZE / 2, sy + 6);
        }
    }

    for (const id in gameState.otherPlayers) {
        const op = gameState.otherPlayers[id];
        if (op.map !== gameState.currentMap) continue;
        const sx = offsetX + op.x * TILE_SIZE;
        const sy = offsetY + op.y * TILE_SIZE;
        ctx.font = (TILE_SIZE * 0.7) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(op.emoji, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(op.name, sx + TILE_SIZE / 2, sy - 4);
    }

    const px = offsetX + gameState.player.x * TILE_SIZE;
    const py = offsetY + gameState.player.y * TILE_SIZE;
    ctx.font = (TILE_SIZE * 0.8) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gameState.player.emoji, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
}

function renderHUD() {
    const p = gameState.player;
    const pad = 10;
    const w = 200, h = 80;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.roundRect(pad, pad, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(p.emoji + ' ' + p.name + '  Lv.' + p.level, pad + 8, pad + 8);

    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(pad + 8, pad + 28, 80, 10);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(pad + 8, pad + 28, 80 * (p.stats.hp / p.maxHp), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('HP ' + p.stats.hp + '/' + p.maxHp, pad + 92, pad + 28);

    ctx.fillStyle = '#555';
    ctx.fillRect(pad + 8, pad + 42, 80, 10);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(pad + 8, pad + 42, 80 * (p.stats.mp / p.maxMp), 10);
    ctx.fillStyle = '#fff';
    ctx.fillText('MP ' + p.stats.mp + '/' + p.maxMp, pad + 92, pad + 42);

    ctx.fillStyle = '#f1c40f';
    ctx.fillText('💰 ' + p.gold, pad + 8, pad + 58);
    ctx.fillStyle = '#aaa';
    ctx.fillText('EXP ' + p.exp + '/' + p.expNext, pad + 70, pad + 58);

    const mapName = getMap().name;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const mnw = ctx.measureText(mapName).width + 20;
    ctx.roundRect(canvas.width - mnw - pad, pad, mnw, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(mapName, canvas.width - pad - 10, pad + 7);
}

function renderDialog() {
    const d = gameState.dialog;
    const pad = 20;
    const h = 100;
    const y = canvas.height - h - pad;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.roundRect(pad, y, canvas.width - pad * 2, h, 12);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.roundRect(pad, y, canvas.width - pad * 2, h, 12);
    ctx.stroke();

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(d.speaker, pad + 15, y + 12);

    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    wrapText(d.text, pad + 15, y + 35, canvas.width - pad * 2 - 30, 20);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('点击或按Enter继续', canvas.width - pad - 15, y + h - 18);
}

function renderMessage() {
    const pad = 20;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    const tw = ctx.measureText(gameState.message).width;
    const w = Math.min(tw + 40, canvas.width - 40);
    ctx.roundRect((canvas.width - w) / 2, canvas.height - 60, w, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gameState.message, canvas.width / 2, canvas.height - 42);
}

function wrapText(text, x, y, maxWidth, lineHeight) {
    let line = '';
    for (let i = 0; i < text.length; i++) {
        const testLine = line + text[i];
        if (ctx.measureText(testLine).width > maxWidth) {
            ctx.fillText(line, x, y);
            line = text[i];
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

// --- BATTLE RENDER ---

function renderBattle() {
    const b = gameState.battle;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.45);

    ctx.font = (Math.min(canvas.width, 300) * 0.25) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.monster.emoji, canvas.width / 2, canvas.height * 0.2);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(b.monster.name + (b.monster.isBoss ? ' 👹' : ''), canvas.width / 2, canvas.height * 0.35);

    const barW = 160, barH = 12;
    const barX = (canvas.width - barW) / 2;
    const barY = canvas.height * 0.38;
    ctx.fillStyle = '#444';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(barX, barY, barW * Math.max(0, b.monster.currentHp / b.monster.hp), barH);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('HP ' + b.monster.currentHp + '/' + b.monster.hp, canvas.width / 2, barY + barH + 10);

    const logY = canvas.height * 0.46;
    const logH = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, logY, canvas.width - 20, logH);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const visibleLogs = b.log.slice(-3);
    visibleLogs.forEach((l, i) => {
        ctx.fillText(l, 20, logY + 18 + i * 20);
    });

    const panelY = canvas.height * 0.46 + logH + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, panelY, canvas.width - 20, 30);

    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(20, panelY + 4, 80 * (b.playerHp / gameState.player.maxHp), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HP ' + b.playerHp + '/' + gameState.player.maxHp, 105, panelY + 5);

    ctx.fillStyle = '#3498db';
    ctx.fillRect(20, panelY + 17, 80 * (b.playerMp / gameState.player.maxMp), 10);
    ctx.fillStyle = '#fff';
    ctx.fillText('MP ' + b.playerMp + '/' + gameState.player.maxMp, 105, panelY + 18);

    if (b.result) return;
    if (b.turn !== 'player') return;

    const btnY = panelY + 45;
    const btnW = (canvas.width - 50) / 2;
    const btnH = 44;

    battleButtons = [];

    if (b.phase === 'menu') {
        drawBtn(15, btnY, btnW, btnH, '⚔️ 攻击', '#e67e22', () => battleAction('attack'));
        drawBtn(25 + btnW, btnY, btnW, btnH, '✨ 技能', '#9b59b6', () => { b.phase = 'skills'; });
        drawBtn(15, btnY + btnH + 8, btnW, btnH, '🏃 逃跑', '#95a5a6', () => battleAction('flee'));
        drawBtn(25 + btnW, btnY + btnH + 8, btnW, btnH, '💊 回复', '#27ae60', () => {
            if (b.playerHp < gameState.player.maxHp) {
                const heal = Math.floor(gameState.player.maxHp * 0.3);
                b.playerHp = Math.min(gameState.player.maxHp, b.playerHp + heal);
                b.playerMp = Math.min(gameState.player.maxMp, b.playerMp + 10);
                b.log.push('你使用了回复术，恢复了' + heal + '点生命！');
                b.turn = 'monster';
                setTimeout(() => monsterTurn(), 600);
            } else {
                b.log.push('生命值已满！');
            }
        });
    } else if (b.phase === 'skills') {
        gameState.player.skills.forEach((sk, i) => {
            const y2 = btnY + i * (btnH + 8);
            const canUse = b.playerMp >= sk.cost;
            drawBtn(15, y2, canvas.width - 30, btnH, sk.name + '（' + sk.cost + 'MP）', canUse ? '#8e44ad' : '#555', canUse ? () => { battleAction('skill', i); b.phase = 'menu'; } : null);
        });
        drawBtn(15, btnY + gameState.player.skills.length * (btnH + 8), canvas.width - 30, btnH, '← 返回', '#7f8c8d', () => { b.phase = 'menu'; });
    }
}

let battleButtons = [];

function drawBtn(x, y, w, h, text, color, onClick) {
    ctx.fillStyle = color;
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    if (onClick) battleButtons.push({ x, y, w, h, onClick });
}

function handleBattleClick(cx, cy) {
    for (const btn of battleButtons) {
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            btn.onClick();
            return;
        }
    }
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
    };
}
