'use strict';

var registry = require('../core/ruleEngineRegistry.js');
var guobiao = require('./guobiao/engine.js');

if (!registry.get(guobiao.id)) registry.register(guobiao);

module.exports = registry;
