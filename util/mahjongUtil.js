// utils/mahjongUtil.js
// 修复版：避免使用类静态属性等高级语法

// 国标麻将牌型规则数据
const FAN_RULES = [
    { name: '大四喜', fan: 88, check: checkDaSiXi },
    { name: '大三元', fan: 88, check: checkDaSanYuan },
    { name: '绿一色', fan: 88, check: checkLvYiSe },
    { name: '九莲宝灯', fan: 88, check: checkJiuLianBaoDeng },
    { name: '四杠', fan: 88, check: checkSiGang },
    { name: '连七对', fan: 88, check: checkLianQiDui },
    { name: '十三幺', fan: 88, check: checkShiSanYao },
    { name: '清幺九', fan: 64, check: checkQingYaoJiu },
    { name: '小四喜', fan: 64, check: checkXiaoSiXi },
    { name: '小三元', fan: 64, check: checkXiaoSanYuan },
    { name: '字一色', fan: 64, check: checkZiYiSe },
    { name: '四暗刻', fan: 64, check: checkSiAnKe },
    { name: '一色双龙会', fan: 64, check: checkYiSeShuangLongHui },
    { name: '一色四同顺', fan: 48, check: checkYiSeSiTongShun },
    { name: '一色四节高', fan: 48, check: checkYiSeSiJieGao },
    { name: '一色四步高', fan: 32, check: checkYiSeSiBuGao },
    { name: '三杠', fan: 32, check: checkSanGang },
    { name: '混幺九', fan: 32, check: checkHunYaoJiu },
    { name: '七对', fan: 24, check: checkQiDui },
    { name: '清一色', fan: 24, check: checkQingYiSe },
    { name: '一色三同顺', fan: 24, check: checkYiSeSanTongShun },
    { name: '一色三节高', fan: 24, check: checkYiSeSanJieGao },
    { name: '全大', fan: 24, check: checkQuanDa },
    { name: '全中', fan: 24, check: checkQuanZhong },
    { name: '全小', fan: 24, check: checkQuanXiao }
  ];
  
  // 计算胡牌的主函数
  function calculateHu(handCards, actionGroups, options) {
    const cards = parseCards(handCards);
    const canHu = checkHu(cards);
    
    if (!canHu) {
      return { canHu: false, totalFan: 0, fanList: [] };
    }
  
    const fanList = calculateFan(cards, actionGroups, options);
    const totalFan = fanList.reduce(function(sum, item) { 
      return sum + item.fan; 
    }, 0);
  
    return {
      canHu: true,
      totalFan: totalFan,
      fanList: fanList
    };
  }
  
  // 解析牌型
  function parseCards(cards) {
    return cards.map(function(card) {
      return {
        type: card.type,
        value: card.value,
        name: card.name
      };
    });
  }
  
  // 检查基本胡牌
  function checkHu(cards) {
    if (cards.length % 3 !== 2) return false;
    return checkQiDui(cards) || checkNormalHu(cards);
  }
  
  // 检查七对
  function checkQiDui(cards) {
    if (cards.length !== 14) return false;
    
    const cardCount = {};
    cards.forEach(function(card) {
      const key = card.name;
      cardCount[key] = (cardCount[key] || 0) + 1;
    });
    
    return Object.keys(cardCount).every(function(key) {
      return cardCount[key] === 2;
    });
  }
  
  // 检查普通胡牌
  function checkNormalHu(cards) {
    return cards.length === 14;
  }
  
  // 计算番数
  function calculateFan(cards, actionGroups, options) {
    const fanList = [];
    
    for (let i = 0; i < FAN_RULES.length; i++) {
      const rule = FAN_RULES[i];
      if (rule.check(cards, actionGroups, options)) {
        fanList.push({ name: rule.name, fan: rule.fan });
      }
    }
  
    return fanList;
  }
  
  // 各种牌型检查方法
  function checkDaSiXi(cards, actionGroups) {
    const honors = ['东', '南', '西', '北'];
    return honors.every(function(honor) {
      const allCards = cards.concat(actionGroups.reduce(function(acc, group) {
        return acc.concat(group.cards);
      }, []));
      return allCards.filter(function(c) { 
        return c.value === honor; 
      }).length >= 3;
    });
  }
  
  function checkDaSanYuan(cards, actionGroups) {
    const yuan = ['中', '发', '白'];
    return yuan.every(function(y) {
      const allCards = cards.concat(actionGroups.reduce(function(acc, group) {
        return acc.concat(group.cards);
      }, []));
      return allCards.filter(function(c) { 
        return c.value === y; 
      }).length >= 3;
    });
  }
  
  function checkQiDui(cards) {
    if (cards.length !== 14) return false;
    const count = {};
    cards.forEach(function(card) {
      count[card.name] = (count[card.name] || 0) + 1;
    });
    return Object.keys(count).every(function(key) {
      return count[key] === 2;
    });
  }
  
  function checkQingYiSe(cards, actionGroups) {
    const allCards = cards.concat(actionGroups.reduce(function(acc, group) {
      return acc.concat(group.cards);
    }, []));
    if (allCards.length === 0) return false;
    const types = [];
    allCards.forEach(function(card) {
      if (types.indexOf(card.type) === -1) {
        types.push(card.type);
      }
    });
    return types.length === 1 && types[0] !== '字';
  }
  
  function checkZiYiSe(cards, actionGroups) {
    const allCards = cards.concat(actionGroups.reduce(function(acc, group) {
      return acc.concat(group.cards);
    }, []));
    return allCards.every(function(card) {
      return card.type === '字';
    });
  }
  
  // 其他检查函数（简化实现）
  function checkLvYiSe() { return false; }
  function checkJiuLianBaoDeng() { return false; }
  function checkSiGang() { return false; }
  function checkLianQiDui() { return false; }
  function checkShiSanYao() { return false; }
  function checkQingYaoJiu() { return false; }
  function checkXiaoSiXi() { return false; }
  function checkXiaoSanYuan() { return false; }
  function checkSiAnKe() { return false; }
  function checkYiSeShuangLongHui() { return false; }
  function checkYiSeSiTongShun() { return false; }
  function checkYiSeSiJieGao() { return false; }
  function checkYiSeSiBuGao() { return false; }
  function checkSanGang() { return false; }
  function checkHunYaoJiu() { return false; }
  function checkYiSeSanTongShun() { return false; }
  function checkYiSeSanJieGao() { return false; }
  function checkQuanDa() { return false; }
  function checkQuanZhong() { return false; }
  function checkQuanXiao() { return false; }
  
  // 导出函数
  module.exports = {
    calculateHu: calculateHu
  };
  