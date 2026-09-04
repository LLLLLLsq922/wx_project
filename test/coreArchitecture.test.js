'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

console.log = function () {};

var variants = require('../core/variants.js');
var tiles = require('../core/tiles.js');
var ledger = require('../core/ledger.js');
var registry = require('../core/ruleEngineRegistry.js');
var schema = require('../data/schema.js');
var storageService = require('../services/storageService.js');
var guobiao = require('../rules/guobiao/engine.js');
var legacyGuobiao = require('../util/mahjongUtil.js');

function tile(name) {
    var value = parseInt(name, 10);
    var isNumber = !isNaN(value);
    return {
        id: name,
        name: name,
        type: isNumber ? name.charAt(1) : '字',
        value: isNumber ? value : name,
        image: ''
    };
}

function legacyTiles(names) {
    return names.map(tile);
}

test('玩法注册信息固定为三种四人玩法', function () {
    var definitions = variants.listVariants();
    assert.deepEqual(definitions.map(function (item) { return item.id; }), [
        'guobiao', 'sichuan', 'riichi'
    ]);
    definitions.forEach(function (item) { assert.equal(item.playerCount, 4); });
    assert.equal(variants.getVariant('unknown'), null);
});

test('牌目录按玩法排除字牌并为日麻加入赤五', function () {
    assert.equal(tiles.getCatalog('guobiao').length, 34);
    assert.equal(tiles.getCatalog('sichuan').length, 27);
    assert.equal(tiles.getCatalog('riichi', { redFives: 0 }).length, 34);
    assert.equal(tiles.getCatalog('riichi', { redFives: 3 }).length, 37);
});

test('规范牌ID兼容旧中文牌名，赤五与普通五共享四张上限', function () {
    assert.equal(tiles.normalizeTileId('1万'), 'm1');
    assert.equal(tiles.normalizeTileId({ name: '赤5筒' }), 'p5r');
    assert.equal(tiles.getBaseTileId('p5r'), 'p5');

    var validation = tiles.validateCopies({
        concealedTiles: ['p5', 'p5', 'p5r', 'p5r', 'p5r']
    });
    assert.equal(validation.valid, false);
    assert.deepEqual(validation.overLimit, [{ tileId: 'p5', count: 5 }]);
});

test('杠按一个结构面子计算，但实际牌数增加一张', function () {
    var counts = tiles.getHandCounts(
        ['m1', 'm2', 'm3', 's2', 's3', 's4', 'p5', 'p5', 'east', 'east', 'east'],
        [{ type: 'concealedKong', tiles: ['m9', 'm9', 'm9', 'm9'] }]
    );
    assert.equal(counts.structural, 14);
    assert.equal(counts.physical, 15);
    assert.equal(counts.kongCount, 1);
    assert.equal(counts.winningPhysicalTarget, 15);
});

test('副露类型和实际张数被统一校验', function () {
    var result = tiles.validateMelds([
        { type: 'chi', tiles: ['m1', 'm2', 'm3'] },
        { type: '暗杠', cards: legacyTiles(['东', '东', '东']) },
        { type: 'unknown', tiles: [] }
    ]);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors.map(function (item) { return item.code; }), [
        'INVALID_MELD_LENGTH', 'INVALID_MELD_TYPE'
    ]);
});

test('零和账本生成可追溯的玩家净变化', function () {
    var transactions = [{
        id: 'win-1',
        type: 'win',
        reason: '自摸',
        transfers: [
            { from: 'p2', to: 'p1', amount: 16 },
            { from: 'p3', to: 'p1', amount: 16 },
            { from: 'p4', to: 'p1', amount: 16 }
        ]
    }];
    var result = ledger.applyTransactions({ p1: 0, p2: 0, p3: 0, p4: 0 }, transactions);
    assert.deepEqual(result, { p1: 48, p2: -16, p3: -16, p4: -16 });
    assert.equal(ledger.sumBalances(result), 0);
});

