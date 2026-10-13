let currentTheme = 'classic';

const THEME_INFO = {
    classic: { name: '🎭 经典模式', desc: '彩色emoji风格' },
    retro:   { name: '📟 怀旧模式', desc: '文曲星像素风' },
    pixel:   { name: '🎮 像素模式', desc: '全彩像素风' },
};

const PALETTES = {
    retro: {
        bg:      '#9bbc0f',
        light:   '#8bac0f',
        mid:     '#306230',
        dark:    '#0f380f',
        text:    '#0f380f',
        textBg:  '#9bbc0f',
        accent:  '#306230',
        hpBar:   '#306230',
        mpBar:   '#306230',
        uiBg:    'rgba(15,56,15,0.85)',
        uiBorder:'#0f380f',
    },
    pixel: {
        bg:      '#2b2b3d',
        light:   '#a8d8a8',
        mid:     '#5b8c5b',
        dark:    '#2d4a2d',
        text:    '#ffffff',
        textBg:  '#1a1a2e',
        accent:  '#f1c40f',
        hpBar:   '#2ecc71',
        mpBar:   '#3498db',
        uiBg:    'rgba(0,0,0,0.85)',
        uiBorder:'#f1c40f',
    },
};

const TILE_COLORS = {
    classic: null,
    retro: {
        0: '#9bbc0f',  // EMPTY
        1: '#306230',  // WALL
        2: '#8bac0f',  // PATH
        3: '#9bbc0f',  // GRASS
        4: '#306230',  // WATER
        5: '#8bac0f',  // DOOR
        6: '#306230',  // TREE
        7: '#306230',  // FENCE
        8: '#8bac0f',  // FLOOR
    },
    pixel: {
        0: '#2b2b3d',  // EMPTY
        1: '#6b4226',  // WALL
        2: '#c4a46c',  // PATH
        3: '#4a8c3f',  // GRASS
        4: '#3a7ecf',  // WATER
        5: '#d4883a',  // DOOR
        6: '#2d6b2d',  // TREE
        7: '#8b6b4a',  // FENCE
        8: '#b89a7a',  // FLOOR
    },
};

// 8x8 pixel sprites for characters (1=dark, 0=transparent)
// Each sprite is an array of 8 rows, each row is 8 bits
const PIXEL_SPRITES = {
    // Player character - simple human figure
    player: [
        0b00111100,
        0b00111100,
        0b00011000,
        0b01111110,
        0b00011000,
        0b00011000,
        0b00110110,
        0b00100010,
    ],
    // NPC - person with hat
    npc: [
        0b01111110,
        0b00111100,
        0b00111100,
        0b00011000,
        0b01111110,
        0b00011000,
        0b00110110,
        0b00100010,
    ],
    // Boss/Monster - large creature
    boss: [
        0b01100110,
        0b11111111,
        0b11011011,
        0b11111111,
        0b01111110,
        0b11111111,
        0b10000001,
        0b01000010,
    ],
    // Elephant
    elephant: [
        0b01110000,
        0b11111100,
        0b11111110,
        0b11001111,
        0b11001100,
        0b11111100,
        0b11011010,
        0b11011010,
    ],
    // Bird
    bird: [
        0b00010000,
        0b00111000,
        0b01111100,
        0b11111110,
        0b00111000,
        0b00010000,
        0b00101000,
        0b00000000,
    ],
    // Fire (phoenix)
    fire: [
        0b00010000,
        0b00111000,
        0b01010100,
        0b01111100,
        0b11111110,
        0b01111100,
        0b00111000,
        0b00010000,
    ],
    // Guard/Worker
    guard: [
        0b00111100,
        0b01111110,
        0b00111100,
        0b00011000,
        0b01111110,
        0b00011000,
        0b00011000,
        0b00100100,
    ],
    // Door
    door: [
        0b11111111,
        0b10000001,
        0b10000001,
        0b10001001,
        0b10001001,
        0b10000001,
        0b10000001,
        0b11111111,
    ],
    // Tree
    tree: [
        0b00011000,
        0b00111100,
        0b01111110,
        0b11111111,
        0b01111110,
        0b11111111,
        0b00011000,
        0b00011000,
    ],
    // Water wave
    water: [
        0b00000000,
        0b00000000,
        0b01010100,
        0b10101010,
        0b00000000,
        0b00000000,
        0b00101010,
        0b01010100,
    ],
    // Fence
    fence: [
        0b01001000,
        0b01001000,
        0b11111110,
        0b01001000,
        0b01001000,
        0b11111110,
        0b01001000,
        0b01001000,
    ],
};

// Map monster IDs to sprite keys
const MONSTER_SPRITE_MAP = {
    ticket_guard: 'guard',
    baby_elephant: 'elephant',
    angry_elephant: 'elephant',
    parrot: 'bird',
    peacock: 'bird',
    phoenix: 'fire',
};

// Pixel colors for colored pixel theme
const PIXEL_CHAR_COLORS = {
    player: '#e8d44d',
    ticket_seller: '#e8a0c0',
    zookeeper: '#6bb5e0',
    bird_keeper: '#c0a070',
    ticket_guard: '#e0a030',
    baby_elephant: '#a0a0a0',
    angry_elephant: '#808080',
    parrot: '#40c040',
    peacock: '#4080e0',
    phoenix: '#e04040',
};

function drawPixelSprite(ctx, spriteKey, x, y, size, color) {
    const sprite = PIXEL_SPRITES[spriteKey];
    if (!sprite) return;
    const px = size / 8;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (sprite[row] & (1 << (7 - col))) {
                ctx.fillStyle = color;
                ctx.fillRect(x + col * px, y + row * px, px, px);
            }
        }
    }
}

function getTileColor(tileType) {
    if (currentTheme === 'classic') return null;
    const colors = TILE_COLORS[currentTheme];
    return colors ? colors[tileType] : null;
}

function getRetroTilePattern(ctx, tileType, x, y, size) {
    const pal = PALETTES.retro;
    if (tileType === 6) { // TREE
        ctx.fillStyle = pal.bg;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'tree', x, y, size, pal.dark);
        return true;
    }
    if (tileType === 4) { // WATER
        ctx.fillStyle = pal.mid;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'water', x, y, size, pal.dark);
        return true;
    }
    if (tileType === 7) { // FENCE
        ctx.fillStyle = pal.bg;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'fence', x, y, size, pal.dark);
        return true;
    }
    if (tileType === 5) { // DOOR
        ctx.fillStyle = pal.light;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'door', x, y, size, pal.dark);
        return true;
    }
    return false;
}

function getPixelTilePattern(ctx, tileType, x, y, size) {
    if (tileType === 6) { // TREE
        ctx.fillStyle = TILE_COLORS.pixel[3]; // grass bg
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'tree', x, y, size, '#1a4a1a');
        return true;
    }
    if (tileType === 4) { // WATER
        ctx.fillStyle = TILE_COLORS.pixel[4];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'water', x, y, size, '#2060a0');
        return true;
    }
    if (tileType === 7) { // FENCE
        ctx.fillStyle = TILE_COLORS.pixel[3];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'fence', x, y, size, '#5a4030');
        return true;
    }
    if (tileType === 5) { // DOOR
        ctx.fillStyle = TILE_COLORS.pixel[2];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'door', x, y, size, '#a06020');
        return true;
    }
    return false;
}
