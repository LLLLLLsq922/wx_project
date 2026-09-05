'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var sichuan = require('../rules/sichuan/engine.js');
var ruleEngines = require('../rules/index.js');

function standardHand() {
    return [
        'm1', 'm2', 'm3',
        'm3', 'm4', 'm5',
        's2', 's3', 's4',
        's6', 's7', 's8',
        'm5', 'm5'
    ];
}

function inputFor(tiles, extra) {
    var input = {
        concealedTiles: tiles,
        context: { winTile: tiles[tiles.length - 1], dingqueSuit: 'p' }
    };
    Object.keys(extra || {}).forEach(function (key) { input[key] = extra[key]; });
    return input;
}

function errorCodes(result) {
    return result.errors.map(function (error) { return error.code; });
}

test('川麻规则目录公开基础番种和可配置番种', function () {
    assert.equal(ruleEngines.requireEngine('sichuan'), sichuan);
    var catalog = sichuan.getRuleCatalog();
    assert.equal(catalog.length, 25);
    assert.equal(catalog.find(function (item) { return item.id === 'pinghu'; }).fan, 0);
    assert.equal(catalog.find(function (item) { return item.id === 'gen'; }).repeatable, true);
    assert.equal(catalog.find(function (item) { return item.id === 'shibaluohan'; }).enabled, true);
    assert.equal(sichuan.getRuleCatalog({ shibaluohanEnabled: false })
        .find(function (item) { return item.id === 'shibaluohan'; }).enabled, false);
    assert.equal(sichuan.getRuleCatalog({ eventFansEnabled: false })
        .find(function (item) { return item.id === 'qiangganghu'; }).enabled, false);
});

