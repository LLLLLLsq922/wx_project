'use strict';

var ledger = require('../../core/ledger.js');
var roundState = require('./roundState.js');

var FORMAT_TYPES = {
    FIXED_ROUNDS: 'fixedRounds',
    CUSTOM_ROUNDS: 'customRounds',
    EACH_DEALER_ONCE: 'eachDealerOnce',
    UNLIMITED: 'unlimited'
};

function matchError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function validatePlayers(players) {
    if (!Array.isArray(players) || players.length !== 4) {
        throw matchError('INVALID_PLAYERS', '川麻整场必须有四名玩家');
    }
    var seen = {};
    return players.map(function (player, index) {
        if (!player || typeof player.id !== 'string' || !player.id || seen[player.id]) {
            throw matchError('INVALID_PLAYERS', '玩家ID必须非空且不能重复');
        }
        seen[player.id] = true;
        return {
            id: player.id,
            name: player.name || ('玩家' + (index + 1)),
            color: player.color || '',
            initialSeat: index
        };
    });
}

function validateFormat(format) {
    format = format || {};
    var type = format.type;
    if ([FORMAT_TYPES.FIXED_ROUNDS, FORMAT_TYPES.CUSTOM_ROUNDS].indexOf(type) !== -1) {
        if (typeof format.roundCount !== 'number' || !isFinite(format.roundCount) ||
            Math.floor(format.roundCount) !== format.roundCount || format.roundCount <= 0) {
            throw matchError('INVALID_ROUND_COUNT', '固定或自定义局数必须是正整数');
        }
        return { type: type, roundCount: format.roundCount };
    }
    if (type === FORMAT_TYPES.EACH_DEALER_ONCE || type === FORMAT_TYPES.UNLIMITED) {
        return { type: type };
    }
    throw matchError('INVALID_MATCH_FORMAT', '未知的川麻赛制');
}

function playerIds(players) {
    return players.map(function (player) { return player.id; });
}

function zeroMap(ids) {
    var result = {};
    ids.forEach(function (id) { result[id] = 0; });
    return result;
}

function containsPlayer(ids, playerId) {
    return ids.indexOf(playerId) !== -1;
}

function validateMode(mode) {
    var validModes = Object.keys(roundState.MODES).map(function (key) {
        return roundState.MODES[key];
    });
    if (validModes.indexOf(mode) === -1) {
        throw matchError('INVALID_SICHUAN_MODE', '未知的川麻玩法');
    }
    return mode;
}

function sameRules(actual, expected) {
    var normalizedActual = roundState.resolveRules(actual);
    var normalizedExpected = roundState.resolveRules(expected);
    var keys = Object.keys(normalizedExpected).sort();
    return keys.length === Object.keys(normalizedActual).length && keys.every(function (key) {
        return normalizedActual[key] === normalizedExpected[key];
    });
}

function createRankings(players, totals) {
    return players.map(function (player) {
        return {
            playerId: player.id,
            name: player.name,
            score: totals[player.id],
            initialSeat: player.initialSeat
        };
    }).sort(function (a, b) {
        if (a.score !== b.score) return b.score - a.score;
        return a.initialSeat - b.initialSeat;
    }).map(function (entry, index) {
        entry.rank = index + 1;
        return entry;
    });
}

function createMatch(input) {
    input = input || {};
    var players = validatePlayers(input.players);
    var ids = playerIds(players);
    validateMode(input.mode);
    if (!containsPlayer(ids, input.initialDealerId)) {
        throw matchError('INVALID_INITIAL_DEALER', '初始庄家必须是本场玩家');
    }
    var format = validateFormat(input.format);
    var totals = zeroMap(ids);
    var timestamp = input.timestamp || new Date().toISOString();
    return {
        id: input.matchId || 'sichuan-match',
        variant: 'sichuan',
        mode: input.mode,
        status: 'active',
        rulesSnapshot: roundState.resolveRules(input.rules),
        players: players,
        format: format,
        initialDealerId: input.initialDealerId,
        nextDealerId: input.initialDealerId,
        dealerCounts: zeroMap(ids),
        rounds: [],
        scoreTotals: totals,
        rankings: createRankings(players, totals),
        manualEnded: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null
    };
}

function samePlayers(actual, expected) {
    return actual.length === expected.length && actual.every(function (playerId, index) {
        return playerId === expected[index];
    });
}

function deriveNextDealer(round, participantIds) {
    var firstWin = (round.events || []).find(function (event) { return event.type === 'win'; });
    if (!firstWin) return round.dealerId;
    var winners = firstWin.winners || [];
    if (winners.length === 0) {
        throw matchError('INVALID_WIN_EVENT', '和牌事件缺少和牌者');
    }
    if (winners.length > 1) {
        if (!containsPlayer(participantIds, firstWin.discarderId)) {
            throw matchError('INVALID_WIN_EVENT', '一炮多响事件缺少有效点炮者');
        }
        return firstWin.discarderId;
    }
    if (!containsPlayer(participantIds, winners[0].playerId)) {
        throw matchError('INVALID_WIN_EVENT', '和牌事件包含未知玩家');
    }
    return winners[0].playerId;
}

