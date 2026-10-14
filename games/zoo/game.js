let canvas, ctx;
let worldCanvas, worldCtx;
let gameState = null;
let camX = 0, camY = 0, camReady = false;
let gameArea = { x: 0, y: 0, w: 0, h: 0 };

const GAME_VERSION = 'v4.1';
const SAVE_API = 'https://laofujia-api.laofujia-worker.workers.dev/api/gamesave/jerry';
const SAVE_LOCAL_KEY = 'zoo_save_jerry';

// --- ITEM DEFINITIONS ---

const ITEMS = {
    bread:        { name: '面包',   emoji: '🍞', type: 'food',  hunger: 50, desc: '恢复50饥饿' },
    sausage:      { name: '香肠',   emoji: '🌭', type: 'food',  hunger: 30, desc: '恢复30饥饿' },
    water:        { name: '水',     emoji: '💧', type: 'drink', thirst: 50, desc: '恢复50口渴' },
    orange_juice: { name: '橙汁',   emoji: '🧃', type: 'drink', thirst: 40, hunger: 10, desc: '+40口渴+10饥饿' },
    chocolate:    { name: '巧克力', emoji: '🍫', type: 'food',  hunger: 40, desc: '恢复40饥饿' },
    ice_cream:    { name: '冰淇淋', emoji: '🍦', type: 'food',  thirst: 20, hunger: 20, desc: '+20口渴+20饥饿' },
    ticket:       { name: '门票',   emoji: '🎫', type: 'ticket', desc: '动物园门票' },
};

const VENDING_STOCK = [
    { id: 'water', price: 1 },
    { id: 'orange_juice', price: 2 },
    { id: 'bread', price: 2 },
    { id: 'chocolate', price: 3 },
];

const ICE_CREAM_STOCK = [
    { id: 'ice_cream', price: 5 },
];

const TICKET_STOCK = [
    { id: 'ticket', price: 2 },
];

// --- CORE ---

function isVirtualCanvas() {
    return currentTheme !== 'classic';
}

function getTileSize() {
    if (isVirtualCanvas()) return RETRO_TILE;
    return Math.max(40, Math.min(64, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 10)));
}

