import test from 'node:test'
import assert from 'node:assert/strict'
import { calcHolding, calcPortfolioTotals, fmtPct } from './calculations.js'

test('calcHolding computes USD and THB values with explicit FX rate', () => {
  const holding = calcHolding({ ticker: 'ABC', shares: 2, averageCost: 10, currentPrice: 15 }, 35)

  assert.equal(holding.totalCost, 20)
  assert.equal(holding.marketValue, 30)
  assert.equal(holding.unrealizedPL, 10)
  assert.equal(holding.plPercent, 50)
  assert.equal(holding.totalCostTHB, 700)
  assert.equal(holding.marketValueTHB, 1050)
})

test('calcHolding handles missing or invalid numbers defensively', () => {
  const holding = calcHolding({ ticker: 'BAD', shares: 'nope', averageCost: 10, currentPrice: undefined }, 35)

  assert.equal(holding.shares, 0)
  assert.equal(holding.marketValue, 0)
  assert.equal(holding.plPercent, 0)
})

test('calcPortfolioTotals adds weights and portfolio totals', () => {
  const totals = calcPortfolioTotals([
    { ticker: 'AAA', shares: 1, averageCost: 10, currentPrice: 30 },
    { ticker: 'BBB', shares: 1, averageCost: 10, currentPrice: 10 },
  ], 30)

  assert.equal(totals.totalMarketValue, 40)
  assert.equal(totals.totalCost, 20)
  assert.equal(totals.totalPL, 20)
  assert.equal(totals.totalReturn, 100)
  assert.equal(totals.totalMarketValueTHB, 1200)
  assert.equal(totals.holdings[0].weight, 75)
  assert.equal(totals.holdings[1].weight, 25)
})

test('fmtPct never emits NaN for invalid input', () => {
  assert.equal(fmtPct(undefined), '+0.00%')
})
