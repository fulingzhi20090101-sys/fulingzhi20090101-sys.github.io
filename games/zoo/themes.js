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
        0: '#9bbc0f', 1: '#306230', 2: '#8bac0f', 3: '#9bbc0f',
        4: '#306230', 5: '#8bac0f', 6: '#306230', 7: '#306230', 8: '#8bac0f',
    },
    pixel: {
        0: '#2b2b3d', 1: '#6b4226', 2: '#c4a46c', 3: '#4a8c3f',
        4: '#3a7ecf', 5: '#d4883a', 6: '#2d6b2d', 7: '#8b6b4a', 8: '#b89a7a',
    },
};

// 16x16 pixel sprites - each sprite is [rows], each row is a 16-bit number
const SPRITES_16 = {
    player: [
        0b0000011111000000,
        0b0000111111100000,
        0b0000111111100000,
        0b0000111001100000,
        0b0000011111000000,
        0b0000001110000000,
        0b0001111111110000,
        0b0011101110111000,
        0b0010001110001000,
        0b0000001110000000,
        0b0000001110000000,
        0b0000011011000000,
        0b0000011011000000,
        0b0000110001100000,
        0b0000110001100000,
        0b0001110001110000,
    ],
    npc: [
        0b0001111111100000,
        0b0001111111100000,
        0b0000111111000000,
        0b0000111111000000,
        0b0000110011000000,
        0b0000011110000000,
        0b0000001100000000,
        0b0001111111100000,
        0b0011110011110000,
        0b0010001100010000,
        0b0000001100000000,
        0b0000001100000000,
        0b0000011110000000,
        0b0000110001100000,
        0b0000110001100000,
        0b0001110001110000,
    ],
    elephant: [
        0b0000000001110000,
        0b0011100011111000,
        0b0111110111111100,
        0b1111111111111110,
        0b1111111111111110,
        0b1111111111111110,
        0b1111100111111100,
        0b0111100011111000,
        0b0111100001110000,
        0b0111100001110000,
        0b1111110011111100,
        0b1111110011111100,
        0b1100110011001100,
        0b1100110011001100,
        0b1100110011001100,
        0b1110110011011100,
    ],
    bird: [
        0b0000000000000000,
        0b0000001100000000,
        0b0000011110000000,
        0b0000111111000000,
        0b0000111111000000,
        0b0001111111100000,
        0b0111111111100000,
        0b1111111111111100,
        0b1111111111111110,
        0b0110111111110000,
        0b0000111111000000,
        0b0000011110000000,
        0b0000011110000000,
        0b0000010010000000,
        0b0000010010000000,
        0b0000011110000000,
    ],
    fire: [
        0b0000001100000000,
        0b0000011110000000,
        0b0000011110000000,
        0b0001111111100000,
        0b0011101101110000,
        0b0111111111111000,
        0b0111111111111000,
        0b1111111111111100,
        0b1111110011111100,
        0b0111111111111000,
        0b0111111111111000,
        0b0011111111110000,
        0b0001111111100000,
        0b0001110111100000,
        0b0000100001000000,
        0b0001100001100000,
    ],
    guard: [
        0b0000111111000000,
        0b0001111111100000,
        0b0011111111110000,
        0b0000111111000000,
        0b0000110011000000,
        0b0000011110000000,
        0b0000001100000000,
        0b0001111111100000,
        0b0011111111110000,
        0b0010011110010000,
        0b0000001100000000,
        0b0000001100000000,
        0b0000011110000000,
        0b0000110001100000,
        0b0000110001100000,
        0b0001110001110000,
    ],
    boss: [
        0b0011000000110000,
        0b0111100001111000,
        0b0111111111111000,
        0b1111111111111100,
        0b1111100001111100,
        0b1110111110111100,
        0b1111100001111100,
        0b1111111111111100,
        0b0111111111111000,
        0b0111111111111000,
        0b1111111111111100,
        0b1100011110001100,
        0b1100000000001100,
        0b0110000000011000,
        0b0011000000110000,
        0b0001100001100000,
    ],
    tree: [
        0b0000001100000000,
        0b0000011110000000,
        0b0000111111000000,
        0b0001111111100000,
        0b0011111111110000,
        0b0111111111111000,
        0b0111111111111000,
        0b1111111111111100,
        0b0111111111111000,
        0b0011111111110000,
        0b0001111111100000,
        0b0000001100000000,
        0b0000001100000000,
        0b0000001100000000,
        0b0000001100000000,
        0b0000011110000000,
    ],
    door: [
        0b1111111111111100,
        0b1100000000001100,
        0b1100000000001100,
        0b1100011111001100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110101101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1100110001101100,
        0b1111111111111100,
    ],
    water: [
        0b0000000000000000,
        0b0000000000000000,
        0b0000000000000000,
        0b0100100100100100,
        0b1011011011011010,
        0b0100100100100100,
        0b0000000000000000,
        0b0000000000000000,
        0b0000000000000000,
        0b0000000000000000,
        0b0010010010010010,
        0b0101101101101100,
        0b0010010010010010,
        0b0000000000000000,
        0b0000000000000000,
        0b0000000000000000,
    ],
    fence: [
        0b0100010001000100,
        0b0100010001000100,
        0b1111111111111110,
        0b0100010001000100,
        0b0100010001000100,
        0b0100010001000100,
        0b0100010001000100,
        0b1111111111111110,
        0b0100010001000100,
        0b0100010001000100,
        0b0100010001000100,
        0b0100010001000100,
        0b1111111111111110,
        0b0100010001000100,
        0b0100010001000100,
        0b0100010001000100,
    ],
};

