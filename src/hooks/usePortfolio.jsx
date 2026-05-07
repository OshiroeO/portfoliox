/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ManualProvider,
  StooqProvider,
  FxApiProvider,
  createSeedFxSnapshot,
} from '../providers/marketData'
import { initialHoldings } from '../data/mockData.js'
import { loadPortfolioState, migratePortfolioData, normalizeCashFlow, normalizeTransaction, normalizeWatchItem, serializePortfolioState, STORAGE_KEY } from '../utils/storageMigration'
import { applyTransactionSet, cashFromTransactions } from '../utils/portfolioOperations'

const PortfolioContext = createContext(null)

function quoteToHoldingPatch(quote, previous) {
  if (quote.status === 'error') {
    return {
      priceUpdatedAt: quote.updatedAt,
      priceSource: quote.source,
      priceStatus: 'error',
      priceError: quote.error,
    }
  }

  return {
    currentPrice: quote.price ?? previous.currentPrice,
    priceUpdatedAt: quote.updatedAt,
    priceSource: quote.source,
    priceStatus: quote.status,
    priceError: null,
    quoteTtlMs: quote.ttlMs,
  }
}


function quoteToWatchPatch(quote, previous) {
  if (quote.status === 'error') {
    return {
      priceUpdatedAt: quote.updatedAt,
      priceSource: quote.source,
      priceStatus: 'error',
      priceError: quote.error,
    }
  }

  return {
    currentPrice: quote.price ?? previous.currentPrice,
    priceUpdatedAt: quote.updatedAt,
    priceSource: quote.source,
    priceStatus: quote.status,
    priceError: null,
    quoteTtlMs: quote.ttlMs,
  }
}

