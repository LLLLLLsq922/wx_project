'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

console.log = function () {};

var pageDefinition = null;
global.Page = function (definition) {
    pageDefinition = definition;
};

require('../pages/index/index.js');

function invokeGoToRules(data) {
    var calls = [];
    global.wx = {
        navigateTo: function (options) {
            calls.push({ method: 'navigateTo', url: options.url });
        },
        switchTab: function (options) {
            calls.push({ method: 'switchTab', url: options.url });
        }
    };

    pageDefinition.goToRules.call({ data: data });
    return calls;
}

test('未选择完整胡牌时保留原逻辑，进入牌型规则列表', function () {
    var calls = invokeGoToRules({
        winTileState: 'waiting',
        result: { canHu: false, fanList: [] }
    });

    assert.deepEqual(calls, [
        { method: 'switchTab', url: '/pages/rules/rules' }
    ]);
});

test('完整合法胡牌直接进入番数最高的牌型详情', function () {
    var calls = invokeGoToRules({
        winTileState: 'winning',
        result: {
            canHu: true,
            fanList: [
                { name: '一般高', fan: 1 },
                { name: '清一色', fan: 24 },
                { name: '清龙', fan: 16 }
            ]
        }
    });

    assert.deepEqual(calls, [{
        method: 'navigateTo',
        url: '/pages/rules-detail/rules-detail?name=' + encodeURIComponent('清一色')
    }]);
});

test('牌型完整但不足8番时仍进入规则列表', function () {
    var calls = invokeGoToRules({
        winTileState: 'winning',
        result: {
            canHu: false,
            isHuShape: true,
            reason: 'LESS_THAN_8_FAN',
            fanList: [{ name: '门前清', fan: 2 }]
        }
    });

    assert.deepEqual(calls, [
        { method: 'switchTab', url: '/pages/rules/rules' }
    ]);
});

test('成功选牌时请求轻微振动反馈，不支持振动时静默降级', function () {
    var vibrationType = null;
    global.wx = {
        vibrateShort: function (options) {
            vibrationType = options.type;
        }
    };

    pageDefinition.triggerSelectionFeedback();
    assert.equal(vibrationType, 'light');

    global.wx = {};
    assert.doesNotThrow(function () {
        pageDefinition.triggerSelectionFeedback();
    });
});
