let canvas, ctx;
let worldCanvas, worldCtx;
let gameState = null;
let camX = 0, camY = 0, camReady = false;
let gameArea = { x: 0, y: 0, w: 0, h: 0 };

const GAME_VERSION = 'v3.1';
const SAVE_API = 'https://laofujia-api.laofujia-worker.workers.dev/api/gamesave/jerry';
const SAVE_LOCAL_KEY = 'zoo_save_jerry';

function isVirtualCanvas() {
    return currentTheme !== 'classic';
}

function getTileSize() {
    if (isVirtualCanvas()) return RETRO_TILE;
    return Math.max(40, Math.min(64, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 10)));
}

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
            facing: 'down',
            walkFrame: 0,
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
    _startGameLoop();
}

function initGameFromSave(save) {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    const charData = CHARACTERS.find(c => c.id === save.charId);
    gameState = {
        player: {
            charId: save.charId,
            name: charData.name,
            emoji: charData.emoji,
            color: charData.color,
            level: save.player.level,
            exp: save.player.exp,
            expNext: save.player.expNext,
            gold: save.player.gold,
            stats: { ...save.player.stats },
            maxHp: save.player.maxHp,
            maxMp: save.player.maxMp,
            skills: charData.skills,
            buffs: [],
            x: save.player.x,
            y: save.player.y,
            facing: 'down',
            walkFrame: 0,
        },
        currentMap: save.currentMap,
        mapState: save.mapState || {},
        mode: 'explore',
        battle: null,
        dialog: null,
        message: null,
        messageTimer: 0,
        otherPlayers: {},
        moveQueue: [],
        lastMove: 0,
    };

    camReady = false;
    const map = MAPS[save.currentMap];
    if (!gameState.mapState[save.currentMap]) {
        gameState.mapState[save.currentMap] = {
            bosses: map.bosses ? map.bosses.map(b => ({ ...b })) : [],
        };
    }
    showMessage('存档已读取 — ' + charData.name + ' Lv.' + save.player.level);
    _startGameLoop();
}

let _loopStarted = false;
function _startGameLoop() {
    resizeCanvas();
    if (!_loopStarted) {
        _loopStarted = true;
        window.addEventListener('resize', resizeCanvas);
        setupInput();
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && gameState) saveGame();
        });
        window.addEventListener('beforeunload', () => {
            if (gameState) saveGame();
        });
        requestAnimationFrame(gameLoop);
    }
}