function initGame(playerName, playerEmoji) {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    gameState = {
        player: {
            name: playerName,
            emoji: playerEmoji,
            level: 1,
            exp: 0,
            expNext: 50,
            gold: 10,
            hp: 100, maxHp: 100,
            mp: 100, maxMp: 100,
            hunger: 100,
            thirst: 100,
            str: 10, agi: 10, wis: 10,
            inventory: [
                { id: 'bread', qty: 1 },
                { id: 'sausage', qty: 1 },
                { id: 'water', qty: 1 },
            ],
            skills: [
                { name: '猛击', cost: 10, dmg: 20, desc: '用力攻击' },
                { name: '治疗', cost: 15, dmg: -30, desc: '恢复体力' },
            ],
            buffs: [],
            x: 0, y: 0,
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
        npcMenu: null,
        shop: null,
    };

    loadMap('ticket_office');
    _startGameLoop();
}

function initGameFromSave(save) {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    gameState = {
        player: {
            name: save.playerName,
            emoji: save.playerEmoji,
            level: save.player.level,
            exp: save.player.exp,
            expNext: save.player.expNext,
            gold: save.player.gold,
            hp: save.player.hp,
            maxHp: save.player.maxHp,
            mp: save.player.mp,
            maxMp: save.player.maxMp,
            hunger: save.player.hunger !== undefined ? save.player.hunger : 100,
            thirst: save.player.thirst !== undefined ? save.player.thirst : 100,
            str: save.player.str || 10,
            agi: save.player.agi || 10,
            wis: save.player.wis || 10,
            inventory: save.player.inventory || [],
            skills: [
                { name: '猛击', cost: 10, dmg: 20, desc: '用力攻击' },
                { name: '治疗', cost: 15, dmg: -30, desc: '恢复体力' },
            ],
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
        npcMenu: null,
        shop: null,
    };

    camReady = false;
    const map = MAPS[save.currentMap];
    if (!gameState.mapState[save.currentMap]) {
        gameState.mapState[save.currentMap] = {
            bosses: map.bosses ? map.bosses.map(b => ({ ...b })) : [],
        };
    }
    showMessage('存档已读取 — ' + save.playerEmoji + ' ' + save.playerName + ' Lv.' + save.player.level);
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
        gameArea.x = 0; gameArea.y = 0;
        gameArea.w = canvas.width; gameArea.h = canvas.height;
    } else {
        gameArea.x = 0; gameArea.y = 0;
        gameArea.w = canvas.width; gameArea.h = canvas.height;
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

// --- INVENTORY ---

function addItem(itemId, qty) {
    const inv = gameState.player.inventory;
    const existing = inv.find(i => i.id === itemId);
    if (existing) {
        existing.qty += qty;
    } else {
        inv.push({ id: itemId, qty: qty });
    }
}

function removeItem(itemId, qty) {
    const inv = gameState.player.inventory;
    const idx = inv.findIndex(i => i.id === itemId);
    if (idx === -1) return false;
    inv[idx].qty -= qty;
    if (inv[idx].qty <= 0) inv.splice(idx, 1);
    return true;
}

function getItemQty(itemId) {
    const item = gameState.player.inventory.find(i => i.id === itemId);
    return item ? item.qty : 0;
}

let _lastUseTime = 0;
function useItem(itemId) {
    if (Date.now() - _lastUseTime < 300) return false;
    _lastUseTime = Date.now();
    const def = ITEMS[itemId];
    if (!def) return false;
    const p = gameState.player;

    if (def.type === 'food' || def.type === 'drink') {
        const isFood = def.hunger && def.hunger > 0;
        const isDrink = def.thirst && def.thirst > 0;

        if (isFood && !isDrink && p.hunger >= 95) {
            showMessage('你现在不饿，吃不下了！');
            return false;
        }
        if (isDrink && !isFood && p.thirst >= 95) {
            showMessage('你现在不渴，喝不下了！');
            return false;
        }
        if (isFood && isDrink && p.hunger >= 95 && p.thirst >= 95) {
            showMessage('你现在不饿也不渴！');
            return false;
        }

        if (!removeItem(itemId, 1)) return false;

        const remaining = getItemQty(itemId);
        let msg = '使用了' + def.emoji + def.name + (remaining > 0 ? '（剩余' + remaining + '个）' : '（已用完）');
        if (isFood) {
            p.hunger = Math.min(130, p.hunger + def.hunger);
            if (p.hunger > 100) msg = '吃的太撑了！饥饿:' + Math.floor(p.hunger);
        }
        if (isDrink) {
            p.thirst = Math.min(100, p.thirst + def.thirst);
        }
        showMessage(msg);
        return true;
    }

    if (def.type === 'ticket') {
        showMessage('门票需要在入口处使用！');
        return false;
    }
    return false;
}

// --- MOVEMENT ---

function movePlayer(dx, dy) {
    if (gameState.mode !== 'explore') return;
    const p = gameState.player;
    if (p.hunger <= 0) {
        showMessage('😫 你太饿了，无法移动！打开背包吃点东西吧', 2000);
        return;
    }
    if (p.thirst <= 0) {
        showMessage('😫 你太渴了，无法移动！打开背包喝点水吧', 2000);
        return;
    }
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
                interactWithNpc(n.id);
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
                if (ex.requireTicket) {
                    if (getItemQty('ticket') <= 0) {
                        showMessage('⚠️ 你需要一张门票才能进入！去售票处买票吧。', 3000);
                        return;
                    }
                    removeItem('ticket', 1);
                    showMessage('🎫 门票已使用！');
                }
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

    applyStepEffects();
}

function applyStepEffects() {
    const p = gameState.player;

    p.hunger = Math.max(0, p.hunger - 1);
    p.thirst = Math.max(0, p.thirst - 2);
    p.hp = Math.min(p.maxHp, p.hp + 1);

    if (p.hunger <= 0) {
        showMessage('😫 你太饿了，无法继续移动！从背包里找吃的吧', 3000);
    } else if (p.thirst <= 0) {
        showMessage('😫 你太渴了，无法继续移动！从背包里找水喝吧', 3000);
    } else if (p.hunger < 30) {
        showMessage('⚠️ 你太饿了，吃点东西吧！', 2000);
    } else if (p.thirst < 30) {
        showMessage('⚠️ 你太渴了，喝点水吧！', 2000);
    }
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

// --- NPC INTERACTION ---

function interactWithNpc(npcId) {
    if (npcId === 'vending_machine') {
        openShop('vending');
        return;
    }
    if (npcId === 'ice_cream_cart') {
        openShop('ice_cream');
        return;
    }
    showNpcMenu('npc', npcId, null);
}

function openShop(shopType) {
    let stock, title;
    if (shopType === 'vending') {
        stock = VENDING_STOCK;
        title = '🏪 自动售货机';
    } else if (shopType === 'ice_cream') {
        stock = ICE_CREAM_STOCK;
        title = '🍦 冰淇淋车';
    } else if (shopType === 'ticket') {
        stock = TICKET_STOCK;
        title = '🎫 售票处';
    }
    gameState.shop = { type: shopType, stock: stock, title: title };
    gameState.mode = 'shop';
}

let _lastBuyTime = 0;
function buyItem(itemId, price) {
    if (Date.now() - _lastBuyTime < 300) return;
    _lastBuyTime = Date.now();
    const p = gameState.player;
    if (p.gold < price) {
        showMessage('💰 金币不足！需要' + price + '元');
        return;
    }
    p.gold -= price;
    addItem(itemId, 1);
    const def = ITEMS[itemId];
    showMessage('购买了' + def.emoji + def.name + '！(-' + price + '元，余' + p.gold + '元)');
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
    } else if (action === 'trade') {
        gameState.npcMenu = null;
        if (menu.id === 'ticket_seller') {
            const p = gameState.player;
            if (p.gold < 2) {
                showMessage('💰 你的钱不够买门票！需要2元');
                gameState.mode = 'explore';
            } else {
                showConfirm('🎫 售票处', '要用2元钱买一张门票吗？', () => {
                    buyItem('ticket', 2);
                });
            }
        } else {
            gameState.mode = 'explore';
        }
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

function exitGame() {
    gameState.mode = 'explore';
    saveGame();
    location.reload();
}

function showMessage(text, duration) {
    gameState.message = text;
    gameState.messageTimer = Date.now() + (duration || 3000);
}

// --- GAME MENU ---

let _menuOpenTime = 0;
let gameMenuButtons = [];

function handleGameMenuClick(cx, cy) {
    if (Date.now() - _menuOpenTime < 300) return;
    for (const btn of gameMenuButtons) {
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            if (btn.action === 'char_info') gameState.mode = 'char_info';
            else if (btn.action === 'inventory') gameState.mode = 'inventory';
            else if (btn.action === 'close') gameState.mode = 'explore';
            return;
        }
    }
    gameState.mode = 'explore';
}

// --- INVENTORY UI ---

let inventoryButtons = [];

function handleInventoryClick(cx, cy) {
    for (const btn of inventoryButtons) {
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            if (btn.action === 'close') gameState.mode = 'game_menu';
            else if (btn.itemId) useItem(btn.itemId);
            return;
        }
    }
}

// --- SHOP UI ---

let shopButtons = [];

function handleShopClick(cx, cy) {
    for (const btn of shopButtons) {
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            if (btn.action === 'close') {
                gameState.shop = null;
                gameState.mode = 'explore';
            } else if (btn.action === 'talk_seller') {
                gameState.shop = null;
                talkToNpc('ticket_seller');
            } else if (btn.itemId) {
                buyItem(btn.itemId, btn.price);
            }
            return;
        }
    }
}

// --- CONFIRM DIALOG ---

let confirmButtons = [];

function showConfirm(title, text, onYes) {
    gameState.confirm = { title: title, text: text, onYes: onYes };
    gameState.mode = 'confirm';
}

function handleConfirmClick(cx, cy) {
    for (const btn of confirmButtons) {
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            if (btn.action === 'yes' && gameState.confirm && gameState.confirm.onYes) {
                gameState.confirm.onYes();
            }
            gameState.confirm = null;
            gameState.mode = 'explore';
            return;
        }
    }
}

// --- MENU BUTTON ---

function getMenuButtonRect() {
    return { x: 28, y: canvas.height - 55, r: 23 };
}

function isMenuButtonHit(cx, cy) {
    const mb = getMenuButtonRect();
    const dx = cx - mb.x;
    const dy = cy - mb.y;
    return (dx * dx + dy * dy) <= (mb.r + 8) * (mb.r + 8);
}

// --- CENTRAL CLICK HANDLER ---

let _clickHandledTime = 0;

function handleCanvasClick(cx, cy) {
    _clickHandledTime = Date.now();
    if (gameState.mode === 'battle') {
        handleBattleClick(cx, cy);
    } else if (gameState.mode === 'npc_menu') {
        handleNpcMenuClick(cx, cy);
    } else if (gameState.mode === 'game_menu') {
        handleGameMenuClick(cx, cy);
    } else if (gameState.mode === 'char_info') {
        gameState.mode = 'game_menu';
    } else if (gameState.mode === 'inventory') {
        handleInventoryClick(cx, cy);
    } else if (gameState.mode === 'shop') {
        handleShopClick(cx, cy);
    } else if (gameState.mode === 'confirm') {
        handleConfirmClick(cx, cy);
    } else if (gameState.mode === 'dialog') {
        if (Date.now() - _npcMenuActionTime < 400) return;
        gameState.mode = 'explore';
        gameState.dialog = null;
    } else if (gameState.mode === 'explore') {
        if (isMenuButtonHit(cx, cy)) {
            _menuOpenTime = Date.now();
            gameState.mode = 'game_menu';
        }
    }
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
        playerHp: gameState.player.hp,
        playerMp: gameState.player.mp,
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
    const p = gameState.player;

    if (action === 'attack') {
        const atk = p.str + p.level * 2;
        const dmg = Math.max(1, atk - b.monster.def + Math.floor(Math.random() * 5));
        b.monster.currentHp = Math.max(0, b.monster.currentHp - dmg);
        b.log.push('你攻击了' + b.monster.name + '，造成 ' + dmg + ' 点伤害！');
    } else if (action === 'skill') {
        const skill = p.skills[skillIdx];
        if (b.playerMp < skill.cost) {
            b.log.push('精力不足！');
            return;
        }
        b.playerMp -= skill.cost;
        if (skill.dmg < 0) {
            const heal = Math.abs(skill.dmg);
            b.playerHp = Math.min(p.maxHp, b.playerHp + heal);
            b.log.push('你使用了' + skill.name + '，恢复 ' + heal + ' 点体力！');
        } else if (skill.buff) {
            p.buffs.push({ ...skill.buff, remaining: skill.buff.turns });
            b.log.push('你使用了' + skill.name + '！' + skill.desc);
        } else {
            const atk = p.str + p.level * 2;
            const dmg = Math.max(1, skill.dmg + atk / 2 - b.monster.def / 2 + Math.floor(Math.random() * 8));
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
        p.exp += drops.exp;
        p.gold += drops.gold;
        b.log.push('获得 ' + drops.exp + ' 经验，' + drops.gold + ' 金币！');
        if (p.exp >= p.expNext) {
            levelUp();
            b.log.push('升级了！现在等级 ' + p.level);
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
    const p = gameState.player;
    let defPower = p.agi;
    for (const buff of p.buffs) {
        if (buff.def) defPower += buff.def;
    }
    const dmg = Math.max(1, b.monster.atk - defPower / 2 + Math.floor(Math.random() * 4));
    b.playerHp = Math.max(0, b.playerHp - dmg);
    b.log.push(b.monster.name + '攻击了你，造成 ' + dmg + ' 点伤害！');

    for (const buff of p.buffs) {
        buff.remaining--;
    }
    p.buffs = p.buffs.filter(b => b.remaining > 0);

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
    const p = gameState.player;
    if (b.result === 'lost') {
        p.hp = Math.floor(p.maxHp * 0.3);
        p.mp = Math.floor(p.maxMp * 0.3);
        loadMap('ticket_office');
        showMessage('你被传送回了售票处...', 3000);
    } else {
        p.hp = b.playerHp;
        p.mp = b.playerMp;
    }
    gameState.battle = null;
    p.buffs = [];
    gameState.mode = 'explore';
    saveGame();
}

function levelUp() {
    const p = gameState.player;
    p.level++;
    p.exp -= p.expNext;
    p.expNext = Math.floor(p.expNext * 1.5);
    p.maxHp += 15;
    p.maxMp += 8;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.str += 2;
    p.agi += 1;
    p.wis += 1;
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
        if (gameState.mode === 'game_menu' || gameState.mode === 'char_info') {
            if (e.key === 'Escape') gameState.mode = 'explore';
            return;
        }
        if (gameState.mode === 'inventory') {
            if (e.key === 'Escape') gameState.mode = 'game_menu';
            return;
        }
        if (gameState.mode === 'shop') {
            if (e.key === 'Escape') {
                gameState.shop = null;
                gameState.mode = 'explore';
            }
            return;
        }
        if (gameState.mode === 'confirm') {
            if (e.key === 'Escape') {
                gameState.confirm = null;
                gameState.mode = 'explore';
            }
            return;
        }
        if (gameState.mode === 'battle') return;
        if (e.key === 'ArrowUp' || e.key === 'w') movePlayer(0, -1);
        if (e.key === 'ArrowDown' || e.key === 's') movePlayer(0, 1);
        if (e.key === 'ArrowLeft' || e.key === 'a') movePlayer(-1, 0);
        if (e.key === 'ArrowRight' || e.key === 'd') movePlayer(1, 0);
        if (e.key === 'm' || e.key === 'M') {
            _menuOpenTime = Date.now();
            gameState.mode = 'game_menu';
        }
    });
    document.addEventListener('keyup', e => { keysDown[e.key] = false; });

    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        if (gameState.mode !== 'explore') return;
        if (Date.now() - _clickHandledTime < 300) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState.mode === 'battle') {
        renderBattle();
    } else if (gameState.mode === 'npc_menu') {
        renderNpcMenu();
    } else if (gameState.mode === 'game_menu') {
        renderGameMenu();
    } else if (gameState.mode === 'char_info') {
        renderMap();
        renderHUD();
        renderCharInfo();
    } else if (gameState.mode === 'inventory') {
        renderMap();
        renderHUD();
        renderInventory();
    } else if (gameState.mode === 'shop') {
        renderMap();
        renderHUD();
        renderShop();
    } else if (gameState.mode === 'confirm') {
        renderMap();
        renderHUD();
        renderConfirm();
    } else {
        renderMap();
        renderHUD();
        renderMenuButton();
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
            if (!npc) continue;
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
    const w = 220, h = 92;
    const pal = PALETTES[currentTheme];

    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.75)';
    ctx.fillRect(pad, pad, w, h);
    if (pal) {
        ctx.strokeStyle = pal.uiBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(pad, pad, w, h);
    }

    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(p.emoji + ' ' + p.name + '  Lv.' + p.level, pad + 8, pad + 6);

    const barX = pad + 8;
    const barW = 80;
    const barH = 10;

    // HP
    ctx.fillStyle = '#555';
    ctx.fillRect(barX, pad + 24, barW, barH);
    ctx.fillStyle = pal ? pal.hpBar : '#2ecc71';
    ctx.fillRect(barX, pad + 24, barW * Math.max(0, p.hp / p.maxHp), barH);
    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('❤️' + p.hp + '/' + p.maxHp, barX + barW + 4, pad + 24);

    // Hunger
    const hungerColor = p.hunger < 30 ? '#e74c3c' : '#e67e22';
    ctx.fillStyle = '#555';
    ctx.fillRect(barX, pad + 38, barW, barH);
    ctx.fillStyle = hungerColor;
    ctx.fillRect(barX, pad + 38, barW * Math.min(1, Math.max(0, p.hunger / 100)), barH);
    ctx.fillStyle = p.hunger < 30 ? '#e74c3c' : (pal ? pal.text : '#fff');
    ctx.fillText('🍖' + Math.floor(p.hunger), barX + barW + 4, pad + 38);

    // Thirst
    const thirstColor = p.thirst < 30 ? '#e74c3c' : '#2980b9';
    ctx.fillStyle = '#555';
    ctx.fillRect(barX, pad + 52, barW, barH);
    ctx.fillStyle = thirstColor;
    ctx.fillRect(barX, pad + 52, barW * Math.max(0, p.thirst / 100), barH);
    ctx.fillStyle = p.thirst < 30 ? '#e74c3c' : (pal ? pal.text : '#fff');
    ctx.fillText('💧' + Math.floor(p.thirst), barX + barW + 4, pad + 52);

    // Gold + version
    ctx.fillStyle = pal ? pal.accent : '#f1c40f';
    ctx.font = '12px sans-serif';
    ctx.fillText('💰' + p.gold + '元', pad + 8, pad + 68);
    ctx.fillStyle = pal ? pal.mid : '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText(GAME_VERSION + ' · ' + getMap().name, pad + 80, pad + 70);

    // Ticket count if any
    const tickets = getItemQty('ticket');
    if (tickets > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText('🎫×' + tickets, pad + 8, pad + 80);
    }
}

function renderMenuButton() {
    const mb = getMenuButtonRect();
    ctx.beginPath();
    ctx.arc(mb.x, mb.y, mb.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☰', mb.x, mb.y);
}

function renderGameMenu() {
    renderMap();
    renderHUD();

    gameMenuButtons = [];

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 220, boxH = 200;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☰ 菜单', boxX + boxW / 2, boxY + 30);

    const btnW = boxW - 30;
    const btnH = 40;
    const startY = boxY + 55;
    const gap = 8;

    const menuOpts = [
        { label: '👤 人物', color: '#2980b9', action: 'char_info' },
        { label: '🎒 物品', color: '#27ae60', action: 'inventory' },
        { label: '❌ 退出', color: '#7f8c8d', action: 'close' },
    ];

    menuOpts.forEach((opt, i) => {
        const bx = boxX + 15;
        const by = startY + i * (btnH + gap);
        ctx.fillStyle = opt.color;
        ctx.fillRect(bx, by, btnW, btnH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opt.label, bx + btnW / 2, by + btnH / 2);
        gameMenuButtons.push({ x: bx, y: by, w: btnW, h: btnH, action: opt.action });
    });
}

function renderCharInfo() {
    const p = gameState.player;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 280, boxH = 320;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    let y = boxY + 12;
    const lx = boxX + 15;
    const rw = boxW - 30;

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(p.emoji + ' ' + p.name + '  Lv.' + p.level, lx, y);
    y += 30;

    const barW = 120, barH = 13;
    drawStatBar(lx, y, barW, barH, p.hp, p.maxHp, '#2ecc71', '❤️ 体力');
    y += 22;
    drawStatBar(lx, y, barW, barH, p.mp, p.maxMp, '#3498db', '✨ 精力');
    y += 22;
    const hColor = p.hunger < 30 ? '#e74c3c' : '#e67e22';
    drawStatBar(lx, y, barW, barH, Math.min(p.hunger, 100), 100, hColor, '🍖 饥饿');
    if (p.hunger > 100) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = '11px sans-serif';
        ctx.fillText('(撑!)', lx + 200, y + 2);
    }
    y += 22;
    const tColor = p.thirst < 30 ? '#e74c3c' : '#2980b9';
    drawStatBar(lx, y, barW, barH, p.thirst, 100, tColor, '💧 口渴');
    y += 28;

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx + rw, y);
    ctx.stroke();
    y += 10;

    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💪 力量: ' + p.str, lx, y);
    ctx.fillText('🏃 敏捷: ' + p.agi, lx + 110, y);
    y += 24;
    ctx.fillText('🧠 智慧: ' + p.wis, lx, y);
    y += 30;

    ctx.fillStyle = '#f1c40f';
    ctx.font = '15px sans-serif';
    ctx.fillText('💰 ' + p.gold + '元', lx, y);
    ctx.fillStyle = '#ccc';
    ctx.fillText('EXP ' + p.exp + '/' + p.expNext, lx + 100, y);
    y += 30;

    // Inventory summary
    const itemCount = p.inventory.reduce((s, i) => s + i.qty, 0);
    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.fillText('🎒 持有物品: ' + itemCount + '件', lx, y);

    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击返回', boxX + boxW / 2, boxY + boxH - 15);
}

