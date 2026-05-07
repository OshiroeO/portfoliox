import { useRef, useState } from 'react'
import { DollarSign, Download, RefreshCw, Trash2, TrendingUp, Upload } from 'lucide-react'
import { usePortfolio } from '../hooks/usePortfolio'
import { quoteAgeLabel } from '../providers/marketData'
import { calcPortfolioTotals, fmtTHB, fmtUSD } from '../utils/calculations'
import Card from '../components/Card'
import styles from './Settings.module.css'

function statusLabel(status) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Stale'
}

const SETTINGS_SECTIONS = [
  { id: 'wallet', label: 'Wallet', detail: 'Cash flows' },
  { id: 'market', label: 'Market Data', detail: 'Prices and FX' },
  { id: 'backup', label: 'Backup', detail: 'Export and import' },
  { id: 'advanced', label: 'Advanced', detail: 'Reset and app info' },
]

export default function Settings() {
  const {
    holdings,
    cash,
    cashFlows,
    fxRate,
    fxRateValue,
    marketData,
    marketLoading,
    marketError,
    updatePrice,
    updateFxRate,
    addCashFlow,
    deleteCashFlow,
    exportPortfolioData,
    importPortfolioData,
    refreshQuotes,
    refreshFxRate,
    refreshMarketData,
    setAutoRefresh,
  } = usePortfolio()
  const { holdings: enriched, totalMarketValue, totalMarketValueTHB } = calcPortfolioTotals(holdings, fxRateValue)
  const cashTHB = cash * fxRateValue
  const totalPortfolioValue = totalMarketValue + cash
  const totalPortfolioValueTHB = totalMarketValueTHB + cashTHB

  const [prices, setPrices] = useState(
    Object.fromEntries(enriched.map(h => [h.ticker, h.currentPrice]))
  )
  const [fxInput, setFxInput] = useState(fxRateValue)
  const [savedPrices, setSavedPrices] = useState(false)
  const [savedFx, setSavedFx] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [cashForm, setCashForm] = useState({ type: 'DEPOSIT', amount: '', note: '' })
  const [cashMessage, setCashMessage] = useState('')
  const [cashError, setCashError] = useState('')
  const [refreshMessage, setRefreshMessage] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [backupError, setBackupError] = useState('')
  const [activeSection, setActiveSection] = useState('wallet')
  const importInputRef = useRef(null)

  function handlePriceChange(ticker, val) {
    setPrices(p => ({ ...p, [ticker]: val }))
    setSavedPrices(false)
  }

  function savePrices() {
    Object.entries(prices).forEach(([ticker, price]) => {
      const parsed = parseFloat(price)
      if (!isNaN(parsed) && parsed > 0) updatePrice(ticker, parsed)
    })
    setSavedPrices(true)
    setTimeout(() => setSavedPrices(false), 3000)
  }

  function saveFxRate() {
    const parsed = parseFloat(fxInput)
    if (!isNaN(parsed) && parsed > 0) {
      updateFxRate(parsed)
      setSavedFx(true)
      setTimeout(() => setSavedFx(false), 3000)
    }
  }

  async function runRefresh(action, label) {
    setRefreshMessage('')
    const result = await action()
    setRefreshMessage(result ? `${label} updated successfully.` : `${label} refresh finished with errors.`)
    setTimeout(() => setRefreshMessage(''), 4000)
  }

  function saveCashFlow() {
    const amount = Number(cashForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashError('Enter a valid cash amount.')
      return
    }
    if (cashForm.type === 'WITHDRAW' && amount > cash) {
      setCashError(`Cannot withdraw more than ${fmtUSD(cash)}.`)
      return
    }

    const ok = addCashFlow({
      type: cashForm.type,
      amount,
      note: cashForm.note,
      date: new Date().toISOString().split('T')[0],
    })
    if (!ok) {
      setCashError('Could not save cash flow.')
      return
    }
    setCashForm({ type: 'DEPOSIT', amount: '', note: '' })
    setCashError('')
    setCashMessage(cashForm.type === 'DEPOSIT' ? 'Cash deposited successfully.' : 'Cash withdrawn successfully.')
    setTimeout(() => setCashMessage(''), 3000)
  }

  function removeCashFlow(flow) {
    if (!window.confirm(`Delete ${flow.type.toLowerCase()} ${fmtUSD(flow.amount)}?`)) return
    deleteCashFlow(flow.id)
  }

  function exportBackup() {
    const data = exportPortfolioData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `portfoliox-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setBackupError('')
    setBackupMessage('Backup exported successfully.')
    setTimeout(() => setBackupMessage(''), 3000)
  }

  async function importBackup(file) {
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      const imported = importPortfolioData(payload)
      if (!imported) throw new Error('Backup file is not compatible with this app version.')
      setPrices(Object.fromEntries((payload.holdings || []).map(h => [h.ticker, h.currentPrice])))
      setFxInput(payload.fxRate?.rate || fxRateValue)
      setBackupError('')
      setBackupMessage('Backup imported successfully.')
      setTimeout(() => setBackupMessage(''), 3000)
    } catch (error) {
      setBackupMessage('')
      setBackupError(error?.message || 'Could not import backup.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  function resetAll() {
    localStorage.removeItem('portfolio_data')
    window.location.reload()
  }

  function selectSection(section) {
    setActiveSection(section)
    setConfirmReset(false)
  }

  const stalePositions = enriched.filter(h => h.priceStatus !== 'fresh').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Update prices, manage data, and configure your portfolio</p>
      </div>

      <Card>
        <h2 className={styles.sectionTitle}><TrendingUp size={16} /> Portfolio Snapshot</h2>
        <div className={styles.snapshotGrid}>
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>Positions</span>
            <span className={styles.snapValue}>{enriched.length}</span>
          </div>
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>Cash Wallet</span>
            <span className={styles.snapValue}>{fmtUSD(cash)}</span>
          </div>
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>Stocks Market Value</span>
            <span className={styles.snapValue}>{fmtUSD(totalMarketValue)}</span>
          </div>
          <div className={styles.snapItem}>
            <span className={styles.snapLabel}>Total Portfolio</span>
            <span className={styles.snapValue}>{fmtUSD(totalPortfolioValue)}</span>
          </div>
        </div>
      </Card>

      <div className={styles.settingsNav} aria-label="Settings sections">
        {SETTINGS_SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            className={`${styles.settingsTab} ${activeSection === section.id ? styles.settingsTabActive : ''}`}
            onClick={() => selectSection(section.id)}
          >
            <span>{section.label}</span>
            <small>{section.detail}</small>
          </button>
        ))}
      </div>

      {activeSection === 'wallet' && (
        <Card>
          <h2 className={styles.sectionTitle}><DollarSign size={16} /> Cash Wallet</h2>
        <p className={styles.hint}>Add or withdraw cash that will be used as buying power for stock transactions.</p>
        <div className={styles.cashPanel}>
          <div className={styles.cashBalance}>
            <span>Available Cash</span>
            <strong>{fmtUSD(cash)}</strong>
          </div>
          <div className={styles.cashBreakdown}>
            <div>
              <span>Cash Wallet</span>
              <strong>{fmtUSD(cash)} <small>{fmtTHB(cashTHB)}</small></strong>
            </div>
            <div>
              <span>Stocks Owned</span>
              <strong>{fmtUSD(totalMarketValue)} <small>{fmtTHB(totalMarketValueTHB)}</small></strong>
            </div>
            <div>
              <span>Total Portfolio</span>
              <strong>{fmtUSD(totalPortfolioValue)} <small>{fmtTHB(totalPortfolioValueTHB)}</small></strong>
            </div>
          </div>
          <div className={styles.cashForm}>
            <div className={styles.segmented}>
              {['DEPOSIT', 'WITHDRAW'].map(type => (
                <button
                  key={type}
                  className={cashForm.type === type ? styles.segmentActive : ''}
                  onClick={() => { setCashForm(f => ({ ...f, type })); setCashError('') }}
                >
                  {type === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
                </button>
              ))}
            </div>
            <div className={styles.cashInputWrap}>
              <span>$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashForm.amount}
                onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <input
              className={styles.cashNote}
              value={cashForm.note}
              onChange={e => setCashForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Optional note"
            />
            <button className={styles.saveBtn} onClick={saveCashFlow}>Save Cash Flow</button>
          </div>
          {(cashMessage || cashError) && <p className={cashError ? styles.errorMsg : styles.successMsg}>{cashError || cashMessage}</p>}
          <div className={styles.cashFlowList}>
            {(cashFlows || []).slice(0, 6).map(flow => (
              <div key={flow.id} className={styles.cashFlowRow}>
                <div>
                  <span className={flow.type === 'DEPOSIT' ? 'profit' : 'loss'}>{flow.type === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}</span>
                  <span>{flow.note || flow.date}</span>
                </div>
                <strong className={flow.type === 'DEPOSIT' ? 'profit' : 'loss'}>{flow.type === 'DEPOSIT' ? '+' : '-'}{fmtUSD(flow.amount)}</strong>
                <button className={styles.secondaryBtn} onClick={() => removeCashFlow(flow)}>Delete</button>
              </div>
            ))}
            {(!cashFlows || cashFlows.length === 0) && <p className={styles.emptyState}>No cash flows yet.</p>}
          </div>
        </div>
        </Card>
      )}

      {activeSection === 'market' && (
        <>
          <Card>
            <h2 className={styles.sectionTitle}><RefreshCw size={16} /> Live Refresh</h2>
        <p className={styles.hint}>Free providers: Stooq delayed/daily quotes and fxapi.app USD/THB FX. Manual values remain as fallback if a provider fails.</p>
        <div className={styles.refreshPanel}>
          <div className={styles.refreshMeta}>
            <span>Quotes: {marketData?.quoteProvider || 'stooq'}</span>
            <span>FX: {marketData?.fxProvider || 'fxapi.app'}</span>
            <span>Last refresh: {quoteAgeLabel(marketData?.lastRefreshAt) || 'never'}</span>
            <span>Stale prices: {stalePositions}</span>
          </div>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={marketData?.autoRefresh ?? true}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh stale data on app start
          </label>
          <div className={styles.refreshActions}>
            <button className={styles.saveBtn} disabled={marketLoading} onClick={() => runRefresh(refreshMarketData, 'Market data')}>
              <RefreshCw size={14} /> {marketLoading ? 'Refreshing...' : 'Refresh Market Data'}
            </button>
            <button className={styles.secondaryBtn} disabled={marketLoading} onClick={() => runRefresh(refreshQuotes, 'Prices')}>Refresh Prices</button>
            <button className={styles.secondaryBtn} disabled={marketLoading} onClick={() => runRefresh(refreshFxRate, 'FX')}>Refresh FX</button>
          </div>
          {(refreshMessage || marketError || marketData?.lastRefreshError) && (
            <p className={marketError || marketData?.lastRefreshError ? styles.errorMsg : styles.successMsg}>
              {marketError || marketData?.lastRefreshError || refreshMessage}
            </p>
          )}
        </div>
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}><RefreshCw size={16} /> Update Current Prices</h2>
        <p className={styles.hint}>Manual override stays available for corrections or when a free provider is unavailable.</p>
        <div className={styles.priceGrid}>
          {enriched.map(h => (
            <div key={h.ticker} className={styles.priceRow}>
              <div className={styles.priceInfo}>
                <span className={styles.priceTicker}>{h.ticker}</span>
                <span className={styles.priceCompany}>{h.companyName}</span>
                <span className={styles.priceMeta}>
                  <span className={`${styles.statusBadge} ${styles[h.priceStatus] || ''}`}>{statusLabel(h.priceStatus)}</span>
                  {h.priceSource || 'manual'} · {quoteAgeLabel(h.priceUpdatedAt) || 'never updated'}
                </span>
              </div>
              <div className={styles.priceInputWrap}>
                <span className={styles.priceDollar}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.priceInput}
                  value={prices[h.ticker] ?? h.currentPrice}
                  onChange={e => handlePriceChange(h.ticker, e.target.value)}
                />
              </div>
              <span className={styles.priceOld}>was {fmtUSD(h.currentPrice)}</span>
            </div>
          ))}
        </div>
        <button className={styles.saveBtn} onClick={savePrices}>
          <RefreshCw size={14} /> Update Prices
        </button>
        {savedPrices && <p className={styles.successMsg}>Prices updated successfully!</p>}
          </Card>
        </>
      )}

      {activeSection === 'backup' && (
        <Card>
          <h2 className={styles.sectionTitle}><Download size={16} /> Backup & Restore</h2>
        <p className={styles.hint}>Export your local portfolio state or restore a compatible PortfolioX JSON backup.</p>
        <div className={styles.backupPanel}>
          <div className={styles.backupActions}>
            <button className={styles.saveBtn} onClick={exportBackup}>
              <Download size={14} /> Export Backup
            </button>
            <button className={styles.secondaryBtn} onClick={() => importInputRef.current?.click()}>
              <Upload size={14} /> Import Backup
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className={styles.hiddenInput}
              onChange={e => importBackup(e.target.files?.[0])}
            />
          </div>
          {(backupMessage || backupError) && (
            <p className={backupError ? styles.errorMsg : styles.successMsg}>{backupError || backupMessage}</p>
          )}
        </div>
        </Card>
      )}

      {activeSection === 'market' && (
        <Card>
          <h2 className={styles.sectionTitle}><DollarSign size={16} /> FX Rate Cache</h2>
        <p className={styles.hint}>USD to THB refreshes through fxapi.app, with manual override available when needed.</p>
        <div className={styles.fxRow}>
          <div className={styles.fxInfo}>
            <span className={styles.fxPair}>{fxRate?.base || 'USD'} / {fxRate?.quote || 'THB'}</span>
            <span className={styles.priceMeta}>
              <span className={`${styles.statusBadge} ${styles[fxRate?.status] || ''}`}>{statusLabel(fxRate?.status)}</span>
              {fxRate?.source || 'manual'} · {quoteAgeLabel(fxRate?.updatedAt) || 'never updated'}
            </span>
          </div>
          <div className={styles.priceInputWrap}>
            <span className={styles.priceDollar}>฿</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={styles.priceInput}
              value={fxInput}
              onChange={e => { setFxInput(e.target.value); setSavedFx(false) }}
            />
          </div>
          <button className={styles.saveBtn} onClick={saveFxRate}>Save FX</button>
        </div>
        {savedFx && <p className={styles.successMsg}>FX rate updated successfully!</p>}
        </Card>
      )}

      {activeSection === 'advanced' && (
        <>
          <Card className={styles.dangerCard}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>
          <Trash2 size={16} /> Danger Zone
        </h2>
        <p className={styles.dangerDesc}>
          Reset all portfolio data including holdings, transactions, cash, and market cache back to defaults.
          This action cannot be undone.
        </p>
        {!confirmReset ? (
          <button className={styles.dangerBtn} onClick={() => setConfirmReset(true)}>
            Reset All Data
          </button>
        ) : (
          <div className={styles.confirmRow}>
            <span className={styles.confirmMsg}>Are you sure? This will wipe all data.</span>
            <button className={styles.dangerBtnConfirm} onClick={resetAll}>Yes, Reset</button>
            <button className={styles.cancelBtn} onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>About</h2>
        <div className={styles.aboutGrid}>
          {[
            { label: 'App', value: 'PortfolioX' },
            { label: 'Version', value: '1.0.0' },
            { label: 'Mode', value: 'Free Dynamic + Manual Fallback' },
            { label: 'Storage', value: 'Browser localStorage' },
            { label: 'Charts', value: 'Recharts' },
            { label: 'Framework', value: 'React + Vite' },
          ].map(a => (
            <div key={a.label} className={styles.aboutRow}>
              <span className={styles.aboutLabel}>{a.label}</span>
              <span className={styles.aboutValue}>{a.value}</span>
            </div>
          ))}
        </div>
          </Card>
        </>
      )}
    </div>
  )
}
