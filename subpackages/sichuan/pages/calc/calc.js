'use strict';

var tiles = require('../../../../core/tiles.js');
var sichuanEngine = require('../../../../rules/sichuan/engine.js');
var storageService = require('../../../../services/storageService.js');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createTileGroups() {
    var names = { m: '万', s: '条', p: '筒' };
    var grouped = { m: [], s: [], p: [] };
    tiles.getCatalog('sichuan').forEach(function (tile) {
        var name = tiles.chineseNameFromId(tile.id);
        grouped[tile.suit].push({
            id: tile.id,
            name: name,
            suit: tile.suit,
            image: '/images/cards/' + name + '.png'
        });
    });
    return ['m', 's', 'p'].map(function (suit) {
        return { suit: suit, name: names[suit], tiles: grouped[suit] };
    });
}

function defaultRules() {
    return {
        dingqueEnabled: true,
        menqingZhongzhangEnabled: true,
        shibaluohanEnabled: true,
        eventFansEnabled: true
    };
}

function defaultContext() {
    return {
        tianhu: false,
        dihu: false,
        gangshanghua: false,
        gangshangpao: false,
        qiangganghu: false,
        haidilaoyue: false
    };
}

function emptyDraft() {
    return {
        concealedTiles: [],
        melds: [],
        winTile: '',
        dingqueSuit: 'p',
        rules: defaultRules(),
        context: defaultContext()
    };
}

function normalizeDraft(input) {
    var draft = clone(input || emptyDraft());
    var defaults = emptyDraft();
    draft.concealedTiles = Array.isArray(draft.concealedTiles) ? draft.concealedTiles : [];
    draft.melds = Array.isArray(draft.melds) ? draft.melds.map(function (meld) {
        var tileId = meld.tiles && meld.tiles[0];
        var typeName = meld.type === 'pon' ? '碰' : meld.type === 'openKong' ? '直杠' :
            meld.type === 'addedKong' ? '补杠' : '暗杠';
        return {
            type: meld.type,
            tiles: (meld.tiles || []).slice(),
            label: meld.label || typeName + ' · ' + tiles.chineseNameFromId(tileId)
        };
    }) : [];
    draft.winTile = draft.winTile || '';
    draft.dingqueSuit = ['m', 's', 'p'].indexOf(draft.dingqueSuit) === -1 ?
        defaults.dingqueSuit : draft.dingqueSuit;
    draft.rules = Object.assign(defaults.rules, draft.rules || {});
    draft.context = Object.assign(defaults.context, draft.context || {});
    return draft;
}

function resultMessage(reason) {
    var messages = {
        INVALID_WINNING_TILE_COUNT: '请录入完整的14张和牌结构',
        MISSING_WIN_TILE: '请选择本次和牌张',
        WIN_TILE_NOT_IN_CONCEALED_HAND: '和牌张必须包含在暗手中',
        DINGQUE_NOT_CLEARED: '手牌仍有定缺花色，不能和牌',
        INVALID_TILE_COPIES: '同一种牌不能超过四张',
        INVALID_SHAPE: '当前牌面未组成合法和牌结构'
    };
    return messages[reason] || '当前牌面不能合法和牌';
}

