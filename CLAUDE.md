# PortfolioX — Stock Portfolio Tracker

Personal stock portfolio dashboard ของ Chokdee (ศตวรุตย์).
ใช้ข้อมูลจริงจาก Google Sheets ของเจ้าของเป็น seed data และมี free dynamic market refresh ผ่าน Stooq/fxapi.app พร้อม manual fallback. ไม่มี backend/database และยังเก็บข้อมูลหลักใน localStorage.

---

## Quick Start

```bash
cd ~/stock-portfolio
npm run dev        # dev server → http://localhost:5173 (หรือ 5174 ถ้า port ชน)
npm run build      # production build
```

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite 8 |
| Routing | react-router-dom v7 |
| Charts | Recharts 3 |
| Icons | lucide-react |
| Styles | CSS Modules (`.module.css` ทุกไฟล์) |
| State | React Context (`usePortfolio`) + `localStorage` |
| Performance | Route-level lazy loading with `React.lazy` + `Suspense` |
| Market data | Free providers: Stooq quotes + fxapi.app USD/THB FX |
| No backend | ไม่มี backend, ไม่มี database |

---

## Folder Structure

```
src/
├── App.jsx                  # Router setup + PortfolioProvider wrapper
├── index.css                # Global CSS variables (dark theme)
│
├── data/
│   └── mockData.js          # seed portfolio data + default FX + performance history
│
├── utils/
│   ├── calculations.js      # calcHolding, calcPortfolioTotals, formatters
│   ├── analytics.js          # realized P/L, health metrics, rebalance, DCA simulator
│   ├── portfolioOperations.js # rebuild holdings/cash from transactions
│   └── storageMigration.js  # localStorage load/migrate/serialize helpers
│
├── providers/
│   └── marketData.js        # Manual, Stooq, fxapi.app providers + metadata helpers
│
├── hooks/
│   └── usePortfolio.jsx     # Context + localStorage persistence
│
├── components/
│   ├── Layout.jsx            # Sidebar + <Outlet>
│   ├── Sidebar.jsx           # Left nav (6 links)
│   ├── Card.jsx              # Reusable dark card wrapper
│   ├── StatCard.jsx          # Metric card (label / value / sub)
│   ├── Badge.jsx             # Risk/Type badge (color by label)
│   └── HoldingsTable.jsx     # Compact table used by Dashboard overview
│
└── pages/
    ├── Dashboard.jsx         # Overview: stat cards + pie + line chart + table
    ├── Holdings.jsx          # Expandable owned-stock list + summary strip
    ├── StockDetail.jsx       # Per-stock metrics, DCA analysis, price chart, warnings
    ├── Transactions.jsx      # Buy/Sell form + history list
    ├── Watchlist.jsx         # Candidate tickers + target price tracking
    ├── Analysis.jsx          # Sector pie, concentration bar, gainers/losers, rebalance, DCA
    └── Settings.jsx          # Wallet, market data, backup, advanced settings
```

---

## Real Portfolio Data (`src/data/mockData.js`)

**Currency logic:** ราคาเก็บเป็น **USD** แต่แสดงผลหลักเป็น **THB**

```js
export const FX_RATE = 32.59   // USD → THB (อัปเดตได้ใน Settings)
export const DATA_VERSION = 'v8-watchlist'  // migration version for localStorage
export const CASH_AVAILABLE = 0
```

**9 Holdings (ข้อมูลจริง):**

| Ticker | Company | Shares | Avg Cost (USD) | Sector | Risk |
|--------|---------|--------|----------------|--------|------|
| TSM | Taiwan Semiconductor Mfg | 1.3759 | $337.83 | Semiconductor | Medium |
| MSFT | Microsoft Corp | 0.5746 | $403.72 | Technology | Low |
| NVDA | NVIDIA Corp | 2.6174 | $189.06 | Semiconductor / AI | Medium |
| GOOGL | Alphabet Inc Class A | 1.0172 | $304.53 | Technology / AI | Low |
| VOO | Vanguard S&P 500 ETF | 0.4951 | $614.26 | ETF | Low |
| CRWD | CrowdStrike Holdings | 0.2193 | $455.96 | Cybersecurity | High |
| FTNT | Fortinet Inc | 0.5243 | $85.83 | Cybersecurity | Medium |
| PLTR | Palantir Technologies | 0.8174 | $137.56 | AI / Software | High |
| RKLB | Rocket Lab Corp | 1.7975 | $77.76 | Space | High |