let virtualW = VIRTUAL_WIDTH, virtualH = VIRTUAL_HEIGHT;

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    if (isVirtualCanvas()) {
        const scale = canvas.width / VIRTUAL_WIDTH;
        virtualW = VIRTUAL_WIDTH;
        virtualH = Math.ceil(canvas.height / scale);
        if (!worldCanvas) {
            worldCanvas = document.createElement('canvas');
            worldCtx = worldCanvas.getContext('2d');
        }
        worldCanvas.width = virtualW;
        worldCanvas.height = virtualH;
        worldCtx.imageSmoothingEnabled = false;
        gameArea.x = 0;
        gameArea.y = 0;
        gameArea.w = canvas.width;
        gameArea.h = canvas.height;
    } else {
        gameArea.x = 0;
        gameArea.y = 0;
        gameArea.w = canvas.width;
        gameArea.h = canvas.height;
    }
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
    camReady = false;
    showMessage(map.enterMsg);
    if (gameState.mode === 'explore') saveGame();
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

    if (dy < 0) gameState.player.facing = 'up';
    else if (dy > 0) gameState.player.facing = 'down';
    else if (dx < 0) gameState.player.facing = 'left';
    else if (dx > 0) gameState.player.facing = 'right';

    const nx = gameState.player.x + dx;
    const ny = gameState.player.y + dy;

    const map = getMap();
    if (map.npcs) {
        for (const n of map.npcs) {
            if (n.x === nx && n.y === ny) {
                showNpcMenu('npc', n.id, null);
                return;
            }
        }
    }

    const ms = gameState.mapState[gameState.currentMap];
    if (ms.bosses) {
        for (const b of ms.bosses) {
            if (!b.defeated && b.x === nx && b.y === ny) {
                showNpcMenu('boss', b.monsterId, b);
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
    gameState.player.walkFrame = 1 - gameState.player.walkFrame;
    gameState.player._lastMoveTime = Date.now();
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

function showNpcMenu(type, id, bossRef) {
    gameState.npcMenu = { type, id, bossRef };
    gameState.mode = 'npc_menu';
}

let npcMenuButtons = [];
let _npcMenuActionTime = 0;

function handleNpcMenuAction(action) {
    _npcMenuActionTime = Date.now();
    const menu = gameState.npcMenu;
    if (!menu) return;

    if (action === 'talk') {
        if (menu.type === 'npc') {
            talkToNpc(menu.id);
        } else {
            const mon = MONSTERS[menu.id];
            gameState.dialog = {
                speaker: mon.emoji + ' ' + mon.name,
                text: mon.dialog,
                onClose: null,
            };
            gameState.mode = 'dialog';
        }
        gameState.npcMenu = null;
    } else if (action === 'view') {
        if (menu.type === 'npc') {
            const npc = NPCS[menu.id];
            gameState.dialog = {
                speaker: '🔍 ' + npc.name,
                text: npc.info || '暂无信息。',
                onClose: null,
            };
        } else {
            const mon = MONSTERS[menu.id];
            gameState.dialog = {
                speaker: '🔍 ' + mon.name,
                text: 'HP:' + mon.hp + ' 攻击:' + mon.atk + ' 防御:' + mon.def + ' 速度:' + mon.spd + (mon.isBoss ? ' [BOSS]' : ''),
                onClose: null,
            };
        }
        gameState.mode = 'dialog';
        gameState.npcMenu = null;
    } else if (action === 'battle') {
        if (menu.type === 'npc') {
            gameState.dialog = {
                speaker: NPCS[menu.id].emoji + ' ' + NPCS[menu.id].name,
                text: '我又不是怪物，你打我干嘛！',
                onClose: null,
            };
            gameState.mode = 'dialog';
            gameState.npcMenu = null;
        } else {
            gameState.npcMenu = null;
            startBattle(menu.id, menu.bossRef);
        }
    } else {
        gameState.npcMenu = null;
        gameState.mode = 'explore';
    }
}

function handleNpcMenuClick(cx, cy) {
    for (const btn of npcMenuButtons) {
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            btn.onClick();
            return;
        }
    }
}

function renderNpcMenu() {
    renderMap();
    renderHUD();

    const menu = gameState.npcMenu;
    if (!menu) return;

    let name, emoji;
    if (menu.type === 'npc') {
        const npc = NPCS[menu.id];
        name = npc.name;
        emoji = npc.emoji;
    } else {
        const mon = MONSTERS[menu.id];
        name = mon.name;
        emoji = mon.emoji;
    }

    npcMenuButtons = [];
    const pal = PALETTES[currentTheme];
    const isRetro = currentTheme === 'retro';

    const boxW = 240, boxH = 220;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = pal ? 'rgba(15,56,15,0.5)' : 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = pal ? pal.uiBorder : '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = pal ? pal.accent : '#f1c40f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleText = isRetro ? name : (emoji + ' ' + name);
    ctx.fillText(titleText, boxX + boxW / 2, boxY + 28);

    const btnW = boxW - 30;
    const btnH = 36;
    const startY = boxY + 55;
    const gap = 6;

    const options = isRetro ? [
        { label: '> 对话', color: pal.mid, action: 'talk' },
        { label: '> 查看', color: pal.mid, action: 'view' },
        { label: '> 战斗', color: pal.mid, action: 'battle' },
        { label: '> 离开', color: pal.mid, action: 'leave' },
    ] : [
        { label: '💬 对话', color: pal ? '#2980b9' : '#3498db', action: 'talk' },
        { label: '🔍 查看', color: pal ? '#7d3c98' : '#9b59b6', action: 'view' },
        { label: '⚔️ 战斗', color: pal ? '#c0392b' : '#e74c3c', action: 'battle' },
        { label: '👋 离开', color: pal ? '#5a6a6a' : '#7f8c8d', action: 'leave' },
    ];

    options.forEach((opt, i) => {
        const bx = boxX + 15;
        const by = startY + i * (btnH + gap);
        ctx.fillStyle = opt.color;
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opt.label, bx + btnW / 2, by + btnH / 2);
        npcMenuButtons.push({ x: bx, y: by, w: btnW, h: btnH, onClick: () => handleNpcMenuAction(opt.action) });
    });
}

function exitGame() {
    gameState.mode = 'explore';
    saveGame();
    location.reload();
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
        monsterId: monsterId,
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
            b.log.push('升级了！现在等级 ' + gameState.player.level);
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
    saveGame();
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
        if (gameState.mode === 'npc_menu') {
            if (e.key === 'Escape') handleNpcMenuAction('leave');
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
            if (Date.now() - _npcMenuActionTime < 400) return;
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
    const pal = PALETTES[currentTheme];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState.mode === 'battle') {
        renderBattle();
    } else if (gameState.mode === 'npc_menu') {
        renderNpcMenu();
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

function updateCamera() {
    const ts = getTileSize();
    const vc = isVirtualCanvas();
    const viewW = vc ? virtualW : canvas.width;
    const viewH = vc ? virtualH : canvas.height;

    const px = gameState.player.x * ts + ts / 2;
    const py = gameState.player.y * ts + ts / 2;
    if (!camReady) { camX = px; camY = py; camReady = true; return; }
    const edgeX = viewW * 0.32;
    const edgeY = viewH * 0.32;
    const sx = px - camX + viewW / 2;
    const sy = py - camY + viewH / 2;
    if (sx < edgeX) camX -= (edgeX - sx);
    if (sx > viewW - edgeX) camX += (sx - (viewW - edgeX));
    if (sy < edgeY) camY -= (edgeY - sy);
    if (sy > viewH - edgeY) camY += (sy - (viewH - edgeY));
    const map = getMap();
    const mw = map.width * ts, mh = map.height * ts;
    if (mw <= viewW) { camX = mw / 2; }
    else { camX = Math.max(viewW / 2, Math.min(mw - viewW / 2, camX)); }
    if (mh <= viewH) { camY = mh / 2; }
    else { camY = Math.max(viewH / 2, Math.min(mh - viewH / 2, camY)); }
}

function renderMap() {
    const map = getMap();
    const ts = getTileSize();
    const vc = isVirtualCanvas();
    updateCamera();

    if (vc && ZooEngine.isLoaded()) {
        worldCtx.imageSmoothingEnabled = false;
        const ms = gameState.mapState[gameState.currentMap];
        ZooEngine.renderWorld(
            worldCtx, map, ms, gameState.player,
            gameState.otherPlayers, camX, camY,
            virtualW, virtualH, currentTheme
        );
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(worldCanvas, gameArea.x, gameArea.y, gameArea.w, gameArea.h);
        ctx.imageSmoothingEnabled = true;
        return;
    }

    // Classic emoji mode fallback
    const viewW = canvas.width;
    const viewH = canvas.height;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, viewW, viewH);

    const offsetX = Math.floor(viewW / 2 - camX);
    const offsetY = Math.floor(viewH / 2 - camY);

    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = map.tiles[y * map.width + x];
            const sx = offsetX + x * ts;
            const sy = offsetY + y * ts;
            if (sx > viewW || sy > viewH || sx + ts < 0 || sy + ts < 0) continue;
            const tr = TILE_RENDER[tile];
            ctx.fillStyle = tr.bg;
            ctx.fillRect(sx, sy, ts, ts);
            if (tr.char) {
                ctx.font = (ts * 0.6) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tr.char, sx + ts / 2, sy + ts / 2);
            }
        }
    }

    if (map.exits) {
        for (const ex of map.exits) {
            const sx = offsetX + ex.x * ts;
            const sy = offsetY + ex.y * ts;
            ctx.font = (ts * 0.5) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ff9800';
            ctx.fillText('🚪', sx + ts / 2, sy + ts / 2);
        }
    }

    if (map.npcs) {
        for (const n of map.npcs) {
            const npc = NPCS[n.id];
            const sx = offsetX + n.x * ts;
            const sy = offsetY + n.y * ts;
            ctx.font = (ts * 0.7) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(npc.emoji, sx + ts / 2, sy + ts / 2);
        }
    }

    const ms = gameState.mapState[gameState.currentMap];
    if (ms.bosses) {
        for (const b of ms.bosses) {
            if (b.defeated) continue;
            const mon = MONSTERS[b.monsterId];
            const sx = offsetX + b.x * ts;
            const sy = offsetY + b.y * ts;
            ctx.font = (ts * 0.8) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mon.emoji, sx + ts / 2, sy + ts / 2);
        }
    }

    for (const id in gameState.otherPlayers) {
        const op = gameState.otherPlayers[id];
        if (op.map !== gameState.currentMap) continue;
        const sx = offsetX + op.x * ts;
        const sy = offsetY + op.y * ts;
        ctx.font = (ts * 0.7) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(op.emoji, sx + ts / 2, sy + ts / 2);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(op.name, sx + ts / 2, sy - 4);
    }

    const p = gameState.player;
    const px = offsetX + p.x * ts;
    const py = offsetY + p.y * ts;
    ctx.font = (ts * 0.8) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, px + ts / 2, py + ts / 2);
}

