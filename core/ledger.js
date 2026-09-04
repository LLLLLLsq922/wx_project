'use strict';

function ledgerError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
}

function copyBalances(initialBalances) {
    var result = {};
    var ids = Object.keys(initialBalances || {});
    for (var i = 0; i < ids.length; i++) {
        var amount = initialBalances[ids[i]];
        if (typeof amount !== 'number' || !isFinite(amount)) {
            throw ledgerError('INVALID_INITIAL_BALANCE', '初始分数必须是有限数字');
        }
        result[ids[i]] = amount;
    }
    return result;
}

function validateTransaction(transaction, participantIds) {
    if (!transaction || !Array.isArray(transaction.transfers) || transaction.transfers.length === 0) {
        throw ledgerError('EMPTY_TRANSACTION', '交易至少需要一笔转账');
    }

    var allowed = {};
    for (var p = 0; p < participantIds.length; p++) allowed[participantIds[p]] = true;

    for (var i = 0; i < transaction.transfers.length; i++) {
        var transfer = transaction.transfers[i];
        if (!allowed[transfer.from] || !allowed[transfer.to]) {
            throw ledgerError('UNKNOWN_PARTICIPANT', '交易包含未知账户');
        }
        if (transfer.from === transfer.to) {
            throw ledgerError('SAME_PARTICIPANT', '付款人与收款人不能相同');
        }
        if (typeof transfer.amount !== 'number' || !isFinite(transfer.amount) || transfer.amount <= 0) {
            throw ledgerError('INVALID_AMOUNT', '交易金额必须是正数');
        }
    }
    return true;
}

function sumBalances(balances) {
    var total = 0;
    var ids = Object.keys(balances);
    for (var i = 0; i < ids.length; i++) total += balances[ids[i]];
    return total;
}

function applyTransactions(initialBalances, transactions) {
    var balances = copyBalances(initialBalances);
    var participantIds = Object.keys(balances);
    var initialTotal = sumBalances(balances);
    transactions = transactions || [];

    for (var i = 0; i < transactions.length; i++) {
        var transaction = transactions[i];
        validateTransaction(transaction, participantIds);
        for (var j = 0; j < transaction.transfers.length; j++) {
            var transfer = transaction.transfers[j];
            balances[transfer.from] -= transfer.amount;
            balances[transfer.to] += transfer.amount;
        }
    }

    if (Math.abs(sumBalances(balances) - initialTotal) > 0.000001) {
        throw ledgerError('UNBALANCED_LEDGER', '账本总分不守恒');
    }
    return balances;
}

function calculateChanges(participantIds, transactions) {
    var zero = {};
    for (var i = 0; i < participantIds.length; i++) zero[participantIds[i]] = 0;
    return applyTransactions(zero, transactions);
}

module.exports = {
    validateTransaction: validateTransaction,
    applyTransactions: applyTransactions,
    calculateChanges: calculateChanges,
    sumBalances: sumBalances
};
