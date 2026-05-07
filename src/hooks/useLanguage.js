import { useEffect, useState } from 'react'
import { en, th } from '../lib/i18n'

export function useLanguage() {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  function toggleLanguage() {
    setLang(l => l === 'en' ? 'th' : 'en')
  }

  return { lang, t: lang === 'th' ? th : en, toggleLanguage }
}
