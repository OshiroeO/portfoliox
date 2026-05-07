import { useEffect, useRef, useState } from 'react'
import styles from './StatCard.module.css'

function useCountUp(rawValue) {
  const [display, setDisplay] = useState(rawValue)
  const prevRef = useRef(rawValue)
  const frameRef = useRef(null)

  useEffect(() => {
    const target = rawValue
    const prev = prevRef.current
    prevRef.current = rawValue

    const numericTarget = parseFloat(String(target).replace(/[^0-9.-]/g, ''))
    const numericPrev = parseFloat(String(prev).replace(/[^0-9.-]/g, ''))

    if (isNaN(numericTarget) || isNaN(numericPrev) || target === prev) {
      setDisplay(target)
      return
    }

    const prefix = String(target).match(/^[^0-9-]*/)?.[0] || ''
    const suffix = String(target).match(/[^0-9.]+$/)?.[0] || ''
    const duration = 600
    const start = performance.now()

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = numericPrev + (numericTarget - numericPrev) * eased
      const formatted = String(target).replace(
        String(Math.abs(numericTarget)).replace(/\./g, '\\.'),
        Math.abs(current).toLocaleString('en', { maximumFractionDigits: 2 })
      )
      setDisplay(prefix + formatted + suffix)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else setDisplay(target)
    }

    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [rawValue])

  return display
}

export default function StatCard({ label, value, sub, subClass }) {
  const animated = useCountUp(value)
  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{animated}</p>
      {sub && <p className={`${styles.sub} ${subClass || ''}`}>{sub}</p>}
    </div>
  )
}
