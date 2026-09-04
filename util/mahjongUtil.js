// util/mahjongUtil.js
// 国标麻将胡牌判定与番数计算（ES5 兼容）
//
// 数据约定：
//   handCards     = 暗牌数组（不含操作组中的牌）
//   actionGroups  = [{type:'吃'|'碰'|'明杠'|'暗杠', cards:[{id,name,type,value,image}, ...]}]
//   胡牌时：handCards.length === 14 - 3 * actionGroups.length
//
// options:
//   { zimo, juezhang, qiangganghu, haidilaoyue, miaoshouhuichun,
//     gangshangkaihua, tianhu, dihu, renhu,
//     roundWind (0-3 东南西北), seatWind (0-3),
//     winTile (胡的那张牌名) }

var WINDS = ['东', '南', '西', '北'];
var DRAGONS = ['中', '发', '白'];
var YAOJIU_NAMES = ['1万', '9万', '1条', '9条', '1筒', '9筒',
                    '东', '南', '西', '北', '中', '发', '白'];
var ZI_NAMES = ['东', '南', '西', '北', '中', '发', '白'];
var GREEN_TILES = ['2条', '3条', '4条', '6条', '8条', '发'];
var ALL_TILE_NAMES = (function () {
    var result = [];
    ['万', '条', '筒'].forEach(function (suit) {
        for (var value = 1; value <= 9; value++) result.push(value + suit);
    });
    return result.concat(WINDS, DRAGONS);
})();
var MIN_HU_FAN = 8;

// ====================================================================
// 调试日志开关与辅助函数
// 设为 false 可关闭全部日志（不影响逻辑）
// ====================================================================

var LOG_ENABLED = true;
var LOG_PREFIX = '[mahjongUtil]';

function _log() {
    if (!LOG_ENABLED) return;
    if (typeof console !== 'undefined' && console.log) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(LOG_PREFIX);
        try { console.log.apply(console, args); } catch (e) { /* 静默 */ }
    }
}

// 把牌对象数组转为可读字符串：[{name:'1万'}...] -> "1万,2万,3万"
function _tilesToNames(cards) {
    if (!cards || !cards.length) return '';
    var names = [];
    for (var i = 0; i < cards.length; i++) {
        names.push(cards[i] && cards[i].name ? cards[i].name : String(cards[i]));
    }
    return names.join(',');
}

// 操作组概要："碰:5条5条5条 | 明杠:9万9万9万9万"
function _groupsSummary(groups) {
    if (!groups || !groups.length) return '';
    var parts = [];
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        parts.push(g.type + ':' + _tilesToNames(g.cards));
    }
    return parts.join(' | ');
}

// allSets 概要（每个 set 一段）："jiang(5条) shunzi(万1) kezi(5条,ming) kezi(9条,angang)"
function _allSetsSummary(allSets) {
    if (!allSets || !allSets.length) return '';
    var parts = [];
    for (var i = 0; i < allSets.length; i++) {
        var s = allSets[i];
        if (s.kind === 'special') {
            parts.push('special(' + (s.special || '?') + ')');
            continue;
        }
        var tag = s.kind;
        if (s.isKong) tag += s.concealed ? '(angang)' : '(minggang)';
        else if (!s.concealed) tag += '(ming)';
        var v = s.suit === '字' ? s.name : (s.start !== null ? s.suit + s.start : s.name);
        parts.push(tag + '(' + v + ')');
    }
    return parts.join(' ');
}

// matched 番种概要："清一色:24,缺一门:1"
function _matchedSummary(matched) {
    var keys = Object.keys(matched);
    if (!keys.length) return '(none)';
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
        parts.push(keys[i] + ':' + matched[keys[i]]);
    }
    return parts.join(',');
}

// fanList 概要："清一色:24,缺一门:1"
function _fanListSummary(fanList) {
    if (!fanList || !fanList.length) return '(none)';
    var parts = [];
    for (var i = 0; i < fanList.length; i++) {
        parts.push(fanList[i].name + ':' + fanList[i].fan);
    }
    return parts.join(',');
}

// concealedSets 概要
function _concealedSetsSummary(sets) {
    if (!sets || !sets.length) return '';
    var parts = [];
    for (var i = 0; i < sets.length; i++) {
        parts.push(sets[i].type + '(' + _tilesToNames(sets[i].tiles) + ')');
    }
    return parts.join(' ');
}

// ====================================================================
// 主入口
// ====================================================================

function calculateHu(handCards, actionGroups, options) {
    options = options || {};
    actionGroups = actionGroups || [];

    _log('=== calculateHu start ===');
    _log('input: handLen=' + (handCards && handCards.length) +
         ', groups=' + actionGroups.length +
         ', hand=[' + _tilesToNames(handCards) + ']' +
         ', groups=[' + _groupsSummary(actionGroups) + ']' +
         ', options=' + JSON.stringify(options));

    var huResult = checkHu(handCards, actionGroups);
    if (!huResult.canHu) {
        _log('=== calculateHu end: NOT_HU ===');
        return {
            canHu: false,
            isHuShape: false,
            reason: 'INVALID_SHAPE',
            totalFan: 0,
            fanList: [],
            pattern: ''
        };
    }

    var fanResult = calculateFan(handCards, actionGroups, options, huResult);
    var meetsMinimumFan = fanResult.totalFan >= MIN_HU_FAN;

    _log('=== calculateHu end: canHu=' + meetsMinimumFan +
         ', isHuShape=true, pattern=' +
         (fanResult.selectedCandidate ? fanResult.selectedCandidate.pattern : huResult.pattern) +
         ', totalFan=' + fanResult.totalFan +
         (meetsMinimumFan ? '' : ', reason=LESS_THAN_8_FAN') + ' ===');
    return {
        // 国标麻将必须达到 8 番才是合法和牌。
        canHu: meetsMinimumFan,
        isHuShape: true,
        reason: meetsMinimumFan ? '' : 'LESS_THAN_8_FAN',
        totalFan: fanResult.totalFan,
        fanList: fanResult.fanList,
        pattern: fanResult.selectedCandidate ? fanResult.selectedCandidate.pattern : huResult.pattern,
        selectedCandidate: fanResult.selectedCandidate || null,
        alternatives: fanResult.alternatives || []
    };
}

// ====================================================================
// 胡牌判定
// ====================================================================

function checkHu(handCards, actionGroups) {
    actionGroups = actionGroups || [];
    var expected = 14 - 3 * actionGroups.length;
    var handLen = (handCards && handCards.length) || 0;
    _log('checkHu enter: handLen=' + handLen + ', expected=' + expected +
         ', groups=' + actionGroups.length +
         ', hand=[' + _tilesToNames(handCards) + ']' +
         ', groups=[' + _groupsSummary(actionGroups) + ']');

    if (!handCards || handCards.length !== expected) {
        _log('checkHu FAIL: handLen(' + handLen + ') !== expected(' + expected + ')');
        return { canHu: false };
    }

    // 校验操作组类型
    for (var i = 0; i < actionGroups.length; i++) {
        var t = actionGroups[i].type;
        if (t !== '吃' && t !== '碰' && t !== '明杠' && t !== '暗杠') {
            _log('checkHu FAIL: actionGroups[' + i + '].type="' + t + '" 非法');
            return { canHu: false };
        }
    }

    var shapeCandidates = [];

    // 除组合龙可带一副普通面子外，其余特殊牌型均要求无操作组。
    if (actionGroups.length === 0) {
        if (checkShiSanYao(handCards)) {
            shapeCandidates.push({ pattern: '十三幺', special: '十三幺' });
        }
        if (checkQiDuiPattern(handCards)) {
            shapeCandidates.push({ pattern: '七对', special: '七对' });
        }
        if (checkQiXingBuKao(handCards)) {
            shapeCandidates.push({ pattern: '七星不靠', special: '七星不靠' });
        }
        if (checkQuanBuKao(handCards)) {
            shapeCandidates.push({ pattern: '全不靠', special: '全不靠' });
        }
    }

    var zhl = checkZuHeLongPattern(handCards, actionGroups);
    if (zhl) {
        shapeCandidates.push({
            pattern: '组合龙',
            special: '组合龙',
            zhlPair: zhl.pair,
            zhlFace: zhl.face,
            zhlKnitted: zhl.knitted
        });
    }

    // 标准胡牌（4 面子 + 1 将）
    var decomps = getDecompositions(handCards);
    _log('checkHu: 标准拆牌 decomps.length=' + decomps.length);
    if (decomps.length > 0) {
        for (var d = 0; d < decomps.length; d++) {
            _log('checkHu decomp#' + d + ': pair=' + decomps[d].pair +
                 ', concealedSets=[' + _concealedSetsSummary(decomps[d].concealedSets) + ']');
        }
        shapeCandidates.push({ pattern: '标准', decompositions: decomps });
    }

    if (shapeCandidates.length === 0) {
        _log('checkHu FAIL: 无法拆牌');
        return { canHu: false };
    }

    var first = shapeCandidates[0];
    _log('checkHu OK: 候选=' + shapeCandidates.map(function (candidate) {
        return candidate.pattern;
    }).join(','));
    return {
        canHu: true,
        pattern: first.pattern,
        special: first.special,
        decompositions: first.decompositions,
        zhlPair: first.zhlPair,
        zhlFace: first.zhlFace,
        zhlKnitted: first.zhlKnitted,
        shapeCandidates: shapeCandidates
    };
}

