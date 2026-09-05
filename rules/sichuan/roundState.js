'use strict';

var tiles = require('../../core/tiles.js');
var ledger = require('../../core/ledger.js');
var settlement = require('./settlement.js');
var terminalSettlement = require('./terminalSettlement.js');

var MODES = {
    NORMAL: 'normal',
    BLOOD_BATTLE: 'bloodBattle',
    BLOOD_RIVER: 'bloodRiver'
};

var EXCHANGE_DIRECTIONS = ['clockwise', 'counterclockwise', 'opposite'];
var DIRECTION_NAMES = {
    clockwise: '顺时针',
    counterclockwise: '逆时针',
    opposite: '对家'
};

var DEFAULT_RULES = {
    huansanzhangEnabled: true,
    dingqueEnabled: true,
    menqingZhongzhangEnabled: true,
    shibaluohanEnabled: true,
    eventFansEnabled: true,
    baseScore: 1,
    selfDrawMode: 'addBase',
    huazhuEnabled: true,
    dajiaoEnabled: true,
    taxRefundEnabled: true
};

function roundError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function resolveRules(inputRules) {
    var rules = {};
    Object.keys(DEFAULT_RULES).forEach(function (key) { rules[key] = DEFAULT_RULES[key]; });
    Object.keys(inputRules || {}).forEach(function (key) { rules[key] = inputRules[key]; });
    settlement.resolveRules(rules);
    return rules;
}

function participantMap(participantIds) {
    if (!Array.isArray(participantIds) || participantIds.length !== 4) {
        throw roundError('INVALID_PARTICIPANTS', '川麻牌局必须有四名玩家');
    }
    var result = {};
    participantIds.forEach(function (playerId) {
        if (typeof playerId !== 'string' || !playerId || result[playerId]) {
            throw roundError('INVALID_PARTICIPANTS', '玩家ID必须非空且不能重复');
        }
        result[playerId] = true;
    });
    return result;
}

function validateMode(mode) {
    if ([MODES.NORMAL, MODES.BLOOD_BATTLE, MODES.BLOOD_RIVER].indexOf(mode) === -1) {
        throw roundError('INVALID_SICHUAN_MODE', '未知的川麻玩法');
    }
}

function chooseExchangeDirection(random) {
    var value = (random || Math.random)();
    if (typeof value !== 'number' || !isFinite(value) || value < 0 || value >= 1) {
        throw roundError('INVALID_RANDOM_VALUE', '随机函数必须返回大于等于0且小于1的数字');
    }
    return EXCHANGE_DIRECTIONS[Math.floor(value * EXCHANGE_DIRECTIONS.length)];
}

function exchangeTargetIndex(sourceIndex, direction, count) {
    if (direction === 'clockwise') return (sourceIndex + 1) % count;
    if (direction === 'counterclockwise') return (sourceIndex + count - 1) % count;
    if (direction === 'opposite') return (sourceIndex + 2) % count;
    throw roundError('INVALID_EXCHANGE_DIRECTION', '未知的换三张方向');
}

function normalizeExchangeTiles(selection, playerId) {
    if (!Array.isArray(selection) || selection.length !== 3) {
        throw roundError('INVALID_EXCHANGE_SELECTION', playerId + '必须选择三张牌');
    }
    var normalized = selection.map(tiles.normalizeTileId);
    if (normalized.some(function (tileId) { return !/^[msp][1-9]$/.test(tileId || ''); })) {
        throw roundError('INVALID_EXCHANGE_TILE', '换三张只能使用普通万条筒');
    }
    var suit = normalized[0].charAt(0);
    if (!normalized.every(function (tileId) { return tileId.charAt(0) === suit; })) {
        throw roundError('EXCHANGE_SUIT_MISMATCH', '换出的三张牌必须为同一花色');
    }
    return normalized;
}

function createExchangeRecord(input) {
    input = input || {};
    var participants = input.participantIds || [];
    participantMap(participants);
    var direction = input.direction || chooseExchangeDirection(input.random);
    if (EXCHANGE_DIRECTIONS.indexOf(direction) === -1) {
        throw roundError('INVALID_EXCHANGE_DIRECTION', '未知的换三张方向');
    }
    var selections = input.selections || {};
    var normalizedSelections = {};
    var selectedTiles = [];
    participants.forEach(function (playerId) {
        normalizedSelections[playerId] = normalizeExchangeTiles(selections[playerId], playerId);
        selectedTiles = selectedTiles.concat(normalizedSelections[playerId]);
    });
    var copies = tiles.validateCopies({ concealedTiles: selectedTiles });
    if (!copies.valid) {
        throw roundError('INVALID_EXCHANGE_COPIES', '换三张记录包含超过四张的同牌');
    }

    var receivedBy = {};
    var transfers = participants.map(function (playerId, index) {
        var targetId = participants[exchangeTargetIndex(index, direction, participants.length)];
        receivedBy[targetId] = normalizedSelections[playerId].slice();
        return {
            from: playerId,
            to: targetId,
            tiles: normalizedSelections[playerId].slice()
        };
    });
    return {
        type: 'exchangeThree',
        direction: direction,
        directionName: DIRECTION_NAMES[direction],
        selections: normalizedSelections,
        receivedBy: receivedBy,
        transfers: transfers
    };
}

