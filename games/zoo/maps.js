const TILE = {
    EMPTY: 0,
    WALL: 1,
    PATH: 2,
    GRASS: 3,
    WATER: 4,
    DOOR: 5,
    TREE: 6,
    FENCE: 7,
    FLOOR: 8,
};

const TILE_RENDER = {
    [TILE.EMPTY]: { bg: '#2d2d2d', char: '' },
    [TILE.WALL]:  { bg: '#5d4037', char: '' },
    [TILE.PATH]:  { bg: '#d4a574', char: '' },
    [TILE.GRASS]: { bg: '#4caf50', char: '' },
    [TILE.WATER]: { bg: '#2196f3', char: '~' },
    [TILE.DOOR]:  { bg: '#ff9800', char: '🚪' },
    [TILE.TREE]:  { bg: '#388e3c', char: '🌳' },
    [TILE.FENCE]: { bg: '#8d6e63', char: '┃' },
    [TILE.FLOOR]: { bg: '#bcaaa4', char: '' },
};

const W = TILE.WALL, P = TILE.PATH, G = TILE.GRASS, A = TILE.WATER,
      D = TILE.DOOR, T = TILE.TREE, F = TILE.FENCE, L = TILE.FLOOR, E = TILE.EMPTY;

const MAPS = {
    ticket_office: {
        name: '售票处',
        width: 16,
        height: 12,
        tiles: [
            T,T,T,T,T,T,T,P,T,T,T,T,T,T,T,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,W,W,W,W,D,W,W,W,W,G,G,G,T,
            T,G,G,W,L,L,L,L,L,L,L,W,G,G,G,T,
            T,G,G,W,L,L,L,L,L,L,L,W,G,G,G,T,
            T,G,G,W,W,W,W,D,W,W,W,W,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,T,T,T,T,T,T,D,T,T,T,T,T,T,T,T,
        ],
        playerStart: { x: 7, y: 10 },
        npcs: [
            { id: 'ticket_seller', x: 5, y: 5 },
            { id: 'vending_machine', x: 10, y: 5 },
        ],
        encounters: [],
        bosses: [
            { monsterId: 'ticket_guard', x: 7, y: 8, defeated: false },
        ],
        exits: [
            { x: 7, y: 0, toMap: 'elephant_house', toX: 7, toY: 11, label: '→ 大象馆', requireTicket: true },
        ],
        enterMsg: '你来到了动物园的售票处。一座小木屋坐落在入口旁。',
    },

    elephant_house: {
        name: '大象馆',
        width: 16,
        height: 14,
        tiles: [
            T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,
            T,G,G,G,G,F,G,G,G,G,F,G,G,G,G,T,
            T,G,G,G,G,F,G,A,G,G,F,G,G,G,G,T,
            T,G,G,G,G,F,G,A,A,G,F,G,G,G,G,T,
            T,F,F,F,F,F,P,P,P,P,F,F,F,F,F,T,
            T,G,G,G,G,G,P,P,P,P,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,P,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,P,G,G,G,P,P,P,
            T,F,F,F,F,F,P,P,P,P,F,F,F,F,F,T,
            T,G,G,G,A,A,P,P,P,P,G,G,G,G,G,T,
            T,G,G,G,A,G,P,P,P,P,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,P,G,G,G,G,G,T,
            T,T,T,T,T,T,T,D,T,T,T,T,T,T,T,T,
            E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,
        ],
        playerStart: { x: 7, y: 10 },
        npcs: [
            { id: 'zookeeper', x: 8, y: 6 },
            { id: 'vending_machine', x: 3, y: 6 },
            { id: 'ice_cream_cart', x: 12, y: 6 },
        ],
        encounters: [],
        bosses: [
            { monsterId: 'angry_elephant', x: 7, y: 2, defeated: false },
        ],
        exits: [
            { x: 7, y: 12, toMap: 'ticket_office', toX: 7, toY: 1, label: '→ 售票处' },
            { x: 15, y: 7, toMap: 'bird_garden', toX: 1, toY: 6, label: '→ 百鸟园' },
        ],
        enterMsg: '大象馆里弥漫着泥土和青草的气息。远处传来大象的叫声。',
    },

    bird_garden: {
        name: '百鸟园',
        width: 16,
        height: 14,
        tiles: [
            T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,
            T,G,G,T,G,G,G,P,G,G,G,T,G,G,G,T,
            T,G,G,G,G,G,G,P,G,G,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,G,G,P,P,G,P,P,G,G,G,G,G,T,
            T,G,G,G,P,P,G,G,G,P,P,G,G,G,G,T,
            P,P,P,P,P,G,G,G,G,G,P,P,P,P,P,T,
            T,G,G,G,P,P,G,G,G,P,P,G,G,G,G,T,
            T,G,G,G,G,P,P,G,P,P,G,G,G,G,G,T,
            T,G,G,G,G,G,P,P,P,G,G,G,G,G,G,T,
            T,G,G,G,G,G,G,P,G,G,G,G,G,G,G,T,
            T,G,G,T,G,G,G,P,G,G,G,T,G,G,G,T,
            T,G,G,G,G,G,G,P,G,G,G,G,G,G,G,T,
            T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,
        ],
        playerStart: { x: 1, y: 6 },
        npcs: [
            { id: 'bird_keeper', x: 7, y: 7 },
            { id: 'vending_machine', x: 11, y: 4 },
        ],
        encounters: [],
        bosses: [
            { monsterId: 'phoenix', x: 7, y: 1, defeated: false },
        ],
        exits: [
            { x: 0, y: 6, toMap: 'elephant_house', toX: 14, toY: 7, label: '→ 大象馆' },
        ],
        enterMsg: '百鸟园中鸟语花香，各种珍禽在枝头鸣唱。',
    },
};
