'use strict';

var ledger = require('../../core/ledger.js');

var DEFAULT_RULES = {
    baseScore: 1,
    selfDrawMode: 'addBase'
};

function settlementError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
}

function resolveRules(inputRules) {
    var rules = {
        baseScore: DEFAULT_RULES.baseScore,
        selfDrawMode: DEFAULT_RULES.selfDrawMode
    };
    Object.keys(inputRules || {}).forEach(function (key) { rules[key] = inputRules[key]; });
    if ([1, 2, 5].indexOf(rules.baseScore) === -1) {
        throw settlementError('INVALID_BASE_SCORE', '川麻底分只能是1、2或5');
    }
    if (['addBase', 'addFan'].indexOf(rules.selfDrawMode) === -1) {
        throw settlementError('INVALID_SELF_DRAW_MODE', '未知的川麻自摸计分方式');
    }
    return rules;
}

function validateParticipants(participantIds) {
    if (!Array.isArray(participantIds) || participantIds.length !== 4) {
        throw settlementError('INVALID_PARTICIPANTS', '川麻牌局必须有四名玩家');
    }
    var seen = {};
    participantIds.forEach(function (playerId) {
        if (typeof playerId !== 'string' || !playerId || seen[playerId]) {
            throw settlementError('INVALID_PARTICIPANTS', '玩家ID必须非空且不能重复');
        }
        seen[playerId] = true;
    });
    return seen;
}

function validateActivePlayers(activePlayerIds, participantMap) {
    if (!activePlayerIds) return Object.keys(participantMap);
    if (!Array.isArray(activePlayerIds)) {
        throw settlementError('INVALID_ACTIVE_PLAYERS', '活跃玩家列表格式错误');
    }
    var seen = {};
    activePlayerIds.forEach(function (playerId) {
        if (!participantMap[playerId] || seen[playerId]) {
            throw settlementError('INVALID_ACTIVE_PLAYERS', '活跃玩家必须来自本局且不能重复');
        }
        seen[playerId] = true;
    });
    return activePlayerIds.slice();
}

function validateFan(fan) {
    if (typeof fan !== 'number' || !isFinite(fan) || fan < 0 || Math.floor(fan) !== fan) {
        throw settlementError('INVALID_FAN', '番数必须是非负整数');
    }
}

function winPayment(fan, isSelfDraw, rules) {
    validateFan(fan);
    if (isSelfDraw && rules.selfDrawMode === 'addFan') {
        return rules.baseScore * Math.pow(2, fan + 1);
    }
    var payment = rules.baseScore * Math.pow(2, fan);
    return isSelfDraw ? payment + rules.baseScore : payment;
}

function createWinTransaction(input, rules) {
    var participantMap = validateParticipants(input.participantIds);
    var activePlayerIds = validateActivePlayers(input.activePlayerIds, participantMap);
    var winnerId = input.winnerId;
    if (!participantMap[winnerId] || activePlayerIds.indexOf(winnerId) === -1) {
        throw settlementError('INVALID_WINNER', '和牌者必须是本局活跃玩家');
    }
    var isSelfDraw = !!input.isSelfDraw;
    var amount = winPayment(input.fan, isSelfDraw, rules);
    var payerIds;
    if (isSelfDraw) {
        payerIds = activePlayerIds.filter(function (playerId) { return playerId !== winnerId; });
    } else {
        if (!participantMap[input.discarderId] || input.discarderId === winnerId ||
            activePlayerIds.indexOf(input.discarderId) === -1) {
            throw settlementError('INVALID_DISCARDER', '点炮者必须是另一名活跃玩家');
        }
        payerIds = [input.discarderId];
    }
    if (payerIds.length === 0) {
        throw settlementError('NO_PAYERS', '和牌事件至少需要一名付款人');
    }

    return {
        id: (input.eventId || 'win') + ':' + winnerId,
        type: 'win',
        reason: isSelfDraw ? '自摸' : '点炮',
        transfers: payerIds.map(function (payerId) {
            return { from: payerId, to: winnerId, amount: amount };
        }),
        formula: isSelfDraw && rules.selfDrawMode === 'addBase' ?
            rules.baseScore + '×2^' + input.fan + '+' + rules.baseScore :
            rules.baseScore + '×2^' + (isSelfDraw ? input.fan + 1 : input.fan),
        metadata: {
            fan: input.fan,
            baseScore: rules.baseScore,
            isSelfDraw: isSelfDraw,
            selfDrawMode: rules.selfDrawMode,
            paymentPerPlayer: amount
        }
    };
}

