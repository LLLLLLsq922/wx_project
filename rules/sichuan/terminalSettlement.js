'use strict';

var ledger = require('../../core/ledger.js');
var settlement = require('./settlement.js');

var DEFAULT_RULES = {
    baseScore: 1,
    huazhuEnabled: true,
    dajiaoEnabled: true,
    taxRefundEnabled: true
};

function terminalError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
}

function resolveRules(inputRules) {
    var rules = {};
    Object.keys(DEFAULT_RULES).forEach(function (key) { rules[key] = DEFAULT_RULES[key]; });
    Object.keys(inputRules || {}).forEach(function (key) { rules[key] = inputRules[key]; });
    settlement.resolveRules(rules);
    return rules;
}

function validateParticipants(participantIds) {
    if (!Array.isArray(participantIds) || participantIds.length !== 4) {
        throw terminalError('INVALID_PARTICIPANTS', '川麻牌局必须有四名玩家');
    }
    var result = {};
    participantIds.forEach(function (playerId) {
        if (typeof playerId !== 'string' || !playerId || result[playerId]) {
            throw terminalError('INVALID_PARTICIPANTS', '玩家ID必须非空且不能重复');
        }
        result[playerId] = true;
    });
    return result;
}

function uniquePlayerIds(ids, participantMap, errorCode) {
    var result = [];
    var seen = {};
    (ids || []).forEach(function (playerId) {
        if (!participantMap[playerId] || seen[playerId]) {
            throw terminalError(errorCode, '玩家列表包含未知或重复玩家');
        }
        seen[playerId] = true;
        result.push(playerId);
    });
    return result;
}

function normalizeDajiaoResults(results, participantMap) {
    var byPlayer = {};
    (results || []).forEach(function (result) {
        if (!result || !participantMap[result.playerId] || byPlayer[result.playerId]) {
            throw terminalError('INVALID_DAJIAO_RESULTS', '大叫结果包含未知或重复玩家');
        }
        if (typeof result.isReady !== 'boolean') {
            throw terminalError('INVALID_DAJIAO_RESULTS', '大叫结果必须明确是否听牌');
        }
        if (result.isReady && (typeof result.maxFan !== 'number' || !isFinite(result.maxFan) ||
            result.maxFan < 0 || Math.floor(result.maxFan) !== result.maxFan)) {
            throw terminalError('INVALID_DAJIAO_FAN', '听牌者的最高理论番必须是非负整数');
        }
        byPlayer[result.playerId] = {
            playerId: result.playerId,
            isReady: result.isReady,
            maxFan: result.isReady ? result.maxFan : null,
            waits: result.waits || []
        };
    });
    return byPlayer;
}

function createTransaction(id, type, reason, transfers, metadata) {
    if (transfers.length === 0) return null;
    return {
        id: id,
        type: type,
        reason: reason,
        transfers: transfers,
        formula: metadata.formula,
        metadata: metadata
    };
}

function createHuazhuTransaction(participantIds, huazhuIds, rules, eventId) {
    var huazhuMap = {};
    huazhuIds.forEach(function (playerId) { huazhuMap[playerId] = true; });
    var nonHuazhu = participantIds.filter(function (playerId) { return !huazhuMap[playerId]; });
    var amount = rules.baseScore * 16;
    var transfers = [];
    huazhuIds.forEach(function (from) {
        nonHuazhu.forEach(function (to) {
            transfers.push({ from: from, to: to, amount: amount });
        });
    });
    return createTransaction(eventId + ':huazhu', 'huazhu', '查花猪', transfers, {
        baseScore: rules.baseScore,
        paymentPerOpponent: amount,
        huazhuPlayerIds: huazhuIds.slice(),
        formula: rules.baseScore + '×16'
    });
}

function createDajiaoTransaction(eligibleIds, dajiaoByPlayer, rules, eventId) {
    var ready = eligibleIds.filter(function (playerId) { return dajiaoByPlayer[playerId].isReady; });
    var unready = eligibleIds.filter(function (playerId) { return !dajiaoByPlayer[playerId].isReady; });
    var transfers = [];
    unready.forEach(function (from) {
        ready.forEach(function (to) {
            transfers.push({
                from: from,
                to: to,
                amount: rules.baseScore * Math.pow(2, dajiaoByPlayer[to].maxFan)
            });
        });
    });
    return createTransaction(eventId + ':dajiao', 'dajiao', '查大叫', transfers, {
        baseScore: rules.baseScore,
        readyPlayerIds: ready,
        unreadyPlayerIds: unready,
        theoreticalFans: ready.map(function (playerId) {
            return { playerId: playerId, maxFan: dajiaoByPlayer[playerId].maxFan };
        }),
        formula: '底分×2^听牌者最高理论番'
    });
}

