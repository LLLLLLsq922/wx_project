'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var ledger = require('../core/ledger.js');
var settlement = require('../rules/sichuan/settlement.js');

var PLAYERS = ['p1', 'p2', 'p3', 'p4'];

test('川麻点炮按底分乘二的番数次方结算', function () {
    var result = settlement.settleWinEvent({
        eventId: 'round-1-win-1',
        participantIds: PLAYERS,
        winners: [{ playerId: 'p1', fan: 3 }],
        discarderId: 'p4',
        isSelfDraw: false
    }, { baseScore: 2 });

    assert.deepEqual(result.transactions[0].transfers, [
        { from: 'p4', to: 'p1', amount: 16 }
    ]);
    assert.deepEqual(result.changes, { p1: 16, p2: 0, p3: 0, p4: -16 });
    assert.equal(ledger.sumBalances(result.changes), 0);
});

test('川麻自摸加底由每名其他活跃玩家支付牌型分加一底', function () {
    var result = settlement.settleWinEvent({
        participantIds: PLAYERS,
        activePlayerIds: ['p1', 'p2', 'p3'],
        winners: [{ playerId: 'p1', fan: 2 }],
        isSelfDraw: true
    }, { baseScore: 2, selfDrawMode: 'addBase' });

    assert.deepEqual(result.transactions[0].transfers, [
        { from: 'p2', to: 'p1', amount: 10 },
        { from: 'p3', to: 'p1', amount: 10 }
    ]);
    assert.deepEqual(result.changes, { p1: 20, p2: -10, p3: -10, p4: 0 });
});

test('川麻自摸加番把牌型番数增加一番后由各家支付', function () {
    var result = settlement.settleWinEvent({
        participantIds: PLAYERS,
        winners: [{ playerId: 'p2', fan: 2 }],
        isSelfDraw: true
    }, { baseScore: 2, selfDrawMode: 'addFan' });

    assert.equal(result.transactions[0].metadata.paymentPerPlayer, 16);
    assert.deepEqual(result.changes, { p1: -16, p2: 48, p3: -16, p4: -16 });
});

test('川麻一炮多响为每名和牌者生成独立即时交易', function () {
    var result = settlement.settleWinEvent({
        eventId: 'multi-win',
        participantIds: PLAYERS,
        winners: [
            { playerId: 'p1', fan: 1 },
            { playerId: 'p3', fan: 3 }
        ],
        discarderId: 'p4',
        isSelfDraw: false
    });

    assert.equal(result.transactions.length, 2);
    assert.deepEqual(result.changes, { p1: 2, p2: 0, p3: 8, p4: -10 });
    assert.equal(ledger.sumBalances(result.changes), 0);
});

test('川麻直杠由点杠者支付两底', function () {
    var transaction = settlement.createKongTransaction({
        participantIds: PLAYERS,
        actorId: 'p1',
        sourcePlayerId: 'p4',
        kongType: 'directKong'
    }, { baseScore: 5 });

    assert.deepEqual(transaction.transfers, [{ from: 'p4', to: 'p1', amount: 10 }]);
    assert.deepEqual(ledger.calculateChanges(PLAYERS, [transaction]), {
        p1: 10, p2: 0, p3: 0, p4: -10
    });
});

test('川麻补杠和暗杠由其他活跃玩家分别支付一底和两底', function () {
    var added = settlement.createKongTransaction({
        participantIds: PLAYERS,
        activePlayerIds: ['p1', 'p2', 'p3'],
        actorId: 'p1',
        kongType: 'addedKong'
    }, { baseScore: 2 });
    assert.deepEqual(ledger.calculateChanges(PLAYERS, [added]), {
        p1: 4, p2: -2, p3: -2, p4: 0
    });

    var concealed = settlement.createKongTransaction({
        participantIds: PLAYERS,
        actorId: 'p1',
        kongType: 'concealedKong'
    }, { baseScore: 2 });
    assert.deepEqual(ledger.calculateChanges(PLAYERS, [concealed]), {
        p1: 12, p2: -4, p3: -4, p4: -4
    });
});

test('川麻抢补杠时补杠不成立且不产生杠分', function () {
    var transaction = settlement.createKongTransaction({
        participantIds: PLAYERS,
        actorId: 'p1',
        kongType: 'addedKong',
        robbed: true
    });
    assert.equal(transaction, null);
});

test('川麻结算拒绝非法底分、重复和牌者和多家自摸', function () {
    assert.throws(function () {
        settlement.settleWinEvent({
            participantIds: PLAYERS,
            winners: [{ playerId: 'p1', fan: 1 }],
            discarderId: 'p2'
        }, { baseScore: 3 });
    }, function (error) { return error.code === 'INVALID_BASE_SCORE'; });

    assert.throws(function () {
        settlement.settleWinEvent({
            participantIds: PLAYERS,
            winners: [{ playerId: 'p1', fan: 1 }, { playerId: 'p1', fan: 2 }],
            discarderId: 'p2'
        });
    }, function (error) { return error.code === 'INVALID_WINNERS'; });

    assert.throws(function () {
        settlement.settleWinEvent({
            participantIds: PLAYERS,
            winners: [{ playerId: 'p1', fan: 1 }, { playerId: 'p2', fan: 1 }],
            isSelfDraw: true
        });
    }, function (error) { return error.code === 'MULTIPLE_SELF_DRAW_WINNERS'; });
});
