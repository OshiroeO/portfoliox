# PortfolioX — Stock Portfolio Tracker

Personal stock portfolio dashboard for Chokdee. The app is frontend-only, privacy-first, and designed to run for free with localStorage plus free market-data providers.

## Quick Start

```bash
cd ~/stock-portfolio
npm run dev
```

Open http://localhost:5173. If that port is busy, Vite will print the next available local URL.

## Current Status

- Phase 1 complete: data foundation, migration, provider abstraction, metadata, tests.
- Phase 2 complete: free dynamic quote/FX refresh via Stooq and fxapi.app, with manual fallback.
- Phase 3 complete: transaction edit/delete, holdings rebuild, cash recalculation, JSON backup/restore.
- Phase 4 complete: realized P/L, portfolio health metrics, rebalance planner, DCA simulator.
- Cash wallet update: Available Cash is wallet cash only; deposits add cash, withdrawals remove cash, new BUY transactions consume cash, and SELL transactions add cash back. Historical seed transactions do not consume wallet deposits.
- UX Phase 1 complete: Dashboard, Settings, and Transactions now separate Cash Wallet, Stocks Market Value, and Total Portfolio Value more clearly.
- UX Phase 2 complete: Dashboard now opens with decision cards for price freshness, buying power, largest position, and best/worst performer.
- UX Phase 3 complete: Settings is organized into Wallet, Market Data, Backup, and Advanced sections.
- UX Phase 4 complete: Transactions now behaves more like a trade ticket with status guidance, Use Cash/Sell Max helpers, and safer SELL validation.
- UX Phase 5 complete: Holdings table now supports search, sortable columns, sticky header, and sticky ticker column.
- Holdings UX refresh complete: holdings now use a scannable expandable list with current price, per-stock P/L, return, stock logos with initials fallback, and detail panels.
- Performance fix complete: route-level code splitting removes the Vite large chunk warning and keeps chart-heavy pages out of the initial bundle.
- Watchlist and Target Price complete: add ticker candidates, auto-refresh current price after save through the existing free Stooq path, track target price, target date, thesis, trigger, priority, and upside.
- Watchlist UX refresh complete: list-first layout, plus-button add flow, modal add/edit form, compact stock rows, ticker avatars, sparklines, target, price, and upside badges.
- No backend, no database, no paid services.
- Portfolio data persists in browser localStorage under `portfolio_data`.

## Documentation

- [Project Overview](docs/PROJECT.md)
- [Usage Guide](docs/USAGE.md)
- [Phase History](docs/PHASES.md)

## Useful Commands

```bash
npm run dev      # start local dev server
npm test         # run Node test suite
npm run lint     # run ESLint
npm run build    # production build
```

## Notes

Market quotes are free delayed/daily data and should be treated as informational, not trading-grade realtime data. Manual price and FX overrides remain available in Settings.
