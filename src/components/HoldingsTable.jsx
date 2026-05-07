import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quoteAgeLabel } from '../providers/marketData'
import { fmtUSD, fmtTHB, fmtPct, fmt, plClass } from '../utils/calculations'
import styles from './HoldingsTable.module.css'

const SORTABLE_COLUMNS = [
  { key: 'ticker', label: 'Ticker', type: 'text' },
  { key: 'shares', label: 'Shares' },
  { key: 'averageCost', label: 'Avg Cost' },
  { key: 'currentPrice', label: 'Price' },
  { key: 'totalCostTHB', label: 'Cost (THB)' },
  { key: 'marketValueTHB', label: 'Value (THB)' },
  { key: 'unrealizedPLTHB', label: 'P/L (THB)' },
  { key: 'plPercent', label: 'Return %' },
  { key: 'weight', label: 'Weight' },
]

function sortValue(holding, column) {
  if (column.type === 'text') return String(holding[column.key] || '').toLowerCase()
  return Number(holding[column.key] || 0)
}

export default function HoldingsTable({ holdings }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'marketValueTHB', direction: 'desc' })

  const activeColumn = SORTABLE_COLUMNS.find(column => column.key === sort.key) || SORTABLE_COLUMNS[0]
  const visibleHoldings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery
      ? holdings.filter(h => [h.ticker, h.companyName, h.sector, h.riskLevel, h.note]
        .some(value => String(value || '').toLowerCase().includes(normalizedQuery)))
      : holdings

    return [...filtered].sort((a, b) => {
      const aValue = sortValue(a, activeColumn)
      const bValue = sortValue(b, activeColumn)
      const result = activeColumn.type === 'text'
        ? aValue.localeCompare(bValue)
        : aValue - bValue
      return sort.direction === 'asc' ? result : -result
    })
  }, [activeColumn, holdings, query, sort.direction])

  function toggleSort(key) {
    setSort(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  function sortLabel(key) {
    if (sort.key !== key) return ''
    return sort.direction === 'asc' ? '^' : 'v'
  }

  function renderSortHeader(column, className = '') {
    return (
      <th className={className}>
        <button type="button" className={styles.sortBtn} onClick={() => toggleSort(column.key)}>
          {column.label}<span>{sortLabel(column.key)}</span>
        </button>
      </th>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span>Search</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ticker, company, sector, note"
          />
        </div>
        <div className={styles.resultMeta}>
          <strong>{visibleHoldings.length}</strong>
          <span>of {holdings.length} positions</span>
        </div>
      </div>

      <div className={styles.wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {renderSortHeader(SORTABLE_COLUMNS[0], styles.stickyTicker)}
              <th>Company</th>
              {renderSortHeader(SORTABLE_COLUMNS[1], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[2], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[3], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[4], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[5], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[6], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[7], styles.right)}
              {renderSortHeader(SORTABLE_COLUMNS[8], styles.right)}
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {visibleHoldings.map(h => {
              const pl = h.unrealizedPL
              const cls = plClass(pl)
              return (
                <tr
                  key={h.ticker}
                  className={styles.row}
                  onClick={() => navigate(`/holdings/${h.ticker}`)}
                >
                  <td className={styles.stickyTicker}><span className={styles.ticker}>{h.ticker}</span></td>
                  <td className={styles.company}>{h.companyName}</td>
                  <td className={styles.right}>{fmt(h.shares, 4)}</td>
                  <td className={styles.right}>{fmtUSD(h.averageCost)}</td>
                  <td className={styles.right}>
                    <div className={styles.priceCell}>
                      <span>{fmtUSD(h.currentPrice)}</span>
                      <span className={styles.priceMeta}>
                        <span className={`${styles.statusDot} ${styles[h.priceStatus] || ''}`} />
                        {h.priceSource || 'manual'} · {quoteAgeLabel(h.priceUpdatedAt) || 'never'}
                      </span>
                    </div>
                  </td>
                  <td className={styles.right}>{fmtTHB(h.totalCostTHB)}</td>
                  <td className={styles.right}>{fmtTHB(h.marketValueTHB)}</td>
                  <td className={`${styles.right} ${cls}`}>
                    {pl >= 0 ? '+' : '-'}{fmtTHB(h.unrealizedPLTHB)}
                  </td>
                  <td className={`${styles.right} ${cls}`}>{fmtPct(h.plPercent)}</td>
                  <td className={styles.right}><span className={styles.weight}>{fmt(h.weight)}%</span></td>
                  <td className={styles.note}>{h.note || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visibleHoldings.length && (
          <div className={styles.emptyState}>
            <strong>No results</strong>
            <span>No holdings match &ldquo;{query}&rdquo;</span>
          </div>
        )}
      </div>
    </div>
  )
}