function renderHUD() {
    const p = gameState.player;
    const pad = 8;
    const w = 210, h = 100;
    const pal = PALETTES[currentTheme];
    const isRetro = currentTheme === 'retro';

    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.75)';
    ctx.fillRect(pad, pad, w, h);
    if (pal) {
        ctx.strokeStyle = pal.uiBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(pad, pad, w, h);
    }

    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const namePrefix = isRetro ? '' : (p.emoji + ' ');
    ctx.fillText(namePrefix + p.name + '  Lv.' + p.level, pad + 8, pad + 8);

    ctx.fillStyle = isRetro ? pal.mid : '#e74c3c';
    ctx.fillRect(pad + 8, pad + 30, 90, 12);
    ctx.fillStyle = pal ? pal.hpBar : '#2ecc71';
    ctx.fillRect(pad + 8, pad + 30, 90 * (p.stats.hp / p.maxHp), 12);
    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('HP ' + p.stats.hp + '/' + p.maxHp, pad + 102, pad + 30);

    ctx.fillStyle = isRetro ? pal.mid : '#555';
    ctx.fillRect(pad + 8, pad + 48, 90, 12);
    ctx.fillStyle = pal ? pal.mpBar : '#3498db';
    ctx.fillRect(pad + 8, pad + 48, 90 * (p.stats.mp / p.maxMp), 12);
    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.fillText('MP ' + p.stats.mp + '/' + p.maxMp, pad + 102, pad + 48);

    ctx.fillStyle = pal ? pal.accent : '#f1c40f';
    ctx.font = '13px sans-serif';
    ctx.fillText((isRetro ? '' : '💰 ') + p.gold + '金', pad + 8, pad + 68);
    ctx.fillStyle = pal ? pal.text : '#ccc';
    ctx.fillText('EXP ' + p.exp + '/' + p.expNext, pad + 80, pad + 68);

    ctx.fillStyle = pal ? pal.mid : '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText(GAME_VERSION + ' · ' + getMap().name, pad + 8, pad + 86);
}

