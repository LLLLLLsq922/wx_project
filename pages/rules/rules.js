// pages/rules/rules.js
var rulesData = require('../../util/rulesData.js');

Page({
    data: {
        // 搜索文本
        searchText: '',
        // 当前选中的番数筛选（0 表示全部）
        selectedFan: 0,
        // 番数等级选项
        fanOptions: [],
        // 分组列表（每组含 fan、rules、expanded）
        groups: [],
        // 搜索结果（搜索时使用，替代分组列表）
        searchResults: []
    },

    onLoad: function () {
        this.initFanOptions();
        this.refreshGroups();
    },

    onShow: function () {
        // 页面显示时的逻辑
    },

    // 初始化番数筛选选项
    initFanOptions: function () {
        var tiers = rulesData.FAN_TIERS;
        var options = [{ fan: 0, label: '全部' }];
        for (var i = 0; i < tiers.length; i++) {
            options.push({ fan: tiers[i], label: tiers[i] + '番' });
        }
        this.setData({ fanOptions: options });
    },

    // 刷新分组列表（根据筛选条件）
    refreshGroups: function () {
        var allRules = rulesData.RULES;
        var selectedFan = this.data.selectedFan;
        var tiers = rulesData.FAN_TIERS;
        var groups = [];

        for (var i = 0; i < tiers.length; i++) {
            var fan = tiers[i];
            // 筛选指定番数等级（0 为全部）
            if (selectedFan !== 0 && fan !== selectedFan) continue;

            var rules = [];
            for (var j = 0; j < allRules.length; j++) {
                if (allRules[j].fan === fan) {
                    rules.push({
                        name: allRules[j].name,
                        fan: allRules[j].fan,
                        description: allRules[j].description
                    });
                }
            }

            if (rules.length > 0) {
                groups.push({
                    fan: fan,
                    rules: rules,
                    expanded: false
                });
            }
        }

        this.setData({ groups: groups });
    },

    // 搜索输入
    onSearchInput: function (e) {
        var searchText = e.detail.value;
        this.setData({ searchText: searchText });
        this.refreshSearchResults();
    },

    // 清空搜索
    clearSearch: function () {
        this.setData({ searchText: '' });
        this.refreshSearchResults();
    },

    // 刷新搜索结果
    refreshSearchResults: function () {
        var searchText = this.data.searchText.trim();
        if (!searchText) {
            this.setData({ searchResults: [] });
            return;
        }

        var allRules = rulesData.RULES;
        var results = [];
        for (var i = 0; i < allRules.length; i++) {
            var rule = allRules[i];
            if ((rule.name && rule.name.indexOf(searchText) !== -1) ||
                (rule.description && rule.description.indexOf(searchText) !== -1) ||
                (rule.composition && rule.composition.indexOf(searchText) !== -1)) {
                results.push({
                    name: rule.name,
                    fan: rule.fan,
                    description: rule.description
                });
            }
        }
        this.setData({ searchResults: results });
    },

    // 选择番数筛选
    onFanSelect: function (e) {
        var fan = parseInt(e.currentTarget.dataset.fan, 10);
        this.setData({ selectedFan: fan });
        this.refreshGroups();
    },

    // 切换分组展开/折叠
    toggleGroup: function (e) {
        var index = e.currentTarget.dataset.index;
        var groups = this.data.groups;
        groups[index].expanded = !groups[index].expanded;
        this.setData({ groups: groups });
    },

    // 跳转详情页
    goToDetail: function (e) {
        var name = e.currentTarget.dataset.name;
        var url = '/pages/rules-detail/rules-detail?name=' + name;

        console.log('[rules] goToDetail 开始, dataset.name =', JSON.stringify(name), ', type =', typeof name);
        console.log('[rules] goToDetail 跳转 URL =', url);

        wx.navigateTo({
            url: url,
            success: function () {
                console.log('[rules] goToDetail 跳转成功');
            },
            fail: function (err) {
                console.error('[rules] goToDetail 跳转失败:', err);
                wx.showToast({ title: '页面跳转失败', icon: 'none' });
            }
        });
    }
});
