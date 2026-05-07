import test from 'node:test'
import assert from 'node:assert/strict'
import {
  QUOTE_TTL_MS,
  FxApiProvider,
  ManualProvider,
  StooqProvider,
  createManualQuoteUpdate,
  isStale,
  metadataStatus,
  parseFxApiRate,
  parseStooqQuoteCsv,
  quoteAgeLabel,
  toStooqSymbol,
} from './marketData.js'

const now = new Date('2026-05-06T12:00:00.000Z')

test('isStale and metadataStatus classify quote age by ttl', () => {
  const fresh = '2026-05-06T11:00:00.000Z'
  const stale = '2026-05-06T01:00:00.000Z'

  assert.equal(isStale(fresh, QUOTE_TTL_MS, now.getTime()), false)
  assert.equal(isStale(stale, QUOTE_TTL_MS, now.getTime()), true)
  assert.equal(metadataStatus(fresh, QUOTE_TTL_MS, false, now.getTime()), 'fresh')
  assert.equal(metadataStatus(fresh, QUOTE_TTL_MS, true, now.getTime()), 'error')
})

test('quoteAgeLabel returns compact labels', () => {
  assert.equal(quoteAgeLabel('2026-05-06T11:15:00.000Z', now.getTime()), '45m ago')
  assert.equal(quoteAgeLabel('2026-05-05T11:00:00.000Z', now.getTime()), '1d ago')
})

test('manual provider returns quote metadata from holdings', () => {
  const quotes = ManualProvider.getQuotes(['AAA'], [{
    ticker: 'AAA',
    currentPrice: 12.5,
    priceUpdatedAt: '2026-05-06T11:30:00.000Z',
    priceSource: 'manual',
    priceStatus: 'fresh',
  }])

  assert.equal(quotes.AAA.price, 12.5)
  assert.equal(quotes.AAA.source, 'manual')
  assert.equal(quotes.AAA.status, 'fresh')
})

test('createManualQuoteUpdate marks prices fresh', () => {
  const update = createManualQuoteUpdate(19.25, now)

  assert.equal(update.currentPrice, 19.25)
  assert.equal(update.priceUpdatedAt, '2026-05-06T12:00:00.000Z')
  assert.equal(update.priceSource, 'manual')
  assert.equal(update.priceStatus, 'fresh')
})


test('toStooqSymbol appends US suffix for plain US tickers', () => {
  assert.equal(toStooqSymbol('MSFT'), 'msft.us')
  assert.equal(toStooqSymbol('brk.b.us'), 'brk.b.us')
})

test('parseStooqQuoteCsv extracts latest close and metadata', () => {
  const quote = parseStooqQuoteCsv('Date,Open,High,Low,Close,Volume\n2026-05-05,10,12,9,11.5,1000', 'AAA')

  assert.equal(quote.ticker, 'AAA')
  assert.equal(quote.price, 11.5)
  assert.equal(quote.source, 'stooq')
  assert.equal(quote.status, 'fresh')
})

test('parseFxApiRate extracts USD/THB payload', () => {
  const fx = parseFxApiRate({ base: 'USD', target: 'THB', rate: 36.25, timestamp: '2026-05-05T10:00:00.000Z' })

  assert.equal(fx.base, 'USD')
  assert.equal(fx.quote, 'THB')
  assert.equal(fx.rate, 36.25)
  assert.equal(fx.source, 'fxapi.app')
})

test('StooqProvider returns error quote when a ticker fetch fails', async () => {
  const quotes = await StooqProvider.getQuotes(['BAD'], [], async () => ({
    ok: false,
    status: 404,
    text: async () => '',
  }))

  assert.equal(quotes.BAD.status, 'error')
  assert.equal(quotes.BAD.source, 'stooq')
})

test('FxApiProvider fetches FX through injectable fetcher', async () => {
  const fx = await FxApiProvider.getFxRate('USD', 'THB', null, async () => ({
    ok: true,
    json: async () => ({ base: 'USD', target: 'THB', rate: 36.25, timestamp: '2026-05-05T10:00:00.000Z' }),
  }))

  assert.equal(fx.rate, 36.25)
  assert.equal(fx.status, 'fresh')
})
