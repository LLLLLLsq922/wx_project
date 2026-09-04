'use strict';

var variants = require('./variants.js');

var SUITS = [
    { id: 'm', name: '万' },
    { id: 's', name: '条' },
    { id: 'p', name: '筒' }
];

var HONORS = [
    { id: 'east', name: '东' },
    { id: 'south', name: '南' },
    { id: 'west', name: '西' },
    { id: 'north', name: '北' },
    { id: 'red', name: '中' },
    { id: 'green', name: '发' },
    { id: 'white', name: '白' }
];

var CHINESE_TO_ID = {
    '东': 'east',
    '南': 'south',
    '西': 'west',
    '北': 'north',
    '中': 'red',
    '发': 'green',
    '白': 'white',
    '赤5万': 'm5r',
    '赤5条': 's5r',
    '赤5筒': 'p5r'
};

var MELD_TYPES = {
    chi: { physical: 3, legacy: '吃' },
    pon: { physical: 3, legacy: '碰' },
    openKong: { physical: 4, legacy: '明杠' },
    addedKong: { physical: 4, legacy: '明杠' },
    concealedKong: { physical: 4, legacy: '暗杠' }
};

var LEGACY_MELD_TYPES = {
    '吃': 'chi',
    '碰': 'pon',
    '明杠': 'openKong',
    '补杠': 'addedKong',
    '暗杠': 'concealedKong'
};

function createNumberTile(suit, value, red) {
    var suffix = red ? 'r' : '';
    return {
        id: suit.id + value + suffix,
        baseId: suit.id + value,
        name: red ? '赤5' + suit.name : value + suit.name,
        suit: suit.id,
        value: value,
        honor: false,
        red: !!red
    };
}

function createHonorTile(honor) {
    return {
        id: honor.id,
        baseId: honor.id,
        name: honor.name,
        suit: 'honor',
        value: honor.id,
        honor: true,
        red: false
    };
}

function getBaseCatalog(includeHonors) {
    var result = [];
    for (var s = 0; s < SUITS.length; s++) {
        for (var value = 1; value <= 9; value++) {
            result.push(createNumberTile(SUITS[s], value, false));
        }
    }
    if (includeHonors) {
        for (var h = 0; h < HONORS.length; h++) {
            result.push(createHonorTile(HONORS[h]));
        }
    }
    return result;
}

function getCatalog(variantId, options) {
    options = options || {};
    var includeHonors = variantId !== variants.VARIANTS.SICHUAN;
    var result = getBaseCatalog(includeHonors);

    if (variantId === variants.VARIANTS.RIICHI && options.redFives !== 0) {
        result.push(createNumberTile(SUITS[0], 5, true));
        result.push(createNumberTile(SUITS[1], 5, true));
        result.push(createNumberTile(SUITS[2], 5, true));
    }
    return result;
}

function idFromChineseName(name) {
    if (CHINESE_TO_ID[name]) return CHINESE_TO_ID[name];
    var match = /^([1-9])(万|条|筒)$/.exec(name || '');
    if (!match) return null;
    var suit = match[2] === '万' ? 'm' : (match[2] === '条' ? 's' : 'p');
    return suit + match[1];
}

function normalizeTileId(tile) {
    if (!tile) return null;
    var value = typeof tile === 'string' ? tile : (tile.id || tile.name);
    if (!value) return null;
    if (/^[msp][1-9]r?$/.test(value) || /^(east|south|west|north|red|green|white)$/.test(value)) {
        return value;
    }
    return idFromChineseName(value);
}

function getBaseTileId(tile) {
    var id = normalizeTileId(tile);
    if (!id) return null;
    return id.replace(/r$/, '');
}

function chineseNameFromId(tile) {
    var id = normalizeTileId(tile);
    if (!id) return '';
    var honorNames = {
        east: '东', south: '南', west: '西', north: '北',
        red: '中', green: '发', white: '白'
    };
    if (honorNames[id]) return honorNames[id];
    var match = /^([msp])([1-9])(r?)$/.exec(id);
    if (!match) return '';
    var suitName = match[1] === 'm' ? '万' : (match[1] === 's' ? '条' : '筒');
    return (match[3] ? '赤' : '') + match[2] + suitName;
}

function normalizeMeldType(type) {
    if (MELD_TYPES[type]) return type;
    return LEGACY_MELD_TYPES[type] || null;
}

function isKong(meld) {
    var type = normalizeMeldType(meld && meld.type);
    return type === 'openKong' || type === 'addedKong' || type === 'concealedKong';
}

