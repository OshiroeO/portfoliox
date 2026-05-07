import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRebalancePlan, calculatePortfolioHealth, calculateRealizedPL, simulateDca } from './analytics.js'

const transactions = [
  { id: 1, type: 'BUY', ticker: 'AAA', date: '2026-01-01', quantity: 2, price: 10, fee: 0 },
  { id: 2, type: 'BUY', ticker: 'AAA', date: '2026-01-02', quantity: 1, price: 20, fee: 0 },
  { id: 3, type: 'SELL', ticker: 'AAA', date: '2026-01-03', quantity: 2.5, price: 16, fee: 1 },
]

test('calculateRealizedPL uses FIFO lots and sell fees', () => {
  const realized = calculateRealizedPL(transactions)

  assert.equal(realized.closedTrades.length, 1)
  assert.equal(realized.totalProceeds, 39)
  assert.equal(realized.totalCostBasis, 30)
  assert.equal(realized.totalRealizedPL, 9)
  assert.equal(realized.winRate, 100)
})

test('calculatePortfolioHealth summarizes concentration and risk', () => {
  const health = calculatePortfolioHealth([
    { ticker: 'AAA', shares: 2, averageCost: 10, currentPrice: 20, sector: 'Tech', riskLevel: 'High' },
    { ticker: 'BBB', shares: 1, averageCost: 10, currentPrice: 10, sector: 'ETF', riskLevel: 'Low' },
  ], transactions, 30)

  assert.equal(health.totalMarketValue, 50)
  assert.equal(health.largestPosition.ticker, 'AAA')
  assert.equal(health.topThreeWeight, 100)
  assert.equal(health.topSector.sector, 'Tech')
  assert.equal(health.highRiskWeight, 80)
  assert.equal(health.totalPLWithRealized, 29)
})

test('buildRebalancePlan calculates add and trim trades', () => {
  const plan = buildRebalancePlan([
    { ticker: 'AAA', marketValue: 80, currentPrice: 20, weight: 80, riskLevel: 'High' },
    { ticker: 'BBB', marketValue: 20, currentPrice: 10, weight: 20, riskLevel: 'Low' },
  ], 100, 'equal')

  const trim = plan.find(item => item.ticker === 'AAA')
  const add = plan.find(item => item.ticker === 'BBB')
  assert.equal(trim.action, 'Trim')
  assert.equal(trim.tradeValue, -30)
  assert.equal(add.action, 'Add')
  assert.equal(add.shares, 3)
})

test('simulateDca calculates new average cost from budget', () => {
  const result = simulateDca({ shares: 2, averageCost: 20, currentPrice: 10 }, 20)

  assert.equal(result.dcaShares, 2)
  assert.equal(result.newShares, 4)
  assert.equal(result.newAvg, 15)
  assert.equal(result.costReduction, 5)
})