function initialPhase(rules) {
    if (rules.huansanzhangEnabled) return 'exchange';
    if (rules.dingqueEnabled) return 'dingque';
    return 'play';
}

function zeroChanges(participantIds) {
    var result = {};
    participantIds.forEach(function (playerId) { result[playerId] = 0; });
    return result;
}

function createRoundState(input) {
    input = input || {};
    var participants = (input.participantIds || []).slice();
    var participantsById = participantMap(participants);
    validateMode(input.mode);
    if (!participantsById[input.dealerId]) {
        throw roundError('INVALID_DEALER', '庄家必须是本局玩家');
    }
    var rules = resolveRules(input.rules);
    var exchangeDirection = rules.huansanzhangEnabled ?
        chooseExchangeDirection(input.random) : null;
    return {
        id: input.roundId || 'round',
        mode: input.mode,
        participantIds: participants,
        dealerId: input.dealerId,
        rules: rules,
        phase: initialPhase(rules),
        exchangeDirection: exchangeDirection,
        exchange: null,
        dingqueSuits: null,
        activePlayerIds: participants.slice(),
        winnerIds: [],
        firstWinEvent: null,
        events: [],
        transactions: [],
        scoreChanges: zeroChanges(participants),
        ended: false,
        endReason: null,
        nextDealerSuggestion: null
    };
}

function assertPhase(state, phase) {
    if (!state || state.ended || state.phase !== phase) {
        throw roundError('INVALID_ROUND_PHASE', '当前阶段不能执行该操作');
    }
}

function refreshChanges(state) {
    state.scoreChanges = ledger.calculateChanges(state.participantIds, state.transactions);
}

function recordExchange(state, selections) {
    assertPhase(state, 'exchange');
    var next = clone(state);
    var record = createExchangeRecord({
        participantIds: next.participantIds,
        selections: selections,
        direction: next.exchangeDirection
    });
    next.exchange = record;
    next.events.push(record);
    next.phase = next.rules.dingqueEnabled ? 'dingque' : 'play';
    return next;
}

function recordDingque(state, suitsByPlayer) {
    assertPhase(state, 'dingque');
    var next = clone(state);
    var suits = {};
    next.participantIds.forEach(function (playerId) {
        var suit = suitsByPlayer && suitsByPlayer[playerId];
        if (['m', 's', 'p'].indexOf(suit) === -1) {
            throw roundError('INVALID_DINGQUE_RECORD', '每名玩家都必须选择有效定缺花色');
        }
        suits[playerId] = suit;
    });
    next.dingqueSuits = suits;
    next.events.push({ type: 'dingque', suits: clone(suits) });
    next.phase = 'play';
    return next;
}

function validateHandSnapshots(state, winners) {
    if (state.mode !== MODES.BLOOD_RIVER) return;
    winners.forEach(function (winner) {
        var snapshot = winner.handSnapshot;
        if (!snapshot || !Array.isArray(snapshot.concealedTiles) ||
            !Array.isArray(snapshot.melds) || !snapshot.winTile) {
            throw roundError('MISSING_HAND_SNAPSHOT', '血流成河每次和牌都必须保存完整手牌与和牌张');
        }
        var allTiles = snapshot.concealedTiles.slice();
        snapshot.melds.forEach(function (meld) {
            allTiles = allTiles.concat((meld && (meld.tiles || meld.cards)) || []);
        });
        var allValid = allTiles.every(function (tile) {
            return /^[msp][1-9]$/.test(tiles.normalizeTileId(tile) || '');
        });
        var copies = tiles.validateCopies(snapshot);
        var melds = tiles.validateMelds(snapshot.melds);
        var counts = tiles.getHandCounts(snapshot.concealedTiles, snapshot.melds);
        var normalizedWinTile = tiles.normalizeTileId(snapshot.winTile);
        var hasWinTile = snapshot.concealedTiles.some(function (tile) {
            return tiles.normalizeTileId(tile) === normalizedWinTile;
        });
        if (!allValid || !copies.valid || !melds.valid || counts.structural !== 14 ||
            counts.physical !== 14 + counts.kongCount || !hasWinTile) {
            throw roundError('INCOMPLETE_HAND_SNAPSHOT', '血流和牌快照必须包含合法的完整牌面');
        }
    });
}

