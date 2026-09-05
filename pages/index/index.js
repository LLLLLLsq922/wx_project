'use strict';

var variants = require('../../core/variants.js');
var storageService = require('../../services/storageService.js');

Page({
    data: {
        variants: variants.listVariants(),
        selectedVariant: variants.VARIANTS.GUOBIAO,
        selectedVariantName: '国标麻将',
        activeMatchCount: 0,
        historyCount: 0,
        storageMessage: ''
    },

    onLoad: function () {
        this.refreshHome();
    },

    onShow: function () {
        this.refreshHome();
    },

    refreshHome: function () {
        var app = typeof getApp === 'function' ? getApp() : null;
        var localData = app && app.globalData ? app.globalData.localData : null;
        var savedVariant = localData && localData.settings ? localData.settings.lastVariant : null;
        var selectedVariant = variants.getVariant(savedVariant) ? savedVariant : this.data.selectedVariant;
        var activeMatches = localData && Array.isArray(localData.activeMatches) ? localData.activeMatches : [];
        var completedMatches = localData && Array.isArray(localData.completedMatches) ? localData.completedMatches : [];

        this.setData({
            selectedVariant: selectedVariant,
            selectedVariantName: variants.getVariant(selectedVariant).name,
            activeMatchCount: activeMatches.filter(function (match) {
                return match.variant === selectedVariant;
            }).length,
            historyCount: completedMatches.filter(function (match) {
                return match.variant === selectedVariant;
            }).length,
            storageMessage: app && app.globalData && app.globalData.storageError
                ? app.globalData.storageError.message
                : ''
        });
    },

    selectVariant: function (event) {
        var variantId = event.currentTarget.dataset.id;
        var definition = variants.getVariant(variantId);
        if (!definition) return;

        this.setData({
            selectedVariant: variantId,
            selectedVariantName: definition.name,
            activeMatchCount: this.countMatches('activeMatches', variantId),
            historyCount: this.countMatches('completedMatches', variantId)
        });
        this.persistLastVariant(variantId);
    },

    countMatches: function (collection, variantId) {
        var app = typeof getApp === 'function' ? getApp() : null;
        var localData = app && app.globalData ? app.globalData.localData : null;
        return localData && Array.isArray(localData[collection]) ? localData[collection].filter(function (match) {
            return match.variant === variantId;
        }).length : 0;
    },

    persistLastVariant: function (variantId) {
        var app = typeof getApp === 'function' ? getApp() : null;
        if (!app || !app.globalData || !app.globalData.localData || typeof wx === 'undefined') return;

        app.globalData.localData.settings.lastVariant = variantId;
        app.globalData.settings = app.globalData.localData.settings;
        try {
            app.globalData.localData = storageService.save(wx, app.globalData.localData);
            app.globalData.storageError = null;
            this.setData({ storageMessage: '' });
        } catch (error) {
            app.globalData.storageError = error;
            this.setData({ storageMessage: error.message || '玩法偏好保存失败' });
        }
    },

    openQuickCalc: function () {
        if (this.data.selectedVariant === variants.VARIANTS.GUOBIAO) {
            wx.navigateTo({ url: '/subpackages/guobiao/pages/calc/calc' });
            return;
        }
        if (this.data.selectedVariant === variants.VARIANTS.SICHUAN) {
            wx.navigateTo({ url: '/subpackages/sichuan/pages/calc/calc' });
            return;
        }
        this.showPending('快速算牌');
    },

    openCreateMatch: function () {
        if (this.data.selectedVariant === variants.VARIANTS.SICHUAN) {
            wx.navigateTo({ url: '/subpackages/sichuan/pages/create/create' });
            return;
        }
        this.showPending('创建牌局');
    },

    openActiveMatches: function () {
        if (this.data.selectedVariant === variants.VARIANTS.SICHUAN) {
            wx.navigateTo({ url: '/subpackages/sichuan/pages/matches/matches' });
            return;
        }
        this.showPending(this.data.activeMatchCount ? '继续牌局' : '暂无进行中的牌局');
    },

    openHistory: function () {
        this.showPending(this.data.historyCount ? '历史记录' : '暂无历史记录');
    },

    openRules: function () {
        if (this.data.selectedVariant === variants.VARIANTS.GUOBIAO) {
            wx.switchTab({ url: '/pages/rules/rules' });
            return;
        }
        this.showPending('规则百科');
    },

    showPending: function (feature) {
        wx.showToast({
            title: feature.indexOf('暂无') === 0
                ? feature
                : this.data.selectedVariantName + feature + '将在后续阶段开放',
            icon: 'none',
            duration: 2200
        });
    }
});
