'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var roundState = require('../rules/sichuan/roundState.js');

var PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function noSetupRules(extra) {
    var rules = {
        huansanzhangEnabled: false,
        dingqueEnabled: false,
        baseScore: 1,
        selfDrawMode: 'addBase',
        huazhuEnabled: false,
        dajiaoEnabled: false,
        taxRefundEnabled: false
    };
    Object.keys(extra || {}).forEach(function (key) { rules[key] = extra[key]; });
    return rules;
}

function createRound(mode, extra) {
    var input = {
        roundId: 'r1',
        mode: mode,
        participantIds: PLAYERS,
        dealerId: 'p1',
        rules: noSetupRules()
    };
    Object.keys(extra || {}).forEach(function (key) { input[key] = extra[key]; });
    return roundState.createRoundState(input);
}

function exchangeSelections() {
    return {
        p1: ['m1', 'm2', 'm3'],
        p2: ['s1', 's2', 's3'],
        p3: ['p1', 'p2', 'p3'],
        p4: ['m4', 'm5', 'm6']
    };
}

function snapshot(tile) {
    return {
        concealedTiles: [
            'm1', 'm2', 'm3', 'm3', 'm4', 'm5',
            's2', 's3', 's4', 's6', 's7', 's8', 'm5', 'm5'
        ],
        melds: [],
        winTile: 'm5',
        label: tile
    };
}

test('换三张随机方向按三区间选择且拒绝越界随机值', function () {
    assert.equal(roundState.chooseExchangeDirection(function () { return 0; }), 'clockwise');
    assert.equal(roundState.chooseExchangeDirection(function () { return 0.34; }), 'counterclockwise');
    assert.equal(roundState.chooseExchangeDirection(function () { return 0.99; }), 'opposite');
    assert.throws(function () {
        roundState.chooseExchangeDirection(function () { return 1; });
    }, function (error) { return error.code === 'INVALID_RANDOM_VALUE'; });
});

test('换三张记录方向、交付关系和每家收到的牌', function () {
    var record = roundState.createExchangeRecord({
        participantIds: PLAYERS,
        selections: exchangeSelections(),
        direction: 'clockwise'
    });
    assert.equal(record.directionName, '顺时针');
    assert.deepEqual(record.transfers[0], {
        from: 'p1', to: 'p2', tiles: ['m1', 'm2', 'm3']
    });
    assert.deepEqual(record.receivedBy.p2, ['m1', 'm2', 'm3']);
    assert.deepEqual(record.receivedBy.p1, ['m4', 'm5', 'm6']);
});

test('换三张要求每家选择同花色三张合法牌且全局不超过四张', function () {
    var mixed = exchangeSelections();
    mixed.p1 = ['m1', 'm2', 's3'];
    assert.throws(function () {
        roundState.createExchangeRecord({
            participantIds: PLAYERS,
            selections: mixed,
            direction: 'opposite'
        });
    }, function (error) { return error.code === 'EXCHANGE_SUIT_MISMATCH'; });

    var tooMany = exchangeSelections();
    tooMany.p1 = ['m1', 'm1', 'm1'];
    tooMany.p4 = ['m1', 'm1', 'm5'];
    assert.throws(function () {
        roundState.createExchangeRecord({
            participantIds: PLAYERS,
            selections: tooMany,
            direction: 'opposite'
        });
    }, function (error) { return error.code === 'INVALID_EXCHANGE_COPIES'; });
});

test('开启换三张和定缺时按换牌、定缺、行牌顺序推进', function () {
    var state = roundState.createRoundState({
        roundId: 'setup-round',
        mode: roundState.MODES.NORMAL,
        participantIds: PLAYERS,
        dealerId: 'p1',
        rules: { huansanzhangEnabled: true, dingqueEnabled: true },
        random: function () { return 0.8; }
    });
    assert.equal(state.phase, 'exchange');
    assert.equal(state.exchangeDirection, 'opposite');

    state = roundState.recordExchange(state, exchangeSelections());
    assert.equal(state.phase, 'dingque');
    assert.equal(state.events[0].directionName, '对家');

    state = roundState.recordDingque(state, { p1: 'p', p2: 'm', p3: 's', p4: 'p' });
    assert.equal(state.phase, 'play');
    assert.deepEqual(state.dingqueSuits, { p1: 'p', p2: 'm', p3: 's', p4: 'p' });
    assert.equal(state.events.length, 2);
});

test('关闭换三张或定缺时跳过相应准备阶段', function () {
    var dingqueOnly = roundState.createRoundState({
        mode: roundState.MODES.NORMAL,
        participantIds: PLAYERS,
        dealerId: 'p1',
        rules: { huansanzhangEnabled: false, dingqueEnabled: true }
    });
    assert.equal(dingqueOnly.phase, 'dingque');
    assert.equal(dingqueOnly.exchangeDirection, null);

    var directPlay = createRound(roundState.MODES.NORMAL);
    assert.equal(directPlay.phase, 'play');
});

test('普通玩法在首个和牌事件后结束并建议单一和牌者坐庄', function () {
    var state = createRound(roundState.MODES.NORMAL);
    var ended = roundState.recordWin(state, {
        id: 'win-1',
        winners: [{ playerId: 'p2', fan: 2 }],
        discarderId: 'p4'
    });
    assert.equal(ended.ended, true);
    assert.equal(ended.endReason, 'win');
    assert.equal(ended.nextDealerSuggestion, 'p2');
    assert.deepEqual(ended.scoreChanges, { p1: 0, p2: 4, p3: 0, p4: -4 });
    assert.throws(function () {
        roundState.recordKong(ended, { actorId: 'p1', kongType: 'concealedKong' });
    }, function (error) { return error.code === 'INVALID_ROUND_PHASE'; });
});