const MONSTER_SPRITE_MAP = {
    ticket_guard: 'guard',
    baby_elephant: 'elephant',
    angry_elephant: 'elephant',
    parrot: 'bird',
    peacock: 'bird',
    phoenix: 'fire',
};

const PIXEL_CHAR_COLORS = {
    player: '#e8d44d',
    ticket_seller: '#e87090',
    zookeeper: '#60b0e0',
    bird_keeper: '#c0a060',
    ticket_guard: '#e0a030',
    baby_elephant: '#a0a8b0',
    angry_elephant: '#707880',
    parrot: '#40c840',
    peacock: '#4080e0',
    phoenix: '#e04040',
};

function drawPixelSprite(ctx, spriteKey, x, y, size, color) {
    const sprite = SPRITES_16[spriteKey];
    if (!sprite) return;
    const px = size / 16;
    for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 16; col++) {
            if (sprite[row] & (1 << (15 - col))) {
                ctx.fillStyle = color;
                ctx.fillRect(x + col * px, y + row * px, Math.ceil(px), Math.ceil(px));
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
    if (tileType === 6) {
        ctx.fillStyle = pal.bg;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'tree', x, y, size, pal.dark);
        return true;
    }
    if (tileType === 4) {
        ctx.fillStyle = pal.mid;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'water', x, y, size, pal.dark);
        return true;
    }
    if (tileType === 7) {
        ctx.fillStyle = pal.bg;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'fence', x, y, size, pal.dark);
        return true;
    }
    if (tileType === 5) {
        ctx.fillStyle = pal.light;
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'door', x, y, size, pal.dark);
        return true;
    }
    return false;
}

function getPixelTilePattern(ctx, tileType, x, y, size) {
    if (tileType === 6) {
        ctx.fillStyle = TILE_COLORS.pixel[3];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'tree', x, y, size, '#1a5a1a');
        return true;
    }
    if (tileType === 4) {
        ctx.fillStyle = TILE_COLORS.pixel[4];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'water', x, y, size, '#2060a0');
        return true;
    }
    if (tileType === 7) {
        ctx.fillStyle = TILE_COLORS.pixel[3];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'fence', x, y, size, '#5a4030');
        return true;
    }
    if (tileType === 5) {
        ctx.fillStyle = TILE_COLORS.pixel[2];
        ctx.fillRect(x, y, size, size);
        drawPixelSprite(ctx, 'door', x, y, size, '#a06020');
        return true;
    }
    return false;
}
