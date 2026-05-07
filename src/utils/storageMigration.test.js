import test from 'node:test'
import assert from 'node:assert/strict'
import { DATA_VERSION } from '../data/mockData.js'
import { createDefaultPortfolioState, migratePortfolioData, normalizeHolding } from './storageMigration.js'

test('createDefaultPortfolioState returns versioned seed portfolio with FX snapshot', () => {
  const state = createDefaultPortfolioState()

  assert.equal(state.version, DATA_VERSION)
  assert.equal(state.holdings.length, 9)
  assert.equal(state.fxRate.base, 'USD')
  assert.equal(state.fxRate.quote, 'THB')
  assert.equal(state.fxRate.status, 'stale')
  assert.equal(state.marketData.quoteProvider, 'stooq')
  assert.equal(state.marketData.fxProvider, 'fxapi.app')
  assert.equal(Array.isArray(state.cashFlows), true)
})

test('migratePortfolioData upgrades v2 holdings with quote metadata instead of resetting', () => {
  const migrated = migratePortfolioData({
    version: 'v2-real',
    holdings: [{ ticker: 'TSM', shares: 1, averageCost: 100, currentPrice: 120 }],
    transactions: [{ id: 1, type: 'BUY', ticker: 'TSM', date: '2024-10-05', quantity: 1, price: 100 }],
    cash: 25,
  })

  assert.equal(migrated.version, DATA_VERSION)
  assert.equal(migrated.holdings[0].ticker, 'TSM')
  assert.equal(migrated.holdings[0].priceSource, 'seed')
  assert.equal(migrated.holdings[0].priceStatus, 'stale')
  assert.equal(migrated.cash, 0)
  assert.deepEqual(migrated.cashFlows, [])
  assert.equal(migrated.fxRate.rate > 0, true)
  assert.equal(migrated.marketData.autoRefresh, true)
})

test('migratePortfolioData rejects incompatible saved data', () => {
  assert.equal(migratePortfolioData({ version: 'future', holdings: [], transactions: [] }), null)
  assert.equal(migratePortfolioData({ version: 'v2-real', holdings: 'bad', transactions: [] }), null)
})

test('normalizeHolding fills missing fields and normalizes ticker', () => {
  const holding = normalizeHolding({ ticker: ' msft ', shares: '2', averageCost: '10', currentPrice: '15' })

  assert.equal(holding.ticker, 'MSFT')
  assert.equal(holding.shares, 2)
  assert.equal(holding.averageCost, 10)
  assert.equal(holding.currentPrice, 15)
  assert.equal(holding.priceStatus, 'stale')
})


test('cashFlows are migrated when present', () => {
  const migrated = migratePortfolioData({
    version: 'v5-phase3',
    holdings: [{ ticker: 'MSFT', shares: 1, averageCost: 100, currentPrice: 110 }],
    transactions: [],
    cashFlows: [{ id: 10, type: 'DEPOSIT', date: '2026-05-06', amount: '250', note: 'funding' }],
    cash: 250,
  })

  assert.equal(migrated.cash, 250)
  assert.equal(migrated.cashFlows.length, 1)
  assert.equal(migrated.cashFlows[0].amount, 250)
  assert.equal(migrated.cashFlows[0].type, 'DEPOSIT')
})


test('legacy saved cash is not treated as available wallet cash without cash flows', () => {
  const migrated = migratePortfolioData({
    version: 'v5-phase3',
    holdings: [{ ticker: 'MSFT', shares: 1, averageCost: 100, currentPrice: 110 }],
    transactions: [],
    cash: 2340.3,
  })

  assert.equal(migrated.cash, 0)
  assert.deepEqual(migrated.cashFlows, [])
})


test('historical transactions do not consume wallet deposits unless cashImpact is true', () => {
  const migrated = migratePortfolioData({
    version: 'v6-cash-wallet',
    holdings: [{ ticker: 'MSFT', shares: 1, averageCost: 100, currentPrice: 110 }],
    transactions: [{ id: 1, type: 'BUY', ticker: 'MSFT', date: '2026-01-01', quantity: 1, price: 100 }],
    cashFlows: [{ id: 2, type: 'DEPOSIT', date: '2026-05-06', amount: 400.02 }],
    cash: 0,
  })

  assert.equal(migrated.transactions[0].cashImpact, false)
  assert.equal(migrated.cash, 400.02)
})


test("watchlist items are migrated with target metadata", () => {
  const migrated = migratePortfolioData({
    version: "v7-cash-impact",
    holdings: [{ ticker: "MSFT", shares: 1, averageCost: 100, currentPrice: 110 }],
    transactions: [],
    watchlist: [{
      id: 20,
      ticker: " aapl ",
      companyName: "Apple Inc",
      currentPrice: "200",
      targetPrice: "240",
      targetDate: "2026-12-31",
      thesis: "Earnings growth",
      trigger: "Pullback below target entry",
      priority: "High",
    }],
  })

  assert.equal(migrated.version, DATA_VERSION)
  assert.equal(migrated.watchlist.length, 1)
  assert.equal(migrated.watchlist[0].ticker, "AAPL")
  assert.equal(migrated.watchlist[0].currentPrice, 200)
  assert.equal(migrated.watchlist[0].targetPrice, 240)
  assert.equal(migrated.watchlist[0].targetSource, "manual")
  assert.equal(migrated.watchlist[0].priority, "High")
})
