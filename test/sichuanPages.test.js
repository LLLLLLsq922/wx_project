'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var schema = require('../data/schema.js');
var matchState = require('../rules/sichuan/matchState.js');
var roundState = require('../rules/sichuan/roundState.js');
var matchService = require('../services/matchService.js');

function pageDefinitionFor(relativePath) {
    var definition = null;
    global.Page = function (value) { definition = value; };
    delete require.cache[require.resolve(relativePath)];
    require(relativePath);
    return definition;
}

function storageWx(calls) {
    var values = {};
    return {
        getStorageSync: function (key) { return values[key]; },
        setStorageSync: function (key, value) { values[key] = value; },
        removeStorageSync: function (key) { delete values[key]; },
        showToast: function (options) { calls.push(['toast', options.title]); },
        redirectTo: function (options) { calls.push(['redirect', options.url]); },
        navigateTo: function (options) { calls.push(['navigate', options.url]); }
    };
}

function pageContext(definition) {
    var context = {
        data: JSON.parse(JSON.stringify(definition.data)),
        setData: function (update) {
            Object.keys(update).forEach(function (key) { context.data[key] = update[key]; });
        }
    };
    Object.keys(definition).forEach(function (key) {
        if (typeof definition[key] === 'function') context[key] = definition[key];
    });
    return context;
}

test('川麻页面均限制横向溢出并提供创建、总分和当前局关键信息', function () {
    var root = path.join(__dirname, '..', 'subpackages', 'sichuan', 'pages');
    ['create', 'matches', 'match', 'round', 'result', 'history', 'rules', 'rule-detail'].forEach(function (name) {
        var wxss = fs.readFileSync(path.join(root, name, name + '.wxss'), 'utf8');
        assert.match(wxss, /\.page-shell\s*\{[^}]*overflow-x:\s*hidden/s);
    });
    assert.match(fs.readFileSync(path.join(root, 'create', 'create.wxml'), 'utf8'), /创建并保存牌局/);
    assert.match(fs.readFileSync(path.join(root, 'match', 'match.wxml'), 'utf8'), /当前总分/);
    assert.match(fs.readFileSync(path.join(root, 'round', 'round.wxml'), 'utf8'), /本局换牌方向/);
    assert.match(fs.readFileSync(path.join(root, 'result', 'result.wxml'), 'utf8'), /逐笔支付/);
});

test('创建页面把四名玩家和规则保存为本机进行中牌局', function () {
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/create/create.js');
    var page = pageContext(definition);
    var calls = [];
    global.wx = storageWx(calls);
    var app = {
        globalData: { localData: schema.createDefaultData(), storageError: null }
    };
    global.getApp = function () { return app; };

    page.createMatch();

    assert.equal(app.globalData.localData.activeMatches.length, 1);
    var saved = app.globalData.localData.activeMatches[0];
    assert.equal(saved.variant, 'sichuan');
    assert.equal(saved.mode, 'bloodBattle');
    assert.equal(saved.players.length, 4);
    assert.equal(saved.rulesSnapshot.huansanzhangEnabled, true);
    assert.equal(saved.format.roundCount, 4);
    assert.equal(calls.some(function (call) {
        return call[0] === 'redirect' && call[1].indexOf('/subpackages/sichuan/pages/match/match?id=') === 0;
    }), true);
});

test('本地数据加载异常时创建页面不会覆盖原存储', function () {
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/create/create.js');
    var page = pageContext(definition);
    var calls = [];
    global.wx = storageWx(calls);
    global.getApp = function () {
        return { globalData: { localData: null, storageError: { code: 'PARSE_FAILED' } } };
    };

    page.createMatch();

    assert.equal(calls.some(function (call) {
        return call[0] === 'toast' && call[1].indexOf('本地数据尚未安全加载') !== -1;
    }), true);
    assert.equal(calls.some(function (call) { return call[0] === 'redirect'; }), false);
});