function renderDialog() {
    const d = gameState.dialog;
    const pad = 12;
    const h = 120;
    const y = canvas.height - h - pad;
    const pal = PALETTES[currentTheme];

    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.9)';
    ctx.fillRect(pad, y, canvas.width - pad * 2, h);
    ctx.strokeStyle = pal ? pal.uiBorder : '#fff';
    ctx.lineWidth = pal ? 2 : 1;
    ctx.strokeRect(pad, y, canvas.width - pad * 2, h);

    ctx.fillStyle = pal ? pal.accent : '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(d.speaker, pad + 12, y + 10);

    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = '16px sans-serif';
    wrapText(d.text, pad + 12, y + 36, canvas.width - pad * 2 - 24, 22);

    ctx.fillStyle = pal ? pal.mid : '#999';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('点击继续', canvas.width - pad - 12, y + h - 20);
}

function renderMessage() {
    const pal = PALETTES[currentTheme];
    ctx.font = '15px sans-serif';
    const tw = ctx.measureText(gameState.message).width;
    const w = Math.min(tw + 40, canvas.width - 40);
    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.85)';
    ctx.fillRect((canvas.width - w) / 2, canvas.height - 60, w, 36);
    if (pal) {
        ctx.strokeStyle = pal.uiBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect((canvas.width - w) / 2, canvas.height - 60, w, 36);
    }
    ctx.fillStyle = pal ? pal.text : '#fff';
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
    const pal = PALETTES[currentTheme];

    ctx.fillStyle = pal ? pal.bg : '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = pal ? pal.mid : '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.45);

    if (isVirtualCanvas() && ZooEngine.isLoaded()) {
        ZooEngine.drawBattleSprite(ctx, b.monster.monsterId || '', canvas.width / 2, canvas.height * 0.2, 4);
    } else {
        ctx.font = (Math.min(canvas.width, 300) * 0.25) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.monster.emoji, canvas.width / 2, canvas.height * 0.2);
    }

    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(b.monster.name + (b.monster.isBoss ? ' BOSS' : ''), canvas.width / 2, canvas.height * 0.35);

    const barW = 160, barH = 12;
    const barX = (canvas.width - barW) / 2;
    const barY = canvas.height * 0.38;
    ctx.fillStyle = '#444';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pal ? pal.hpBar : '#e74c3c';
    ctx.fillRect(barX, barY, barW * Math.max(0, b.monster.currentHp / b.monster.hp), barH);
    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('HP ' + b.monster.currentHp + '/' + b.monster.hp, canvas.width / 2, barY + barH + 12);

    const logY = canvas.height * 0.46;
    const logH = 80;
    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, logY, canvas.width - 20, logH);
    ctx.fillStyle = pal ? pal.text : '#ddd';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    const visibleLogs = b.log.slice(-3);
    visibleLogs.forEach((l, i) => {
        ctx.fillText(l, 20, logY + 20 + i * 24);
    });

    const panelY = canvas.height * 0.46 + logH + 10;
    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, panelY, canvas.width - 20, 34);

    ctx.fillStyle = pal ? pal.hpBar : '#2ecc71';
    ctx.fillRect(20, panelY + 4, 90 * (b.playerHp / gameState.player.maxHp), 12);
    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HP ' + b.playerHp + '/' + gameState.player.maxHp, 115, panelY + 5);

    ctx.fillStyle = pal ? pal.mpBar : '#3498db';
    ctx.fillRect(20, panelY + 19, 90 * (b.playerMp / gameState.player.maxMp), 12);
    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.fillText('MP ' + b.playerMp + '/' + gameState.player.maxMp, 115, panelY + 20);

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
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
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