function autoComplete(format, roundCount, dealerCounts, participantIds) {
    if (format.type === FORMAT_TYPES.FIXED_ROUNDS || format.type === FORMAT_TYPES.CUSTOM_ROUNDS) {
        return roundCount >= format.roundCount;
    }
    if (format.type === FORMAT_TYPES.EACH_DEALER_ONCE) {
        return participantIds.every(function (playerId) { return dealerCounts[playerId] > 0; });
    }
    return false;
}

function replayMatch(inputMatch, options) {
    options = options || {};
    var match = clone(inputMatch);
    if (match.variant !== 'sichuan') {
        throw matchError('INVALID_MATCH_VARIANT', '该整场记录不是川麻玩法');
    }
    var players = validatePlayers(match.players);
    var ids = playerIds(players);
    var format = validateFormat(match.format);
    validateMode(match.mode);
    match.rulesSnapshot = roundState.resolveRules(match.rulesSnapshot);
    if (!containsPlayer(ids, match.initialDealerId)) {
        throw matchError('INVALID_INITIAL_DEALER', '初始庄家必须是本场玩家');
    }
    var totals = zeroMap(ids);
    var dealerCounts = zeroMap(ids);
    var nextDealerId = match.initialDealerId;
    var rebuiltRounds = [];
    var completed = false;

    (match.rounds || []).forEach(function (rawRound, index) {
        if (completed) {
            throw matchError('ROUND_AFTER_MATCH_COMPLETION', '赛制已结束，不能继续保留后续牌局');
        }
        var round = clone(rawRound);
        if (!round.ended || round.phase !== 'ended') {
            throw matchError('ROUND_NOT_ENDED', '只有已经结束的牌局才能计入整场');
        }
        if (!samePlayers(round.participantIds || [], ids)) {
            throw matchError('ROUND_PLAYER_MISMATCH', '牌局玩家与整场玩家不一致');
        }
        if (round.mode !== match.mode) {
            throw matchError('ROUND_MODE_MISMATCH', '牌局玩法与整场玩法不一致');
        }
        if (!sameRules(round.rules, match.rulesSnapshot)) {
            throw matchError('ROUND_RULES_MISMATCH', '牌局规则快照与整场规则不一致');
        }
        round.index = index;
        round.dealerId = nextDealerId;
        round.rules = clone(match.rulesSnapshot);
        var changes = ledger.calculateChanges(ids, round.transactions || []);
        ids.forEach(function (playerId) { totals[playerId] += changes[playerId]; });
        dealerCounts[round.dealerId]++;
        var suggested = deriveNextDealer(round, ids);
        var actualNextDealer = round.dealerOverrideId || suggested;
        if (!containsPlayer(ids, actualNextDealer)) {
            throw matchError('INVALID_DEALER_OVERRIDE', '人工指定的下一庄必须是本场玩家');
        }
        round.scoreChanges = changes;
        round.nextDealerSuggestion = suggested;
        round.nextDealerId = actualNextDealer;
        rebuiltRounds.push(round);
        nextDealerId = actualNextDealer;
        completed = autoComplete(format, rebuiltRounds.length, dealerCounts, ids);
    });

    if (match.manualEnded && format.type !== FORMAT_TYPES.UNLIMITED) {
        throw matchError('MANUAL_END_NOT_ALLOWED', '只有不限局数赛制可以手动结束');
    }
    if (match.manualEnded) completed = true;
    match.players = players;
    match.format = format;
    match.rounds = rebuiltRounds;
    match.scoreTotals = totals;
    match.dealerCounts = dealerCounts;
    match.rankings = createRankings(players, totals);
    match.status = completed ? 'completed' : 'active';
    match.nextDealerId = completed ? null : nextDealerId;
    if (options.timestamp) match.updatedAt = options.timestamp;
    if (!completed) match.completedAt = null;
    return match;
}

function createNextRound(match, options) {
    options = options || {};
    var current = replayMatch(match);
    if (current.status !== 'active') {
        throw matchError('MATCH_COMPLETED', '整场已结束，不能开始新局');
    }
    return roundState.createRoundState({
        roundId: options.roundId || current.id + '-round-' + (current.rounds.length + 1),
        mode: current.mode,
        participantIds: playerIds(current.players),
        dealerId: current.nextDealerId,
        rules: current.rulesSnapshot,
        random: options.random
    });
}

