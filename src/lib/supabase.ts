import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anon)

export const supabase = createClient(
  url ?? 'https://demo.invalid.supabase.co',
  anon ?? 'demo-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
)

/** Le téléphone est l'identifiant principal : on dérive un email technique pour Supabase Auth. */
export function phoneToAuthEmail(phone: string): string {
  return `phone_${normalizePhone(phone).replace('+', '')}@ijambo.app`
}

export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.-]/g, '')
  if (p.startsWith('00257')) p = '+257' + p.slice(5)
  if (/^0?7\d{7}$/.test(p)) p = '+257' + p.replace(/^0/, '')
  if (/^257\d{8}$/.test(p)) p = '+' + p
  return p
}

export function isValidBurundiPhone(p: string): boolean {
  return /^\+257\d{8}$/.test(normalizePhone(p))
}

export function isValidPhone(p: string): boolean {
  // Accepte n'importe quel numéro international : +1..., +250..., +243..., +224..., etc.
  const normalized = normalizePhone(p)
  return /^\+\d{7,15}$/.test(normalized) // +code pays + 7-15 chiffres
}
