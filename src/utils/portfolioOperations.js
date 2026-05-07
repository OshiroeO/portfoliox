import { normalizeHolding, normalizeTransaction } from './storageMigration.js'
import { createManualQuoteUpdate } from '../providers/marketData.js'

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function byDateAscending(a, b) {
  const dateCompare = String(a.date || '').localeCompare(String(b.date || ''))
  if (dateCompare !== 0) return dateCompare
  return Number(a.id || 0) - Number(b.id || 0)
}

function preserveMarketFields(existing, fallbackPrice) {
  if (!existing) return createManualQuoteUpdate(fallbackPrice)
  return {
    currentPrice: toNumber(existing.currentPrice, fallbackPrice),
    priceUpdatedAt: existing.priceUpdatedAt ?? null,
    priceSource: existing.priceSource ?? 'manual',
    priceStatus: existing.priceStatus ?? 'stale',
    priceError: existing.priceError ?? null,
    quoteTtlMs: existing.quoteTtlMs,
  }
}

export function rebuildHoldingsFromTransactions(transactions, previousHoldings = []) {
  const previousByTicker = new Map(previousHoldings.map(h => [h.ticker, h]))
  const holdingsByTicker = new Map()

  transactions
    .map(normalizeTransaction)
    .filter(Boolean)
    .sort(byDateAscending)
    .forEach(tx => {
      const existing = holdingsByTicker.get(tx.ticker)

      if (tx.type === 'BUY') {
        if (existing) {
          const shares = existing.shares + tx.quantity
          const averageCost = shares > 0
            ? ((existing.shares * existing.averageCost) + (tx.quantity * tx.price)) / shares
            : tx.price
          holdingsByTicker.set(tx.ticker, {
            ...existing,
            shares,
            averageCost,
            companyName: existing.companyName || tx.companyName || tx.ticker,
            sector: existing.sector || tx.sector || 'Other',
            riskLevel: existing.riskLevel || tx.riskLevel || 'Medium',
            note: existing.note || tx.note || '',
          })
          return
        }

        const previous = previousByTicker.get(tx.ticker)
        holdingsByTicker.set(tx.ticker, normalizeHolding({
          ticker: tx.ticker,
          companyName: tx.companyName || previous?.companyName || tx.ticker,
          shares: tx.quantity,
          averageCost: tx.price,
          ...preserveMarketFields(previous, tx.price),
          sector: tx.sector || previous?.sector || 'Other',
          riskLevel: tx.riskLevel || previous?.riskLevel || 'Medium',
          note: tx.note || previous?.note || '',
        }))
        return
      }

      if (tx.type === 'SELL' && existing) {
        const remaining = parseFloat((existing.shares - tx.quantity).toFixed(6))
        if (remaining <= 0) holdingsByTicker.delete(tx.ticker)
        else holdingsByTicker.set(tx.ticker, { ...existing, shares: remaining })
      }
    })

  return [...holdingsByTicker.values()].filter(Boolean)
}

export function cashFromCashFlows(cashFlows = []) {
  return cashFlows.reduce((cash, flow) => {
    const amount = toNumber(flow.amount)
    if (flow.type === 'DEPOSIT') return cash + amount
    if (flow.type === 'WITHDRAW') return cash - amount
    return cash
  }, 0)
}

export function cashFromTransactions(transactions, cashFlows = []) {
  const cash = transactions
    .map(normalizeTransaction)
    .filter(Boolean)
    .reduce((balance, tx) => {
      if (tx.cashImpact !== true) return balance
      const value = tx.price * tx.quantity
      if (tx.type === 'BUY') return balance - value - tx.fee
      if (tx.type === 'SELL') return balance + value - tx.fee
      return balance
    }, cashFromCashFlows(cashFlows))

  return Math.max(0, parseFloat(cash.toFixed(6)))
}

export function applyTransactionSet(transactions, previousHoldings, cashFlows = []) {
  const normalized = transactions.map(normalizeTransaction).filter(Boolean)
  return {
    transactions: normalized.sort((a, b) => Number(b.id || 0) - Number(a.id || 0)),
    holdings: rebuildHoldingsFromTransactions(normalized, previousHoldings),
    cash: cashFromTransactions(normalized, cashFlows),
  }
}
