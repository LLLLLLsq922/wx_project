'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

// 核心模块保留了面向微信开发者工具的详细日志；测试只关心断言结果。
console.log = function () {};

var mahjongUtil = require('../util/mahjongUtil.js');

function tile(name) {
    var value = parseInt(name, 10);
    var isNumberTile = !isNaN(value);
    return {
        id: name,
        name: name,
        type: isNumberTile ? name.charAt(1) : '字',
        value: isNumberTile ? value : name,
        image: ''
    };
}

function tiles(names) {
    return names.map(tile);
}

function group(type, names) {
    return { type: type, cards: tiles(names) };
}

function calculate(names, options, groups) {
    options = options || {};
    if (options.roundWind === undefined) options.roundWind = 0;
    if (options.seatWind === undefined) options.seatWind = 0;
    return mahjongUtil.calculateHu(tiles(names), groups || [], options);
}

function fanNames(result) {
    return result.fanList.map(function (item) { return item.name; });
}

function assertHasFan(result, name, fan) {
    var item = result.fanList.find(function (candidate) {
        return candidate.name === name;
    });
    assert.ok(item, '应计入番种：' + name);
    if (fan !== undefined) assert.equal(item.fan, fan);
}

function assertNotHasFan(result, name) {
    assert.equal(fanNames(result).includes(name), false, '不应重复计入番种：' + name);
}

var lowFanHand = [
    '1万', '2万', '3万',
    '3万', '4万', '5万',
    '2条', '3条', '4条',
    '6筒', '7筒', '8筒',
    '5条', '5条'
];

test('非胡牌结构返回 INVALID_SHAPE', function () {
    var result = calculate([
        '1万', '1万', '2万', '3万', '4万', '5万', '6万',
        '7万', '8万', '9万', '东', '南', '中', '白'
    ], { winTile: '白' });

    assert.equal(result.canHu, false);
    assert.equal(result.isHuShape, false);
    assert.equal(result.reason, 'INVALID_SHAPE');
});

test('结构成立但不足8番时不能合法和牌，并保留番数明细', function () {
    var result = calculate(lowFanHand, { winTile: '5条' });

    assert.equal(result.isHuShape, true);
    assert.equal(result.canHu, false);
    assert.equal(result.reason, 'LESS_THAN_8_FAN');
    assert.equal(result.totalFan, 4);
    assert.deepEqual(fanNames(result), ['门前清', '平和']);
});

test('无任何其他番种的标准牌型按无番和计8番', function () {
    var groups = [
        group('吃', ['1万', '2万', '3万']),
        group('吃', ['5万', '6万', '7万']),
        group('吃', ['6筒', '7筒', '8筒'])
    ];
    var result = calculate(
        ['2条', '3条', '4条', '东', '东'],
        { roundWind: 1, seatWind: 2, winTile: '4条' },
        groups
    );

    assert.equal(result.canHu, true);
    assert.equal(result.totalFan, 8);
    assert.deepEqual(result.fanList, [{ name: '无番和', fan: 8 }]);
});

test('十三幺能识别，且排除门前清、单钓将和自摸', function () {
    var result = calculate([
        '1万', '9万', '1条', '9条', '1筒', '9筒',
        '东', '南', '西', '北', '中', '发', '白', '东'
    ], { zimo: true, winTile: '东' });

    assert.equal(result.canHu, true);
    assert.equal(result.pattern, '十三幺');
    assertHasFan(result, '十三幺', 88);
    assertNotHasFan(result, '门前清');
    assertNotHasFan(result, '单钓将');
    assertNotHasFan(result, '自摸');
});

test('七对能识别，且不重复计算门前清、单钓将和自摸', function () {
    var result = calculate([
        '1万', '1万', '2万', '2万', '4条', '4条', '6条',
        '6条', '3筒', '3筒', '8筒', '8筒', '东', '东'
    ], { zimo: true, winTile: '东' });

    assert.equal(result.canHu, true);
    assert.equal(result.pattern, '七对');
    assertHasFan(result, '七对', 24);
    assertNotHasFan(result, '门前清');
    assertNotHasFan(result, '单钓将');
    assertNotHasFan(result, '自摸');
});

test('七星不靠按组合龙骨架识别为24番', function () {
    var result = calculate([
        '1万', '4万', '7万',
        '2条', '5条',
        '3筒', '6筒',
        '东', '南', '西', '北', '中', '发', '白'
    ], { winTile: '白' });

    assert.equal(result.canHu, true);
    assert.equal(result.pattern, '七星不靠');
    assertHasFan(result, '七星不靠', 24);
    assertNotHasFan(result, '全不靠');
    assertNotHasFan(result, '五门齐');
    assertNotHasFan(result, '门前清');
});

