'use strict';

const RIDDLES = [
    // ── Singapore Food ──
    {
        id: 'r001',
        riddle: '白白胖胖一碗饭，椰香扑鼻配小鱼，马来朋友最爱吃。',
        options: [
            { zh: '椰浆饭', en: 'Nasi Lemak' },
            { zh: '鸡饭', en: 'Chicken Rice' },
            { zh: '炒饭', en: 'Fried Rice' },
            { zh: '咖喱饭', en: 'Curry Rice' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r002',
        riddle: '鸡肉嫩滑米饭香，一盘端上人人抢，新加坡的国民菜。',
        options: [
            { zh: '鸡饭', en: 'Chicken Rice' },
            { zh: '烧鸭饭', en: 'Roast Duck Rice' },
            { zh: '卤肉饭', en: 'Braised Pork Rice' },
            { zh: '叉烧饭', en: 'Char Siu Rice' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r003',
        riddle: '红红汤底辣又香，椰奶虾米配米粉，喝一口就忘不了。',
        options: [
            { zh: '叻沙', en: 'Laksa' },
            { zh: '冬阴功', en: 'Tom Yum' },
            { zh: '麻辣烫', en: 'Mala Tang' },
            { zh: '酸辣粉', en: 'Hot & Sour Noodles' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r004',
        riddle: '薄薄面皮包着馅，蒸笼里面排排站，早茶桌上少不了。',
        options: [
            { zh: '烧卖', en: 'Siew Mai' },
            { zh: '饺子', en: 'Dumpling' },
            { zh: '包子', en: 'Steamed Bun' },
            { zh: '春卷', en: 'Spring Roll' }
        ],
        answer: 0,
        reward: 20
    },
    {
        id: 'r005',
        riddle: '圆圆扁扁一块饼，煎得两面金黄黄，蘸着咖喱最好吃。',
        options: [
            { zh: '印度煎饼', en: 'Roti Prata' },
            { zh: '葱油饼', en: 'Scallion Pancake' },
            { zh: '煎饼果子', en: 'Jianbing' },
            { zh: '比萨饼', en: 'Pizza' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r006',
        riddle: '绿绿叶子包着米，三角形状好可爱，端午节日必须吃。',
        options: [
            { zh: '粽子', en: 'Rice Dumpling' },
            { zh: '饭团', en: 'Rice Ball' },
            { zh: '寿司', en: 'Sushi' },
            { zh: '春卷', en: 'Spring Roll' }
        ],
        answer: 0,
        reward: 20
    },
    {
        id: 'r007',
        riddle: '冰冰凉凉一碗甜，红豆绿豆加仙草，热天吃了最舒服。',
        options: [
            { zh: '冰淇淋', en: 'Ice Cream' },
            { zh: '红豆冰', en: 'Ice Kachang' },
            { zh: '果冻', en: 'Jelly' },
            { zh: '奶茶', en: 'Milk Tea' }
        ],
        answer: 1,
        reward: 30
    },
    {
        id: 'r008',
        riddle: '黑黑甜甜一碗汤，加了姜糖暖肚子，软软滑滑像珍珠。',
        options: [
            { zh: '芝麻糊', en: 'Sesame Paste' },
            { zh: '汤圆', en: 'Tang Yuan' },
            { zh: '龟苓膏', en: 'Gui Ling Gao' },
            { zh: '豆花', en: 'Tofu Pudding' }
        ],
        answer: 1,
        reward: 30
    },
    {
        id: 'r009',
        riddle: '又扁又长像丝带，炒了之后滑溜溜，大排档里最常见。',
        options: [
            { zh: '意大利面', en: 'Pasta' },
            { zh: '米线', en: 'Rice Noodles' },
            { zh: '炒粿条', en: 'Char Kway Teow' },
            { zh: '拉面', en: 'Ramen' }
        ],
        answer: 2,
        reward: 30
    },
    {
        id: 'r010',
        riddle: '圆圆小丸一串串，竹签穿着蘸甜酱，放学路上好零食。',
        options: [
            { zh: '沙爹', en: 'Satay' },
            { zh: '鱼丸', en: 'Fishball' },
            { zh: '糖葫芦', en: 'Tanghulu' },
            { zh: '关东煮', en: 'Oden' }
        ],
        answer: 1,
        reward: 20
    },
    {
        id: 'r011',
        riddle: '肉串烤得香喷喷，花生酱汁蘸一蘸，马来夜市最受欢迎。',
        options: [
            { zh: '沙爹', en: 'Satay' },
            { zh: '烤肉', en: 'BBQ' },
            { zh: '羊肉串', en: 'Lamb Skewer' },
            { zh: '鸡翅', en: 'Chicken Wing' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r012',
        riddle: '软软白白一块糕，椰丝铺面甜蜜蜜，绿色红色好漂亮。',
        options: [
            { zh: '娘惹糕', en: 'Kueh' },
            { zh: '蛋糕', en: 'Cake' },
            { zh: '月饼', en: 'Mooncake' },
            { zh: '面包', en: 'Bread' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r013',
        riddle: '半圆形状脆生生，虾仁蔬菜全包住，蘸着辣酱咬一口。',
        options: [
            { zh: '春卷', en: 'Spring Roll' },
            { zh: '薄饼', en: 'Popiah' },
            { zh: '煎饺', en: 'Pan-fried Dumpling' },
            { zh: '咖喱角', en: 'Curry Puff' }
        ],
        answer: 3,
        reward: 50
    },
    {
        id: 'r014',
        riddle: '一碗面汤鲜又甜，虾壳熬出好味道，黄色面条弯又弯。',
        options: [
            { zh: '虾面', en: 'Prawn Mee' },
            { zh: '方便面', en: 'Instant Noodles' },
            { zh: '拉面', en: 'Ramen' },
            { zh: '米线', en: 'Rice Noodles' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r015',
        riddle: '绿绿一杯甜又香，斑斓叶子是秘密，加了椰奶味道好。',
        options: [
            { zh: '抹茶拿铁', en: 'Matcha Latte' },
            { zh: '斑斓蛋糕', en: 'Pandan Cake' },
            { zh: '薄荷茶', en: 'Mint Tea' },
            { zh: '绿豆汤', en: 'Mung Bean Soup' }
        ],
        answer: 1,
        reward: 50
    },
    // ── Daily Items ──
    {
        id: 'r016',
        riddle: '下雨天的好朋友，撑开像朵大蘑菇，太阳出来收起来。',
        options: [
            { zh: '雨伞', en: 'Umbrella' },
            { zh: '帽子', en: 'Hat' },
            { zh: '雨衣', en: 'Raincoat' },
            { zh: '雨鞋', en: 'Rain Boots' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r017',
        riddle: '方方正正一个盒，装满课本和文具，每天背着上学去。',
        options: [
            { zh: '书包', en: 'School Bag' },
            { zh: '箱子', en: 'Box' },
            { zh: '抽屉', en: 'Drawer' },
            { zh: '柜子', en: 'Cabinet' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r018',
        riddle: '小小一根白棍子，早晚都要用一次，牙齿干净笑哈哈。',
        options: [
            { zh: '牙刷', en: 'Toothbrush' },
            { zh: '筷子', en: 'Chopsticks' },
            { zh: '铅笔', en: 'Pencil' },
            { zh: '棒棒糖', en: 'Lollipop' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r019',
        riddle: '透明翅膀转得快，吹出凉风好舒服，新加坡家家都有。',
        options: [
            { zh: '风扇', en: 'Fan' },
            { zh: '飞机', en: 'Airplane' },
            { zh: '蜻蜓', en: 'Dragonfly' },
            { zh: '风筝', en: 'Kite' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r020',
        riddle: '薄薄一张方方正正，可以擦汗可以擦手，叠好放进口袋里。',
        options: [
            { zh: '手帕', en: 'Handkerchief' },
            { zh: '报纸', en: 'Newspaper' },
            { zh: '地图', en: 'Map' },
            { zh: '明信片', en: 'Postcard' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r021',
        riddle: '圆圆脑袋长尾巴，写字画画全靠它，用完要削才尖尖。',
        options: [
            { zh: '铅笔', en: 'Pencil' },
            { zh: '毛笔', en: 'Brush Pen' },
            { zh: '蜡笔', en: 'Crayon' },
            { zh: '钢笔', en: 'Fountain Pen' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r022',
        riddle: '不会说话会报时，滴答滴答响不停，挂在墙上圆又圆。',
        options: [
            { zh: '时钟', en: 'Clock' },
            { zh: '日历', en: 'Calendar' },
            { zh: '画框', en: 'Picture Frame' },
            { zh: '镜子', en: 'Mirror' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r023',
        riddle: '一间小屋冷冰冰，食物住在里面不会坏，打开门来凉飕飕。',
        options: [
            { zh: '冰箱', en: 'Refrigerator' },
            { zh: '微波炉', en: 'Microwave' },
            { zh: '洗衣机', en: 'Washing Machine' },
            { zh: '烤箱', en: 'Oven' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r024',
        riddle: '两只眼睛亮晶晶，架在鼻子上面看，近的远的都看清。',
        options: [
            { zh: '眼镜', en: 'Glasses' },
            { zh: '望远镜', en: 'Telescope' },
            { zh: '放大镜', en: 'Magnifying Glass' },
            { zh: '太阳镜', en: 'Sunglasses' }
        ],
        answer: 0,
        reward: 10
    },
    {
        id: 'r025',
        riddle: '四条腿不会走路，人人吃饭要用它，上面可以摆碗筷。',
        options: [
            { zh: '桌子', en: 'Table' },
            { zh: '椅子', en: 'Chair' },
            { zh: '床', en: 'Bed' },
            { zh: '沙发', en: 'Sofa' }
        ],
        answer: 0,
        reward: 10
    },
    // ── Singapore Specific ──
    {
        id: 'r026',
        riddle: '红色身体跑得快，站站停停不堵车，地下隧道穿来穿去。',
        options: [
            { zh: '地铁', en: 'MRT' },
            { zh: '巴士', en: 'Bus' },
            { zh: '出租车', en: 'Taxi' },
            { zh: '火车', en: 'Train' }
        ],
        answer: 0,
        reward: 20
    },
    {
        id: 'r027',
        riddle: '一座花园在城市，到处都是花和树，又叫花园城市美。',
        options: [
            { zh: '新加坡', en: 'Singapore' },
            { zh: '东京', en: 'Tokyo' },
            { zh: '巴黎', en: 'Paris' },
            { zh: '伦敦', en: 'London' }
        ],
        answer: 0,
        reward: 20
    },
    {
        id: 'r028',
        riddle: '头像狮子身像鱼，站在河边吐水玩，新加坡的大明星。',
        options: [
            { zh: '鱼尾狮', en: 'Merlion' },
            { zh: '龙', en: 'Dragon' },
            { zh: '独角兽', en: 'Unicorn' },
            { zh: '麒麟', en: 'Qilin' }
        ],
        answer: 0,
        reward: 20
    },
    {
        id: 'r029',
        riddle: '小小一张薄薄纸，上面印着漂亮花，坐巴士地铁都要它。',
        options: [
            { zh: '易通卡', en: 'EZ-Link Card' },
            { zh: '身份证', en: 'ID Card' },
            { zh: '信用卡', en: 'Credit Card' },
            { zh: '邮票', en: 'Stamp' }
        ],
        answer: 0,
        reward: 30
    },
    {
        id: 'r030',
        riddle: '大大的轮子转不停，坐上去看遍全城市，晚上亮灯最好看。',
        options: [
            { zh: '摩天轮', en: 'Singapore Flyer' },
            { zh: '旋转木马', en: 'Merry-go-round' },
            { zh: '过山车', en: 'Roller Coaster' },
            { zh: '缆车', en: 'Cable Car' }
        ],
        answer: 0,
        reward: 20
    }
];
