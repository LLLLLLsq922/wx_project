'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var schema = require('../data/schema.js');

function pageDefinition() {
    var definition = null;
    global.Page = function (value) { definition = value; };
    delete require.cache[require.resolve('../subpackages/sichuan/pages/calc/calc.js')];
    require('../subpackages/sichuan/pages/calc/calc.js');
    return definition;
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

function testWx(calls) {
    var values = {};
    return {
        getStorageSync: function (key) { return values[key]; },
        setStorageSync: function (key, value) { values[key] = value; },
        removeStorageSync: function (key) { delete values[key]; },
        showToast: function (options) { calls.push(['toast', options.title]); },
        showModal: function (options) { options.success({ confirm: true }); },
        vibrateShort: function () { calls.push(['vibrate']); },
        navigateTo: function (options) { calls.push(['navigate', options.url]); }
    };
}

function setup(savedDraft) {
    var calls = [];
    global.wx = testWx(calls);
    var localData = schema.createDefaultData();
    localData.quickCalcDrafts.sichuan = savedDraft || null;
    var app = {
        globalData: {
            localData: localData,
            settings: { soundEnabled: false, vibrationEnabled: false },
            storageError: null
        }
    };
    global.getApp = function () { return app; };
    var page = pageContext(pageDefinition());
    page.onLoad();
    return { page: page, app: app, calls: calls };
}

function addTiles(page, ids) {
    ids.forEach(function (tileId) {
        var tile = page.data.tileOptions.find(function (item) { return item.id === tileId; });
        page.addTile({ currentTarget: { dataset: { tile: tile } } });
    });
}

test('川麻快速算牌页面限制横向溢出且不提供吃牌', function () {
    var root = path.join(__dirname, '..', 'subpackages', 'sichuan', 'pages', 'calc');
    var wxml = fs.readFileSync(path.join(root, 'calc.wxml'), 'utf8');
    var wxss = fs.readFileSync(path.join(root, 'calc.wxss'), 'utf8');
    assert.match(wxss, /\.page-shell\s*\{[^}]*overflow-x:\s*hidden/s);
    assert.match(wxml, /川麻不可吃牌/);
    assert.doesNotMatch(wxml, /加入吃牌/);
});

test('川麻快速算牌根据完整牌面返回最高番并保存本机草稿', function () {
    var context = setup();
    var page = context.page;
    addTiles(page, [
        'm1', 'm2', 'm3', 'm3', 'm4', 'm5', 's2',
        's3', 's4', 's6', 's7', 's8', 'm5', 'm5'
    ]);
    var winTileIndex = page.data.tileOptions.findIndex(function (tile) { return tile.id === 'm5'; });
    page.onWinTileChange({ detail: { value: winTileIndex } });
    page.calculate();

    assert.equal(page.data.result.canWin, true);
    assert.equal(page.data.result.totalFan, 1);
    assert.equal(page.data.result.selectedCandidate.pattern, '平胡、门清');
    assert.equal(context.app.globalData.localData.quickCalcDrafts.sichuan.winTile, 'm5');
    assert.equal(context.app.globalData.localData.quickCalcDrafts.sichuan.concealedTiles.length, 14);
});

test('川麻快速算牌在13张结构时展示有效听牌和剩余张数', function () {
    var context = setup();
    var page = context.page;
    addTiles(page, [
        'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
        's1', 's2', 's3', 's7', 's8', 's9', 'm9'
    ]);

    assert.equal(page.data.structuralCount, 13);
    assert.equal(page.data.waits.length, 1);
    assert.equal(page.data.waits[0].tileId, 'm9');
    assert.equal(page.data.waits[0].remaining, 3);
});

test('川麻快速算牌恢复副露草稿并允许一键清空', function () {
    var saved = {
        concealedTiles: ['m1', 'm2'],
        melds: [{ type: 'pon', tiles: ['s3', 's3', 's3'] }],
        winTile: '',
        dingqueSuit: 'p',
        rules: { dingqueEnabled: true },
        context: {}
    };
    var context = setup(saved);
    var page = context.page;
    assert.deepEqual(page.data.concealedTiles, ['m1', 'm2']);
    assert.equal(page.data.melds[0].label, '碰 · 3条');
    assert.equal(page.data.structuralCount, 5);

    page.clearDraft();

    assert.deepEqual(page.data.concealedTiles, []);
    assert.deepEqual(page.data.melds, []);
    assert.equal(context.app.globalData.localData.quickCalcDrafts.sichuan.concealedTiles.length, 0);
});

test('川麻快速算牌可从最高番结果进入命中规则详情', function () {
    var context = setup();
    context.page.openRule({ currentTarget: { dataset: { id: 'qingdui' } } });
    assert.deepEqual(context.calls, [
        ['navigate', '/subpackages/sichuan/pages/rule-detail/rule-detail?id=qingdui']
    ]);
});
