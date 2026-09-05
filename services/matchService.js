'use strict';

var storageService = require('./storageService.js');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function matchError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
}

function ensureCollections(data) {
    var next = clone(data || {});
    if (!Array.isArray(next.activeMatches)) next.activeMatches = [];
    if (!Array.isArray(next.completedMatches)) next.completedMatches = [];
    return next;
}

function findMatch(data, matchId) {
    var source = data || {};
    var active = (source.activeMatches || []).find(function (match) { return match.id === matchId; });
    if (active) return { match: clone(active), collection: 'activeMatches' };
    var completed = (source.completedMatches || []).find(function (match) { return match.id === matchId; });
    return completed ? { match: clone(completed), collection: 'completedMatches' } : null;
}

function listMatches(data, variant, status) {
    var source = data || {};
    var collection = status === 'completed' ? source.completedMatches : source.activeMatches;
    return (collection || []).filter(function (match) {
        return !variant || match.variant === variant;
    }).map(clone).sort(function (a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
}

function upsertMatch(data, match) {
    if (!match || !match.id) throw matchError('INVALID_MATCH', '牌局缺少稳定ID');
    var next = ensureCollections(data);
    next.activeMatches = next.activeMatches.filter(function (item) { return item.id !== match.id; });
    next.completedMatches = next.completedMatches.filter(function (item) { return item.id !== match.id; });
    var target = match.status === 'completed' ? 'completedMatches' : 'activeMatches';
    next[target].push(clone(match));
    return next;
}

function persistMatch(adapter, data, match) {
    return storageService.save(adapter, upsertMatch(data, match));
}

function saveRoundDraft(adapter, data, matchId, roundDraft) {
    var found = findMatch(data, matchId);
    if (!found || found.collection !== 'activeMatches') {
        throw matchError('ACTIVE_MATCH_NOT_FOUND', '找不到要继续的进行中牌局');
    }
    found.match.currentRound = roundDraft ? clone(roundDraft) : null;
    found.match.updatedAt = new Date().toISOString();
    return persistMatch(adapter, data, found.match);
}

module.exports = {
    findMatch: findMatch,
    listMatches: listMatches,
    upsertMatch: upsertMatch,
    persistMatch: persistMatch,
    saveRoundDraft: saveRoundDraft
};
