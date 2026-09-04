'use strict';

var legacy = require('../../util/mahjongUtil.js');
var rulesData = require('../../util/rulesData.js');
var tiles = require('../../core/tiles.js');
var variants = require('../../core/variants.js');

function toLegacyTile(tile) {
    if (tile && typeof tile === 'object' && tile.name) return tile;
    var name = tiles.chineseNameFromId(tile);
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

function toLegacyMeld(meld) {
    if (meld.cards && (meld.type === '吃' || meld.type === '碰' || meld.type === '明杠' || meld.type === '暗杠')) {
        return meld;
    }
    var normalizedType = tiles.normalizeMeldType(meld.type);
    var definition = tiles.MELD_TYPES[normalizedType];
    return {
        type: definition ? definition.legacy : meld.type,
        cards: (meld.tiles || meld.cards || []).map(toLegacyTile)
    };
}

function normalizeInput(input) {
    input = input || {};
    var concealed = input.concealedTiles || input.handCards || [];
    var melds = input.melds || input.actionGroups || [];
    return {
        handCards: concealed.map(toLegacyTile),
        actionGroups: melds.map(toLegacyMeld),
        context: input.context || input.options || {}
    };
}

function validateInput(input) {
    var normalized = normalizeInput(input);
    var copies = tiles.validateCopies(input);
    var melds = tiles.validateMelds(normalized.actionGroups);
    var counts = tiles.getHandCounts(normalized.handCards, normalized.actionGroups);
    var errors = [];

    if (!copies.valid) errors.push({ code: 'INVALID_TILE_COPIES', details: copies });
    if (!melds.valid) errors = errors.concat(melds.errors);
    if (counts.structural !== 14 || counts.physical !== counts.winningPhysicalTarget) {
        errors.push({ code: 'INVALID_WINNING_TILE_COUNT', details: counts });
    }
    var context = normalized.context;
    if ((context.miaoshouhuichun || context.gangshangkaihua) && !context.zimo) {
        errors.push({ code: 'SELF_DRAW_CONTEXT_REQUIRED' });
    }
    if ((context.haidilaoyue || context.qiangganghu) && context.zimo) {
        errors.push({ code: 'DISCARD_WIN_CONTEXT_REQUIRED' });
    }
    if (context.haidilaoyue && context.qiangganghu) {
        errors.push({ code: 'CONFLICTING_WIN_CONTEXT' });
    }
    return { valid: errors.length === 0, errors: errors, counts: counts };
}

function toUnifiedResult(result) {
    var items = (result.fanList || []).map(function (item) {
        return {
            id: item.name,
            name: item.name,
            value: item.fan,
            explanation: ''
        };
    });
    return {
        canWin: !!result.canHu,
        isWinningShape: !!result.isHuShape,
        reason: result.reason || '',
        totalValue: result.totalFan || 0,
        valueUnit: 'fan',
        items: items,
        selectedCandidate: result.selectedCandidate || { pattern: result.pattern || '' },
        alternatives: result.alternatives || [],
        manualConfirmations: [],
        canHu: !!result.canHu,
        isHuShape: !!result.isHuShape,
        totalFan: result.totalFan || 0,
        fanList: result.fanList || [],
        pattern: result.pattern || ''
    };
}

function calculateWin(input) {
    var normalized = normalizeInput(input);
    var validation = validateInput(input);
    if (!validation.valid) {
        return toUnifiedResult({
            canHu: false,
            isHuShape: false,
            reason: validation.errors[0].code,
            totalFan: 0,
            fanList: [],
            pattern: ''
        });
    }
    return toUnifiedResult(legacy.calculateHu(
        normalized.handCards,
        normalized.actionGroups,
        normalized.context
    ));
}

function calculateHu(handCards, actionGroups, options) {
    return calculateWin({
        concealedTiles: handCards,
        melds: actionGroups,
        context: options || {}
    });
}

function analyzeWaits(input) {
    input = input || {};
    var normalized = normalizeInput(input);
    var counts = tiles.getHandCounts(normalized.handCards, normalized.actionGroups);
    if (counts.structural !== 13 || counts.physical !== counts.waitingPhysicalTarget) return [];

    var copies = tiles.countCopies({
        concealedTiles: normalized.handCards,
        melds: normalized.actionGroups,
        visibleTiles: input.visibleTiles || []
    }).counts;
    var catalog = tiles.getCatalog(variants.VARIANTS.GUOBIAO);
    var waits = [];

    for (var i = 0; i < catalog.length; i++) {
        var candidate = catalog[i];
        if ((copies[candidate.baseId] || 0) >= 4) continue;
        var candidateTile = toLegacyTile(candidate.id);
        var context = {};
        var contextKeys = Object.keys(normalized.context);
        for (var c = 0; c < contextKeys.length; c++) {
            context[contextKeys[c]] = normalized.context[contextKeys[c]];
        }
        context.winTile = candidateTile.name;
        var result = calculateWin({
            concealedTiles: normalized.handCards.concat([candidateTile]),
            melds: normalized.actionGroups,
            context: context
        });
        if (result.canWin) {
            waits.push({
                tileId: candidate.id,
                name: candidate.name,
                remaining: 4 - (copies[candidate.baseId] || 0),
                result: result
            });
        }
    }
    return waits;
}

function getRuleCatalog() {
    return rulesData.RULES.slice();
}

module.exports = {
    id: variants.VARIANTS.GUOBIAO,
    validateInput: validateInput,
    calculateWin: calculateWin,
    calculateHu: calculateHu,
    analyzeWaits: analyzeWaits,
    getRuleCatalog: getRuleCatalog
};
