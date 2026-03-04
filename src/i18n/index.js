import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import vi from '../locales/vi.json'

export const LANGUAGE_STORAGE_KEY = 'hub-lang'

const FALLBACK_LANGUAGE = 'en'
const SUPPORTED_LANGUAGES = ['en', 'vi']

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return FALLBACK_LANGUAGE
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored
    }

    const browserLang = window.navigator?.language?.split('-')[0]
    if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) {
      return browserLang
    }
  } catch {
    // Ignore storage / navigator errors and fall back to default
  }

  return FALLBACK_LANGUAGE
}

const initialLanguage = getInitialLanguage()

i18n
  .use(initReactI18next)
  .init({
    lng: initialLanguage,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    resources: {
      en: { translation: en },
      vi: { translation: vi }
    },
    interpolation: {
      escapeValue: false
    }
  })

// Keep <html lang="..."> and localStorage in sync with the active language
const applyDocumentLanguage = (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng === 'vi' ? 'vi' : 'en'
  }
}

applyDocumentLanguage(initialLanguage)

i18n.on('languageChanged', (lng) => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
    }
  } catch {
    // Ignore storage errors
  }
  applyDocumentLanguage(lng)
})

export default i18n

