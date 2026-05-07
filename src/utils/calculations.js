import { FX_RATE } from '../data/mockData.js'

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function calcHolding(h = {}, fxRate = FX_RATE) {
  const rate = safeNumber(fxRate, FX_RATE)
  const shares = safeNumber(h.shares)
  const averageCost = safeNumber(h.averageCost)
  const currentPrice = safeNumber(h.currentPrice)
  const totalCost = shares * averageCost
  const marketValue = shares * currentPrice
  const unrealizedPL = marketValue - totalCost
  const plPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0
  const totalCostTHB = totalCost * rate
  const marketValueTHB = marketValue * rate
  const unrealizedPLTHB = unrealizedPL * rate

  return {
    ...h,
    shares,
    averageCost,
    currentPrice,
    totalCost,
    marketValue,
    unrealizedPL,
    plPercent,
    totalCostTHB,
    marketValueTHB,
    unrealizedPLTHB,
  }
}

export function calcPortfolioTotals(holdings = [], fxRate = FX_RATE) {
  const enriched = holdings.map(h => calcHolding(h, fxRate))
  const totalMarketValue = enriched.reduce((s, h) => s + h.marketValue, 0)
  const totalCost = enriched.reduce((s, h) => s + h.totalCost, 0)
  const totalPL = totalMarketValue - totalCost
  const totalReturn = totalCost > 0 ? (totalPL / totalCost) * 100 : 0
  const rate = safeNumber(fxRate, FX_RATE)
  const totalMarketValueTHB = totalMarketValue * rate
  const totalCostTHB = totalCost * rate
  const totalPLTHB = totalPL * rate
  const withWeight = enriched.map(h => ({
    ...h,
    weight: totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0,
  }))

  return { holdings: withWeight, totalMarketValue, totalCost, totalPL, totalReturn, totalMarketValueTHB, totalCostTHB, totalPLTHB }
}

export function fmt(n, decimals = 2) {
  const value = safeNumber(n)
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtUSD(n) {
  return '$' + fmt(Math.abs(safeNumber(n)))
}

export function fmtTHB(n, decimals = 0) {
  return '฿' + Math.abs(safeNumber(n)).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtPct(n) {
  const value = safeNumber(n)
  return (value >= 0 ? '+' : '') + fmt(value) + '%'
}

export function plClass(n) {
  const value = safeNumber(n)
  return value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral'
}

export function dcaSuggestion(h, fxRate = FX_RATE) {
  const enriched = calcHolding(h, fxRate)
  if (enriched.plPercent >= 0) {
    const target = enriched.currentPrice * 0.95
    return { action: 'Hold / Wait for Dip', targetPrice: target }
  }

  if (enriched.currentPrice <= 0) {
    return { action: 'Review Price Data', targetPrice: 0, dcaShares: 0, newAvg: enriched.averageCost }
  }

  const budget = 15000 / safeNumber(fxRate, FX_RATE)
  const dcaShares = parseFloat((budget / enriched.currentPrice).toFixed(4))
  const newCost = enriched.shares * enriched.averageCost + dcaShares * enriched.currentPrice
  const newShares = enriched.shares + dcaShares
  const newAvg = newShares > 0 ? newCost / newShares : enriched.averageCost
  return { action: 'Consider DCA', targetPrice: enriched.currentPrice, dcaShares, newAvg }
}
