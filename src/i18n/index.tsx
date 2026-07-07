import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import fr from './fr.json'
import en from './en.json'

export type Locale = 'fr' | 'en'
const dicts: Record<Locale, Record<string, string>> = { fr, en }

type I18nCtx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18nCtx>({ locale: 'fr', setLocale: () => {}, t: (k) => k })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('ijambo.locale')
    return saved === 'en' ? 'en' : 'fr'
  })
  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('ijambo.locale', l)
    setLocaleState(l)
  }, [])
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // repli sur FR si la clé EN est absente
      let s = dicts[locale][key] ?? dicts.fr[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    },
    [locale],
  )
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)

/** Champ bilingue BDD : repli sur FR si EN absent */
export function pickLang<T extends { [k: string]: any }>(row: T, base: string, locale: Locale): string {
  return (locale === 'en' && row[`${base}_en`]) || row[`${base}_fr`] || row[`${base}_en`] || ''
}
