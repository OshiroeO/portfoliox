import { initialHoldings, initialTransactions, initialWatchlist, CASH_AVAILABLE, DATA_VERSION, PREV_VERSIONS } from '../data/mockData.js'
import { createSeedFxSnapshot, normalizeQuoteMetadata, QUOTE_TTL_MS, FX_TTL_MS } from '../providers/marketData.js'

export const STORAGE_KEY = 'portfolio_data'

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase()
}

function cashFromCashFlows(cashFlows = []) {
  return cashFlows.reduce((cash, flow) => {
    const amount = toNumber(flow.amount)
    if (flow.type === 'DEPOSIT') return cash + amount
    if (flow.type === 'WITHDRAW') return cash - amount
    return cash
  }, 0)
}

function cashFromTransactions(transactions = [], cashFlows = []) {
  const cash = transactions.reduce((balance, tx) => {
    if (tx.cashImpact !== true) return balance
    const value = toNumber(tx.price) * toNumber(tx.quantity)
    const fee = toNumber(tx.fee)
    if (tx.type === 'BUY') return balance - value - fee
    if (tx.type === 'SELL') return balance + value - fee
    return balance
  }, cashFromCashFlows(cashFlows))

  return Math.max(0, parseFloat(cash.toFixed(6)))
}

export function normalizeHolding(holding = {}, seedHolding = null) {
  const ticker = normalizeTicker(holding.ticker || seedHolding?.ticker)
  if (!ticker) return null

  const currentPrice = toNumber(holding.currentPrice, toNumber(seedHolding?.currentPrice, toNumber(holding.averageCost)))
  const quoteMeta = normalizeQuoteMetadata({
    updatedAt: holding.priceUpdatedAt,
    source: holding.priceSource ?? (seedHolding ? seedHolding.priceSource : 'manual'),
    status: holding.priceStatus,
  }, holding.quoteTtlMs ?? QUOTE_TTL_MS)

  return {
    ...seedHolding,
    ...holding,
    ticker,
    companyName: holding.companyName || seedHolding?.companyName || ticker,
    shares: toNumber(holding.shares, toNumber(seedHolding?.shares)),
    averageCost: toNumber(holding.averageCost, toNumber(seedHolding?.averageCost)),
    currentPrice,
    priceUpdatedAt: quoteMeta.updatedAt,
    priceSource: quoteMeta.source,
    priceStatus: quoteMeta.status,
    quoteTtlMs: quoteMeta.ttlMs,
    sector: holding.sector || seedHolding?.sector || 'Other',
    riskLevel: holding.riskLevel || seedHolding?.riskLevel || 'Medium',
    note: holding.note ?? seedHolding?.note ?? '',
  }
}

export function normalizeCashFlow(flow = {}) {
  if (!['DEPOSIT', 'WITHDRAW'].includes(flow.type)) return null
  const amount = toNumber(flow.amount)
  if (amount <= 0) return null

  return {
    ...flow,
    id: flow.id ?? Date.now(),
    type: flow.type,
    date: flow.date || new Date().toISOString().split('T')[0],
    amount,
    note: flow.note || '',
  }
}

export function normalizeTransaction(tx = {}) {
  const ticker = normalizeTicker(tx.ticker)
  if (!ticker || !['BUY', 'SELL'].includes(tx.type)) return null

  return {
    ...tx,
    id: tx.id ?? Date.now(),
    type: tx.type,
    ticker,
    companyName: tx.companyName || ticker,
    date: tx.date || new Date().toISOString().split('T')[0],
    quantity: toNumber(tx.quantity),
    price: toNumber(tx.price),
    fee: toNumber(tx.fee),
    note: tx.note || '',
    cashImpact: tx.cashImpact === true,
  }
}