test('全不靠允许从16张合法骨架中任选14张单张', function () {
    var result = calculate([
        '1万', '4万', '7万',
        '2条', '5条', '8条',
        '3筒', '6筒', '9筒',
        '东', '南', '西', '北', '中'
    ], { winTile: '中' });

    assert.equal(result.canHu, true);
    assert.equal(result.pattern, '全不靠');
    assertHasFan(result, '全不靠', 12);
    assertNotHasFan(result, '七星不靠');
});

test('不符合任一147、258、369三色骨架时不能误判全不靠', function () {
    var result = calculate([
        '1万', '2万', '3万', '4万', '5万', '6万', '7万',
        '东', '南', '西', '北', '中', '发', '白'
    ], { winTile: '白' });

    assert.notEqual(result.pattern, '全不靠');
    assert.notEqual(result.pattern, '七星不靠');
});

test('全双刻计24番并排除碰碰和与断幺', function () {
    var result = calculate([
        '2万', '2万', '2万',
        '4万', '4万', '4万',
        '6条', '6条', '6条',
        '8筒', '8筒', '8筒',
        '2条', '2条'
    ], { winTile: '2条' });

    assert.equal(result.canHu, true);
    assertHasFan(result, '全双刻', 24);
    assertNotHasFan(result, '碰碰和');
    assertNotHasFan(result, '断幺');
});

test('组合龙要求147、258、369三组分别固定花色', function () {
    var valid = calculate([
        '1万', '4万', '7万',
        '2条', '5条', '8条',
        '3筒', '6筒', '9筒',
        '1筒', '1筒', '1筒',
        '东', '东'
    ], { winTile: '东' });
    assertHasFan(valid, '组合龙', 12);

    // 每组三个连续数字看似跨三门，但147、258、369均未固定花色。
    var invalid = calculate([
        '1万', '2条', '3筒',
        '4条', '5筒', '6万',
        '7筒', '8万', '9条',
        '1筒', '1筒', '1筒',
        '东', '东'
    ], { winTile: '东' });
    assertNotHasFan(invalid, '组合龙');
});

test('平和允许副露并允许顺子和将牌包含幺九数牌', function () {
    var result = calculate([
        '7万', '8万', '9万',
        '3条', '4条', '5条',
        '6筒', '7筒', '8筒',
        '1条', '1条'
    ], { winTile: '8筒' }, [
        group('吃', ['1万', '2万', '3万'])
    ]);

    assertHasFan(result, '平和', 2);
    assertNotHasFan(result, '门前清');
});

test('平和可以与断幺同时计分', function () {
    var result = calculate([
        '2万', '3万', '4万',
        '3条', '4条', '5条',
        '4筒', '5筒', '6筒',
        '6万', '7万', '8万',
        '5条', '5条'
    ], { winTile: '8万' });

    assertHasFan(result, '平和', 2);
    assertHasFan(result, '断幺', 2);
});

test('一手中的两个连六分别计分', function () {
    var result = calculate([
        '1万', '2万', '3万',
        '4万', '5万', '6万',
        '1条', '2条', '3条',
        '4条', '5条', '6条',
        '5筒', '5筒'
    ], { winTile: '6条' });

    assertHasFan(result, '连六', 2);
});

test('多个幺九刻分别计分，但箭刻和圈门风刻不重复作为幺九刻', function () {
    var threeTerminalPungs = calculate([
        '1万', '1万', '1万',
        '9条', '9条', '9条',
        '北', '北', '北',
        '2筒', '3筒', '4筒',
        '5万', '5万'
    ], { roundWind: 0, seatWind: 1, winTile: '5万' });
    assertHasFan(threeTerminalPungs, '幺九刻', 3);

    var valuePungs = calculate([
        '东', '东', '东',
        '中', '中', '中',
        '2万', '3万', '4万',
        '4条', '5条', '6条',
        '5筒', '5筒'
    ], { roundWind: 0, seatWind: 1, winTile: '5筒' });
    assertHasFan(valuePungs, '圈风刻', 2);
    assertHasFan(valuePungs, '箭刻', 2);
    assertNotHasFan(valuePungs, '幺九刻');
});

