'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var root = path.join(__dirname, '..');

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('组件按需注入保持开启，且未声明插件', function () {
    var appConfig = readJson('app.json');

    assert.equal(appConfig.lazyCodeLoading, 'requiredComponents');
    assert.equal(appConfig.plugins, undefined);
});

test('开发文件被排除出上传包，动态牌图被明确包含', function () {
    var projectConfig = readJson('project.config.json');
    var ignored = projectConfig.packOptions.ignore.map(function (item) {
        return item.value;
    });
    var included = projectConfig.packOptions.include.map(function (item) {
        return item.value;
    });

    ['test', '.github', 'docs', 'package.json', '.eslintrc.js', 'audio/ATTRIBUTION.md']
        .forEach(function (item) { assert.ok(ignored.includes(item)); });
    assert.ok(included.includes('images/cards'));
});

test('图片和音频资源均不超过200KB', function () {
    ['images', 'audio'].forEach(function (directory) {
        var directoryPath = path.join(root, directory);
        fs.readdirSync(directoryPath, { recursive: true, withFileTypes: true })
            .filter(function (entry) { return entry.isFile(); })
            .forEach(function (entry) {
                var filePath = path.join(entry.parentPath || entry.path, entry.name);
                var extension = path.extname(entry.name).toLowerCase();
                if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.aac', '.wav'].includes(extension)) {
                    assert.ok(fs.statSync(filePath).size <= 200 * 1024,
                        entry.name + ' 超过200KB');
                }
            });
    });
});

test('已移除的花牌、牌背和未使用导航栏组件不会回到代码包', function () {
    ['梅.png', '兰.png', '竹.png', '菊.png', '春.png', '夏.png', '秋.png', '冬.png', '牌背.png']
        .forEach(function (name) {
            assert.equal(fs.existsSync(path.join(root, 'images', 'cards', name)), false);
        });
    assert.equal(fs.existsSync(path.join(root, 'components', 'navigation-bar')), false);
});