**Performance history** เป็น THB (`performanceHistory`) — เริ่ม Oct 2024 ถึง May 2026.

---

## State Management (`src/hooks/usePortfolio.jsx`)

```js
const { holdings, transactions, cash, cashFlows, watchlist, fxRate, marketData, addTransaction, updateTransaction, deleteTransaction, addWatchItem, updateWatchItem, deleteWatchItem, exportPortfolioData, importPortfolioData, updatePrice, updateFxRate, refreshMarketData } = usePortfolio()
```

- `holdings` — array ของ holding objects (shares, averageCost, currentPrice, sector, riskLevel, note, price metadata)
- `transactions` — array ของ tx objects (id, type, ticker, date, quantity, price, fee, note, cashImpact)
- `cashFlows` — deposits/withdrawals for buying power
- `watchlist` — candidate tickers with currentPrice, targetPrice, targetDate, targetSource, thesis, trigger, priority, and quote metadata
- `cash` — USD buying power derived from cash flows + cash-impact stock transactions. Available Cash must never include market value of holdings or legacy saved cash without cash-flow records. Historical/seed transactions have `cashImpact: false` and do not consume wallet deposits
- `fxRate` — USD/THB snapshot with rate/source/status/updatedAt
- `marketData` — provider settings and refresh metadata
- `addTransaction(tx)` — เพิ่ม stock transaction แล้ว rebuild holdings/cash; new BUY/SELL transactions use `cashImpact: true`, BUY uses cash wallet, SELL adds proceeds
- `updateTransaction(id, tx)` — แก้ transaction แล้ว rebuild holdings/cash
- `deleteTransaction(id)` — ลบ transaction แล้ว rebuild holdings/cash
- `exportPortfolioData()` — return JSON-ready backup object
- `importPortfolioData(payload)` — validate/migrate backup แล้ว replace state
- `updatePrice(ticker, price)` — manual update currentPrice ของ holding
- `updateFxRate(rate)` — manual update USD/THB
- `addWatchItem(item)`, `updateWatchItem(id, item)`, `deleteWatchItem(id)` — manage Watchlist candidates and manual target-price metadata
- `refreshMarketData()` — refresh Stooq quotes for holdings/watchlist + fxapi.app FX

**localStorage key:** `portfolio_data`
**Migration:** ใช้ `src/utils/storageMigration.js`; รองรับ migration จาก `v2-real`, `v3-phase1`, `v4-phase2`, `v5-phase3`, `v6-cash-wallet`, `v7-cash-impact` ไป `v8-watchlist` โดยไม่ reset ถ้าข้อมูลยัง valid

---

## Calculation Utilities (`src/utils/calculations.js`)

```js
calcHolding(h)
// → { ...h, totalCost, marketValue, unrealizedPL, plPercent,
//          totalCostTHB, marketValueTHB, unrealizedPLTHB }

calcPortfolioTotals(holdings)
// → { holdings (with weight%), totalMarketValue, totalCost, totalPL, totalReturn,
//     totalMarketValueTHB, totalCostTHB, totalPLTHB }

fmtUSD(n)   // → "$1,234.56"
fmtTHB(n)   // → "฿40,234"  (0 decimals by default)
fmtPct(n)   // → "+12.34%"
fmt(n, d)   // → localized number string
plClass(n)  // → "profit" | "loss" | "neutral"  (CSS class)
```

---

## Pages — What Each Page Does

### Dashboard (`/dashboard`)
- 6 StatCards: Total Portfolio Value, Market Value, Cost Basis, Unrealized P/L, Total Return %, Cash
- Pie chart: allocation by ticker (THB values)
- Line chart: performance history in THB (Oct 2024 → now)
- HoldingsTable at bottom