test('账本拒绝未知玩家、自付和非正数金额', function () {
    assert.throws(function () {
        ledger.applyTransactions({ p1: 0, p2: 0 }, [{
            transfers: [{ from: 'p1', to: 'p3', amount: 1 }]
        }]);
    }, function (error) { return error.code === 'UNKNOWN_PARTICIPANT'; });

    assert.throws(function () {
        ledger.applyTransactions({ p1: 0 }, [{
            transfers: [{ from: 'p1', to: 'p1', amount: 1 }]
        }]);
    }, function (error) { return error.code === 'SAME_PARTICIPANT'; });

    assert.throws(function () {
        ledger.applyTransactions({ p1: 0, p2: 0 }, [{
            transfers: [{ from: 'p1', to: 'p2', amount: 0 }]
        }]);
    }, function (error) { return error.code === 'INVALID_AMOUNT'; });
});

test('本地数据默认值带版本，旧数据迁移不修改原对象', function () {
    var legacyData = {
        settings: { soundEnabled: false },
        activeMatches: [{ id: 'match-1' }]
    };
    var before = JSON.stringify(legacyData);
    var migrated = schema.migrate(legacyData);

    assert.equal(migrated.schemaVersion, schema.CURRENT_SCHEMA_VERSION);
    assert.equal(migrated.settings.soundEnabled, false);
    assert.equal(migrated.settings.vibrationEnabled, true);
    assert.deepEqual(migrated.activeMatches, [{ id: 'match-1' }]);
    assert.equal(JSON.stringify(legacyData), before);
});

test('本地数据拒绝由更高版本降级读取', function () {
    assert.throws(function () {
        schema.migrate({ schemaVersion: schema.CURRENT_SCHEMA_VERSION + 1 });
    }, function (error) { return error.code === 'FUTURE_SCHEMA_VERSION'; });
});

function memoryStorage(initial) {
    var values = initial || {};
    return {
        values: values,
        getStorageSync: function (key) { return values[key]; },
        setStorageSync: function (key, value) { values[key] = value; },
        removeStorageSync: function (key) { delete values[key]; }
    };
}

test('本地存储迁移先校验临时键再更新正式键', function () {
    var adapter = memoryStorage();
    var loaded = storageService.load(adapter);
    assert.equal(loaded.schemaVersion, schema.CURRENT_SCHEMA_VERSION);
    assert.ok(adapter.values[storageService.STORAGE_KEY]);
    assert.equal(adapter.values[storageService.TEMP_KEY], undefined);
});

test('本地存储写入失败时保留原正式数据', function () {
    var original = JSON.stringify({ schemaVersion: 1, marker: 'original' });
    var adapter = memoryStorage({});
    adapter.values[storageService.STORAGE_KEY] = original;
    var normalSet = adapter.setStorageSync;
    adapter.setStorageSync = function (key, value) {
        if (key === storageService.STORAGE_KEY) throw new Error('disk full');
        normalSet(key, value);
    };

    assert.throws(function () {
        storageService.save(adapter, schema.createDefaultData());
    }, function (error) { return error.code === 'WRITE_FAILED'; });
    assert.equal(adapter.values[storageService.STORAGE_KEY], original);
    assert.equal(adapter.values[storageService.TEMP_KEY], undefined);
});

test('损坏的本地数据会报错且不会被默认值覆盖', function () {
    var adapter = memoryStorage({});
    adapter.values[storageService.STORAGE_KEY] = '{broken';
    assert.throws(function () {
        storageService.load(adapter);
    }, function (error) { return error.code === 'PARSE_FAILED'; });
    assert.equal(adapter.values[storageService.STORAGE_KEY], '{broken');
});

test('规则注册表校验统一接口并能获取国标引擎', function () {
    registry.clearForTests();
    assert.throws(function () {
        registry.register({ id: 'incomplete' });
    });
    registry.register(guobiao);
    assert.equal(registry.requireEngine('guobiao'), guobiao);
    assert.throws(function () {
        registry.requireEngine('riichi');
    }, function (error) { return error.code === 'ENGINE_NOT_REGISTERED'; });
});

