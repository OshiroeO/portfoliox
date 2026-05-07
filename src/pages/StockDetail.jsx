import { useParams, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Target, Layers } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { calcHolding, calcPortfolioTotals, fmtUSD, fmtPct, fmt, plClass } from '../utils/calculations'
import Card from '../components/Card'
import Badge from '../components/Badge'
import styles from './StockDetail.module.css'

function buildPriceHistory(ticker, transactions, currentPrice) {
  const txs = transactions.filter(t => t.ticker === ticker).sort((a, b) => a.date.localeCompare(b.date))
  if (!txs.length) return []
  const points = txs.map(t => ({ date: t.date, price: t.price }))
  points.push({ date: new Date().toISOString().split('T')[0], price: currentPrice })
  return points
}

const PriceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chartTooltip">
      <p className="chartTooltipLabel">{label}</p>
      <p style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtUSD(payload[0].value)}</p>
      {payload[1] && <p style={{ color: 'var(--yellow)', fontWeight: 600 }}>Avg: {fmtUSD(payload[1].value)}</p>}
    </div>
  )
}

function riskColor(level) {
  return { High: 'var(--red)', Medium: 'var(--yellow)', Low: 'var(--green)' }[level] || 'var(--text-muted)'
}

function positionWarning(weight) {
  if (weight >= 40) return { level: 'danger', msg: 'Very high concentration — consider trimming' }
  if (weight >= 25) return { level: 'warn', msg: 'High concentration — monitor closely' }
  if (weight >= 15) return { level: 'caution', msg: 'Moderate concentration — acceptable' }
  return { level: 'ok', msg: 'Well-diversified position size' }
}

function dcaAnalysis(holding, cash) {
  const { plPercent, currentPrice, averageCost, shares, totalCost } = holding
  const dcaBudget = Math.min(cash, 500)
  const dcaShares = Math.floor(dcaBudget / currentPrice)
  const newAvg = dcaShares > 0
    ? (totalCost + dcaShares * currentPrice) / (shares + dcaShares)
    : averageCost

  if (plPercent >= 15) {
    return {
      action: 'Momentum Hold',
      icon: '🚀',
      desc: 'Stock is up strongly. Hold your position and let winners run.',
      targetPrice: (currentPrice * 0.92).toFixed(2),
      targetLabel: 'Consider adding on a 8% dip',
      dcaShares: 0,
      newAvg: averageCost,
      suggestion: 'Wait for a pullback before adding more shares.',
    }
  }
  if (plPercent >= 0) {
    return {
      action: 'Hold',
      icon: '✅',
      desc: 'Position is slightly profitable. No urgency to add.',
      targetPrice: (currentPrice * 0.95).toFixed(2),
      targetLabel: '5% dip target to add',
      dcaShares,
      newAvg,
      suggestion: dcaShares > 0
        ? `Buy ${dcaShares} more @ ${fmtUSD(currentPrice)} → new avg ${fmtUSD(newAvg)}`
        : 'Insufficient cash for DCA',
    }
  }
  if (plPercent >= -15) {
    return {
      action: 'Consider DCA',
      icon: '💡',
      desc: 'Position is slightly down. DCA can reduce your average cost.',
      targetPrice: (averageCost * 0.90).toFixed(2),
      targetLabel: 'Strong support target',
      dcaShares,
      newAvg,
      suggestion: dcaShares > 0
        ? `Buy ${dcaShares} shares @ ${fmtUSD(currentPrice)} → avg drops to ${fmtUSD(newAvg)}`
        : 'Add cash to enable DCA',
    }
  }
  return {
    action: 'Evaluate Exit / DCA',
    icon: '⚠️',
    desc: 'Significant loss. Reassess thesis before averaging down.',
    targetPrice: (averageCost * 0.85).toFixed(2),
    targetLabel: 'Cut-loss consideration level',
    dcaShares,
    newAvg,
    suggestion: 'Only DCA if your investment thesis is still intact.',
  }
}

