'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var schema = require('../data/schema.js');
var matchService = require('../services/matchService.js');

function memoryStorage() {
    var values = {};
    return {
        values: values,
        getStorageSync: function (key) { return values[key]; },
        setStorageSync: function (key, value) { values[key] = value; },
        removeStorageSync: function (key) { delete values[key]; }
    };
}

test('牌局服务新增、更新时不修改原始本地数据且不产生重复记录', function () {
    var data = schema.createDefaultData();
    var first = { id: 'm1', variant: 'sichuan', status: 'active', updatedAt: '1' };
    var inserted = matchService.upsertMatch(data, first);
    assert.equal(data.activeMatches.length, 0);
    assert.equal(inserted.activeMatches.length, 1);

    var updated = matchService.upsertMatch(inserted, {
        id: 'm1', variant: 'sichuan', status: 'active', updatedAt: '2', rounds: [{}]
    });
    assert.equal(updated.activeMatches.length, 1);
    assert.equal(updated.activeMatches[0].rounds.length, 1);
});

test('已结束牌局从进行中集合迁移到历史集合', function () {
    var data = matchService.upsertMatch(schema.createDefaultData(), {
        id: 'm1', variant: 'sichuan', status: 'active'
    });
    var completed = matchService.upsertMatch(data, {
        id: 'm1', variant: 'sichuan', status: 'completed'
    });
    assert.equal(completed.activeMatches.length, 0);
    assert.equal(completed.completedMatches.length, 1);
    assert.equal(matchService.findMatch(completed, 'm1').collection, 'completedMatches');
});

test('牌局列表按玩法筛选并按更新时间倒序排列', function () {
    var data = schema.createDefaultData();
    data.activeMatches = [
        { id: 'old', variant: 'sichuan', updatedAt: '2026-01-01' },
        { id: 'other', variant: 'riichi', updatedAt: '2026-03-01' },
        { id: 'new', variant: 'sichuan', updatedAt: '2026-02-01' }
    ];
    assert.deepEqual(matchService.listMatches(data, 'sichuan', 'active').map(function (match) {
        return match.id;
    }), ['new', 'old']);
});

test('保存牌局与当前局草稿会写入受保护本地存储', function () {
    var adapter = memoryStorage();
    var data = schema.createDefaultData();
    data = matchService.persistMatch(adapter, data, {
        id: 'm1', variant: 'sichuan', status: 'active'
    });
    data = matchService.saveRoundDraft(adapter, data, 'm1', {
        id: 'r1', phase: 'exchange'
    });
    assert.equal(matchService.findMatch(data, 'm1').match.currentRound.id, 'r1');
    assert.ok(Object.keys(adapter.values).length > 0);
});
