'use strict';

var tiles = require('../../core/tiles.js');
var variants = require('../../core/variants.js');
var settlement = require('./settlement.js');
var roundState = require('./roundState.js');

var DEFAULT_RULES = {
    dingqueEnabled: true,
    huansanzhangEnabled: true,
    menqingZhongzhangEnabled: true,
    shibaluohanEnabled: true,
    eventFansEnabled: true,
    selfDrawMode: 'addBase',
    baseScore: 1
};

var RULE_CATALOG = [
    { id: 'pinghu', name: '平胡', fan: 0 },
    { id: 'pengpenghu', name: '对对胡', fan: 1 },
    { id: 'jingoudiao', name: '金钩钓', fan: 1 },
    { id: 'qingyise', name: '清一色', fan: 2 },
    { id: 'qidui', name: '七对', fan: 2 },
    { id: 'daiyaojiu', name: '带幺九', fan: 2 },
    { id: 'longqidui', name: '龙七对', fan: 3 },
    { id: 'jiangdui', name: '将对', fan: 3 },
    { id: 'qingdui', name: '清对', fan: 3 },
    { id: 'qingqidui', name: '清七对', fan: 4 },
    { id: 'qinglongqidui', name: '清龙七对', fan: 5 },
    { id: 'qingjingoudiao', name: '清金钩钓', fan: 3 },
    { id: 'qingyaojiu', name: '清幺九', fan: 4 },
    { id: 'qingjiangdui', name: '清将对', fan: 5 },
    { id: 'shibaluohan', name: '十八罗汉', fan: 5, ruleFlag: 'shibaluohanEnabled' },
    { id: 'qingshibaluohan', name: '清十八罗汉', fan: 7, ruleFlag: 'shibaluohanEnabled' },
    { id: 'tianhu', name: '天胡', fan: 5 },
    { id: 'dihu', name: '地胡', fan: 5 },
    { id: 'gangshanghua', name: '杠上花', fan: 1, ruleFlag: 'eventFansEnabled' },
    { id: 'gangshangpao', name: '杠上炮', fan: 1, ruleFlag: 'eventFansEnabled' },
    { id: 'qiangganghu', name: '抢杠胡', fan: 1, ruleFlag: 'eventFansEnabled' },
    { id: 'haidilaoyue', name: '海底捞月', fan: 1, ruleFlag: 'eventFansEnabled' },
    { id: 'menqing', name: '门清', fan: 1, ruleFlag: 'menqingZhongzhangEnabled' },
    { id: 'zhongzhang', name: '中张', fan: 1, ruleFlag: 'menqingZhongzhangEnabled' },
    { id: 'gen', name: '根', fan: 1, repeatable: true }
];

function mergeRules(input, override) {
    var result = {};
    Object.keys(DEFAULT_RULES).forEach(function (key) { result[key] = DEFAULT_RULES[key]; });
    var sources = [(input && input.rules) || {}, override || {}];
    sources.forEach(function (source) {
        Object.keys(source).forEach(function (key) { result[key] = source[key]; });
    });
    return result;
}

function getMeldTiles(meld) {
    return (meld && (meld.tiles || meld.cards)) || [];
}

function normalizeInput(input) {
    input = input || {};
    var contextSource = input.context || input.options || {};
    var context = {};
    Object.keys(contextSource).forEach(function (key) { context[key] = contextSource[key]; });
    if (context.winTile === undefined && input.winTile !== undefined) context.winTile = input.winTile;
    if (context.dingqueSuit === undefined && input.dingqueSuit !== undefined) {
        context.dingqueSuit = input.dingqueSuit;
    }
    return {
        concealedTiles: (input.concealedTiles || input.handCards || []).map(tiles.normalizeTileId),
        melds: (input.melds || input.actionGroups || []).map(function (meld) {
            return {
                type: tiles.normalizeMeldType(meld.type),
                originalType: meld.type,
                tiles: getMeldTiles(meld).map(tiles.normalizeTileId)
            };
        }),
        visibleTiles: (input.visibleTiles || []).map(tiles.normalizeTileId),
        context: context
    };
}