// --- 十三幺 ---
function checkShiSanYao(cards) {
    if (cards.length !== 14) return false;
    var count = {};
    cards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });
    // 必须全部是幺九牌
    for (var k in count) {
        if (YAOJIU_NAMES.indexOf(k) === -1) return false;
    }
    var distinct = 0, dbl = 0;
    YAOJIU_NAMES.forEach(function (n) {
        var c = count[n] || 0;
        if (c >= 1) distinct++;
        if (c === 2) dbl++;
    });
    return distinct === 13 && dbl === 1;
}

// --- 七对 ---
function checkQiDuiPattern(cards) {
    if (cards.length !== 14) return false;
    var count = {};
    cards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });
    var pairCount = 0;
    for (var k in count) {
        if (count[k] !== 2 && count[k] !== 4) return false;
        pairCount += count[k] / 2;
    }
    return pairCount === 7;
}

// 生成全不靠使用的6种组合龙骨架：147、258、369三组分别对应不同花色。
function getKnittedUniverses() {
    var suitPermutations = permutations(['万', '条', '筒']);
    var valueGroups = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
    var universes = [];
    for (var p = 0; p < suitPermutations.length; p++) {
        var allowed = {};
        for (var g = 0; g < valueGroups.length; g++) {
            for (var v = 0; v < valueGroups[g].length; v++) {
                allowed[valueGroups[g][v] + suitPermutations[p][g]] = true;
            }
        }
        universes.push(allowed);
    }
    return universes;
}

function checkUnconnectedSingles(cards, requireAllHonors) {
    if (cards.length !== 14) return false;
    var count = {};
    cards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });

    // 全不靠与七星不靠均由14张互不相同的单张组成。
    var names = Object.keys(count);
    if (names.length !== 14) return false;
    for (var n = 0; n < names.length; n++) if (count[names[n]] !== 1) return false;

    var honorCount = 0;
    for (var i = 0; i < ZI_NAMES.length; i++) if (count[ZI_NAMES[i]] === 1) honorCount++;
    if (requireAllHonors && honorCount !== 7) return false;

    var numCards = cards.filter(function (c) { return c.type !== '字'; });
    if (numCards.length < 7 || numCards.length > 9) return false;

    var universes = getKnittedUniverses();
    for (var u = 0; u < universes.length; u++) {
        var fits = true;
        for (var c = 0; c < numCards.length; c++) {
            if (!universes[u][numCards[c].name]) {
                fits = false;
                break;
            }
        }
        if (fits) return true;
    }
    return false;
}

// 七星不靠：七种字牌齐全，加组合龙骨架中的任意七张数牌。
function checkQiXingBuKao(cards) {
    return checkUnconnectedSingles(cards, true);
}

// 全不靠：组合龙骨架九张数牌与七种字牌共16张中的任意14张单张。
function checkQuanBuKao(cards) {
    return checkUnconnectedSingles(cards, false);
}

// --- 组合龙 ---
// 固定花色的147、258、369共9张，加一副普通面子和一对将；普通面子可副露。
function checkZuHeLongPattern(cards, actionGroups) {
    actionGroups = actionGroups || [];
    if (actionGroups.length > 1) return null;
    if (cards.length !== (actionGroups.length === 1 ? 11 : 14)) return null;
    var count = {};
    cards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });

    var universes = getKnittedUniverses();
    for (var u = 0; u < universes.length; u++) {
        var rem = {};
        for (var name in count) rem[name] = count[name];
        var knitted = Object.keys(universes[u]);
        var fits = knitted.every(function (name) {
            if (!rem[name]) return false;
            rem[name]--;
            return true;
        });
        if (!fits) continue;

        var remaining = [];
        for (var remName in rem) {
            for (var r = 0; r < rem[remName]; r++) remaining.push(remName);
        }
        if (actionGroups.length === 1) {
            if (remaining.length === 2 && remaining[0] === remaining[1]) {
                return { pair: remaining[0], face: null, knitted: knitted };
            }
            continue;
        }

        var completion = findPairAndFace(remaining);
        if (completion) {
            return { pair: completion.pair, face: completion.face, knitted: knitted };
        }
    }
    return null;
}

function findPairAndFace(names) {
    if (names.length !== 5) return null;
    var count = {};
    names.forEach(function (name) { count[name] = (count[name] || 0) + 1; });
    for (var pair in count) {
        if (count[pair] < 2) continue;
        var rest = names.slice();
        rest.splice(rest.indexOf(pair), 1);
        rest.splice(rest.indexOf(pair), 1);
        var faceType = getFaceType(rest);
        if (faceType) return { pair: pair, face: { type: faceType, tiles: rest } };
    }
    return null;
}

function getFaceType(names) {
    if (names.length !== 3) return null;
    if (names[0] === names[1] && names[1] === names[2]) return 'kezi';
    var parsed = names.map(parseName);
    if (parsed.some(function (item) { return !item; })) return null;
    if (parsed[0].suit !== parsed[1].suit || parsed[1].suit !== parsed[2].suit) return null;
    var values = parsed.map(function (item) { return item.value; }).sort(function (a, b) { return a - b; });
    return values[1] === values[0] + 1 && values[2] === values[1] + 1 ? 'shunzi' : null;
}

function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var result = [];
    for (var i = 0; i < arr.length; i++) {
        var rest = arr.slice(0, i).concat(arr.slice(i + 1));
        var subs = permutations(rest);
        for (var j = 0; j < subs.length; j++) result.push([arr[i]].concat(subs[j]));
    }
    return result;
}

// ====================================================================
// 标准胡牌拆解（回溯所有拆法）
// ====================================================================

function parseName(name) {
    if (typeof name !== 'string' || name.length < 2) return null;
    var v = parseInt(name.charAt(0), 10);
    var s = name.charAt(1);
    if (isNaN(v) || (s !== '万' && s !== '条' && s !== '筒')) return null;
    return { suit: s, value: v };
}

function getDecompositions(handCards) {
    var decomps = [];
    var count = {};
    handCards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });

    var pairCandidates = [];
    for (var name in count) {
        if (count[name] >= 2) pairCandidates.push(name);
    }

    pairCandidates.forEach(function (pairName) {
        var wc = {};
        for (var k in count) wc[k] = count[k];
        wc[pairName] -= 2;
        if (wc[pairName] === 0) delete wc[pairName];
        collectDecompositions(wc, [], decomps, pairName);
    });

    return decomps;
}

function collectDecompositions(count, currentSets, results, pairName) {
    var firstName = null;
    for (var name in count) {
        if (count[name] > 0) { firstName = name; break; }
    }
    if (firstName === null) {
        results.push({ pair: pairName, concealedSets: currentSets.slice() });
        return;
    }

    var parsed = parseName(firstName);

    // 刻子
    if (count[firstName] >= 3) {
        count[firstName] -= 3;
        if (count[firstName] === 0) delete count[firstName];
        currentSets.push({ type: 'kezi', tiles: [firstName, firstName, firstName] });
        collectDecompositions(count, currentSets, results, pairName);
        currentSets.pop();
        count[firstName] = (count[firstName] || 0) + 3;
    }

    // 顺子（仅数牌）
    if (parsed && parsed.value <= 7) {
        var n2 = (parsed.value + 1) + parsed.suit;
        var n3 = (parsed.value + 2) + parsed.suit;
        if ((count[firstName] || 0) >= 1 && (count[n2] || 0) >= 1 && (count[n3] || 0) >= 1) {
            count[firstName]--;
            if (count[firstName] === 0) delete count[firstName];
            count[n2]--;
            if (count[n2] === 0) delete count[n2];
            count[n3]--;
            if (count[n3] === 0) delete count[n3];
            currentSets.push({ type: 'shunzi', tiles: [firstName, n2, n3] });
            collectDecompositions(count, currentSets, results, pairName);
            currentSets.pop();
            count[firstName] = (count[firstName] || 0) + 1;
            count[n2] = (count[n2] || 0) + 1;
            count[n3] = (count[n3] || 0) + 1;
        }
    }
}

// ====================================================================
// 拆解分析：合并暗牌+操作组 -> 统一 allSets
// ====================================================================

