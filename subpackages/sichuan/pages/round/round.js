'use strict';

var tiles = require('../../../../core/tiles.js');
var roundState = require('../../../../rules/sichuan/roundState.js');
var matchService = require('../../../../services/matchService.js');

function phaseLabel(phase) {
    if (phase === 'exchange') return '换三张';
    if (phase === 'dingque') return '定缺';
    if (phase === 'play') return '行牌与结果录入';
    return '本局已结束';
}

function createTileGroups() {
    var groupNames = { m: '万', s: '条', p: '筒' };
    var groups = { m: [], s: [], p: [] };
    tiles.getCatalog('sichuan').forEach(function (tile) {
        var name = tiles.chineseNameFromId(tile.id);
        groups[tile.suit].push({
            id: tile.id,
            name: name,
            suit: tile.suit,
            image: '/images/cards/' + name + '.png'
        });
    });
    return ['m', 's', 'p'].map(function (suit) {
        return { suit: suit, name: groupNames[suit], tiles: groups[suit] };
    });
}

function emptySelections(players) {
    var result = {};
    players.forEach(function (player) { result[player.id] = []; });
    return result;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function playersInRound(match, round) {
    return match.players.filter(function (player) {
        return round.activePlayerIds.indexOf(player.id) !== -1;
    });
}

function scoreRows(match, round) {
    return match.players.map(function (player) {
        return {
            id: player.id,
            name: player.name,
            score: round.scoreChanges[player.id] || 0
        };
    });
}

Page({
    data: {
        matchId: '',
        match: null,
        round: null,
        dealerName: '',
        phaseLabel: '',
        tileGroups: [],
        exchangeSelections: {},
        currentExchangePlayerIndex: 0,
        dingqueSuits: {},
        activePlayers: [],
        roundScoreRows: [],
        showKongForm: false,
        kongTypeIndex: 0,
        kongTypeOptions: [
            { value: 'directKong', label: '直杠（点杠者付2底）' },
            { value: 'addedKong', label: '补杠（其他玩家各付1底）' },
            { value: 'concealedKong', label: '暗杠（其他玩家各付2底）' }
        ],
        kongActorIndex: 0,
        kongSourceIndex: 1,
        kongRobbed: false,
        suitOptions: [
            { id: 'm', name: '万' },
            { id: 's', name: '条' },
            { id: 'p', name: '筒' }
        ]
    },

    onLoad: function (options) {
        this.setData({
            matchId: decodeURIComponent(options.id || ''),
            tileGroups: createTileGroups()
        });
        this.initTileAudio();
    },

    onShow: function () {
        this.loadRound();
    },

    onUnload: function () {
        if (this.tileAudio) {
            this.tileAudio.destroy();
            this.tileAudio = null;
        }
    },

    initTileAudio: function () {
        if (this.tileAudio || typeof wx === 'undefined' || !wx.createInnerAudioContext) return;
        var audio = wx.createInnerAudioContext();
        audio.src = '/audio/mahjong-tile-click.mp3';
        audio.volume = 0.5;
        audio.obeyMuteSwitch = true;
        this.tileAudio = audio;
    },

    triggerFeedback: function () {
        var app = typeof getApp === 'function' ? getApp() : null;
        var settings = app && app.globalData ? app.globalData.settings : null;
        if (!settings || settings.vibrationEnabled !== false) {
            try {
                if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
            } catch (ignoreVibration) { /* 部分设备不支持 */ }
        }
        if (settings && settings.soundEnabled === false) return;
        if (!this.tileAudio) this.initTileAudio();
        if (!this.tileAudio) return;
        try { this.tileAudio.stop(); } catch (ignoreStop) { /* 静默 */ }
        try { this.tileAudio.seek(0); } catch (ignoreSeek) { /* 静默 */ }
        try { this.tileAudio.play(); } catch (ignorePlay) { /* 静默 */ }
    },

    loadRound: function () {
        var found = matchService.findMatch(getApp().globalData.localData, this.data.matchId);
        if (!found || !found.match.currentRound) {
            wx.showToast({ title: '当前局草稿不存在', icon: 'none' });
            return;
        }
        var match = found.match;
        var round = match.currentRound;
        var dealer = match.players.find(function (player) { return player.id === round.dealerId; });
        var draft = round.inputDraft || {};
        var selections = draft.exchangeSelections || emptySelections(match.players);
        var dingqueSuits = draft.dingqueSuits || {};
        var firstIncomplete = 0;
        for (var i = 0; i < match.players.length; i++) {
            if (!selections[match.players[i].id] || selections[match.players[i].id].length < 3) {
                firstIncomplete = i;
                break;
            }
        }
        this.setData({
            match: match,
            round: round,
            dealerName: dealer ? dealer.name : round.dealerId,
            phaseLabel: phaseLabel(round.phase),
            exchangeSelections: clone(selections),
            currentExchangePlayerIndex: firstIncomplete,
            dingqueSuits: clone(dingqueSuits),
            activePlayers: playersInRound(match, round),
            roundScoreRows: scoreRows(match, round)
        });
    },

    saveRound: function (round) {
        var app = getApp();
        app.globalData.localData = matchService.saveRoundDraft(
            wx, app.globalData.localData, this.data.matchId, round
        );
        var found = matchService.findMatch(app.globalData.localData, this.data.matchId);
        this.setData({
            match: found.match,
            round: found.match.currentRound,
            phaseLabel: phaseLabel(found.match.currentRound.phase),
            activePlayers: playersInRound(found.match, found.match.currentRound),
            roundScoreRows: scoreRows(found.match, found.match.currentRound)
        });
    },

    selectExchangePlayer: function (event) {
        this.setData({ currentExchangePlayerIndex: Number(event.currentTarget.dataset.index) });
    },

    countSelectedTile: function (tileId) {
        var count = 0;
        var selections = this.data.exchangeSelections;
        Object.keys(selections).forEach(function (playerId) {
            selections[playerId].forEach(function (selectedId) {
                if (selectedId === tileId) count++;
            });
        });
        return count;
    },

    selectExchangeTile: function (event) {
        var tile = event.currentTarget.dataset.tile;
        var player = this.data.match.players[this.data.currentExchangePlayerIndex];
        var selections = clone(this.data.exchangeSelections);
        var selected = selections[player.id] || [];
        if (selected.length >= 3) {
            wx.showToast({ title: '该玩家已经选满三张', icon: 'none' });
            return;
        }
        if (selected.length && selected[0].charAt(0) !== tile.suit) {
            wx.showToast({ title: '换出的三张牌必须同花色', icon: 'none' });
            return;
        }
        if (this.countSelectedTile(tile.id) >= 4) {
            wx.showToast({ title: '同一种牌最多四张', icon: 'none' });
            return;
        }
        selected.push(tile.id);
        selections[player.id] = selected;
        this.setData({ exchangeSelections: selections });
        this.triggerFeedback();
        this.persistInputDraft('exchangeSelections', selections);
    },

    removeExchangeTile: function (event) {
        var playerId = event.currentTarget.dataset.player;
        var index = Number(event.currentTarget.dataset.index);
        var selections = clone(this.data.exchangeSelections);
        if (!selections[playerId]) return;
        selections[playerId].splice(index, 1);
        this.setData({ exchangeSelections: selections });
        this.triggerFeedback();
        this.persistInputDraft('exchangeSelections', selections);
    },

    persistInputDraft: function (key, value) {
        var round = clone(this.data.round);
        round.inputDraft = round.inputDraft || {};
        round.inputDraft[key] = clone(value);
        try {
            this.saveRound(round);
        } catch (error) {
            wx.showToast({ title: error.message || '草稿保存失败', icon: 'none' });
        }
    },

    submitExchange: function () {
        try {
            var round = roundState.recordExchange(this.data.round, this.data.exchangeSelections);
            round.inputDraft = { dingqueSuits: {} };
            this.setData({ dingqueSuits: {} });
            this.saveRound(round);
            wx.showToast({ title: '换三张已记录', icon: 'success' });
        } catch (error) {
            wx.showToast({ title: error.message || '换三张信息不完整', icon: 'none' });
        }
    },

    selectDingque: function (event) {
        var playerId = event.currentTarget.dataset.player;
        var suit = event.currentTarget.dataset.suit;
        var selections = clone(this.data.dingqueSuits);
        selections[playerId] = suit;
        this.setData({ dingqueSuits: selections });
        this.triggerFeedback();
        this.persistInputDraft('dingqueSuits', selections);
    },

    submitDingque: function () {
        try {
            var round = roundState.recordDingque(this.data.round, this.data.dingqueSuits);
            delete round.inputDraft;
            this.saveRound(round);
            wx.showToast({ title: '定缺已记录', icon: 'success' });
        } catch (error) {
            wx.showToast({ title: error.message || '请完成四家定缺', icon: 'none' });
        }
    },

    openWinEntry: function () {
        wx.showToast({ title: '完整手牌和胡牌录入将在下一批接入', icon: 'none' });
    },

    openKongEntry: function () {
        this.setData({
            showKongForm: true,
            kongTypeIndex: 0,
            kongActorIndex: 0,
            kongSourceIndex: this.data.activePlayers.length > 1 ? 1 : 0,
            kongRobbed: false
        });
    },

    closeKongEntry: function () {
        this.setData({ showKongForm: false });
    },

    onKongTypeChange: function (event) {
        this.setData({ kongTypeIndex: Number(event.detail.value), kongRobbed: false });
    },

    onKongActorChange: function (event) {
        this.setData({ kongActorIndex: Number(event.detail.value) });
    },

    onKongSourceChange: function (event) {
        this.setData({ kongSourceIndex: Number(event.detail.value) });
    },

    onKongRobbedChange: function (event) {
        this.setData({ kongRobbed: event.detail.value });
    },

    submitKong: function () {
        try {
            var type = this.data.kongTypeOptions[this.data.kongTypeIndex].value;
            var actor = this.data.activePlayers[this.data.kongActorIndex];
            var source = this.data.activePlayers[this.data.kongSourceIndex];
            var round = roundState.recordKong(this.data.round, {
                actorId: actor && actor.id,
                sourcePlayerId: type === 'directKong' && source ? source.id : null,
                kongType: type,
                robbed: type === 'addedKong' && this.data.kongRobbed
            });
            this.saveRound(round);
            this.setData({ showKongForm: false });
            wx.showToast({
                title: type === 'addedKong' && this.data.kongRobbed ? '抢杠：未产生杠分' : '杠分已记录',
                icon: 'success'
            });
        } catch (error) {
            wx.showToast({ title: error.message || '杠牌信息不完整', icon: 'none' });
        }
    },

    openWallEnd: function () {
        wx.showToast({ title: '终局手牌录入将在下一批接入', icon: 'none' });
    },

    backToMatch: function () {
        wx.navigateBack();
    }
});
