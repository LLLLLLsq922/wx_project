'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var schema = require('../data/schema.js');
var matchState = require('../rules/sichuan/matchState.js');
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
    ['create', 'matches', 'match', 'round'].forEach(function (name) {
        var wxss = fs.readFileSync(path.join(root, name, name + '.wxss'), 'utf8');
        assert.match(wxss, /\.page-shell\s*\{[^}]*overflow-x:\s*hidden/s);
    });
    assert.match(fs.readFileSync(path.join(root, 'create', 'create.wxml'), 'utf8'), /创建并保存牌局/);
    assert.match(fs.readFileSync(path.join(root, 'match', 'match.wxml'), 'utf8'), /当前总分/);
    assert.match(fs.readFileSync(path.join(root, 'round', 'round.wxml'), 'utf8'), /本局换牌方向/);
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