test('暗杠按国标规则计2番', function () {
    var result = calculate([
        '1万', '2万', '3万',
        '4条', '5条', '6条',
        '7筒', '8筒', '9筒',
        '5万', '5万'
    ], { winTile: '5万' }, [
        group('暗杠', ['2筒', '2筒', '2筒', '2筒'])
    ]);

    assertHasFan(result, '暗杠', 2);
});

test('一色三步高与一色四步高支持按2递增', function () {
    var three = calculate([
        '1万', '2万', '3万',
        '3万', '4万', '5万',
        '5万', '6万', '7万',
        '2条', '3条', '4条',
        '东', '东'
    ], { winTile: '东' });
    assertHasFan(three, '一色三步高', 16);

    var four = calculate([
        '1万', '2万', '3万',
        '3万', '4万', '5万',
        '5万', '6万', '7万',
        '7万', '8万', '9万',
        '东', '东'
    ], { winTile: '东' });
    assertHasFan(four, '一色四步高', 32);
});

test('全带五要求将牌也包含5', function () {
    var valid = calculate([
        '3万', '4万', '5万',
        '4条', '5条', '6条',
        '5筒', '5筒', '5筒',
        '5万', '6万', '7万',
        '5条', '5条'
    ], { winTile: '5条' });
    assertHasFan(valid, '全带五', 16);

    var invalid = calculate([
        '3万', '4万', '5万',
        '4条', '5条', '6条',
        '5筒', '5筒', '5筒',
        '5万', '6万', '7万',
        '2条', '2条'
    ], { winTile: '2条' });
    assertNotHasFan(invalid, '全带五');
});

test('不求人允许暗杠，但全求人禁止自摸', function () {
    var concealed = calculate([
        '1万', '2万', '3万',
        '4条', '5条', '6条',
        '7筒', '8筒', '9筒',
        '5万', '5万'
    ], { zimo: true, winTile: '5万' }, [
        group('暗杠', ['2筒', '2筒', '2筒', '2筒'])
    ]);
    assertHasFan(concealed, '不求人', 4);

    var exposedGroups = [
        group('吃', ['1万', '2万', '3万']),
        group('碰', ['4条', '4条', '4条']),
        group('明杠', ['5筒', '5筒', '5筒', '5筒']),
        group('吃', ['7条', '8条', '9条'])
    ];
    var ron = calculate(['东', '东'], { winTile: '东' }, exposedGroups);
    var tsumo = calculate(['东', '东'], { zimo: true, winTile: '东' }, exposedGroups);
    assertHasFan(ron, '全求人', 6);
    assertNotHasFan(tsumo, '全求人');
});

test('双暗杠计8番，事件番正确执行不计关系', function () {
    var doubleKong = calculate([
        '1万', '2万', '3万',
        '4条', '5条', '6条',
        '5筒', '5筒'
    ], { winTile: '5筒' }, [
        group('暗杠', ['7万', '7万', '7万', '7万']),
        group('暗杠', ['8条', '8条', '8条', '8条'])
    ]);
    assertHasFan(doubleKong, '双暗杠', 8);
    assertNotHasFan(doubleKong, '暗杠');

    var lastDraw = calculate(lowFanHand, {
        zimo: true,
        miaoshouhuichun: true,
        winTile: '5条'
    });
    assertHasFan(lastDraw, '妙手回春', 8);
    assertNotHasFan(lastDraw, '自摸');

    var robbingKong = calculate(lowFanHand, {
        qiangganghu: true,
        juezhang: true,
        winTile: '5条'
    });
    assertHasFan(robbingKong, '抢杠和', 8);
    assertNotHasFan(robbingKong, '和绝张');
});

test('推不倒只接受规则指定的筒条牌和白板', function () {
    var valid = calculate([
        '1筒', '2筒', '3筒',
        '2筒', '3筒', '4筒',
        '4条', '5条', '6条',
        '8条', '8条', '8条',
        '白', '白'
    ], { winTile: '白' });
    assertHasFan(valid, '推不倒', 8);

    var invalidBamboo = calculate([
        '1筒', '2筒', '3筒',
        '2筒', '3筒', '4筒',
        '4条', '5条', '6条',
        '1条', '1条', '1条',
        '白', '白'
    ], { winTile: '白' });
    assertNotHasFan(invalidBamboo, '推不倒');

    var invalidHonor = calculate([
        '1筒', '2筒', '3筒',
        '2筒', '3筒', '4筒',
        '4条', '5条', '6条',
        '发', '发', '发',
        '白', '白'
    ], { winTile: '白' });
    assertNotHasFan(invalidHonor, '推不倒');
});