export default function StockDetail() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const { holdings, transactions, cash, fxRateValue } = usePortfolio()
  const { holdings: enriched } = calcPortfolioTotals(holdings, fxRateValue)

  const holding = enriched.find(h => h.ticker === ticker)

  if (!holding) {
    return (
      <div className={styles.notFound}>
        <p>Ticker <strong>{ticker}</strong> not found in portfolio.</p>
        <button className={styles.backBtn} onClick={() => navigate('/holdings')}>
          ← Back to Holdings
        </button>
      </div>
    )
  }

  const enrichedH = calcHolding(holding, fxRateValue)
  const priceHistory = buildPriceHistory(ticker, transactions, holding.currentPrice)
  const warning = positionWarning(holding.weight)
  const dca = dcaAnalysis(enrichedH, cash)
  const txForStock = transactions.filter(t => t.ticker === ticker)

  const plCls = plClass(enrichedH.unrealizedPL)

  return (
    <div className={styles.page}>
      {/* Back */}
      <button className={styles.backBtn} onClick={() => navigate('/holdings')}>
        <ArrowLeft size={16} /> Back to Holdings
      </button>

      {/* Hero header */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.tickerBadge}>{ticker}</div>
          <div>
            <h1 className={styles.companyName}>{holding.companyName}</h1>
            <div className={styles.heroMeta}>
              <span className={styles.sector}>{holding.sector}</span>
              <Badge label={holding.riskLevel} />
            </div>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.currentPrice}>{fmtUSD(holding.currentPrice)}</div>
          <div className={`${styles.priceChange} ${plCls}`}>
            {enrichedH.unrealizedPL >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {fmtPct(enrichedH.plPercent)} ({enrichedH.unrealizedPL >= 0 ? '+' : '-'}{fmtUSD(enrichedH.unrealizedPL)})
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className={styles.metricsGrid}>
        {[
          { label: 'Shares Held', value: fmt(holding.shares, 0) },
          { label: 'Average Cost', value: fmtUSD(holding.averageCost) },
          { label: 'Current Price', value: fmtUSD(holding.currentPrice) },
          { label: 'Total Cost', value: fmtUSD(enrichedH.totalCost) },
          { label: 'Market Value', value: fmtUSD(enrichedH.marketValue) },
          { label: 'Unrealized P/L', value: (enrichedH.unrealizedPL >= 0 ? '+' : '-') + fmtUSD(enrichedH.unrealizedPL), cls: plCls },
          { label: 'Return %', value: fmtPct(enrichedH.plPercent), cls: plCls },
          { label: 'Portfolio Weight', value: fmt(holding.weight) + '%' },
        ].map(m => (
          <Card key={m.label} className={styles.metricCard}>
            <p className={styles.metricLabel}>{m.label}</p>
            <p className={`${styles.metricValue} ${m.cls || ''}`}>{m.value}</p>
          </Card>
        ))}
      </div>

      <div className={styles.twoCol}>
        {/* Price chart */}
        <Card className={styles.chartCard}>
          <h2 className={styles.sectionTitle}>
            <TrendingUp size={16} /> Price History
          </h2>
          {priceHistory.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={priceHistory.map(p => ({ ...p, avg: holding.averageCost }))}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`priceGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `$${v}`} width={52} />
                <Tooltip content={<PriceTooltip />} />
                <ReferenceLine y={holding.averageCost} stroke="var(--yellow)"
                  strokeDasharray="4 4" label={{ value: 'Avg Cost', fill: 'var(--yellow)', fontSize: 11 }} />
                <Area type="monotone" dataKey="price"
                  stroke="var(--accent)" strokeWidth={2.5}
                  fill={`url(#priceGrad-${ticker})`}
                  dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                  name="Price" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.noChart}>Not enough data for chart</div>
          )}
        </Card>

        {/* DCA / Target */}
        <Card className={styles.dcaCard}>
          <h2 className={styles.sectionTitle}>
            <Target size={16} /> DCA &amp; Target Analysis
          </h2>
          <div className={styles.dcaAction}>
            <span className={styles.dcaIcon}>{dca.icon}</span>
            <div>
              <div className={styles.dcaActionLabel}>{dca.action}</div>
              <div className={styles.dcaDesc}>{dca.desc}</div>
            </div>
          </div>
          <div className={styles.dcaRows}>
            <div className={styles.dcaRow}>
              <span className={styles.dcaKey}>Target Buy Price</span>
              <span className={styles.dcaVal}>{fmtUSD(Number(dca.targetPrice))}</span>
            </div>
            <div className={styles.dcaRowSub}>{dca.targetLabel}</div>
            <div className={styles.dcaRow}>
              <span className={styles.dcaKey}>Current Price</span>
              <span className={styles.dcaVal}>{fmtUSD(holding.currentPrice)}</span>
            </div>
            <div className={styles.dcaRow}>
              <span className={styles.dcaKey}>Current Avg Cost</span>
              <span className={styles.dcaVal}>{fmtUSD(holding.averageCost)}</span>
            </div>
            {dca.dcaShares > 0 && (
              <>
                <div className={styles.dcaRow}>
                  <span className={styles.dcaKey}>DCA Shares (w/ $500)</span>
                  <span className={styles.dcaVal}>{dca.dcaShares} shares</span>
                </div>
                <div className={styles.dcaRow}>
                  <span className={styles.dcaKey}>New Average Cost</span>
                  <span className={`${styles.dcaVal} ${plClass(dca.newAvg - holding.averageCost) === 'profit' ? '' : 'profit'}`}>
                    {fmtUSD(dca.newAvg)}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className={styles.dcaSuggestionBox}>
            <span className={styles.dcaSuggestionLabel}>Suggestion</span>
            <p className={styles.dcaSuggestion}>{dca.suggestion}</p>
          </div>
        </Card>
      </div>

      <div className={styles.twoCol}>
        {/* Position size warning */}
        <Card className={styles.warnCard}>
          <h2 className={styles.sectionTitle}>
            <AlertTriangle size={16} /> Position Size Risk
          </h2>
          <div className={styles.weightBar}>
            <div className={styles.weightBarLabel}>
              <span>{ticker} weight</span>
              <span className={styles.weightPct}>{fmt(holding.weight)}%</span>
            </div>
            <div className={styles.barBg}>
              <div
                className={`${styles.barFill} ${styles[warning.level]}`}
                style={{ width: `${Math.min(holding.weight, 100)}%` }}
              />
            </div>
            <div className={styles.barScale}>
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>
          <div className={`${styles.warnMsg} ${styles[warning.level]}`}>
            <AlertTriangle size={14} />
            <span>{warning.msg}</span>
          </div>
          <div className={styles.riskDetail}>
            <div className={styles.riskRow}>
              <span className={styles.riskKey}>Risk Level</span>
              <span style={{ color: riskColor(holding.riskLevel), fontWeight: 700 }}>{holding.riskLevel}</span>
            </div>
            <div className={styles.riskRow}>
              <span className={styles.riskKey}>Sector</span>
              <span className={styles.riskVal}>{holding.sector}</span>
            </div>
            <div className={styles.riskRow}>
              <span className={styles.riskKey}>Position Value</span>
              <span className={styles.riskVal}>{fmtUSD(enrichedH.marketValue)}</span>
            </div>
            <div className={styles.riskRow}>
              <span className={styles.riskKey}>Portfolio Weight</span>
              <span className={styles.riskVal}>{fmt(holding.weight)}%</span>
            </div>
          </div>
        </Card>

        {/* Transaction history for this stock */}
        <Card>
          <h2 className={styles.sectionTitle}>
            <Layers size={16} /> Transaction History
          </h2>
          {txForStock.length === 0
            ? <div className={styles.noChart}>No transactions recorded</div>
            : (
              <div className={styles.txList}>
                {txForStock.map(tx => (
                  <div key={tx.id} className={styles.txRow}>
                    <span className={`${styles.txType} ${tx.type === 'BUY' ? 'profit' : 'loss'}`}>{tx.type}</span>
                    <span className={styles.txDate}>{tx.date}</span>
                    <span className={styles.txQty}>{fmt(tx.quantity, 0)} shares</span>
                    <span className={styles.txPrice}>@ {fmtUSD(tx.price)}</span>
                    <span className={`${styles.txTotal} ${tx.type === 'BUY' ? 'loss' : 'profit'}`}>
                      {tx.type === 'BUY' ? '-' : '+'}{fmtUSD(tx.price * tx.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </Card>
      </div>
    </div>
  )
}
