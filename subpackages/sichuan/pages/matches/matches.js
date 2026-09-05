'use strict';

var matchService = require('../../../../services/matchService.js');

function modeLabel(mode) {
    return mode === 'bloodBattle' ? '血战到底' : (mode === 'bloodRiver' ? '血流成河' : '普通川麻');
}

function formatLabel(format) {
    if (format.type === 'fixedRounds' || format.type === 'customRounds') return format.roundCount + '局';
    return format.type === 'eachDealerOnce' ? '每人坐庄一次' : '不限局数';
}

Page({
    data: { matches: [] },

    onShow: function () {
        var app = getApp();
        var matches = matchService.listMatches(app.globalData.localData, 'sichuan', 'active').map(function (match) {
            return {
                id: match.id,
                modeLabel: modeLabel(match.mode),
                formatLabel: formatLabel(match.format),
                roundCount: (match.rounds || []).length,
                playerNames: (match.players || []).map(function (player) { return player.name; }).join(' · '),
                hasDraft: !!match.currentRound
            };
        });
        this.setData({ matches: matches });
    },

    openMatch: function (event) {
        wx.navigateTo({
            url: '/subpackages/sichuan/pages/match/match?id=' + encodeURIComponent(event.currentTarget.dataset.id)
        });
    },

    createMatch: function () {
        wx.navigateTo({ url: '/subpackages/sichuan/pages/create/create' });
    }
});
