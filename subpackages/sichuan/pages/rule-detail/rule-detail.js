'use strict';

var rulesData = require('../../../../rules/sichuan/rulesData.js');

Page({
    data: { rule: null, exampleTiles: [] },

    onLoad: function (options) {
        var rule = rulesData.getRuleById(decodeURIComponent(options.id || ''));
        if (!rule) {
            wx.showToast({ title: '未找到该川麻规则', icon: 'none' });
            return;
        }
        this.setData({
            rule: rule,
            exampleTiles: (rule.example || []).map(function (name) {
                return { name: name, image: '/images/cards/' + name + '.png' };
            })
        });
        if (wx.setNavigationBarTitle) wx.setNavigationBarTitle({ title: rule.name });
    }
});
