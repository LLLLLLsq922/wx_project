'use strict';

var matchService = require('../../../../services/matchService.js');

function phaseLabel(phase) {
    if (phase === 'exchange') return '换三张';
    if (phase === 'dingque') return '定缺';
    if (phase === 'play') return '行牌与结果录入';
    return '本局已结束';
}

Page({
    data: {
        matchId: '',
        match: null,
        round: null,
        dealerName: '',
        phaseLabel: ''
    },

    onLoad: function (options) {
        this.setData({ matchId: decodeURIComponent(options.id || '') });
    },

    onShow: function () {
        var found = matchService.findMatch(getApp().globalData.localData, this.data.matchId);
        if (!found || !found.match.currentRound) {
            wx.showToast({ title: '当前局草稿不存在', icon: 'none' });
            return;
        }
        var match = found.match;
        var round = match.currentRound;
        var dealer = match.players.find(function (player) { return player.id === round.dealerId; });
        this.setData({
            match: match,
            round: round,
            dealerName: dealer ? dealer.name : round.dealerId,
            phaseLabel: phaseLabel(round.phase)
        });
    },

    backToMatch: function () {
        wx.navigateBack();
    }
});
