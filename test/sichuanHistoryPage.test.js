'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var schema = require('../data/schema.js');

function loadPage() {
    var definition = null;
    global.Page = function (value) { definition = value; };
    delete require.cache[require.resolve('../subpackages/sichuan/pages/history/history.js')];
    require('../subpackages/sichuan/pages/history/history.js');
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

function completedMatch(id, variant, mode, names, updatedAt) {
    return {
        id: id,
        variant: variant,
        status: 'completed',
        mode: mode,
        updatedAt: updatedAt,
        completedAt: updatedAt,
        players: names.map(function (name, index) {
            return { id: id + '-p' + index, name: name };
        }),
        rounds: [{ id: id + '-r1' }],
        rankings: names.map(function (name, index) {
            return { playerId: id + '-p' + index, name: name, rank: index + 1, score: 30 - index * 20 };
        })
    };
}

test('川麻历史页仅列出已结束川麻并按更新时间倒序展示', function () {
    var data = schema.createDefaultData();
    data.completedMatches = [
        completedMatch('old', 'sichuan', 'normal', ['甲', '乙', '丙', '丁'], '2026-09-01T12:00:00.000Z'),
        completedMatch('riichi', 'riichi', 'normal', ['A', 'B', 'C', 'D'], '2026-09-03T12:00:00.000Z'),
        completedMatch('new', 'sichuan', 'bloodBattle', ['春', '夏', '秋', '冬'], '2026-09-02T12:00:00.000Z')
    ];
    data.activeMatches = [completedMatch('active', 'sichuan', 'normal', ['一', '二', '三', '四'], '2026-09-04T12:00:00.000Z')];
    global.getApp = function () { return { globalData: { localData: data } }; };
    global.wx = { navigateTo: function () {} };
    var page = pageContext(loadPage());

    page.onShow();

    assert.deepEqual(page.data.matches.map(function (match) { return match.id; }), ['new', 'old']);
    assert.equal(page.data.matches[0].modeLabel, '血战到底');
    assert.equal(page.data.matches[0].roundCount, 1);
});

test('川麻历史页可按玩家或玩法筛选并重新打开牌局详情', function () {
    var data = schema.createDefaultData();
    data.completedMatches = [
        completedMatch('normal', 'sichuan', 'normal', ['张三', '乙', '丙', '丁'], '2026-09-01T12:00:00.000Z'),
        completedMatch('river', 'sichuan', 'bloodRiver', ['春', '夏', '秋', '冬'], '2026-09-02T12:00:00.000Z')
    ];
    var calls = [];
    global.getApp = function () { return { globalData: { localData: data } }; };
    global.wx = { navigateTo: function (options) { calls.push(options.url); } };
    var page = pageContext(loadPage());
    page.onShow();

    page.onSearchInput({ detail: { value: '张三' } });
    assert.deepEqual(page.data.matches.map(function (match) { return match.id; }), ['normal']);
    page.onSearchInput({ detail: { value: '血流' } });
    assert.deepEqual(page.data.matches.map(function (match) { return match.id; }), ['river']);
    page.openMatch({ currentTarget: { dataset: { id: 'river' } } });
    assert.deepEqual(calls, ['/subpackages/sichuan/pages/match/match?id=river']);
});