export function PortfolioProvider({ children, user }) {
  const [state, setState] = useState(() => loadPortfolioState())
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState(null)
  const [dbLoading, setDbLoading] = useState(true)
  const userRef = useRef(user)
  const refreshMarketDataRef = useRef(null)
  const { holdings, transactions, watchlist = [], cashFlows = [], fxRate, marketData } = state
  const cash = cashFromTransactions(transactions, cashFlows)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    if (!user?.id) { setDbLoading(false); return }
    supabase
      .from('portfolio_state')
      .select('data')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.data) {
          const migrated = migratePortfolioData(data.data)
          if (migrated) setState(migrated)
        }
        setDbLoading(false)
      })
  }, [user?.id])

  useEffect(() => {
    if (dbLoading || !userRef.current?.id) return
    const uid = userRef.current.id
    const serialized = serializePortfolioState(state)
    localStorage.setItem(STORAGE_KEY, serialized)
    supabase
      .from('portfolio_state')
      .upsert({ id: uid, user_id: uid, data: JSON.parse(serialized), updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('Supabase save error:', error) })
  }, [state, dbLoading])

  async function refreshQuotes(tickers = [...holdings.map(h => h.ticker), ...watchlist.map(item => item.ticker)]) {
    const uniqueTickers = [...new Set(tickers.filter(Boolean))]
    if (!uniqueTickers.length) return null

    setMarketLoading(true)
    setMarketError(null)
    try {
      const quoteFallbacks = [...holdings, ...watchlist]
      const quotes = await StooqProvider.getQuotes(uniqueTickers, quoteFallbacks)
      const failures = Object.values(quotes).filter(q => q.status === 'error')

      setState(prev => ({
        ...prev,
        holdings: prev.holdings.map(h => (
          quotes[h.ticker] ? { ...h, ...quoteToHoldingPatch(quotes[h.ticker], h) } : h
        )),
        watchlist: (prev.watchlist || []).map(item => (
          quotes[item.ticker] ? { ...item, ...quoteToWatchPatch(quotes[item.ticker], item) } : item
        )),
        marketData: {
          ...prev.marketData,
          quoteProvider: StooqProvider.name,
          lastRefreshAt: new Date().toISOString(),
          lastRefreshError: failures.length ? `${failures.length} quote refresh failed` : null,
        },
      }))

      if (failures.length) throw new Error(`${failures.length} quote refresh failed`)
      return quotes
    } catch (error) {
      const message = error?.message || 'Quote refresh failed'
      setMarketError(message)
      setState(prev => ({
        ...prev,
        marketData: { ...prev.marketData, lastRefreshAt: new Date().toISOString(), lastRefreshError: message },
      }))
      return null
    } finally {
      setMarketLoading(false)
    }
  }

  async function refreshFxRate(base = 'USD', quote = 'THB') {
    setMarketLoading(true)
    setMarketError(null)
    try {
      const nextFx = await FxApiProvider.getFxRate(base, quote, fxRate)
      setState(prev => ({
        ...prev,
        fxRate: nextFx,
        marketData: {
          ...prev.marketData,
          fxProvider: FxApiProvider.name,
          lastRefreshAt: new Date().toISOString(),
          lastRefreshError: null,
        },
      }))
      return nextFx
    } catch (error) {
      const message = error?.message || 'FX refresh failed'
      setMarketError(message)
      setState(prev => ({
        ...prev,
        fxRate: { ...prev.fxRate, status: 'error' },
        marketData: { ...prev.marketData, lastRefreshAt: new Date().toISOString(), lastRefreshError: message },
      }))
      return null
    } finally {
      setMarketLoading(false)
    }
  }

  async function refreshMarketData() {
    const quotes = await refreshQuotes()
    const fx = await refreshFxRate()
    if (!quotes || !fx) {
      const message = !quotes ? 'Quote refresh failed' : 'FX refresh failed'
      setMarketError(message)
      setState(prev => ({
        ...prev,
        marketData: { ...prev.marketData, lastRefreshError: message },
      }))
      return null
    }
    return { quotes, fx }
  }

  function commitTransactionSet(prev, transactions) {
    const next = applyTransactionSet(transactions, prev.holdings, prev.cashFlows || [])
    return {
      ...prev,
      holdings: next.holdings,
      transactions: next.transactions,
      cash: next.cash,
    }
  }

  function addTransaction(tx) {
    const normalizedTx = normalizeTransaction({
      ...tx,
      ticker: String(tx.ticker || '').trim().toUpperCase(),
      id: Date.now(),
      cashImpact: true,
    })
    if (!normalizedTx) return

    setState(prev => commitTransactionSet(prev, [normalizedTx, ...prev.transactions]))
  }

  function updateTransaction(id, tx) {
    const existingTx = transactions.find(existing => existing.id === id)
    const normalizedTx = normalizeTransaction({
      ...tx,
      ticker: String(tx.ticker || '').trim().toUpperCase(),
      id,
      cashImpact: existingTx?.cashImpact === true,
    })
    if (!normalizedTx) return

    setState(prev => commitTransactionSet(
      prev,
      prev.transactions.map(existing => existing.id === id ? normalizedTx : existing)
    ))
  }

  function deleteTransaction(id) {
    setState(prev => commitTransactionSet(
      prev,
      prev.transactions.filter(tx => tx.id !== id)
    ))
  }
  function addCashFlow(flow) {
    const normalizedFlow = normalizeCashFlow({ ...flow, id: Date.now() })
    if (!normalizedFlow) return false

    setState(prev => {
      const cashFlows = [normalizedFlow, ...(prev.cashFlows || [])]
      return {
        ...prev,
        cashFlows,
        cash: cashFromTransactions(prev.transactions, cashFlows),
      }
    })
    return true
  }

  function deleteCashFlow(id) {
    setState(prev => {
      const cashFlows = (prev.cashFlows || []).filter(flow => flow.id !== id)
      return {
        ...prev,
        cashFlows,
        cash: cashFromTransactions(prev.transactions, cashFlows),
      }
    })
  }

  function addWatchItem(item) {
    const normalizedItem = normalizeWatchItem({
      ...item,
      ticker: String(item.ticker || '').trim().toUpperCase(),
      id: Date.now(),
      updatedAt: new Date().toISOString(),
    })
    if (!normalizedItem) return false

    setState(prev => ({
      ...prev,
      watchlist: [normalizedItem, ...(prev.watchlist || []).filter(existing => existing.ticker !== normalizedItem.ticker)],
    }))
    return true
  }

  function updateWatchItem(id, item) {
    const normalizedItem = normalizeWatchItem({
      ...item,
      ticker: String(item.ticker || '').trim().toUpperCase(),
      id,
      updatedAt: new Date().toISOString(),
    })
    if (!normalizedItem) return false

    setState(prev => ({
      ...prev,
      watchlist: (prev.watchlist || []).map(existing => existing.id === id ? normalizedItem : existing),
    }))
    return true
  }

  function deleteWatchItem(id) {
    setState(prev => ({
      ...prev,
      watchlist: (prev.watchlist || []).filter(item => item.id !== id),
    }))
  }

  function exportPortfolioData() {
    return {
      app: 'PortfolioX',
      exportedAt: new Date().toISOString(),
      ...state,
      cash: cashFromTransactions(state.transactions, state.cashFlows || []),
    }
  }

  function importPortfolioData(payload) {
    const migrated = migratePortfolioData(payload)
    if (!migrated) return false
    setState(migrated)
    setMarketError(null)
    autoRefreshStarted.current = false
    return true
  }


  function updatePrice(ticker, price) {
    const parsed = Number(price)
    if (!Number.isFinite(parsed) || parsed <= 0) return

    setState(prev => ({
      ...prev,
      holdings: prev.holdings.map(h => (
        h.ticker === ticker ? { ...h, ...ManualProvider.updateManualPrice(ticker, parsed), priceError: null } : h
      )),
    }))
  }

  function resetPrice(ticker) {
    const seed = initialHoldings.find(h => h.ticker === ticker)
    if (!seed) return false

    setState(prev => ({
      ...prev,
      holdings: prev.holdings.map(h => (
        h.ticker === ticker
          ? {
            ...h,
            currentPrice: seed.currentPrice,
            priceUpdatedAt: seed.priceUpdatedAt || null,
            priceSource: seed.priceSource || 'seed',
            priceStatus: seed.priceStatus || 'stale',
            priceError: null,
          }
          : h
      )),
    }))
    return true
  }

  function updateFxRate(rate) {
    const parsed = Number(rate)
    if (!Number.isFinite(parsed) || parsed <= 0) return

    setState(prev => ({
      ...prev,
      fxRate: {
        ...createSeedFxSnapshot(),
        ...prev.fxRate,
        rate: parsed,
        updatedAt: new Date().toISOString(),
        source: 'manual',
        status: 'fresh',
      },
    }))
  }

  function setAutoRefresh(autoRefresh) {
    setState(prev => ({
      ...prev,
      marketData: { ...prev.marketData, autoRefresh },
    }))
  }

  useEffect(() => { refreshMarketDataRef.current = refreshMarketData })

  const REFRESH_INTERVAL_MS = 3 * 60 * 1000

  useEffect(() => {
    if (dbLoading) return

    refreshMarketDataRef.current?.()

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshMarketDataRef.current?.()
    }, REFRESH_INTERVAL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') refreshMarketDataRef.current?.()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLoading])

  const value = {
    holdings,
    transactions,
    cash,
    cashFlows,
    watchlist,
    fxRate,
    fxRateValue: fxRate?.rate ?? createSeedFxSnapshot().rate,
    marketData,
    marketLoading,
    marketError,
    marketDataProvider: ManualProvider,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCashFlow,
    deleteCashFlow,
    addWatchItem,
    updateWatchItem,
    deleteWatchItem,
    exportPortfolioData,
    importPortfolioData,
    updatePrice,
    resetPrice,
    updateFxRate,
    refreshQuotes,
    refreshFxRate,
    refreshMarketData,
    setAutoRefresh,
  }

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  return useContext(PortfolioContext)
}
