import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTransactionSet, cashFromCashFlows, cashFromTransactions, rebuildHoldingsFromTransactions } from './portfolioOperations.js'

const transactions = [
  { id: 1, type: 'BUY', ticker: 'AAA', companyName: 'AAA Inc', date: '2026-01-01', quantity: 2, price: 10, fee: 1, cashImpact: true },
  { id: 2, type: 'BUY', ticker: 'AAA', companyName: 'AAA Inc', date: '2026-01-02', quantity: 1, price: 16, fee: 0, cashImpact: true },
  { id: 3, type: 'SELL', ticker: 'AAA', companyName: 'AAA Inc', date: '2026-01-03', quantity: 1, price: 20, fee: 2, cashImpact: true },
]

test('rebuildHoldingsFromTransactions calculates remaining shares and average cost', () => {
  const holdings = rebuildHoldingsFromTransactions(transactions, [{
    ticker: 'AAA',
    currentPrice: 22,
    priceSource: 'stooq',
    priceStatus: 'fresh',
    priceUpdatedAt: '2026-01-04T10:00:00.000Z',
  }])

  assert.equal(holdings.length, 1)
  assert.equal(holdings[0].ticker, 'AAA')
  assert.equal(holdings[0].shares, 2)
  assert.equal(Number(holdings[0].averageCost.toFixed(4)), 12)
  assert.equal(holdings[0].currentPrice, 22)
  assert.equal(holdings[0].priceSource, 'stooq')
})

test('cashFromCashFlows calculates wallet deposits and withdrawals', () => {
  assert.equal(cashFromCashFlows([
    { type: 'DEPOSIT', amount: 100 },
    { type: 'WITHDRAW', amount: 25 },
  ]), 75)
})

test('cashFromTransactions recalculates cash from wallet flows and all transactions', () => {
  assert.equal(cashFromTransactions(transactions, [{ type: 'DEPOSIT', amount: 100 }]), 81)
})

test('applyTransactionSet sorts newest first and removes sold-out holdings', () => {
  const result = applyTransactionSet([
    { id: 1, type: 'BUY', ticker: 'BBB', date: '2026-01-01', quantity: 1, price: 10, cashImpact: true },
    { id: 2, type: 'SELL', ticker: 'BBB', date: '2026-01-02', quantity: 1, price: 12, cashImpact: true },
  ], [], [{ type: 'DEPOSIT', amount: 100 }])

  assert.equal(result.holdings.length, 0)
  assert.equal(result.transactions[0].id, 2)
  assert.equal(result.cash, 102)
})


test('cashFromTransactions never returns negative wallet cash', () => {
  assert.equal(cashFromTransactions([
    { type: 'BUY', ticker: 'AAA', quantity: 1, price: 100, fee: 0, cashImpact: true },
  ], []), 0)
})


test('cashFromTransactions ignores historical transactions without cashImpact', () => {
  assert.equal(cashFromTransactions([
    { type: 'BUY', ticker: 'AAA', quantity: 1, price: 100, fee: 0, cashImpact: false },
  ], [{ type: 'DEPOSIT', amount: 400.02 }]), 400.02)
})