### Holdings (`/holdings`)
- Summary strip: Market Value / Cost / P/L / Return % / Positions count — **ทั้งหมดเป็น THB**
- Owned-stock list is the primary UI: logo, ticker, company, current price, quote age, unrealized P/L, and return percent are visible immediately
- Click a holding row to expand shares, avg cost, cost basis, market value, weight, sector, note, and full-detail link
- Stock logos use `src/utils/stockLogos.js` ticker-to-domain mapping with a free public logo endpoint; always keep initials fallback when logos fail

### HoldingsTable columns
Ticker | Company | Shares (4 dp) | Avg Cost (USD) | Price (USD) | Cost (THB) | Value (THB) | P/L (THB) | Return % | Weight % | Note

### StockDetail (`/holdings/:ticker`)
- Hero: ticker, company, sector, risk badge, current price, P/L %
- 8 metric cards (shares, avg cost, price, total cost, market value, P/L, return %, weight)
- Price history line chart (จาก transactions จนถึง current price) + dashed avg cost line
- DCA & Target Analysis card — 4 logic levels:
  - `plPercent >= 15%` → Momentum Hold
  - `plPercent >= 0%`  → Hold
  - `plPercent >= -15%` → Consider DCA
  - `plPercent < -15%`  → Evaluate Exit / DCA
- Position Size Risk card — progress bar + warning levels (ok/caution/warn/danger)
- Transaction history ของ ticker นั้น

### Transactions (`/transactions`)
- Form: BUY/SELL toggle, Ticker (auto-detect ชื่อบริษัท), Date, Quantity, Price, Fee, Note
- Order summary: แสดง USD + THB equivalent
- Validation: ตรวจ sell ไม่เกิน shares ที่มี
- History list: filter ALL/BUY/SELL + stats bar
- Phase 3 operations: Edit/Delete transaction; holdings/cash rebuild from transaction set


### Watchlist (`/watchlist`)
- Candidate list แยกจาก holdings ที่ถืออยู่จริง
- List-first watchlist inspired by mobile stock watchlists; full add/edit form is hidden behind the `+` button modal
- Add/Edit/Delete ticker candidates with optional manual current price, target price, target date, priority, thesis, and buy trigger
- Add/Save automatically refreshes current price through Stooq so ticker entry does not require manual price input
- Calculates upside from current price to target price and sorts candidates by highest upside
- Rows show market pill, ticker avatar, ticker/company, sparkline, current price, target, upside badge, quote age, and compact icon actions
- Refresh Prices uses the same Stooq quote provider path as holdings
- `targetSource` is stored for future provider/LLM-assisted target price suggestions; current target input is manual-first

### Analysis (`/analysis`)
- Health metric strip: unrealized P/L, realized P/L, total P/L, win rate, largest position, risk score
- Sector allocation pie chart + legend
- Stock concentration bar chart (สีตาม threshold: green < 15% / yellow 15–25% / orange 25–35% / red > 35%)
- Top Gainers / Top Losers lists
- Rebalance Planner: equal-weight/risk-aware target, trade value, share estimate
- DCA Simulator: configurable USD budget for losing positions

### Settings (`/settings`)
- Portfolio Snapshot strip
- Live Refresh — refresh market data, prices, FX, auto-refresh toggle
- Update Current Prices — manual override ราคาแต่ละ ticker (save ลง localStorage)
- FX Rate Cache — manual override USD/THB
- Cash Wallet — deposit/withdraw buying power and recent cash-flow history
- Backup & Restore — export/import PortfolioX JSON backup ผ่าน migration validation
- Danger Zone — Reset All Data (ต้อง confirm) → reload หน้า
- About info

---

## CSS Design System (`src/index.css`)

Dark theme — ตัวแปร CSS หลัก:
```css
--bg-primary:    #0d1117   /* page background */
--bg-secondary:  #161b22   /* sidebar */
--bg-card:       #1c2128   /* card background */
--bg-hover:      #262c36
--border:        #30363d
--text-primary:  #e6edf3
--text-secondary:#8b949e
--text-muted:    #6e7681
--accent:        #58a6ff   /* blue links / ticker */
--green:         #3fb950   /* profit */
--red:           #f85149   /* loss */
--yellow:        #d29922   /* warning / Medium risk */
--purple:        #bc8cff
--sidebar-width: 220px
```

Helper classes (global): `.profit` `.loss` `.neutral`

---

