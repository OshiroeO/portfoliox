import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { quoteAgeLabel } from '../providers/marketData'
import { calcPortfolioTotals, fmt, fmtTHB, fmtUSD, fmtPct, plClass } from '../utils/calculations'
import { stockInitials, stockLogoSources } from '../utils/stockLogos'
import Badge from '../components/Badge'
import styles from './Holdings.module.css'

function toneClass(value) {
  const cls = plClass(value)
  if (cls === 'profit') return styles.profitTone
  if (cls === 'loss') return styles.lossTone
  return styles.neutralTone
}

function StockLogo({ ticker }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const sources = stockLogoSources(ticker)
  const logo = sources[sourceIndex]

  function tryNextLogo() {
    setSourceIndex(current => current + 1)
  }

  return (
    <div className={styles.logoWrap}>
      {logo ? (
        <img src={logo} alt="" onError={tryNextLogo} />
      ) : (
        <span>{stockInitials(ticker)}</span>
      )}
    </div>
  )
}

export default function Holdings() {
  const navigate = useNavigate()
  const { holdings, fxRateValue, refreshQuotes, marketLoading } = usePortfolio()
  const [expandedTicker, setExpandedTicker] = useState(null)
  const [query, setQuery] = useState('')
  const [refreshMsg, setRefreshMsg] = useState('')
  const { holdings: enriched, totalMarketValue, totalCost, totalPL, totalReturn,
    totalMarketValueTHB, totalCostTHB, totalPLTHB } = calcPortfolioTotals(holdings, fxRateValue)

  const normalizedQuery = query.trim().toLowerCase()
  const filteredHoldings = normalizedQuery
    ? enriched.filter(h => [h.ticker, h.companyName, h.sector, h.riskLevel, h.note]
      .some(value => String(value || '').toLowerCase().includes(normalizedQuery)))
    : enriched
  const visibleHoldings = [...filteredHoldings].sort((a, b) => b.marketValueTHB - a.marketValueTHB)

  function toggleTicker(ticker) {
    setExpandedTicker(current => current === ticker ? null : ticker)
  }

  async function handleRefreshPrices() {
    const result = await refreshQuotes(holdings.map(h => h.ticker))
    setRefreshMsg(result ? 'Prices updated.' : 'Refresh finished with errors.')
    setTimeout(() => setRefreshMsg(''), 3200)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Holdings</h1>
        <p className={styles.subtitle}>Tap a holding to expand details · FX ฿{fxRateValue.toFixed(2)}/USD</p>
      </div>

      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Market Value</span>
          <span className={styles.summaryValue}>{fmtTHB(totalMarketValueTHB)}</span>
          <span className={styles.summarySub}>{fmtUSD(totalMarketValue)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Cost</span>
          <span className={styles.summaryValue}>{fmtTHB(totalCostTHB)}</span>
          <span className={styles.summarySub}>{fmtUSD(totalCost)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Unrealized P/L</span>
          <span className={`${styles.summaryValue} ${toneClass(totalPL)}`}>
            {totalPLTHB >= 0 ? '+' : '-'}{fmtTHB(totalPLTHB)}
          </span>
          <span className={styles.summarySub}>{fmtUSD(Math.abs(totalPL))}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Return</span>
          <span className={`${styles.summaryValue} ${toneClass(totalPL)}`}>{fmtPct(totalReturn)}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Positions</span>
          <span className={styles.summaryValue}>{enriched.length}</span>
        </div>
      </div>

      <section className={styles.holdingsPanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Your Stocks</span>
            <strong>{visibleHoldings.length} of {enriched.length} positions</strong>
          </div>
          <div className={styles.panelRight}>
            {refreshMsg && <span className={`${styles.refreshMsg} msgFade`}>{refreshMsg}</span>}
            <button
              className={styles.refreshBtn}
              onClick={handleRefreshPrices}
              disabled={marketLoading}
              title="Refresh all prices"
            >
              <RefreshCw size={16} className={marketLoading ? styles.spinning : ''} />
            </button>
            <label className={styles.searchBox}>
              <Search size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search ticker, company, sector" />
            </label>
          </div>
        </div>

        <div className={styles.listHead}>
          <span>Holding</span>
          <span>Price</span>
          <span>P/L</span>
        </div>

        {visibleHoldings.map((h, idx) => {
          const expanded = expandedTicker === h.ticker
          const tone = toneClass(h.unrealizedPL)
          return (
            <article
              key={h.ticker}
              className={`${styles.holdingItem} ${expanded ? styles.expanded : ''} ${marketLoading ? styles.dimmed : ''}`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <button className={styles.holdingRow} onClick={() => toggleTicker(h.ticker)}>
                <div className={styles.identityCell}>
                  <StockLogo ticker={h.ticker} />
                  <div>
                    <div className={styles.tickerLine}>
                      <strong>{h.ticker}</strong>
                      <Badge label={h.riskLevel} />
                    </div>
                    <p>{h.companyName}</p>
                  </div>
                </div>

                <div className={styles.priceCell}>
                  <strong>{fmtUSD(h.currentPrice)}</strong>
                  <span>{h.priceSource || 'manual'} · {quoteAgeLabel(h.priceUpdatedAt) || 'never'}</span>
                </div>

                <div className={styles.plCell}>
                  <strong className={tone}>{h.unrealizedPLTHB >= 0 ? '+' : '-'}{fmtTHB(h.unrealizedPLTHB)}</strong>
                  <span className={tone}>{fmtPct(h.plPercent)}</span>
                </div>

                <ChevronDown className={`${styles.chevron} ${expanded ? styles.open : ''}`} size={18} />
              </button>

              {expanded && (
                <div className={styles.detailPanel}>
                  <div className={styles.detailGrid}>
                    <div>
                      <span>Shares</span>
                      <strong>{fmt(h.shares, 4)}</strong>
                    </div>
                    <div>
                      <span>Avg Cost</span>
                      <strong>{fmtUSD(h.averageCost)}</strong>
                    </div>
                    <div>
                      <span>Cost Basis</span>
                      <strong>{fmtTHB(h.totalCostTHB)}</strong>
                    </div>
                    <div>
                      <span>Market Value</span>
                      <strong>{fmtTHB(h.marketValueTHB)}</strong>
                    </div>
                    <div>
                      <span>Weight</span>
                      <strong>{fmt(h.weight)}%</strong>
                    </div>
                    <div>
                      <span>Sector</span>
                      <strong>{h.sector || 'Other'}</strong>
                    </div>
                  </div>

                  <div className={styles.detailFooter}>
                    <p>{h.note || 'No note for this holding.'}</p>
                    <div className={styles.detailActions}>
                      <button onClick={() => navigate(`/holdings/${h.ticker}`)}>
                        Full Detail <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })}

        {!visibleHoldings.length && (
          <div className={styles.emptyState}>No holdings match the current search.</div>
        )}
      </section>
    </div>
  )
}