function analyzeDecomposition(decomp, actionGroups, options) {
    var allSets = [];
    options = options || {};

    var pairParsed = parseName(decomp.pair);
    allSets.push({
        kind: 'jiang',
        concealed: true,
        isKong: false,
        tiles: [decomp.pair, decomp.pair],
        name: decomp.pair,
        suit: pairParsed ? pairParsed.suit : '字',
        start: pairParsed ? pairParsed.value : null
    });

    decomp.concealedSets.forEach(function (s) {
        var p = parseName(s.tiles[0]);
        var completedByDiscard = false;
        if (!options.zimo && options.winTile && s.type === 'kezi' && s.tiles[0] === options.winTile) {
            // 荣和牌是该刻子的唯一可能归属时，此刻子不算暗刻。
            var otherRoleUsesWinTile = decomp.pair === options.winTile ||
                decomp.concealedSets.some(function (other) {
                    return other !== s && other.tiles.indexOf(options.winTile) !== -1;
                });
            completedByDiscard = !otherRoleUsesWinTile;
        }
        allSets.push({
            kind: s.type,              // 'kezi' | 'shunzi'
            concealed: !completedByDiscard,
            isKong: false,
            tiles: s.tiles.slice(),
            name: s.tiles[0],
            suit: p ? p.suit : '字',
            start: p ? p.value : null
        });
    });

    (actionGroups || []).forEach(function (g) {
        var first = g.cards[0];
        var p = parseName(first.name);
        var suit = p ? p.suit : '字';
        var tiles = g.cards.map(function (c) { return c.name; });

        if (g.type === '吃') {
            var vals = g.cards.map(function (c) { return c.value; })
                              .sort(function (a, b) { return a - b; });
            allSets.push({
                kind: 'shunzi', concealed: false, isKong: false,
                tiles: tiles, name: first.name, suit: suit, start: vals[0]
            });
        } else if (g.type === '碰') {
            allSets.push({
                kind: 'kezi', concealed: false, isKong: false,
                tiles: tiles, name: first.name, suit: suit,
                start: p ? p.value : null
            });
        } else if (g.type === '明杠') {
            allSets.push({
                kind: 'kezi', concealed: false, isKong: true,
                tiles: tiles, name: first.name, suit: suit,
                start: p ? p.value : null
            });
        } else if (g.type === '暗杠') {
            allSets.push({
                kind: 'kezi', concealed: true, isKong: true,
                tiles: tiles, name: first.name, suit: suit,
                start: p ? p.value : null
            });
        }
    });

    return allSets;
}

// 特殊牌型 allSets 构造
function analyzeSpecial(special, handCards, actionGroups, huResult, options) {
    var allSets = [];
    var count = {};
    handCards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });

    if (special === '十三幺') {
        var pair = null;
        for (var n in count) if (count[n] === 2) { pair = n; break; }
        if (pair) {
            var pp = parseName(pair);
            allSets.push({
                kind: 'jiang', concealed: true, isKong: false,
                tiles: [pair, pair], name: pair,
                suit: pp ? pp.suit : '字', start: pp ? pp.value : null
            });
        }
        for (var n2 in count) {
            if (n2 === pair) continue;
            var p2 = parseName(n2);
            allSets.push({
                kind: 'single', concealed: true, isKong: false,
                tiles: [n2], name: n2,
                suit: p2 ? p2.suit : '字', start: p2 ? p2.value : null
            });
        }
        allSets.push({ kind: 'special', special: '十三幺', tiles: [],
                       concealed: true, isKong: false, name: '', suit: '', start: null });
        return allSets;
    }

    if (special === '七对') {
        for (var n3 in count) {
            var p3 = parseName(n3);
            for (var pairIndex = 0; pairIndex < count[n3] / 2; pairIndex++) {
                allSets.push({
                    kind: 'pair', concealed: true, isKong: false,
                    tiles: [n3, n3], name: n3,
                    suit: p3 ? p3.suit : '字', start: p3 ? p3.value : null
                });
            }
        }
        allSets.push({ kind: 'special', special: '七对', tiles: [],
                       concealed: true, isKong: false, name: '', suit: '', start: null });
        return allSets;
    }

    if (special === '全不靠' || special === '七星不靠') {
        for (var n4 in count) {
            var p4 = parseName(n4);
            allSets.push({
                kind: 'single', concealed: true, isKong: false,
                tiles: [n4], name: n4,
                suit: p4 ? p4.suit : '字', start: p4 ? p4.value : null
            });
        }
        allSets.push({ kind: 'special', special: special, tiles: [],
                       concealed: true, isKong: false, name: '', suit: '', start: null });
        return allSets;
    }

    if (special === '组合龙') {
        var concealedSets = huResult.zhlFace ? [huResult.zhlFace] : [];
        allSets = analyzeDecomposition({
            pair: huResult.zhlPair,
            concealedSets: concealedSets
        }, actionGroups, options);
        (huResult.zhlKnitted || []).forEach(function (name) {
            var parsed = parseName(name);
            allSets.push({
                kind: 'single', concealed: true, isKong: false,
                tiles: [name], name: name,
                suit: parsed.suit, start: parsed.value
            });
        });
        allSets.push({ kind: 'special', special: '组合龙', tiles: [],
                       concealed: true, isKong: false, name: '', suit: '', start: null });
        return allSets;
    }

    return allSets;
}

// ====================================================================
// 工具函数
// ====================================================================

function getAllTilesFromSets(allSets) {
    var tiles = [];
    allSets.forEach(function (s) {
        s.tiles.forEach(function (t) { tiles.push(t); });
    });
    return tiles;
}

function countTileByName(allSets) {
    var c = {};
    allSets.forEach(function (s) {
        s.tiles.forEach(function (t) { c[t] = (c[t] || 0) + 1; });
    });
    return c;
}

function countSets(allSets) {
    var cnt = { kezi: 0, shunzi: 0, gang: 0, anke: 0, ankeTotal: 0,
                mingke: 0, minggang: 0, angang: 0 };
    allSets.forEach(function (s) {
        if (s.kind === 'kezi') {
            cnt.kezi++;
            if (s.isKong) {
                cnt.gang++;
                if (s.concealed) cnt.angang++; else cnt.minggang++;
            } else {
                if (s.concealed) cnt.anke++; else cnt.mingke++;
            }
            if (s.concealed) cnt.ankeTotal++;
        } else if (s.kind === 'shunzi') {
            cnt.shunzi++;
        }
    });
    return cnt;
}

// ====================================================================
// 番数计算
// ====================================================================