test('牌局总览开始下一局时创建并持久化可恢复草稿', function () {
    var match = matchState.createMatch({
        matchId: 'm1',
        mode: 'bloodBattle',
        players: [
            { id: 'p1', name: '甲' }, { id: 'p2', name: '乙' },
            { id: 'p3', name: '丙' }, { id: 'p4', name: '丁' }
        ],
        initialDealerId: 'p1',
        format: { type: 'fixedRounds', roundCount: 4 },
        timestamp: '2026-09-05T00:00:00.000Z'
    });
    var data = matchService.upsertMatch(schema.createDefaultData(), match);
    var app = { globalData: { localData: data } };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);

    var definition = pageDefinitionFor('../subpackages/sichuan/pages/match/match.js');
    definition.startNextRound.call({ data: { matchId: 'm1' } });

    var saved = matchService.findMatch(app.globalData.localData, 'm1').match;
    assert.ok(saved.currentRound);
    assert.equal(saved.currentRound.phase, 'exchange');
    assert.equal(saved.currentRound.dealerId, 'p1');
    assert.equal(calls.some(function (call) {
        return call[0] === 'navigate' && call[1] === '/subpackages/sichuan/pages/round/round?id=m1';
    }), true);
});

test('当前局页面保存部分换牌选择并推进换三张和定缺阶段', function () {
    var match = matchState.createMatch({
        matchId: 'm1',
        mode: 'bloodBattle',
        players: [
            { id: 'p1', name: '甲' }, { id: 'p2', name: '乙' },
            { id: 'p3', name: '丙' }, { id: 'p4', name: '丁' }
        ],
        initialDealerId: 'p1',
        format: { type: 'fixedRounds', roundCount: 4 },
        timestamp: '2026-09-05T00:00:00.000Z'
    });
    match.currentRound = matchState.createNextRound(match, {
        roundId: 'r1', random: function () { return 0; }
    });
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'm1' });
    page.onShow();

    page.selectExchangeTile({ currentTarget: { dataset: {
        tile: { id: 'm1', suit: 'm', name: '1万' }
    } } });
    var partial = matchService.findMatch(app.globalData.localData, 'm1').match.currentRound;
    assert.deepEqual(partial.inputDraft.exchangeSelections.p1, ['m1']);

    page.data.exchangeSelections = {
        p1: ['m1', 'm2', 'm3'],
        p2: ['s1', 's2', 's3'],
        p3: ['p1', 'p2', 'p3'],
        p4: ['m4', 'm5', 'm6']
    };
    page.submitExchange();
    assert.equal(page.data.round.phase, 'dingque');

    [
        ['p1', 'p'], ['p2', 'm'], ['p3', 's'], ['p4', 'p']
    ].forEach(function (selection) {
        page.selectDingque({ currentTarget: { dataset: {
            player: selection[0], suit: selection[1]
        } } });
    });
    page.submitDingque();
    assert.equal(page.data.round.phase, 'play');
    assert.equal(matchService.findMatch(app.globalData.localData, 'm1').match.currentRound.phase, 'play');

    page.openKongEntry();
    page.submitKong();
    var afterKong = matchService.findMatch(app.globalData.localData, 'm1').match.currentRound;
    assert.equal(afterKong.transactions.length, 1);
    assert.equal(afterKong.transactions[0].type, 'kong');
    assert.deepEqual(afterKong.scoreChanges, { p1: 2, p2: -2, p3: 0, p4: 0 });
});

function playableMatch(mode) {
    var match = matchState.createMatch({
        matchId: 'win-match',
        mode: mode || 'normal',
        players: [
            { id: 'p1', name: '甲' }, { id: 'p2', name: '乙' },
            { id: 'p3', name: '丙' }, { id: 'p4', name: '丁' }
        ],
        initialDealerId: 'p1',
        format: { type: 'fixedRounds', roundCount: 4 },
        rules: {
            huansanzhangEnabled: false,
            dingqueEnabled: false,
            menqingZhongzhangEnabled: false
        },
        timestamp: '2026-09-05T00:00:00.000Z'
    });
    match.currentRound = matchState.createNextRound(match, { roundId: 'win-round' });
    return match;
}

function winningDraft() {
    return {
        concealedTiles: [
            'm1', 'm2', 'm3', 'm3', 'm4', 'm5', 's2',
            's3', 's4', 's6', 's7', 's8', 'm5', 'm5'
        ],
        melds: [],
        winTile: 'm5',
        result: null
    };
}