function endRound(state, reason) {
    state.ended = true;
    state.phase = 'ended';
    state.endReason = reason;
    state.nextDealerSuggestion = suggestNextDealer(state);
}

function recordWin(state, event) {
    assertPhase(state, 'play');
    event = event || {};
    var next = clone(state);
    var winners = clone(event.winners || []);
    validateHandSnapshots(next, winners);
    var settled = settlement.settleWinEvent({
        eventId: event.id || next.id + '-win-' + (next.events.length + 1),
        participantIds: next.participantIds,
        activePlayerIds: next.activePlayerIds,
        winners: winners,
        discarderId: event.discarderId,
        isSelfDraw: !!event.isSelfDraw
    }, next.rules);
    var normalizedEvent = {
        id: event.id || next.id + '-win-' + (next.events.length + 1),
        type: 'win',
        winners: winners,
        discarderId: event.discarderId || null,
        isSelfDraw: !!event.isSelfDraw,
        transactionIds: settled.transactions.map(function (transaction) { return transaction.id; })
    };
    next.events.push(normalizedEvent);
    next.transactions = next.transactions.concat(settled.transactions);
    if (!next.firstWinEvent) next.firstWinEvent = clone(normalizedEvent);

    winners.forEach(function (winner) {
        if (next.winnerIds.indexOf(winner.playerId) === -1) next.winnerIds.push(winner.playerId);
        if (next.mode === MODES.BLOOD_BATTLE) {
            next.activePlayerIds = next.activePlayerIds.filter(function (playerId) {
                return playerId !== winner.playerId;
            });
        }
    });
    refreshChanges(next);

    if (next.mode === MODES.NORMAL) {
        endRound(next, 'win');
    } else if (next.mode === MODES.BLOOD_BATTLE && next.activePlayerIds.length <= 1) {
        endRound(next, 'threePlayersWon');
    }
    return next;
}

function recordKong(state, event) {
    assertPhase(state, 'play');
    event = event || {};
    var next = clone(state);
    var transaction = settlement.createKongTransaction({
        eventId: event.id || next.id + '-kong-' + (next.events.length + 1),
        participantIds: next.participantIds,
        activePlayerIds: next.activePlayerIds,
        actorId: event.actorId,
        sourcePlayerId: event.sourcePlayerId,
        kongType: event.kongType,
        robbed: !!event.robbed
    }, next.rules);
    next.events.push({
        id: event.id || next.id + '-kong-' + (next.events.length + 1),
        type: 'kong',
        actorId: event.actorId,
        sourcePlayerId: event.sourcePlayerId || null,
        kongType: event.kongType,
        robbed: !!event.robbed,
        transactionId: transaction ? transaction.id : null
    });
    if (transaction) next.transactions.push(transaction);
    refreshChanges(next);
    return next;
}

function recordWallExhausted(state, terminalInput) {
    assertPhase(state, 'play');
    var next = clone(state);
    terminalInput = terminalInput || {};
    var eventId = terminalInput.id || next.id + '-wall-exhausted';
    var terminalResult = terminalSettlement.settleExhaustiveDraw({
        eventId: eventId,
        participantIds: next.participantIds,
        winnerIds: next.winnerIds,
        huazhuPlayerIds: terminalInput.huazhuPlayerIds,
        dajiaoResults: terminalInput.dajiaoResults,
        kongTransactions: next.transactions,
        wallExhausted: true
    }, next.rules);
    next.transactions = next.transactions.concat(terminalResult.transactions);
    next.events.push({
        id: eventId,
        type: 'wallExhausted',
        huazhuPlayerIds: terminalResult.huazhuPlayerIds,
        dajiaoResults: terminalResult.dajiaoResults,
        transactionIds: terminalResult.transactions.map(function (transaction) {
            return transaction.id;
        })
    });
    refreshChanges(next);
    endRound(next, 'wallExhausted');
    return next;
}

function suggestNextDealer(state) {
    if (!state.firstWinEvent) return state.dealerId;
    if (state.firstWinEvent.winners.length > 1) return state.firstWinEvent.discarderId;
    return state.firstWinEvent.winners[0].playerId;
}

module.exports = {
    MODES: MODES,
    EXCHANGE_DIRECTIONS: EXCHANGE_DIRECTIONS,
    DEFAULT_RULES: DEFAULT_RULES,
    resolveRules: resolveRules,
    chooseExchangeDirection: chooseExchangeDirection,
    createExchangeRecord: createExchangeRecord,
    createRoundState: createRoundState,
    recordExchange: recordExchange,
    recordDingque: recordDingque,
    recordWin: recordWin,
    recordKong: recordKong,
    recordWallExhausted: recordWallExhausted,
    suggestNextDealer: suggestNextDealer
};