var FAN_TABLE = [
    // 88番
    { name: '大四喜', fan: 88, check: fanDaSiXi },
    { name: '大三元', fan: 88, check: fanDaSanYuan },
    { name: '绿一色', fan: 88, check: fanLvYiSe },
    { name: '九莲宝灯', fan: 88, check: fanJiuLianBaoDeng },
    { name: '四杠', fan: 88, check: fanSiGang },
    { name: '连七对', fan: 88, check: fanLianQiDui },
    { name: '十三幺', fan: 88, check: fanShiSanYao },
    // 64番
    { name: '清幺九', fan: 64, check: fanQingYaoJiu },
    { name: '小四喜', fan: 64, check: fanXiaoSiXi },
    { name: '小三元', fan: 64, check: fanXiaoSanYuan },
    { name: '字一色', fan: 64, check: fanZiYiSe },
    { name: '四暗刻', fan: 64, check: fanSiAnKe },
    { name: '一色双龙会', fan: 64, check: fanYiSeShuangLongHui },
    // 48番
    { name: '一色四同顺', fan: 48, check: fanYiSeSiTongShun },
    { name: '一色四节高', fan: 48, check: fanYiSeSiJieGao },
    // 32番
    { name: '一色四步高', fan: 32, check: fanYiSeSiBuGao },
    { name: '三杠', fan: 32, check: fanSanGang },
    { name: '混幺九', fan: 32, check: fanHunYaoJiu },
    // 24番
    { name: '七对', fan: 24, check: fanQiDui },
    { name: '七星不靠', fan: 24, check: fanQiXingBuKao },
    { name: '全双刻', fan: 24, check: fanQuanShuangKe },
    { name: '清一色', fan: 24, check: fanQingYiSe },
    { name: '一色三同顺', fan: 24, check: fanYiSeSanTongShun },
    { name: '一色三节高', fan: 24, check: fanYiSeSanJieGao },
    { name: '全大', fan: 24, check: fanQuanDa },
    { name: '全中', fan: 24, check: fanQuanZhong },
    { name: '全小', fan: 24, check: fanQuanXiao },
    // 16番
    { name: '清龙', fan: 16, check: fanQingLong },
    { name: '三色双龙会', fan: 16, check: fanSanSeShuangLongHui },
    { name: '一色三步高', fan: 16, check: fanYiSeSanBuGao },
    { name: '全带五', fan: 16, check: fanQuanDaiWu },
    { name: '三同刻', fan: 16, check: fanSanTongKe },
    { name: '三暗刻', fan: 16, check: fanSanAnKe },
    // 12番
    { name: '全不靠', fan: 12, check: fanQuanBuKao },
    { name: '组合龙', fan: 12, check: fanZuHeLong },
    { name: '大于五', fan: 12, check: fanDaYuWu },
    { name: '小于五', fan: 12, check: fanXiaoYuWu },
    { name: '三风刻', fan: 12, check: fanSanFengKe },
    // 8番
    { name: '花龙', fan: 8, check: fanHuaLong },
    { name: '推不倒', fan: 8, check: fanTuiBuDao },
    { name: '三色三同顺', fan: 8, check: fanSanSeSanTongShun },
    { name: '三色三节高', fan: 8, check: fanSanSeSanJieGao },
    { name: '无番和', fan: 8, check: fanWuFanHe },
    { name: '妙手回春', fan: 8, check: fanMiaoShouHuiChun },
    { name: '海底捞月', fan: 8, check: fanHaiDiLaoYue },
    { name: '杠上开花', fan: 8, check: fanGangShangKaiHua },
    { name: '抢杠和', fan: 8, check: fanQiangGangHu },
    { name: '双暗杠', fan: 8, check: fanShuangAnGang },
    // 6番
    { name: '碰碰和', fan: 6, check: fanPengPengHu },
    { name: '混一色', fan: 6, check: fanHunYiSe },
    { name: '三色三步高', fan: 6, check: fanSanSeSanBuGao },
    { name: '五门齐', fan: 6, check: fanWuMenQi },
    { name: '全求人', fan: 6, check: fanQuanQiuRen },
    { name: '双箭刻', fan: 6, check: fanShuangJianKe },
    // 4番
    { name: '全带幺', fan: 4, check: fanQuanDaiYao },
    { name: '不求人', fan: 4, check: fanBuQiuRen },
    { name: '双明杠', fan: 4, check: fanShuangMingGang },
    { name: '和绝张', fan: 4, check: fanHeJueZhang },
    // 2番
    { name: '箭刻', fan: 2, check: fanJianKe },
    { name: '圈风刻', fan: 2, check: fanQuanFengKe },
    { name: '门风刻', fan: 2, check: fanMenFengKe },
    { name: '门前清', fan: 2, check: fanMenQianQing },
    { name: '平和', fan: 2, check: fanPingHe },
    { name: '四归一', fan: 2, check: fanSiGuiYi },
    { name: '双同刻', fan: 2, check: fanShuangTongKe },
    { name: '双暗刻', fan: 2, check: fanShuangAnKe },
    { name: '暗杠', fan: 2, check: fanAnGang },
    { name: '断幺', fan: 2, check: fanDuanYao },
    // 1番
    { name: '一般高', fan: 1, check: fanYiBanGao },
    { name: '喜相逢', fan: 1, check: fanXiXiangFeng },
    { name: '连六', fan: 1, check: fanLianLiu },
    { name: '老少副', fan: 1, check: fanLaoShaoFu },
    { name: '幺九刻', fan: 1, check: fanYaoJiuKe },
    { name: '明杠', fan: 1, check: fanMingGang },
    { name: '缺一门', fan: 1, check: fanQueYiMen },
    { name: '无字', fan: 1, check: fanWuZi },
    { name: '边张', fan: 1, check: fanBianZhang },
    { name: '坎张', fan: 1, check: fanKanZhang },
    { name: '单钓将', fan: 1, check: fanDanDiaoJiang },
    { name: '自摸', fan: 1, check: fanZiMo }
];

// EXCLUSIONS: 每个番种"不计"的番种（按官方"不计"规则）
var EXCLUSIONS = {
    '大四喜': ['三风刻', '碰碰和', '圈风刻', '门风刻', '幺九刻'],
    '大三元': ['双箭刻', '箭刻'],
    '绿一色': [],
    '九莲宝灯': ['清一色', '门前清', '幺九刻'],
    '四杠': ['三杠', '碰碰和', '单钓将'],
    '连七对': ['七对', '清一色', '门前清', '单钓将'],
    '十三幺': ['五门齐', '门前清', '单钓将'],
    '清幺九': ['碰碰和', '全带幺', '幺九刻', '无字'],
    '小四喜': ['三风刻', '幺九刻'],
    '小三元': ['双箭刻', '箭刻'],
    '字一色': ['碰碰和', '全带幺', '幺九刻'],
    '四暗刻': ['三暗刻', '双暗刻', '碰碰和', '门前清'],
    '一色双龙会': ['七对', '清一色', '平和', '无字', '一般高', '老少副'],
    '一色四同顺': ['一色三节高', '四归一', '一般高'],
    '一色四节高': ['一色三同顺', '碰碰和'],
    '一色四步高': ['连六', '老少副'],
    '三杠': [],
    '混幺九': ['碰碰和', '全带幺', '幺九刻'],
    '七对': ['门前清', '单钓将'],
    '七星不靠': ['五门齐', '门前清'],
    '全双刻': ['碰碰和', '断幺'],
    '清一色': ['无字'],
    '一色三同顺': ['一色三节高', '一般高'],
    '一色三节高': ['一色三同顺'],
    '全大': ['无字'],
    '全中': ['断幺'],
    '全小': ['无字'],
    '清龙': ['连六', '老少副'],
    '三色双龙会': ['平和', '无字', '喜相逢', '老少副'],
    '一色三步高': [],
    '全带五': ['断幺'],
    '三同刻': ['双同刻'],
    '三暗刻': ['双暗刻'],
    '全不靠': ['五门齐', '门前清'],
    '组合龙': [],
    '大于五': ['无字'],
    '小于五': ['无字'],
    '三风刻': [],
    '推不倒': ['缺一门'],
    '三色三同顺': ['喜相逢'],
    '三色三节高': [],
    '妙手回春': ['自摸'],
    '杠上开花': ['自摸'],
    '抢杠和': ['和绝张'],
    '三色三步高': [],
    '碰碰和': [],
    '混一色': ['缺一门', '无字'],
    '五门齐': ['无字', '缺一门'],
    '全求人': ['单钓将'],
    '双暗杠': ['暗杠', '双暗刻'],
    '双箭刻': ['箭刻'],
    '全带幺': ['断幺', '幺九刻'],
    '不求人': ['门前清', '自摸'],
    '双明杠': ['明杠'],
    '和绝张': [],
    '箭刻': [],
    '圈风刻': [],
    '门风刻': [],
    '门前清': [],
    '平和': ['无字'],
    '四归一': [],
    '双同刻': [],
    '双暗刻': [],
    '断幺': []
};

