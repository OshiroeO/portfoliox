import { useState } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'
import { calcPortfolioTotals, fmtUSD, fmtTHB, fmt } from '../utils/calculations'
import Card from '../components/Card'
import Badge from '../components/Badge'
import styles from './Transactions.module.css'

const KNOWN_TICKERS = {
  TSM:   { companyName: 'Taiwan Semiconductor Mfg',  sector: 'Semiconductor',       riskLevel: 'Medium' },
  MSFT:  { companyName: 'Microsoft Corp',             sector: 'Technology',           riskLevel: 'Low'    },
  NVDA:  { companyName: 'NVIDIA Corp',                sector: 'Semiconductor / AI',   riskLevel: 'Medium' },
  GOOGL: { companyName: 'Alphabet Inc Class A',       sector: 'Technology / AI',      riskLevel: 'Low'    },
  VOO:   { companyName: 'Vanguard S&P 500 ETF',       sector: 'ETF',                  riskLevel: 'Low'    },
  CRWD:  { companyName: 'CrowdStrike Holdings Inc',   sector: 'Cybersecurity',        riskLevel: 'High'   },
  FTNT:  { companyName: 'Fortinet Inc',               sector: 'Cybersecurity',        riskLevel: 'Medium' },
  PLTR:  { companyName: 'Palantir Technologies Inc',  sector: 'AI / Software',        riskLevel: 'High'   },
  RKLB:  { companyName: 'Rocket Lab Corp',            sector: 'Space',                riskLevel: 'High'   },
  AAPL:  { companyName: 'Apple Inc.',                 sector: 'Technology',           riskLevel: 'Low'    },
  TSLA:  { companyName: 'Tesla Inc.',                 sector: 'EV / Tech',            riskLevel: 'High'   },
  AMZN:  { companyName: 'Amazon.com Inc.',            sector: 'E-Commerce / Cloud',   riskLevel: 'Medium' },
  META:  { companyName: 'Meta Platforms Inc.',        sector: 'Social Media / AI',    riskLevel: 'Medium' },
  ASML:  { companyName: 'ASML Holding NV',            sector: 'Semiconductor',        riskLevel: 'Medium' },
}

const empty = {
  type: 'BUY',
  ticker: '',
  date: new Date().toISOString().split('T')[0],
  quantity: '',
  price: '',
  fee: '',
  note: '',
}

