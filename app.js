App({
    onLaunch() {
      console.log('国标麻将胡牌计算器启动成功')
    },
    
    onShow() {
      console.log('小程序显示')
    },
    
    onHide() {
      console.log('小程序隐藏')
    },
    
    globalData: {
      userInfo: null,
      version: '1.0.0'
    }
  })
  