function calculateFan(handCards, actionGroups, options, huResult) {
    var scoringOptions = {};
    var optionKeys = Object.keys(options || {});
    for (var oi = 0; oi < optionKeys.length; oi++) {
        scoringOptions[optionKeys[oi]] = options[optionKeys[oi]];
    }
    scoringOptions._onlyWinningTile = getOnlyWinningTile(handCards, actionGroups, scoringOptions.winTile);

    var shapes = huResult.shapeCandidates || [huResult];
    var best = null;
    var candidates = [];
    var seenCandidates = {};

    _log('calculateFan enter: shapes=' + shapes.length +
         ', options=' + JSON.stringify(options || {}));

    for (var shapeIndex = 0; shapeIndex < shapes.length; shapeIndex++) {
        var shape = shapes[shapeIndex];
        var decomps = shape.special
            ? [{ pair: shape.zhlPair || null, concealedSets: [], special: shape.special }]
            : shape.decompositions;

        for (var i = 0; i < decomps.length; i++) {
            var allSets = shape.special
                ? analyzeSpecial(shape.special, handCards, actionGroups, shape, scoringOptions)
                : analyzeDecomposition(decomps[i], actionGroups, scoringOptions);
            var candidateKey = getScoringCandidateKey(shape.pattern, allSets);
            if (seenCandidates[candidateKey]) continue;
            seenCandidates[candidateKey] = true;

            _log('calculateFan candidate#' + candidates.length + ': pattern=' + shape.pattern +
                 ', pair=' + (decomps[i].pair || (shape.zhlPair || '-')) +
                 ', allSets=[' + _allSetsSummary(allSets) + ']');

            var matched = collectMatchedFans(allSets, handCards, actionGroups, scoringOptions, shape);
            _log('calculateFan candidate#' + candidates.length + ' matched(' + Object.keys(matched).length + '): ' +
                 _matchedSummary(matched));

            var fanList = applyExclusions(matched);
            var total = sumFans(fanList);

            // 无番和不是与其他番种并行匹配的普通番种，而是合法标准牌型
            // 在所有番种及“不计”规则处理完毕后仍为 0 番时的兜底番种。
            if (!shape.special && total === 0) {
                fanList = [{ name: '无番和', fan: 8 }];
                total = 8;
            }

            var candidate = {
                index: candidates.length,
                shapeIndex: shapeIndex,
                decompositionIndex: i,
                pattern: shape.pattern,
                pair: decomps[i].pair || shape.zhlPair || null,
                totalFan: total,
                fanList: fanList
            };
            candidates.push(candidate);
            _log('calculateFan candidate#' + candidate.index + ' afterExclusions(' + fanList.length + '): ' +
                 _fanListSummary(fanList) + ' | total=' + total);

            if (!best || total > best.totalFan) {
                best = candidate;
                _log('calculateFan candidate#' + candidate.index + ' -> new best (total=' + total + ')');
            }
        }
    }

    if (!best) {
        _log('calculateFan return: no valid result');
        return { totalFan: 0, fanList: [] };
    }
    var alternatives = candidates.filter(function (candidate) {
        return candidate.index !== best.index;
    }).map(function (candidate) {
        return {
            index: candidate.index,
            shapeIndex: candidate.shapeIndex,
            decompositionIndex: candidate.decompositionIndex,
            pattern: candidate.pattern,
            pair: candidate.pair,
            totalFan: candidate.totalFan,
            fanList: candidate.fanList,
            reason: candidate.totalFan < best.totalFan ? 'LOWER_TOTAL_FAN' : 'TIE_BREAK'
        };
    });

    _log('calculateFan return: totalFan=' + best.totalFan +
         ', fanList=[' + _fanListSummary(best.fanList) + ']');
    return {
        totalFan: best.totalFan,
        fanList: best.fanList,
        selectedCandidate: best,
        alternatives: alternatives
    };
}

function getScoringCandidateKey(pattern, allSets) {
    var sets = allSets.filter(function (set) { return set.kind !== 'special'; }).map(function (set) {
        return [
            set.kind,
            set.concealed ? '1' : '0',
            set.isKong ? '1' : '0',
            set.tiles.slice().sort().join(',')
        ].join(':');
    }).sort();
    return pattern + '|' + sets.join('|');
}

function collectMatchedFans(allSets, handCards, actionGroups, options, huResult) {
    var matched = {};
    var errorList = [];
    for (var i = 0; i < FAN_TABLE.length; i++) {
        var rule = FAN_TABLE[i];
        try {
            var checkResult = rule.check(allSets, handCards, actionGroups, options, huResult);
            if (checkResult) {
                var count = typeof checkResult === 'number' ? checkResult : 1;
                matched[rule.name] = rule.fan * count;
            }
        } catch (e) {
            errorList.push(rule.name + ':' + (e && e.message ? e.message : String(e)));
        }
    }
    if (errorList.length) {
        _log('collectMatchedFans errors: ' + errorList.join(', '));
    }
    return matched;
}

function applyExclusions(matched) {
    var sorted = Object.keys(matched).map(function (name) {
        return { name: name, fan: matched[name] };
    }).sort(function (a, b) { return b.fan - a.fan; });

    var removed = {};
    var removedLog = [];
    for (var i = 0; i < sorted.length; i++) {
        if (removed[sorted[i].name]) continue;
        var excl = EXCLUSIONS[sorted[i].name] || [];
        for (var j = 0; j < excl.length; j++) {
            if (matched[excl[j]] !== undefined && !removed[excl[j]]) {
                removed[excl[j]] = true;
                removedLog.push(excl[j] + ' (by ' + sorted[i].name + ')');
            }
        }
    }
    if (removedLog.length) {
        _log('applyExclusions removed: ' + removedLog.join(', '));
    }

    var result = [];
    sorted.forEach(function (item) {
        if (!removed[item.name]) result.push({ name: item.name, fan: item.fan });
    });
    return result;
}

function sumFans(fanList) {
    var s = 0;
    fanList.forEach(function (f) { s += f.fan; });
    return s;
}

// ====================================================================
// 番种检查函数
// ====================================================================

// --- 88番 ---

// 大四喜：4 个风刻
function fanDaSiXi(allSets) {
    var seen = {};
    allSets.forEach(function (s) {
        if (s.kind === 'kezi' && WINDS.indexOf(s.name) !== -1) seen[s.name] = true;
    });
    return Object.keys(seen).length === 4;
}

// 大三元：3 个箭刻
function fanDaSanYuan(allSets) {
    var seen = {};
    allSets.forEach(function (s) {
        if (s.kind === 'kezi' && DRAGONS.indexOf(s.name) !== -1) seen[s.name] = true;
    });
    return Object.keys(seen).length === 3;
}

// 绿一色：全由 23468 条 + 发 组成
function fanLvYiSe(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) { return GREEN_TILES.indexOf(t) !== -1; });
}

// 九莲宝灯：同花色 1112345678999 + 任意同花色 1 张
function fanJiuLianBaoDeng(allSets, handCards, actionGroups) {
    if (actionGroups && actionGroups.length > 0) return false;
    if (!handCards || handCards.length !== 14) return false;
    var types = {};
    handCards.forEach(function (c) { types[c.type] = true; });
    var tk = Object.keys(types);
    if (tk.length !== 1 || tk[0] === '字') return false;
    var suit = tk[0];
    var count = {};
    handCards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });
    var pattern = { 1: 3, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 3 };
    for (var v in pattern) {
        if ((count[v + suit] || 0) < pattern[v]) return false;
    }
    var extra = 0, total = 0;
    for (var n in count) {
        var p = parseName(n);
        if (!p || p.suit !== suit) return false;
        var need = pattern[p.value] || 0;
        extra += (count[n] - need);
        total += count[n];
    }
    return total === 14 && extra === 1;
}

// 四杠
function fanSiGang(allSets) {
    var cnt = countSets(allSets);
    return cnt.gang === 4;
}

// 连七对：同花色序数相连 7 对
function fanLianQiDui(allSets, handCards, actionGroups) {
    if (actionGroups && actionGroups.length > 0) return false;
    if (!handCards || handCards.length !== 14) return false;
    var count = {};
    handCards.forEach(function (c) { count[c.name] = (count[c.name] || 0) + 1; });
    if (Object.keys(count).length !== 7) return false;
    for (var k in count) if (count[k] !== 2) return false;
    var types = {};
    handCards.forEach(function (c) { types[c.type] = true; });
    var tk = Object.keys(types);
    if (tk.length !== 1 || tk[0] === '字') return false;
    var vals = Object.keys(count).map(function (k) {
        return parseInt(k.charAt(0), 10);
    }).sort(function (a, b) { return a - b; });
    for (var i = 1; i < vals.length; i++) {
        if (vals[i] !== vals[i - 1] + 1) return false;
    }
    return true;
}

// 十三幺
function fanShiSanYao(allSets, handCards, actionGroups, options, huResult) {
    return huResult.special === '十三幺';
}

// --- 64番 ---

// 清幺九：全部由数牌 1、9 组成
function fanQingYaoJiu(allSets) {
    if (!fanPengPengHu(allSets)) return false;
    var yao = ['1万', '9万', '1条', '9条', '1筒', '9筒'];
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) { return yao.indexOf(t) !== -1; });
}

// 小四喜：3 个风刻 + 1 对风将
function fanXiaoSiXi(allSets) {
    var windKezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && WINDS.indexOf(s.name) !== -1;
    });
    var windJiang = allSets.filter(function (s) {
        return s.kind === 'jiang' && WINDS.indexOf(s.name) !== -1;
    });
    if (windKezi.length !== 3 || windJiang.length !== 1) return false;
    var seen = {};
    windKezi.forEach(function (s) { seen[s.name] = true; });
    windJiang.forEach(function (s) { seen[s.name] = true; });
    return Object.keys(seen).length === 4;
}

// 小三元：2 个箭刻 + 1 对箭将
function fanXiaoSanYuan(allSets) {
    var dKezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && DRAGONS.indexOf(s.name) !== -1;
    });
    var dJiang = allSets.filter(function (s) {
        return s.kind === 'jiang' && DRAGONS.indexOf(s.name) !== -1;
    });
    if (dKezi.length !== 2 || dJiang.length !== 1) return false;
    var seen = {};
    dKezi.forEach(function (s) { seen[s.name] = true; });
    dJiang.forEach(function (s) { seen[s.name] = true; });
    return Object.keys(seen).length === 3;
}

// 字一色
function fanZiYiSe(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) { return ZI_NAMES.indexOf(t) !== -1; });
}

