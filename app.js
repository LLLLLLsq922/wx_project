var storageService = require('./services/storageService.js');

App({
    onLaunch() {
      console.log('国标麻将胡牌计算器启动成功')
      try {
        var localData = storageService.load(wx)
        this.globalData.localData = localData
        this.globalData.settings = localData.settings
      } catch (error) {
        // 不在启动阶段覆盖或清空异常数据，交由页面展示可恢复提示。
        this.globalData.storageError = {
          code: error && error.code ? error.code : 'STORAGE_FAILED',
          message: error && error.message ? error.message : '本地数据加载失败'
        }
      }
    },
    
    onShow() {
      console.log('小程序显示')
    },
    
    onHide() {
      console.log('小程序隐藏')
    },
    
    globalData: {
      userInfo: null,
      version: '1.0.0',
      settings: {
        soundEnabled: true,
        vibrationEnabled: true,
        lastVariant: 'guobiao'
      },
      localData: null,
      storageError: null
    }
  })
