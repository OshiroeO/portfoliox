import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import styles from './App.module.css'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Holdings = lazy(() => import('./pages/Holdings'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const Analysis = lazy(() => import('./pages/Analysis'))
const Settings = lazy(() => import('./pages/Settings'))
const StockDetail = lazy(() => import('./pages/StockDetail'))

function PageLoader() {
  return (
    <div className={styles.pageLoader}>
      <span /><span /><span />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="holdings" element={<Holdings />} />
              <Route path="holdings/:ticker" element={<StockDetail />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="watchlist" element={<Watchlist />} />
              <Route path="analysis" element={<Analysis />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