function drawStatBar(x, y, w, h, val, max, color, label) {
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y);

    const bx = x + 70;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, y + 1, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(bx, y + 1, w * Math.max(0, Math.min(1, val / max)), h);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(Math.floor(val) + '/' + max, bx + w + 5, y + 2);
}

function renderInventory() {
    const p = gameState.player;
    inventoryButtons = [];

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 280, boxH = 360;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎒 物品', boxX + boxW / 2, boxY + 25);

    const startY = boxY + 50;
    const itemH = 38;
    const gap = 4;
    const lx = boxX + 12;
    const iw = boxW - 24;
    const maxItems = Math.floor((boxH - 100) / (itemH + gap));

    if (p.inventory.length === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('背包是空的', boxX + boxW / 2, startY + 40);
    } else {
        p.inventory.forEach((slot, i) => {
            if (i >= maxItems) return;
            const def = ITEMS[slot.id];
            if (!def) return;
            const iy = startY + i * (itemH + gap);

            const isUsable = def.type === 'food' || def.type === 'drink';
            ctx.fillStyle = isUsable ? 'rgba(39,174,96,0.3)' : 'rgba(255,255,255,0.08)';
            ctx.fillRect(lx, iy, iw, itemH);

            ctx.fillStyle = '#fff';
            ctx.font = '15px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.emoji + ' ' + def.name + ' ×' + slot.qty, lx + 8, iy + itemH / 2);

            if (isUsable) {
                ctx.fillStyle = '#27ae60';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('使用 →', lx + iw - 8, iy + itemH / 2);
            }
            inventoryButtons.push({
                x: lx, y: iy, w: iw, h: itemH,
                itemId: isUsable ? slot.id : null,
            });
        });
    }

    const closeBtnY = boxY + boxH - 40;
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(lx, closeBtnY, iw, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', boxX + boxW / 2, closeBtnY + 16);
    inventoryButtons.push({ x: lx, y: closeBtnY, w: iw, h: 32, action: 'close' });
}

function renderShop() {
    const shop = gameState.shop;
    if (!shop) return;

    shopButtons = [];

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const itemCount = shop.stock.length;
    const hasTalk = shop.type === 'ticket';
    const boxH = 120 + itemCount * 48 + (hasTalk ? 44 : 0);
    const boxW = 280;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shop.title, boxX + boxW / 2, boxY + 25);

    ctx.fillStyle = '#f1c40f';
    ctx.font = '14px sans-serif';
    ctx.fillText('💰 ' + gameState.player.gold + '元', boxX + boxW / 2, boxY + 48);

    const startY = boxY + 68;
    const itemH = 42;
    const gap = 6;
    const lx = boxX + 12;
    const iw = boxW - 24;

    shop.stock.forEach((stockItem, i) => {
        const def = ITEMS[stockItem.id];
        if (!def) return;
        const iy = startY + i * (itemH + gap);

        const canAfford = gameState.player.gold >= stockItem.price;
        ctx.fillStyle = canAfford ? 'rgba(39,174,96,0.2)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(lx, iy, iw, itemH);

        ctx.fillStyle = canAfford ? '#fff' : '#666';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.emoji + ' ' + def.name, lx + 8, iy + itemH / 2 - 8);

        ctx.fillStyle = canAfford ? '#aaa' : '#555';
        ctx.font = '11px sans-serif';
        ctx.fillText(def.desc || '', lx + 8, iy + itemH / 2 + 10);

        ctx.fillStyle = canAfford ? '#f1c40f' : '#666';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(stockItem.price + '元', lx + iw - 8, iy + itemH / 2);

        if (canAfford) {
            shopButtons.push({ x: lx, y: iy, w: iw, h: itemH, itemId: stockItem.id, price: stockItem.price });
        }
    });

    let bottomY = startY + itemCount * (itemH + gap);

    if (hasTalk) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(lx, bottomY, iw, 36);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💬 聊天', boxX + boxW / 2, bottomY + 18);
        shopButtons.push({ x: lx, y: bottomY, w: iw, h: 36, action: 'talk_seller' });
        bottomY += 44;
    }

    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(lx, bottomY, iw, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('离开', boxX + boxW / 2, bottomY + 16);
    shopButtons.push({ x: lx, y: bottomY, w: iw, h: 32, action: 'close' });
}