## Key Conventions

- **สกุลเงินหลัก = THB** ทุกหน้า — USD แสดงเป็น secondary label
- **Fractional shares** — shares เก็บเป็น float, แสดง 4 decimal places
- **Free dynamic market data** — Stooq quotes + fxapi.app FX; manual fallback ต้องยังใช้ได้เสมอ
- **Watchlist targets** — current price should auto-refresh from Stooq after Add/Save; manual current price is fallback only. Keep Watchlist list-first and put add/edit in a modal opened by the `+` button. Target price is manual-first today; keep `targetSource` so provider/LLM suggestions can be added later without changing storage shape
- **CSS Modules** ทุกไฟล์ — ไม่มี global class นอกจากใน `index.css`
- **ไม่ต้องสร้างไฟล์ใหม่** ถ้าแก้ไขได้ใน existing files
- **ไม่ต้องเพิ่ม comment** ใน code นอกจากจำเป็นมาก

## การอัปเดต FX Rate

ใช้ Settings → FX Rate Cache → Save FX สำหรับ manual override. ค่า `FX_RATE` ใน `src/data/mockData.js` เป็น seed/default fallback เท่านั้น.

## การเพิ่ม Holding ใหม่

เพิ่มใน `initialHoldings` array ใน `src/data/mockData.js` และเพิ่ม ticker ใน `KNOWN_TICKERS` ใน `src/pages/Transactions.jsx`.
จากนั้นพิจารณาเพิ่ม migration ใน `src/utils/storageMigration.js` และเปลี่ยน `DATA_VERSION` ถ้า schema เปลี่ยนจริง.

## ถ้า localStorage เก่าค้างอยู่

ไปที่ Settings → "Reset All Data". ถ้าเป็น schema change ให้เพิ่ม migration helper ก่อนเปลี่ยน `DATA_VERSION`.


## Phase Status

- Phase 1 complete: data foundation, migrations, provider abstraction.
- Phase 2 complete: free dynamic market data via Stooq + fxapi.app.
- Phase 3 complete: transaction edit/delete, holdings rebuild, cash recalculation, JSON backup/restore.
- Phase 4 complete: realized P/L, health metrics, rebalance planner, DCA simulator.
- Cash wallet update: Available Cash is wallet cash only; deposits add cash, withdrawals remove cash, new BUY consumes cash, SELL returns proceeds, and historical/seed transactions do not consume wallet deposits.
- UX Phase 1 complete: keep Cash Wallet, Stocks Market Value, and Total Portfolio Value visually and verbally separate across Dashboard, Settings, and Transactions.
- UX Phase 2 complete: Dashboard should lead with decision cards for price freshness, buying power, concentration, and best/worst performance before deeper charts/tables.
- UX Phase 3 complete: Settings uses section tabs for Wallet, Market Data, Backup, and Advanced; keep destructive actions isolated under Advanced.
- UX Phase 4 complete: Transactions should behave like a trade ticket with readiness status, Use Cash/Sell Max helpers, and blocking validation before submit.
- UX Phase 5 complete: HoldingsTable provides search, sortable metrics, sticky header, sticky ticker column, result count, and empty state.
- Holdings UX refresh complete: `/holdings` now uses a scannable expandable owned-stock list with current price, per-stock P/L, return percent, stock logos, and initials fallback.
- Performance fix complete: routes are lazy-loaded in `src/App.jsx`; preserve route-level code splitting so Recharts/chart-heavy pages stay out of the initial bundle.
- Watchlist and Target Price complete: `/watchlist` tracks candidate tickers, auto-refreshes current price after Add/Save, stores target prices, target date, thesis, trigger, priority, upside, and storage version `v8-watchlist`. UX now uses a list-first layout with plus-button modal add/edit and compact stock rows.

## Documentation Rule

หลังจบแต่ละ phase ต้องอัปเดต docs เสมอ:

- `README.md` — current status และ entrypoint
- `docs/PROJECT.md` — architecture/project explanation
- `docs/USAGE.md` — วิธีใช้งานและ troubleshooting
- `docs/PHASES.md` — phase log + verification
- `CLAUDE.md` — agent-facing context ถ้า architecture/conventions เปลี่ยน