function meldTiles(meld) {
    return (meld && (meld.tiles || meld.cards)) || [];
}

function getHandCounts(concealedTiles, melds) {
    concealedTiles = concealedTiles || [];
    melds = melds || [];
    var physical = concealedTiles.length;
    var kongCount = 0;
    for (var i = 0; i < melds.length; i++) {
        physical += meldTiles(melds[i]).length;
        if (isKong(melds[i])) kongCount++;
    }
    return {
        concealed: concealedTiles.length,
        meldCount: melds.length,
        kongCount: kongCount,
        structural: concealedTiles.length + melds.length * 3,
        physical: physical,
        winningStructuralTarget: 14,
        winningPhysicalTarget: 14 + kongCount,
        waitingStructuralTarget: 13,
        waitingPhysicalTarget: 13 + kongCount
    };
}

function collectKnownTiles(input) {
    input = input || {};
    var result = [];
    var concealed = input.concealedTiles || input.handCards || [];
    result = result.concat(concealed);

    var melds = input.melds || input.actionGroups || [];
    for (var i = 0; i < melds.length; i++) {
        result = result.concat(meldTiles(melds[i]));
    }

    result = result.concat(input.visibleTiles || []);
    result = result.concat(input.doraIndicators || []);
    result = result.concat(input.uraDoraIndicators || []);
    return result;
}

function countCopies(input) {
    var counts = {};
    var invalidTiles = [];
    var known = collectKnownTiles(input);
    for (var i = 0; i < known.length; i++) {
        var baseId = getBaseTileId(known[i]);
        if (!baseId) {
            invalidTiles.push(known[i]);
            continue;
        }
        counts[baseId] = (counts[baseId] || 0) + 1;
    }
    return { counts: counts, invalidTiles: invalidTiles };
}

function validateCopies(input) {
    var counted = countCopies(input);
    var overLimit = [];
    var ids = Object.keys(counted.counts);
    for (var i = 0; i < ids.length; i++) {
        if (counted.counts[ids[i]] > 4) {
            overLimit.push({ tileId: ids[i], count: counted.counts[ids[i]] });
        }
    }
    return {
        valid: counted.invalidTiles.length === 0 && overLimit.length === 0,
        counts: counted.counts,
        invalidTiles: counted.invalidTiles,
        overLimit: overLimit
    };
}

function validateMelds(melds) {
    melds = melds || [];
    var errors = [];
    for (var i = 0; i < melds.length; i++) {
        var type = normalizeMeldType(melds[i].type);
        var tiles = meldTiles(melds[i]);
        if (!type) {
            errors.push({ code: 'INVALID_MELD_TYPE', index: i });
            continue;
        }
        var expectedLength = MELD_TYPES[type].physical;
        if (tiles.length !== expectedLength) {
            errors.push({
                code: 'INVALID_MELD_LENGTH',
                index: i,
                expected: expectedLength,
                actual: tiles.length
            });
            continue;
        }

        var baseIds = tiles.map(getBaseTileId);
        if (baseIds.some(function (id) { return !id; })) continue;
        if (type === 'chi') {
            var parsed = baseIds.map(function (id) {
                var match = /^([msp])([1-9])$/.exec(id);
                return match ? { suit: match[1], value: parseInt(match[2], 10) } : null;
            });
            var expectedSuit = parsed[0] && parsed[0].suit;
            var sameSuit = !!expectedSuit && parsed.every(function (tile) {
                return tile && tile.suit === expectedSuit;
            });
            var values = parsed.filter(Boolean).map(function (tile) { return tile.value; })
                .sort(function (a, b) { return a - b; });
            if (!sameSuit || values.length !== 3 ||
                values[1] !== values[0] + 1 || values[2] !== values[1] + 1) {
                errors.push({ code: 'INVALID_CHI_TILES', index: i });
            }
        } else if (!baseIds.every(function (id) { return id === baseIds[0]; })) {
            errors.push({ code: 'INVALID_MELD_TILES', index: i });
        }
    }
    return { valid: errors.length === 0, errors: errors };
}

module.exports = {
    MELD_TYPES: MELD_TYPES,
    getCatalog: getCatalog,
    normalizeTileId: normalizeTileId,
    getBaseTileId: getBaseTileId,
    chineseNameFromId: chineseNameFromId,
    normalizeMeldType: normalizeMeldType,
    isKong: isKong,
    getHandCounts: getHandCounts,
    countCopies: countCopies,
    validateCopies: validateCopies,
    validateMelds: validateMelds
};
