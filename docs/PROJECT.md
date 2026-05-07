# Project Overview

PortfolioX is a React 19 + Vite stock portfolio tracker. It tracks holdings, transactions, cash, watchlist targets, market prices, FX rate, portfolio allocation, P/L, risk, DCA suggestions, and per-stock detail pages.

## Stack

| Layer | Tech |
| --- | --- |
| Framework | React 19 + Vite 8 |
| Routing | react-router-dom v7 |
| Charts | Recharts 3 |
| Icons | lucide-react |
| Styles | CSS Modules |
| State | React Context via `usePortfolio` |
| Performance | Route-level React lazy loading with `Suspense` |
| Persistence | browser localStorage |
| Tests | Node built-in test runner |
| Backend | none |

## Data Model

Seed data lives in `src/data/mockData.js`. User state is loaded, migrated, and saved through `src/utils/storageMigration.js` and `src/hooks/usePortfolio.jsx`. Transaction-driven portfolio rebuilding lives in `src/utils/portfolioOperations.js`.

Persisted localStorage shape includes:

- `version`
- `holdings`
- `transactions`
- `watchlist`
- `cashFlows`
- `cash`
- `fxRate`
- `marketData`

Current localStorage key: `portfolio_data`.

Current data version: `v8-watchlist`. Older supported migrations include `v2-real`, `v3-phase1`, `v4-phase2`, `v5-phase3`, `v6-cash-wallet`, and `v7-cash-impact`.



## Cash Wallet

The app tracks a cash wallet used as buying power. Cash is derived from cash flows plus stock transactions that explicitly opt into wallet impact:

`available cash = deposits - withdrawals - cashImpact buy costs + cashImpact sell proceeds`

Cash flows are stored separately from stock transactions as `cashFlows`. Stock transactions include `cashImpact`; historical seed/legacy transactions default to `false` so old buys do not consume newly deposited wallet cash. Newly recorded BUY/SELL transactions use `cashImpact: true`. Legacy saved cash without cash-flow records is not treated as available wallet cash. BUY validation prevents buying more than available cash. SELL transactions add proceeds back to cash after fees. Settings contains the Cash Wallet UI for deposit, withdrawal, and recent cash-flow history.


## Watchlist And Target Prices

Watchlist items are stored in `watchlist` and are separate from owned holdings. This lets the app track candidates before a BUY transaction exists.

Watchlist fields include:

- `ticker`
- `companyName`
- `currentPrice`
- `targetPrice`
- `targetDate`
- `targetSource`
- `thesis`
- `trigger`
- `priority`
- quote metadata: `priceUpdatedAt`, `priceSource`, `priceStatus`, `quoteTtlMs`

The current implementation is target-manual and price-automatic: users enter target prices, thesis, trigger, priority, and date themselves, while current price is optional and refreshes automatically through the same free Stooq quote provider after a watchlist item is saved. Manual current price remains available as a fallback if the free provider fails. The `targetSource` field is reserved for future provider- or LLM-assisted target suggestions without changing the saved-data shape again.

## Portfolio Operations

Phase 3 makes transaction history a stronger source of truth. Editing or deleting a transaction rebuilds holdings and recalculates cash from the transaction set. Existing market price metadata is preserved where possible so an operations change does not erase quote freshness/source data.

Supported operations:

- Add BUY/SELL transaction.
- Edit existing transaction.
- Delete existing transaction.
- Rebuild holdings from transaction history.
- Recalculate cash from cash flows and cash-impact transaction history.
- Export local portfolio state to JSON.
- Import compatible PortfolioX JSON backups through migration validation.

## Market Data

Market data is designed around provider abstraction in `src/providers/marketData.js`.

Current providers:

- Manual provider: local/manual price and FX updates.
- Stooq provider: free latest quote CSV for US tickers, using `.us` suffix mapping.
- fxapi.app provider: free no-key USD/THB FX rate.

Quote metadata on holdings:

- `currentPrice`
- `priceUpdatedAt`
- `priceSource`
- `priceStatus` (`fresh`, `stale`, `error`)
- `priceError`
- `quoteTtlMs`

FX metadata:

- `base`
- `quote`
- `rate`
- `updatedAt`
- `source`
- `status`
- `ttlMs`

Default TTLs:

- Quotes: 4 hours
- FX: 24 hours


## Advanced Analytics

Phase 4 adds analytics utilities in `src/utils/analytics.js`. These use local holdings and transactions only, with no new backend or paid provider.

Analytics currently include:

- FIFO realized P/L from closed sell trades.
- Combined realized + unrealized total P/L.
- Closed-trade win rate.
- Largest position and top-three concentration.
- Sector concentration and high-risk weight.
- Weighted portfolio risk score.
- Equal-weight and risk-aware rebalance trade planner.
- DCA simulator with configurable budget.

The Analysis page is the main UI for these outputs.

## Main Pages

- `/dashboard`: decision cards, overview stat cards, portfolio value breakdown, allocation pie, performance chart, searchable/sortable holdings table.
- `/holdings`: THB summary strip plus scannable expandable holdings list showing stock logo, current price, per-stock P/L, return, quote age, and detail panels.
- `/holdings/:ticker`: per-stock metrics, price chart, DCA analysis, risk warning, transaction history.
- `/transactions`: buy/sell trade ticket, wallet preview, status guidance, Use Cash/Sell Max helpers, validation, history, stats.
- `/watchlist`: list-first candidate tracker with plus-button add flow, modal add/edit form, ticker avatar, synthetic sparkline, current price, target price, upside badge, target date, thesis, buy trigger, priority, and watchlist quote refresh.
- `/analysis`: health metrics, realized/unrealized P/L, sector allocation, concentration, gainers/losers, rebalance planner, DCA simulator.
- `/settings`: portfolio snapshot plus section tabs for Wallet, Market Data, Backup, and Advanced controls.

## Design Conventions

- THB is the primary display currency.
- USD remains the stored stock-price currency and secondary display currency.
- Cash Wallet, Stocks Market Value, and Total Portfolio Value should be labeled separately anywhere money is summarized.
- Dashboard should prioritize decision cues before charts: price freshness, buying power, concentration, and top/bottom performance.
- Settings should keep routine controls separate from destructive controls: Wallet, Market Data, Backup, and Advanced.
- Transactions should show trade readiness before submission and explain blocking issues directly in the ticket.
- Holdings should prioritize scannable owned-stock rows over dense tables: logo, ticker, company, current price, per-stock P/L, and return must be visible before expansion.
- Holdings rows expand in place for shares, average cost, cost basis, market value, weight, sector, note, and full detail link.
- Stock logos are fetched from a free public logo endpoint using ticker-to-domain mapping in `src/utils/stockLogos.js`; missing logos must fall back to ticker initials.
- Watchlist should keep owned holdings separate from candidates, prioritize scannable stock rows over persistent forms, and expose add/edit through a compact modal flow.
- Watchlist rows should show ticker identity, current price, target price, upside, quote freshness, and a small sparkline-like visual for fast scanning.
- Route components should stay lazy-loaded so chart-heavy pages and Recharts code do not inflate the initial bundle.
- Fractional shares are supported.
- CSS Modules are used for component/page styling.
- Global classes are limited to helpers in `src/index.css`, such as `.profit`, `.loss`, and `.neutral`.
- Prefer extending existing files unless a small utility/provider/test file makes the architecture clearer.
