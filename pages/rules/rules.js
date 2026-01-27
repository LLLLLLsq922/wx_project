// pages/rules/rules.js
Page({
    data: {
      rules: [
        { name: '大四喜', fan: 88, description: '由4副风刻(杠)组成的和牌。不计圈风刻、门风刻、三风刻、碰碰和' },
        { name: '大三元', fan: 88, description: '和牌中，有中发白3副刻子。不计箭刻' },
        { name: '绿一色', fan: 88, description: '由23468条及发字中的任何牌组成的顺子、刻子、将的和牌。不计混一色。如无"发"字组成的和牌，可计清一色' },
        { name: '九莲宝灯', fan: 88, description: '由一种花色序数牌子按1112345678999组成的特定牌型，见同花色任何1张序数牌即成和牌。不计清一色' },
        { name: '四杠', fan: 88, description: '4个杠' },
        { name: '连七对', fan: 88, description: '由一种花色序数牌组成序数相连的7个对子的和牌。不计清一色、不求人、单钓' },
        { name: '十三幺', fan: 88, description: '由3种序数牌的一、九牌，7种字牌及其中一对作将组成的和牌。不计五门齐、不求人、单钓' },
        { name: '清幺九', fan: 64, description: '由序数牌一、九刻子组成的和牌。不计碰碰和、同刻、无字' },
        { name: '小四喜', fan: 64, description: '和牌时有风牌的3副刻子及将牌。不计三风刻' },
        { name: '小三元', fan: 64, description: '和牌时有箭牌的两副刻子及将牌。不计箭刻' },
        { name: '字一色', fan: 64, description: '由字牌的刻子(杠)、将组成的和牌。不计碰碰和' },
        { name: '四暗刻', fan: 64, description: '4个暗刻(暗杠)。不计门前清、碰碰和' },
        { name: '一色双龙会', fan: 64, description: '一种花色的两个老少副，5为将牌。不计平和、七对、清一色' },
        { name: '一色四同顺', fan: 48, description: '一种花色4副序数相同的顺子，不计一色三节高、一般高、四归一' },
        { name: '一色四节高', fan: 48, description: '一种花色4副依次递增一位数的刻子，不计一色三同顺、碰碰和' },
        { name: '一色四步高', fan: 32, description: '一种花色4副依次递增一位数或依次递增二位数的顺子' },
        { name: '三杠', fan: 32, description: '3个杠' },
        { name: '混幺九', fan: 32, description: '由字牌和序数牌一、九的刻子及将牌组成的和牌。不计碰碰和' },
        { name: '七对', fan: 24, description: '由7个对子组成和牌。不计不求人、单钓' },
        { name: '清一色', fan: 24, description: '由一种花色的序数牌组成和牌。不无字' },
        { name: '一色三同顺', fan: 24, description: '和牌时有一种花色3副序数相同的顺子。不计一色三节高' },
        { name: '一色三节高', fan: 24, description: '和牌时有一种花色3副依次递增一位数字的刻子。不计一色三同顺' },
        { name: '全大', fan: 24, description: '由序数牌789组成的顺子、刻子(杠)、将牌的和牌。不计无字' },
        { name: '全中', fan: 24, description: '由序数牌456组成的顺子、刻子(杠)、将牌的和牌。不计断幺' },
        { name: '全小', fan: 24, description: '由序数牌123组成的顺子、刻子(杠)、将牌的和牌。不计无字' },
        { name: '青龙', fan: 16, description: '和牌时，有一种花色1-9相连接的序数牌' },
        { name: '三色双龙会', fan: 16, description: '2种花色2个老少副、另一种花色5作将的和牌。不计喜相逢、老少副、无字、平和' },
        { name: '一色三步高', fan: 16, description: '和牌时，有一种花色3副依次递增一位或依次递增二位数字的顺子' },
        { name: '全带五', fan: 16, description: '每副牌及将牌必须有5的序数牌。不计断幺' },
        { name: '三同刻', fan: 16, description: '3个序数相同的刻子(杠)' },
        { name: '三暗刻', fan: 16, description: '3个暗刻' },
        { name: '全不靠', fan: 12, description: '由单张3种花色147、258、369不能错位的序数牌及东南西北中发白中的任何14张牌组成的和牌。不计五门齐、不求人、单钓' },
        { name: '组合龙', fan: 12, description: '和牌时，必须有3种花色的147、258、369不能错位的序数牌' },
        { name: '大于五', fan: 12, description: '由序数牌6-9的顺子、刻子、将牌组成的和牌。不计无字' },
        { name: '小于五', fan: 12, description: '由序数牌1-4的顺子、刻子、将牌组成的和牌。不计无字' },
        { name: '三风刻', fan: 12, description: '3个风刻' },
        { name: '花龙', fan: 8, description: '和牌时，有3种花色的3副顺子连接成1-9的序数牌' },
        { name: '推不倒', fan: 8, description: '由牌面图形没有上下区别的牌组成的和牌，包括1234589饼、245689条、白板。不计缺一门' },
        { name: '三色三同顺', fan: 8, description: '和牌时，有3种花色3副序数相同的顺子' },
        { name: '三色三节高', fan: 8, description: '和牌时，有3种花色3副依次递增一位数的刻子' },
        { name: '无番和', fan: 8, description: '和牌后，数不出任何番种分(花牌不计算在内)' },
        { name: '妙手回春', fan: 8, description: '自摸牌墙上最后一张牌和牌。不计自摸' },
        { name: '海底捞月', fan: 8, description: '和打出的最后一张牌' },
        { name: '杠上开花', fan: 8, description: '开杠抓进的牌成和牌(不包括补花)不计自摸' },
        { name: '抢杠和', fan: 8, description: '和别人自抓开明杠的牌。不计和绝张' },
        { name: '碰碰和', fan: 6, description: '由4副刻子(或杠)、将牌组成的和牌' },
        { name: '混一色', fan: 6, description: '由一种花色序数牌及字牌组成的和牌' },
        { name: '三色三步高', fan: 6, description: '3种花色3副依次递增一位序数的顺子' },
        { name: '五门齐', fan: 6, description: '和牌时3种序数牌、风、箭牌齐全' },
        { name: '全求人', fan: 6, description: '全靠吃牌、碰牌、单钓别人批出的牌和牌。不计单钓' },
        { name: '双暗杠', fan: 6, description: '2个暗杠' },
        { name: '双箭刻', fan: 6, description: '2副箭刻(或杠)' },
        { name: '全带幺', fan: 4, description: '和牌时，每副牌、将牌都有幺九牌' },
        { name: '不求人', fan: 4, description: '4副牌及将中没有吃牌、碰牌(包括明杠)，自摸和牌' },
        { name: '双明杠', fan: 4, description: '2个明杠' },
        { name: '和绝张', fan: 4, description: '和牌池、桌面已亮明的3张牌所剩的第4张牌(抢杠和不计和绝张)' },
        { name: '箭刻', fan: 2, description: '由中、发、白3张相同的牌组成的刻子' },
        { name: '圈风刻', fan: 2, description: '与圈风相同的风刻' },
        { name: '门风刻', fan: 2, description: '与本门风相同的风刻' },
        { name: '门前清', fan: 2, description: '没有吃、碰、明杠，和别人打出的牌' },
        { name: '平和', fan: 2, description: '由4副顺子及序数牌作将组成的和牌，边、坎、钓不影响平和' },
        { name: '四归一', fan: 2, description: '和牌中，有4张相同的牌归于一家的顺、刻子、对、将牌中(不包括杠牌)' },
        { name: '双同刻', fan: 2, description: '2副序数相同的刻子' },
        { name: '双暗刻', fan: 2, description: '2个暗刻' },
        { name: '断幺', fan: 2, description: '和牌中没有一、九及字牌' },
        { name: '一般高', fan: 1, description: '由一种花色2副相同的顺子组成的牌' },
        { name: '喜相逢', fan: 1, description: '2种花色2副序数相同的顺子' },
        { name: '连六', fan: 1, description: '一种花色6张相连接的序数牌' },
        { name: '老少副', fan: 1, description: '一种花色牌的123、789两副顺子' },
        { name: '幺九刻', fan: 1, description: '3张相同的一、九序数牌及字牌组成的刻子(或杠)' },
        { name: '明杠', fan: 1, description: '自己有暗刻，碰别人打出的一张相同的牌开杠：或自己抓进一张与碰的明刻相同的牌开杠' },
        { name: '缺一门', fan: 1, description: '和牌中缺少一种花色序数牌' },
        { name: '无字', fan: 1, description: '和牌中没有风、箭牌' },
        { name: '边张', fan: 1, description: '单和123的3及789的7或1233和3、7789和7都为边张。手中有12345和3，56789和7不算边张' },
        { name: '坎张', fan: 1, description: '和2张牌之间的牌。4556和5也为坎张，手中有45567和6不算坎张' },
        { name: '单钓将', fan: 1, description: '钓单张牌作将成和' },
        { name: '自摸', fan: 1, description: '自己抓进牌成和牌' },
        { name: '花牌', fan: 1, description: '即春夏秋冬，梅兰竹菊，每花计一分。不计在起和分内，和牌后才能计分。花牌补花成和计自摸分，不计杠上开花' }
      ],
      searchText: '',
      filteredRules: []
    },
  
    onLoad() {
      this.setData({
        filteredRules: this.data.rules
      });
    },
  
    onShow() {
      // 页面显示时的逻辑
    },
  
    // 搜索输入
    onSearchInput(e) {
      const searchText = e.detail.value;
      this.setData({
        searchText: searchText
      });
      this.filterRules();
    },
  
    // 清空搜索
    clearSearch() {
      this.setData({
        searchText: ''
      });
      this.filterRules();
    },
  
    // 过滤规则
    filterRules() {
      const { rules, searchText } = this.data;
      if (!searchText.trim()) {
        this.setData({
          filteredRules: rules
        });
        return;
      }
  
      const filtered = rules.filter(rule => 
        rule.name.includes(searchText) || 
        rule.description.includes(searchText)
      );
      
      this.setData({
        filteredRules: filtered
      });
    }
  });
  