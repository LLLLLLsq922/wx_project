'use strict';

var engines = {};
var REQUIRED_METHODS = ['validateInput', 'calculateWin', 'analyzeWaits', 'getRuleCatalog'];

function register(engine) {
    if (!engine || !engine.id) throw new Error('规则引擎必须提供稳定ID');
    for (var i = 0; i < REQUIRED_METHODS.length; i++) {
        if (typeof engine[REQUIRED_METHODS[i]] !== 'function') {
            throw new Error('规则引擎缺少方法：' + REQUIRED_METHODS[i]);
        }
    }
    engines[engine.id] = engine;
    return engine;
}

function get(id) {
    return engines[id] || null;
}

function requireEngine(id) {
    var engine = get(id);
    if (!engine) {
        var error = new Error('玩法尚未注册：' + id);
        error.code = 'ENGINE_NOT_REGISTERED';
        throw error;
    }
    return engine;
}

function list() {
    return Object.keys(engines).map(function (id) { return engines[id]; });
}

function clearForTests() {
    engines = {};
}

module.exports = {
    register: register,
    get: get,
    requireEngine: requireEngine,
    list: list,
    clearForTests: clearForTests
};