export default function Transactions() {
  const {
    holdings,
    transactions,
    cash,
    fxRateValue,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = usePortfolio()
  const { holdings: enriched } = calcPortfolioTotals(holdings, fxRateValue)

  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const known = KNOWN_TICKERS[form.ticker.toUpperCase()]
  const editingTx = transactions.find(tx => tx.id === editingId)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
    setSuccess(false)
  }

  function availableSharesForSell(ticker) {
    const normalizedTicker = ticker.toUpperCase()
    const holding = enriched.find(h => h.ticker === normalizedTicker)
    const currentShares = holding?.shares ?? 0
    const editableShares = editingTx?.type === 'SELL' && editingTx.ticker === normalizedTicker
      ? editingTx.quantity
      : 0
    return currentShares + editableShares
  }

  function validate() {
    const e = {}
    if (!form.ticker.trim()) e.ticker = 'Ticker is required'
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = 'Enter valid quantity'
    if (!form.price || Number(form.price) <= 0) e.price = 'Enter valid price'
    if (!form.date) e.date = 'Date is required'
    if (form.type === 'BUY') {
      const totalCost = Number(form.quantity) * Number(form.price) + (Number(form.fee) || 0)
      if (totalCost > cash) e.price = `Insufficient cash: ${fmtUSD(cash)} available`
    }
    if (form.type === 'SELL' && form.ticker.trim()) {
      const availableShares = availableSharesForSell(form.ticker)
      const grossProceeds = Number(form.quantity) * Number(form.price)
      const fee = Number(form.fee) || 0
      if (availableShares <= 0) e.ticker = "You don't hold this stock"
      else if (Number(form.quantity) > availableShares)
        e.quantity = `Max ${availableShares.toFixed(4)} shares`
      if (grossProceeds > 0 && fee > grossProceeds) e.fee = 'Fee cannot exceed gross proceeds'
    }
    return e
  }

  function resetForm() {
    setForm(empty)
    setEditingId(null)
    setErrors({})
  }

  function submit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const ticker = form.ticker.toUpperCase()
    const meta = KNOWN_TICKERS[ticker] || {}
    const payload = {
      type: form.type,
      ticker,
      companyName: meta.companyName || ticker,
      sector: meta.sector || 'Other',
      riskLevel: meta.riskLevel || 'Medium',
      date: form.date,
      quantity: Number(form.quantity),
      price: Number(form.price),
      fee: Number(form.fee) || 0,
      note: form.note,
    }

    if (editingId) updateTransaction(editingId, payload)
    else addTransaction(payload)

    resetForm()
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  function editTx(tx) {
    setEditingId(tx.id)
    setForm({
      type: tx.type,
      ticker: tx.ticker,
      date: tx.date,
      quantity: String(tx.quantity),
      price: String(tx.price),
      fee: tx.fee ? String(tx.fee) : '',
      note: tx.note || '',
    })
    setErrors({})
    setSuccess(false)
  }

  function removeTx(tx) {
    if (!window.confirm(`Delete ${tx.type} ${tx.ticker} transaction?`)) return
    if (editingId === tx.id) resetForm()
    deleteTransaction(tx.id)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  function setMaxQuantity() {
    if (form.type === 'SELL') {
      if (sharesAvailable > 0) set('quantity', sharesAvailable.toFixed(4))
      return
    }

    const price = Number(form.price || 0)
    const fee = Number(form.fee || 0)
    const budget = cash - fee
    if (price > 0 && budget > 0) set('quantity', (budget / price).toFixed(4))
  }

  const totalValue = Number(form.price || 0) * Number(form.quantity || 0)
  const feeAmount = Number(form.fee || 0)
  const totalCost = totalValue + feeAmount
  const netProceeds = Math.max(0, totalValue - feeAmount)
  const cashAfterTrade = form.type === 'BUY' ? cash - totalCost : cash + netProceeds
  const selectedTicker = form.ticker.trim().toUpperCase()
  const sharesAvailable = selectedTicker ? availableSharesForSell(selectedTicker) : 0
  const sellOverShares = form.type === 'SELL' && Number(form.quantity || 0) > sharesAvailable
  const sellWithoutShares = form.type === 'SELL' && selectedTicker && sharesAvailable <= 0
  const sellFeeTooHigh = form.type === 'SELL' && totalValue > 0 && feeAmount > totalValue
  const overBuyingPower = form.type === 'BUY' && totalCost > cash
  const submitDisabled = overBuyingPower || sellOverShares || sellWithoutShares || sellFeeTooHigh
  const tradeStatus = overBuyingPower
    ? `Need ${fmtUSD(totalCost - cash)} more cash before buying`
    : sellWithoutShares
      ? `No ${selectedTicker} shares available to sell`
      : sellOverShares
        ? `Reduce quantity to ${fmt(sharesAvailable, 4)} shares or less`
        : sellFeeTooHigh
          ? 'Fee cannot exceed gross proceeds'
          : totalValue > 0
            ? `${form.type === 'BUY' ? 'Buy order' : 'Sell order'} preview is ready`
            : 'Enter ticker, quantity, and price to preview the trade'
  const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.type === filter)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Transactions</h1>
        <p className={styles.subtitle}>Record buy / sell orders and track your history</p>
      </div>

      <div className={styles.layout}>
        <Card className={styles.formCard}>
          <div className={styles.formHeader}>
            <div>
              <h2 className={styles.formTitle}>{editingId ? 'Edit Transaction' : 'New Transaction'}</h2>
              {editingId && <p className={styles.editHint}>Saving will rebuild holdings and wallet cash from history.</p>}
            </div>
            {editingId && <button type="button" className={styles.cancelEditBtn} onClick={resetForm}>Cancel</button>}
          </div>

          <form onSubmit={submit} className={styles.form}>
            <div className={styles.typeToggle}>
              {['BUY', 'SELL'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.typeBtn} ${form.type === t ? (t === 'BUY' ? styles.buyActive : styles.sellActive) : ''}`}
                  onClick={() => set('type', t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className={styles.walletPreview}>
              <div>
                <span>{form.type === 'BUY' ? 'Available Cash' : 'Cash After Sell'}</span>
                <strong>{fmtUSD(form.type === 'BUY' ? cash : cashAfterTrade)}</strong>
                <small>{fmtTHB((form.type === 'BUY' ? cash : cashAfterTrade) * fxRateValue)}</small>
              </div>
              <div>
                <span>{form.type === 'BUY' ? 'Estimated Cost' : 'Shares Available'}</span>
                <strong>{form.type === 'BUY' ? fmtUSD(totalCost) : fmt(sharesAvailable, 4)}</strong>
                <small>{form.type === 'BUY' ? fmtTHB(totalCost * fxRateValue) : selectedTicker || 'Select ticker'}</small>
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Ticker Symbol *</label>
                <input
                  className={`${styles.input} ${errors.ticker ? styles.inputError : ''}`}
                  placeholder="e.g. AAPL"
                  value={form.ticker}
                  onChange={e => set('ticker', e.target.value.toUpperCase())}
                />
                {known && <p className={styles.hint}>{known.companyName}</p>}
                {errors.ticker && <p className={styles.error}>{errors.ticker}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Date *</label>
                <input
                  type="date"
                  className={`${styles.input} ${errors.date ? styles.inputError : ''}`}
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                />
                {errors.date && <p className={styles.error}>{errors.date}</p>}
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>Quantity *</label>
                  <button type="button" className={styles.inlineAction} onClick={setMaxQuantity}>
                    {form.type === 'BUY' ? 'Use Cash' : 'Sell Max'}
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={`${styles.input} ${errors.quantity ? styles.inputError : ''}`}
                  placeholder="0"
                  value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                />
                {errors.quantity && <p className={styles.error}>{errors.quantity}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Price per Share *</label>
                <div className={styles.inputPrefix}>
                  <span className={styles.prefix}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={`${styles.input} ${styles.prefixed} ${errors.price ? styles.inputError : ''}`}
                    placeholder="0.00"
                    value={form.price}
                    onChange={e => set('price', e.target.value)}
                  />
                </div>
                {errors.price && <p className={styles.error}>{errors.price}</p>}
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Fee / Commission</label>
                <div className={styles.inputPrefix}>
                  <span className={styles.prefix}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={`${styles.input} ${styles.prefixed}`}
                    placeholder="0.00"
                    value={form.fee}
                    onChange={e => set('fee', e.target.value)}
                  />
                </div>
                {errors.fee && <p className={styles.error}>{errors.fee}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Note</label>
                <input
                  className={styles.input}
                  placeholder="Optional note..."
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                />
              </div>
            </div>

            <div className={`${styles.tradeStatus} ${submitDisabled ? styles.statusWarn : totalValue > 0 ? styles.statusOk : ''}`}>
              <span>{submitDisabled ? 'Needs Attention' : totalValue > 0 ? 'Ready' : 'Draft'}</span>
              <strong>{tradeStatus}</strong>
            </div>

            {totalValue > 0 && (
              <div className={styles.summary}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>{fmtUSD(totalValue)} <span style={{color:'var(--text-muted)',fontSize:12}}>≈ {fmtTHB(totalValue * fxRateValue)}</span></span>
                </div>
                {Number(form.fee) > 0 && (
                  <div className={styles.summaryRow}>
                    <span>Fee</span>
                    <span>{fmtUSD(feeAmount)}</span>
                  </div>
                )}
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>{form.type === 'BUY' ? 'Total Cost' : 'Net Proceeds'}</span>
                  <span>{fmtUSD(form.type === 'BUY' ? totalCost : netProceeds)} <span style={{color:'var(--text-muted)',fontSize:12}}>≈ {fmtTHB((form.type === 'BUY' ? totalCost : netProceeds) * fxRateValue)}</span></span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Cash After Trade</span>
                  <span className={cashAfterTrade < 0 ? 'loss' : 'profit'}>{cashAfterTrade < 0 ? '-' : ''}{fmtUSD(cashAfterTrade)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className={`${styles.submitBtn} ${form.type === 'SELL' ? styles.submitSell : styles.submitBuy}`}
            >
              {submitDisabled ? 'Resolve Trade Issue' : editingId ? 'Save Changes' : form.type === 'BUY' ? 'Record Buy Order' : 'Record Sell Order'}
            </button>

            {success && (
              <p className={styles.successMsg}>{editingId ? 'Transaction updated successfully!' : 'Portfolio updated successfully!'}</p>
            )}
          </form>
        </Card>

        <div className={styles.historyCol}>
          <div className={styles.historyHeader}>
            <h2 className={styles.formTitle}>Transaction History</h2>
            <div className={styles.filterTabs}>
              {['ALL', 'BUY', 'SELL'].map(f => (
                <button
                  key={f}
                  className={`${styles.filterTab} ${filter === f ? styles.filterActive : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.txList}>
            {filtered.length === 0 && (
              <div className={styles.empty}>No transactions yet</div>
            )}
            {filtered.map(tx => {
              const total = tx.type === 'BUY'
                ? tx.price * tx.quantity + (tx.fee || 0)
                : Math.max(0, tx.price * tx.quantity - (tx.fee || 0))
              return (
                <div key={tx.id} className={`${styles.txCard} ${editingId === tx.id ? styles.txEditing : ''}`}>
                  <div className={styles.txLeft}>
                    <Badge label={tx.type} />
                    <div>
                      <div className={styles.txTicker}>{tx.ticker}</div>
                      <div className={styles.txCompany}>{tx.companyName || tx.ticker}</div>
                    </div>
                  </div>
                  <div className={styles.txMid}>
                    <div className={styles.txMeta}>{fmt(tx.quantity, 4)} shares @ {fmtUSD(tx.price)}</div>
                    {tx.fee > 0 && <div className={styles.txFee}>Fee: {fmtUSD(tx.fee)}</div>}
                    {tx.note && <div className={styles.txNote}>"{tx.note}"</div>}
                  </div>
                  <div className={styles.txRight}>
                    <div className={`${styles.txTotal} ${tx.type === 'BUY' ? 'loss' : 'profit'}`}>
                      {tx.type === 'BUY' ? '-' : '+'}{fmtUSD(total)}
                    </div>
                    <div className={styles.txDate}>{tx.date}</div>
                    <div className={styles.txActions}>
                      <button type="button" className={styles.txActionBtn} onClick={() => editTx(tx)}>Edit</button>
                      <button type="button" className={`${styles.txActionBtn} ${styles.deleteAction}`} onClick={() => removeTx(tx)}>Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {transactions.length > 0 && (
            <Card className={styles.statsBar}>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Total Transactions</span>
                  <span className={styles.statValue}>{transactions.length}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Buys</span>
                  <span className={`${styles.statValue} profit`}>{transactions.filter(t => t.type === 'BUY').length}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Sells</span>
                  <span className={`${styles.statValue} loss`}>{transactions.filter(t => t.type === 'SELL').length}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Total Invested</span>
                  <span className={styles.statValue}>
                    {fmtUSD(transactions.filter(t => t.type === 'BUY').reduce((sum, tx) => sum + tx.price * tx.quantity + (tx.fee || 0), 0))}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