test('川麻接受108张版本的标准胡牌并以平胡0番返回', function () {
    var validation = sichuan.validateInput(inputFor(standardHand()));
    assert.equal(validation.valid, true);

    var result = sichuan.calculateWin(inputFor(standardHand(), {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.equal(result.canWin, true);
    assert.equal(result.isWinningShape, true);
    assert.equal(result.totalFan, 0);
    assert.deepEqual(result.fanList, [{ name: '平胡', fan: 0 }]);
});

test('川麻拒绝字牌、赤牌和吃牌', function () {
    var honorHand = standardHand();
    honorHand[12] = 'east';
    honorHand[13] = 'east';
    var honor = sichuan.validateInput(inputFor(honorHand));
    assert.ok(errorCodes(honor).includes('INVALID_SICHUAN_TILE'));

    var redHand = standardHand();
    redHand[5] = 'm5r';
    var red = sichuan.validateInput(inputFor(redHand));
    assert.ok(errorCodes(red).includes('INVALID_SICHUAN_TILE'));

    var chi = sichuan.validateInput({
        concealedTiles: [
            'm3', 'm4', 'm5',
            's2', 's3', 's4',
            's6', 's7', 's8',
            'm5', 'm5'
        ],
        melds: [{ type: 'chi', tiles: ['m1', 'm2', 'm3'] }],
        context: { winTile: 'm5', dingqueSuit: 'p' }
    });
    assert.ok(errorCodes(chi).includes('CHI_NOT_ALLOWED'));
});

test('川麻副露仍执行碰杠牌面组成校验', function () {
    var result = sichuan.validateInput({
        concealedTiles: [
            'm3', 'm4', 'm5',
            's2', 's3', 's4',
            's6', 's7', 's8',
            'm5', 'm5'
        ],
        melds: [{ type: 'pon', tiles: ['m1', 'm1', 'm2'] }],
        context: { winTile: 'm5', dingqueSuit: 'p' }
    });
    assert.ok(errorCodes(result).includes('INVALID_MELD_TILES'));
});

test('开启定缺时必须选定缺门且胡牌前已清空该花色', function () {
    var missing = sichuan.validateInput({
        concealedTiles: standardHand(),
        context: { winTile: 'm5' }
    });
    assert.ok(errorCodes(missing).includes('MISSING_DINGQUE_SUIT'));

    var invalid = sichuan.validateInput(inputFor(standardHand(), {
        context: { winTile: 'm5', dingqueSuit: 'h' }
    }));
    assert.ok(errorCodes(invalid).includes('INVALID_DINGQUE_SUIT'));

    var uncleared = sichuan.validateInput(inputFor(standardHand(), {
        context: { winTile: 'm5', dingqueSuit: 'm' }
    }));
    assert.ok(errorCodes(uncleared).includes('DINGQUE_NOT_CLEARED'));

    var disabled = sichuan.validateInput({
        concealedTiles: standardHand(),
        context: { winTile: 'm5' },
        rules: { dingqueEnabled: false }
    });
    assert.equal(disabled.valid, true);
});

test('川麻识别七对并拒绝不成立的14张牌型', function () {
    var sevenPairs = [
        'm1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4', 'm4',
        's5', 's5', 's6', 's6', 's7', 's7'
    ];
    var win = sichuan.calculateWin(inputFor(sevenPairs, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.equal(win.canWin, true);
    assert.equal(win.totalFan, 2);
    assert.deepEqual(win.fanList, [{ name: '七对', fan: 2 }]);

    var invalidShape = [
        'm1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4', 'm4',
        's5', 's5', 's6', 's7', 's8', 's9'
    ];
    var notWin = sichuan.calculateWin(inputFor(invalidShape));
    assert.equal(notWin.canWin, false);
    assert.equal(notWin.reason, 'INVALID_SHAPE');
});

test('川麻对对胡、清对、金钩钓和清金钩钓执行复合与排除', function () {
    var closedPong = [
        'm1', 'm1', 'm1', 'm2', 'm2', 'm2',
        's5', 's5', 's5', 's8', 's8', 's8', 'm9', 'm9'
    ];
    var pong = sichuan.calculateWin(inputFor(closedPong, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.deepEqual(pong.fanList, [{ name: '对对胡', fan: 1 }]);

    var purePong = [
        'm1', 'm1', 'm1', 'm2', 'm2', 'm2',
        'm5', 'm5', 'm5', 'm8', 'm8', 'm8', 'm9', 'm9'
    ];
    var pure = sichuan.calculateWin(inputFor(purePong, {
        context: { winTile: 'm9', dingqueSuit: 'p' },
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.deepEqual(pure.fanList, [{ name: '清对', fan: 3 }]);

    var melds = [
        { type: 'pon', tiles: ['m1', 'm1', 'm1'] },
        { type: 'pon', tiles: ['m2', 'm2', 'm2'] },
        { type: 'pon', tiles: ['s5', 's5', 's5'] },
        { type: 'pon', tiles: ['s8', 's8', 's8'] }
    ];
    var goldenHook = sichuan.calculateWin({
        concealedTiles: ['m9', 'm9'],
        melds: melds,
        context: { winTile: 'm9', dingqueSuit: 'p' },
        rules: { menqingZhongzhangEnabled: false }
    });
    assert.deepEqual(goldenHook.fanList, [{ name: '金钩钓', fan: 1 }]);

    var pureGoldenHook = sichuan.calculateWin({
        concealedTiles: ['m9', 'm9'],
        melds: melds.map(function (meld, index) {
            var value = String(index + 1);
            return { type: 'pon', tiles: ['m' + value, 'm' + value, 'm' + value] };
        }),
        context: { winTile: 'm9', dingqueSuit: 'p' },
        rules: { menqingZhongzhangEnabled: false }
    });
    assert.deepEqual(pureGoldenHook.fanList, [{ name: '清金钩钓', fan: 3 }]);
});

test('川麻识别带幺九和将对', function () {
    var terminals = [
        'm1', 'm2', 'm3', 'm7', 'm8', 'm9',
        's1', 's1', 's1', 's9', 's9', 's9', 'm9', 'm9'
    ];
    var withTerminals = sichuan.calculateWin(inputFor(terminals, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.deepEqual(withTerminals.fanList, [{ name: '带幺九', fan: 2 }]);

    var jiang = [
        'm2', 'm2', 'm2', 'm5', 'm5', 'm5',
        's8', 's8', 's8', 's2', 's2', 's2', 'm8', 'm8'
    ];
    var mixedJiang = sichuan.calculateWin(inputFor(jiang, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.deepEqual(mixedJiang.fanList, [{ name: '将对', fan: 3 }]);
});

test('川麻龙七对包含首根且额外根继续加番', function () {
    var oneRoot = [
        'm1', 'm1', 'm1', 'm1', 'm2', 'm2', 'm3', 'm3',
        's5', 's5', 's6', 's6', 's7', 's7'
    ];
    var dragon = sichuan.calculateWin(inputFor(oneRoot, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.deepEqual(dragon.fanList, [{ name: '龙七对', fan: 3 }]);

    var twoRoots = [
        'm1', 'm1', 'm1', 'm1', 'm2', 'm2', 'm2', 'm2',
        's5', 's5', 's6', 's6', 's7', 's7'
    ];
    var doubleDragon = sichuan.calculateWin(inputFor(twoRoots, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.equal(doubleDragon.totalFan, 4);
    assert.deepEqual(doubleDragon.fanList, [
        { name: '龙七对', fan: 3 },
        { name: '根', fan: 1 }
    ]);

    var pureDragon = [
        'm1', 'm1', 'm1', 'm1', 'm2', 'm2', 'm3', 'm3',
        'm4', 'm4', 'm5', 'm5', 'm6', 'm6'
    ];
    var pure = sichuan.calculateWin(inputFor(pureDragon, {
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.equal(pure.items[0].id, 'qinglongqidui');
    assert.equal(pure.totalFan, 5);
});

test('川麻普通牌型逐根加番，十八罗汉则已包含四根', function () {
    var oneKong = sichuan.calculateWin({
        concealedTiles: [
            'm1', 'm2', 'm3', 's2', 's3', 's4',
            's6', 's7', 's8', 'm5', 'm5'
        ],
        melds: [{ type: 'openKong', tiles: ['m9', 'm9', 'm9', 'm9'] }],
        context: { winTile: 'm5', dingqueSuit: 'p' },
        rules: { menqingZhongzhangEnabled: false }
    });
    assert.equal(oneKong.totalFan, 1);
    assert.ok(oneKong.items.some(function (item) { return item.id === 'gen'; }));

    var fourKongs = ['m1', 'm2', 's3', 's4'].map(function (tileId) {
        return { type: 'openKong', tiles: [tileId, tileId, tileId, tileId] };
    });
    var luohan = sichuan.calculateWin({
        concealedTiles: ['m5', 'm5'],
        melds: fourKongs,
        context: { winTile: 'm5' },
        rules: { dingqueEnabled: false, menqingZhongzhangEnabled: false }
    });
    assert.deepEqual(luohan.fanList, [{ name: '十八罗汉', fan: 5 }]);

    var pureKongs = ['m1', 'm2', 'm3', 'm4'].map(function (tileId) {
        return { type: 'concealedKong', tiles: [tileId, tileId, tileId, tileId] };
    });
    var pureLuohan = sichuan.calculateWin({
        concealedTiles: ['m5', 'm5'],
        melds: pureKongs,
        context: { winTile: 'm5', dingqueSuit: 'p' },
        rules: { menqingZhongzhangEnabled: false }
    });
    assert.deepEqual(pureLuohan.fanList, [{ name: '清十八罗汉', fan: 7 }]);
});

test('川麻门清中张开关及事件附加番生效', function () {
    var middleHand = [
        'm2', 'm3', 'm4', 'm3', 'm4', 'm5',
        's2', 's3', 's4', 's6', 's7', 's8', 'm5', 'm5'
    ];
    var bonuses = sichuan.calculateWin(inputFor(middleHand));
    assert.equal(bonuses.totalFan, 2);
    assert.ok(bonuses.items.some(function (item) { return item.id === 'menqing'; }));
    assert.ok(bonuses.items.some(function (item) { return item.id === 'zhongzhang'; }));

    var events = sichuan.calculateWin(inputFor(standardHand(), {
        context: {
            winTile: 'm5',
            dingqueSuit: 'p',
            tianhu: true,
            gangshanghua: true
        },
        rules: { menqingZhongzhangEnabled: false }
    }));
    assert.equal(events.totalFan, 6);
    assert.ok(events.items.some(function (item) { return item.id === 'tianhu'; }));
    assert.ok(events.items.some(function (item) { return item.id === 'gangshanghua'; }));

    var disabled = sichuan.calculateWin(inputFor(standardHand(), {
        context: { winTile: 'm5', dingqueSuit: 'p', gangshanghua: true },
        rules: { menqingZhongzhangEnabled: false, eventFansEnabled: false }
    }));
    assert.equal(disabled.totalFan, 0);
});

test('川麻杠牌按一个面子计结构张数并增加实际牌数', function () {
    var result = sichuan.validateInput({
        concealedTiles: [
            'm1', 'm2', 'm3',
            's2', 's3', 's4',
            's6', 's7', 's8',
            'm5', 'm5'
        ],
        melds: [{ type: 'concealedKong', tiles: ['m9', 'm9', 'm9', 'm9'] }],
        context: { winTile: 'm5', dingqueSuit: 'p' }
    });
    assert.equal(result.valid, true);
    assert.equal(result.counts.structural, 14);
    assert.equal(result.counts.physical, 15);
    assert.equal(result.counts.kongCount, 1);
});

test('川麻听牌分析返回剩余张数并排除已见四张的牌', function () {
    var waitingTiles = standardHand().slice(0, -1);
    var waits = sichuan.analyzeWaits({
        concealedTiles: waitingTiles,
        context: { dingqueSuit: 'p' }
    });
    var fiveWan = waits.find(function (item) { return item.tileId === 'm5'; });
    assert.ok(fiveWan);
    assert.equal(fiveWan.remaining, 2);

    var exhausted = sichuan.analyzeWaits({
        concealedTiles: waitingTiles,
        visibleTiles: ['m5', 'm5'],
        context: { dingqueSuit: 'p' }
    });
    assert.equal(exhausted.some(function (item) { return item.tileId === 'm5'; }), false);
});