function renderConfirm() {
    const c = gameState.confirm;
    if (!c) return;
    confirmButtons = [];
    const pal = PALETTES[currentTheme];

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const boxW = 280, boxH = 160;
    const boxX = (canvas.width - boxW) / 2;
    const boxY = (canvas.height - boxH) / 2;

    ctx.fillStyle = pal ? pal.uiBg : 'rgba(0,0,0,0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = pal ? pal.uiBorder : '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = pal ? pal.accent : '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.title, boxX + boxW / 2, boxY + 30);

    ctx.fillStyle = pal ? pal.text : '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(c.text, boxX + boxW / 2, boxY + 70);

    const btnW = 100, btnH = 38;
    const btnY = boxY + boxH - 52;

    const yesX = boxX + boxW / 2 - btnW - 10;
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(yesX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('是', yesX + btnW / 2, btnY + btnH / 2);
    confirmButtons.push({ x: yesX, y: btnY, w: btnW, h: btnH, action: 'yes' });

    const noX = boxX + boxW / 2 + 10;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(noX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.fillText('否', noX + btnW / 2, btnY + btnH / 2);
    confirmButtons.push({ x: noX, y: btnY, w: btnW, h: btnH, action: 'no' });
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

    const isTicketSeller = menu.type === 'npc' && menu.id === 'ticket_seller';
    const isNpc = menu.type === 'npc';
    const allOpts = [
        { label: '💬 对话', retro: '> 对话', color: '#3498db', action: 'talk', show: true },
        { label: '💰 交易', retro: '> 交易', color: '#e67e22', action: 'trade', show: isTicketSeller },
        { label: '🔍 查看', retro: '> 查看', color: '#9b59b6', action: 'view', show: !isTicketSeller },
        { label: '⚔️ 战斗', retro: '> 战斗', color: '#e74c3c', action: 'battle', show: !isNpc },
        { label: '👋 离开', retro: '> 离开', color: '#7f8c8d', action: 'leave', show: true },
    ];
    const options = allOpts.filter(o => o.show).map(o => ({
        label: isRetro ? o.retro : o.label,
        color: isRetro ? pal.mid : o.color,
        action: o.action,
    }));

    const btnH = 36;
    const gap = 6;
    const boxW = 240;
    const boxH = 55 + options.length * (btnH + gap) + 5;
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
    const startY = boxY + 55;

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
                const heal = Math.floor(gameState.player.maxHp * 0.15);
                b.playerHp = Math.min(gameState.player.maxHp, b.playerHp + heal);
                b.log.push('你深呼吸，恢复了' + heal + '点体力！');
                b.turn = 'monster';
                setTimeout(() => monsterTurn(), 600);
            } else {
                b.log.push('体力已满！');
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
        playerName: p.name,
        playerEmoji: p.emoji,
        player: {
            level: p.level,
            exp: p.exp,
            expNext: p.expNext,
            gold: p.gold,
            hp: p.hp, maxHp: p.maxHp,
            mp: p.mp, maxMp: p.maxMp,
            hunger: p.hunger,
            thirst: p.thirst,
            str: p.str, agi: p.agi, wis: p.wis,
            inventory: p.inventory,
            x: p.x, y: p.y,
        },
        currentMap: gameState.currentMap,
        mapState: gameState.mapState,
        version: GAME_VERSION,
    };
}

function saveGame() {
    if (!gameState || gameState.mode === 'battle') return;
    const data = _buildSaveData();
    try { localStorage.setItem(SAVE_LOCAL_KEY, JSON.stringify(data)); } catch (e) {}
    fetch(SAVE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

function loadSaveFromCloud() {
    return fetch(SAVE_API).then(r => r.json()).then(data => {
        if (data && !data.empty && data.playerName) {
            try { localStorage.setItem(SAVE_LOCAL_KEY, JSON.stringify(data)); } catch (e) {}
            return data;
        }
        return null;
    }).catch(() => {
        try {
            const local = localStorage.getItem(SAVE_LOCAL_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && parsed.playerName) return parsed;
            }
            return null;
        } catch (e) { return null; }
    });
}

function getLocalSave() {
    try {
        const raw = localStorage.getItem(SAVE_LOCAL_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.playerName) return parsed;
        }
        return null;
    } catch (e) { return null; }
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
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
