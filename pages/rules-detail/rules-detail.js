// pages/rules-detail/rules-detail.js
var rulesData = require('../../util/rulesData.js');

Page({
    data: {
        rule: null,
        exampleTiles: []
    },

    onLoad: function (options) {
        console.log('[rules-detail] onLoad 收到 options =', JSON.stringify(options));

        var rawName = options.name || '';
        var name = rawName ? decodeURIComponent(rawName) : '';
        console.log('[rules-detail] onLoad rawName =', JSON.stringify(rawName), ', decoded name =', JSON.stringify(name));

        var rule = rulesData.getRuleByName(name);
        if (!rule) {
            console.error('[rules-detail] onLoad 未找到牌型, name =', JSON.stringify(name), ', RULES 共', rulesData.RULES.length, '条');
            wx.showToast({ title: '未找到该牌型', icon: 'none' });
            return;
        }

        var example = rule.example || [];
        console.log('[rules-detail] onLoad 找到牌型:', rule.name, ', fan =', rule.fan, ', example 长度 =', example.length);

        // 构造示例牌图数据：每张牌对应一个图片路径
        var tiles = [];
        for (var i = 0; i < example.length; i++) {
            tiles.push({
                name: example[i],
                image: '/images/cards/' + example[i] + '.png'
            });
        }

        this.setData({
            rule: rule,
            exampleTiles: tiles
        });

        console.log('[rules-detail] onLoad setData 完成, exampleTiles =', tiles.length, '张');

        wx.setNavigationBarTitle({ title: rule.name });
    }
});
