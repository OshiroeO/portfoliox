import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Layers } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { calcPortfolioTotals, fmtUSD, fmtPct, fmt, plClass } from '../utils/calculations'
import { buildRebalancePlan, calculatePortfolioHealth, simulateDca } from '../utils/analytics'
import Card from '../components/Card'
import styles from './Analysis.module.css'

const SECTOR_COLORS = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#f85149', '#79c0ff', '#ff8c42']

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chartTooltip">
      <p className="chartTooltipLabel">{payload[0].name}</p>
      <p className="chartTooltipValue">{fmtUSD(payload[0].value)}</p>
    </div>
  )
}

function buildSectorData(holdings) {
  const map = {}
  holdings.forEach(h => {
    map[h.sector] = (map[h.sector] || 0) + h.marketValue
  })
  return Object.entries(map)
    .map(([sector, value]) => ({ sector, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
}

function rebalanceSuggestions(holdings) {
  const suggestions = []
  const avg = 100 / holdings.length
  holdings.forEach(h => {
    const diff = h.weight - avg
    if (diff > 10) suggestions.push({ ticker: h.ticker, action: 'Trim', diff, desc: `${fmt(h.weight)}% weight - ${fmt(diff)}% above equal-weight target` })
    else if (diff < -10) suggestions.push({ ticker: h.ticker, action: 'Add', diff, desc: `${fmt(h.weight)}% weight - ${fmt(Math.abs(diff))}% below equal-weight target` })
  })
  return suggestions
}

function dcaSuggestions(holdings, budget) {
  return holdings
    .filter(h => h.plPercent < 0)
    .sort((a, b) => a.plPercent - b.plPercent)
    .map(h => ({ ...h, simulation: simulateDca(h, budget) }))
}

export default function Analysis() {
  const { holdings, transactions, fxRateValue } = usePortfolio()
  const [dcaBudget, setDcaBudget] = useState(500)
  const [rebalanceMode, setRebalanceMode] = useState('equal')
  const { holdings: enriched, totalMarketValue, totalPL, totalReturn } = calcPortfolioTotals(holdings, fxRateValue)
  const health = calculatePortfolioHealth(holdings, transactions, fxRateValue)

  const sectorData = buildSectorData(enriched)
  const sortedByPL = [...enriched].sort((a, b) => b.plPercent - a.plPercent)
  const gainers = sortedByPL.filter(h => h.plPercent >= 0)
  const losers = [...sortedByPL].reverse().filter(h => h.plPercent < 0)
  const rebalance = rebalanceSuggestions(enriched)
  const rebalancePlan = buildRebalancePlan(enriched, totalMarketValue, rebalanceMode)
  const dcaList = dcaSuggestions(enriched, dcaBudget)
  const realized = health.realized

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analysis</h1>
        <p className={styles.subtitle}>Portfolio health, risk, and actionable insights</p>
      </div>

      <div className={styles.healthGrid}>
        {[
          { label: 'Unrealized P/L', value: `${totalPL >= 0 ? '+' : '-'}${fmtUSD(totalPL)}`, sub: fmtPct(totalReturn), cls: plClass(totalPL) },
          { label: 'Realized P/L', value: `${realized.totalRealizedPL >= 0 ? '+' : '-'}${fmtUSD(realized.totalRealizedPL)}`, sub: `${realized.closedTrades.length} closed trades`, cls: plClass(realized.totalRealizedPL) },
          { label: 'Total P/L', value: `${health.totalPLWithRealized >= 0 ? '+' : '-'}${fmtUSD(health.totalPLWithRealized)}`, sub: fmtPct(health.totalReturnWithRealized), cls: plClass(health.totalPLWithRealized) },
          realized.closedTrades.length > 0
            ? { label: 'Win Rate', value: fmtPct(realized.winRate), sub: `${realized.closedTrades.length} closed trades`, cls: realized.winRate >= 50 ? 'profit' : 'neutral' }
            : { label: 'Win Rate', value: '—', sub: 'No closed trades yet', cls: 'neutral' },
          { label: 'Largest Position', value: health.largestPosition?.ticker || 'N/A', sub: health.largestPosition ? `${fmt(health.largestPosition.weight)}% weight` : 'no positions', cls: health.largestPosition?.weight > 25 ? 'loss' : 'profit' },
          { label: 'Risk Score', value: `${fmt(health.riskScore, 1)} / 3.0`, sub: `${fmt(health.highRiskWeight)}% high-risk · Low=1, Med=2, High=3`, cls: health.highRiskWeight > 35 ? 'loss' : 'neutral', title: 'Weighted average of Low(1), Medium(2), High(3) risk holdings by market value' },
        ].map(metric => (
          <Card key={metric.label} className={styles.healthCard} title={metric.title || ''}>
            <span className={styles.healthLabel}>{metric.label}</span>
            <span className={`${styles.healthValue} ${metric.cls || ''}`}>{metric.value}</span>
            <span className={styles.healthSub}>{metric.sub}</span>
          </Card>
        ))}
      </div>

      <div className={styles.twoCol}>
        <Card>
          <h2 className={styles.sectionTitle}><Layers size={16} /> Sector Allocation</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sectorData} dataKey="value" nameKey="sector"
                cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {sectorData.map((_, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.sectorLegend}>
            {sectorData.map((s, i) => (
              <div key={s.sector} className={styles.sectorItem}>
                <span className={styles.sectorDot} style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                <span className={styles.sectorName}>{s.sector}</span>
                <span className={styles.sectorPct}>{fmt((s.value / totalMarketValue) * 100)}%</span>
                <span className={styles.sectorVal}>{fmtUSD(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}><AlertTriangle size={16} /> Stock Concentration</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={enriched.map(h => ({ ticker: h.ticker, weight: parseFloat(h.weight.toFixed(1)) }))}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal vertical={false} />
              <XAxis dataKey="ticker" tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={40} />
              <Bar dataKey="weight" radius={[6, 6, 0, 0]}>
                {enriched.map((h, i) => (
                  <Cell key={i} fill={
                    h.weight >= 35 ? 'var(--red)'
                    : h.weight >= 25 ? '#ff8c42'
                    : h.weight >= 15 ? 'var(--yellow)'
                    : 'var(--green)'
                  } />
                ))}
                <LabelList dataKey="weight" position="top"
                  formatter={v => `${v}%`}
                  style={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.concLegend}>
            <div className={styles.concItem}><span className={styles.concDot} style={{ background: 'var(--green)' }} />&lt; 15% Healthy</div>
            <div className={styles.concItem}><span className={styles.concDot} style={{ background: 'var(--yellow)' }} />15-25% Moderate</div>
            <div className={styles.concItem}><span className={styles.concDot} style={{ background: '#ff8c42' }} />25-35% High</div>
            <div className={styles.concItem}><span className={styles.concDot} style={{ background: 'var(--red)' }} />&gt; 35% Over</div>
          </div>
        </Card>
      </div>

      <div className={styles.twoCol}>
        <Card>
          <h2 className={styles.sectionTitle}><TrendingUp size={16} /> Top Gainers</h2>
          {gainers.length === 0
            ? <p className={styles.empty}>No profitable positions</p>
            : gainers.map(h => (
              <div key={h.ticker} className={styles.glRow}>
                <div className={styles.glLeft}>
                  <span className={styles.glTicker}>{h.ticker}</span>
                  <span className={styles.glCompany}>{h.companyName}</span>
                </div>
                <div className={styles.glRight}>
                  <span className="profit">{fmtPct(h.plPercent)}</span>
                  <span className={`${styles.glPL} profit`}>+{fmtUSD(h.unrealizedPL)}</span>
                </div>
              </div>
            ))
          }
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}><TrendingDown size={16} /> Top Losers</h2>
          {losers.length === 0
            ? <p className={styles.empty}>No losing positions</p>
            : losers.map(h => (
              <div key={h.ticker} className={styles.glRow}>
                <div className={styles.glLeft}>
                  <span className={styles.glTicker}>{h.ticker}</span>
                  <span className={styles.glCompany}>{h.companyName}</span>
                </div>
                <div className={styles.glRight}>
                  <span className="loss">{fmtPct(h.plPercent)}</span>
                  <span className={`${styles.glPL} loss`}>-{fmtUSD(Math.abs(h.unrealizedPL))}</span>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      <Card>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}><RefreshCw size={16} /> Rebalance Planner</h2>
          <div className={styles.segmented}>
            {['equal', 'risk'].map(mode => (
              <button key={mode} className={rebalanceMode === mode ? styles.segmentActive : ''} onClick={() => setRebalanceMode(mode)}>
                {mode === 'equal' ? 'Equal' : 'Risk'}
              </button>
            ))}
          </div>
        </div>
        {rebalance.length > 0 && (
          <div className={styles.rebalanceGrid}>
            {rebalance.map(r => (
              <div key={r.ticker} className={`${styles.rebalanceCard} ${r.action === 'Trim' ? styles.trimCard : styles.addCard}`}>
                <div className={styles.rebalanceTop}>
                  <span className={styles.rebalanceTicker}>{r.ticker}</span>
                  <span className={`${styles.rebalanceAction} ${r.action === 'Trim' ? 'loss' : 'profit'}`}>
                    {r.action === 'Trim' ? 'Trim' : 'Add'}
                  </span>
                </div>
                <p className={styles.rebalanceDesc}>{r.desc}</p>
              </div>
            ))}
          </div>
        )}
        <div className={styles.tradePlan}>
          {rebalancePlan.slice(0, 6).map(plan => (
            <div key={plan.ticker} className={styles.tradeRow}>
              <div>
                <span className={styles.tradeTicker}>{plan.ticker}</span>
                <span className={styles.tradeMeta}>{fmt(plan.currentWeight)}% to {fmt(plan.targetWeight)}%</span>
              </div>
              <span className={plan.action === 'Trim' ? 'loss' : plan.action === 'Add' ? 'profit' : 'neutral'}>{plan.action}</span>
              <span>{plan.tradeValue >= 0 ? '+' : '-'}{fmtUSD(plan.tradeValue)}</span>
              <span>{plan.shares >= 0 ? '+' : ''}{fmt(plan.shares, 4)} sh</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}><TrendingDown size={16} /> DCA Simulator</h2>
          <div className={styles.budgetControl}>
            <span>$</span>
            <input type="number" min="0" step="50" value={dcaBudget} onChange={e => setDcaBudget(Number(e.target.value))} />
          </div>
        </div>
        {dcaList.length === 0 ? (
          <div className={styles.allGoodBox}>
            <div>
              <p className={styles.allGoodTitle}>No losing positions</p>
              <p className={styles.allGoodSub}>DCA simulator appears when a position is below cost basis.</p>
            </div>
          </div>
        ) : (
          <div className={styles.dcaGrid}>
            {dcaList.map(d => (
              <div key={d.ticker} className={styles.dcaCard}>
                <div className={styles.dcaHeader}>
                  <div>
                    <span className={styles.dcaTicker}>{d.ticker}</span>
                    <span className={styles.dcaCompany}>{d.companyName}</span>
                  </div>
                  <span className="loss">{fmtPct(d.plPercent)}</span>
                </div>
                <div className={styles.dcaRows}>
                  <div className={styles.dcaRow}><span>Current Price</span><span>{fmtUSD(d.currentPrice)}</span></div>
                  <div className={styles.dcaRow}><span>Avg Cost</span><span>{fmtUSD(d.averageCost)}</span></div>
                  <div className={styles.dcaRow}><span>DCA Shares</span><span className="profit">{fmt(d.simulation.dcaShares, 4)}</span></div>
                  <div className={styles.dcaRow}><span>New Average</span><span className="profit">{fmtUSD(d.simulation.newAvg)}</span></div>
                  <div className={styles.dcaRow}><span>Cost Reduction</span><span className="profit">{fmtUSD(d.simulation.costReduction)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