test('国标适配器兼容旧牌对象并返回统一结果字段', function () {
    var result = guobiao.calculateWin({
        concealedTiles: legacyTiles([
            '1万', '9万', '1条', '9条', '1筒', '9筒',
            '东', '南', '西', '北', '中', '发', '白', '东'
        ]),
        context: { winTile: '东' }
    });
    assert.equal(result.canWin, true);
    assert.equal(result.canHu, true);
    assert.equal(result.totalValue, result.totalFan);
    assert.equal(result.valueUnit, 'fan');
    assert.ok(result.items.some(function (item) {
        return item.name === '十三幺' && item.value === 88;
    }));
});

test('国标统一结果返回最高分拆法及其他候选', function () {
    var result = guobiao.calculateWin({
        concealedTiles: legacyTiles([
            '1万', '1万', '1万', '1万',
            '2万', '2万', '2万', '2万',
            '3万', '3万', '3万', '3万',
            '4万', '4万'
        ]),
        context: { winTile: '4万' }
    });

    assert.equal(result.selectedCandidate.pattern, '标准');
    assert.equal(result.selectedCandidate.totalFan, result.totalValue);
    assert.ok(result.alternatives.some(function (candidate) {
        return candidate.pattern === '七对' && candidate.reason === 'LOWER_TOTAL_FAN';
    }));
});

test('国标适配器在进入旧规则引擎前阻止第五张同牌', function () {
    var result = guobiao.calculateWin({
        concealedTiles: [
            'm1', 'm1', 'm1', 'm1', 'm1',
            'm2', 'm3', 'm4', 's1', 's2', 's3', 'p1', 'p1', 'p1'
        ],
        context: { winTile: '1万' }
    });
    assert.equal(result.canWin, false);
    assert.equal(result.reason, 'INVALID_TILE_COPIES');
});

test('国标无花牌规则目录包含完整80项', function () {
    var catalog = guobiao.getRuleCatalog();
    assert.equal(catalog.length, 80);
    assert.ok(catalog.some(function (rule) { return rule.name === '七星不靠'; }));
    assert.ok(catalog.some(function (rule) { return rule.name === '全双刻'; }));
    assert.equal(catalog.some(function (rule) { return rule.name === '花牌'; }), false);
});

test('国标计算定义与规则百科的番值及不计关系保持一致', function () {
    var engineDefinitions = legacyGuobiao.getFanDefinitions();
    var catalog = guobiao.getRuleCatalog();
    assert.equal(engineDefinitions.length, 80);
    assert.equal(catalog.length, 80);

    engineDefinitions.forEach(function (definition) {
        var displayed = catalog.find(function (rule) { return rule.name === definition.name; });
        assert.ok(displayed, '规则百科缺少：' + definition.name);
        assert.equal(displayed.fan, definition.fan, definition.name + '番值不一致');
        assert.deepEqual(
            displayed.exclusions.slice().sort(),
            definition.exclusions.slice().sort(),
            definition.name + '不计关系不一致'
        );
    });
});

test('国标适配器拒绝自摸与荣和情境矛盾', function () {
    var hand = [
        'm1', 'm2', 'm3', 'm3', 'm4', 'm5', 's2',
        's3', 's4', 'p6', 'p7', 'p8', 's5', 's5'
    ];
    var missingSelfDraw = guobiao.calculateWin({
        concealedTiles: hand,
        context: { miaoshouhuichun: true, winTile: '5条' }
    });
    assert.equal(missingSelfDraw.reason, 'SELF_DRAW_CONTEXT_REQUIRED');

    var discardEventWithSelfDraw = guobiao.calculateWin({
        concealedTiles: hand,
        context: { zimo: true, haidilaoyue: true, winTile: '5条' }
    });
    assert.equal(discardEventWithSelfDraw.reason, 'DISCARD_WIN_CONTEXT_REQUIRED');
});