// 四暗刻：4 个暗刻（含暗杠）
function fanSiAnKe(allSets, handCards, actionGroups) {
    if (actionGroups) {
        for (var i = 0; i < actionGroups.length; i++) {
            if (actionGroups[i].type !== '暗杠') return false;
        }
    }
    var cnt = countSets(allSets);
    return cnt.ankeTotal === 4;
}

// 一色双龙会：同花色 123 123 789 789 55
function fanYiSeShuangLongHui(allSets) {
    var shunzi = allSets.filter(function (set) { return set.kind === 'shunzi'; });
    var jiang = allSets.filter(function (set) { return set.kind === 'jiang'; });
    if (shunzi.length !== 4 || jiang.length !== 1 || jiang[0].suit === '字' || jiang[0].start !== 5) {
        return false;
    }
    var suit = jiang[0].suit;
    var startCounts = {};
    shunzi.forEach(function (set) {
        if (set.suit === suit) startCounts[set.start] = (startCounts[set.start] || 0) + 1;
    });
    return startCounts[1] === 2 && startCounts[7] === 2;
}

// --- 48番 ---

// 一色四同顺：同花色 4 副相同顺子
function fanYiSeSiTongShun(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var groups = {};
    shunzi.forEach(function (s) {
        var key = s.suit + '_' + s.start;
        groups[key] = (groups[key] || 0) + 1;
    });
    for (var k in groups) if (groups[k] >= 4) return true;
    return false;
}

// 一色四节高：同花色 4 副依次递增 1 的刻子
function fanYiSeSiJieGao(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.suit !== '字';
    });
    var bySuit = {};
    kezi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    for (var suit in bySuit) {
        var vals = bySuit[suit].slice().sort(function (a, b) { return a - b; });
        if (vals.length >= 4) {
            for (var i = 0; i <= vals.length - 4; i++) {
                if (vals[i + 1] === vals[i] + 1 && vals[i + 2] === vals[i] + 2 &&
                    vals[i + 3] === vals[i] + 3) return true;
            }
        }
    }
    return false;
}

// --- 32番 ---

function hasEvenStepSequence(values, needed, steps) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    for (var start = 0; start <= sorted.length - needed; start++) {
        for (var s = 0; s < steps.length; s++) {
            var valid = true;
            for (var offset = 1; offset < needed; offset++) {
                if (sorted[start + offset] !== sorted[start] + steps[s] * offset) {
                    valid = false;
                    break;
                }
            }
            if (valid) return true;
        }
    }
    return false;
}

// 一色四步高：同花色4副依次递增1或2的顺子。
function fanYiSeSiBuGao(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var bySuit = {};
    shunzi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    for (var suit in bySuit) {
        if (hasEvenStepSequence(bySuit[suit], 4, [1, 2])) return true;
    }
    return false;
}

// 三杠
function fanSanGang(allSets) {
    var cnt = countSets(allSets);
    return cnt.gang === 3;
}

// 混幺九：全由幺九牌（含字牌）组成
function fanHunYaoJiu(allSets) {
    if (!fanPengPengHu(allSets)) return false;
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) { return YAOJIU_NAMES.indexOf(t) !== -1; });
}

// --- 24番 ---

function fanQiDui(allSets, handCards, actionGroups, options, huResult) {
    return huResult.special === '七对';
}

function fanQingYiSe(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    var suits = {};
    for (var i = 0; i < tiles.length; i++) {
        var p = parseName(tiles[i]);
        if (!p) return false;
        suits[p.suit] = true;
    }
    var suitNames = Object.keys(suits);
    return suitNames.length === 1 && suitNames[0] !== '字';
}

function fanYiSeSanTongShun(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var groups = {};
    shunzi.forEach(function (s) {
        var key = s.suit + '_' + s.start;
        groups[key] = (groups[key] || 0) + 1;
    });
    for (var k in groups) if (groups[k] >= 3) return true;
    return false;
}

function fanYiSeSanJieGao(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.suit !== '字';
    });
    var bySuit = {};
    kezi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    for (var suit in bySuit) {
        var vals = bySuit[suit].slice().sort(function (a, b) { return a - b; });
        if (vals.length >= 3) {
            for (var i = 0; i <= vals.length - 3; i++) {
                if (vals[i + 1] === vals[i] + 1 && vals[i + 2] === vals[i] + 2) return true;
            }
        }
    }
    return false;
}

function fanQuanDa(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) {
        var p = parseName(t);
        return p && p.value >= 7 && p.value <= 9;
    });
}

function fanQuanZhong(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) {
        var p = parseName(t);
        return p && p.value >= 4 && p.value <= 6;
    });
}

function fanQuanXiao(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) {
        var p = parseName(t);
        return p && p.value >= 1 && p.value <= 3;
    });
}

// --- 16番 ---

// 清龙：同花色 123 456 789
function fanQingLong(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var bySuit = {};
    shunzi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    for (var suit in bySuit) {
        var st = bySuit[suit];
        if (st.indexOf(1) !== -1 && st.indexOf(4) !== -1 && st.indexOf(7) !== -1) return true;
    }
    return false;
}

// 三色双龙会：2 个花色各 123 789 + 第 3 花色 55 将
function fanSanSeShuangLongHui(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var jiang = allSets.filter(function (s) { return s.kind === 'jiang'; });
    if (jiang.length !== 1 || jiang[0].suit === '字') return false;
    var jiangSuit = jiang[0].suit;
    var bySuit = {};
    shunzi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    var suits = Object.keys(bySuit);
    if (suits.length !== 2) return false;
    if (suits.indexOf(jiangSuit) !== -1) return false;
    return bySuit[suits[0]].indexOf(1) !== -1 && bySuit[suits[0]].indexOf(7) !== -1 &&
           bySuit[suits[1]].indexOf(1) !== -1 && bySuit[suits[1]].indexOf(7) !== -1;
}

// 一色三步高：同花色3副依次递增1或2的顺子。
function fanYiSeSanBuGao(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var bySuit = {};
    shunzi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    for (var suit in bySuit) {
        if (hasEvenStepSequence(bySuit[suit], 3, [1, 2])) return true;
    }
    return false;
}

// 全带五：每副面子都含 5
function fanQuanDaiWu(allSets) {
    var groups = allSets.filter(function (s) {
        return s.kind === 'kezi' || s.kind === 'shunzi' || s.kind === 'jiang';
    });
    if (groups.length !== 5) return false;
    return groups.every(function (s) {
        return s.tiles.indexOf('5万') !== -1 ||
               s.tiles.indexOf('5条') !== -1 ||
               s.tiles.indexOf('5筒') !== -1;
    });
}

// 三同刻：3 个花色中相同数值的刻子
function fanSanTongKe(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.suit !== '字';
    });
    var byValue = {};
    kezi.forEach(function (s) {
        if (!byValue[s.start]) byValue[s.start] = {};
        byValue[s.start][s.suit] = true;
    });
    for (var v in byValue) {
        if (Object.keys(byValue[v]).length >= 3) return true;
    }
    return false;
}

// 三暗刻
function fanSanAnKe(allSets) {
    var cnt = countSets(allSets);
    return cnt.ankeTotal === 3;
}

// --- 12番 ---

function fanQiXingBuKao(allSets, handCards, actionGroups, options, huResult) {
    return huResult.special === '七星不靠';
}

function makeTileByName(name) {
    var parsed = parseName(name);
    return {
        id: name,
        name: name,
        type: parsed ? parsed.suit : '字',
        value: parsed ? parsed.value : name,
        image: ''
    };
}

// 从和牌中移除和牌张，再枚举所有能完成结构的牌；只有唯一牌种时才可能计边、坎、钓。
function getOnlyWinningTile(handCards, actionGroups, winTile) {
    if (!winTile || !handCards || handCards.length === 0) return null;
    var beforeWin = handCards.slice();
    var removeIndex = -1;
    for (var i = beforeWin.length - 1; i >= 0; i--) {
        if (beforeWin[i].name === winTile) {
            removeIndex = i;
            break;
        }
    }
    if (removeIndex < 0) return null;
    beforeWin.splice(removeIndex, 1);

    var visibleCounts = {};
    beforeWin.forEach(function (tile) {
        visibleCounts[tile.name] = (visibleCounts[tile.name] || 0) + 1;
    });
    (actionGroups || []).forEach(function (group) {
        (group.cards || []).forEach(function (tile) {
            visibleCounts[tile.name] = (visibleCounts[tile.name] || 0) + 1;
        });
    });

    var waits = [];
    var previousLogState = LOG_ENABLED;
    LOG_ENABLED = false;
    try {
        for (var t = 0; t < ALL_TILE_NAMES.length; t++) {
            var candidate = ALL_TILE_NAMES[t];
            if ((visibleCounts[candidate] || 0) >= 4) continue;
            if (checkHu(beforeWin.concat([makeTileByName(candidate)]), actionGroups).canHu) {
                waits.push(candidate);
                if (waits.length > 1) return null;
            }
        }
    } finally {
        LOG_ENABLED = previousLogState;
    }
    return waits.length === 1 ? waits[0] : null;
}

