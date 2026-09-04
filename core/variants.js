'use strict';

var VARIANTS = {
    GUOBIAO: 'guobiao',
    SICHUAN: 'sichuan',
    RIICHI: 'riichi'
};

var DEFINITIONS = {};

DEFINITIONS[VARIANTS.GUOBIAO] = {
    id: VARIANTS.GUOBIAO,
    name: '国标麻将',
    playerCount: 4,
    tileSet: 'standard136',
    scoreUnit: '分'
};

DEFINITIONS[VARIANTS.SICHUAN] = {
    id: VARIANTS.SICHUAN,
    name: '成都川麻',
    playerCount: 4,
    tileSet: 'suited108',
    scoreUnit: '分'
};

DEFINITIONS[VARIANTS.RIICHI] = {
    id: VARIANTS.RIICHI,
    name: '四人日麻',
    playerCount: 4,
    tileSet: 'riichi136',
    scoreUnit: '点'
};

function getVariant(id) {
    var definition = DEFINITIONS[id];
    if (!definition) return null;
    return {
        id: definition.id,
        name: definition.name,
        playerCount: definition.playerCount,
        tileSet: definition.tileSet,
        scoreUnit: definition.scoreUnit
    };
}

function listVariants() {
    return [
        getVariant(VARIANTS.GUOBIAO),
        getVariant(VARIANTS.SICHUAN),
        getVariant(VARIANTS.RIICHI)
    ];
}

module.exports = {
    VARIANTS: VARIANTS,
    getVariant: getVariant,
    listVariants: listVariants
};
