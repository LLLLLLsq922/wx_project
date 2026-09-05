'use strict';

var matchState = require('../../../../rules/sichuan/matchState.js');
var matchService = require('../../../../services/matchService.js');

function modeLabel(mode) {
    return mode === 'bloodBattle' ? '血战到底' : (mode === 'bloodRiver' ? '血流成河' : '普通川麻');
}

Page({
    data: {
        matchId: '',
        match: null,
        scoreRows: [],
        nextDealerName: '',
        modeLabel: '',
        hasCurrentRound: false
    },

    onLoad: function (options) {
        this.setData({ matchId: decodeURIComponent(options.id || '') });
    },

    onShow: function () {
        this.refreshMatch();
    },

    refreshMatch: function () {
        var app = getApp();
        var found = matchService.findMatch(app.globalData.localData, this.data.matchId);
        if (!found) {
            wx.showToast({ title: '牌局不存在或已被删除', icon: 'none' });
            return;
        }
        var match = found.match;
        var scoreRows = match.players.map(function (player) {
            return {
                id: player.id,
                name: player.name,
                score: match.scoreTotals[player.id],
                isDealer: player.id === match.nextDealerId
            };
        });
        var dealer = match.players.find(function (player) { return player.id === match.nextDealerId; });
        this.setData({
            match: match,
            scoreRows: scoreRows,
            nextDealerName: dealer ? dealer.name : '整场已结束',
            modeLabel: modeLabel(match.mode),
            hasCurrentRound: !!match.currentRound
        });
    },

    startNextRound: function () {
        var app = getApp();
        var found = matchService.findMatch(app.globalData.localData, this.data.matchId);
        if (!found || found.collection !== 'activeMatches') {
            wx.showToast({ title: '该牌局已经结束', icon: 'none' });
            return;
        }
        try {
            var match = found.match;
            var draft = match.currentRound || matchState.createNextRound(match);
            app.globalData.localData = matchService.saveRoundDraft(
                wx, app.globalData.localData, match.id, draft
            );
            wx.navigateTo({
                url: '/subpackages/sichuan/pages/round/round?id=' + encodeURIComponent(match.id)
            });
        } catch (error) {
            wx.showToast({ title: error.message || '无法开始下一局', icon: 'none' });
        }
    }
});
