'use strict';

var tiles = require('../core/tiles.js');

function playerMap(match) {
    var result = {};
    (match.players || []).forEach(function (player) { result[player.id] = player.name; });
    return result;
}

function nameOf(names, playerId) {
    return names[playerId] || playerId || '未知玩家';
}

function suitName(suit) {
    return suit === 'm' ? '万' : suit === 's' ? '条' : '筒';
}

function tileNames(tileIds) {
    return (tileIds || []).map(tiles.chineseNameFromId).join('、');
}

function transferText(transaction, names) {
    return (transaction.transfers || []).map(function (transfer) {
        return nameOf(names, transfer.from) + ' → ' + nameOf(names, transfer.to) +
            ' ' + transfer.amount + '分';
    }).join('；');
}

function transactionRows(match, round) {
    var names = playerMap(match);
    return (round.transactions || []).map(function (transaction, index) {
        return {
            id: transaction.id,
            index: index + 1,
            type: transaction.type,
            reason: transaction.reason,
            formula: transaction.formula || '',
            transferText: transferText(transaction, names)
        };
    });
}

function exchangeDetail(event, names) {
    return (event.transfers || []).map(function (transfer) {
        return nameOf(names, transfer.from) + '给' + nameOf(names, transfer.to) +
            '：' + tileNames(transfer.tiles);
    }).join('；');
}

function winTitle(event, names) {
    var winners = (event.winners || []).map(function (winner) {
        return nameOf(names, winner.playerId);
    }).join('、');
    if (event.isSelfDraw) return winners + '自摸';
    return winners + '和牌 · ' + nameOf(names, event.discarderId) + '点炮';
}

function winDetail(event) {
    return (event.winners || []).map(function (winner) {
        return (winner.pattern || '已记录牌型') + ' ' + winner.fan + '番';
    }).join('；');
}

function eventRows(match, round) {
    var names = playerMap(match);
    var transactions = {};
    (round.transactions || []).forEach(function (transaction) {
        transactions[transaction.id] = transaction;
    });
    return (round.events || []).map(function (event, index) {
        var row = { id: event.id || event.type + '-' + index, index: index + 1, type: event.type };
        if (event.type === 'exchangeThree') {
            row.title = '换三张 · ' + event.directionName;
            row.detail = exchangeDetail(event, names);
        } else if (event.type === 'dingque') {
            row.title = '四家定缺';
            row.detail = Object.keys(event.suits || {}).map(function (playerId) {
                return nameOf(names, playerId) + '缺' + suitName(event.suits[playerId]);
            }).join('；');
        } else if (event.type === 'kong') {
            var kongTransaction = transactions[event.transactionId];
            row.title = nameOf(names, event.actorId) + (event.robbed ? '补杠被抢' :
                (kongTransaction ? kongTransaction.reason : '杠牌'));
            row.detail = kongTransaction ? transferText(kongTransaction, names) : '未产生杠分';
        } else if (event.type === 'win') {
            row.title = winTitle(event, names);
            row.detail = winDetail(event);
        } else if (event.type === 'wallExhausted') {
            var huazhu = (event.huazhuPlayerIds || []).map(function (id) {
                return nameOf(names, id);
            });
            var ready = (event.dajiaoResults || []).filter(function (item) {
                return item && item.isReady;
            }).map(function (item) {
                return nameOf(names, item.playerId) + '(' + item.maxFan + '番)';
            });
            row.title = '牌墙耗尽';
            row.detail = '花猪：' + (huazhu.join('、') || '无') +
                '；大叫：' + (ready.join('、') || '无');
        } else {
            row.title = event.type || '未知事件';
            row.detail = '';
        }
        return row;
    });
}

function scoreRows(match, round) {
    return (match.players || []).map(function (player) {
        var score = (round.scoreChanges && round.scoreChanges[player.id]) || 0;
        return { id: player.id, name: player.name, score: score };
    });
}

function winnerHands(match, round) {
    var names = playerMap(match);
    var result = [];
    (round.events || []).forEach(function (event, eventIndex) {
        if (event.type !== 'win') return;
        (event.winners || []).forEach(function (winner) {
            if (!winner.handSnapshot) return;
            result.push({
                id: (event.id || 'win-' + eventIndex) + ':' + winner.playerId,
                playerName: nameOf(names, winner.playerId),
                fan: winner.fan,
                pattern: winner.pattern || '',
                concealedTiles: winner.handSnapshot.concealedTiles || [],
                melds: (winner.handSnapshot.melds || []).map(function (meld) {
                    return {
                        type: meld.type,
                        label: meld.type === 'pon' ? '碰' : meld.type === 'openKong' ? '直杠' :
                            meld.type === 'addedKong' ? '补杠' : '暗杠',
                        tiles: meld.tiles || []
                    };
                }),
                winTile: winner.handSnapshot.winTile
            });
        });
    });
    return result;
}

function buildRoundDetail(match, round) {
    return {
        scoreRows: scoreRows(match, round),
        eventRows: eventRows(match, round),
        transactionRows: transactionRows(match, round),
        winnerHands: winnerHands(match, round)
    };
}

module.exports = {
    eventRows: eventRows,
    transactionRows: transactionRows,
    scoreRows: scoreRows,
    winnerHands: winnerHands,
    buildRoundDetail: buildRoundDetail
};
