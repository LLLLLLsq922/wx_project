'use strict';

var registry = require('../core/ruleEngineRegistry.js');
var guobiao = require('./guobiao/engine.js');
var sichuan = require('./sichuan/engine.js');

if (!registry.get(guobiao.id)) registry.register(guobiao);
if (!registry.get(sichuan.id)) registry.register(sichuan);

module.exports = registry;
