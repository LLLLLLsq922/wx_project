'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var schema = require('../data/schema.js');
var matchState = require('../rules/sichuan/matchState.js');
var roundState = require('../rules/sichuan/roundState.js');
var matchService = require('../services/matchService.js');
var presenter = require('../services/sichuanResultPresenter.js');

function createCompletedMatch() {
    var match = matchState.createMatch({
        matchId: 'detail-match',
        mode: 'normal',
        players: [
            { id: 'p1', name: '甲' }, { id: 'p2', name: '乙' },
            { id: 'p3', name: '丙' }, { id: 'p4', name: '丁' }
        ],
        initialDealerId: 'p1',
        format: { type: 'fixedRounds', roundCount: 4 },
        rules: {
            huansanzhangEnabled: false,
            dingqueEnabled: false,
            huazhuEnabled: false,
            dajiaoEnabled: false,
            taxRefundEnabled: false
        },
        timestamp: '2026-09-05T00:00:00.000Z'
    });
    var round = matchState.createNextRound(match, { roundId: 'detail-round' });
    round = roundState.recordKong(round, {
        actorId: 'p1', sourcePlayerId: 'p4', kongType: 'directKong'
    });
    round = roundState.recordWin(round, {
        id: 'detail-win',
        winners: [{
            playerId: 'p2',
            fan: 2,
            pattern: '七对',
            handSnapshot: {
                concealedTiles: [
                    'm1', 'm1', 'm2', 'm2', 'm3', 'm3', 'm4',
                    'm4', 's5', 's5', 's6', 's6', 's7', 's7'
                ],
                melds: [],
                winTile: 's7'
            }
        }],
        discarderId: 'p3'
    });
    return matchState.commitRound(match, round, { timestamp: '2026-09-05T00:01:00.000Z' });
}

test('川麻结果展示把事件、公式和付款方向转换为玩家姓名', function () {
    var match = createCompletedMatch();
    var detail = presenter.buildRoundDetail(match, match.rounds[0]);

    assert.equal(detail.eventRows[0].title, '甲直杠');
    assert.match(detail.eventRows[0].detail, /丁 → 甲 2分/);
    assert.equal(detail.eventRows[1].title, '乙和牌 · 丙点炮');
    assert.equal(detail.eventRows[1].detail, '七对 2番');
    assert.equal(detail.transactionRows[1].formula, '1×2^2');
    assert.equal(detail.transactionRows[1].transferText, '丙 → 乙 4分');
    assert.equal(detail.winnerHands[0].winTile, 's7');
    assert.deepEqual(detail.scoreRows.map(function (row) { return row.score; }), [2, 4, -4, -2]);
});

test('单局详情页面从本地历史加载事件、牌面和逐笔支付', function () {
    var match = createCompletedMatch();
    var app = { globalData: { localData: matchService.upsertMatch(schema.createDefaultData(), match) } };
    global.getApp = function () { return app; };
    var calls = [];
    global.wx = { showToast: function (options) { calls.push(options.title); } };
    var definition = null;
    global.Page = function (value) { definition = value; };
    delete require.cache[require.resolve('../subpackages/sichuan/pages/result/result.js')];
    require('../subpackages/sichuan/pages/result/result.js');
    var page = {
        data: JSON.parse(JSON.stringify(definition.data)),
        setData: function (update) {
            Object.keys(update).forEach(function (key) { page.data[key] = update[key]; });
        }
    };
    Object.keys(definition).forEach(function (key) {
        if (typeof definition[key] === 'function') page[key] = definition[key];
    });

    page.onLoad({ id: 'detail-match', round: '0' });
    page.onShow();

    assert.equal(page.data.roundNumber, 1);
    assert.equal(page.data.dealerName, '甲');
    assert.equal(page.data.nextDealerName, '乙');
    assert.equal(page.data.eventRows.length, 2);
    assert.equal(page.data.transactionRows.length, 2);
    assert.equal(page.data.winnerHands.length, 1);
    assert.deepEqual(calls, []);
});
