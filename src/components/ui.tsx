import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useState, useEffect } from 'react'

/** Silhouette de collines — signature graphique de la maquette */
export function Hills({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute bottom-0 left-0 right-0 pointer-events-none ${className}`}
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      width="100%"
      height="90"
    >
      <path
        d="M0,90 C180,30 320,110 520,70 C700,35 850,105 1040,65 C1220,30 1330,95 1440,60 L1440,120 L0,120 Z"
        fill="#1E7A46"
        opacity="0.35"
      />
      <path
        d="M0,110 C220,60 420,118 640,88 C860,58 1060,116 1440,84 L1440,120 L0,120 Z"
        fill="#F4F6F2"
      />
    </svg>
  )
}

export function BrandLogo({ size = 'md', to = '/' }: { size?: 'sm' | 'md'; to?: string }) {
  const dot = size === 'sm' ? 'w-7 h-7 text-xs rounded-lg' : 'w-10 h-10 text-lg rounded-xl'
  const name = size === 'sm' ? 'text-sm' : 'text-base'
  return (
    <Link to={to} className="flex items-center gap-2.5 no-underline text-ink">
      <div className={`${dot} bg-green text-white flex items-center justify-center font-extrabold`}>IJ</div>
      <span className={`${name} font-extrabold tracking-wide`}>
        IJAMBO <span className="text-gold">English</span>
      </span>
    </Link>
  )
}

export function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useI18n()
  return (
    <button
      onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
      className={`pill cursor-pointer border-0 font-sans ${dark ? '!bg-white/10 !text-paper' : ''}`}
      aria-label="Changer de langue / Switch language"
    >
      {locale === 'fr' ? 'FR → EN' : 'EN → FR'}
    </button>
  )
}

export function OfflineBanner() {
  const { t } = useI18n()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div className="bg-gold-soft text-gold-ink text-xs font-semibold text-center px-4 py-2">
      {t('common.offline')}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 rounded-full border-[3px] border-line border-t-green animate-spin" />
    </div>
  )
}

export function StatCard({ n, label }: { n: string; label: string }) {
  return (
    <div className="card flex-1 text-center !p-3">
      <div className="mono text-xl text-green font-medium">{n}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
    </div>
  )
}

export function ScreenShell({ children, max = 'max-w-md' }: { children: React.ReactNode; max?: string }) {
  return (
    <div className="min-h-dvh bg-paper">
      <OfflineBanner />
      <div className={`${max} mx-auto px-4 pb-10`}>{children}</div>
    </div>
  )
}
