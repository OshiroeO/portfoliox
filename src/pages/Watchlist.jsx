import { useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { fmtUSD, fmtPct, plClass } from '../utils/calculations'
import { quoteAgeLabel } from '../providers/marketData'
import { stockInitials, stockLogoSources } from '../utils/stockLogos'
import styles from './Watchlist.module.css'

const empty = {
  ticker: '',
  companyName: '',
  currentPrice: '',
  targetPrice: '',
  targetDate: '',
  targetSource: 'manual',
  priority: 'Medium',
  thesis: '',
  trigger: '',
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function targetUpside(item) {
  const current = toNumber(item.currentPrice)
  const target = toNumber(item.targetPrice)
  if (current <= 0 || target <= 0) return null
  return ((target - current) / current) * 100
}

function targetStatus(item) {
  const upside = targetUpside(item)
  if (upside === null) return { label: 'No Price', tone: 'muted' }
  if (upside < 0) return { label: 'Above Target', tone: 'above' }
  if (upside <= 10) return { label: 'Near Target', tone: 'warn' }
  return { label: 'Watching', tone: 'accent' }
}

function PriceVsTarget({ item }) {
  const current = toNumber(item.currentPrice)
  const target = toNumber(item.targetPrice)
  if (!current || !target) return <div className={styles.priceBarEmpty}>—</div>
  const lo = Math.min(current, target) * 0.92
  const hi = Math.max(current, target) * 1.08
  const range = hi - lo
  const currentPct = ((current - lo) / range) * 100
  const targetPct = ((target - lo) / range) * 100
  const belowTarget = current <= target
  return (
    <div className={styles.priceBar}>
      <div className={styles.priceBarTrack}>
        <div
          className={`${styles.priceBarFill} ${belowTarget ? styles.fillPositive : styles.fillExceeded}`}
          style={{ width: `${Math.min(currentPct, 100)}%` }}
        />
        <div className={styles.targetMarker} style={{ left: `${targetPct}%` }} title={`Target ${fmtUSD(target)}`} />
      </div>
      <div className={styles.priceBarMeta}>
        <span>{fmtUSD(current)}</span>
        <span>Target {fmtUSD(target)}</span>
      </div>
    </div>
  )
}

function WatchLogo({ ticker }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const sources = stockLogoSources(ticker)
  const logo = sources[sourceIndex]
  function tryNext() { setSourceIndex(i => i + 1) }
  return (
    <div className={styles.avatar}>
      {logo ? <img src={logo} alt="" onError={tryNext} /> : <span>{stockInitials(ticker)}</span>}
    </div>
  )
}

export default function Watchlist() {
  const {
    holdings,
    watchlist,
    marketLoading,
    addWatchItem,
    updateWatchItem,
    deleteWatchItem,
    refreshQuotes,
  } = usePortfolio()
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const sortedWatchlist = [...(watchlist || [])].sort((a, b) => {
    const aUpside = targetUpside(a) ?? -Infinity
    const bUpside = targetUpside(b) ?? -Infinity
    return bUpside - aUpside
  })
  const targets = sortedWatchlist.map(targetUpside).filter(value => value !== null)
  const avgUpside = targets.length ? targets.reduce((sum, value) => sum + value, 0) / targets.length : 0
  const nearTargets = sortedWatchlist.filter(item => {
    const upside = targetUpside(item)
    return upside !== null && upside >= 0 && upside <= 10
  }).length

  function set(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setError('')
    setMessage('')
  }

  function setTicker(value) {
    const ticker = value.toUpperCase()
    const holding = holdings.find(h => h.ticker === ticker)
    setForm(current => ({
      ...current,
      ticker,
      companyName: holding?.companyName || current.companyName,
      currentPrice: holding?.currentPrice ? String(holding.currentPrice) : current.currentPrice,
    }))
    setError('')
  }

  function resetForm() {
    setForm(empty)
    setEditingId(null)
    setError('')
  }

  function openAddForm() {
    resetForm()
    setMessage('')
    setIsFormOpen(true)
  }

  function closeForm() {
    resetForm()
    setIsFormOpen(false)
  }

  async function submit(e) {
    e.preventDefault()
    const ticker = form.ticker.trim().toUpperCase()
    if (!ticker) {
      setError('Ticker is required.')
      return
    }
    if (toNumber(form.targetPrice) <= 0) {
      setError('Target price is required.')
      return
    }

    const payload = {
      ...form,
      ticker,
      companyName: form.companyName.trim() || ticker,
      currentPrice: toNumber(form.currentPrice),
      targetPrice: toNumber(form.targetPrice),
      targetSource: form.targetSource || 'manual',
    }

    const ok = editingId ? updateWatchItem(editingId, payload) : addWatchItem(payload)
    if (!ok) {
      setError('Could not save watchlist item.')
      return
    }

    const wasEditing = Boolean(editingId)
    closeForm()
    setMessage(wasEditing ? 'Saved target. Refreshing market price...' : 'Added to watchlist. Refreshing market price...')
    const quoteResult = await refreshQuotes([ticker])
    setMessage(quoteResult ? 'Watchlist price refreshed.' : 'Saved, but price refresh failed. Manual price remains available.')
    setTimeout(() => setMessage(''), 3000)
  }

  function editItem(item) {
    setEditingId(item.id)
    setForm({
      ticker: item.ticker,
      companyName: item.companyName || '',
      currentPrice: item.currentPrice ? String(item.currentPrice) : '',
      targetPrice: item.targetPrice ? String(item.targetPrice) : '',
      targetDate: item.targetDate || '',
      targetSource: item.targetSource || 'manual',
      priority: item.priority || 'Medium',
      thesis: item.thesis || '',
      trigger: item.trigger || '',
    })
    setError('')
    setMessage('')
    setIsFormOpen(true)
  }

  function removeItem(item) {
    if (!window.confirm(`Remove ${item.ticker} from watchlist?`)) return
    if (editingId === item.id) closeForm()
    deleteWatchItem(item.id)
  }

  async function refreshWatchlist() {
    if (!sortedWatchlist.length) return
    const result = await refreshQuotes(sortedWatchlist.map(item => item.ticker))
    setMessage(result ? 'Watchlist prices refreshed.' : 'Watchlist refresh finished with errors.')
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Watchlist</h1>
          <p className={styles.subtitle}>{sortedWatchlist.length} candidates · Average upside {targets.length ? fmtPct(avgUpside) : '-'}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} disabled={marketLoading || !sortedWatchlist.length} onClick={refreshWatchlist} title="Refresh prices">
            <RefreshCw size={17} />
          </button>
          <button className={styles.addBtn} onClick={openAddForm} title="Add watchlist item">
            <Plus size={22} />
          </button>
        </div>
      </div>

      {(message || error) && <p className={error ? styles.errorMsg : styles.successMsg}>{error || message}</p>}

      <div className={styles.summaryBar}>
        <div>
          <span>Watching</span>
          <strong>{sortedWatchlist.length}</strong>
        </div>
        <div>
          <span>Average Upside</span>
          <strong className={plClass(avgUpside)}>{targets.length ? fmtPct(avgUpside) : '-'}</strong>
        </div>
        <div>
          <span>Near Target</span>
          <strong>{nearTargets}</strong>
        </div>
      </div>

      <section className={styles.watchPanel}>
        <div className={styles.listHeader}>
          <div>
            <span>Watchlist</span>
            <strong>{sortedWatchlist.length} items</strong>
          </div>
          <span>% to target</span>
        </div>

        {sortedWatchlist.length === 0 && (
          <button className={styles.emptyState} onClick={openAddForm}>
            <Plus size={24} />
            <strong>Add your first ticker</strong>
            <span>Use the plus button to create a target watchlist.</span>
          </button>
        )}

        {sortedWatchlist.map((item, idx) => {
          const upside = targetUpside(item)
          const status = targetStatus(item)
          const quoteAge = quoteAgeLabel(item.priceUpdatedAt) || 'manual'
          return (
            <article key={item.id} className={styles.watchRow} style={{ animationDelay: `${idx * 40}ms` }}>
              <div className={styles.leftCol}>
                <span className={styles.marketPill}>US Stock</span>
                <div className={styles.identityRow}>
                  <WatchLogo ticker={item.ticker} />
                  <div>
                    <div className={styles.tickerLine}>
                      <strong>{item.ticker}</strong>
                      <span className={`${styles.statusPill} ${styles[status.tone] || ''}`}>{status.label}</span>
                    </div>
                    <p>{item.companyName || item.ticker}</p>
                  </div>
                </div>
              </div>

              <PriceVsTarget item={item} />

              <div className={styles.priceCol}>
                <small>{item.priceSource || item.targetSource || 'manual'} · {quoteAge}</small>
                <strong>{toNumber(item.currentPrice) > 0 ? fmtUSD(item.currentPrice) : '-'}</strong>
                <span>Target {fmtUSD(item.targetPrice)}</span>
              </div>

              <div className={styles.upsideCol}>
                <span className={`${styles.upsideBadge} ${
                  upside === null ? '' : upside >= 0 ? styles.positiveBadge : styles.exceededBadge
                }`}>
                  {upside === null ? '-' : fmtPct(upside)}
                </span>
                {item.targetDate && <small>{item.targetDate}</small>}
              </div>

              <div className={styles.rowActions}>
                <button className={styles.rowIconBtn} onClick={() => editItem(item)} title={`Edit ${item.ticker}`}>
                  <Pencil size={15} />
                </button>
                <button className={styles.rowIconBtnDanger} onClick={() => removeItem(item)} title={`Remove ${item.ticker}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {isFormOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={editingId ? 'Edit target' : 'Add target'}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{editingId ? 'Edit Target' : 'Add Target'}</h2>
                <p>{editingId ? 'Update target and notes' : 'Add ticker and target price'}</p>
              </div>
              <button className={styles.iconBtn} onClick={closeForm} title="Close">
                <X size={18} />
              </button>
            </div>

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.row2}>
                <label className={styles.field}>
                  <span>Ticker</span>
                  <input value={form.ticker} onChange={e => setTicker(e.target.value)} placeholder="AAPL" autoFocus />
                </label>
                <label className={styles.field}>
                  <span>Company</span>
                  <input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Company name" />
                </label>
              </div>
              <div className={styles.row2}>
                <label className={styles.field}>
                  <span>Current Price</span>
                  <input type="number" min="0" step="any" value={form.currentPrice} onChange={e => set('currentPrice', e.target.value)} placeholder="Auto from market" />
                </label>
                <label className={styles.field}>
                  <span>Target Price</span>
                  <input type="number" min="0" step="any" value={form.targetPrice} onChange={e => set('targetPrice', e.target.value)} placeholder="0.00" />
                </label>
              </div>
              <div className={styles.row2}>
                <label className={styles.field}>
                  <span>Target Date</span>
                  <input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Priority</span>
                  <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>
              </div>
              <label className={styles.field}>
                <span>Thesis</span>
                <textarea rows="3" value={form.thesis} onChange={e => set('thesis', e.target.value)} placeholder="Why this belongs on the watchlist" />
              </label>
              <label className={styles.field}>
                <span>Buy Trigger</span>
                <input value={form.trigger} onChange={e => set('trigger', e.target.value)} placeholder="Price, event, earnings, valuation, etc." />
              </label>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <button className={styles.saveBtn} type="submit" disabled={marketLoading}>
                <Plus size={14} /> {marketLoading ? 'Refreshing...' : editingId ? 'Save Target' : 'Add To Watchlist'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