function settleWinEvent(input, inputRules) {
    input = input || {};
    var rules = resolveRules(inputRules || input.rules);
    var winners = input.winners || [];
    if (winners.length === 0) throw settlementError('NO_WINNERS', '和牌事件至少需要一名和牌者');
    if (input.isSelfDraw && winners.length !== 1) {
        throw settlementError('MULTIPLE_SELF_DRAW_WINNERS', '自摸事件只能有一名和牌者');
    }

    var seenWinners = {};
    winners.forEach(function (winner) {
        if (!winner || seenWinners[winner.playerId]) {
            throw settlementError('INVALID_WINNERS', '和牌者不能重复且必须提供玩家ID');
        }
        seenWinners[winner.playerId] = true;
    });

    var transactions = winners.map(function (winner) {
        return createWinTransaction({
            eventId: input.eventId,
            participantIds: input.participantIds,
            activePlayerIds: input.activePlayerIds,
            winnerId: winner.playerId,
            fan: winner.fan,
            isSelfDraw: input.isSelfDraw,
            discarderId: input.discarderId
        }, rules);
    });
    return {
        transactions: transactions,
        changes: ledger.calculateChanges(input.participantIds, transactions),
        rules: rules
    };
}

function normalizeKongType(type) {
    if (type === 'directKong' || type === 'openKong') return 'directKong';
    if (type === 'addedKong') return 'addedKong';
    if (type === 'concealedKong') return 'concealedKong';
    return null;
}

function createKongTransaction(input, inputRules) {
    input = input || {};
    var rules = resolveRules(inputRules || input.rules);
    var participantMap = validateParticipants(input.participantIds);
    var activePlayerIds = validateActivePlayers(input.activePlayerIds, participantMap);
    var actorId = input.actorId;
    if (!participantMap[actorId] || activePlayerIds.indexOf(actorId) === -1) {
        throw settlementError('INVALID_KONG_ACTOR', '杠牌者必须是本局活跃玩家');
    }
    var type = normalizeKongType(input.kongType);
    if (!type) throw settlementError('INVALID_KONG_TYPE', '未知的杠牌类型');
    if (type === 'addedKong' && input.robbed) return null;

    var payerIds;
    var amount;
    if (type === 'directKong') {
        if (!participantMap[input.sourcePlayerId] || input.sourcePlayerId === actorId ||
            activePlayerIds.indexOf(input.sourcePlayerId) === -1) {
            throw settlementError('INVALID_KONG_SOURCE', '点杠者必须是另一名活跃玩家');
        }
        payerIds = [input.sourcePlayerId];
        amount = rules.baseScore * 2;
    } else {
        payerIds = activePlayerIds.filter(function (playerId) { return playerId !== actorId; });
        amount = rules.baseScore * (type === 'concealedKong' ? 2 : 1);
    }
    if (payerIds.length === 0) {
        throw settlementError('NO_PAYERS', '杠牌事件至少需要一名付款人');
    }

    return {
        id: (input.eventId || 'kong') + ':' + actorId,
        type: 'kong',
        reason: type === 'directKong' ? '直杠' : (type === 'addedKong' ? '补杠' : '暗杠'),
        transfers: payerIds.map(function (payerId) {
            return { from: payerId, to: actorId, amount: amount };
        }),
        formula: amount + '×' + payerIds.length + '家',
        metadata: {
            kongType: type,
            baseScore: rules.baseScore,
            paymentPerPlayer: amount,
            robbed: false
        }
    };
}

module.exports = {
    DEFAULT_RULES: DEFAULT_RULES,
    resolveRules: resolveRules,
    winPayment: winPayment,
    settleWinEvent: settleWinEvent,
    createKongTransaction: createKongTransaction
};
