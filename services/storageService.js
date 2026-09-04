'use strict';

var schema = require('../data/schema.js');

var STORAGE_KEY = 'mahjong-assistant:data';
var TEMP_KEY = 'mahjong-assistant:data:migrating';

function storageError(code, message, cause) {
    var error = new Error(message);
    error.code = code;
    error.cause = cause;
    return error;
}

function assertAdapter(adapter) {
    if (!adapter || typeof adapter.getStorageSync !== 'function' ||
        typeof adapter.setStorageSync !== 'function' ||
        typeof adapter.removeStorageSync !== 'function') {
        throw storageError('INVALID_STORAGE_ADAPTER', '存储适配器不完整');
    }
}

function serialize(data) {
    try {
        return JSON.stringify(data);
    } catch (error) {
        throw storageError('SERIALIZE_FAILED', '本地数据无法序列化', error);
    }
}

function save(adapter, data) {
    assertAdapter(adapter);
    var migrated = schema.migrate(data);
    var serialized = serialize(migrated);

    try {
        adapter.setStorageSync(TEMP_KEY, serialized);
        var verified = adapter.getStorageSync(TEMP_KEY);
        if (verified !== serialized) {
            throw storageError('VERIFY_FAILED', '本地数据写入校验失败');
        }
        adapter.setStorageSync(STORAGE_KEY, serialized);
        if (adapter.getStorageSync(STORAGE_KEY) !== serialized) {
            throw storageError('VERIFY_FAILED', '正式数据写入校验失败');
        }
        adapter.removeStorageSync(TEMP_KEY);
        return migrated;
    } catch (error) {
        try { adapter.removeStorageSync(TEMP_KEY); } catch (cleanupError) { /* 保留原错误 */ }
        if (error && error.code) throw error;
        throw storageError('WRITE_FAILED', '本地数据保存失败', error);
    }
}

function parseStored(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw storageError('PARSE_FAILED', '本地数据格式损坏', error);
    }
}

function load(adapter) {
    assertAdapter(adapter);
    var raw;
    try {
        raw = adapter.getStorageSync(STORAGE_KEY);
    } catch (error) {
        throw storageError('READ_FAILED', '本地数据读取失败', error);
    }

    var parsed = parseStored(raw);
    var migrated = schema.migrate(parsed);
    var sourceVersion = parsed && parsed.schemaVersion ? parsed.schemaVersion : 0;

    // 新安装和旧版本迁移都通过受保护写入建立正式数据；当前版本只读不重写。
    if (!parsed || sourceVersion !== schema.CURRENT_SCHEMA_VERSION) {
        return save(adapter, migrated);
    }
    return migrated;
}

module.exports = {
    STORAGE_KEY: STORAGE_KEY,
    TEMP_KEY: TEMP_KEY,
    load: load,
    save: save,
    parseStored: parseStored
};
