import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { isValidPhone, normalizePhone, phoneToAuthEmail, supabase } from '../lib/supabase'
import { BrandLogo, LangSwitch, ScreenShell } from '../components/ui'

export default function Login() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const p = normalizePhone(phone)
    if (!isValidPhone(p)) {
      setError(locale === 'fr' ? 'Numéro invalide' : 'Invalid number')
      return
    }
    setBusy(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: phoneToAuthEmail(p),
      password,
    })
    setBusy(false)
    if (err) {
      setError(locale === 'fr' ? 'Numéro ou mot de passe incorrect' : 'Wrong number or password')
      return
    }
    // le staff atterrit sur le back-office
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    navigate(prof?.role === 'admin' || prof?.role === 'coach' ? '/admin' : '/dashboard')
  }

  return (
    <ScreenShell>
      <div className="flex items-center justify-between pt-5">
        <BrandLogo size="sm" />
        <LangSwitch />
      </div>
      <h1 className="mt-6 text-[22px] font-extrabold">{t('auth.login.title')}</h1>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3.5">
        <label className="field">
          <span>{t('auth.phone')}</span>
          <input
            className="input mono"
            type="tel"
            placeholder="+1 201 555 0123"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <p className="text-[12.5px] text-red font-semibold">{error}</p>}

        <button className="btn mt-1" disabled={busy}>
          {busy ? '…' : t('auth.login.submit')}
        </button>
        <Link to="/register" className="text-center text-[13px] text-green font-semibold no-underline">
          {t('auth.login.toRegister')}
        </Link>
      </form>
    </ScreenShell>
  )
}