test('普通玩法一炮多响后由点炮者坐庄', function () {
    var ended = roundState.recordWin(createRound(roundState.MODES.NORMAL), {
        winners: [
            { playerId: 'p2', fan: 1 },
            { playerId: 'p3', fan: 2 }
        ],
        discarderId: 'p4'
    });
    assert.equal(ended.nextDealerSuggestion, 'p4');
    assert.deepEqual(ended.scoreChanges, { p1: 0, p2: 2, p3: 4, p4: -6 });
});

test('血战到底中和牌者退出，三家和牌后结束且退出者不再付杠分', function () {
    var state = createRound(roundState.MODES.BLOOD_BATTLE);
    state = roundState.recordWin(state, {
        id: 'first-win',
        winners: [{ playerId: 'p1', fan: 1 }],
        discarderId: 'p4'
    });
    assert.equal(state.ended, false);
    assert.deepEqual(state.activePlayerIds, ['p2', 'p3', 'p4']);

    state = roundState.recordKong(state, {
        actorId: 'p2',
        kongType: 'concealedKong'
    });
    assert.equal(state.scoreChanges.p1, 2);
    assert.equal(state.scoreChanges.p2, 4);
    assert.equal(state.scoreChanges.p3, -2);
    assert.equal(state.scoreChanges.p4, -4);

    assert.throws(function () {
        roundState.recordWin(state, {
            winners: [{ playerId: 'p1', fan: 1 }],
            discarderId: 'p4'
        });
    }, function (error) { return error.code === 'INVALID_WINNER'; });

    state = roundState.recordWin(state, {
        winners: [
            { playerId: 'p2', fan: 0 },
            { playerId: 'p3', fan: 0 }
        ],
        discarderId: 'p4'
    });
    assert.equal(state.ended, true);
    assert.equal(state.endReason, 'threePlayersWon');
    assert.deepEqual(state.activePlayerIds, ['p4']);
    assert.equal(state.nextDealerSuggestion, 'p1');
});

test('血战首个事件一炮多响时由点炮者坐庄', function () {
    var state = createRound(roundState.MODES.BLOOD_BATTLE);
    state = roundState.recordWin(state, {
        winners: [
            { playerId: 'p1', fan: 1 },
            { playerId: 'p2', fan: 1 },
            { playerId: 'p3', fan: 1 }
        ],
        discarderId: 'p4'
    });
    assert.equal(state.ended, true);
    assert.equal(state.nextDealerSuggestion, 'p4');
});

test('血流成河允许同一玩家多次和牌且只在牌墙耗尽时结束', function () {
    var state = createRound(roundState.MODES.BLOOD_RIVER);
    state = roundState.recordWin(state, {
        winners: [{ playerId: 'p1', fan: 1, handSnapshot: snapshot('m1') }],
        discarderId: 'p4'
    });
    state = roundState.recordWin(state, {
        winners: [{ playerId: 'p1', fan: 2, handSnapshot: snapshot('m2') }],
        discarderId: 'p3'
    });
    assert.equal(state.ended, false);
    assert.deepEqual(state.activePlayerIds, PLAYERS);
    assert.deepEqual(state.winnerIds, ['p1']);
    assert.equal(state.events[1].winners[0].handSnapshot.label, 'm2');

    state = roundState.recordWallExhausted(state);
    assert.equal(state.ended, true);
    assert.equal(state.endReason, 'wallExhausted');
    assert.equal(state.nextDealerSuggestion, 'p1');
});

test('血流成河每次和牌都必须保存完整牌面快照', function () {
    var state = createRound(roundState.MODES.BLOOD_RIVER);
    assert.throws(function () {
        roundState.recordWin(state, {
            winners: [{ playerId: 'p1', fan: 1 }],
            discarderId: 'p4'
        });
    }, function (error) { return error.code === 'MISSING_HAND_SNAPSHOT'; });
});

test('无和牌流局时保持本局庄家', function () {
    var ended = roundState.recordWallExhausted(createRound(roundState.MODES.NORMAL));
    assert.equal(ended.nextDealerSuggestion, 'p1');
});

test('牌墙耗尽把花猪、大叫和退税交易接入本局事件与累计得分', function () {
    var state = createRound(roundState.MODES.BLOOD_BATTLE, {
        rules: noSetupRules({
            huazhuEnabled: true,
            dajiaoEnabled: true,
            taxRefundEnabled: true
        })
    });
    state = roundState.recordKong(state, {
        id: 'kong-before-draw',
        actorId: 'p3',
        sourcePlayerId: 'p1',
        kongType: 'directKong'
    });
    state = roundState.recordWallExhausted(state, {
        id: 'draw-1',
        huazhuPlayerIds: ['p4'],
        dajiaoResults: [
            { playerId: 'p1', isReady: true, maxFan: 1 },
            { playerId: 'p2', isReady: true, maxFan: 2 },
            { playerId: 'p3', isReady: false }
        ]
    });

    assert.equal(state.ended, true);
    assert.equal(state.events[state.events.length - 1].type, 'wallExhausted');
    assert.deepEqual(state.transactions.map(function (transaction) { return transaction.type; }), [
        'kong', 'huazhu', 'dajiao', 'taxRefund'
    ]);
    assert.equal(Object.keys(state.scoreChanges).reduce(function (sum, playerId) {
        return sum + state.scoreChanges[playerId];
    }, 0), 0);
    assert.equal(state.nextDealerSuggestion, 'p1');
});