// --- SAVE / LOAD ---

function _buildSaveData() {
    const p = gameState.player;
    return {
        charId: p.charId,
        player: {
            level: p.level,
            exp: p.exp,
            expNext: p.expNext,
            gold: p.gold,
            stats: { ...p.stats },
            maxHp: p.maxHp,
            maxMp: p.maxMp,
            x: p.x,
            y: p.y,
        },
        currentMap: gameState.currentMap,
        mapState: gameState.mapState,
        version: GAME_VERSION,
    };
}

function saveGame() {
    if (!gameState || gameState.mode === 'battle') return;
    const data = _buildSaveData();
    try { localStorage.setItem(SAVE_LOCAL_KEY, JSON.stringify(data)); } catch(e) {}
    fetch(SAVE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

function loadSaveFromCloud() {
    return fetch(SAVE_API).then(r => r.json()).then(data => {
        if (data && !data.empty && data.charId) {
            try { localStorage.setItem(SAVE_LOCAL_KEY, JSON.stringify(data)); } catch(e) {}
            return data;
        }
        return null;
    }).catch(() => {
        try {
            const local = localStorage.getItem(SAVE_LOCAL_KEY);
            return local ? JSON.parse(local) : null;
        } catch(e) { return null; }
    });
}

function getLocalSave() {
    try {
        const raw = localStorage.getItem(SAVE_LOCAL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
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
