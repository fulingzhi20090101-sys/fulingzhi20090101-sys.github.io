'use strict';

const ZooEngine = (() => {
    const _assets = {};
    const _sheets = {};
    let _loaded = false;

    const SPRITE_FW = 16, SPRITE_FH = 16;

    // ── Asset loading ──

    function _loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(src);
            img.src = src;
        });
    }

    async function loadAssets(basePath, onProgress) {
        const manifest = [
            ['world_tileset',  'assets/tilesets/world_tileset.png'],
            ['dungeon_tileset','assets/tilesets/dungeon_tileset.png'],
            ['hero',           'assets/characters/hero.png'],
            ['npc',            'assets/characters/npc.png'],
            ['guard',          'assets/characters/guard.png'],
            ['mage',           'assets/characters/mage.png'],
            ['monster_slime',  'assets/characters/monster_slime.png'],
            ['monster_bat',    'assets/characters/monster_bat.png'],
            ['monster_boss',   'assets/characters/monster_boss.png'],
        ];
        let done = 0;
        for (const [key, src] of manifest) {
            try {
                _assets[key] = await _loadImage(basePath + src);
            } catch (e) {
                console.warn('Failed to load:', key);
            }
            done++;
            if (onProgress) onProgress(done, manifest.length);
        }
        _initSheets();
        _loaded = true;
    }

    function _initSheets() {
        for (const key in _assets) {
            _sheets[key] = {
                img: _assets[key],
                fw: SPRITE_FW,
                fh: SPRITE_FH,
                cols: Math.floor(_assets[key].width / SPRITE_FW),
            };
        }
    }

    function _drawFrame(ctx, sheetKey, frameId, dx, dy, dw, dh) {
        const s = _sheets[sheetKey];
        if (!s) return;
        const col = frameId % s.cols;
        const row = Math.floor(frameId / s.cols);
        ctx.drawImage(s.img, col * s.fw, row * s.fh, s.fw, s.fh,
            dx, dy, dw || s.fw, dh || s.fh);
    }

    // ── Tile mapping ──
    // Game tile type → { base: tilesetId, overlay?: tilesetId }
    // base -1 = dark fill, -2 = custom water render

    // base: tileset ID, -1=dark fill, -2=water, -3=door, -4=fence
    const TILE_LAYERS = {
        0: { base: -1 },
        1: { base: 48 },
        2: { base: 13 },
        3: { base: 0 },
        4: { base: -2 },
        5: { base: -3 },
        6: { base: 0, overlay: 6 },
        7: { base: -4 },
        8: { base: 25 },
    };

    // ── Character sprite mapping ──
    // Maps game character/monster IDs to sprite sheet keys
    const CHAR_MAP = {
        player:         'hero',
        ticket_seller:  'npc',
        zookeeper:      'npc',
        bird_keeper:    'mage',
        ticket_guard:   'guard',
        baby_elephant:  'monster_slime',
        angry_elephant: 'monster_boss',
        parrot:         'monster_bat',
        peacock:        'monster_bat',
        phoenix:        'monster_boss',
    };

    // Walk sprite sheet layout (3 cols × 4 rows, each 16×16):
    // Row 0: Down  (0=idle, 1=walk1, 2=walk2)
    // Row 1: Left  (3=idle, 4=walk1, 5=walk2)
    // Row 2: Right (6=idle, 7=walk1, 8=walk2)
    // Row 3: Up    (9=idle, 10=walk1, 11=walk2)
    const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };

    function _charFrame(facing, isWalking, walkFrame) {
        const row = DIR_ROW[facing] || 0;
        const col = isWalking ? (1 + (walkFrame % 2)) : 0;
        return row * 3 + col;
    }

    // ── Custom tile rendering ──

    let _waterPhase = 0;

    function _drawCustom(ctx, type, x, y, ts) {
        if (type === -2) {
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#3498db';
            const phase = Math.floor(_waterPhase) % 4;
            for (let r = 0; r < ts; r += 4) {
                const shift = ((Math.floor(r / 4) + phase) % 2) * 2;
                ctx.fillRect(x + shift, y + r, ts - 4, 2);
            }
        } else if (type === -3) {
            ctx.fillStyle = '#c0956c';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#8b6914';
            ctx.fillRect(x + 3, y + 1, ts - 6, ts - 2);
            ctx.fillStyle = '#a07828';
            ctx.fillRect(x + 4, y + 2, ts - 8, ts - 4);
            ctx.fillStyle = '#f0d080';
            ctx.fillRect(x + 6, y + 5, 4, 3);
        } else if (type === -4) {
            ctx.fillStyle = '#84c669';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#6d4c30';
            ctx.fillRect(x, y + 4, ts, 3);
            ctx.fillRect(x, y + 10, ts, 3);
            ctx.fillStyle = '#8b6240';
            ctx.fillRect(x + 2, y + 1, 2, ts - 2);
            ctx.fillRect(x + ts - 4, y + 1, 2, ts - 2);
        }
    }

    // ── Retro green filter (文曲星 4-shade palette) ──

    const RETRO_PALETTE = [
        [15, 56, 15],
        [48, 98, 48],
        [139, 172, 15],
        [155, 188, 15],
    ];

    function applyRetroFilter(ctx, w, h) {
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            const shade = lum < 64 ? 0 : lum < 128 ? 1 : lum < 192 ? 2 : 3;
            d[i]     = RETRO_PALETTE[shade][0];
            d[i + 1] = RETRO_PALETTE[shade][1];
            d[i + 2] = RETRO_PALETTE[shade][2];
        }
        ctx.putImageData(id, 0, 0);
    }

    // ── World rendering ──

    function renderWorld(ctx, map, mapState, player, otherPlayers, camX, camY, viewW, viewH, theme) {
        if (!_loaded || !_sheets.world_tileset) return false;

        const ts = 16;
        const offX = Math.floor(viewW / 2 - camX);
        const offY = Math.floor(viewH / 2 - camY);

        _waterPhase += 0.02;

        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, viewW, viewH);

        // Layer 1: Base ground
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tile = map.tiles[y * map.width + x];
                const sx = offX + x * ts, sy = offY + y * ts;
                if (sx > viewW || sy > viewH || sx + ts < 0 || sy + ts < 0) continue;

                const m = TILE_LAYERS[tile];
                if (!m) continue;

                if (m.base === -1) {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(sx, sy, ts, ts);
                } else if (m.base < 0) {
                    _drawCustom(ctx, m.base, sx, sy, ts);
                } else {
                    _drawFrame(ctx, 'world_tileset', m.base, sx, sy, ts, ts);
                }
            }
        }

        // Layer 2: Overlays (trees, fences, doors on tiles)
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tile = map.tiles[y * map.width + x];
                const m = TILE_LAYERS[tile];
                if (!m || m.overlay === undefined) continue;
                const sx = offX + x * ts, sy = offY + y * ts;
                if (sx > viewW || sy > viewH || sx + ts < 0 || sy + ts < 0) continue;
                _drawFrame(ctx, 'world_tileset', m.overlay, sx, sy, ts, ts);
            }
        }

        // Layer 3: Exit markers
        if (map.exits) {
            for (const ex of map.exits) {
                const sx = offX + ex.x * ts, sy = offY + ex.y * ts;
                _drawCustom(ctx, -3, sx, sy, ts);
            }
        }

        // Layer 4: Entities with Y-sorting
        const entities = [];
        const now = Date.now();

        if (map.npcs) {
            for (const n of map.npcs) {
                entities.push({ key: n.id, x: n.x, y: n.y, facing: 'down', walking: false, wf: 0 });
            }
        }

        if (mapState.bosses) {
            for (const b of mapState.bosses) {
                if (!b.defeated) {
                    entities.push({ key: b.monsterId, x: b.x, y: b.y, facing: 'down', walking: false, wf: 0 });
                }
            }
        }

        for (const id in otherPlayers) {
            const op = otherPlayers[id];
            entities.push({ key: 'player', x: op.x, y: op.y, facing: 'down', walking: false, wf: 0 });
        }

        const pWalking = (now - (player._lastMoveTime || 0)) < 250;
        entities.push({
            key: 'player', x: player.x, y: player.y,
            facing: player.facing, walking: pWalking, wf: player.walkFrame,
        });

        entities.sort((a, b) => a.y - b.y);

        for (const ent of entities) {
            const sx = offX + ent.x * ts;
            const sy = offY + ent.y * ts;
            const sheetKey = CHAR_MAP[ent.key] || 'npc';
            if (!_sheets[sheetKey]) continue;
            const fid = _charFrame(ent.facing, ent.walking, ent.wf);
            _drawFrame(ctx, sheetKey, fid, sx, sy, ts, ts);
        }

        // Apply retro green filter
        if (theme === 'retro') {
            applyRetroFilter(ctx, viewW, viewH);
        }

        return true;
    }

    // ── Battle sprite drawing ──

    function drawBattleSprite(ctx, monsterId, x, y, scale) {
        const sheetKey = CHAR_MAP[monsterId] || 'monster_boss';
        if (!_sheets[sheetKey]) return;
        const w = SPRITE_FW * scale, h = SPRITE_FH * scale;
        _drawFrame(ctx, sheetKey, 0, x - w / 2, y - h / 2, w, h);
    }

    return {
        loadAssets,
        renderWorld,
        drawBattleSprite,
        applyRetroFilter,
        isLoaded: () => _loaded,
        CHAR_MAP,
    };
})();