// 全双刻：四副刻子（杠）与将牌全部由2、4、6、8数牌组成。
function fanQuanShuangKe(allSets) {
    var counts = countSets(allSets);
    if (counts.kezi !== 4 || counts.shunzi !== 0) return false;
    var allTiles = getAllTilesFromSets(allSets);
    if (allTiles.length === 0) return false;
    return allTiles.every(function (name) {
        var parsed = parseName(name);
        return parsed && parsed.value % 2 === 0;
    });
}

function fanQuanBuKao(allSets, handCards, actionGroups, options, huResult) {
    return huResult.special === '全不靠';
}

function fanZuHeLong(allSets, handCards, actionGroups, options, huResult) {
    return huResult.special === '组合龙';
}

// 大于五：全由 6-9 数牌组成
function fanDaYuWu(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) {
        var p = parseName(t);
        return p && p.value >= 6 && p.value <= 9;
    });
}

// 小于五：全由 1-4 数牌组成
function fanXiaoYuWu(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) {
        var p = parseName(t);
        return p && p.value >= 1 && p.value <= 4;
    });
}

// 三风刻：3 个风刻
function fanSanFengKe(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && WINDS.indexOf(s.name) !== -1;
    });
    return kezi.length >= 3;
}

// --- 8番 ---

// 花龙：三色三顺 123 456 789 分布在三种花色
function fanHuaLong(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var byStart = { 1: [], 4: [], 7: [] };
    shunzi.forEach(function (s) {
        if (s.start === 1 || s.start === 4 || s.start === 7) byStart[s.start].push(s.suit);
    });
    if (byStart[1].length === 0 || byStart[4].length === 0 || byStart[7].length === 0) return false;
    for (var i = 0; i < byStart[1].length; i++) {
        for (var j = 0; j < byStart[4].length; j++) {
            for (var k = 0; k < byStart[7].length; k++) {
                var s1 = byStart[1][i], s4 = byStart[4][j], s7 = byStart[7][k];
                if (s1 !== s4 && s1 !== s7 && s4 !== s7) return true;
            }
        }
    }
    return false;
}

// 推不倒
function fanTuiBuDao(allSets) {
    var ok = [
        '1筒', '2筒', '3筒', '4筒', '5筒', '8筒', '9筒',
        '2条', '4条', '5条', '6条', '8条', '9条',
        '白'
    ];
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) { return ok.indexOf(t) !== -1; });
}

// 三色三同顺：3 个花色相同起始顺子
function fanSanSeSanTongShun(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var byStart = {};
    shunzi.forEach(function (s) {
        if (!byStart[s.start]) byStart[s.start] = {};
        byStart[s.start][s.suit] = true;
    });
    for (var v in byStart) {
        if (Object.keys(byStart[v]).length >= 3) return true;
    }
    return false;
}

// 三色三节高：3 花色依次递增 1 的刻子
function fanSanSeSanJieGao(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.suit !== '字';
    });
    if (kezi.length < 3) return false;
    for (var i = 0; i < kezi.length; i++) {
        for (var j = 0; j < kezi.length; j++) {
            for (var k = 0; k < kezi.length; k++) {
                if (i === j || i === k || j === k) continue;
                if (kezi[i].suit === kezi[j].suit || kezi[i].suit === kezi[k].suit ||
                    kezi[j].suit === kezi[k].suit) continue;
                if (kezi[j].start === kezi[i].start + 1 &&
                    kezi[k].start === kezi[j].start + 1) return true;
            }
        }
    }
    return false;
}

// 无番和由 calculateFan 在其他所有番种结算后反向判定。
function fanWuFanHe() { return false; }

function fanMiaoShouHuiChun(allSets, handCards, actionGroups, options) {
    return !!options.miaoshouhuichun;
}

function fanHaiDiLaoYue(allSets, handCards, actionGroups, options) {
    return !!options.haidilaoyue;
}

function fanGangShangKaiHua(allSets, handCards, actionGroups, options) {
    return !!options.gangshangkaihua;
}

function fanQiangGangHu(allSets, handCards, actionGroups, options) {
    return !!options.qiangganghu;
}

// --- 6番 ---

// 碰碰和：4 副刻子（含杠）+ 1 对将
function fanPengPengHu(allSets) {
    var cnt = countSets(allSets);
    var jiang = allSets.filter(function (s) { return s.kind === 'jiang'; });
    return cnt.kezi === 4 && jiang.length === 1;
}

// 混一色：一种花色数牌 + 字牌
function fanHunYiSe(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    var numSuits = {}, hasZi = false;
    tiles.forEach(function (t) {
        if (ZI_NAMES.indexOf(t) !== -1) hasZi = true;
        else {
            var p = parseName(t);
            if (p) numSuits[p.suit] = true;
        }
    });
    return Object.keys(numSuits).length === 1 && hasZi;
}

// 三色三步高：3 花色依次递增 1 的顺子
function fanSanSeSanBuGao(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    if (shunzi.length < 3) return false;
    for (var i = 0; i < shunzi.length; i++) {
        for (var j = 0; j < shunzi.length; j++) {
            for (var k = 0; k < shunzi.length; k++) {
                if (i === j || i === k || j === k) continue;
                if (shunzi[i].suit === shunzi[j].suit || shunzi[i].suit === shunzi[k].suit ||
                    shunzi[j].suit === shunzi[k].suit) continue;
                if (shunzi[j].start === shunzi[i].start + 1 &&
                    shunzi[k].start === shunzi[j].start + 1) return true;
            }
        }
    }
    return false;
}

// 五门齐：万条筒风箭齐全
function fanWuMenQi(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    var has = { '万': false, '条': false, '筒': false, '风': false, '箭': false };
    tiles.forEach(function (t) {
        var p = parseName(t);
        if (p) has[p.suit] = true;
        else if (WINDS.indexOf(t) !== -1) has.风 = true;
        else if (DRAGONS.indexOf(t) !== -1) has.箭 = true;
    });
    return has.万 && has.条 && has.筒 && has.风 && has.箭;
}

// 全求人：4 副操作组 + 单钓
function fanQuanQiuRen(allSets, handCards, actionGroups, options) {
    if (options.zimo) return false;
    if (!actionGroups || actionGroups.length !== 4) return false;
    if (!handCards || handCards.length !== 2) return false;
    for (var i = 0; i < actionGroups.length; i++) {
        if (actionGroups[i].type === '暗杠') return false;
    }
    return handCards[0].name === handCards[1].name;
}

// 双暗杠
function fanShuangAnGang(allSets) {
    var cnt = countSets(allSets);
    return cnt.angang === 2;
}

// 双箭刻
function fanShuangJianKe(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && DRAGONS.indexOf(s.name) !== -1;
    });
    return kezi.length >= 2;
}

// --- 4番 ---

// 全带幺：每副面子和将都含幺九牌
function fanQuanDaiYao(allSets) {
    var nonSpecial = allSets.filter(function (s) {
        return s.kind === 'kezi' || s.kind === 'shunzi' || s.kind === 'jiang';
    });
    var mianziCount = nonSpecial.filter(function (s) {
        return s.kind === 'kezi' || s.kind === 'shunzi';
    }).length;
    var jiangCount = nonSpecial.filter(function (s) { return s.kind === 'jiang'; }).length;
    if (nonSpecial.length !== 5 || mianziCount !== 4 || jiangCount !== 1) return false;
    return nonSpecial.every(function (s) {
        return s.tiles.some(function (t) { return YAOJIU_NAMES.indexOf(t) !== -1; });
    });
}

// 不求人：无吃碰杠 + 自摸
function fanBuQiuRen(allSets, handCards, actionGroups, options) {
    for (var i = 0; actionGroups && i < actionGroups.length; i++) {
        if (actionGroups[i].type !== '暗杠') return false;
    }
    return !!options.zimo;
}

// 双明杠
function fanShuangMingGang(allSets) {
    var cnt = countSets(allSets);
    // 官方规则规定两明杠计4分，一明杠加一暗杠计6分。
    // 混合双杠按“双明杠4分 + 暗杠2分”表达，明杠1分由不计关系移除。
    return cnt.gang === 2 && cnt.minggang >= 1;
}

// 和绝张
function fanHeJueZhang(allSets, handCards, actionGroups, options) {
    return !!options.juezhang;
}

// --- 2番 ---

// 箭刻
function fanJianKe(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && DRAGONS.indexOf(s.name) !== -1;
    });
    return kezi.length >= 1;
}

