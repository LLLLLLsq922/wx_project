'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('规则页不再使用横向滚动筛选器', function () {
    var wxml = read('pages/rules/rules.wxml');
    var wxss = read('pages/rules/rules.wxss');

    assert.equal(wxml.includes('scroll-x'), false);
    assert.match(wxss, /\.fan-filter\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(wxss, /\.rules-container\s*\{[^}]*overflow-x:\s*hidden/s);
});

test('首页将胡牌信息排列在特殊规则和风位设置之前', function () {
    var wxml = read('subpackages/guobiao/pages/calc/calc.wxml');
    var huInfoIndex = wxml.indexOf('>胡牌信息<');
    var specialRulesIndex = wxml.indexOf('>特殊规则<');
    var windIndex = wxml.indexOf('>圈风<');

    assert.ok(huInfoIndex >= 0);
    assert.ok(specialRulesIndex > huInfoIndex);
    assert.ok(windIndex > huInfoIndex);
});

test('四组牌库按钮均启用按压动画反馈', function () {
    var wxml = read('subpackages/guobiao/pages/calc/calc.wxml');
    var matches = wxml.match(/hover-class="tile-button-pressed"/g) || [];

    assert.equal(matches.length, 4);
});

test('吃碰杠牌组嵌入当前手牌，并使用类型角标区分', function () {
    var wxml = read('subpackages/guobiao/pages/calc/calc.wxml');
    var currentHandIndex = wxml.indexOf('>当前手牌（');
    var meldIndex = wxml.indexOf('class="meld-group');
    var huInfoIndex = wxml.indexOf('>胡牌信息<');

    assert.ok(currentHandIndex >= 0);
    assert.ok(meldIndex > currentHandIndex);
    assert.ok(meldIndex < huInfoIndex);
    assert.equal(wxml.includes('>已操作牌组<'), false);
    assert.match(wxml, /class="meld-badge">\{\{group\.type\}\}/);
});

test('当前手牌上限随杠牌组数增加，并显示补牌数量提示', function () {
    var wxml = read('subpackages/guobiao/pages/calc/calc.wxml');

    assert.match(wxml, /function gangCount\(actionGroups\)/);
    assert.match(wxml, /return 14 \+ gangCount\(actionGroups\)/);
    assert.match(wxml, /tiles\.targetTiles\(actionGroups\)/);
    assert.match(wxml, /总数\+\{\{tiles\.gangCount\(actionGroups\)\}\}张/);
});

test('手机端牌图使用放大后的紧凑尺寸', function () {
    var wxss = read('subpackages/guobiao/pages/calc/calc.wxss');

    assert.match(wxss, /\.card-btn\s*\{[^}]*max-width:\s*62rpx[^}]*height:\s*93rpx/s);
    assert.match(wxss, /\.card-item\s*\{[^}]*flex:\s*0 0 50rpx/s);
    assert.match(wxss, /\.meld-tile\s*\{[^}]*width:\s*46rpx[^}]*height:\s*69rpx/s);
    assert.match(wxss, /\.card-buttons\s*\{[^}]*justify-content:\s*center[^}]*gap:\s*2rpx/s);
    assert.match(wxss, /\.card-btn-container\s*\{[^}]*flex:\s*0 0 62rpx/s);
    assert.match(wxss, /\.hand-card\s*\{[^}]*padding-left:\s*8rpx[^}]*padding-right:\s*8rpx/s);
});