test('一般高、喜相逢和双同刻可在不同组合中分别重复计分', function () {
    var twoPureDoubleChows = calculate([
        '4条', '5条', '6条',
        '4条', '5条', '6条',
        '9筒', '9筒'
    ], { winTile: '9筒' }, [
        group('吃', ['1万', '2万', '3万']),
        group('吃', ['1万', '2万', '3万'])
    ]);
    assertHasFan(twoPureDoubleChows, '一般高', 2);

    var twoMixedDoubleChows = calculate([
        '1万', '2万', '3万',
        '1条', '2条', '3条',
        '4万', '5万', '6万',
        '4条', '5条', '6条',
        '9筒', '9筒'
    ], { winTile: '9筒' });
    assertHasFan(twoMixedDoubleChows, '喜相逢', 2);

    var twoDoublePungs = calculate([
        '2条', '2条', '2条',
        '白', '白'
    ], { winTile: '白' }, [
        group('碰', ['1万', '1万', '1万']),
        group('碰', ['1条', '1条', '1条']),
        group('碰', ['2万', '2万', '2万'])
    ]);
    assertHasFan(twoDoublePungs, '碰碰和', 6);
    assertHasFan(twoDoublePungs, '双同刻', 4);
});

test('清一色排除缺一门和无字', function () {
    var result = calculate([
        '1万', '1万', '1万',
        '2万', '3万', '4万',
        '5万', '6万', '7万',
        '7万', '8万', '9万',
        '5万', '5万'
    ], { winTile: '9万' });

    assertHasFan(result, '清一色', 24);
    assertNotHasFan(result, '缺一门');
    assertNotHasFan(result, '无字');
});

test('不求人排除门前清和自摸', function () {
    var result = calculate(lowFanHand, { zimo: true, winTile: '5条' });

    assertHasFan(result, '不求人', 4);
    assertNotHasFan(result, '门前清');
    assertNotHasFan(result, '自摸');
});

test('边张只在12和3、89和7时成立', function () {
    var hand = [
        '1万', '2万', '3万',
        '4万', '5万', '6万',
        '2条', '3条', '4条',
        '6筒', '7筒', '8筒',
        '5条', '5条'
    ];
    var edgeWait = calculate(hand, { winTile: '3万' });
    var notEdgeWait = calculate(hand, { winTile: '1万' });

    assertHasFan(edgeWait, '边张', 1);
    assertNotHasFan(notEdgeWait, '边张');
});

test('坎张只在胡顺子中间张时成立', function () {
    var middleWait = calculate(lowFanHand, { winTile: '4万' });
    var sideWait = calculate(lowFanHand, { winTile: '5万' });

    assertHasFan(middleWait, '坎张', 1);
    assertNotHasFan(sideWait, '坎张');
});

test('单钓将只在胡牌张作为将牌时成立', function () {
    var pairWait = calculate([
        '1万', '2万', '3万',
        '3万', '4万', '5万',
        '2条', '3条', '4条',
        '6筒', '7筒', '8筒',
        '东', '东'
    ], { winTile: '东' });
    var sequenceWait = calculate(lowFanHand, { winTile: '5万' });

    assertHasFan(pairWait, '单钓将', 1);
    assertNotHasFan(sequenceWait, '单钓将');
});

test('存在多种可和牌时不计边张、坎张或单钓将', function () {
    var result = calculate([
        '1万', '2万', '3万',
        '3万', '4万', '5万',
        '6万', '7万', '8万',
        '2条', '3条', '4条',
        '5条', '5条'
    ], { winTile: '3万' });

    // 移除和牌张3万后，1万与4万均可完成结构，并非“只能”边张和牌。
    assertNotHasFan(result, '边张');
    assertNotHasFan(result, '坎张');
    assertNotHasFan(result, '单钓将');
});

test('荣和牌完成的刻子不计暗刻，自摸完成则仍计暗刻', function () {
    var names = [
        '1万', '1万', '1万',
        '2条', '2条', '2条',
        '3筒', '3筒', '3筒',
        '4万', '5万', '6万',
        '7条', '7条'
    ];
    var ron = calculate(names, { winTile: '1万' });
    var tsumo = calculate(names, { zimo: true, winTile: '1万' });

    assertNotHasFan(ron, '三暗刻');
    assertHasFan(ron, '双暗刻', 2);
    assertHasFan(tsumo, '三暗刻', 16);
});