function createTaxRefundTransaction(kongTransactions, liablePlayerIds, eventId) {
    var liable = {};
    liablePlayerIds.forEach(function (playerId) { liable[playerId] = true; });
    var transfers = [];
    (kongTransactions || []).forEach(function (transaction) {
        if (!transaction || transaction.type !== 'kong') return;
        (transaction.transfers || []).forEach(function (transfer) {
            if (liable[transfer.to]) {
                transfers.push({ from: transfer.to, to: transfer.from, amount: transfer.amount });
            }
        });
    });
    return createTransaction(eventId + ':taxRefund', 'taxRefund', '退税', transfers, {
        liablePlayerIds: liablePlayerIds.slice(),
        sourceTransactionIds: (kongTransactions || []).filter(function (transaction) {
            return transaction && transaction.type === 'kong';
        }).map(function (transaction) { return transaction.id; }),
        formula: '未听牌或花猪玩家退还本局全部杠收入'
    });
}

function settleExhaustiveDraw(input, inputRules) {
    input = input || {};
    if (!input.wallExhausted) {
        throw terminalError('NOT_WALL_EXHAUSTED', '查大叫与退税只能在牌墙耗尽时结算');
    }
    var participantIds = input.participantIds || [];
    var participants = validateParticipants(participantIds);
    var rules = resolveRules(inputRules || input.rules);
    var eventId = input.eventId || 'wall-exhausted';
    var winnerIds = uniquePlayerIds(input.winnerIds, participants, 'INVALID_WINNERS');
    var winners = {};
    winnerIds.forEach(function (playerId) { winners[playerId] = true; });
    var huazhuIds = rules.huazhuEnabled ?
        uniquePlayerIds(input.huazhuPlayerIds, participants, 'INVALID_HUAZHU_PLAYERS') : [];
    var huazhu = {};
    huazhuIds.forEach(function (playerId) {
        if (winners[playerId]) {
            throw terminalError('WINNER_CANNOT_BE_HUAZHU', '已和牌玩家不能被判定为花猪');
        }
        huazhu[playerId] = true;
    });
    var eligibleIds = participantIds.filter(function (playerId) {
        return !winners[playerId] && !huazhu[playerId];
    });
    var dajiaoByPlayer = normalizeDajiaoResults(input.dajiaoResults, participants);
    if (rules.dajiaoEnabled || rules.taxRefundEnabled) {
        var eligible = {};
        eligibleIds.forEach(function (playerId) { eligible[playerId] = true; });
        Object.keys(dajiaoByPlayer).forEach(function (playerId) {
            if (!eligible[playerId]) {
                throw terminalError('INELIGIBLE_DAJIAO_PLAYER', '已和牌或花猪玩家不能参加查大叫');
            }
        });
        eligibleIds.forEach(function (playerId) {
            if (!dajiaoByPlayer[playerId]) {
                throw terminalError('MISSING_DAJIAO_RESULT', '每名未和且非花猪玩家都必须提供大叫判定');
            }
        });
    }

    var transactions = [];
    if (rules.huazhuEnabled) {
        var huazhuTransaction = createHuazhuTransaction(participantIds, huazhuIds, rules, eventId);
        if (huazhuTransaction) transactions.push(huazhuTransaction);
    }
    if (rules.dajiaoEnabled) {
        var dajiaoTransaction = createDajiaoTransaction(eligibleIds, dajiaoByPlayer, rules, eventId);
        if (dajiaoTransaction) transactions.push(dajiaoTransaction);
    }
    if (rules.taxRefundEnabled) {
        var unreadyIds = eligibleIds.filter(function (playerId) {
            return !dajiaoByPlayer[playerId].isReady;
        });
        var refundTransaction = createTaxRefundTransaction(
            input.kongTransactions,
            huazhuIds.concat(unreadyIds),
            eventId
        );
        if (refundTransaction) transactions.push(refundTransaction);
    }

    return {
        transactions: transactions,
        changes: ledger.calculateChanges(participantIds, transactions),
        order: transactions.map(function (transaction) { return transaction.type; }),
        huazhuPlayerIds: huazhuIds,
        dajiaoResults: eligibleIds.map(function (playerId) {
            return dajiaoByPlayer[playerId];
        }).filter(Boolean),
        rules: rules
    };
}

module.exports = {
    DEFAULT_RULES: DEFAULT_RULES,
    resolveRules: resolveRules,
    createHuazhuTransaction: createHuazhuTransaction,
    createDajiaoTransaction: createDajiaoTransaction,
    createTaxRefundTransaction: createTaxRefundTransaction,
    settleExhaustiveDraw: settleExhaustiveDraw
};
