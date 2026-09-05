'use strict';

var matchState = require('../../../../rules/sichuan/matchState.js');
var roundState = require('../../../../rules/sichuan/roundState.js');
var matchService = require('../../../../services/matchService.js');

Page({
    data: {
        playerNames: ['玩家1', '玩家2', '玩家3', '玩家4'],
        initialDealerIndex: 0,
        mode: roundState.MODES.BLOOD_BATTLE,
        modeOptions: [
            { value: 'bloodBattle', label: '血战到底' },
            { value: 'bloodRiver', label: '血流成河' },
            { value: 'normal', label: '普通川麻' }
        ],
        formatIndex: 0,
        formatOptions: [
            { value: 'fixed4', label: '固定4局' },
            { value: 'fixed8', label: '固定8局' },
            { value: 'fixed16', label: '固定16局' },
            { value: 'custom', label: '自定义局数' },
            { value: 'eachDealer', label: '每人坐庄一次' },
            { value: 'unlimited', label: '不限局数' }
        ],
        customRoundCount: 4,
        baseScoreIndex: 0,
        baseScoreOptions: [1, 2, 5],
        selfDrawIndex: 0,
        selfDrawOptions: [
            { value: 'addBase', label: '自摸加底' },
            { value: 'addFan', label: '自摸加1番' }
        ],
        switches: {
            huansanzhangEnabled: true,
            dingqueEnabled: true,
            menqingZhongzhangEnabled: true,
            shibaluohanEnabled: true,
            eventFansEnabled: true,
            huazhuEnabled: true,
            dajiaoEnabled: true,
            taxRefundEnabled: true
        },
        submitting: false
    },

    onPlayerNameInput: function (event) {
        var index = Number(event.currentTarget.dataset.index);
        var key = 'playerNames[' + index + ']';
        this.setData((function () {
            var update = {};
            update[key] = event.detail.value;
            return update;
        })());
    },

    onDealerChange: function (event) {
        this.setData({ initialDealerIndex: Number(event.detail.value) });
    },

    onModeChange: function (event) {
        this.setData({ mode: event.detail.value });
    },

    onFormatChange: function (event) {
        this.setData({ formatIndex: Number(event.detail.value) });
    },

    onCustomRoundInput: function (event) {
        this.setData({ customRoundCount: Number(event.detail.value) });
    },

    onBaseScoreChange: function (event) {
        this.setData({ baseScoreIndex: Number(event.detail.value) });
    },

    onSelfDrawChange: function (event) {
        this.setData({ selfDrawIndex: Number(event.detail.value) });
    },

    onSwitchChange: function (event) {
        var key = 'switches.' + event.currentTarget.dataset.key;
        var update = {};
        update[key] = event.detail.value;
        this.setData(update);
    },

    buildFormat: function () {
        var selected = this.data.formatOptions[this.data.formatIndex].value;
        if (selected.indexOf('fixed') === 0) {
            return {
                type: matchState.FORMAT_TYPES.FIXED_ROUNDS,
                roundCount: Number(selected.replace('fixed', ''))
            };
        }
        if (selected === 'custom') {
            return {
                type: matchState.FORMAT_TYPES.CUSTOM_ROUNDS,
                roundCount: this.data.customRoundCount
            };
        }
        return {
            type: selected === 'eachDealer' ?
                matchState.FORMAT_TYPES.EACH_DEALER_ONCE : matchState.FORMAT_TYPES.UNLIMITED
        };
    },

    createMatch: function () {
        if (this.data.submitting) return;
        var names = this.data.playerNames.map(function (name) { return String(name || '').trim(); });
        if (names.some(function (name) { return !name; })) {
            wx.showToast({ title: '请填写四名玩家名称', icon: 'none' });
            return;
        }
        this.setData({ submitting: true });
        try {
            var players = names.map(function (name, index) {
                return { id: 'p' + (index + 1), name: name };
            });
            var rules = {};
            Object.keys(this.data.switches).forEach(function (key) {
                rules[key] = this.data.switches[key];
            }, this);
            rules.baseScore = this.data.baseScoreOptions[this.data.baseScoreIndex];
            rules.selfDrawMode = this.data.selfDrawOptions[this.data.selfDrawIndex].value;
            var now = new Date().toISOString();
            var match = matchState.createMatch({
                matchId: 'sichuan-' + Date.now(),
                mode: this.data.mode,
                players: players,
                initialDealerId: players[this.data.initialDealerIndex].id,
                format: this.buildFormat(),
                rules: rules,
                timestamp: now
            });
            var app = getApp();
            if (!app.globalData.localData || app.globalData.storageError) {
                var storageError = new Error('本地数据尚未安全加载，请先处理存储异常');
                storageError.code = 'STORAGE_UNAVAILABLE';
                throw storageError;
            }
            app.globalData.localData = matchService.persistMatch(wx, app.globalData.localData, match);
            app.globalData.storageError = null;
            wx.redirectTo({
                url: '/subpackages/sichuan/pages/match/match?id=' + encodeURIComponent(match.id)
            });
        } catch (error) {
            wx.showToast({ title: error.message || '创建牌局失败', icon: 'none' });
            this.setData({ submitting: false });
        }
    }
});
