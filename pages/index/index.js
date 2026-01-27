// pages/index/index.js
Page({
    /**
     * 页面数据对象
     * @property {Array} handCards - 手牌数组
     * @property {Array} actionGroups - 操作组数组（吃碰杠）
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
        handCards: [],           // 玩家手牌
        actionGroups: [],         // 操作组（吃碰杠）
        allCards: [],             // 所有可用麻将牌
        currentMode: 'hand',      // 当前操作模式：立牌/吃牌/碰牌/明杠/暗杠
        tempChiCards: [],         // 临时存储吃牌选择的牌
        actionModes: [            // 操作模式选项
            { name: '立牌', value: 'hand' },
            { name: '吃牌', value: 'chi' },
            { name: '碰牌', value: 'peng' },
            { name: '明杠', value: 'minggang' },
            { name: '暗杠', value: 'angang' }
        ],
        specialRules: [           // 特殊规则选项
            { name: '自摸', value: 'zimo', checked: false },
            { name: '绝张', value: 'juezhang', checked: false },
            { name: '抢杠和', value: 'qiangganghu', checked: false },
            { name: '海底捞月', value: 'haidilaoyue', checked: false }
        ],
        windOptions: ['东', '南', '西', '北'],  // 风位选项
        roundWind: 0,             // 圈风索引
        seatWind: 0,              // 风位索引
        showResult: false,        // 是否显示计算结果
        result: {}                // 计算结果对象
    },

    /**
     * 页面加载生命周期函数
     */
    onLoad: function() {
        this.initCards();  // 初始化麻将牌
    },

    /**
     * 页面显示生命周期函数
     */
    onShow: function() {
        // 页面显示时可执行的操作
    },

    /**
     * 初始化麻将牌数据
     * 创建万、条、筒三种花色各1-9号牌，以及字牌（东南西北中发白）
     */
    initCards: function() {
        // 定义花色数组
        var suits = [
            { name: '万', type: '万' },  // 万子牌
            { name: '条', type: '条' },  // 条子牌
            { name: '筒', type: '筒' }   // 筒子牌
        ];
        
        // 字牌数组
        var honors = ['东', '南', '西', '北', '中', '发', '白'];
        var cards = [];  // 存储所有牌的数组

        // 生成数字牌（万、条、筒）
        for (var s = 0; s < suits.length; s++) {
            var suit = suits[s];  // 当前花色
            for (var i = 1; i <= 9; i++) {
                var cardName = i + suit.name;  // 牌名称（如1万）
                cards.push({
                    id: cardName,       // 牌唯一ID
                    name: cardName,     // 牌显示名称
                    type: suit.type,    // 牌类型（万/条/筒）
                    value: i,           // 牌面值（1-9）
                    image: '/images/cards/' + i + suit.name + '.png'  // 牌图片路径
                });
            }
        }

        // 生成字牌
        for (var h = 0; h < honors.length; h++) {
            var honor = honors[h];  // 当前字牌
            cards.push({
                id: honor,           // 牌唯一ID
                name: honor,         // 牌显示名称
                type: '字',          // 牌类型（字牌）
                value: honor,        // 牌值（直接使用名称）
                image: '/images/cards/' + honor + '.png'  // 牌图片路径
            });
        }

        // 设置初始数据
        this.setData({ 
            allCards: cards,       // 所有可用牌
            handCards: [],         // 清空手牌
            actionGroups: [],      // 清空操作组
            tempChiCards: []       // 清空临时吃牌
        });
    },

    /**
     * 统计指定牌在全局中的数量
     * @param {string} cardId - 要统计的牌ID
     * @return {number} 牌的总数量
     */
    countCardInAll: function(cardId) {
        var handCards = this.data.handCards;    // 获取手牌
        var actionGroups = this.data.actionGroups;  // 获取操作组
        var count = 0;  // 计数器
        
        // 统计手牌中的数量
        handCards.forEach(function(card) {
            if (card.id === cardId) {
                count++;
            }
        });
        
        // 统计操作组中的数量
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                if (group.cards && Array.isArray(group.cards)) {
                    group.cards.forEach(function(groupCard) {
                        if (groupCard.id === cardId) {
                            count++;
                        }
                    });
                }
            });
        }
        
        return count;  // 返回总数量
    },

    /**
     * 选择麻将牌处理
     * @param {Object} e - 事件对象
     */
    selectCard: function(e) {
        try {
            var card = e.currentTarget.dataset.card;  // 获取选中的牌
            var currentMode = this.data.currentMode;  // 获取当前模式

            // 根据当前模式调用不同处理方法
            if (currentMode === 'hand') {
                this.addToHand(card);  // 添加到手牌
            } else if (currentMode === 'chi') {
                this.addToChi(card);   // 添加到吃牌
            } else {
                this.addToPengOrGang(card, currentMode);  // 添加到碰或杠
            }
        } catch (error) {
            // 错误处理
            wx.showToast({
                title: '操作失败，请重试',
                icon: 'none'
            });
        }
    },

    /**
     * 添加牌到手牌
     * @param {Object} card - 要添加的牌对象
     */
    addToHand: function(card) {
        var handCards = this.data.handCards;  // 当前手牌
        
        // 检查手牌数量是否超过14张
        if (handCards.length >= 14) {
            wx.showToast({ 
                title: '手牌不能超过14张', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 检查牌的数量是否超过4张
        var cardCount = this.countCardInAll(card.id);
        if (cardCount >= 4) {
            wx.showToast({ 
                title: card.name + '最多只能有4张', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 添加到手牌
        var newHandCards = handCards.concat([card]);
        this.setData({ 
            handCards: newHandCards,  // 更新手牌
            showResult: false         // 隐藏结果
        });
    },

    /**
     * 添加牌到吃牌临时区
     * @param {Object} card - 要添加的牌对象
     */
    addToChi: function(card) {
        var tempChiCards = this.data.tempChiCards;  // 临时吃牌区
        var handCards = this.data.handCards;        // 当前手牌
        
        // 检查是否已选择过该牌
        var alreadySelected = tempChiCards.some(function(tempCard) {
            return tempCard.id === card.id;
        });
        
        if (alreadySelected) {
            wx.showToast({ 
                title: '不能重复选择同一张牌', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 检查牌的数量是否超过4张
        var cardCount = this.countCardInAll(card.id);
        if (cardCount >= 4) {
            wx.showToast({ 
                title: card.name + '最多只能有4张', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 添加到临时吃牌区
        var newTempChiCards = tempChiCards.concat([card]);
        this.setData({ 
            tempChiCards: newTempChiCards,  // 更新临时吃牌区
            showResult: false               // 隐藏结果
        });
        
        // 如果选择了3张牌，尝试完成吃牌
        if (newTempChiCards.length === 3) {
            this.completeChi();
        }
    },

    /**
     * 完成吃牌操作
     */
    completeChi: function() {
        var tempChiCards = this.data.tempChiCards;  // 临时吃牌区
        var handCards = this.data.handCards;        // 当前手牌
        var actionGroups = this.data.actionGroups;  // 操作组
        
        // 验证吃牌是否有效（同花色连续数字）
        if (!this.validateChi(tempChiCards)) {
            wx.showToast({ 
                title: '吃牌必须为同花色连续数字', 
                icon: 'none',
                duration: 2000
            });
            this.rollbackChi();  // 回退吃牌
            return;
        }
        
        // 检查总牌数是否超过14张
        var totalCards = handCards.length + tempChiCards.length;
        if (totalCards > 14) {
            wx.showToast({ 
                title: '总牌数不能超过14张', 
                icon: 'none',
                duration: 2000
            });
            this.rollbackChi();  // 回退吃牌
            return;
        }
        
        // 创建新的吃牌组
        var newGroup = {
            type: '吃',          // 操作类型：吃
            cards: tempChiCards.slice()  // 复制临时吃牌区的牌
        };
        
        // 更新操作组和手牌
        var newActionGroups = actionGroups.concat([newGroup]);
        var newHandCards = handCards.concat(tempChiCards);
        
        this.setData({ 
            actionGroups: newActionGroups,  // 更新操作组
            handCards: newHandCards,        // 更新手牌
            tempChiCards: [],               // 清空临时吃牌区
            showResult: false               // 隐藏结果
        });
        
        // 提示吃牌成功
        wx.showToast({ 
            title: '吃牌成功', 
            icon: 'success',
            duration: 1000
        });
    },

    /**
     * 验证吃牌是否有效
     * @param {Array} cards - 要验证的牌组
     * @return {boolean} 是否有效
     */
    validateChi: function(cards) {
        // 吃牌必须是3张牌
        if (cards.length !== 3) return false;
        
        // 获取所有牌的类型
        var types = cards.map(function(card) { return card.type; });
        // 去重后类型数量应为1（同花色）
        var uniqueTypes = [...new Set(types)];
        // 检查是否同花色且不是字牌
        if (uniqueTypes.length !== 1 || uniqueTypes[0] === '字') {
            return false;
        }
        
        // 获取所有牌的面值并排序
        var values = cards.map(function(card) { return card.value; }).sort(function(a, b) { return a - b; });
        // 检查是否连续（如1,2,3）
        return (values[1] === values[0] + 1) && (values[2] === values[1] + 1);
    },

    /**
     * 回退吃牌操作
     */
    rollbackChi: function() {
        this.setData({ 
            tempChiCards: []  // 清空临时吃牌区
        });
    },

    /**
     * 添加牌到碰或杠操作
     * @param {Object} card - 要添加的牌对象
     * @param {string} mode - 操作模式（peng/minggang/angang）
     */
    addToPengOrGang: function(card, mode) {
        var handCards = this.data.handCards;      // 当前手牌
        var actionGroups = this.data.actionGroups;  // 操作组
        
        var cardCount = 3;      // 默认3张（碰）
        var actionType = '碰';  // 默认操作类型：碰
        
        // 根据模式调整参数
        if (mode === 'minggang' || mode === 'angang') {
            cardCount = 4;  // 杠需要4张
            actionType = mode === 'minggang' ? '明杠' : '暗杠';  // 明杠或暗杠
        }
        
        // 检查牌的数量是否足够
        var currentCardCount = this.countCardInAll(card.id);
        if (currentCardCount + cardCount > 4) {
            wx.showToast({ 
                title: card.name + '最多只能有4张，当前已有' + currentCardCount + '张', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 检查总牌数是否超过14张
        var totalCards = handCards.length + cardCount;
        if (totalCards > 14) {
            wx.showToast({ 
                title: '总牌数不能超过14张', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        // 创建操作牌组
        var operationCards = [];
        for (var i = 0; i < cardCount; i++) {
            operationCards.push(card);  // 添加指定数量的牌
        }
        
        // 创建新的操作组
        var newGroup = {
            type: actionType,      // 操作类型
            cards: operationCards  // 操作牌组
        };
        
        // 更新操作组和手牌
        var newActionGroups = actionGroups.concat([newGroup]);
        var newHandCards = handCards.concat(operationCards);
        
        this.setData({ 
            actionGroups: newActionGroups,  // 更新操作组
            handCards: newHandCards,        // 更新手牌
            showResult: false               // 隐藏结果
        });
        
        // 提示操作成功
        wx.showToast({ 
            title: actionType + '成功', 
            icon: 'success',
            duration: 1000
        });
    },

    /**
     * 移除手牌
     * @param {Object} e - 事件对象
     */
    removeCard: function(e) {
        try {
            var index = e.currentTarget.dataset.index;  // 获取要移除的牌索引
            var handCards = this.data.handCards;        // 当前手牌
            
            // 检查索引有效性
            if (index >= 0 && index < handCards.length) {
                var newHandCards = handCards.slice();  // 复制手牌数组
                newHandCards.splice(index, 1);         // 移除指定牌
                
                this.setData({ 
                    handCards: newHandCards,  // 更新手牌
                    showResult: false         // 隐藏结果
                });
            }
        } catch (error) {
            // 错误处理（静默）
        }
    },

    /**
     * 移除操作组
     * @param {Object} e - 事件对象
     */
    removeActionGroup: function(e) {
        try {
            var index = e.currentTarget.dataset.index;  // 获取要移除的操作组索引
            var actionGroups = this.data.actionGroups;  // 操作组
            var handCards = this.data.handCards;        // 手牌
            
            // 检查索引有效性
            if (index >= 0 && index < actionGroups.length) {
                var removedGroup = actionGroups[index];  // 获取要移除的操作组
                var newActionGroups = actionGroups.slice();  // 复制操作组数组
                
                // 获取要移除的牌
                var cardsToRemove = removedGroup.cards;
                // 从手牌中过滤掉这些牌
                var newHandCards = handCards.filter(function(handCard) {
                    return !cardsToRemove.some(function(removeCard) {
                        return removeCard.id === handCard.id;
                    });
                });
                
                newActionGroups.splice(index, 1);  // 移除操作组
                
                this.setData({ 
                    actionGroups: newActionGroups,  // 更新操作组
                    handCards: newHandCards,        // 更新手牌
                    showResult: false               // 隐藏结果
                });
            }
        } catch (error) {
            // 错误处理（静默）
        }
    },

    /**
     * 切换操作模式
     * @param {Object} e - 事件对象
     */
    changeMode: function(e) {
        var newMode = e.currentTarget.dataset.mode;  // 新操作模式
        var currentMode = this.data.currentMode;      // 当前操作模式
        
        // 如果从吃牌模式切换到其他模式，清空临时吃牌区
        if (currentMode === 'chi' && newMode !== 'chi') {
            this.rollbackChi();
        }
        
        this.setData({ 
            currentMode: newMode  // 更新操作模式
        });
    },

    /**
     * 切换特殊规则
     * @param {Object} e - 事件对象
     */
    toggleRule: function(e) {
        var ruleValue = e.currentTarget.dataset.rule;  // 规则值
        var checked = e.detail.value;                  // 是否选中
        var specialRules = this.data.specialRules;    // 特殊规则列表
        
        // 更新规则选中状态
        var newRules = specialRules.map(function(rule) {
            return rule.value === ruleValue ? { 
                name: rule.name, 
                value: rule.value, 
                checked: checked 
            } : rule;
        });
        
        this.setData({ 
            specialRules: newRules,  // 更新特殊规则
            showResult: false         // 隐藏结果
        });
    },

    /**
     * 改变圈风
     * @param {Object} e - 事件对象
     */
    changeRoundWind: function(e) {
        var index = parseInt(e.detail.value);  // 新圈风索引
        this.setData({ 
            roundWind: index,    // 更新圈风
            showResult: false   // 隐藏结果
        });
    },

    /**
     * 改变风位
     * @param {Object} e - 事件对象
     */
    changeSeatWind: function(e) {
        var index = parseInt(e.detail.value);  // 新风位索引
        this.setData({ 
            seatWind: index,     // 更新风位
            showResult: false   // 隐藏结果
        });
    },

    /**
     * 计算胡牌番数
     */
    calculate: function() {
        try {
            var handCards = this.data.handCards;        // 手牌
            var actionGroups = this.data.actionGroups;  // 操作组
            var specialRules = this.data.specialRules;  // 特殊规则

            var totalCards = handCards.length;  // 手牌数量
            // 检查是否有牌
            if (totalCards === 0) {
                wx.showToast({ 
                    title: '请先选择麻将牌', 
                    icon: 'none',
                    duration: 2000
                });
                return;
            }

            // 检查手牌数量是否为14张（胡牌标准）
            if (totalCards !== 14) {
                wx.showToast({ 
                    title: '牌数必须为14张，当前' + totalCards + '张', 
                    icon: 'none',
                    duration: 2000
                });
                return;
            }

            // 检查是否可以胡牌
            var canHu = this.checkHuPai(handCards, actionGroups);
            var totalFan = 0;      // 总番数
            var fanList = [];      // 番种列表

            if (canHu) {
                // 处理特殊规则加成
                var activeRules = specialRules.filter(function(rule) {
                    return rule.checked;  // 筛选选中的规则
                });
                // 为每个激活的规则添加1番
                activeRules.forEach(function(rule) {
                    fanList.push({ name: rule.name, fan: 1 });
                    totalFan += 1;
                });

                // 按番数从高到低检测番种
                // 88番种检测
                if (this.checkDaSiXi(handCards, actionGroups)) {
                    fanList.push({ name: '大四喜', fan: 88 });
                    totalFan += 88;
                } else if (this.checkDaSanYuan(handCards, actionGroups)) {
                    fanList.push({ name: '大三元', fan: 88 });
                    totalFan += 88;
                } else if (this.checkLvYiSe(handCards, actionGroups)) {
                    fanList.push({ name: '绿一色', fan: 88 });
                    totalFan += 88;
                } else if (this.checkJiuLianBaoDeng(handCards, actionGroups)) {
                    fanList.push({ name: '九莲宝灯', fan: 88 });
                    totalFan += 88;
                } else if (this.checkSiGang(handCards, actionGroups)) {
                    fanList.push({ name: '四杠', fan: 88 });
                    totalFan += 88;
                } else if (this.checkLianQiDui(handCards, actionGroups)) {
                    fanList.push({ name: '连七对', fan: 88 });
                    totalFan += 88;
                } else if (this.checkShiSanYao(handCards, actionGroups)) {
                    fanList.push({ name: '十三幺', fan: 88 });
                    totalFan += 88;
                }
                // 64番种检测
                else if (this.checkQingYaoJiu(handCards, actionGroups)) {
                    fanList.push({ name: '清幺九', fan: 64 });
                    totalFan += 64;
                } else if (this.checkXiaoSanYuan(handCards, actionGroups)) {
                    fanList.push({ name: '小三元', fan: 64 });
                    totalFan += 64;
                } else if (this.checkZiYiSe(handCards, actionGroups)) {
                    fanList.push({ name: '字一色', fan: 64 });
                    totalFan += 64;
                } else if (this.checkSiAnKe(handCards, actionGroups)) {
                    fanList.push({ name: '四暗刻', fan: 64 });
                    totalFan += 64;
                } else if (this.checkYiSeShuangLongHui(handCards, actionGroups)) {
                    fanList.push({ name: '一色双龙会', fan: 64 });
                    totalFan += 64;
                }
                // 48番种检测
                else if (this.checkYiSeSiJieGao(handCards, actionGroups)) {
                    fanList.push({ name: '一色四节高', fan: 48 });
                    totalFan += 48;
                } else if (this.checkYiSeSiTongShun(handCards, actionGroups)) {
                    fanList.push({ name: '一色四同顺', fan: 48 });
                    totalFan += 48;
                }
                // 32番种检测
                else if (this.checkYiSeSanJieGao(handCards, actionGroups)) {
                    fanList.push({ name: '一色三节高', fan: 32 });
                    totalFan += 32;
                } else if (this.checkQingYiSe(handCards, actionGroups)) {
                    fanList.push({ name: '清一色', fan: 32 });
                    totalFan += 32;
                } else if (this.checkYiSeSanTongShun(handCards, actionGroups)) {
                    fanList.push({ name: '一色三同顺', fan: 32 });
                    totalFan += 32;
                }
                // 24番种检测
                else if (this.checkQiDui(handCards, actionGroups)) {
                    fanList.push({ name: '七对', fan: 24 });
                    totalFan += 24;
                } else if (this.checkQingLong(handCards, actionGroups)) {
                    fanList.push({ name: '清龙', fan: 24 });
                    totalFan += 24;
                } else if (this.checkSanSeShuangLongHui(handCards, actionGroups)) {
                    fanList.push({ name: '三色双龙会', fan: 24 });
                    totalFan += 24;
                } else if (this.checkYiSeSanBuGao(handCards, actionGroups)) {
                    fanList.push({ name: '一色三步高', fan: 24 });
                    totalFan += 24;
                } else if (this.checkQuanDaiYao(handCards, actionGroups)) {
                    fanList.push({ name: '全带幺', fan: 24 });
                    totalFan += 24;
                } else if (this.checkSanAnKe(handCards, actionGroups)) {
                    fanList.push({ name: '三暗刻', fan: 24 });
                    totalFan += 24;
                } else if (this.checkSanGang(handCards, actionGroups)) {
                    fanList.push({ name: '三杠', fan: 24 });
                    totalFan += 24;
                }
                // 16番种检测
                else if (this.checkYiSeSanBuGao2(handCards, actionGroups)) {
                    fanList.push({ name: '一色三步高2', fan: 16 });
                    totalFan += 16;
                } else if (this.checkTianTing(handCards, actionGroups)) {
                    fanList.push({ name: '天听', fan: 16 });
                    totalFan += 16;
                } else if (this.checkDiTing(handCards, actionGroups)) {
                    fanList.push({ name: '地听', fan: 16 });
                    totalFan += 16;
                } else if (this.checkRenHu(handCards, actionGroups)) {
                    fanList.push({ name: '人和', fan: 16 });
                    totalFan += 16;
                } else if (this.checkSanFengKe(handCards, actionGroups)) {
                    fanList.push({ name: '三风刻', fan: 16 });
                    totalFan += 16;
                }
                // 12番种检测
                else if (this.checkQuanBuKao(handCards, actionGroups)) {
                    fanList.push({ name: '全不靠', fan: 12 });
                    totalFan += 12;
                } else if (this.checkZuHeLong(handCards, actionGroups)) {
                    fanList.push({ name: '组合龙', fan: 12 });
                    totalFan += 12;
                } else if (this.checkDaYuWu(handCards, actionGroups)) {
                    fanList.push({ name: '大于五', fan: 12 });
                    totalFan += 12;
                } else if (this.checkXiaoYuWu(handCards, actionGroups)) {
                    fanList.push({ name: '小于五', fan: 12 });
                    totalFan += 12;
                } else if (this.checkSanYuanPai(handCards, actionGroups)) {
                    fanList.push({ name: '三元牌', fan: 12 });
                    totalFan += 12;
                }
                // 8番种检测
                else if (this.checkHunYiSe(handCards, actionGroups)) {
                    fanList.push({ name: '混一色', fan: 8 });
                    totalFan += 8;
                } else if (this.checkPengPengHu(handCards, actionGroups)) {
                    fanList.push({ name: '碰碰和', fan: 8 });
                    totalFan += 8;
                } else if (this.checkHunYaoJiu(handCards, actionGroups)) {
                    fanList.push({ name: '混幺九', fan: 8 });
                    totalFan += 8;
                } else if (this.checkSanSeSanTongShun(handCards, actionGroups)) {
                    fanList.push({ name: '三色三同顺', fan: 8 });
                    totalFan += 8;
                } else if (this.checkSanSeSanJieGao(handCards, actionGroups)) {
                    fanList.push({ name: '三色三节高', fan: 8 });
                    totalFan += 8;
                } else if (this.checkWuMenQi(handCards, actionGroups)) {
                    fanList.push({ name: '无门清', fan: 8 });
                    totalFan += 8;
                } else if (this.checkShuangAnKe(handCards, actionGroups)) {
                    fanList.push({ name: '双暗刻', fan: 8 });
                    totalFan += 8;
                } else if (this.checkShuangJianKe(handCards, actionGroups)) {
                    fanList.push({ name: '双箭刻', fan: 8 });
                    totalFan += 8;
                }
                // 6番种检测
                else if (this.checkQuanQiuRen(handCards, actionGroups)) {
                    fanList.push({ name: '全求人', fan: 6 });
                    totalFan += 6;
                } else if (this.checkShuangMingGang(handCards, actionGroups)) {
                    fanList.push({ name: '双明杠', fan: 6 });
                    totalFan += 6;
                } else if (this.checkHunYiSe2(handCards, actionGroups)) {
                    fanList.push({ name: '混一色2', fan: 6 });
                    totalFan += 6;
                } else if (this.checkJueZhang(handCards, actionGroups)) {
                    fanList.push({ name: '绝张', fan: 6 });
                    totalFan += 6;
                } else if (this.checkQiangGangHu(handCards, actionGroups)) {
                    fanList.push({ name: '抢杠和', fan: 6 });
                    totalFan += 6;
                } else if (this.checkPengPengHu2(handCards, actionGroups)) {
                    fanList.push({ name: '碰碰和2', fan: 6 });
                    totalFan += 6;
                }
                // 4番种检测
                else if (this.checkMenQianQing(handCards, actionGroups)) {
                    fanList.push({ name: '门前清', fan: 4 });
                    totalFan += 4;
                } else if (this.checkPingHu(handCards, actionGroups)) {
                    fanList.push({ name: '平和', fan: 4 });
                    totalFan += 4;
                } else if (this.checkSiGuiYi(handCards, actionGroups)) {
                    fanList.push({ name: '四归一', fan: 4 });
                    totalFan += 4;
                } else if (this.checkShuangTongKe(handCards, actionGroups)) {
                    fanList.push({ name: '双同刻', fan: 4 });
                    totalFan += 4;
                }
                // 2番种检测
                else if (this.checkLianLiu(handCards, actionGroups)) {
                    fanList.push({ name: '连六', fan: 2 });
                    totalFan += 2;
                } else if (this.checkLaoShaoFu(handCards, actionGroups)) {
                    fanList.push({ name: '老少副', fan: 2 });
                    totalFan += 2;
                } else if (this.checkYaoJiuKe(handCards, actionGroups) > 0) {
                    var yaoJiuKeCount = this.countYaoJiuKe(handCards, actionGroups);
                    fanList.push({ name: '幺九刻', fan: yaoJiuKeCount });
                    totalFan += yaoJiuKeCount;
                } else if (this.checkMingGang(handCards, actionGroups)) {
                    fanList.push({ name: '明杠', fan: 2 });
                    totalFan += 2;
                } else if (this.checkBianZhang(handCards, actionGroups)) {
                    fanList.push({ name: '边张', fan: 2 });
                    totalFan += 2;
                } else if (this.checkKanZhang(handCards, actionGroups)) {
                    fanList.push({ name: '坎张', fan: 2 });
                    totalFan += 2;
                } else if (this.checkDanDiaoJiang(handCards, actionGroups)) {
                    fanList.push({ name: '单钓将', fan: 2 });
                    totalFan += 2;
                } else if (this.checkZiMo(handCards, actionGroups)) {
                    fanList.push({ name: '自摸', fan: 2 });
                    totalFan += 2;
                } else if (this.checkJianKe(handCards, actionGroups)) {
                    fanList.push({ name: '箭刻', fan: 2 });
                    totalFan += 2;
                } else if (this.checkQuanFengKe(handCards, actionGroups)) {
                    fanList.push({ name: '圈风刻', fan: 2 });
                    totalFan += 2;
                } else if (this.checkMenFengKe(handCards, actionGroups)) {
                    fanList.push({ name: '门风刻', fan: 2 });
                    totalFan += 2;
                }
                // 1番种检测
                else if (this.checkWuZi(handCards, actionGroups)) {
                    fanList.push({ name: '无字', fan: 1 });
                    totalFan += 1;
                } else if (this.checkBianZhang2(handCards, actionGroups)) {
                    fanList.push({ name: '边张2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkKanZhang2(handCards, actionGroups)) {
                    fanList.push({ name: '坎张2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkDanDiaoJiang2(handCards, actionGroups)) {
                    fanList.push({ name: '单钓将2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkZiMo2(handCards, actionGroups)) {
                    fanList.push({ name: '自摸2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkJianKe2(handCards, actionGroups)) {
                    fanList.push({ name: '箭刻2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkQuanFengKe2(handCards, actionGroups)) {
                    fanList.push({ name: '圈风刻2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkMenFengKe2(handCards, actionGroups)) {
                    fanList.push({ name: '门风刻2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkSiGuiYi2(handCards, actionGroups)) {
                    fanList.push({ name: '四归一2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkShuangTongKe2(handCards, actionGroups)) {
                    fanList.push({ name: '双同刻2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkShuangAnKe2(handCards, actionGroups)) {
                    fanList.push({ name: '双暗刻2', fan: 1 });
                    totalFan += 1;
                } else if (this.checkAnGang(handCards, actionGroups)) {
                    fanList.push({ name: '暗杠', fan: 1 });
                    totalFan += 1;
                } else if (this.checkDuanYao(handCards, actionGroups)) {
                    fanList.push({ name: '断幺', fan: 1 });
                    totalFan += 1;
                }
                // 如果没有检测到任何番种，添加基本胡牌8番
                if (fanList.length === 0) {
                    fanList.push({ name: '基本胡牌', fan: 8 });
                    totalFan += 8;
                }
            }

            // 构造结果对象
            var result = {
                canHu: canHu,        // 是否可以胡牌
                totalFan: totalFan,  // 总番数
                fanList: fanList     // 番种列表
            };

            // 显示结果
            this.setData({
                showResult: true,  // 显示结果
                result: result     // 设置结果
            });
            
        } catch (error) {
            // 错误处理
            wx.showToast({
                title: '计算出错，请重试',
                icon: 'none'
            });
        }
    },

    /**
     * 检查是否可以胡牌
     * @param {Array} handCards - 手牌数组
     * @param {Array} actionGroups - 操作组数组
     * @return {boolean} 是否可以胡牌
     */
    checkHuPai: function(handCards, actionGroups) {
        var totalCards = handCards.length;  // 手牌数量
        // 胡牌必须14张牌
        if (totalCards !== 14) {
            return false;
        }
        
        // 检查七对胡牌
        if (this.checkQiDui(handCards, actionGroups)) {
            return true;
        }
        
        // 检查普通胡牌
        return this.checkNormalHu(handCards, actionGroups);
    },

    /**
     * 检查普通胡牌（非七对）
     * @param {Array} handCards - 手牌数组
     * @param {Array} actionGroups - 操作组数组
     * @return {boolean} 是否符合普通胡牌条件
     */
    checkNormalHu: function(handCards, actionGroups) {
        // 合并手牌和操作组的牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        // 统计每张牌的数量
        var cardCount = {};
        allCards.forEach(function(card) {
            var key = card.id;
            cardCount[key] = (cardCount[key] || 0) + 1;
        });
        
        // 验证所有操作组的有效性
        if (actionGroups && Array.isArray(actionGroups)) {
            for (var i = 0; i < actionGroups.length; i++) {
                var group = actionGroups[i];
                if (!this.validateActionGroup(group)) {
                    return false;
                }
            }
        }
        
        // 检查是否有将牌（一对相同的牌）
        var hasJiang = false;
        for (var cardId in cardCount) {
            if (cardCount[cardId] >= 2) {
                hasJiang = true;
                break;
            }
        }
        
        // 没有将牌则不能胡牌
        if (!hasJiang) {
            return false;
        }
        
        // 检查全碰/杠情况（全求人）
        if (actionGroups && actionGroups.length > 0) {
            var allValidGroups = actionGroups.every(function(group) {
                return group.type === '碰' || group.type === '明杠' || group.type === '暗杠';
            });
            
            if (allValidGroups) {
                // 获取手牌的唯一牌ID
                var handCardIds = handCards.map(function(card) { return card.id; });
                var uniqueHandCards = [...new Set(handCardIds)];
                
                // 如果手牌只有一对且总共14张牌，则是全求人
                if (uniqueHandCards.length === 1 && handCards.length === 2) {
                    return true;
                }
            }
        }
        
        // 检查七对（再次检查）
        if (this.checkQiDui(handCards, actionGroups)) {
            return true;
        }
        
        // 默认返回true（简化处理）
        return true;
    },

    /**
     * 验证操作组的有效性
     * @param {Object} group - 操作组对象
     * @return {boolean} 是否有效
     */
    validateActionGroup: function(group) {
        var cards = group.cards;  // 操作组中的牌
        if (!cards || cards.length === 0) return false;  // 空组无效
        
        // 根据操作类型验证
        switch(group.type) {
            case '吃':
                return this.validateChi(cards);  // 验证吃牌
            case '碰':
                return cards.length === 3 && this.allSameCard(cards);  // 碰牌需3张相同
            case '明杠':
            case '暗杠':
                return cards.length === 4 && this.allSameCard(cards);  // 杠需4张相同
            default:
                return false;  // 未知类型无效
        }
    },

    /**
     * 检查一组牌是否完全相同
     * @param {Array} cards - 牌组
     * @return {boolean} 是否全部相同
     */
    allSameCard: function(cards) {
        if (cards.length === 0) return false;  // 空组无效
        var firstCardId = cards[0].id;  // 第一张牌的ID
        // 检查所有牌是否与第一张相同
        return cards.every(function(card) {
            return card.id === firstCardId;
        });
    },

    /**
     * 检查七对胡牌
     * @param {Array} handCards - 手牌数组
     * @param {Array} actionGroups - 操作组数组
     * @return {boolean} 是否符合七对条件
     */
    checkQiDui: function(handCards, actionGroups) {
        // 如果有操作组则不符合七对
        if (actionGroups && actionGroups.length > 0) {
            return false;
        }
        
        // 手牌必须14张
        if (!handCards || handCards.length !== 14) return false;
        
        // 统计每张牌的数量
        var cardCount = {};
        handCards.forEach(function(card) {
            var key = card.id;
            cardCount[key] = (cardCount[key] || 0) + 1;
        });
        
        // 检查是否都是对子（每张牌恰好2张）
        var pairs = Object.keys(cardCount).every(function(key) {
            return cardCount[key] === 2;
        });
        
        // 必须有7种不同的牌（7对）
        return pairs && Object.keys(cardCount).length === 7;
    },

    // 以下是番种检测函数（部分实现）
    
    /**
     * 检测大四喜（88番）
     * 由四个风刻（杠）组成的胡牌
     */
    checkDaSiXi: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        // 风牌列表
        var winds = ['东', '南', '西', '北'];
        var windCount = {};  // 风牌计数
        
        // 初始化计数
        winds.forEach(function(wind) {
            windCount[wind] = 0;
        });
        
        // 统计风牌数量
        allCards.forEach(function(card) {
            if (winds.indexOf(card.value) !== -1) {
                windCount[card.value]++;
            }
        });
        
        // 检查每种风牌是否至少3张（刻子）
        return winds.every(function(wind) {
            return windCount[wind] >= 3;
        });
    },

    /**
     * 检测大三元（88番）
     * 由中发白三个箭刻组成的胡牌
     */
    checkDaSanYuan: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        // 箭牌列表
        var dragons = ['中', '发', '白'];
        var dragonCount = {};  // 箭牌计数
        
        // 初始化计数
        dragons.forEach(function(dragon) {
            dragonCount[dragon] = 0;
        });
        
        // 统计箭牌数量
        allCards.forEach(function(card) {
            if (dragons.indexOf(card.value) !== -1) {
                dragonCount[card.value]++;
            }
        });
        
        // 检查每种箭牌是否至少3张（刻子）
        return dragons.every(function(dragon) {
            return dragonCount[dragon] >= 3;
        });
    },

    /**
     * 检测绿一色（88番）
     * 由23468条及发字组成的胡牌
     */
    checkLvYiSe: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        if (allCards.length === 0) return false;  // 无牌无效
        
        // 绿牌列表
        var greenCards = ['2条', '3条', '4条', '6条', '8条', '发'];
        // 检查所有牌是否都是绿牌
        return allCards.every(function(card) {
            return greenCards.indexOf(card.name) !== -1;
        });
    },

    /**
     * 检测九莲宝灯（88番）
     * 同种花色1112345678999加任意一张同花色牌
     */
    checkJiuLianBaoDeng: function(handCards, actionGroups) {
        // 九莲宝灯不能有操作组
        if (actionGroups && actionGroups.length > 0) return false;
        // 手牌必须14张
        if (!handCards || handCards.length !== 14) return false;
        
        // 获取所有牌的类型
        var types = handCards.map(function(card) { return card.type; });
        // 去重后类型数量应为1（同花色）
        var uniqueTypes = [...new Set(types)];
        // 检查是否同花色且不是字牌
        if (uniqueTypes.length !== 1 || uniqueTypes[0] === '字') return false;
        
        // 获取所有牌的面值并排序
        var values = handCards.map(function(card) { return card.value; }).sort(function(a, b) { return a - b; });
        // 检查是否符合九莲宝灯牌型（简化版）
        return values.length === 14;
    },

    /**
     * 检测四杠（88番）
     * 有四个杠的胡牌
     */
    checkSiGang: function(handCards, actionGroups) {
        if (!actionGroups) return false;  // 无操作组无效
        var gangCount = 0;  // 杠计数
        // 遍历操作组
        actionGroups.forEach(function(group) {
            // 统计明杠和暗杠
            if (group.type === '明杠' || group.type === '暗杠') {
                gangCount++;
            }
        });
        return gangCount === 4;  // 必须有4个杠
    },

    /**
     * 检测连七对（88番）
     * 同种花色序数牌组成序数相连的7个对子
     */
    checkLianQiDui: function(handCards, actionGroups) {
        // 连七对不能有操作组
        if (actionGroups && actionGroups.length > 0) return false;
        // 手牌必须14张
        if (!handCards || handCards.length !== 14) return false;
        
        // 统计每张牌的数量
        var cardCount = {};
        handCards.forEach(function(card) {
            var key = card.id;
            cardCount[key] = (cardCount[key] || 0) + 1;
        });
        
        // 检查是否都是对子
        var pairs = Object.keys(cardCount).every(function(key) {
            return cardCount[key] === 2;
        });
        // 必须有7种不同的牌
        if (!pairs || Object.keys(cardCount).length !== 7) return false;
        
        // 获取所有牌的面值并排序
        var values = Object.keys(cardCount).map(function(key) {
            return parseInt(key.charAt(0));  // 提取面值
        }).sort(function(a, b) { return a - b; });
        
        // 检查是否连续（如1,2,3,4,5,6,7）
        for (var i = 1; i < values.length; i++) {
            if (values[i] !== values[i-1] + 1) {
                return false;
            }
        }
        
        return true;
    },

    /**
     * 检测十三幺（88番）
     * 由13种幺九牌各1张加其中1张组成的胡牌
     */
    checkShiSanYao: function(handCards, actionGroups) {
        // 十三幺不能有操作组
        if (actionGroups && actionGroups.length > 0) return false;
        // 手牌必须14张
        if (!handCards || handCards.length !== 14) return false;
        
        // 幺九牌列表
        var yaoCards = ['1万', '9万', '1条', '9条', '1筒', '9筒', '东', '南', '西', '北', '中', '发', '白'];
        // 获取手牌名称列表
        var cardNames = handCards.map(function(card) { return card.name; });
        
        // 检查是否包含所有幺九牌
        var yaoCount = 0;
        yaoCards.forEach(function(yao) {
            if (cardNames.filter(function(name) { return name === yao; }).length >= 1) {
                yaoCount++;
            }
        });
        
        return yaoCount >= 13;  // 至少包含13种幺九牌
    },

    /**
     * 检测清幺九（64番）
     * 由序数牌一、九刻子组成的胡牌
     */
    checkQingYaoJiu: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        if (allCards.length === 0) return false;  // 无牌无效
        
        // 幺九牌列表（不含字牌）
        var yaoJiuCards = ['1万', '9万', '1条', '9条', '1筒', '9筒'];
        // 检查所有牌是否都是幺九牌
        return allCards.every(function(card) {
            return yaoJiuCards.indexOf(card.name) !== -1;
        });
    },

    /**
     * 检测小三元（64番）
     * 有箭牌的两副刻子和一副将牌
     */
    checkXiaoSanYuan: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        // 箭牌列表
        var dragons = ['中', '发', '白'];
        var dragonCount = {};  // 箭牌计数
        
        // 初始化计数
        dragons.forEach(function(dragon) {
            dragonCount[dragon] = 0;
        });
        
        // 统计箭牌数量
        allCards.forEach(function(card) {
            if (dragons.indexOf(card.value) !== -1) {
                dragonCount[card.value]++;
            }
        });
        
        var keziCount = 0;  // 刻子计数
        var jiangCount = 0; // 将牌计数
        
        // 检查每种箭牌
        dragons.forEach(function(dragon) 
        {
            if (dragonCount[dragon] >= 3) keziCount++;  // 刻子
            if (dragonCount[dragon] === 2) jiangCount++; // 将牌
        });
        
        return keziCount >= 2 && jiangCount >= 1;  // 至少两个刻子和一个将牌
    },

    /**
     * 检测字一色（64番）
     * 由字牌的刻子（杠）、将牌组成的胡牌
     */
    checkZiYiSe: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        if (allCards.length === 0) return false;  // 无牌无效
        
        // 检查所有牌是否都是字牌
        return allCards.every(function(card) {
            return card.type === '字';
        });
    },

    /**
     * 检测四暗刻（64番）
     * 有四个暗刻（暗杠）的胡牌
     */
    checkSiAnKe: function(handCards, actionGroups) {
        if (!actionGroups) return false;  // 无操作组无效
        var anKeCount = 0;  // 暗刻计数
        // 遍历操作组
        actionGroups.forEach(function(group) {
            // 统计暗杠（暗刻）
            if (group.type === '暗杠') 
            {
                anKeCount++;
            }
        });
        return anKeCount === 4;  // 必须有4个暗刻
    },

    /**
     * 检测一色四节高（48番）
     * 一种花色4副依次递增一位数的刻子
     */
    checkYiSeSiJieGao: function(handCards, actionGroups) {
        if (!actionGroups || actionGroups.length < 4) return false;  // 操作组不足4个
        
        // 筛选碰和杠操作组
        var pengGangGroups = actionGroups.filter(function(group) {
            return group.type === '碰' || group.type === '明杠' || group.type === '暗杠';
        });
        
        if (pengGangGroups.length < 4) return false;  // 碰杠组不足4个
        
        var firstCard = pengGangGroups[0].cards[0];  // 第一张牌
        // 检查是否同花色
        var sameSuit = pengGangGroups.every(function(group) {
            return group.cards[0].type === firstCard.type;
        });
        
        if (!sameSuit) return false;  // 不同花色
        
        // 获取所有牌的面值并排序
        var values = pengGangGroups.map(function(group) {
            return group.cards[0].value;
        }).sort(function(a, b) { return a - b; });
        
        // 检查是否依次递增1
        for (var i = 1; i < values.length; i++) {
            if (values[i] !== values[i-1] + 1) {
                return false;
            }
        }
        
        return true;
    },

    /**
     * 检测一色四同顺（48番）
     * 一种花色4副相同的顺子
     */
    checkYiSeSiTongShun: function(handCards, actionGroups) {
        if (!actionGroups || actionGroups.length < 4) return false;  // 操作组不足4个
        
        // 筛选吃操作组
        var chiGroups = actionGroups.filter(function(group) {
            return group.type === '吃';
        });
        
        if (chiGroups.length < 4) return false;  // 吃组不足4个
        
        var firstCard = chiGroups[0].cards[0];  // 第一张牌
        // 检查是否同花色
        var sameSuit = chiGroups.every(function(group) {
            return group.cards[0].type === firstCard.type;
        });
        
        if (!sameSuit) return false;  // 不同花色
        
        // 获取所有顺子的起始值
        var startValues = chiGroups.map(function(group) {
            var values = group.cards.map(function(card) { return card.value; }).sort(function(a, b) { return a - b; });
            return values[0];  // 取最小面值作为起始值
        });
        
        var firstStart = startValues[0];  // 第一个起始值
        // 检查所有起始值是否相同
        return startValues.every(function(value) {
            return value === firstStart;
        });
    },

    /**
     * 检测一色三节高（32番）
     * 一种花色3副依次递增一位数的刻子
     */
    checkYiSeSanJieGao: function(handCards, actionGroups) {
        if (!actionGroups || actionGroups.length < 3) return false;  // 操作组不足3个
        
        // 筛选碰和杠操作组
        var pengGangGroups = actionGroups.filter(function(group) {
            return group.type === '碰' || group.type === '明杠' || group.type === '暗杠';
        });
        
        if (pengGangGroups.length < 3) return false;  // 碰杠组不足3个
        
        var firstCard = pengGangGroups[0].cards[0];  // 第一张牌
        // 检查是否同花色
        var sameSuit = pengGangGroups.every(function(group) {
            return group.cards[0].type === firstCard.type;
        });
        
        if (!sameSuit) return false;  // 不同花色
        
        // 获取所有牌的面值并排序
        var values = pengGangGroups.map(function(group) {
            return group.cards[0].value;
        }).sort(function(a, b) { return a - b; });
        
        // 检查是否依次递增1
        for (var i = 1; i < values.length; i++) {
            if (values[i] !== values[i-1] + 1) {
                return false;
            }
        }
        
        return true;
    },

    /**
     * 检测清一色（32番）
     * 由一种花色的序数牌组成的胡牌
     */
    checkQingYiSe: function(handCards, actionGroups) {
        if (!handCards) return false;  // 无手牌无效
        
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        if (allCards.length === 0) return false;  // 无牌无效
        
        // 获取所有牌的类型
        var types = [];
        allCards.forEach(function(card) {
            if (types.indexOf(card.type) === -1) {
                types.push(card.type);
            }
        });
        // 检查是否只有一种花色且不是字牌
        return types.length === 1 && types[0] !== '字';
    },

    /**
     * 检测一色三同顺（32番）
     * 一种花色3副相同的顺子
     */
    checkYiSeSanTongShun: function(handCards, actionGroups) {
        if (!actionGroups || actionGroups.length < 3) return false;  // 操作组不足3个
        
        // 筛选吃操作组
        var chiGroups = actionGroups.filter(function(group) {
            return group.type === '吃';
        });
        
        if (chiGroups.length < 3) return false;  // 吃组不足3个
        
        var firstCard = chiGroups[0].cards[0];  // 第一张牌
        // 检查是否同花色
        var sameSuit = chiGroups.every(function(group) {
            return group.cards[0].type === firstCard.type;
        });
        
        if (!sameSuit) return false;  // 不同花色
        
        // 获取所有顺子的起始值
        var startValues = chiGroups.map(function(group) {
            var values = group.cards.map(function(card) { return card.value; }).sort(function(a, b) { return a - b; });
            return values[0];  // 取最小面值作为起始值
        });
        
        var firstStart = startValues[0];  // 第一个起始值
        // 检查所有起始值是否相同
        return startValues.every(function(value) {
            return value === firstStart;
        });
    },

    /**
     * 检测七对（24番）
     * 7个对子组成胡牌
     */
    checkQiDui: function(handCards, actionGroups) {
        // 七对不能有操作组
        if (actionGroups && actionGroups.length > 0) return false;
        // 手牌必须14张
        if (!handCards || handCards.length !== 14) return false;
        
        // 统计每张牌的数量
        var cardCount = {};
        handCards.forEach(function(card) {
            var key = card.id;
            cardCount[key] = (cardCount[key] || 0) + 1;
        });
        
        // 检查是否都是对子（每张牌恰好2张）
        var pairs = Object.keys(cardCount).every(function(key) {
            return cardCount[key] === 2;
        });
        
        // 必须有7种不同的牌（7对）
        return pairs && Object.keys(cardCount).length === 7;
    },

    /**
     * 检测清龙（24番）
     * 一种花色1-9相连接的序数牌
     */
    checkQingLong: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        if (allCards.length === 0) return false;  // 无牌无效
        
        // 获取所有牌的类型
        var types = allCards.map(function(card) { return card.type; });
        // 去重后类型数量应为1（同花色）
        var uniqueTypes = [...new Set(types)];
        if (uniqueTypes.length !== 1 || uniqueTypes[0] === '字') return false;  // 必须同花色且非字牌
        
        // 获取所有牌的面值
        var values = allCards.map(function(card) { return card.value; });
        // 检查是否包含1-9所有面值
        var hasAll = true;
        for (var i = 1; i <= 9; i++) {
            if (values.indexOf(i) === -1) {
                hasAll = false;
                break;
            }
        }
        return hasAll;
    },

    /**
     * 检测碰碰和（8番）
     * 由4副刻子（或杠）、将牌组成的胡牌
     */
    checkPengPengHu: function(handCards, actionGroups) {
        if (!actionGroups || actionGroups.length !== 4) return false;  // 操作组必须4个
        
        // 检查所有操作组是否都是刻子或杠
        var allKeZi = actionGroups.every(function(group) {
            return group.type === '碰' || group.type === '明杠' || group.type === '暗杠';
        });
        
        if (!allKeZi) return false;  // 不全是刻子或杠
        
        // 手牌应只剩2张（将牌）
        if (handCards.length !== 2) return false;
        
        // 获取手牌的唯一牌ID
        var handCardIds = handCards.map(function(card) { return card.id; });
        var uniqueHandCards = [...new Set(handCardIds)];
        
        // 检查是否是一对将牌
        if (uniqueHandCards.length !== 1) return false;
        
        return true;
    },

    /**
     * 检测全求人（6番）
     * 全靠吃牌、碰牌、单钓别人打出的牌胡牌
     */
    checkQuanQiuRen: function(handCards, actionGroups) {
        if (!actionGroups || actionGroups.length !== 4) return false;  // 操作组必须4个
        
        // 手牌应只剩1张（单钓）
        if (handCards.length !== 1) return false;
        
        return true;
    },

    /**
     * 统计幺九刻数量
     * @param {Array} handCards - 手牌数组
     * @param {Array} actionGroups - 操作组数组
     * @return {number} 幺九刻数量
     */
    countYaoJiuKe: function(handCards, actionGroups) {
        // 幺九牌列表
        var yaoJiuCards = ['1万', '9万', '1条', '9条', '1筒', '9筒', '东', '南', '西', '北', '中', '发', '白'];
        
        var yaoJiuKeCount = 0;  // 幺九刻计数
        
        // 遍历操作组
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                // 检查是否是刻子或杠
                if (group.type === '碰' || group.type === '明杠' || group.type === '暗杠') {
                    var cardName = group.cards[0].name;  // 获取牌名
                    // 检查是否是幺九牌
                    if (yaoJiuCards.indexOf(cardName) !== -1) {
                        yaoJiuKeCount += 1;  // 计数加1
                    }
                }
            });
        }
        
        return yaoJiuKeCount;  // 返回总数
    },

    /**
     * 检测断幺（1番）
     * 胡牌中没有一、九及字牌
     */
    checkDuanYao: function(handCards, actionGroups) {
        // 合并所有牌
        var allCards = handCards.slice();
        if (actionGroups && Array.isArray(actionGroups)) {
            actionGroups.forEach(function(group) {
                allCards = allCards.concat(group.cards || []);
            });
        }
        
        if (allCards.length === 0) return false;  // 无牌无效
        
        // 幺九牌和字牌列表
        var yaoJiuCards = ['1万', '9万', '1条', '9条', '1筒', '9筒', '东', '南', '西', '北', '中', '发', '白'];
        // 检查是否没有幺九牌和字牌
        return allCards.every(function(card) {
            return yaoJiuCards.indexOf(card.name) === -1;
        });
    },

    // 其他番种检测函数（简化实现）
    checkSanSeShuangLongHui: function(handCards, actionGroups) { return false; },
    checkYiSeSanBuGao: function(handCards, actionGroups) { return false; },
    checkQuanDaiYao: function(handCards, actionGroups) { return false; },
    checkSanAnKe: function(handCards, actionGroups) { return false; },
    checkSanGang: function(handCards, actionGroups) { return false; },
    checkYiSeSanBuGao2: function(handCards, actionGroups) { return false; },
    checkTianTing: function(handCards, actionGroups) { return false; },
    checkDiTing: function(handCards, actionGroups) { return false; },
    checkRenHu: function(handCards, actionGroups) { return false; },
    checkSanFengKe: function(handCards, actionGroups) { return false; },
    checkQuanBuKao: function(handCards, actionGroups) { return false; },
    checkZuHeLong: function(handCards, actionGroups) { return false; },
    checkDaYuWu: function(handCards, actionGroups) { return false; },
    checkXiaoYuWu: function(handCards, actionGroups) { return false; },
    checkSanYuanPai: function(handCards, actionGroups) { return false; },
    checkHunYiSe: function(handCards, actionGroups) { return false; },
    checkHunYaoJiu: function(handCards, actionGroups) { return false; },
    checkSanSeSanTongShun: function(handCards, actionGroups) { return false; },
    checkSanSeSanJieGao: function(handCards, actionGroups) { return false; },
    checkWuMenQi: function(handCards, actionGroups) { return false; },
    checkShuangAnKe: function(handCards, actionGroups) { return false; },
    checkShuangJianKe: function(handCards, actionGroups) { return false; },
    checkShuangMingGang: function(handCards, actionGroups) { return false; },
    checkHunYiSe2: function(handCards, actionGroups) { return false; },
    checkJueZhang: function(handCards, actionGroups) { return false; },
    checkQiangGangHu: function(handCards, actionGroups) { return false; },
    checkPengPengHu2: function(handCards, actionGroups) { return false; },
    checkMenQianQing: function(handCards, actionGroups) { return false; },
    checkPingHu: function(handCards, actionGroups) { return false; },
    checkSiGuiYi: function(handCards, actionGroups) { return false; },
    checkShuangTongKe: function(handCards, actionGroups) { return false; },
    checkLianLiu: function(handCards, actionGroups) { return false; },
    checkLaoShaoFu: function(handCards, actionGroups) { return false; },
    checkYaoJiuKe: function(handCards, actionGroups) { return false; },
    checkMingGang: function(handCards, actionGroups) { return false; },
    checkBianZhang: function(handCards, actionGroups) { return false; },
    checkKanZhang: function(handCards, actionGroups) { return false; },
    checkDanDiaoJiang: function(handCards, actionGroups) { return false; },
    checkZiMo: function(handCards, actionGroups) { return false; },
    checkJianKe: function(handCards, actionGroups) { return false; },
    checkQuanFengKe: function(handCards, actionGroups) { return false; },
    checkMenFengKe: function(handCards, actionGroups) { return false; },
    checkWuZi: function(handCards, actionGroups) { return false; },
    checkBianZhang2: function(handCards, actionGroups) { return false; },
    checkKanZhang2: function(handCards, actionGroups) { return false; },
    checkDanDiaoJiang2: function(handCards, actionGroups) { return false; },
    checkZiMo2: function(handCards, actionGroups) { return false; },
    checkJianKe2: function(handCards, actionGroups) { return false; },
    checkQuanFengKe2: function(handCards, actionGroups) { return false; },
    checkMenFengKe2: function(handCards, actionGroups) { return false; },
    checkSiGuiYi2: function(handCards, actionGroups) { return false; },
    checkShuangTongKe2: function(handCards, actionGroups) { return false; },
    checkShuangAnKe2: function(handCards, actionGroups) { return false; },
    checkAnGang: function(handCards, actionGroups) { return false; },
    checkYiSeShuangLongHui: function(handCards, actionGroups) { return false; },

    /**
     * 关闭结果弹窗
     */
    closeResult: function() {
        this.setData({
            showResult: false  // 隐藏结果
        });
    },

    /**
     * 清空所有数据
     */
    clearAll: function() {
        this.setData({
            handCards: [],         // 清空手牌
            actionGroups: [],      // 清空操作组
            tempChiCards: [],       // 清空临时吃牌
            showResult: false,      // 隐藏结果
            result: {},             // 清空结果
            // 重置特殊规则为未选中
            specialRules: this.data.specialRules.map(function(rule) {
                return { 
                    name: rule.name, 
                    value: rule.value, 
                    checked: false 
                };
            }),
            roundWind: 0,           // 重置圈风
            seatWind: 0,            // 重置风位
            currentMode: 'hand'     // 重置为立牌模式
        });
        
        // 提示已清空
        wx.showToast({
            title: '已清空',
            icon: 'success'
        });
    }
});