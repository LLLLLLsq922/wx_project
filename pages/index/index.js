// pages/index/index.js
var mahjongUtil = require('../../util/mahjongUtil.js');

Page({
    /**
     * 页面数据对象
     * @property {Array} handCards - 暗牌数组（不含操作组牌）
     * @property {Array} actionGroups - 操作组数组（吃碰杠），每项 {type, cards:[...]}
     * @property {Array} allCards - 所有可用牌数组
     * @property {string} currentMode - 当前操作模式（hand/chi/peng/minggang/angang）
     * @property {Array} tempChiCards - 临时吃牌数组
     * @property {Array} actionModes - 操作模式选项
     * @property {Array} specialRules - 特殊规则选项
     * @property {Array} windOptions - 风位选项
     * @property {number} roundWind - 圈风索引
     * @property {number} seatWind - 风位索引
     * @property {boolean} showResult - 是否显示结果
     * @property {Object} result - 计算结果
     */
    data: {
        handCards: [],           // 暗牌（不含操作组牌）
        actionGroups: [],         // 操作组（吃碰杠）
        allCards: [],             // 所有可用麻将牌
        currentMode: 'hand',      // 当前操作模式
        tempChiCards: [],         // 临时存储吃牌选择
        actionModes: [
            { name: '立牌', value: 'hand' },
            { name: '吃牌', value: 'chi' },
            { name: '碰牌', value: 'peng' },
            { name: '明杠', value: 'minggang' },
            { name: '暗杠', value: 'angang' }
        ],
        specialRules: [
            { name: '自摸', value: 'zimo', checked: false },
            { name: '绝张', value: 'juezhang', checked: false },
            { name: '抢杠和', value: 'qiangganghu', checked: false },
            { name: '海底捞月', value: 'haidilaoyue', checked: false },
            { name: '妙手回春', value: 'miaoshouhuichun', checked: false },
            { name: '杠上开花', value: 'gangshangkaihua', checked: false }
        ],
        windOptions: ['东', '南', '西', '北'],
        roundWind: 0,
        seatWind: 0,
        winTileCandidates: ['未选择'],
        winTileIndex: 0,
        huaPai: 0,
        huaPaiOptions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        showResult: false,
        result: {}
    },

    onLoad: function () {
        this.initCards();
    },

    onShow: function () {},

    /**
     * 初始化麻将牌数据
     */
    initCards: function () {
        var suits = [
            { name: '万', type: '万' },
            { name: '条', type: '条' },
            { name: '筒', type: '筒' }
        ];
        var honors = ['东', '南', '西', '北', '中', '发', '白'];
        var cards = [];

        for (var s = 0; s < suits.length; s++) {
            var suit = suits[s];
            for (var i = 1; i <= 9; i++) {
                var cardName = i + suit.name;
                cards.push({
                    id: cardName,
                    name: cardName,
                    type: suit.type,
                    value: i,
                    image: '/images/cards/' + i + suit.name + '.png'
                });
            }
        }
        for (var h = 0; h < honors.length; h++) {
            var honor = honors[h];
            cards.push({
                id: honor,
                name: honor,
                type: '字',
                value: honor,
                image: '/images/cards/' + honor + '.png'
            });
        }

        this.setData({
            allCards: cards,
            handCards: [],
            actionGroups: [],
            tempChiCards: []
        });
        this.updateWinTileCandidates();
    },

    /**
     * 统计指定牌在全局（暗牌 + 操作组牌）中的数量
     * handCards 只含暗牌，actionGroups.cards 含操作组牌，二者相加无双重计数
     */
    countCardInAll: function (cardId) {
        var handCards = this.data.handCards;
        var actionGroups = this.data.actionGroups;
        var count = 0;

        handCards.forEach(function (card) {
            if (card.id === cardId) count++;
        });

        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function (group) {
                if (group.cards && Array.isArray(group.cards)) {
                    group.cards.forEach(function (groupCard) {
                        if (groupCard.id === cardId) count++;
                    });
                }
            });
        }
        return count;
    },

    /**
     * 当前手牌总数（暗牌 + 操作组牌 ×3）
     */
    totalTileCount: function () {
        return this.data.handCards.length + 3 * this.data.actionGroups.length;
    },

    selectCard: function (e) {
        try {
            var card = e.currentTarget.dataset.card;
            var currentMode = this.data.currentMode;
            if (currentMode === 'hand') {
                this.addToHand(card);
            } else if (currentMode === 'chi') {
                this.addToChi(card);
            } else {
                this.addToPengOrGang(card, currentMode);
            }
        } catch (error) {
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
        }
    },

    addToHand: function (card) {
        var handCards = this.data.handCards;
        // 暗牌数量上限 = 14 - 3*操作组数
        var maxHand = 14 - 3 * this.data.actionGroups.length;
        if (handCards.length >= maxHand) {
            wx.showToast({
                title: '暗牌不能超过' + maxHand + '张',
                icon: 'none', duration: 2000
            });
            return;
        }
        var cardCount = this.countCardInAll(card.id);
        if (cardCount >= 4) {
            wx.showToast({
                title: card.name + '最多只能有4张',
                icon: 'none', duration: 2000
            });
            return;
        }
        var newHandCards = handCards.concat([card]);
        this.setData({ handCards: newHandCards, showResult: false });
        this.updateWinTileCandidates();
    },

    addToChi: function (card) {
        var tempChiCards = this.data.tempChiCards;
        var alreadySelected = tempChiCards.some(function (tempCard) {
            return tempCard.id === card.id;
        });
        if (alreadySelected) {
            wx.showToast({ title: '不能重复选择同一张牌', icon: 'none', duration: 2000 });
            return;
        }
        // 统计临时区中同名牌数量（而非临时区总长度），避免误拦
        var tempSame = 0;
        tempChiCards.forEach(function (c) { if (c.id === card.id) tempSame++; });
        var cardCount = this.countCardInAll(card.id) + tempSame;
        if (cardCount >= 4) {
            wx.showToast({
                title: card.name + '最多只能有4张',
                icon: 'none', duration: 2000
            });
            return;
        }
        var newTempChiCards = tempChiCards.concat([card]);
        this.setData({ tempChiCards: newTempChiCards, showResult: false });
        if (newTempChiCards.length === 3) {
            this.completeChi();
        }
    },

    /**
     * 完成吃牌：3 张牌仅写入 actionGroups，不再写入 handCards
     */
    completeChi: function () {
        var tempChiCards = this.data.tempChiCards;
        var actionGroups = this.data.actionGroups;

        if (!this.validateChi(tempChiCards)) {
            wx.showToast({ title: '吃牌必须为同花色连续数字', icon: 'none', duration: 2000 });
            this.rollbackChi();
            return;
        }

        // 检查总数：暗牌 + 3*操作组数 + 3 不超过 14
        if (this.totalTileCount() + 3 > 14) {
            wx.showToast({ title: '总牌数不能超过14张', icon: 'none', duration: 2000 });
            this.rollbackChi();
            return;
        }

        var newGroup = {
            type: '吃',
            cards: tempChiCards.slice()
        };
        var newActionGroups = actionGroups.concat([newGroup]);
        // 注意：不再把 tempChiCards 写入 handCards
        this.setData({
            actionGroups: newActionGroups,
            tempChiCards: [],
            showResult: false
        });
        this.updateWinTileCandidates();
        wx.showToast({ title: '吃牌成功', icon: 'success', duration: 1000 });
    },

    validateChi: function (cards) {
        if (cards.length !== 3) return false;
        var types = cards.map(function (card) { return card.type; });
        var uniqueTypes = [];
        types.forEach(function (t) {
            if (uniqueTypes.indexOf(t) === -1) uniqueTypes.push(t);
        });
        if (uniqueTypes.length !== 1 || uniqueTypes[0] === '字') return false;
        var values = cards.map(function (card) { return card.value; })
                          .sort(function (a, b) { return a - b; });
        return (values[1] === values[0] + 1) && (values[2] === values[1] + 1);
    },

    rollbackChi: function () {
        this.setData({ tempChiCards: [] });
    },

    /**
     * 添加碰或杠：操作牌仅写入 actionGroups，不再写入 handCards
     */
    addToPengOrGang: function (card, mode) {
        var actionGroups = this.data.actionGroups;

        var cardCount = 3;
        var actionType = '碰';
        if (mode === 'minggang' || mode === 'angang') {
            cardCount = 4;
            actionType = mode === 'minggang' ? '明杠' : '暗杠';
        }

        // 检查全局牌数（含操作组）
        var totalCount = this.countCardInAll(card.id);
        // 临时吃牌区的同名牌也要算入（避免与吃冲突）
        var tempSame = 0;
        this.data.tempChiCards.forEach(function (c) {
            if (c.id === card.id) tempSame++;
        });
        if (totalCount + tempSame + cardCount > 4) {
            wx.showToast({
                title: card.name + '最多只能有4张，当前已有' + totalCount + '张',
                icon: 'none', duration: 2000
            });
            return;
        }

        // 检查总数
        if (this.totalTileCount() + cardCount > 14) {
            wx.showToast({ title: '总牌数不能超过14张', icon: 'none', duration: 2000 });
            return;
        }

        var operationCards = [];
        for (var i = 0; i < cardCount; i++) operationCards.push(card);

        var newGroup = {
            type: actionType,
            cards: operationCards
        };
        var newActionGroups = actionGroups.concat([newGroup]);
        // 注意：不再把 operationCards 写入 handCards
        this.setData({
            actionGroups: newActionGroups,
            showResult: false
        });
        this.updateWinTileCandidates();
        wx.showToast({ title: actionType + '成功', icon: 'success', duration: 1000 });
    },

    /**
     * 移除暗牌
     */
    removeCard: function (e) {
        try {
            var index = e.currentTarget.dataset.index;
            var handCards = this.data.handCards;
            if (index >= 0 && index < handCards.length) {
                var newHandCards = handCards.slice();
                newHandCards.splice(index, 1);
                this.setData({ handCards: newHandCards, showResult: false });
                this.updateWinTileCandidates();
            }
        } catch (error) { /* 静默 */ }
    },

    /**
     * 移除操作组：只删 actionGroups，不动 handCards
     */
    removeActionGroup: function (e) {
        try {
            var index = e.currentTarget.dataset.index;
            var actionGroups = this.data.actionGroups;
            if (index >= 0 && index < actionGroups.length) {
                var newActionGroups = actionGroups.slice();
                newActionGroups.splice(index, 1);
                this.setData({ actionGroups: newActionGroups, showResult: false });
                this.updateWinTileCandidates();
            }
        } catch (error) { /* 静默 */ }
    },

    changeMode: function (e) {
        var newMode = e.currentTarget.dataset.mode;
        var currentMode = this.data.currentMode;
        if (currentMode === 'chi' && newMode !== 'chi') {
            this.rollbackChi();
        }
        this.setData({ currentMode: newMode });
    },

    toggleRule: function (e) {
        var ruleValue = e.currentTarget.dataset.rule;
        var checked = e.detail.value;
        var specialRules = this.data.specialRules;
        var newRules = specialRules.map(function (rule) {
            return rule.value === ruleValue
                ? { name: rule.name, value: rule.value, checked: checked }
                : rule;
        });
        this.setData({ specialRules: newRules, showResult: false });
    },

    changeRoundWind: function (e) {
        this.setData({ roundWind: parseInt(e.detail.value), showResult: false });
    },

    changeSeatWind: function (e) {
        this.setData({ seatWind: parseInt(e.detail.value), showResult: false });
    },

    /**
     * 刷新"胡的牌"候选列表（暗牌 + 操作组牌的唯一名称）
     * 在手牌变化时调用，保持候选列表与手牌同步
     */
    updateWinTileCandidates: function () {
        var handCards = this.data.handCards;
        var actionGroups = this.data.actionGroups;
        var names = {};
        handCards.forEach(function (c) { names[c.name] = true; });
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function (g) {
                if (g.cards && Array.isArray(g.cards)) {
                    g.cards.forEach(function (c) { names[c.name] = true; });
                }
            });
        }
        var candidates = ['未选择'];
        var prevWinTile = this.data.winTileIndex > 0
            ? this.data.winTileCandidates[this.data.winTileIndex]
            : null;
        var newWinTileIndex = 0;
        var sortedNames = Object.keys(names).sort();
        for (var i = 0; i < sortedNames.length; i++) {
            candidates.push(sortedNames[i]);
            if (sortedNames[i] === prevWinTile) newWinTileIndex = i + 1;
        }
        this.setData({
            winTileCandidates: candidates,
            winTileIndex: newWinTileIndex
        });
    },

    changeWinTile: function (e) {
        this.setData({ winTileIndex: parseInt(e.detail.value), showResult: false });
    },

    changeHuaPai: function (e) {
        this.setData({ huaPai: parseInt(e.detail.value), showResult: false });
    },

    /**
     * 计算胡牌番数：构造 options 调用 mahjongUtil.calculateHu
     */
    calculate: function () {
        try {
            var handCards = this.data.handCards;
            var actionGroups = this.data.actionGroups;
            var specialRules = this.data.specialRules;

            if (this.totalTileCount() === 0) {
                wx.showToast({ title: '请先选择麻将牌', icon: 'none', duration: 2000 });
                return;
            }

            // 校验胡牌时暗牌数量 = 14 - 3*操作组数
            var expectedHand = 14 - 3 * actionGroups.length;
            if (handCards.length !== expectedHand) {
                wx.showToast({
                    title: '暗牌数应为' + expectedHand + '张，当前' + handCards.length + '张',
                    icon: 'none', duration: 2000
                });
                return;
            }

            // 构造 options
            var winTileName = this.data.winTileIndex > 0
                ? this.data.winTileCandidates[this.data.winTileIndex]
                : null;
            var options = {
                roundWind: this.data.roundWind,
                seatWind: this.data.seatWind,
                winTile: winTileName,
                huaPai: this.data.huaPai || 0
            };
            specialRules.forEach(function (rule) {
                if (rule.checked) options[rule.value] = true;
            });

            var result = mahjongUtil.calculateHu(handCards, actionGroups, options);

            this.setData({
                showResult: true,
                result: {
                    canHu: result.canHu,
                    totalFan: result.totalFan,
                    fanList: result.fanList,
                    pattern: result.pattern || ''
                }
            });
        } catch (error) {
            wx.showToast({ title: '计算出错，请重试', icon: 'none' });
        }
    },

    closeResult: function () {
        this.setData({ showResult: false });
    },

    clearAll: function () {
        this.setData({
            handCards: [],
            actionGroups: [],
            tempChiCards: [],
            showResult: false,
            result: {},
            specialRules: this.data.specialRules.map(function (rule) {
                return { name: rule.name, value: rule.value, checked: false };
            }),
            roundWind: 0,
            seatWind: 0,
            huaPai: 0,
            currentMode: 'hand'
        });
        this.updateWinTileCandidates();
        wx.showToast({ title: '已清空', icon: 'success' });
    },

    /**
     * 跳转到牌型规则页（tabBar 页需用 wx.switchTab）
     */
    goToRules: function () {
        wx.switchTab({ url: '/pages/rules/rules' });
    }
});
