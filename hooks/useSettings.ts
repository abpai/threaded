import { useState, useEffect, useCallback } from 'react'
import { AppSettings } from '../types'
import { DEFAULT_MODEL_ID } from '../lib/defaultModels'

const STORAGE_KEY = 'threaded-settings'

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'google',
  apiKey: '',
  modelId: DEFAULT_MODEL_ID.google,
}

export interface UseSettingsResult {
  settings: AppSettings
  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  saveSettings: (newSettings: AppSettings) => void
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setSettings(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse settings', e)
      }
    }
  }, [])

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const saveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  }, [])

  return {
    settings,
    isSettingsOpen,
    openSettings,
    closeSettings,
    saveSettings,
  }
}
