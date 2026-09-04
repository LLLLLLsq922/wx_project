'use strict';

var CURRENT_SCHEMA_VERSION = 1;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createDefaultData() {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: {
            soundEnabled: true,
            vibrationEnabled: true,
            lastVariant: 'guobiao'
        },
        rulePresets: [],
        quickCalcDrafts: {
            guobiao: null,
            sichuan: null,
            riichi: null
        },
        activeMatches: [],
        completedMatches: []
    };
}

function migrateFromLegacy(raw) {
    var result = createDefaultData();
    if (raw && raw.settings) {
        if (typeof raw.settings.soundEnabled === 'boolean') {
            result.settings.soundEnabled = raw.settings.soundEnabled;
        }
        if (typeof raw.settings.vibrationEnabled === 'boolean') {
            result.settings.vibrationEnabled = raw.settings.vibrationEnabled;
        }
        if (raw.settings.lastVariant) result.settings.lastVariant = raw.settings.lastVariant;
    }
    if (raw && raw.quickCalcDrafts) result.quickCalcDrafts = clone(raw.quickCalcDrafts);
    if (raw && Array.isArray(raw.rulePresets)) result.rulePresets = clone(raw.rulePresets);
    if (raw && Array.isArray(raw.activeMatches)) result.activeMatches = clone(raw.activeMatches);
    if (raw && Array.isArray(raw.completedMatches)) result.completedMatches = clone(raw.completedMatches);
    return result;
}

function migrate(raw) {
    if (raw === null || raw === undefined) return createDefaultData();
    var source = clone(raw);
    var version = source.schemaVersion || 0;
    if (version > CURRENT_SCHEMA_VERSION) {
        var futureError = new Error('本地数据来自更高版本，当前版本不能安全读取');
        futureError.code = 'FUTURE_SCHEMA_VERSION';
        throw futureError;
    }
    if (version === CURRENT_SCHEMA_VERSION) return source;
    return migrateFromLegacy(source);
}

module.exports = {
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
    createDefaultData: createDefaultData,
    migrate: migrate
};
