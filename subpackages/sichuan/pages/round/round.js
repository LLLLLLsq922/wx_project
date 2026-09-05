'use strict';

var tiles = require('../../../../core/tiles.js');
var sichuanEngine = require('../../../../rules/sichuan/engine.js');
var roundState = require('../../../../rules/sichuan/roundState.js');
var matchState = require('../../../../rules/sichuan/matchState.js');
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

function emptyWinDraft() {
    return {
        concealedTiles: [],
        melds: [],
        winTile: '',
        result: null
    };
}

function emptyWinContext() {
    return {
        tianhu: false,
        dihu: false,
        gangshanghua: false,
        gangshangpao: false,
        qiangganghu: false,
        haidilaoyue: false
    };
}

function normalizeWinDraft(draft) {
    var next = clone(draft || emptyWinDraft());
    next.concealedTiles = next.concealedTiles || [];
    next.melds = (next.melds || []).map(function (meld) {
        var tileId = meld.tiles && meld.tiles[0];
        return {
            type: meld.type,
            tiles: (meld.tiles || []).slice(),
            label: meld.label || ((meld.type === 'pon' ? '碰' :
                meld.type === 'openKong' ? '直杠' :
                meld.type === 'addedKong' ? '补杠' : '暗杠') +
                tiles.chineseNameFromId(tileId))
        };
    });
    next.winTile = next.winTile || '';
    next.result = next.result || null;
    return next;
}