function commitRound(match, completedRound, options) {
    options = options || {};
    var current = replayMatch(match);
    if (current.status !== 'active') {
        throw matchError('MATCH_COMPLETED', '整场已结束，不能提交新局');
    }
    if (!completedRound || !completedRound.ended || completedRound.phase !== 'ended') {
        throw matchError('ROUND_NOT_ENDED', '只有已经结束的牌局才能提交');
    }
    var ids = playerIds(current.players);
    if (!samePlayers(completedRound.participantIds || [], ids)) {
        throw matchError('ROUND_PLAYER_MISMATCH', '牌局玩家与整场玩家不一致');
    }
    if (completedRound.mode !== current.mode) {
        throw matchError('ROUND_MODE_MISMATCH', '牌局玩法与整场玩法不一致');
    }
    if (!sameRules(completedRound.rules, current.rulesSnapshot)) {
        throw matchError('ROUND_RULES_MISMATCH', '牌局规则快照与整场规则不一致');
    }
    if (completedRound.dealerId !== current.nextDealerId) {
        throw matchError('ROUND_DEALER_MISMATCH', '牌局庄家与整场建议庄家不一致');
    }
    if (current.rounds.some(function (round) { return round.id === completedRound.id; })) {
        throw matchError('DUPLICATE_ROUND_ID', '牌局ID不能重复');
    }
    if (options.dealerOverrideId && !containsPlayer(ids, options.dealerOverrideId)) {
        throw matchError('INVALID_DEALER_OVERRIDE', '人工指定的下一庄必须是本场玩家');
    }
    var storedRound = clone(completedRound);
    storedRound.dealerOverrideId = options.dealerOverrideId || null;
    current.rounds.push(storedRound);
    current.updatedAt = options.timestamp || new Date().toISOString();
    var rebuilt = replayMatch(current, { timestamp: current.updatedAt });
    if (rebuilt.status === 'completed') rebuilt.completedAt = current.updatedAt;
    return rebuilt;
}

function replaceRound(match, roundIndex, completedRound, options) {
    options = options || {};
    if (typeof roundIndex !== 'number' || Math.floor(roundIndex) !== roundIndex ||
        roundIndex < 0 || roundIndex >= (match.rounds || []).length) {
        throw matchError('INVALID_ROUND_INDEX', '要修改的牌局序号不存在');
    }
    if (!completedRound || !completedRound.ended || completedRound.phase !== 'ended') {
        throw matchError('ROUND_NOT_ENDED', '只能使用已经结束的牌局替换历史');
    }
    var draft = clone(match);
    var ids = playerIds(validatePlayers(draft.players));
    if (!samePlayers(completedRound.participantIds || [], ids)) {
        throw matchError('ROUND_PLAYER_MISMATCH', '牌局玩家与整场玩家不一致');
    }
    if (completedRound.mode !== draft.mode) {
        throw matchError('ROUND_MODE_MISMATCH', '牌局玩法与整场玩法不一致');
    }
    if (!sameRules(completedRound.rules, draft.rulesSnapshot)) {
        throw matchError('ROUND_RULES_MISMATCH', '牌局规则快照与整场规则不一致');
    }
    if (draft.rounds.some(function (round, index) {
        return index !== roundIndex && round.id === completedRound.id;
    })) {
        throw matchError('DUPLICATE_ROUND_ID', '牌局ID不能重复');
    }
    var replacement = clone(completedRound);
    var keepsOverride = !Object.prototype.hasOwnProperty.call(options, 'dealerOverrideId');
    replacement.dealerOverrideId = keepsOverride ?
        (draft.rounds[roundIndex].dealerOverrideId || null) : (options.dealerOverrideId || null);
    draft.rounds[roundIndex] = replacement;
    draft.updatedAt = options.timestamp || new Date().toISOString();
    return replayMatch(draft, { timestamp: draft.updatedAt });
}

function removeRoundsFrom(match, roundIndex, options) {
    options = options || {};
    if (typeof roundIndex !== 'number' || Math.floor(roundIndex) !== roundIndex ||
        roundIndex < 0 || roundIndex >= (match.rounds || []).length) {
        throw matchError('INVALID_ROUND_INDEX', '要撤销的牌局序号不存在');
    }
    var draft = clone(match);
    draft.rounds = draft.rounds.slice(0, roundIndex);
    draft.manualEnded = false;
    draft.updatedAt = options.timestamp || new Date().toISOString();
    draft.completedAt = null;
    return replayMatch(draft, { timestamp: draft.updatedAt });
}

function endUnlimitedMatch(match, options) {
    options = options || {};
    var current = replayMatch(match);
    if (current.format.type !== FORMAT_TYPES.UNLIMITED) {
        throw matchError('MANUAL_END_NOT_ALLOWED', '只有不限局数赛制可以手动结束');
    }
    if (current.status === 'completed') return current;
    current.manualEnded = true;
    current.updatedAt = options.timestamp || new Date().toISOString();
    current.completedAt = current.updatedAt;
    return replayMatch(current, { timestamp: current.updatedAt });
}

module.exports = {
    FORMAT_TYPES: FORMAT_TYPES,
    createMatch: createMatch,
    createNextRound: createNextRound,
    commitRound: commitRound,
    replaceRound: replaceRound,
    removeRoundsFrom: removeRoundsFrom,
    endUnlimitedMatch: endUnlimitedMatch,
    replayMatch: replayMatch,
    createRankings: createRankings
};
