'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var matchState = require('../rules/sichuan/matchState.js');
var roundState = require('../rules/sichuan/roundState.js');

var PLAYERS = [
    { id: 'p1', name: '东家' },
    { id: 'p2', name: '南家' },
    { id: 'p3', name: '西家' },
    { id: 'p4', name: '北家' }
];

function rules() {
    return {
        huansanzhangEnabled: false,
        dingqueEnabled: false,
        huazhuEnabled: false,
        dajiaoEnabled: false,
        taxRefundEnabled: false,
        baseScore: 1,
        selfDrawMode: 'addBase'
    };
}

function create(format) {
    return matchState.createMatch({
        matchId: 'match-1',
        mode: roundState.MODES.NORMAL,
        players: PLAYERS,
        initialDealerId: 'p1',
        format: format,
        rules: rules(),
        timestamp: '2026-09-05T00:00:00.000Z'
    });
}

function completeNextRound(match, winnerId, discarderId, roundId) {
    var round = matchState.createNextRound(match, { roundId: roundId });
    return roundState.recordWin(round, {
        id: roundId + '-win',
        winners: [{ playerId: winnerId, fan: 1 }],
        discarderId: discarderId
    });
}

test('创建川麻整场时固定四名玩家、初始零分并快照完整规则', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    assert.equal(match.status, 'active');
    assert.equal(match.nextDealerId, 'p1');
    assert.deepEqual(match.scoreTotals, { p1: 0, p2: 0, p3: 0, p4: 0 });
    assert.deepEqual(match.rankings.map(function (entry) { return entry.playerId; }), PLAYERS.map(function (p) {
        return p.id;
    }));
    assert.equal(match.rulesSnapshot.huansanzhangEnabled, false);
    assert.equal(match.rulesSnapshot.eventFansEnabled, true);
    assert.equal(match.rulesSnapshot.huazhuEnabled, false);
});

test('新局使用整场建议庄家和冻结的规则快照', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    var round = matchState.createNextRound(match, { roundId: 'round-1' });
    assert.equal(round.id, 'round-1');
    assert.equal(round.dealerId, 'p1');
    assert.equal(round.phase, 'play');
    assert.equal(round.rules.baseScore, 1);
});

test('提交已结束牌局后自动累计分数并采用和牌者为下一庄', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    var round = completeNextRound(match, 'p2', 'p4', 'round-1');
    match = matchState.commitRound(match, round, { timestamp: '2026-09-05T00:01:00.000Z' });

    assert.deepEqual(match.scoreTotals, { p1: 0, p2: 2, p3: 0, p4: -2 });
    assert.equal(match.nextDealerId, 'p2');
    assert.equal(match.rounds[0].nextDealerSuggestion, 'p2');
    assert.equal(match.dealerCounts.p1, 1);
    assert.equal(match.status, 'active');
});

test('提交牌局时允许人工纠正下一庄且下一局立即采用', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    var round = completeNextRound(match, 'p2', 'p4', 'round-1');
    match = matchState.commitRound(match, round, { dealerOverrideId: 'p3' });
    assert.equal(match.rounds[0].nextDealerSuggestion, 'p2');
    assert.equal(match.rounds[0].nextDealerId, 'p3');
    assert.equal(match.nextDealerId, 'p3');
    assert.equal(matchState.createNextRound(match).dealerId, 'p3');
});

test('固定局数和自定义局数达到局数后自动结束', function () {
    [
        { type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 },
        { type: matchState.FORMAT_TYPES.CUSTOM_ROUNDS, roundCount: 2 }
    ].forEach(function (format) {
        var match = create(format);
        for (var i = 0; i < format.roundCount; i++) {
            var dealerIndex = PLAYERS.map(function (player) { return player.id; }).indexOf(match.nextDealerId);
            var winnerId = PLAYERS[(dealerIndex + 1) % 4].id;
            var discarderId = PLAYERS[(dealerIndex + 2) % 4].id;
            var round = completeNextRound(match, winnerId, discarderId, format.type + '-' + i);
            match = matchState.commitRound(match, round, {
                timestamp: '2026-09-05T00:0' + (i + 1) + ':00.000Z'
            });
        }
        assert.equal(match.status, 'completed');
        assert.equal(match.nextDealerId, null);
        assert.equal(match.rounds.length, format.roundCount);
        assert.ok(match.completedAt);
        assert.throws(function () {
            matchState.createNextRound(match);
        }, function (error) { return error.code === 'MATCH_COMPLETED'; });
    });
});

test('每人坐庄一次赛制在四家均实际坐庄后结束', function () {
    var match = create({ type: matchState.FORMAT_TYPES.EACH_DEALER_ONCE });
    var order = ['p2', 'p3', 'p4', 'p1'];
    for (var i = 0; i < order.length; i++) {
        var discarderId = order[i] === 'p4' ? 'p2' : 'p4';
        var round = completeNextRound(match, order[i], discarderId, 'dealer-' + i);
        match = matchState.commitRound(match, round);
    }
    assert.deepEqual(match.dealerCounts, { p1: 1, p2: 1, p3: 1, p4: 1 });
    assert.equal(match.status, 'completed');
});

test('不限局数不会自动结束，只能显式手动结束', function () {
    var match = create({ type: matchState.FORMAT_TYPES.UNLIMITED });
    for (var i = 0; i < 5; i++) {
        var winnerId = match.nextDealerId === 'p1' ? 'p2' : 'p1';
        var round = completeNextRound(match, winnerId, 'p4', 'unlimited-' + i);
        match = matchState.commitRound(match, round);
    }
    assert.equal(match.status, 'active');
    match = matchState.endUnlimitedMatch(match, { timestamp: '2026-09-05T01:00:00.000Z' });
    assert.equal(match.status, 'completed');
    assert.equal(match.manualEnded, true);
    assert.equal(match.completedAt, '2026-09-05T01:00:00.000Z');

    assert.throws(function () {
        matchState.endUnlimitedMatch(create({
            type: matchState.FORMAT_TYPES.FIXED_ROUNDS,
            roundCount: 4
        }));
    }, function (error) { return error.code === 'MANUAL_END_NOT_ALLOWED'; });
});

