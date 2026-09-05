'use strict';

var RULES = [
    { id: 'pinghu', name: '平胡', fan: 0, description: '四副面子加一对将牌组成的普通和牌。', formation: '面子可以是顺子或刻子，必须先清空定缺花色。', notMet: '牌张不能拆成四副面子和一对将牌，或仍持有定缺花色。', exclusions: [], example: ['1万','2万','3万','3万','4万','5万','2条','3条','4条','6条','7条','8条','5万','5万'] },
    { id: 'pengpenghu', name: '对对胡', fan: 1, description: '四副刻子或杠加一对将牌组成的和牌。', formation: '所有面子均为相同牌组成，不能含顺子。', notMet: '任意一副面子必须作为顺子使用。', exclusions: [], example: ['1万','1万','1万','3万','3万','3万','4条','4条','4条','6条','6条','6条','7筒','7筒'] },
    { id: 'jingoudiao', name: '金钩钓', fan: 1, description: '四副牌都已碰或杠，暗手只剩一对将牌时和牌。', formation: '必须有四副外部面子，最后以单钓方式组成将牌。', notMet: '暗手除将牌外仍需组成其他面子。', exclusions: ['对对胡'], example: ['1万','1万'] },
    { id: 'qingyise', name: '清一色', fan: 2, description: '全部牌只使用万、条、筒中的一种花色。', formation: '暗手和所有副露均须为同一花色。', notMet: '牌面中出现第二种花色。', exclusions: [], example: ['1万','2万','3万','2万','3万','4万','5万','6万','7万','7万','8万','9万','5万','5万'] },
    { id: 'qidui', name: '七对', fan: 2, description: '由七个对子组成且没有副露的和牌。', formation: '14张暗手可以分成七对；四张相同牌可作为两对。', notMet: '存在副露，或任意牌无法配成对子。', exclusions: [], example: ['1万','1万','2万','2万','3万','3万','4条','4条','5条','5条','6筒','6筒','7筒','7筒'] },
    { id: 'daiyaojiu', name: '带幺九', fan: 2, description: '每副面子和将牌都含有1或9。', formation: '顺子只能为123或789，刻子、杠和将牌只能使用1或9。', notMet: '存在不含1或9的面子，或将牌不是1、9。', exclusions: [], example: ['1万','2万','3万','7万','8万','9万','1条','1条','1条','9条','9条','9条','1筒','1筒'] },
    { id: 'longqidui', name: '龙七对', fan: 3, description: '七对中至少有一组四张相同牌。', formation: '必须保持门清；第一个根已经包含在3番中。', notMet: '普通七对中没有任何四张相同牌。', exclusions: ['七对','第一个根'], example: ['1万','1万','1万','1万','2万','2万','3万','3万','4条','4条','5条','5条','6筒','6筒'] },
    { id: 'jiangdui', name: '将对', fan: 3, description: '全部由2、5、8组成的对对胡。', formation: '四副刻子或杠及将牌均只能使用2、5、8。', notMet: '含顺子，或出现2、5、8之外的牌。', exclusions: ['对对胡','中张'], example: ['2万','2万','2万','5万','5万','5万','8万','8万','8万','5筒','5筒','5筒','8筒','8筒'] },
    { id: 'qingdui', name: '清对', fan: 3, description: '清一色与对对胡组合成的牌型。', formation: '全部牌为同一花色，且四副面子均为刻子或杠。', notMet: '出现其他花色或顺子。', exclusions: ['清一色','对对胡'], example: ['2万','2万','2万','4万','4万','4万','5万','5万','5万','7万','7万','7万','9万','9万'] },
    { id: 'qingqidui', name: '清七对', fan: 4, description: '同一花色组成的七对。', formation: '14张暗手均为同一花色并组成七对。', notMet: '出现其他花色、存在副露或不能组成七对。', exclusions: ['清一色','七对'], example: ['1万','1万','2万','2万','3万','3万','4万','4万','5万','5万','6万','6万','7万','7万'] },
    { id: 'qinglongqidui', name: '清龙七对', fan: 5, description: '同一花色且带至少一个根的七对。', formation: '清七对中至少有四张相同牌。', notMet: '不是清七对，或没有四张相同牌。', exclusions: ['清一色','七对','清七对','龙七对','第一个根'], example: ['1万','1万','1万','1万','2万','2万','3万','3万','4万','4万','5万','5万','6万','6万'] },
    { id: 'qingjingoudiao', name: '清金钩钓', fan: 3, description: '全部牌同一花色的金钩钓。', formation: '四副外部碰杠和最后将牌均为同一花色。', notMet: '不是金钩钓或出现其他花色。', exclusions: ['清一色','金钩钓','对对胡'], example: ['5万','5万'] },
    { id: 'qingyaojiu', name: '清幺九', fan: 4, description: '同一花色组成的带幺九。', formation: '全部为同一花色，且每副面子及将牌都含1或9。', notMet: '出现其他花色，或存在不含1、9的面子。', exclusions: ['清一色','带幺九'], example: ['1万','2万','3万','1万','2万','3万','7万','8万','9万','7万','8万','9万','1万','1万'] },
    { id: 'shibaluohan', name: '十八罗汉', fan: 5, description: '四副杠加一对将牌组成的和牌。', formation: '必须实际存在四组杠，牌面共18张。', notMet: '少于四组杠，或最后暗手不能组成将牌。', exclusions: ['金钩钓','对对胡','四个根'], example: [] },
    { id: 'qingshibaluohan', name: '清十八罗汉', fan: 7, description: '所有牌同一花色的十八罗汉。', formation: '四副杠及将牌均为同一花色。', notMet: '不是十八罗汉或出现其他花色。', exclusions: ['十八罗汉','清一色','金钩钓','对对胡','四个根'], example: [] },
    { id: 'tianhu', name: '天胡', fan: 5, description: '庄家起手完成和牌。', formation: '必须由实际牌局过程确认庄家在首次出牌前已经和牌。', notMet: '已经发生摸打、碰杠等后续事件。', exclusions: [], example: [] },
    { id: 'dihu', name: '地胡', fan: 5, description: '闲家在牌局最初阶段按约定条件完成和牌。', formation: '依赖实际牌局过程，由录入者确认满足本场采用的地胡条件。', notMet: '已经越过本场规则限定的首轮时机。', exclusions: [], example: [] },
    { id: 'gangshanghua', name: '杠上花', fan: 1, description: '开杠补牌后立即自摸和牌。', formation: '和牌张必须是本次杠牌后的补牌。', notMet: '补牌后又发生其他摸打才和牌。', exclusions: [], example: [] },
    { id: 'gangshangpao', name: '杠上炮', fan: 1, description: '玩家杠后打出的牌使其他玩家和牌。', formation: '点炮牌必须是点炮者杠牌后紧接着打出的牌。', notMet: '杠后已发生其他出牌过程。', exclusions: [], example: [] },
    { id: 'qiangganghu', name: '抢杠胡', fan: 1, description: '其他玩家补杠时抢和该张补杠牌。', formation: '只针对可被抢和的补杠牌；对应补杠不产生杠分。', notMet: '不是补杠牌，或本场过程不允许抢和。', exclusions: [], example: [] },
    { id: 'haidilaoyue', name: '海底捞月', fan: 1, description: '牌墙最后阶段按本场约定完成和牌。', formation: '必须由实际牌局过程确认和牌张属于最后可摸牌。', notMet: '牌墙仍有普通摸牌机会。', exclusions: [], example: [] },
    { id: 'menqing', name: '门清', fan: 1, description: '和牌前没有碰牌或明杠。', formation: '暗杠不破坏门清，其他公开副露会破坏门清。', notMet: '存在碰牌、直杠或补杠。', exclusions: [], example: [] },
    { id: 'zhongzhang', name: '中张', fan: 1, description: '整副和牌只使用2至8的中张牌。', formation: '暗手和副露均不能出现1或9。', notMet: '牌面中含有1或9。', exclusions: [], example: [] },
    { id: 'gen', name: '根', fan: 1, description: '和牌牌面中每有四张相同牌计一根。', formation: '暗手或杠牌中凑齐同一种牌四张；普通牌型可逐根加番。', notMet: '同一种牌只有三张或更少。', exclusions: ['龙七对已包含第一个根','十八罗汉已包含四个根'], example: ['3万','3万','3万','3万'] }
];

function getRuleById(id) {
    return RULES.find(function (rule) { return rule.id === id; }) || null;
}

module.exports = { RULES: RULES, getRuleById: getRuleById };