Page({
    data: {
        tileGroups: [],
        tileOptions: [],
        concealedTiles: [],
        melds: [],
        winTile: '',
        dingqueSuit: 'p',
        rules: defaultRules(),
        context: defaultContext(),
        result: null,
        resultMessage: '',
        waits: [],
        structuralCount: 0,
        physicalCount: 0,
        meldTypeIndex: 0,
        meldTileIndex: 0,
        meldTypeOptions: [
            { value: 'pon', label: '碰', copies: 3 },
            { value: 'openKong', label: '直杠', copies: 4 },
            { value: 'addedKong', label: '补杠', copies: 4 },
            { value: 'concealedKong', label: '暗杠', copies: 4 }
        ],
        suitOptions: [
            { id: 'm', name: '万' }, { id: 's', name: '条' }, { id: 'p', name: '筒' }
        ],
        ruleOptions: [
            { key: 'dingqueEnabled', label: '启用定缺' },
            { key: 'menqingZhongzhangEnabled', label: '门清、中张' },
            { key: 'shibaluohanEnabled', label: '十八罗汉' },
            { key: 'eventFansEnabled', label: '事件附加番' }
        ],
        contextOptions: [
            { key: 'tianhu', label: '天胡' }, { key: 'dihu', label: '地胡' },
            { key: 'gangshanghua', label: '杠上花' }, { key: 'gangshangpao', label: '杠上炮' },
            { key: 'qiangganghu', label: '抢杠胡' }, { key: 'haidilaoyue', label: '海底捞月' }
        ]
    },

    onLoad: function () {
        var groups = createTileGroups();
        var options = [];
        groups.forEach(function (group) { options = options.concat(group.tiles); });
        this.setData({ tileGroups: groups, tileOptions: options });
        this.initTileAudio();
        this.restoreDraft();
        this.refreshAnalysis();
    },

    onUnload: function () {
        if (this.tileAudio) {
            this.tileAudio.destroy();
            this.tileAudio = null;
        }
    },

    initTileAudio: function () {
        if (this.tileAudio || typeof wx === 'undefined' || !wx.createInnerAudioContext) return;
        this.tileAudio = wx.createInnerAudioContext();
        this.tileAudio.src = '/audio/mahjong-tile-click.mp3';
        this.tileAudio.volume = 0.5;
        this.tileAudio.obeyMuteSwitch = true;
    },

    triggerFeedback: function () {
        var app = typeof getApp === 'function' ? getApp() : null;
        var settings = app && app.globalData ? app.globalData.settings : null;
        if (!settings || settings.vibrationEnabled !== false) {
            try { if (wx.vibrateShort) wx.vibrateShort({ type: 'light' }); } catch (ignoreVibration) { /* 静默 */ }
        }
        if (settings && settings.soundEnabled === false) return;
        if (!this.tileAudio) this.initTileAudio();
        if (!this.tileAudio) return;
        try { this.tileAudio.stop(); } catch (ignoreStop) { /* 静默 */ }
        try { this.tileAudio.seek(0); } catch (ignoreSeek) { /* 静默 */ }
        try { this.tileAudio.play(); } catch (ignorePlay) { /* 静默 */ }
    },

    restoreDraft: function () {
        var app = typeof getApp === 'function' ? getApp() : null;
        var localData = app && app.globalData ? app.globalData.localData : null;
        var saved = localData && localData.quickCalcDrafts ? localData.quickCalcDrafts.sichuan : null;
        var draft = normalizeDraft(saved);
        this.setData({
            concealedTiles: draft.concealedTiles,
            melds: draft.melds,
            winTile: draft.winTile,
            dingqueSuit: draft.dingqueSuit,
            rules: draft.rules,
            context: draft.context
        });
    },

    currentDraft: function () {
        return {
            concealedTiles: clone(this.data.concealedTiles),
            melds: clone(this.data.melds),
            winTile: this.data.winTile,
            dingqueSuit: this.data.dingqueSuit,
            rules: clone(this.data.rules),
            context: clone(this.data.context)
        };
    },

    persistDraft: function () {
        var app = typeof getApp === 'function' ? getApp() : null;
        if (!app || !app.globalData || !app.globalData.localData) return;
        app.globalData.localData.quickCalcDrafts = app.globalData.localData.quickCalcDrafts || {};
        app.globalData.localData.quickCalcDrafts.sichuan = this.currentDraft();
        try {
            app.globalData.localData = storageService.save(wx, app.globalData.localData);
            app.globalData.storageError = null;
        } catch (error) {
            app.globalData.storageError = error;
            wx.showToast({ title: error.message || '草稿保存失败', icon: 'none' });
        }
    },

    updateDraft: function (update, feedback) {
        update.result = null;
        update.resultMessage = '';
        this.setData(update);
        if (feedback) this.triggerFeedback();
        this.persistDraft();
        this.refreshAnalysis();
    },

    addTile: function (event) {
        var tile = event.currentTarget.dataset.tile;
        var concealed = this.data.concealedTiles.slice();
        var counts = tiles.getHandCounts(concealed, this.data.melds);
        if (counts.structural >= 14) {
            wx.showToast({ title: '牌面结构已经达到14张', icon: 'none' });
            return;
        }
        concealed.push(tile.id);
        if (!tiles.validateCopies({ concealedTiles: concealed, melds: this.data.melds }).valid) {
            wx.showToast({ title: tile.name + '最多四张', icon: 'none' });
            return;
        }
        this.updateDraft({ concealedTiles: concealed }, true);
    },

    removeTile: function (event) {
        var concealed = this.data.concealedTiles.slice();
        var removed = concealed.splice(Number(event.currentTarget.dataset.index), 1)[0];
        var winTile = this.data.winTile === removed && concealed.indexOf(removed) === -1 ? '' : this.data.winTile;
        this.updateDraft({ concealedTiles: concealed, winTile: winTile }, true);
    },

    onMeldTypeChange: function (event) {
        this.setData({ meldTypeIndex: Number(event.detail.value) });
    },

    onMeldTileChange: function (event) {
        this.setData({ meldTileIndex: Number(event.detail.value) });
    },

    addMeld: function () {
        var type = this.data.meldTypeOptions[this.data.meldTypeIndex];
        var tile = this.data.tileOptions[this.data.meldTileIndex];
        var melds = clone(this.data.melds);
        if (tiles.getHandCounts(this.data.concealedTiles, melds).structural + 3 > 14) {
            wx.showToast({ title: '加入副露后结构会超过14张', icon: 'none' });
            return;
        }
        var meldTiles = [];
        for (var i = 0; i < type.copies; i++) meldTiles.push(tile.id);
        melds.push({ type: type.value, tiles: meldTiles, label: type.label + ' · ' + tile.name });
        if (!tiles.validateCopies({ concealedTiles: this.data.concealedTiles, melds: melds }).valid) {
            wx.showToast({ title: tile.name + '最多四张', icon: 'none' });
            return;
        }
        this.updateDraft({ melds: melds }, true);
    },

    removeMeld: function (event) {
        var melds = clone(this.data.melds);
        melds.splice(Number(event.currentTarget.dataset.index), 1);
        this.updateDraft({ melds: melds }, true);
    },

    onWinTileChange: function (event) {
        this.updateDraft({ winTile: this.data.tileOptions[Number(event.detail.value)].id });
    },

    selectDingque: function (event) {
        this.updateDraft({ dingqueSuit: event.currentTarget.dataset.suit }, true);
    },

    onRuleChange: function (event) {
        var rules = clone(this.data.rules);
        rules[event.currentTarget.dataset.key] = !!event.detail.value;
        this.updateDraft({ rules: rules });
    },

    onContextChange: function (event) {
        var context = clone(this.data.context);
        context[event.currentTarget.dataset.key] = !!event.detail.value;
        this.updateDraft({ context: context });
    },

    engineInput: function (waiting) {
        var context = clone(this.data.context);
        if (!waiting) context.winTile = this.data.winTile;
        if (this.data.rules.dingqueEnabled) context.dingqueSuit = this.data.dingqueSuit;
        return {
            concealedTiles: this.data.concealedTiles,
            melds: this.data.melds,
            context: context,
            rules: this.data.rules
        };
    },

    refreshAnalysis: function () {
        var counts = tiles.getHandCounts(this.data.concealedTiles, this.data.melds);
        var waits = counts.structural === 13 ? sichuanEngine.analyzeWaits(this.engineInput(true)) : [];
        this.setData({
            structuralCount: counts.structural,
            physicalCount: counts.physical,
            waits: waits.map(function (wait) {
                return {
                    tileId: wait.tileId,
                    name: wait.name,
                    image: '/images/cards/' + wait.name + '.png',
                    remaining: wait.remaining,
                    fan: wait.result.totalFan,
                    pattern: wait.result.selectedCandidate.pattern
                };
            })
        });
    },

    calculate: function () {
        var result = sichuanEngine.calculateWin(this.engineInput(false));
        this.setData({
            result: result,
            resultMessage: result.canWin ? '' : resultMessage(result.reason)
        });
        if (!result.canWin) wx.showToast({ title: resultMessage(result.reason), icon: 'none' });
    },

    openRule: function (event) {
        var ruleId = event.currentTarget.dataset.id;
        if (!ruleId) return;
        wx.navigateTo({
            url: '/subpackages/sichuan/pages/rule-detail/rule-detail?id=' +
                encodeURIComponent(ruleId)
        });
    },

    clearDraftNow: function () {
        var draft = emptyDraft();
        this.setData({
            concealedTiles: draft.concealedTiles,
            melds: draft.melds,
            winTile: draft.winTile,
            dingqueSuit: draft.dingqueSuit,
            rules: draft.rules,
            context: draft.context,
            result: null,
            resultMessage: '',
            waits: [],
            structuralCount: 0,
            physicalCount: 0
        });
        this.persistDraft();
    },

    clearDraft: function () {
        var self = this;
        if (!wx.showModal) {
            this.clearDraftNow();
            return;
        }
        wx.showModal({
            title: '清空快速算牌',
            content: '将清除当前川麻手牌和规则选择。',
            success: function (result) { if (result.confirm) self.clearDraftNow(); }
        });
    }
});
