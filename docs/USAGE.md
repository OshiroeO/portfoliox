# Usage Guide

## Start The App

```bash
cd ~/stock-portfolio
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

## Read The Dashboard

Dashboard starts with decision cards for price freshness, buying power, largest position, and best/worst performer. Below that, it separates portfolio money into three concepts:

- `Available Cash`: uninvested wallet cash that can be used for new BUY transactions.
- `Stocks Market Value`: current value of positions already owned.
- `Total Portfolio Value`: Available Cash plus Stocks Market Value.

The Portfolio Value Breakdown card visualizes the split between stocks and cash so wallet cash is not confused with invested holdings.

## Refresh Market Data

Go to Settings > Market Data and use the Live Refresh card.

Available actions:

- `Refresh Market Data`: refreshes both stock quotes and USD/THB FX.
- `Refresh Prices`: refreshes holdings and watchlist stock prices through Stooq.
- `Refresh FX`: refreshes USD/THB only through fxapi.app.
- `Auto-refresh stale data on app start`: refreshes stale cached data once when the app opens.

If a free provider fails, existing prices are preserved and the affected quote/FX status becomes `error`. You can still use manual override.

## Manual Price Updates

Go to Settings > Market Data > Update Current Prices. Enter new USD prices, then click `Update Prices`. Manual updates mark prices as `fresh` with source `manual`.

## Manual FX Update

Go to Settings > Market Data > FX Rate Cache. Enter the USD/THB rate and click `Save FX`. Manual FX updates mark the FX rate as `fresh` with source `manual`.


## Cash Wallet

Go to Settings > Wallet > Cash Wallet. Available Cash means uninvested wallet cash only. It does not include current market value, cost basis, or older seed purchases.

- `Deposit` adds buying power.
- `Withdraw` removes available cash.
- New BUY transactions can only be recorded when enough cash is available.
- New SELL transactions add net proceeds back to the wallet after fees.
- Historical/seed transactions are kept for portfolio history but do not consume wallet deposits.
- Recent cash flows can be deleted from the wallet history.


## Use Watchlist And Target Prices

Go to Watchlist.

- Click the `+` button to open the add-target modal.
- Add a ticker candidate before you own it.
- Enter ticker, target price, target date, priority, thesis, and buy trigger. Current price is optional.
- If the ticker is already in holdings, the form can reuse the existing company name and current price.
- After saving, the app automatically refreshes the ticker current price through Stooq. If the provider fails, the item stays saved and manual current price can be used as fallback.
- The page calculates upside from current price to target price.
- Items are sorted by upside so the highest potential candidates rise to the top.
- Each row is optimized for scanning: ticker avatar, company, compact sparkline, current price, target price, upside badge, quote age, and edit/delete icon buttons.
- `Refresh Prices` updates watchlist current prices through the existing free Stooq quote path.
- `targetSource` is stored for future provider or LLM-assisted target-price suggestions; today target prices are manual inputs.

Watchlist does not buy stocks by itself. To purchase, go to Transactions and create a BUY transaction that uses Cash Wallet buying power.

## Review Holdings

Go to Holdings.

- Each holding row shows the stock logo, ticker, company, current price, quote age, unrealized P/L, and return percent.
- Use search to filter by ticker, company, sector, risk level, or note.
- Click a holding row to expand details below it: shares, average cost, cost basis, market value, weight, sector, note, and a full-detail link.
- Stock logos load from a free public logo endpoint using ticker-to-domain mapping. If a logo cannot load, the app falls back to ticker initials automatically.
- The Dashboard still uses the compact holdings table for overview scanning.

## Manage Transactions

Go to Transactions.

- Choose BUY or SELL.
- Enter ticker, date, quantity, price, fee, and note.
- The trade ticket shows Available Cash, estimated cost, shares available, and cash after trade before submission.
- Use `Use Cash` on BUY to estimate a maximum fractional share quantity from available cash and current price.
- Use `Sell Max` on SELL to fill the current sellable share quantity.
- Trade status explains whether the ticket is ready or what needs attention before submission.
- SELL validation prevents selling more shares than currently held and blocks fees that exceed gross proceeds.
- BUY updates average cost automatically and subtracts from Cash Wallet.
- SELL reduces shares and adds net proceeds back to Cash Wallet after fees.
- Click `Edit` on a history item to load it into the form, then save changes.
- Click `Delete` on a history item to remove it. Holdings and cash are rebuilt from the remaining history.



## Advanced Analysis

Go to Analysis.

The top metric strip shows unrealized P/L, realized P/L, total P/L, closed-trade win rate, largest position, and risk score.

Use the Rebalance Planner to compare current weights against equal-weight or risk-aware targets. The trade plan shows whether each position should be held, added, or trimmed and estimates trade value plus share count.

Use the DCA Simulator by entering a USD budget. Losing positions will show estimated shares, new average cost, and average-cost reduction.

## Backup And Restore

Go to Settings > Backup > Backup & Restore.

- `Export Backup` downloads a PortfolioX JSON backup with holdings, transactions, cash, FX, and market-data metadata.
- `Import Backup` accepts a compatible JSON file and validates it through the same migration path used by localStorage.
- Invalid or incompatible files are rejected without replacing current state.

## Reset Data

Go to Settings > Advanced > Danger Zone > Reset All Data. This removes `portfolio_data` from localStorage and reloads seed data.

## Troubleshooting

If stale localStorage creates unexpected UI values, hard refresh the browser first. The current wallet and watchlist migration is `v8-watchlist`, which recalculates Available Cash so older seed buys do not consume wallet deposits. If values are still wrong, reset data from Settings. If a provider returns `error`, try manual override or refresh later. In local dev, Stooq quote refresh uses the Vite `/stooq` proxy because Stooq does not send browser CORS headers. Free quote data is delayed/daily and not guaranteed to be realtime.

## Performance Notes

The app uses route-level code splitting. Dashboard, Holdings, Transactions, Analysis, Settings, and Stock Detail load as separate route chunks, so chart-heavy pages do not all ship in the initial JavaScript bundle.

## Verification Commands

```bash
npm test
npm run lint
npm run build
```
