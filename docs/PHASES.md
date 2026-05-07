# Phase History

## Phase 1 — Data Foundation

Completed on May 6, 2026.

Implemented:

- Separated seed/default data from persisted portfolio state.
- Added quote metadata: updated time, source, status, TTL.
- Added FX snapshot metadata.
- Added provider abstraction with manual provider.
- Added localStorage migration helpers.
- Made calculations defensive against invalid numbers.
- Added focused tests for calculations, metadata, and migration.
- Added small UI indicators for price source/status/last update.

Verification at completion:

- `npm test` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Phase 2 — Free Dynamic Market Data

Completed on May 6, 2026.

Implemented:

- Added Stooq latest quote provider for free delayed/daily stock prices.
- Added fxapi.app provider for free no-key USD/THB FX.
- Added refresh actions in portfolio context: `refreshQuotes`, `refreshFxRate`, `refreshMarketData`.
- Added auto-refresh for stale data at app start.
- Added Settings UI controls for live refresh and auto-refresh toggle.
- Preserved manual fallback when providers fail.
- Migrated storage to `v4-phase2`.
- Added provider parser/fetch tests.

Verification at completion:

- `npm test` passed with 17 tests.
- `npm run lint` passed.
- `npm run build` passed.
- Live provider smoke test passed for Stooq quotes and fxapi.app USD/THB.

## Phase 3 — Portfolio Operations

Completed on May 6, 2026.

Implemented:

- Added transaction edit and delete operations.
- Added transaction-set rebuild logic for holdings and cash.
- Preserved market price metadata during holdings rebuilds.
- Added JSON backup export from Settings.
- Added JSON backup import with migration validation.
- Migrated storage to `v5-phase3`.
- Added tests for holdings rebuild, cash recalculation, and sold-out positions.

Verification at completion:

- `npm test` passed with 20 tests.
- `npm run lint` passed.
- `npm run build` passed.

## Phase 4 — Advanced Analytics

Completed on May 6, 2026.

Implemented:

- Added `src/utils/analytics.js`.
- Added FIFO realized P/L for closed trades.
- Added combined realized + unrealized total P/L.
- Added win rate, largest position, top-three concentration, top sector, high-risk weight, and risk score.
- Upgraded Analysis page with a health metric strip.
- Added equal-weight/risk-aware rebalance planner with trade value and share estimates.
- Added configurable DCA simulator for losing positions.
- Added analytics tests.

Verification at completion:

- `npm test` passed with 24 tests.
- `npm run lint` passed.
- `npm run build` passed.

## Cash Wallet Update

Completed on May 6, 2026.

Implemented:

- Added `cashFlows` for deposits and withdrawals.
- Added Cash Wallet UI in Settings.
- BUY validation now checks available wallet cash only.
- BUY subtracts cash; SELL adds proceeds back after fees.
- Cash recalculates from cash flows plus stock transactions.
- Legacy saved cash without cash-flow records is reset to wallet cash `0` during migration/recalculation.
- Migrated storage to `v6-cash-wallet`.
- Added cash-flow tests.

Verification at completion:

- `npm test` passed with 26 tests.
- `npm run lint` passed.
- `npm run build` passed.

## Cash Impact Fix

Completed on May 6, 2026.

Implemented:

- Added `cashImpact` to stock transactions.
- Historical seed/legacy transactions default to `cashImpact: false` so older buys do not consume new wallet deposits.
- Newly recorded BUY/SELL transactions use `cashImpact: true`.
- Available Cash now derives from cash flows plus only cash-impact stock transactions.
- Migrated storage to `v7-cash-impact`.
- Added regression tests for wallet deposits with historical transactions.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.

## UX Phase 1 — Cash And Value Clarity

Completed on May 6, 2026.

Implemented:

- Updated Dashboard stat wording to distinguish Total Portfolio Value, Stocks Market Value, and Available Cash.
- Added Dashboard Portfolio Value Breakdown with stock/cash split.
- Added Settings Cash Wallet breakdown for Cash Wallet, Stocks Owned, and Total Portfolio.
- Added Transactions wallet preview showing buying power, estimated cost, shares available, and cash after trade.
- Corrected SELL preview/history totals to show net proceeds after fees.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.

## UX Phase 2 — Dashboard Decision Layer

Completed on May 6, 2026.

Implemented:

- Added Dashboard decision cards above summary stats.
- Added direct links from decision cards to Settings, Transactions, Holdings, and stock detail pages.
- Surfaced price freshness, buying power, largest position concentration, and best/worst performer.
- Added responsive two-column and one-column layouts for the decision cards.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.

## UX Phase 3 — Settings Information Architecture

Completed on May 6, 2026.

Implemented:

- Added Settings section tabs for Wallet, Market Data, Backup, and Advanced.
- Kept Portfolio Snapshot visible above all Settings sections.
- Moved Cash Wallet into the Wallet section.
- Grouped Live Refresh, manual price overrides, and FX cache under Market Data.
- Isolated Backup & Restore and Danger Zone into separate sections.
- Reset confirmation state now clears when switching Settings sections.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.