function isSichuanTile(tileId) {
    return typeof tileId === 'string' && /^[msp][1-9]$/.test(tileId);
}

function collectNormalizedTiles(normalized) {
    var result = normalized.concealedTiles.concat(normalized.visibleTiles);
    normalized.melds.forEach(function (meld) { result = result.concat(meld.tiles); });
    return result;
}

function validateInputInternal(input, rules, mode) {
    var normalized = normalizeInput(input);
    var resolvedRules = mergeRules(input, rules);
    var errors = [];
    var allTiles = collectNormalizedTiles(normalized);
    if (allTiles.some(function (tileId) { return !isSichuanTile(tileId); })) {
        errors.push({ code: 'INVALID_SICHUAN_TILE' });
    }

    var copies = tiles.validateCopies(input || {});
    if (!copies.valid) errors.push({ code: 'INVALID_TILE_COPIES', details: copies });

    var meldValidation = tiles.validateMelds((input && (input.melds || input.actionGroups)) || []);
    if (!meldValidation.valid) errors = errors.concat(meldValidation.errors);
    normalized.melds.forEach(function (meld, index) {
        if (meld.type === 'chi') errors.push({ code: 'CHI_NOT_ALLOWED', index: index });
    });

    var counts = tiles.getHandCounts(normalized.concealedTiles, normalized.melds);
    var expectedStructural = mode === 'waiting' ? 13 : 14;
    var expectedPhysical = expectedStructural + counts.kongCount;
    if (counts.structural !== expectedStructural || counts.physical !== expectedPhysical) {
        errors.push({
            code: mode === 'waiting' ? 'INVALID_WAITING_TILE_COUNT' : 'INVALID_WINNING_TILE_COUNT',
            details: counts
        });
    }

    var context = normalized.context;
    var winTileId = tiles.normalizeTileId(context.winTile);
    if (mode !== 'waiting') {
        if (!context.winTile) {
            errors.push({ code: 'MISSING_WIN_TILE' });
        } else if (!isSichuanTile(winTileId)) {
            errors.push({ code: 'INVALID_SICHUAN_TILE', field: 'winTile' });
        } else if (normalized.concealedTiles.indexOf(winTileId) === -1) {
            errors.push({ code: 'WIN_TILE_NOT_IN_CONCEALED_HAND' });
        }
    }

    if (resolvedRules.dingqueEnabled) {
        var missingSuit = context.dingqueSuit;
        if (missingSuit === undefined || missingSuit === null || missingSuit === '') {
            errors.push({ code: 'MISSING_DINGQUE_SUIT' });
        } else if (['m', 's', 'p'].indexOf(missingSuit) === -1) {
            errors.push({ code: 'INVALID_DINGQUE_SUIT' });
        } else {
            var heldTiles = normalized.concealedTiles.slice();
            normalized.melds.forEach(function (meld) { heldTiles = heldTiles.concat(meld.tiles); });
            if (heldTiles.some(function (tileId) { return tileId && tileId.charAt(0) === missingSuit; })) {
                errors.push({ code: 'DINGQUE_NOT_CLEARED', suit: missingSuit });
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors,
        counts: counts,
        normalized: normalized,
        rules: resolvedRules
    };
}

function validateInput(input, rules) {
    return validateInputInternal(input, rules, 'winning');
}

function tileCounts(tileIds) {
    var counts = {};
    tileIds.forEach(function (tileId) { counts[tileId] = (counts[tileId] || 0) + 1; });
    return counts;
}

function firstRemainingTile(counts) {
    var ids = Object.keys(counts).sort();
    for (var i = 0; i < ids.length; i++) if (counts[ids[i]] > 0) return ids[i];
    return null;
}

function isSevenPairs(concealedTiles, melds) {
    if (melds.length !== 0 || concealedTiles.length !== 14) return false;
    var counts = tileCounts(concealedTiles);
    var ids = Object.keys(counts);
    var pairs = 0;
    for (var i = 0; i < ids.length; i++) {
        if (counts[ids[i]] !== 2 && counts[ids[i]] !== 4) return false;
        pairs += counts[ids[i]] / 2;
    }
    return pairs === 7;
}

function collectMeldGroups(counts, needed, groups, results) {
    var first = firstRemainingTile(counts);
    if (!first) {
        if (needed === 0) results.push(groups.slice());
        return;
    }
    if (needed <= 0) return;

    if (counts[first] >= 3) {
        counts[first] -= 3;
        groups.push({ kind: 'triplet', tiles: [first, first, first] });
        collectMeldGroups(counts, needed - 1, groups, results);
        groups.pop();
        counts[first] += 3;
    }

    var value = parseInt(first.charAt(1), 10);
    if (value <= 7) {
        var second = first.charAt(0) + (value + 1);
        var third = first.charAt(0) + (value + 2);
        if ((counts[second] || 0) > 0 && (counts[third] || 0) > 0) {
            counts[first]--;
            counts[second]--;
            counts[third]--;
            groups.push({ kind: 'sequence', tiles: [first, second, third] });
            collectMeldGroups(counts, needed - 1, groups, results);
            groups.pop();
            counts[first]++;
            counts[second]++;
            counts[third]++;
        }
    }
}

function normalizedMeldGroup(meld) {
    return {
        kind: meld.type === 'pon' ? 'triplet' : 'kong',
        tiles: meld.tiles.slice(),
        concealed: meld.type === 'concealedKong'
    };
}

function standardCandidates(concealedTiles, melds) {
    var neededMelds = 4 - melds.length;
    if (neededMelds < 0) return [];
    var counts = tileCounts(concealedTiles);
    var ids = Object.keys(counts).sort();
    var externalGroups = melds.map(normalizedMeldGroup);
    var results = [];
    for (var i = 0; i < ids.length; i++) {
        var pair = ids[i];
        if (counts[pair] < 2) continue;
        counts[pair] -= 2;
        var concealedGroups = [];
        collectMeldGroups(counts, neededMelds, [], concealedGroups);
        counts[pair] += 2;
        concealedGroups.forEach(function (groups) {
            results.push({
                kind: 'standard',
                pair: pair,
                groups: externalGroups.concat(groups)
            });
        });
    }
    return results;
}

function allHeldTiles(normalized) {
    var result = normalized.concealedTiles.slice();
    normalized.melds.forEach(function (meld) { result = result.concat(meld.tiles); });
    return result;
}

function isOneSuit(tileIds) {
    if (tileIds.length === 0) return false;
    var suit = tileIds[0].charAt(0);
    return tileIds.every(function (tileId) { return tileId.charAt(0) === suit; });
}

function isMiddleTile(tileId) {
    var value = parseInt(tileId.charAt(1), 10);
    return value >= 2 && value <= 8;
}

function isTerminalTile(tileId) {
    var value = parseInt(tileId.charAt(1), 10);
    return value === 1 || value === 9;
}

function isTerminalGroup(group) {
    if (group.kind === 'sequence') {
        var firstValue = parseInt(group.tiles[0].charAt(1), 10);
        return firstValue === 1 || firstValue === 7;
    }
    return isTerminalTile(group.tiles[0]);
}

function isClosedHand(melds) {
    return melds.every(function (meld) { return meld.type === 'concealedKong'; });
}

function countRoots(tileIds) {
    var counts = tileCounts(tileIds);
    return Object.keys(counts).filter(function (tileId) { return counts[tileId] === 4; }).length;
}

function addItem(items, id, name, fan, count) {
    count = count || 1;
    items.push({ id: id, name: name, value: fan * count, fan: fan, count: count });
}

function addContextItems(items, context, rules) {
    if (context.tianhu) addItem(items, 'tianhu', '天胡', 5);
    if (context.dihu) addItem(items, 'dihu', '地胡', 5);
    if (!rules.eventFansEnabled) return;
    if (context.gangshanghua || context.gangshangkaihua) {
        addItem(items, 'gangshanghua', '杠上花', 1);
    }
    if (context.gangshangpao) addItem(items, 'gangshangpao', '杠上炮', 1);
    if (context.qiangganghu) addItem(items, 'qiangganghu', '抢杠胡', 1);
    if (context.haidilaoyue) addItem(items, 'haidilaoyue', '海底捞月', 1);
}

function scoreCandidate(candidate, normalized, rules) {
    var heldTiles = allHeldTiles(normalized);
    var qing = isOneSuit(heldTiles);
    var roots = countRoots(heldTiles);
    var middle = heldTiles.every(isMiddleTile);
    var closed = isClosedHand(normalized.melds);
    var items = [];
    var containsZhongzhang = false;

    if (candidate.kind === 'sevenPairs') {
        if (qing && roots > 0) {
            addItem(items, 'qinglongqidui', '清龙七对', 5);
        } else if (qing) {
            addItem(items, 'qingqidui', '清七对', 4);
        } else if (roots > 0) {
            addItem(items, 'longqidui', '龙七对', 3);
        } else {
            addItem(items, 'qidui', '七对', 2);
        }
        if (roots > 1) addItem(items, 'gen', '根', 1, roots - 1);
    } else {
        var allKongs = normalized.melds.length === 4 && normalized.melds.every(function (meld) {
            return meld.type === 'openKong' || meld.type === 'addedKong' ||
                meld.type === 'concealedKong';
        });
        var pengpeng = candidate.groups.every(function (group) {
            return group.kind === 'triplet' || group.kind === 'kong';
        });
        var jingoudiao = normalized.concealedTiles.length === 2 && normalized.melds.length === 4;
        var daiyaojiu = isTerminalTile(candidate.pair) && candidate.groups.every(isTerminalGroup);
        var jiangdui = pengpeng && heldTiles.every(function (tileId) {
            return ['2', '5', '8'].indexOf(tileId.charAt(1)) !== -1;
        });

        if (allKongs && rules.shibaluohanEnabled) {
            addItem(items, qing ? 'qingshibaluohan' : 'shibaluohan',
                qing ? '清十八罗汉' : '十八罗汉', qing ? 7 : 5);
        } else if (qing && jiangdui) {
            addItem(items, 'qingjiangdui', '清将对', 5);
            containsZhongzhang = true;
        } else if (jiangdui) {
            addItem(items, 'jiangdui', '将对', 3);
            containsZhongzhang = true;
        } else {
            if (qing && jingoudiao) {
                addItem(items, 'qingjingoudiao', '清金钩钓', 3);
                jingoudiao = false;
                qing = false;
                pengpeng = false;
            } else if (qing && daiyaojiu) {
                addItem(items, 'qingyaojiu', '清幺九', 4);
                qing = false;
                daiyaojiu = false;
            } else if (qing && pengpeng) {
                addItem(items, 'qingdui', '清对', 3);
                qing = false;
                pengpeng = false;
            }

            if (qing) addItem(items, 'qingyise', '清一色', 2);
            if (jingoudiao) {
                addItem(items, 'jingoudiao', '金钩钓', 1);
                pengpeng = false;
            }
            if (daiyaojiu) addItem(items, 'daiyaojiu', '带幺九', 2);
            if (pengpeng) addItem(items, 'pengpenghu', '对对胡', 1);
            if (items.length === 0) addItem(items, 'pinghu', '平胡', 0);
            if (roots > 0) addItem(items, 'gen', '根', 1, roots);
        }
    }

    if (rules.menqingZhongzhangEnabled) {
        if (closed) addItem(items, 'menqing', '门清', 1);
        if (middle && !containsZhongzhang) addItem(items, 'zhongzhang', '中张', 1);
    }
    addContextItems(items, normalized.context, rules);

    var totalFan = items.reduce(function (sum, item) { return sum + item.value; }, 0);
    return {
        pattern: items.map(function (item) { return item.name; }).join('、'),
        totalFan: totalFan,
        items: items,
        pair: candidate.pair || null,
        groups: candidate.groups || []
    };
}

function candidateKey(candidate) {
    return candidate.totalFan + ':' + candidate.items.map(function (item) {
        return item.id + 'x' + item.count;
    }).sort().join(',');
}

function uniqueScoredCandidates(candidates) {
    var seen = {};
    return candidates.filter(function (candidate) {
        var key = candidateKey(candidate);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    }).sort(function (a, b) { return b.totalFan - a.totalFan; });
}

function invalidResult(reason) {
    return {
        canWin: false,
        isWinningShape: false,
        reason: reason,
        totalValue: 0,
        valueUnit: 'fan',
        items: [],
        selectedCandidate: null,
        alternatives: [],
        manualConfirmations: []
    };
}

function calculateWin(input, rules) {
    var validation = validateInput(input, rules);
    if (!validation.valid) return invalidResult(validation.errors[0].code);

    var normalized = validation.normalized;
    var candidates = standardCandidates(normalized.concealedTiles, normalized.melds);
    if (isSevenPairs(normalized.concealedTiles, normalized.melds)) {
        candidates.push({ kind: 'sevenPairs', pair: null, groups: [] });
    }
    if (candidates.length === 0) return invalidResult('INVALID_SHAPE');

    var scored = uniqueScoredCandidates(candidates.map(function (candidate) {
        return scoreCandidate(candidate, normalized, validation.rules);
    }));
    var selected = scored[0];
    return {
        canWin: true,
        isWinningShape: true,
        reason: '',
        totalValue: selected.totalFan,
        valueUnit: 'fan',
        items: selected.items,
        selectedCandidate: selected,
        alternatives: scored.slice(1),
        manualConfirmations: [],
        totalFan: selected.totalFan,
        fanList: selected.items.map(function (item) {
            return { name: item.name, fan: item.value };
        })
    };
}

function analyzeWaits(input, rules) {
    var validation = validateInputInternal(input, rules, 'waiting');
    if (!validation.valid) return [];

    var normalized = validation.normalized;
    var known = tiles.countCopies({
        concealedTiles: normalized.concealedTiles,
        melds: normalized.melds,
        visibleTiles: normalized.visibleTiles
    }).counts;
    var catalog = tiles.getCatalog(variants.VARIANTS.SICHUAN);
    var waits = [];
    catalog.forEach(function (candidate) {
        if ((known[candidate.baseId] || 0) >= 4) return;
        var context = {};
        Object.keys(normalized.context).forEach(function (key) { context[key] = normalized.context[key]; });
        context.winTile = candidate.id;
        var result = calculateWin({
            concealedTiles: normalized.concealedTiles.concat([candidate.id]),
            melds: normalized.melds,
            context: context,
            rules: validation.rules
        });
        if (result.canWin) {
            waits.push({
                tileId: candidate.id,
                name: candidate.name,
                remaining: 4 - (known[candidate.baseId] || 0),
                result: result
            });
        }
    });
    return waits;
}

function getRuleCatalog(rules) {
    var resolvedRules = mergeRules(null, rules);
    return RULE_CATALOG.map(function (rule) {
        return {
            id: rule.id,
            name: rule.name,
            fan: rule.fan,
            repeatable: !!rule.repeatable,
            enabled: !rule.ruleFlag || resolvedRules[rule.ruleFlag] !== false
        };
    });
}

module.exports = {
    id: variants.VARIANTS.SICHUAN,
    DEFAULT_RULES: DEFAULT_RULES,
    validateInput: validateInput,
    calculateWin: calculateWin,
    analyzeWaits: analyzeWaits,
    getRuleCatalog: getRuleCatalog,
    settleWinEvent: settlement.settleWinEvent,
    createKongTransaction: settlement.createKongTransaction,
    createRoundState: roundState.createRoundState,
    recordExchange: roundState.recordExchange,
    recordDingque: roundState.recordDingque,
    recordWin: roundState.recordWin,
    recordKong: roundState.recordKong,
    recordWallExhausted: roundState.recordWallExhausted
};
