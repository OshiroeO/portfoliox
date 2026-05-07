import { calcPortfolioTotals } from './calculations.js'

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function sortOldestFirst(transactions) {
  return [...transactions].sort((a, b) => {
    const dateCompare = String(a.date || '').localeCompare(String(b.date || ''))
    if (dateCompare !== 0) return dateCompare
    return Number(a.id || 0) - Number(b.id || 0)
  })
}

export function calculateRealizedPL(transactions = []) {
  const lotsByTicker = new Map()
  const closedTrades = []

  sortOldestFirst(transactions).forEach(tx => {
    const ticker = String(tx.ticker || '').toUpperCase()
    const quantity = safeNumber(tx.quantity)
    const price = safeNumber(tx.price)
    const fee = safeNumber(tx.fee)
    if (!ticker || quantity <= 0 || price <= 0) return

    if (tx.type === 'BUY') {
      const lotCost = quantity * price + fee
      const lot = { quantity, costPerShare: lotCost / quantity, date: tx.date }
      lotsByTicker.set(ticker, [...(lotsByTicker.get(ticker) || []), lot])
      return
    }

    if (tx.type !== 'SELL') return

    let remaining = quantity
    let costBasis = 0
    const lots = lotsByTicker.get(ticker) || []

    while (remaining > 0 && lots.length) {
      const lot = lots[0]
      const used = Math.min(remaining, lot.quantity)
      costBasis += used * lot.costPerShare
      lot.quantity = parseFloat((lot.quantity - used).toFixed(8))
      remaining = parseFloat((remaining - used).toFixed(8))
      if (lot.quantity <= 0) lots.shift()
    }

    lotsByTicker.set(ticker, lots)

    const soldQuantity = quantity - remaining
    const proceeds = soldQuantity * price - fee
    const realizedPL = proceeds - costBasis
    if (soldQuantity > 0) {
      closedTrades.push({
        id: tx.id,
        ticker,
        date: tx.date,
        quantity: soldQuantity,
        proceeds,
        costBasis,
        realizedPL,
        returnPct: costBasis > 0 ? (realizedPL / costBasis) * 100 : 0,
      })
    }
  })

  const totalRealizedPL = closedTrades.reduce((sum, trade) => sum + trade.realizedPL, 0)
  const totalProceeds = closedTrades.reduce((sum, trade) => sum + trade.proceeds, 0)
  const totalCostBasis = closedTrades.reduce((sum, trade) => sum + trade.costBasis, 0)
  const winningTrades = closedTrades.filter(trade => trade.realizedPL > 0).length

  return {
    closedTrades,
    totalRealizedPL,
    totalProceeds,
    totalCostBasis,
    winRate: closedTrades.length ? (winningTrades / closedTrades.length) * 100 : 0,
  }
}

export function calculatePortfolioHealth(holdings = [], transactions = [], fxRate) {
  const totals = calcPortfolioTotals(holdings, fxRate)
  const enriched = totals.holdings
  const realized = calculateRealizedPL(transactions)
  const sortedByWeight = [...enriched].sort((a, b) => b.weight - a.weight)
  const largestPosition = sortedByWeight[0] || null
  const topThreeWeight = sortedByWeight.slice(0, 3).reduce((sum, h) => sum + h.weight, 0)
  const sectorWeights = Object.entries(enriched.reduce((map, h) => {
    map[h.sector] = (map[h.sector] || 0) + h.weight
    return map
  }, {})).map(([sector, weight]) => ({ sector, weight })).sort((a, b) => b.weight - a.weight)
  const highRiskWeight = enriched.filter(h => h.riskLevel === 'High').reduce((sum, h) => sum + h.weight, 0)
  const riskScore = Math.round(enriched.reduce((sum, h) => {
    const score = h.riskLevel === 'High' ? 3 : h.riskLevel === 'Medium' ? 2 : 1
    return sum + (score * h.weight)
  }, 0) / 100 * 10) / 10
  const totalPLWithRealized = totals.totalPL + realized.totalRealizedPL
  const totalReturnWithRealized = totals.totalCost > 0 ? (totalPLWithRealized / totals.totalCost) * 100 : 0
  const investedCapital = transactions
    .filter(tx => tx.type === 'BUY')
    .reduce((sum, tx) => sum + safeNumber(tx.quantity) * safeNumber(tx.price) + safeNumber(tx.fee), 0)

  return {
    ...totals,
    realized,
    largestPosition,
    topThreeWeight,
    sectorWeights,
    topSector: sectorWeights[0] || null,
    highRiskWeight,
    riskScore,
    totalPLWithRealized,
    totalReturnWithRealized,
    investedCapital,
  }
}

export function buildRebalancePlan(holdings = [], totalMarketValue = 0, mode = 'equal') {
  if (!holdings.length || totalMarketValue <= 0) return []
  const lowRiskTarget = 12
  const mediumRiskTarget = 10
  const highRiskTarget = 7
  const equalTarget = 100 / holdings.length

  return holdings.map(h => {
    const targetWeight = mode === 'risk'
      ? h.riskLevel === 'High' ? highRiskTarget : h.riskLevel === 'Medium' ? mediumRiskTarget : lowRiskTarget
      : equalTarget
    const targetValue = (targetWeight / 100) * totalMarketValue
    const tradeValue = targetValue - h.marketValue
    const shares = h.currentPrice > 0 ? tradeValue / h.currentPrice : 0

    return {
      ticker: h.ticker,
      currentWeight: h.weight,
      targetWeight,
      currentValue: h.marketValue,
      targetValue,
      tradeValue,
      shares,
      action: Math.abs(tradeValue) < 25 ? 'Hold' : tradeValue > 0 ? 'Add' : 'Trim',
    }
  }).sort((a, b) => Math.abs(b.tradeValue) - Math.abs(a.tradeValue))
}

export function simulateDca(holding, budget = 0) {
  const currentPrice = safeNumber(holding?.currentPrice)
  const shares = safeNumber(holding?.shares)
  const averageCost = safeNumber(holding?.averageCost)
  const amount = Math.max(0, safeNumber(budget))
  if (!holding || currentPrice <= 0 || amount <= 0) {
    return { dcaShares: 0, newShares: shares, newAvg: averageCost, costReduction: 0, newMarketValue: shares * currentPrice }
  }

  const dcaShares = amount / currentPrice
  const newShares = shares + dcaShares
  const newAvg = newShares > 0 ? ((shares * averageCost) + amount) / newShares : averageCost
  const costReduction = averageCost - newAvg

  return {
    dcaShares,
    newShares,
    newAvg,
    costReduction,
    newMarketValue: newShares * currentPrice,
  }
}
