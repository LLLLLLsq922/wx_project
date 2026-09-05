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
        hasCurrentRound: false,
        canManualEnd: false
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
            hasCurrentRound: !!match.currentRound,
            canManualEnd: match.status === 'active' && match.format.type === 'unlimited' &&
                !match.currentRound
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
    },

    openRoundDetail: function (event) {
        wx.navigateTo({
            url: '/subpackages/sichuan/pages/result/result?id=' +
                encodeURIComponent(this.data.matchId) + '&round=' +
                Number(event.currentTarget.dataset.index)
        });
    },

    endUnlimitedMatchNow: function () {
        var app = getApp();
        var found = matchService.findMatch(app.globalData.localData, this.data.matchId);
        try {
            if (!found || found.collection !== 'activeMatches') throw new Error('进行中牌局不存在');
            if (found.match.currentRound) throw new Error('请先完成或处理当前局草稿');
            var completed = matchState.endUnlimitedMatch(found.match);
            app.globalData.localData = matchService.persistMatch(
                wx, app.globalData.localData, completed
            );
            this.refreshMatch();
            wx.showToast({ title: '整场牌局已结束', icon: 'success' });
        } catch (error) {
            wx.showToast({ title: error.message || '无法结束整场', icon: 'none' });
        }
    },

    endUnlimitedMatch: function () {
        var self = this;
        wx.showModal({
            title: '结束整场牌局',
            content: '结束后将移入本机历史记录，当前累计分将作为最终结果。',
            success: function (result) { if (result.confirm) self.endUnlimitedMatchNow(); }
        });
    }
});
