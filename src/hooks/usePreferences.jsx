/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import { useTheme } from './useTheme'
import { useLanguage } from './useLanguage'

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const theme = useTheme()
  const language = useLanguage()
  return (
    <PreferencesContext.Provider value={{ ...theme, ...language }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  return useContext(PreferencesContext)
}
