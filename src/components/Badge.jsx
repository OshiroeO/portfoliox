import styles from './Badge.module.css'

const colorMap = {
  High: 'red',
  Medium: 'yellow',
  Low: 'green',
  BUY: 'green',
  SELL: 'red',
}

export default function Badge({ label, variant }) {
  const color = variant || colorMap[label] || 'default'
  return <span className={`${styles.badge} ${styles[color]}`}>{label}</span>
}
