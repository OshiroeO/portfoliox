import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Target,
  TrendingUp,
  LogOut,
} from 'lucide-react'
import { signOut } from '../lib/supabase'
import { usePreferences } from '../hooks/usePreferences'
import styles from './Sidebar.module.css'

const navKeys = [
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/holdings', key: 'holdings', icon: Briefcase },
  { to: '/transactions', key: 'transactions', icon: ArrowLeftRight },
  { to: '/watchlist', key: 'watchlist', icon: Target },
  { to: '/analysis', key: 'analysis', icon: BarChart3 },
  { to: '/settings', key: 'settings', icon: Settings },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { t } = usePreferences()
  const navItems = navKeys.map(item => ({ ...item, label: t.nav[item.key] }))
  const mobileNavItems = navItems.slice(0, 5)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <TrendingUp size={20} color="var(--accent)" />
          <span>PortfolioX</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.footer}>
          <button className={styles.signOutBtn} onClick={handleSignOut}>
            <LogOut size={15} />
            <span>{t.nav.signOut}</span>
          </button>
          <p className={styles.version}>v1.0.0</p>
        </div>
      </aside>

      <nav className={styles.bottomNav}>
        {mobileNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.bottomNavItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