function errorMessage(reason) {
    var messages = {
        INVALID_WINNING_TILE_COUNT: '牌张数量不正确，请组成四组面子加一对将牌',
        MISSING_WIN_TILE: '请选择和牌张',
        WIN_TILE_NOT_IN_CONCEALED_HAND: '和牌张必须包含在暗手中',
        DINGQUE_NOT_CLEARED: '手牌中仍有定缺花色，不能和牌',
        INVALID_TILE_COPIES: '同一种牌不能超过四张',
        INVALID_SHAPE: '当前牌面未组成合法和牌结构',
        CHI_NOT_ALLOWED: '川麻不允许录入吃牌'
    };
    return messages[reason] || '当前手牌不能合法和牌';
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
        showWinForm: false,
        winIsSelfDraw: false,
        winDiscarderIndex: 0,
        selectedWinnerIds: [],
        currentWinPlayerId: '',
        winDrafts: {},
        currentWinDraft: emptyWinDraft(),
        winContext: emptyWinContext(),
        winContextOptions: [
            { key: 'tianhu', label: '天胡' },
            { key: 'dihu', label: '地胡' },
            { key: 'gangshanghua', label: '杠上花' },
            { key: 'gangshangpao', label: '杠上炮' },
            { key: 'qiangganghu', label: '抢杠胡' },
            { key: 'haidilaoyue', label: '海底捞月' }
        ],
        meldTypeIndex: 0,
        meldTileIndex: 0,
        meldTypeOptions: [
            { value: 'pon', label: '碰', copies: 3 },
            { value: 'openKong', label: '直杠', copies: 4 },
            { value: 'addedKong', label: '补杠', copies: 4 },
            { value: 'concealedKong', label: '暗杠', copies: 4 }
        ],
        tileOptions: [],
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
        var groups = createTileGroups();
        var tileOptions = [];
        groups.forEach(function (group) { tileOptions = tileOptions.concat(group.tiles); });
        this.setData({
            matchId: decodeURIComponent(options.id || ''),
            tileGroups: groups,
            tileOptions: tileOptions
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
        var savedWin = draft.winEntry || {};
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
            roundScoreRows: scoreRows(match, round),
            showWinForm: !!savedWin.open,
            winIsSelfDraw: !!savedWin.isSelfDraw,
            winDiscarderIndex: savedWin.discarderIndex || 0,
            selectedWinnerIds: clone(savedWin.selectedWinnerIds || []),
            currentWinPlayerId: savedWin.currentWinPlayerId || '',
            winDrafts: clone(savedWin.drafts || {}),
            currentWinDraft: normalizeWinDraft(
                (savedWin.drafts || {})[savedWin.currentWinPlayerId]
            ),
            winContext: clone(savedWin.context || this.data.winContext)
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
        var activePlayers = this.data.activePlayers;
        if (!activePlayers.length) return;
        var selected = this.data.selectedWinnerIds.filter(function (playerId) {
            return activePlayers.some(function (player) { return player.id === playerId; });
        });
        if (!selected.length) selected = [activePlayers[0].id];
        var playerId = activePlayers.some(function (player) {
            return player.id === this.data.currentWinPlayerId;
        }, this) ? this.data.currentWinPlayerId : selected[0];
        var drafts = clone(this.data.winDrafts);
        if (!drafts[playerId]) drafts[playerId] = emptyWinDraft();
        this.setData({
            showWinForm: true,
            selectedWinnerIds: selected,
            currentWinPlayerId: playerId,
            winDrafts: drafts,
            currentWinDraft: normalizeWinDraft(drafts[playerId]),
            winDiscarderIndex: activePlayers.length > 1 ? 1 : 0
        });
        this.persistWinDraft();
    },

    closeWinEntry: function () {
        this.setData({ showWinForm: false });
        this.persistWinDraft();
    },

    persistWinDraft: function () {
        var value = {
            open: this.data.showWinForm,
            isSelfDraw: this.data.winIsSelfDraw,
            discarderIndex: this.data.winDiscarderIndex,
            selectedWinnerIds: clone(this.data.selectedWinnerIds),
            currentWinPlayerId: this.data.currentWinPlayerId,
            drafts: clone(this.data.winDrafts),
            context: clone(this.data.winContext)
        };
        this.persistInputDraft('winEntry', value);
    },

    switchWinPlayer: function (event) {
        var playerId = event.currentTarget.dataset.player;
        var drafts = clone(this.data.winDrafts);
        if (!drafts[playerId]) drafts[playerId] = emptyWinDraft();
        this.setData({
            currentWinPlayerId: playerId,
            winDrafts: drafts,
            currentWinDraft: normalizeWinDraft(drafts[playerId])
        });
        this.persistWinDraft();
    },

    toggleWinner: function (event) {
        var playerId = event.currentTarget.dataset.player;
        var selected = this.data.selectedWinnerIds.slice();
        if (this.data.winIsSelfDraw) {
            selected = [playerId];
        } else {
            var index = selected.indexOf(playerId);
            if (index === -1) selected.push(playerId);
            else if (selected.length > 1) selected.splice(index, 1);
        }
        var drafts = clone(this.data.winDrafts);
        if (!drafts[playerId]) drafts[playerId] = emptyWinDraft();
        this.setData({
            selectedWinnerIds: selected,
            currentWinPlayerId: playerId,
            winDrafts: drafts,
            currentWinDraft: normalizeWinDraft(drafts[playerId])
        });
        this.triggerFeedback();
        this.persistWinDraft();
    },

    onWinSelfDrawChange: function (event) {
        var isSelfDraw = !!event.detail.value;
        var selected = this.data.selectedWinnerIds.slice();
        if (isSelfDraw && selected.length > 1) selected = [this.data.currentWinPlayerId];
        this.setData({ winIsSelfDraw: isSelfDraw, selectedWinnerIds: selected });
        this.persistWinDraft();
    },

    onWinDiscarderChange: function (event) {
        this.setData({ winDiscarderIndex: Number(event.detail.value) });
        this.persistWinDraft();
    },

    updateCurrentWinDraft: function (draft) {
        var drafts = clone(this.data.winDrafts);
        draft.result = null;
        drafts[this.data.currentWinPlayerId] = clone(draft);
        this.setData({ winDrafts: drafts, currentWinDraft: draft });
        this.persistWinDraft();
    },

    addWinTile: function (event) {
        var tile = event.currentTarget.dataset.tile;
        var draft = normalizeWinDraft(this.data.currentWinDraft);
        var counts = tiles.getHandCounts(draft.concealedTiles, draft.melds);
        if (counts.structural >= 14) {
            wx.showToast({ title: '牌面结构已经达到14张', icon: 'none' });
            return;
        }
        var proposed = clone(draft);
        proposed.concealedTiles.push(tile.id);
        if (!tiles.validateCopies(proposed).valid) {
            wx.showToast({ title: '同一种牌最多四张', icon: 'none' });
            return;
        }
        this.triggerFeedback();
        this.updateCurrentWinDraft(proposed);
    },

    removeWinTile: function (event) {
        var draft = normalizeWinDraft(this.data.currentWinDraft);
        draft.concealedTiles.splice(Number(event.currentTarget.dataset.index), 1);
        this.triggerFeedback();
        this.updateCurrentWinDraft(draft);
    },

    onWinTileChange: function (event) {
        var draft = normalizeWinDraft(this.data.currentWinDraft);
        draft.winTile = this.data.tileOptions[Number(event.detail.value)].id;
        this.updateCurrentWinDraft(draft);
    },

    onMeldTypeChange: function (event) {
        this.setData({ meldTypeIndex: Number(event.detail.value) });
    },

    onMeldTileChange: function (event) {
        this.setData({ meldTileIndex: Number(event.detail.value) });
    },

    addWinMeld: function () {
        var draft = normalizeWinDraft(this.data.currentWinDraft);
        var type = this.data.meldTypeOptions[this.data.meldTypeIndex];
        var tile = this.data.tileOptions[this.data.meldTileIndex];
        if (tiles.getHandCounts(draft.concealedTiles, draft.melds).structural + 3 > 14) {
            wx.showToast({ title: '面子加入后牌张结构会超过14张', icon: 'none' });
            return;
        }
        var meldTiles = [];
        for (var i = 0; i < type.copies; i++) meldTiles.push(tile.id);
        draft.melds.push({
            type: type.value,
            tiles: meldTiles,
            label: type.label + ' · ' + tile.name
        });
        if (!tiles.validateCopies(draft).valid) {
            draft.melds.pop();
            wx.showToast({ title: '同一种牌最多四张', icon: 'none' });
            return;
        }
        this.triggerFeedback();
        this.updateCurrentWinDraft(draft);
    },

    removeWinMeld: function (event) {
        var draft = normalizeWinDraft(this.data.currentWinDraft);
        draft.melds.splice(Number(event.currentTarget.dataset.index), 1);
        this.triggerFeedback();
        this.updateCurrentWinDraft(draft);
    },

    onWinContextChange: function (event) {
        var context = clone(this.data.winContext);
        context[event.currentTarget.dataset.key] = !!event.detail.value;
        this.setData({ winContext: context });
        this.persistWinDraft();
    },

    calculateDraft: function (playerId) {
        var draft = normalizeWinDraft(this.data.winDrafts[playerId]);
        var context = clone(this.data.winContext);
        context.winTile = draft.winTile;
        if (this.data.round.rules.dingqueEnabled) {
            context.dingqueSuit = this.data.round.dingqueSuits[playerId];
        }
        return sichuanEngine.calculateWin({
            concealedTiles: draft.concealedTiles,
            melds: draft.melds,
            context: context,
            rules: this.data.round.rules
        });
    },

    calculateCurrentWinner: function () {
        var result = this.calculateDraft(this.data.currentWinPlayerId);
        var drafts = clone(this.data.winDrafts);
        drafts[this.data.currentWinPlayerId].result = result;
        this.setData({
            winDrafts: drafts,
            currentWinDraft: normalizeWinDraft(drafts[this.data.currentWinPlayerId])
        });
        this.persistWinDraft();
        if (!result.canWin) wx.showToast({ title: errorMessage(result.reason), icon: 'none' });
    },

    submitWin: function () {
        try {
            var self = this;
            if (!this.data.selectedWinnerIds.length) throw new Error('请至少选择一名和牌者');
            var discarder = this.data.activePlayers[this.data.winDiscarderIndex];
            if (!this.data.winIsSelfDraw && (!discarder ||
                this.data.selectedWinnerIds.indexOf(discarder.id) !== -1)) {
                throw new Error('点炮者不能同时是本次和牌者');
            }
            var winners = this.data.selectedWinnerIds.map(function (playerId) {
                var draft = normalizeWinDraft(self.data.winDrafts[playerId]);
                var result = self.calculateDraft(playerId);
                if (!result.canWin) throw new Error(errorMessage(result.reason));
                return {
                    playerId: playerId,
                    fan: result.totalFan,
                    pattern: result.selectedCandidate.pattern,
                    fanList: result.fanList,
                    handSnapshot: {
                        concealedTiles: draft.concealedTiles,
                        melds: draft.melds.map(function (meld) {
                            return { type: meld.type, tiles: meld.tiles };
                        }),
                        winTile: draft.winTile,
                        context: clone(self.data.winContext)
                    }
                };
            });
            var round = roundState.recordWin(this.data.round, {
                winners: winners,
                discarderId: this.data.winIsSelfDraw ? null : discarder.id,
                isSelfDraw: this.data.winIsSelfDraw
            });
            round.inputDraft = round.inputDraft || {};
            delete round.inputDraft.winEntry;
            this.setData({
                showWinForm: false,
                selectedWinnerIds: [],
                currentWinPlayerId: '',
                winDrafts: {},
                currentWinDraft: emptyWinDraft(),
                winContext: emptyWinContext()
            });
            this.saveRound(round);
            wx.showToast({ title: round.ended ? '本局已结算' : '胡牌已记录', icon: 'success' });
        } catch (error) {
            wx.showToast({ title: error.message || '胡牌信息不完整', icon: 'none' });
        }
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

    commitEndedRound: function () {
        try {
            var app = getApp();
            var found = matchService.findMatch(app.globalData.localData, this.data.matchId);
            if (!found || !found.match.currentRound || !found.match.currentRound.ended) {
                throw new Error('当前没有可确认的已结束牌局');
            }
            var baseMatch = clone(found.match);
            var completedRound = clone(baseMatch.currentRound);
            delete baseMatch.currentRound;
            var committed = matchState.commitRound(baseMatch, completedRound);
            delete committed.currentRound;
            app.globalData.localData = matchService.persistMatch(
                wx, app.globalData.localData, committed
            );
            wx.redirectTo({
                url: '/subpackages/sichuan/pages/match/match?id=' +
                    encodeURIComponent(committed.id)
            });
        } catch (error) {
            wx.showToast({ title: error.message || '本局入账失败', icon: 'none' });
        }
    },

    backToMatch: function () {
        wx.navigateBack();
    }
});
