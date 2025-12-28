import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'threaded-dark-mode'

export interface UseDarkModeResult {
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export function useDarkMode(): UseDarkModeResult {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      return stored === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, [])

  return { isDarkMode, toggleDarkMode }
}