test('当前局页面根据完整手牌计算番数并可人工改庄后计入整场', function () {
    var match = playableMatch('normal');
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'win-match' });
    page.onShow();
    page.openWinEntry();
    page.data.winDrafts.p1 = winningDraft();
    page.data.currentWinDraft = winningDraft();

    page.calculateCurrentWinner();
    assert.equal(page.data.currentWinDraft.result.canWin, true);
    assert.equal(page.data.currentWinDraft.result.totalFan, 0);

    page.submitWin();
    assert.equal(page.data.round.ended, true);
    assert.equal(page.data.round.events[0].winners[0].pattern, '平胡');
    assert.deepEqual(page.data.round.scoreChanges, { p1: 1, p2: -1, p3: 0, p4: 0 });

    page.onNextDealerChange({ detail: { value: 2 } });
    page.commitEndedRound();
    var saved = matchService.findMatch(app.globalData.localData, 'win-match').match;
    assert.equal(saved.currentRound, undefined);
    assert.equal(saved.rounds.length, 1);
    assert.equal(saved.rounds[0].dealerOverrideId, 'p3');
    assert.equal(saved.nextDealerId, 'p3');
    assert.deepEqual(saved.scoreTotals, { p1: 1, p2: -1, p3: 0, p4: 0 });
    assert.equal(calls.some(function (call) {
        return call[0] === 'redirect' && call[1].indexOf('/subpackages/sichuan/pages/match/match?id=') === 0;
    }), true);
});

test('不限局数牌局可从总览手动结束并迁移到历史集合', function () {
    var match = matchState.createMatch({
        matchId: 'unlimited-match',
        mode: 'normal',
        players: [
            { id: 'p1', name: '甲' }, { id: 'p2', name: '乙' },
            { id: 'p3', name: '丙' }, { id: 'p4', name: '丁' }
        ],
        initialDealerId: 'p1',
        format: { type: 'unlimited' },
        timestamp: '2026-09-05T00:00:00.000Z'
    });
    var app = { globalData: { localData: matchService.upsertMatch(schema.createDefaultData(), match) } };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/match/match.js');
    var page = pageContext(definition);
    page.data.matchId = 'unlimited-match';
    page.refreshMatch();
    assert.equal(page.data.canManualEnd, true);

    page.endUnlimitedMatchNow();

    var found = matchService.findMatch(app.globalData.localData, 'unlimited-match');
    assert.equal(found.collection, 'completedMatches');
    assert.equal(found.match.status, 'completed');
    assert.equal(page.data.canManualEnd, false);
});

test('当前局页面拒绝未组成合法结构的胡牌并保留本机草稿', function () {
    var match = playableMatch('normal');
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'win-match' });
    page.onShow();
    page.openWinEntry();
    page.addWinTile({ currentTarget: { dataset: { tile: { id: 'm1' } } } });
    page.submitWin();

    var savedRound = matchService.findMatch(app.globalData.localData, 'win-match').match.currentRound;
    assert.equal(savedRound.ended, false);
    assert.deepEqual(savedRound.inputDraft.winEntry.drafts.p1.concealedTiles, ['m1']);
    assert.equal(calls.some(function (call) {
        return call[0] === 'toast' && call[1].indexOf('牌张数量不正确') !== -1;
    }), true);
});

test('当前局页面支持一炮多响并分别使用每名玩家的算牌结果', function () {
    var match = playableMatch('bloodBattle');
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'win-match' });
    page.onShow();
    page.openWinEntry();
    page.data.selectedWinnerIds = ['p1', 'p3'];
    page.data.winDiscarderIndex = 1;
    page.data.winDrafts = { p1: winningDraft(), p3: winningDraft() };

    page.submitWin();

    assert.equal(page.data.round.ended, false);
    assert.deepEqual(page.data.round.activePlayerIds, ['p2', 'p4']);
    assert.deepEqual(page.data.round.scoreChanges, { p1: 1, p2: -2, p3: 1, p4: 0 });
    assert.equal(page.data.round.events[0].winners.length, 2);
    assert.deepEqual(page.data.winDrafts, {});
});

function wallDraft(concealedTiles) {
    return { concealedTiles: concealedTiles, melds: [], result: null };
}