export function normalizeWatchItem(item = {}) {
  const ticker = normalizeTicker(item.ticker)
  if (!ticker) return null

  const currentPrice = toNumber(item.currentPrice)
  const targetPrice = toNumber(item.targetPrice)
  const quoteMeta = normalizeQuoteMetadata({
    updatedAt: item.priceUpdatedAt,
    source: item.priceSource || 'manual',
    status: item.priceStatus,
  }, item.quoteTtlMs ?? QUOTE_TTL_MS)

  return {
    ...item,
    id: item.id ?? Date.now(),
    ticker,
    companyName: item.companyName || ticker,
    currentPrice,
    targetPrice,
    targetDate: item.targetDate || '',
    targetSource: item.targetSource || 'manual',
    thesis: item.thesis || '',
    trigger: item.trigger || '',
    priority: item.priority || 'Medium',
    priceUpdatedAt: quoteMeta.updatedAt,
    priceSource: quoteMeta.source,
    priceStatus: quoteMeta.status,
    quoteTtlMs: quoteMeta.ttlMs,
    addedAt: item.addedAt || new Date().toISOString(),
    updatedAt: item.updatedAt || null,
  }
}

export function normalizeFxSnapshot(snapshot = createSeedFxSnapshot()) {
  const seed = createSeedFxSnapshot()
  const rate = toNumber(snapshot.rate, seed.rate)
  const meta = normalizeQuoteMetadata(snapshot, snapshot.ttlMs ?? FX_TTL_MS)

  return {
    ...seed,
    ...snapshot,
    base: snapshot.base || seed.base,
    quote: snapshot.quote || seed.quote,
    rate,
    updatedAt: meta.updatedAt,
    source: meta.source,
    status: meta.status,
    ttlMs: meta.ttlMs,
  }
}

export function createDefaultPortfolioState() {
  return {
    version: DATA_VERSION,
    holdings: initialHoldings.map(h => normalizeHolding(h)).filter(Boolean),
    transactions: initialTransactions.map(normalizeTransaction).filter(Boolean),
    watchlist: initialWatchlist.map(normalizeWatchItem).filter(Boolean),
    cashFlows: [],
    cash: CASH_AVAILABLE,
    fxRate: createSeedFxSnapshot(),
    marketData: {
      quoteProvider: 'stooq',
      fxProvider: 'fxapi.app',
      autoRefresh: true,
      lastRefreshAt: null,
      lastRefreshError: null,
    },
  }
}

export function migratePortfolioData(saved) {
  if (!saved || typeof saved !== 'object') return null
  if (!Array.isArray(saved.holdings) || !Array.isArray(saved.transactions)) return null

  const canMigrate = saved.version === DATA_VERSION || PREV_VERSIONS.includes(saved.version) || !saved.version
  if (!canMigrate) return null

  const seedByTicker = new Map(initialHoldings.map(h => [h.ticker, h]))
  const holdings = saved.holdings
    .map(h => normalizeHolding(h, seedByTicker.get(normalizeTicker(h?.ticker))))
    .filter(Boolean)
  const transactions = saved.transactions.map(normalizeTransaction).filter(Boolean)
  const cashFlows = Array.isArray(saved.cashFlows)
    ? saved.cashFlows.map(normalizeCashFlow).filter(Boolean)
    : []
  const watchlist = Array.isArray(saved.watchlist)
    ? saved.watchlist.map(normalizeWatchItem).filter(Boolean)
    : []

  if (!holdings.length && saved.holdings.length) return null

  return {
    version: DATA_VERSION,
    holdings,
    transactions,
    watchlist,
    cashFlows,
    cash: cashFromTransactions(transactions, cashFlows),
    fxRate: normalizeFxSnapshot(saved.fxRate),
    marketData: {
      quoteProvider: saved.marketData?.quoteProvider || 'stooq',
      fxProvider: saved.marketData?.fxProvider || 'fxapi.app',
      autoRefresh: saved.marketData?.autoRefresh ?? true,
      lastRefreshAt: saved.marketData?.lastRefreshAt || null,
      lastRefreshError: saved.marketData?.lastRefreshError || null,
    },
  }
}

export function loadPortfolioState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return createDefaultPortfolioState()
    return migratePortfolioData(JSON.parse(raw)) ?? createDefaultPortfolioState()
  } catch {
    return createDefaultPortfolioState()
  }
}

export function serializePortfolioState(state) {
  return JSON.stringify({
    version: DATA_VERSION,
    holdings: state.holdings,
    transactions: state.transactions,
    watchlist: state.watchlist || [],
    cashFlows: state.cashFlows,
    cash: state.cash,
    fxRate: state.fxRate,
    marketData: state.marketData,
  })
}
