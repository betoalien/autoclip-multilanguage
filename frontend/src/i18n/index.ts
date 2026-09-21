import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import zh from './locales/zh.json'
import en from './locales/en.json'
import es from './locales/es.json'

export const LANGUAGE_STORAGE_KEY = 'autoclip-language'

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code']

export function getBrowserLanguage(): SupportedLanguage {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language.toLowerCase()
    if (nav.startsWith('es')) return 'es'
    if (nav.startsWith('en')) return 'en'
    if (nav.startsWith('zh')) return 'zh'
  }
  return 'es'
}

export function normalizeLanguage(lang?: string | null): SupportedLanguage {
  if (!lang) return getBrowserLanguage()
  const clean = lang.toLowerCase().trim()
  if (clean.startsWith('es')) return 'es'
  if (clean.startsWith('en')) return 'en'
  if (clean.startsWith('zh')) return 'zh'
  return getBrowserLanguage()
}

export function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'es'
  try {
    localStorage.removeItem('i18nextLng')
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    const browserLang = getBrowserLanguage()

    // If previous saved was Chinese or starts with zh, but browser is not Chinese,
    // default to browserLang (or Spanish) to avoid stuck legacy defaults
    if (saved && saved.toLowerCase().startsWith('zh') && !browserLang.startsWith('zh')) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, browserLang)
      return browserLang
    }

    if (saved) {
      const norm = normalizeLanguage(saved)
      localStorage.setItem(LANGUAGE_STORAGE_KEY, norm)
      return norm
    }

    localStorage.setItem(LANGUAGE_STORAGE_KEY, browserLang)
    return browserLang
  } catch {
    return 'es'
  }
}

const initialLang = getInitialLanguage()

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: initialLang,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'zh'],
    interpolation: {
      escapeValue: false,
    },
  })

if (typeof window !== 'undefined' && i18n.language !== initialLang) {
  i18n.changeLanguage(initialLang)
}

export default i18n


