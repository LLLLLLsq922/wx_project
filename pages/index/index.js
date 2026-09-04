// pages/index/index.js
// 通过玩法适配器访问规则，页面不再直接耦合旧国标实现。
var mahjongUtil = require('../../rules/guobiao/engine.js');

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
        winTile: null,            // 胡的牌（最后一张加入暗牌的牌）
        winTileState: 'waiting',  // waiting(牌数不足) / tingpai(听牌) / winning(已满14张)
        tingpaiList: [],          // 听牌列表：[{name, image, totalFan}]
        remainingTiles: 0,        // 距离听牌还需几张牌（waiting 状态下显示）
        showResult: false,
        result: { canHu: false, totalFan: 0, fanList: [], pattern: '' }
    },

    onLoad: function () {
        this.initTileAudio();
        this.initCards();
    },

    onShow: function () {},

    onUnload: function () {
        if (this.tileAudio) {
            this.tileAudio.destroy();
            this.tileAudio = null;
        }
    },

    /**
     * 初始化可复用的麻将牌点击音效，避免每次操作都创建音频实例。
     */
    initTileAudio: function () {
        if (this.tileAudio || typeof wx === 'undefined' || !wx.createInnerAudioContext) return;
        var audio = wx.createInnerAudioContext();
        audio.src = '/audio/mahjong-tile-click.mp3';
        audio.volume = 0.55;
        audio.obeyMuteSwitch = true;
        this.tileAudio = audio;
    },

    playTileSound: function () {
        if (!this.tileAudio) this.initTileAudio();
        if (!this.tileAudio) return;
        // 三步分别容错，避免部分机型不支持立即 seek 时连 play 也被跳过。
        try { this.tileAudio.stop(); } catch (e1) { /* 静默 */ }
        try { this.tileAudio.seek(0); } catch (e2) { /* 静默 */ }
        try { this.tileAudio.play(); } catch (e3) { /* 静默 */ }
    },

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
        this.updateWinTileDisplay();
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
     * 当前手牌总数（暗牌 + 各操作组实际牌数，碰/吃=3，杠=4）
     */
    totalTileCount: function () {
        var count = this.data.handCards.length;
        var actionGroups = this.data.actionGroups;
        for (var i = 0; i < actionGroups.length; i++) {
            count += actionGroups[i].cards.length;
        }
        return count;
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

    /**
     * 选牌成功后的轻触觉反馈；不支持振动或用户关闭振动时静默降级。
     */
    triggerSelectionFeedback: function () {
        if (typeof wx !== 'undefined' && wx.vibrateShort) {
            wx.vibrateShort({ type: 'light', fail: function () {} });
        }
        this.playTileSound();
    },

    addToHand: function (card) {
        var handCards = this.data.handCards;
        var actionGroups = this.data.actionGroups;
        // 暗牌数量上限 = (14 + 杠数) - 各操作组实际牌数
        var groupTiles = 0;
        var gangCount = 0;
        for (var i = 0; i < actionGroups.length; i++) {
            groupTiles += actionGroups[i].cards.length;
            if (actionGroups[i].type === '明杠' || actionGroups[i].type === '暗杠') gangCount++;
        }
        var maxHand = 14 + gangCount - groupTiles;
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
        this.triggerSelectionFeedback();
        this.updateWinTileDisplay();
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
        this.triggerSelectionFeedback();
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

        // 检查总数：吃牌不增加杠数，上限 = 14 + 当前杠数
        if (this.totalTileCount() + 3 > 14 + this.getGangCount()) {
            wx.showToast({ title: '总牌数不能超过' + (14 + this.getGangCount()) + '张', icon: 'none', duration: 2000 });
            this.rollbackChi();
            return;
        }

        var newGroup = {
            type: '吃',
            displayClass: 'meld-chi',
            cards: tempChiCards.slice()
        };
        var newActionGroups = actionGroups.concat([newGroup]);
        // 注意：不再把 tempChiCards 写入 handCards
        this.setData({
            actionGroups: newActionGroups,
            tempChiCards: [],
            showResult: false
        });
        this.updateWinTileDisplay();
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

        // 检查总数：杠会多1张补牌，上限 = 14 + (当前杠数 + 是否本次杠)
        var isGang = (mode === 'minggang' || mode === 'angang');
        var maxTotal = 14 + this.getGangCount() + (isGang ? 1 : 0);
        if (this.totalTileCount() + cardCount > maxTotal) {
            wx.showToast({ title: '总牌数不能超过' + maxTotal + '张', icon: 'none', duration: 2000 });
            return;
        }

        var operationCards = [];
        for (var i = 0; i < cardCount; i++) operationCards.push(card);

        var newGroup = {
            type: actionType,
            displayClass: mode === 'peng' ? 'meld-peng' :
                          (mode === 'minggang' ? 'meld-minggang' : 'meld-angang'),
            cards: operationCards
        };
        var newActionGroups = actionGroups.concat([newGroup]);
        // 注意：不再把 operationCards 写入 handCards
        this.setData({
            actionGroups: newActionGroups,
            showResult: false
        });
        this.triggerSelectionFeedback();
        this.updateWinTileDisplay();
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
                this.triggerSelectionFeedback();
                this.updateWinTileDisplay();
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
                this.triggerSelectionFeedback();
                this.updateWinTileDisplay();
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
        this.updateWinTileDisplay();
    },

    changeRoundWind: function (e) {
        this.setData({ roundWind: parseInt(e.detail.value), showResult: false });
        this.updateWinTileDisplay();
    },

    changeSeatWind: function (e) {
        this.setData({ seatWind: parseInt(e.detail.value), showResult: false });
        this.updateWinTileDisplay();
    },

    /**
     * 统计操作组中杠的数量（明杠 + 暗杠），每杠多1张补牌
     */
    getGangCount: function () {
        var actionGroups = this.data.actionGroups;
        var count = 0;
        for (var i = 0; i < actionGroups.length; i++) {
            if (actionGroups[i].type === '明杠' || actionGroups[i].type === '暗杠') count++;
        }
        return count;
    },

    /**
     * 刷新"胡的牌"实时显示区域
     * 状态机：
     *   waiting  - 牌数不足，提示还需几张
     *   tingpai  - 差1张胡，枚举所有可胡牌及其番数
     *   winning  - 已满14+杠数张，显示最后一张加入的暗牌作为胡的牌
     */
    updateWinTileDisplay: function () {
        var handCards = this.data.handCards;
        var actionGroups = this.data.actionGroups;
        var gangCount = this.getGangCount();
        var totalTiles = this.totalTileCount();
        var winningTotal = 14 + gangCount;
        var tingpaiTotal = 13 + gangCount;

        // 牌数不足
        if (totalTiles < tingpaiTotal) {
            this.setData({
                winTileState: 'waiting',
                winTile: null,
                tingpaiList: [],
                remainingTiles: tingpaiTotal - totalTiles,
                result: { canHu: false, totalFan: 0, fanList: [], pattern: '' }
            });
            return;
        }

        // 已满：胡的牌 = 最后一张加入暗牌的牌，并自动计算胡牌结果
        if (totalTiles >= winningTotal) {
            var winTile = null;
            if (handCards.length > 0) {
                winTile = handCards[handCards.length - 1];
            }

            // 自动计算胡牌结果
            var huResult = { canHu: false, totalFan: 0, fanList: [], pattern: '' };
            try {
                var options = {
                    roundWind: this.data.roundWind,
                    seatWind: this.data.seatWind,
                    winTile: winTile ? winTile.name : null
                };
                this.data.specialRules.forEach(function (rule) {
                    if (rule.checked) options[rule.value] = true;
                });
                var calcResult = mahjongUtil.calculateHu(handCards, actionGroups, options);
                huResult = {
                    canHu: calcResult.canHu,
                    isHuShape: calcResult.isHuShape,
                    reason: calcResult.reason || '',
                    totalFan: calcResult.totalFan,
                    fanList: calcResult.fanList,
                    pattern: calcResult.pattern || ''
                };
            } catch (e) {
                // 计算异常时静默降级为不可胡
            }

            this.setData({
                winTileState: 'winning',
                winTile: winTile,
                tingpaiList: [],
                result: huResult
            });
            return;
        }

        // 听牌状态：枚举所有可能的牌，计算哪些能胡及其番数
        var allCards = this.data.allCards;
        var tingpaiList = [];

        for (var i = 0; i < allCards.length; i++) {
            var candidate = allCards[i];
            // 该牌全局已有4张则跳过
            if (this.countCardInAll(candidate.id) >= 4) continue;

            var testHand = handCards.concat([candidate]);
            var options = {
                roundWind: this.data.roundWind,
                seatWind: this.data.seatWind,
                winTile: candidate.name
            };
            this.data.specialRules.forEach(function (rule) {
                if (rule.checked) options[rule.value] = true;
            });

            var result = mahjongUtil.calculateHu(testHand, actionGroups, options);
            if (result.canHu) {
                tingpaiList.push({
                    name: candidate.name,
                    image: candidate.image,
                    totalFan: result.totalFan
                });
            }
        }

        this.setData({
            winTileState: 'tingpai',
            winTile: null,
            tingpaiList: tingpaiList,
            result: { canHu: false, totalFan: 0, fanList: [], pattern: '' }
        });
    },

    clearAll: function () {
        this.setData({
            handCards: [],
            actionGroups: [],
            tempChiCards: [],
            showResult: false,
            result: { canHu: false, totalFan: 0, fanList: [], pattern: '' },
            winTile: null,
            winTileState: 'waiting',
            tingpaiList: [],
            specialRules: this.data.specialRules.map(function (rule) {
                return { name: rule.name, value: rule.value, checked: false };
            }),
            roundWind: 0,
            seatWind: 0,
            currentMode: 'hand'
        });
        this.updateWinTileDisplay();
        wx.showToast({ title: '已清空', icon: 'success' });
    },

    /**
     * 未形成合法完整胡牌时进入规则列表；已经胡牌时直接查看最高番种。
     */
    goToRules: function () {
        var result = this.data.result || {};
        var fanList = result.fanList || [];
        var hasCompleteHu = this.data.winTileState === 'winning' &&
                            result.canHu && fanList.length > 0;

        if (hasCompleteHu) {
            var highestFan = fanList[0];
            for (var i = 1; i < fanList.length; i++) {
                if (fanList[i].fan > highestFan.fan) highestFan = fanList[i];
            }
            wx.navigateTo({
                url: '/pages/rules-detail/rules-detail?name=' +
                     encodeURIComponent(highestFan.name)
            });
            return;
        }

        wx.switchTab({ url: '/pages/rules/rules' });
    }
});
