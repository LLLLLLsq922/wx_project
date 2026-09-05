'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var tiles = require('../core/tiles.js');
var sichuanEngine = require('../rules/sichuan/engine.js');
var rulesData = require('../rules/sichuan/rulesData.js');

function loadPage(relativePath) {
    var definition = null;
    global.Page = function (value) { definition = value; };
    delete require.cache[require.resolve(relativePath)];
    require(relativePath);
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

test('川麻规则百科与引擎目录逐项一致且不存在不可成立的清将对', function () {
    var catalog = sichuanEngine.getRuleCatalog();
    assert.deepEqual(
        rulesData.RULES.map(function (rule) { return [rule.id, rule.name, rule.fan]; }),
        catalog.map(function (rule) { return [rule.id, rule.name, rule.fan]; })
    );
    assert.equal(new Set(rulesData.RULES.map(function (rule) { return rule.id; })).size,
        rulesData.RULES.length);
    assert.equal(rulesData.getRuleById('qingjiangdui'), null);
    assert.ok(rulesData.getRuleById('qingdui'));
    assert.ok(rulesData.getRuleById('jiangdui'));
});

test('川麻规则百科每项都有完整说明且所有牌面示例合法', function () {
    rulesData.RULES.forEach(function (rule) {
        ['id', 'name', 'description', 'formation', 'notMet'].forEach(function (field) {
            assert.equal(typeof rule[field], 'string', rule.id + ' 缺少 ' + field);
            assert.notEqual(rule[field].trim(), '', rule.id + ' 的 ' + field + ' 为空');
        });
        assert.equal(Number.isInteger(rule.fan) && rule.fan >= 0, true, rule.id + ' 番数无效');
        assert.equal(Array.isArray(rule.exclusions), true, rule.id + ' 不计关系无效');
        assert.equal(Array.isArray(rule.example), true, rule.id + ' 示例无效');
        var validation = tiles.validateCopies({ concealedTiles: rule.example });
        assert.equal(validation.valid, true, rule.id + ' 示例包含非法牌或第五张同牌');
    });
});

test('川麻规则页支持关键字和番数组合筛选并跳转详情', function () {
    var calls = [];
    global.wx = {
        navigateTo: function (options) { calls.push(options.url); }
    };
    var page = pageContext(loadPage('../subpackages/sichuan/pages/rules/rules.js'));
    page.onLoad();
    assert.equal(page.data.rules.length, rulesData.RULES.length);

    page.onSearchInput({ detail: { value: '七对' } });
    assert.deepEqual(page.data.rules.map(function (rule) { return rule.id; }),
        ['qidui', 'longqidui', 'qingqidui', 'qinglongqidui']);
    page.selectFan({ currentTarget: { dataset: { fan: '5' } } });
    assert.deepEqual(page.data.rules.map(function (rule) { return rule.id; }), ['qinglongqidui']);

    page.openDetail({ currentTarget: { dataset: { id: 'qinglongqidui' } } });
    assert.deepEqual(calls, [
        '/subpackages/sichuan/pages/rule-detail/rule-detail?id=qinglongqidui'
    ]);
});

test('川麻规则详情展示对应规则并设置标题', function () {
    var calls = [];
    global.wx = {
        setNavigationBarTitle: function (options) { calls.push(options.title); },
        showToast: function () {}
    };
    var page = pageContext(loadPage('../subpackages/sichuan/pages/rule-detail/rule-detail.js'));
    page.onLoad({ id: 'qingdui' });
    assert.equal(page.data.rule.name, '清对');
    assert.equal(page.data.exampleTiles.length, 14);
    assert.deepEqual(calls, ['清对']);
});
