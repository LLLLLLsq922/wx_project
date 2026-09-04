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
    assert.deepEqual(fanNames(result), ['门前清', '无字', '单钓将']);
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
    var pairWait = calculate(lowFanHand, { winTile: '5条' });
    var sequenceWait = calculate(lowFanHand, { winTile: '5万' });

    assertHasFan(pairWait, '单钓将', 1);
    assertNotHasFan(sequenceWait, '单钓将');
});
