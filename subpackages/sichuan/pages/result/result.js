'use strict';

var matchService = require('../../../../services/matchService.js');
var presenter = require('../../../../services/sichuanResultPresenter.js');

Page({
    data: {
        matchId: '',
        roundIndex: 0,
        match: null,
        round: null,
        roundNumber: 0,
        scoreRows: [],
        eventRows: [],
        transactionRows: [],
        winnerHands: [],
        dealerName: '',
        nextDealerName: ''
    },

    onLoad: function (options) {
        this.setData({
            matchId: decodeURIComponent(options.id || ''),
            roundIndex: Number(options.round || 0)
        });
    },

    onShow: function () {
        var app = getApp();
        var found = matchService.findMatch(app.globalData.localData, this.data.matchId);
        if (!found || !found.match.rounds[this.data.roundIndex]) {
            wx.showToast({ title: '单局记录不存在', icon: 'none' });
            return;
        }
        var match = found.match;
        var round = match.rounds[this.data.roundIndex];
        var detail = presenter.buildRoundDetail(match, round);
        var dealer = match.players.find(function (player) { return player.id === round.dealerId; });
        var nextDealer = match.players.find(function (player) { return player.id === round.nextDealerId; });
        this.setData({
            match: match,
            round: round,
            roundNumber: this.data.roundIndex + 1,
            scoreRows: detail.scoreRows,
            eventRows: detail.eventRows,
            transactionRows: detail.transactionRows,
            winnerHands: detail.winnerHands,
            dealerName: dealer ? dealer.name : round.dealerId,
            nextDealerName: nextDealer ? nextDealer.name : round.nextDealerId
        });
    }
});