test('牌墙耗尽页面自动执行花猪大叫退税并可确认计入整场', function () {
    var match = playableMatch('bloodBattle');
    match.rulesSnapshot.dingqueEnabled = true;
    match.rulesSnapshot.menqingZhongzhangEnabled = true;
    var round = match.currentRound;
    round.rules.dingqueEnabled = true;
    round.rules.menqingZhongzhangEnabled = true;
    round.phase = 'play';
    round.dingqueSuits = { p1: 'p', p2: 'p', p3: 'p', p4: 'p' };
    round = roundState.recordKong(round, {
        actorId: 'p3', sourcePlayerId: 'p4', kongType: 'directKong'
    });
    round = roundState.recordWin(round, {
        winners: [{ playerId: 'p1', fan: 0 }],
        discarderId: 'p4'
    });
    match.currentRound = round;
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'win-match' });
    page.onShow();
    page.openWallEnd();
    page.data.wallDrafts = {
        p2: wallDraft([
            'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
            's1', 's2', 's3', 's7', 's8', 's9', 'm9'
        ]),
        p3: wallDraft([
            'm1', 'm2', 'm4', 'm5', 'm7', 'm8',
            's1', 's3', 's4', 's6', 's8', 'p2', 'p5'
        ]),
        p4: wallDraft([
            'm2', 'm3', 'm5', 'm6', 'm8', 'm9',
            's1', 's2', 's3', 's4', 's5', 's7', 's9'
        ])
    };
    page.data.currentWallPlayerId = 'p2';
    page.data.currentWallDraft = page.data.wallDrafts.p2;

    page.analyzeCurrentWallPlayer();
    assert.equal(page.data.currentWallDraft.result.isReady, true);
    assert.equal(page.data.currentWallDraft.result.maxFan, 1);
    page.submitWallEnd();

    assert.equal(page.data.round.ended, true);
    assert.equal(page.data.round.endReason, 'wallExhausted');
    assert.deepEqual(page.data.round.transactions.map(function (transaction) {
        return transaction.type;
    }), ['kong', 'win', 'huazhu', 'dajiao', 'taxRefund']);
    assert.deepEqual(page.data.round.scoreChanges, { p1: 17, p2: 18, p3: -48, p4: 13 });
    var terminalEvent = page.data.round.events[page.data.round.events.length - 1];
    assert.deepEqual(terminalEvent.huazhuPlayerIds, ['p3']);
    assert.equal(terminalEvent.dajiaoResults.find(function (item) {
        return item.playerId === 'p2';
    }).maxFan, 1);

    page.commitEndedRound();
    var saved = matchService.findMatch(app.globalData.localData, 'win-match').match;
    assert.equal(saved.rounds.length, 1);
    assert.deepEqual(saved.scoreTotals, { p1: 17, p2: 18, p3: -48, p4: 13 });
});

test('牌墙耗尽页面拒绝四家合计出现第五张同牌', function () {
    var match = playableMatch('normal');
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'win-match' });
    page.onShow();
    page.openWallEnd();
    page.addWallTile({ currentTarget: { dataset: { tile: { id: 'm1' } } } });
    assert.deepEqual(
        matchService.findMatch(app.globalData.localData, 'win-match').match.currentRound
            .inputDraft.wallEntry.drafts.p1.concealedTiles,
        ['m1']
    );
    var base = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 's1', 's2', 's3', 's7', 's8', 's9', 'm9'];
    page.data.wallDrafts = {
        p1: wallDraft(base.slice()), p2: wallDraft(base.slice()),
        p3: wallDraft(base.slice()), p4: wallDraft(base.slice())
    };
    page.data.wallDrafts.p1.concealedTiles[12] = 'm1';

    page.submitWallEnd();

    assert.equal(page.data.round.ended, false);
    assert.equal(calls.some(function (call) {
        return call[0] === 'toast' && call[1].indexOf('超过四张') !== -1;
    }), true);
});

test('关闭全部终局附加规则时牌墙耗尽无需录入手牌', function () {
    var match = playableMatch('normal');
    ['huazhuEnabled', 'dajiaoEnabled', 'taxRefundEnabled'].forEach(function (key) {
        match.rulesSnapshot[key] = false;
        match.currentRound.rules[key] = false;
    });
    var app = {
        globalData: {
            localData: matchService.upsertMatch(schema.createDefaultData(), match),
            settings: { soundEnabled: false, vibrationEnabled: false }
        }
    };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = storageWx(calls);
    var definition = pageDefinitionFor('../subpackages/sichuan/pages/round/round.js');
    var page = pageContext(definition);
    page.onLoad({ id: 'win-match' });
    page.onShow();

    page.openWallEnd();

    assert.equal(page.data.round.ended, true);
    assert.deepEqual(page.data.round.transactions, []);
    assert.equal(page.data.showWallForm, false);
});
