'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var pageDefinition = null;
global.Page = function (definition) {
    pageDefinition = definition;
};

require('../pages/index/index.js');

test('首页提供五个产品入口并且不产生横向滚动', function () {
    var root = path.join(__dirname, '..');
    var wxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8');
    var wxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8');

    ['快速算牌', '创建牌局', '继续牌局', '历史记录', '规则百科'].forEach(function (name) {
        assert.equal(wxml.includes(name), true);
    });
    assert.match(wxss, /\.home-page\s*\{[^}]*overflow-x:\s*hidden/s);
});

test('国标快速算牌进入国标分包，其他玩法显示阶段提示', function () {
    var calls = [];
    global.wx = {
        navigateTo: function (options) { calls.push(['navigateTo', options.url]); },
        showToast: function (options) { calls.push(['showToast', options.title]); }
    };

    pageDefinition.openQuickCalc.call({
        data: { selectedVariant: 'guobiao', selectedVariantName: '国标麻将' },
        showPending: pageDefinition.showPending
    });
    assert.deepEqual(calls, [['navigateTo', '/subpackages/guobiao/pages/calc/calc']]);

    calls.length = 0;
    pageDefinition.openQuickCalc.call({
        data: { selectedVariant: 'sichuan', selectedVariantName: '成都川麻' },
        showPending: pageDefinition.showPending
    });
    assert.deepEqual(calls, [['showToast', '成都川麻快速算牌将在后续阶段开放']]);
});

test('app配置将首页留在主包并把国标计算页放入分包', function () {
    var appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
    var guobiao = appConfig.subpackages.find(function (subpackage) {
        return subpackage.name === 'guobiao';
    });

    assert.equal(appConfig.pages[0], 'pages/index/index');
    assert.equal(appConfig.tabBar.list[0].text, '首页');
    assert.deepEqual(guobiao.pages, ['pages/calc/calc']);
});
