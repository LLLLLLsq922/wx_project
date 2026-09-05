'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var ledger = require('../core/ledger.js');
var sichuan = require('../rules/sichuan/engine.js');
var settlement = require('../rules/sichuan/settlement.js');
var terminal = require('../rules/sichuan/terminalSettlement.js');

var PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function result(playerId, isReady, maxFan) {
    return { playerId: playerId, isReady: isReady, maxFan: maxFan };
}

test('川麻查花猪让每名花猪向每名非花猪支付十六底', function () {
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true,
        huazhuPlayerIds: ['p4'],
        dajiaoResults: [result('p1', true, 1), result('p2', true, 0), result('p3', false)]
    }, { baseScore: 2, dajiaoEnabled: false, taxRefundEnabled: false });

    assert.deepEqual(settled.order, ['huazhu']);
    assert.deepEqual(settled.changes, { p1: 32, p2: 32, p3: 32, p4: -96 });
    assert.equal(ledger.sumBalances(settled.changes), 0);
});

test('川麻查大叫由每名未听牌者按每位听牌者最高理论番支付', function () {
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true,
        dajiaoResults: [
            result('p1', true, 3),
            result('p2', true, 1),
            result('p3', false),
            result('p4', false)
        ]
    }, { huazhuEnabled: false, taxRefundEnabled: false });

    assert.deepEqual(settled.order, ['dajiao']);
    assert.deepEqual(settled.changes, { p1: 16, p2: 4, p3: -10, p4: -10 });
});

test('已和牌和花猪玩家不参加查大叫，但花猪仍向所有非花猪支付', function () {
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true,
        winnerIds: ['p1'],
        huazhuPlayerIds: ['p4'],
        dajiaoResults: [result('p2', true, 2), result('p3', false)]
    }, { taxRefundEnabled: false });

    assert.deepEqual(settled.order, ['huazhu', 'dajiao']);
    assert.deepEqual(settled.changes, { p1: 16, p2: 20, p3: 12, p4: -48 });
});

test('未听牌玩家把每笔杠收入原额退还给原付款人', function () {
    var direct = settlement.createKongTransaction({
        eventId: 'kong-1',
        participantIds: PLAYERS,
        actorId: 'p2',
        sourcePlayerId: 'p1',
        kongType: 'directKong'
    });
    var added = settlement.createKongTransaction({
        eventId: 'kong-2',
        participantIds: PLAYERS,
        actorId: 'p2',
        kongType: 'addedKong'
    });
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true,
        dajiaoResults: [
            result('p1', true, 0),
            result('p2', false),
            result('p3', true, 0),
            result('p4', true, 0)
        ],
        kongTransactions: [direct, added]
    }, { huazhuEnabled: false, dajiaoEnabled: false, taxRefundEnabled: true });

    assert.deepEqual(settled.order, ['taxRefund']);
    assert.deepEqual(settled.changes, { p1: 3, p2: -5, p3: 1, p4: 1 });
});

test('花猪即使不参加查大叫也必须退还本局杠收入', function () {
    var kong = settlement.createKongTransaction({
        eventId: 'kong-huazhu',
        participantIds: PLAYERS,
        actorId: 'p4',
        sourcePlayerId: 'p3',
        kongType: 'directKong'
    });
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true,
        huazhuPlayerIds: ['p4'],
        dajiaoResults: [result('p1', true, 0), result('p2', true, 0), result('p3', true, 0)],
        kongTransactions: [kong]
    }, { huazhuEnabled: true, dajiaoEnabled: false, taxRefundEnabled: true });

    assert.deepEqual(settled.order, ['huazhu', 'taxRefund']);
    assert.ok(settled.transactions[1].transfers.some(function (transfer) {
        return transfer.from === 'p4' && transfer.to === 'p3' && transfer.amount === 2;
    }));
});

test('终局交易固定按花猪、大叫、退税顺序生成', function () {
    var kong = settlement.createKongTransaction({
        eventId: 'kong-order',
        participantIds: PLAYERS,
        actorId: 'p3',
        sourcePlayerId: 'p1',
        kongType: 'directKong'
    });
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true,
        huazhuPlayerIds: ['p4'],
        dajiaoResults: [result('p1', true, 1), result('p2', true, 2), result('p3', false)],
        kongTransactions: [kong]
    });
    assert.deepEqual(settled.order, ['huazhu', 'dajiao', 'taxRefund']);
    assert.equal(ledger.sumBalances(settled.changes), 0);
});

