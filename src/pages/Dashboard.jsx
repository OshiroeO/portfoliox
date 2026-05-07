import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Link } from 'react-router-dom'
import { usePortfolio } from '../hooks/usePortfolio'
import { calcPortfolioTotals, fmtUSD, fmtTHB, fmtPct, plClass } from '../utils/calculations'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import HoldingsTable from '../components/HoldingsTable'
import { quoteAgeLabel } from '../providers/marketData'
import styles from './Dashboard.module.css'

const PIE_COLORS = ['#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#f85149', '#79c0ff', '#ff8c42', '#a5d6ff', '#ffa6a0']

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chartTooltip">
      <p className="chartTooltipLabel">{payload[0].name}</p>
      <p className="chartTooltipValue">฿{payload[0].value?.toLocaleString()}</p>
    </div>
  )
}

const PerfTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chartTooltip">
      <p className="chartTooltipLabel">{label}</p>
      <p style={{ color: 'var(--accent)', fontWeight: 700 }}>฿{payload[0].value?.toLocaleString()}</p>
    </div>
  )
}

export default function Dashboard() {
  const { holdings, cash, fxRate, fxRateValue } = usePortfolio()
  const [snapshots, setSnapshots] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('portfolio_snapshots')
        .select('date, value_thb, cost_thb, pl_thb')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .then(({ data }) => {
          if (data?.length) setSnapshots(data.map(s => ({ date: s.date, value: s.value_thb, cost: s.cost_thb, pl: s.pl_thb })))
        })
    })
  }, [])
  const { holdings: enriched, totalMarketValue, totalCost, totalPL, totalReturn,
    totalMarketValueTHB, totalCostTHB, totalPLTHB } = calcPortfolioTotals(holdings, fxRateValue)

  const cashTHB = cash * fxRateValue
  const totalPortfolioValue = totalMarketValue + cash
  const totalPortfolioValueTHB = totalMarketValueTHB + cashTHB
  const cashWeight = totalPortfolioValue > 0 ? (cash / totalPortfolioValue) * 100 : 0
  const stockWeight = totalPortfolioValue > 0 ? (totalMarketValue / totalPortfolioValue) * 100 : 0
  const pieData = enriched.map(h => ({ name: h.ticker, value: Math.round(h.marketValueTHB) }))
  const plCls = plClass(totalPL)
  const updatedPrices = enriched.filter(h => h.priceUpdatedAt)
  const latestPriceUpdate = updatedPrices
    .map(h => h.priceUpdatedAt)
    .sort((a, b) => new Date(b) - new Date(a))[0]
  const staleCount = enriched.filter(h => h.priceStatus !== 'fresh').length
  const sortedByWeight = [...enriched].sort((a, b) => b.weight - a.weight)
  const largestPosition = sortedByWeight[0]
  const leader = [...enriched].sort((a, b) => b.plPercent - a.plPercent)[0]
  const laggard = [...enriched].sort((a, b) => a.plPercent - b.plPercent)[0]
  const concentrationStatus = largestPosition?.weight > 25 ? 'Review concentration' : 'Position size ok'
  const cashStatus = cash > 0 ? 'Buying power ready' : 'Deposit before buying'

  if (!enriched.length) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
        <div className={styles.emptyState}>
          <strong>No holdings yet</strong>
          <p>Start by adding a transaction to see your portfolio overview.</p>
          <Link to="/transactions" className={styles.emptyBtn}>Go to Transactions →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Portfolio overview · FX: $1 = ฿{fxRateValue.toFixed(2)} ({fxRate?.status || 'stale'}) · Prices: {staleCount ? `${staleCount} stale` : `updated ${quoteAgeLabel(latestPriceUpdate) || 'just now'}`}
        </p>
      </div>


      <div className={styles.decisionGrid}>
        <Link to="/settings" className={`${styles.decisionCard} ${staleCount ? styles.warnDecision : styles.okDecision}`}>
          <span className={styles.decisionLabel}>Price Data</span>
          <strong>{staleCount ? `${staleCount} stale` : 'Fresh'}</strong>
          <span>{staleCount ? 'Refresh market data' : `Updated ${quoteAgeLabel(latestPriceUpdate) || 'just now'}`}</span>
        </Link>
        <Link to="/transactions" className={styles.decisionCard}>
          <span className={styles.decisionLabel}>Buying Power</span>
          <strong>{fmtTHB(cashTHB)}</strong>
          <span>{cashStatus} · {cashWeight.toFixed(1)}% of portfolio</span>
        </Link>
        <Link to={largestPosition ? `/holdings/${largestPosition.ticker}` : '/holdings'} className={`${styles.decisionCard} ${largestPosition?.weight > 25 ? styles.warnDecision : ''}`}>
          <span className={styles.decisionLabel}>Largest Position</span>
          <strong>{largestPosition?.ticker || '-'}</strong>
          <span>{largestPosition ? `${largestPosition.weight.toFixed(1)}% weight · ${concentrationStatus}` : 'No holdings'}</span>
        </Link>
        <Link to="/holdings" className={styles.decisionCard}>
          <span className={styles.decisionLabel}>Best / Worst</span>
          <strong>{leader?.ticker || '-'} / {laggard?.ticker || '-'}</strong>
          <span>{leader ? fmtPct(leader.plPercent) : '-'} · {laggard ? fmtPct(laggard.plPercent) : '-'}</span>
        </Link>
      </div>

      {/* Summary Cards — THB primary */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Total Portfolio Value"
          value={fmtTHB(totalPortfolioValueTHB)}
          sub={`Stocks ${fmtTHB(totalMarketValueTHB)} + Cash ${fmtTHB(cashTHB)}`}
        />
        <StatCard
          label="Stocks Market Value"
          value={fmtTHB(totalMarketValueTHB)}
          sub={fmtUSD(totalMarketValue) + ' · ' + enriched.length + ' positions'}
        />
        <StatCard
          label="Cost Basis"
          value={fmtTHB(totalCostTHB)}
          sub={fmtUSD(totalCost) + ' invested'}
        />
        <StatCard
          label="Unrealized P/L"
          value={(totalPLTHB >= 0 ? '+' : '-') + fmtTHB(totalPLTHB)}
          sub={fmtPct(totalReturn)}
          subClass={plCls}
        />
      </div>

      <Card className={styles.valueBreakdown}>
        <div className={styles.breakdownHeader}>
          <div>
            <h2 className={styles.cardTitle}>Portfolio Value Breakdown</h2>
            <p>Available Cash is uninvested buying power. It is separate from stocks you already own.</p>
          </div>
          <strong>{fmtTHB(totalPortfolioValueTHB)}</strong>
        </div>
        <div className={styles.breakdownBar} aria-label="Portfolio value split between stocks and cash">
          <span className={styles.stockSegment} style={{ width: `${stockWeight}%` }} />
          <span className={styles.cashSegment} style={{ width: `${cashWeight}%` }} />
        </div>
        <div className={styles.breakdownLegend}>
          <span><i className={styles.stockDot} /> Stocks {fmtTHB(totalMarketValueTHB)} ({stockWeight.toFixed(1)}%)</span>
          <span><i className={styles.cashDot} /> Cash {fmtTHB(cashTHB)} ({cashWeight.toFixed(1)}%)</span>
        </div>
      </Card>


      {/* Charts Row */}
      <div className={styles.chartsRow}>
        {/* Allocation Pie */}
        <Card className={styles.pieCard}>
          <h2 className={styles.cardTitle}>Portfolio Allocation</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                paddingAngle={2} dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            {enriched.map((h, i) => (
              <div key={h.ticker} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className={styles.legendTicker}>{h.ticker}</span>
                <span className={styles.legendPct}>{h.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Performance Line — THB */}
        <Card className={styles.perfCard}>
          <h2 className={styles.cardTitle}>Portfolio Performance (THB)</h2>
          <p className={styles.chartNote}>Daily snapshots · saved automatically after each price refresh</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={snapshots} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`}
                width={52}
              />
              <Tooltip content={<PerfTooltip />} />
              <Area
                type="monotone" dataKey="value"
                stroke="var(--accent)" strokeWidth={2.5}
                fill="url(#perfGradient)"
                dot={false}
                activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <div className={styles.tableHeader}>
          <h2 className={styles.cardTitle}>Holdings</h2>
          <span className={styles.count}>{enriched.length} positions</span>
        </div>
        <HoldingsTable holdings={enriched} />
      </Card>
    </div>
  )
}
