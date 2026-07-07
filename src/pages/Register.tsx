import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { isValidPhone, normalizePhone, phoneToAuthEmail, supabase } from '../lib/supabase'
import { BrandLogo, LangSwitch, ScreenShell } from '../components/ui'

export default function Register() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    email: '',
    goal: 'usa',
    target_exam_date: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const phone = normalizePhone(form.phone)
    if (!isValidPhone(phone)) {
      setError(locale === 'fr' ? 'Numéro invalide — format attendu : +XXX XXXXXXXXX (ex: +1 201 555 0123)' : 'Invalid number — expected format: +XXX XXXXXXXXX (e.g., +1 201 555 0123)')
      return
    }
    if (form.password.length < 6) {
      setError(locale === 'fr' ? 'Mot de passe : 6 caractères minimum' : 'Password: at least 6 characters')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.signUp({
      email: phoneToAuthEmail(phone),
      password: form.password,
      options: {
        data: {
          phone,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          real_email: form.email.trim(),
          goal: form.goal,
          target_exam_date: form.target_exam_date || null,
          locale,
        },
      },
    })
    setBusy(false)
    if (err) {
      setError(
        err.message.includes('already registered')
          ? locale === 'fr'
            ? 'Ce numéro a déjà un compte — connectez-vous.'
            : 'This number already has an account — log in.'
          : err.message,
      )
      return
    }
    navigate('/diagnostic')
  }

  return (
    <ScreenShell>
      <div className="flex items-center justify-between pt-5">
        <BrandLogo size="sm" />
        <LangSwitch />
      </div>
      <h1 className="mt-6 text-[22px] font-extrabold leading-tight">{t('auth.register.title')}</h1>
      <p className="mt-1.5 text-[13px] text-muted">{t('auth.register.sub')}</p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3.5">
        <div className="flex gap-3">
          <label className="field flex-1">
            <span>{t('auth.firstname')}</span>
            <input className="input" required value={form.first_name} onChange={set('first_name')} />
          </label>
          <label className="field flex-1">
            <span>{t('auth.lastname')}</span>
            <input className="input" required value={form.last_name} onChange={set('last_name')} />
          </label>
        </div>
        <label className="field">
          <span>{t('auth.phone')}</span>
          <input
            className="input mono"
            type="tel"
            placeholder="+1 201 555 0123"
            required
            value={form.phone}
            onChange={set('phone')}
          />
          <span className="!text-[11px] !font-normal !text-muted !mt-1">{t('auth.phone.help')}</span>
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input className="input" type="password" required minLength={6} value={form.password} onChange={set('password')} />
        </label>
        <label className="field">
          <span>{t('auth.email')}</span>
          <input className="input" type="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>{t('auth.goal')}</span>
          <select className="input" value={form.goal} onChange={set('goal')}>
            <option value="usa">{t('auth.goal.usa')}</option>
            <option value="china">{t('auth.goal.china')}</option>
            <option value="regional">{t('auth.goal.regional')}</option>
            <option value="other">{t('auth.goal.other')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('auth.examdate')}</span>
          <input className="input" type="date" value={form.target_exam_date} onChange={set('target_exam_date')} />
        </label>

        {error && <p className="text-[12.5px] text-red font-semibold">{error}</p>}

        <button className="btn mt-1" disabled={busy}>
          {busy ? '…' : t('auth.register.submit')}
        </button>
        <Link to="/login" className="text-center text-[13px] text-green font-semibold no-underline">
          {t('auth.register.toLogin')}
        </Link>
      </form>
    </ScreenShell>
  )
}