test('总分允许为负，排名按累计净得分并以初始座次打破同分', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    var round = completeNextRound(match, 'p3', 'p4', 'ranking-round');
    match = matchState.commitRound(match, round);
    assert.equal(match.scoreTotals.p4, -2);
    assert.deepEqual(match.rankings.map(function (entry) { return entry.playerId; }), [
        'p3', 'p1', 'p2', 'p4'
    ]);
    assert.deepEqual(match.rankings.map(function (entry) { return entry.rank; }), [1, 2, 3, 4]);
});

test('历史重放不信任缓存总分、单局变化或下一庄字段', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    match = matchState.commitRound(match, completeNextRound(match, 'p2', 'p4', 'round-1'));
    var tampered = JSON.parse(JSON.stringify(match));
    tampered.scoreTotals = { p1: 999, p2: 999, p3: 999, p4: 999 };
    tampered.rounds[0].scoreChanges = { p1: 999, p2: 999, p3: 999, p4: 999 };
    tampered.rounds[0].nextDealerSuggestion = 'p4';
    tampered.nextDealerId = 'p4';

    var replayed = matchState.replayMatch(tampered);
    assert.deepEqual(replayed.scoreTotals, { p1: 0, p2: 2, p3: 0, p4: -2 });
    assert.deepEqual(replayed.rounds[0].scoreChanges, { p1: 0, p2: 2, p3: 0, p4: -2 });
    assert.equal(replayed.rounds[0].nextDealerSuggestion, 'p2');
    assert.equal(replayed.nextDealerId, 'p2');
});

test('替换历史局后重新计算后续庄家和整场累计分数', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    match = matchState.commitRound(match, completeNextRound(match, 'p2', 'p4', 'round-1'));
    match = matchState.commitRound(match, completeNextRound(match, 'p4', 'p3', 'round-2'));

    var replacement = roundState.createRoundState({
        roundId: 'round-1',
        mode: roundState.MODES.NORMAL,
        participantIds: PLAYERS.map(function (player) { return player.id; }),
        dealerId: 'p1',
        rules: rules()
    });
    replacement = roundState.recordWin(replacement, {
        winners: [{ playerId: 'p3', fan: 2 }],
        discarderId: 'p4'
    });
    match = matchState.replaceRound(match, 0, replacement);

    assert.equal(match.rounds[1].dealerId, 'p3');
    assert.deepEqual(match.scoreTotals, { p1: 0, p2: 0, p3: 2, p4: -2 });
    assert.equal(match.nextDealerId, 'p4');
});

test('从指定历史局撤销会删除该局及之后记录并重新开放整场', function () {
    var match = create({ type: matchState.FORMAT_TYPES.CUSTOM_ROUNDS, roundCount: 2 });
    match = matchState.commitRound(match, completeNextRound(match, 'p2', 'p4', 'round-1'));
    match = matchState.commitRound(match, completeNextRound(match, 'p3', 'p4', 'round-2'));
    assert.equal(match.status, 'completed');

    match = matchState.removeRoundsFrom(match, 1);
    assert.equal(match.status, 'active');
    assert.equal(match.rounds.length, 1);
    assert.deepEqual(match.scoreTotals, { p1: 0, p2: 2, p3: 0, p4: -2 });
    assert.equal(match.nextDealerId, 'p2');
});

test('整场拒绝未结束牌局、错误庄家和重复牌局ID', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    var activeRound = matchState.createNextRound(match, { roundId: 'round-1' });
    assert.throws(function () {
        matchState.commitRound(match, activeRound);
    }, function (error) { return error.code === 'ROUND_NOT_ENDED'; });

    var ended = roundState.recordWin(activeRound, {
        winners: [{ playerId: 'p2', fan: 1 }], discarderId: 'p4'
    });
    var wrongDealer = JSON.parse(JSON.stringify(ended));
    wrongDealer.dealerId = 'p3';
    assert.throws(function () {
        matchState.commitRound(match, wrongDealer);
    }, function (error) { return error.code === 'ROUND_DEALER_MISMATCH'; });

    match = matchState.commitRound(match, ended);
    var duplicate = completeNextRound(match, 'p3', 'p4', 'round-1');
    assert.throws(function () {
        matchState.commitRound(match, duplicate);
    }, function (error) { return error.code === 'DUPLICATE_ROUND_ID'; });
});

test('整场拒绝混入不同川麻模式或不同规则快照的牌局', function () {
    var match = create({ type: matchState.FORMAT_TYPES.FIXED_ROUNDS, roundCount: 4 });
    var ended = completeNextRound(match, 'p2', 'p4', 'round-1');

    var wrongMode = JSON.parse(JSON.stringify(ended));
    wrongMode.mode = roundState.MODES.BLOOD_RIVER;
    assert.throws(function () {
        matchState.commitRound(match, wrongMode);
    }, function (error) { return error.code === 'ROUND_MODE_MISMATCH'; });

    var wrongRules = JSON.parse(JSON.stringify(ended));
    wrongRules.rules.baseScore = 2;
    assert.throws(function () {
        matchState.commitRound(match, wrongRules);
    }, function (error) { return error.code === 'ROUND_RULES_MISMATCH'; });
});