// 圈风刻
function fanQuanFengKe(allSets, handCards, actionGroups, options) {
    var rw = WINDS[options.roundWind || 0];
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.name === rw;
    });
    return kezi.length >= 1;
}

// 门风刻
function fanMenFengKe(allSets, handCards, actionGroups, options) {
    var sw = WINDS[options.seatWind || 0];
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.name === sw;
    });
    return kezi.length >= 1;
}

// 门前清：无吃、碰、明杠
function fanMenQianQing(allSets, handCards, actionGroups) {
    if (!actionGroups) return true;
    for (var i = 0; i < actionGroups.length; i++) {
        var t = actionGroups[i].type;
        if (t === '吃' || t === '碰' || t === '明杠') return false;
    }
    return true;
}

// 平和：4副顺子及序数牌作将；允许副露，边、坎、钓不影响成立。
function fanPingHe(allSets, handCards, actionGroups, options, huResult) {
    var cnt = countSets(allSets);
    var jiang = allSets.filter(function (s) { return s.kind === 'jiang'; });
    if (jiang.length !== 1) return false;
    if (huResult && huResult.special === '组合龙') {
        return cnt.shunzi === 1 && !!parseName(jiang[0].name);
    }
    if (cnt.shunzi !== 4) return false;
    return !!parseName(jiang[0].name);
}

// 四归一：同种牌 4 张分在面子里（非杠）
function fanSiGuiYi(allSets) {
    var cnt = countTileByName(allSets);
    var total = 0;
    for (var n in cnt) {
        if (cnt[n] === 4) {
            var inKong = allSets.filter(function (s) {
                return s.isKong && s.tiles.indexOf(n) !== -1;
            });
            if (inKong.length === 0) total++;
        }
    }
    return total;
}

// 双同刻：两种花色相同数值的刻子
function fanShuangTongKe(allSets) {
    var kezi = allSets.filter(function (s) {
        return s.kind === 'kezi' && s.suit !== '字';
    });
    var byVal = {};
    kezi.forEach(function (s) {
        if (!byVal[s.start]) byVal[s.start] = {};
        byVal[s.start][s.suit] = (byVal[s.start][s.suit] || 0) + 1;
    });
    var total = 0;
    for (var v in byVal) {
        total += countCrossSuitPairs(byVal[v]);
    }
    return total;
}

// 双暗刻
function fanShuangAnKe(allSets) {
    var cnt = countSets(allSets);
    return cnt.ankeTotal === 2;
}

// 断幺：无幺九牌和字牌
function fanDuanYao(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    if (tiles.length === 0) return false;
    return tiles.every(function (t) { return YAOJIU_NAMES.indexOf(t) === -1; });
}

// --- 1番 ---

// 一般高：2 副相同顺子
function fanYiBanGao(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var counts = {};
    for (var i = 0; i < shunzi.length; i++) {
        var key = shunzi[i].suit + '_' + shunzi[i].start;
        counts[key] = (counts[key] || 0) + 1;
    }
    var total = 0;
    for (var key in counts) total += Math.floor(counts[key] / 2);
    return total;
}

// 喜相逢：2 种花色相同顺子
function fanXiXiangFeng(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var byStart = {};
    shunzi.forEach(function (s) {
        if (!byStart[s.start]) byStart[s.start] = {};
        byStart[s.start][s.suit] = (byStart[s.start][s.suit] || 0) + 1;
    });
    var total = 0;
    for (var v in byStart) {
        total += countCrossSuitPairs(byStart[v]);
    }
    return total;
}

function countCrossSuitPairs(countsBySuit) {
    var counts = Object.keys(countsBySuit).map(function (suit) {
        return countsBySuit[suit];
    });
    var total = counts.reduce(function (sum, count) { return sum + count; }, 0);
    var largest = counts.reduce(function (max, count) { return Math.max(max, count); }, 0);
    return Math.min(Math.floor(total / 2), total - largest);
}

// 连六：同花色 2 副递增 3 的顺子（如 123 456）
function fanLianLiu(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var bySuit = {};
    shunzi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    var total = 0;
    for (var suit in bySuit) {
        var starts = bySuit[suit].slice().sort(function (a, b) { return a - b; });
        var used = [];
        for (var i = 0; i < starts.length; i++) used[i] = false;
        for (var left = 0; left < starts.length; left++) {
            if (used[left]) continue;
            for (var right = left + 1; right < starts.length; right++) {
                if (!used[right] && starts[right] === starts[left] + 3) {
                    used[left] = true;
                    used[right] = true;
                    total++;
                    break;
                }
            }
        }
    }
    return total;
}

// 老少副：同花色 123 789
function fanLaoShaoFu(allSets) {
    var shunzi = allSets.filter(function (s) { return s.kind === 'shunzi'; });
    var bySuit = {};
    shunzi.forEach(function (s) {
        if (!bySuit[s.suit]) bySuit[s.suit] = [];
        bySuit[s.suit].push(s.start);
    });
    var total = 0;
    for (var suit in bySuit) {
        var ones = bySuit[suit].filter(function (start) { return start === 1; }).length;
        var sevens = bySuit[suit].filter(function (start) { return start === 7; }).length;
        total += Math.min(ones, sevens);
    }
    return total;
}

// 幺九刻：数牌1/9刻子，以及既非圈风也非门风的风刻；每副计1番。
function fanYaoJiuKe(allSets, handCards, actionGroups, options) {
    var roundWind = WINDS[options.roundWind || 0];
    var seatWind = WINDS[options.seatWind || 0];
    var kezi = allSets.filter(function (s) { return s.kind === 'kezi'; });
    var total = 0;
    kezi.forEach(function (set) {
        var parsed = parseName(set.name);
        if (parsed && (parsed.value === 1 || parsed.value === 9)) {
            total++;
        } else if (WINDS.indexOf(set.name) !== -1 &&
                   set.name !== roundWind && set.name !== seatWind) {
            total++;
        }
    });
    return total;
}

// 明杠
function fanMingGang(allSets) {
    var cnt = countSets(allSets);
    // 两杠及以上由双明杠、三杠或四杠覆盖，不能再重复追加单明杠。
    return cnt.gang === 1 && cnt.minggang === 1;
}

// 缺一门：缺一种花色数牌
function fanQueYiMen(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    var numSuits = { '万': false, '条': false, '筒': false };
    tiles.forEach(function (t) {
        var p = parseName(t);
        if (p) numSuits[p.suit] = true;
    });
    var c = 0;
    for (var s in numSuits) if (numSuits[s]) c++;
    return c === 2;
}

// 无字
function fanWuZi(allSets) {
    var tiles = getAllTilesFromSets(allSets);
    return tiles.every(function (t) { return ZI_NAMES.indexOf(t) === -1; });
}

// 边张：胡顺子的边张（12->3 或 89->7）
function fanBianZhang(allSets, handCards, actionGroups, options) {
    if (!options.winTile || options._onlyWinningTile !== options.winTile) return false;
    var win = options.winTile;
    var shunzi = allSets.filter(function (s) {
        return s.kind === 'shunzi' && s.tiles.indexOf(win) !== -1;
    });
    return shunzi.some(function (s) {
        return (s.start === 1 && win === '3' + s.suit) ||
               (s.start === 7 && win === '7' + s.suit);
    });
}

// 坎张：胡顺子的中间张
function fanKanZhang(allSets, handCards, actionGroups, options) {
    if (!options.winTile || options._onlyWinningTile !== options.winTile) return false;
    var win = options.winTile;
    var p = parseName(win);
    if (!p) return false;
    var shunzi = allSets.filter(function (s) {
        return s.kind === 'shunzi' && s.tiles.indexOf(win) !== -1;
    });
    return shunzi.some(function (s) { return s.start === p.value - 1; });
}

// 单钓将：胡的牌作将
function fanDanDiaoJiang(allSets, handCards, actionGroups, options) {
    if (!options.winTile || options._onlyWinningTile !== options.winTile) return false;
    var win = options.winTile;
    var jiang = allSets.filter(function (s) {
        return s.kind === 'jiang' && s.name === win;
    });
    if (jiang.length === 0) return false;
    return jiang[0].tiles.every(function (t) { return t === win; });
}

// 自摸
function fanZiMo(allSets, handCards, actionGroups, options) {
    return !!options.zimo;
}

// 暗杠（2番）
function fanAnGang(allSets) {
    var cnt = countSets(allSets);
    return cnt.angang >= 1;
}

module.exports = {
    calculateHu: calculateHu,
    checkHu: checkHu,
    getFanDefinitions: function () {
        return FAN_TABLE.map(function (rule) {
            return {
                name: rule.name,
                fan: rule.fan,
                exclusions: (EXCLUSIONS[rule.name] || []).slice()
            };
        });
    }
};
