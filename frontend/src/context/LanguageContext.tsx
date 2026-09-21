import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import i18n, { LANGUAGE_STORAGE_KEY, SupportedLanguage, normalizeLanguage, getInitialLanguage } from '../i18n'

interface LanguageContextValue {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const DAYJS_LOCALE_MAP: Record<SupportedLanguage, string> = {
  zh: 'zh-cn',
  en: 'en',
  es: 'es',
}

function applyLanguageSideEffects(language: SupportedLanguage) {
  dayjs.locale(DAYJS_LOCALE_MAP[language] || 'es')
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language || 'es'
  }
}

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    return normalizeLanguage(i18n.language || getInitialLanguage())
  })

  useEffect(() => {
    applyLanguageSideEffects(language)
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language])

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const normalized = normalizeLanguage(lng)
      setLanguageState(normalized)
      applyLanguageSideEffects(normalized)
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [])

  const setLanguage = (next: SupportedLanguage) => {
    const valid = normalizeLanguage(next)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, valid)
      localStorage.setItem('i18nextLng', valid)
    } catch {
      // ignore storage errors
    }
    i18n.changeLanguage(valid)
    setLanguageState(valid)
    applyLanguageSideEffects(valid)
  }

  const value = useMemo(() => ({ language, setLanguage }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
