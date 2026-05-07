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
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/holdings', label: 'Holdings', icon: Briefcase },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/watchlist', label: 'Watchlist', icon: Target },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const mobileNavItems = navItems.slice(0, 5)

export default function Sidebar() {
  const navigate = useNavigate()

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
            <span>Sign Out</span>
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
