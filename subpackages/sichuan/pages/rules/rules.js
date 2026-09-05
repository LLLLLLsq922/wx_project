'use strict';

var rulesData = require('../../../../rules/sichuan/rulesData.js');

function fanOptions() {
    var seen = {};
    rulesData.RULES.forEach(function (rule) { seen[rule.fan] = true; });
    return [{ value: 'all', label: '全部' }].concat(Object.keys(seen).map(Number)
        .sort(function (a, b) { return a - b; }).map(function (fan) {
            return { value: String(fan), label: fan + '番' };
        }));
}

Page({
    data: {
        searchText: '',
        selectedFan: 'all',
        fanOptions: [],
        rules: []
    },

    onLoad: function () {
        this.setData({ fanOptions: fanOptions() });
        this.refreshRules();
    },

    onSearchInput: function (event) {
        this.setData({ searchText: event.detail.value });
        this.refreshRules();
    },

    clearSearch: function () {
        this.setData({ searchText: '' });
        this.refreshRules();
    },

    selectFan: function (event) {
        this.setData({ selectedFan: String(event.currentTarget.dataset.fan) });
        this.refreshRules();
    },

    refreshRules: function () {
        var keyword = String(this.data.searchText || '').trim();
        var selectedFan = this.data.selectedFan;
        var filtered = rulesData.RULES.filter(function (rule) {
            var matchesFan = selectedFan === 'all' || rule.fan === Number(selectedFan);
            var matchesText = !keyword || [rule.name, rule.description, rule.formation]
                .some(function (text) { return text.indexOf(keyword) !== -1; });
            return matchesFan && matchesText;
        });
        this.setData({ rules: filtered });
    },

    openDetail: function (event) {
        wx.navigateTo({
            url: '/subpackages/sichuan/pages/rule-detail/rule-detail?id=' +
                encodeURIComponent(event.currentTarget.dataset.id)
        });
    }
});
