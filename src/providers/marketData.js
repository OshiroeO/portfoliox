import { FX_RATE } from '../data/mockData.js'

export const QUOTE_TTL_MS = 4 * 60 * 60 * 1000
export const FX_TTL_MS = 24 * 60 * 60 * 1000
export const PRICE_STATUSES = ['fresh', 'stale', 'error']

const STOOQ_URL = 'https://stooq.com/q/l/'
const STOOQ_PROXY_URL = '/stooq/q/l/'
const FXAPI_URL = 'https://fxapi.app/api'

export function isValidDate(value) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()))
}

export function isStale(updatedAt, ttlMs = QUOTE_TTL_MS, now = Date.now()) {
  if (!updatedAt) return true
  const time = new Date(updatedAt).getTime()
  if (Number.isNaN(time)) return true
  return now - time > ttlMs
}

export function metadataStatus(updatedAt, ttlMs = QUOTE_TTL_MS, hasError = false, now = Date.now()) {
  if (hasError) return 'error'
  return isStale(updatedAt, ttlMs, now) ? 'stale' : 'fresh'
}

export function quoteAgeLabel(updatedAt, now = Date.now()) {
  if (!updatedAt) return null
  const time = new Date(updatedAt).getTime()
  if (Number.isNaN(time)) return null
  const ms = Math.max(0, now - time)
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function normalizeQuoteMetadata(meta = {}, ttlMs = QUOTE_TTL_MS, now = Date.now()) {
  const updatedAt = isValidDate(meta.updatedAt ?? meta.priceUpdatedAt)
    ? new Date(meta.updatedAt ?? meta.priceUpdatedAt).toISOString()
    : null
  const hasError = meta.status === 'error' || meta.priceStatus === 'error'

  return {
    updatedAt,
    source: meta.source ?? meta.priceSource ?? 'manual',
    status: metadataStatus(updatedAt, ttlMs, hasError, now),
    ttlMs,
  }
}

export function createManualQuoteUpdate(price, now = new Date()) {
  return {
    currentPrice: Number(price),
    priceUpdatedAt: now.toISOString(),
    priceSource: 'manual',
    priceStatus: 'fresh',
  }
}

export function createSeedQuoteMetadata(ttlMs = QUOTE_TTL_MS) {
  return {
    priceUpdatedAt: null,
    priceSource: 'seed',
    priceStatus: 'stale',
    quoteTtlMs: ttlMs,
  }
}

export function createSeedFxSnapshot() {
  return {
    base: 'USD',
    quote: 'THB',
    rate: FX_RATE,
    updatedAt: null,
    source: 'seed',
    status: 'stale',
    ttlMs: FX_TTL_MS,
  }
}


function shouldUseStooqProxy() {
  const host = globalThis.location?.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function stooqUrl() {
  return shouldUseStooqProxy() ? new URL(STOOQ_PROXY_URL, globalThis.location.origin) : new URL(STOOQ_URL)
}

export function toStooqSymbol(ticker) {
  const symbol = String(ticker || '').trim().toLowerCase()
  if (!symbol) return ''
  if (symbol.includes('.') || symbol.startsWith('^')) return symbol
  return `${symbol}.us`
}

function parseCsvRows(csv) {
  const [headerLine, ...lines] = String(csv || '').trim().split(/\r?\n/)
  if (!headerLine || !lines.length) return []
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase())
  return lines.map(line => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim()]))
  })
}

export function parseStooqQuoteCsv(csv, ticker, now = new Date()) {
  const row = parseCsvRows(csv)[0]
  const close = Number(row?.close)
  if (!row || !Number.isFinite(close) || close <= 0) {
    throw new Error(`No valid Stooq quote for ${ticker}`)
  }

  const date = row.date && row.date !== 'N/D' ? row.date : now.toISOString().split('T')[0]
  const time = row.time && row.time !== 'N/D' ? row.time : '21:00:00'
  return {
    ticker,
    price: close,
    updatedAt: new Date(`${date}T${time}.000Z`).toISOString(),
    source: 'stooq',
    status: 'fresh',
    ttlMs: QUOTE_TTL_MS,
    providerSymbol: row.symbol || toStooqSymbol(ticker),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    volume: Number(row.volume),
  }
}

export function parseFxApiRate(payload, base = 'USD', quote = 'THB') {
  const rate = Number(payload?.rate)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No valid FX rate for ${base}/${quote}`)
  }

  return {
    base: payload.base || base,
    quote: payload.target || quote,
    rate,
    updatedAt: isValidDate(payload.timestamp) ? new Date(payload.timestamp).toISOString() : new Date().toISOString(),
    source: 'fxapi.app',
    status: 'fresh',
    ttlMs: FX_TTL_MS,
  }
}


export const ManualProvider = {
  name: 'manual',

  getQuotes(tickers, holdings) {
    const map = Object.fromEntries(holdings.map(h => [h.ticker, h]))
    return Object.fromEntries(
      tickers.map(t => {
        const h = map[t]
        const meta = normalizeQuoteMetadata({
          updatedAt: h?.priceUpdatedAt,
          source: h?.priceSource,
          status: h?.priceStatus,
        })
        return [t, {
          price: h?.currentPrice ?? null,
          source: meta.source,
          updatedAt: meta.updatedAt,
          status: meta.status,
          ttlMs: meta.ttlMs,
        }]
      })
    )
  },

  getFxRate(base = 'USD', quote = 'THB', fxSnapshot = createSeedFxSnapshot()) {
    if (fxSnapshot.base !== base || fxSnapshot.quote !== quote) return null
    const meta = normalizeQuoteMetadata(fxSnapshot, FX_TTL_MS)
    return {
      ...fxSnapshot,
      updatedAt: meta.updatedAt,
      source: meta.source,
      status: meta.status,
      ttlMs: meta.ttlMs,
    }
  },

  updateManualPrice(_ticker, price) {
    return createManualQuoteUpdate(price)
  },
}

export const StooqProvider = {
  name: 'stooq',

  async getQuotes(tickers, _holdings, fetcher = globalThis.fetch) {
    if (!fetcher) throw new Error('fetch is unavailable')

    const results = await Promise.allSettled(tickers.map(async ticker => {
      const url = stooqUrl()
      url.searchParams.set('s', toStooqSymbol(ticker))
      url.searchParams.set('f', 'sd2t2ohlcv')
      url.searchParams.set('h', '')
      url.searchParams.set('e', 'csv')
      const response = await fetcher(url.toString())
      if (!response.ok) throw new Error(`Stooq ${response.status} for ${ticker}`)
      const csv = await response.text()
      return parseStooqQuoteCsv(csv, ticker)
    }))

    return Object.fromEntries(results.map((result, index) => {
      const ticker = tickers[index]
      if (result.status === 'fulfilled') return [ticker, result.value]
      return [ticker, {
        ticker,
        price: null,
        updatedAt: new Date().toISOString(),
        source: 'stooq',
        status: 'error',
        error: result.reason?.message || 'Quote refresh failed',
        ttlMs: QUOTE_TTL_MS,
      }]
    }))
  },
}

export const FxApiProvider = {
  name: 'fxapi.app',

  async getFxRate(base = 'USD', quote = 'THB', _fxSnapshot, fetcher = globalThis.fetch) {
    if (!fetcher) throw new Error('fetch is unavailable')

    const response = await fetcher(`${FXAPI_URL}/${base}/${quote}.json`)
    if (!response.ok) throw new Error(`fxapi.app ${response.status} for ${base}/${quote}`)
    return parseFxApiRate(await response.json(), base, quote)
  },
}
