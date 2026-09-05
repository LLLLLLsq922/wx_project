'use strict';

var matchService = require('../../../../services/matchService.js');

function modeLabel(mode) {
    return mode === 'bloodBattle' ? '血战到底' : mode === 'bloodRiver' ? '血流成河' : '普通川麻';
}

function dateLabel(value) {
    if (!value) return '';
    return String(value).replace('T', ' ').slice(0, 16);
}

Page({
    data: { searchText: '', allMatches: [], matches: [] },

    onShow: function () {
        var app = getApp();
        var matches = matchService.listMatches(app.globalData.localData, 'sichuan', 'completed')
            .map(function (match) {
                return {
                    id: match.id,
                    modeLabel: modeLabel(match.mode),
                    playerNames: match.players.map(function (player) { return player.name; }).join(' · '),
                    roundCount: match.rounds.length,
                    completedAt: dateLabel(match.completedAt || match.updatedAt),
                    rankings: (match.rankings || []).map(function (ranking) {
                        return {
                            playerId: ranking.playerId,
                            name: ranking.name,
                            rank: ranking.rank,
                            score: ranking.score
                        };
                    })
                };
            });
        this.setData({ allMatches: matches });
        this.filterMatches();
    },

    onSearchInput: function (event) {
        this.setData({ searchText: event.detail.value });
        this.filterMatches();
    },

    clearSearch: function () {
        this.setData({ searchText: '' });
        this.filterMatches();
    },

    filterMatches: function () {
        var keyword = String(this.data.searchText || '').trim();
        this.setData({
            matches: this.data.allMatches.filter(function (match) {
                return !keyword || match.playerNames.indexOf(keyword) !== -1 ||
                    match.modeLabel.indexOf(keyword) !== -1;
            })
        });
    },

    openMatch: function (event) {
        wx.navigateTo({
            url: '/subpackages/sichuan/pages/match/match?id=' +
                encodeURIComponent(event.currentTarget.dataset.id)
        });
    }
});