## UX Phase 4 — Transactions Trade Ticket

Completed on May 6, 2026.

Implemented:

- Added trade status guidance for draft, ready, and blocked transaction states.
- Added `Use Cash` helper for BUY quantity estimation from available wallet cash.
- Added `Sell Max` helper for SELL quantity based on shares available.
- Disabled submission when buying power is insufficient, SELL quantity is too high, no shares are available, or SELL fee exceeds gross proceeds.
- Added edit-mode guidance explaining that saving rebuilds holdings and wallet cash from history.
- Made delete actions visually destructive by default instead of only on hover.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.

## UX Phase 5 — Holdings Table Upgrade

Completed on May 6, 2026.

Implemented:

- Added holdings search for ticker, company, sector, risk level, and note.
- Added sortable table headers for ticker, shares, average cost, price, cost, value, P/L, return, and weight.
- Default sort now ranks holdings by market value descending.
- Added sticky table header and sticky ticker column for scroll-heavy tables.
- Added result count and empty search state.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed; Vite still reports the existing large-chunk warning.

## Performance Fix — Route-Level Code Splitting

Completed on May 6, 2026.

Implemented:

- Converted page imports in `src/App.jsx` to `React.lazy`.
- Wrapped route rendering in `Suspense` with a lightweight route loader.
- Added `src/App.module.css` for the route loading state.
- Split chart-heavy pages and Recharts code out of the initial application bundle.
- Removed the Vite large chunk warning in production build.

Verification at completion:

- `npm test` passed with 30 tests.
- `npm run lint` passed.
- `npm run build` passed with no Vite large chunk warning.
- Initial JS chunk is now about 230 kB minified / 74 kB gzip; chart-heavy chunks are split separately.


## Watchlist And Target Price

Completed on May 6, 2026.

Implemented:

- Added persisted `watchlist` data model with migration to `v8-watchlist`.
- Added Watchlist route and sidebar entry at `/watchlist`.
- Added target tracking: ticker, company, optional manual current price, target price, target date, priority, thesis, and buy trigger.
- Watchlist add/save now automatically refreshes the ticker current price through the Stooq quote path, so users do not need to type current price manually.
- Added upside and target-status calculations so candidates can be ranked by potential return.
- Integrated watchlist tickers into `refreshQuotes`, `refreshMarketData`, and app-start stale-data refresh.
- Preserved export/import support through the shared storage migration path.
- Added `targetSource` to support future provider- or LLM-assisted target-price suggestions without another schema redesign.
- Added regression coverage for migrating watchlist target metadata.

Verification at completion:

- `npm test` passed with 31 tests.
- `npm run lint` passed.
- `npm run build` passed with no Vite large chunk warning.
- Watchlist route chunk is split separately at about 9 kB minified / 2.7 kB gzip.


## Watchlist UX Refresh

Completed on May 6, 2026.

Implemented:

- Reworked Watchlist into a list-first screen inspired by mobile stock watchlists.
- Moved add/edit into a modal opened by a compact `+` button instead of showing the full form permanently.
- Replaced large cards with scannable stock rows showing market pill, ticker avatar, ticker/company, sparkline, current price, target price, upside badge, quote age, and icon actions.
- Kept auto-refresh-on-save behavior for newly added or edited tickers.
- Added responsive behavior so rows collapse cleanly on narrow screens and the modal becomes bottom-sheet-like on mobile.

Verification at completion:

- `npm test` passed with 31 tests.
- `npm run lint` passed.
- `npm run build` passed with no Vite large chunk warning.
- Watchlist route chunk is about 11.2 kB minified / 3.65 kB gzip after the list-first UI refresh.


## Holdings UX Refresh

Completed on May 6, 2026.

Implemented:

- Reworked `/holdings` from risk-card/table-first into a scannable owned-stock list.
- Each row now shows stock logo, ticker, company, current price, quote freshness, unrealized P/L, and return percent before expansion.
- Clicking a holding expands an inline detail panel with shares, average cost, cost basis, market value, weight, sector, note, and full detail link.
- Added `src/utils/stockLogos.js` for ticker-to-domain logo lookup through a free public logo endpoint.
- Added automatic initials fallback when a logo URL is missing or fails to load.
- Kept Dashboard using the compact `HoldingsTable` for overview tables.

Verification at completion:

- `npm test` passed with 31 tests.
- `npm run lint` passed.
- `npm run build` passed with no Vite large chunk warning.
- Holdings route chunk is about 6.92 kB minified / 2.19 kB gzip after the expandable-list refresh.

## Documentation Rule

After every completed phase, update docs in the same turn:

- `README.md`: high-level current status.
- `docs/PROJECT.md`: architecture and project explanation.
- `docs/USAGE.md`: user/developer usage instructions.
- `docs/PHASES.md`: phase completion log and verification.
- `CLAUDE.md`: agent-facing project context when conventions or architecture change.