test('关闭三项终局规则时不产生交易', function () {
    var settled = terminal.settleExhaustiveDraw({
        participantIds: PLAYERS,
        wallExhausted: true
    }, { huazhuEnabled: false, dajiaoEnabled: false, taxRefundEnabled: false });
    assert.deepEqual(settled.transactions, []);
    assert.deepEqual(settled.changes, { p1: 0, p2: 0, p3: 0, p4: 0 });
    assert.deepEqual(settled.dajiaoResults, []);
});

test('终局规则拒绝非牌墙耗尽、缺失大叫判定和已和花猪冲突', function () {
    assert.throws(function () {
        terminal.settleExhaustiveDraw({ participantIds: PLAYERS });
    }, function (error) { return error.code === 'NOT_WALL_EXHAUSTED'; });

    assert.throws(function () {
        terminal.settleExhaustiveDraw({
            participantIds: PLAYERS,
            wallExhausted: true,
            dajiaoResults: [result('p1', true, 1)]
        }, { huazhuEnabled: false });
    }, function (error) { return error.code === 'MISSING_DAJIAO_RESULT'; });

    assert.throws(function () {
        terminal.settleExhaustiveDraw({
            participantIds: PLAYERS,
            wallExhausted: true,
            winnerIds: ['p1'],
            huazhuPlayerIds: ['p1']
        }, { dajiaoEnabled: false, taxRefundEnabled: false });
    }, function (error) { return error.code === 'WINNER_CANNOT_BE_HUAZHU'; });

    assert.throws(function () {
        terminal.settleExhaustiveDraw({
            participantIds: PLAYERS,
            wallExhausted: true,
            winnerIds: ['p1'],
            dajiaoResults: [
                result('p1', true, 1), result('p2', true, 1),
                result('p3', false), result('p4', false)
            ]
        }, { huazhuEnabled: false, taxRefundEnabled: false });
    }, function (error) { return error.code === 'INELIGIBLE_DAJIAO_PLAYER'; });
});

test('大叫理论番只使用静态牌型、根、门清和中张', function () {
    var waiting = [
        'm1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4', 'm4',
        'm5', 'm5', 'm6', 'm6', 'm7'
    ];
    var analysis = sichuan.analyzeTheoreticalDajiao({
        concealedTiles: waiting,
        context: {
            dingqueSuit: 'p',
            tianhu: true,
            gangshanghua: true,
            qiangganghu: true
        }
    });
    assert.equal(analysis.valid, true);
    assert.equal(analysis.isReady, true);
    assert.equal(analysis.maxFan, 5);
    assert.ok(analysis.highestWaits.some(function (wait) { return wait.tileId === 'm7'; }));
    analysis.waits.forEach(function (wait) {
        assert.equal(wait.result.items.some(function (item) {
            return ['tianhu', 'gangshanghua', 'qiangganghu'].indexOf(item.id) !== -1;
        }), false);
    });
});

test('已见四张唯一等待牌时不算大叫', function () {
    var waiting = [
        'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
        's1', 's2', 's3', 's7', 's8', 's9', 'm9'
    ];
    var analysis = sichuan.analyzeTheoreticalDajiao({
        concealedTiles: waiting,
        visibleTiles: ['m9', 'm9', 'm9'],
        context: { dingqueSuit: 'p' }
    });
    assert.equal(analysis.valid, true);
    assert.equal(analysis.isReady, false);
    assert.equal(analysis.maxFan, null);
});

test('终局手牌分析根据定缺余牌自动识别花猪并跳过大叫', function () {
    var analysis = sichuan.analyzeExhaustivePlayer({
        concealedTiles: [
            'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
            's1', 's2', 's3', 's7', 's8', 's9', 'p9'
        ],
        context: { dingqueSuit: 'p' }
    });
    assert.equal(analysis.valid, true);
    assert.equal(analysis.isHuazhu, true);
    assert.equal(analysis.isReady, false);
    assert.deepEqual(analysis.waits, []);
});

test('终局手牌无缺门余牌时继续执行大叫分析', function () {
    var analysis = sichuan.analyzeExhaustivePlayer({
        concealedTiles: [
            'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
            's1', 's2', 's3', 's7', 's8', 's9', 'm9'
        ],
        context: { dingqueSuit: 'p' }
    });
    assert.equal(analysis.valid, true);
    assert.equal(analysis.isHuazhu, false);
    assert.equal(analysis.isReady, true);
    assert.equal(analysis.maxFan, 1);
});
