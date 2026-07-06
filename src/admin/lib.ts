import { supabase } from '../lib/supabase'

/** Journal d'audit des actions admin (§6.6). */
export async function logAction(action: string, entity: string, entityId?: string, payload?: unknown) {
  const { data } = await supabase.auth.getUser()
  await supabase.from('audit_log').insert({
    actor_id: data.user?.id ?? null,
    action,
    entity,
    entity_id: entityId ?? null,
    payload: payload ?? null,
  })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtBif(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('fr-FR')} BIF`
}

/** Export CSV générique (annexe A / §6.2). */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n')
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      cur.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      cur.push(field)
      field = ''
      if (cur.some((f) => f !== '')) rows.push(cur)
      cur = []
    } else field += c
  }
  cur.push(field)
  if (cur.some((f) => f !== '')) rows.push(cur)
  const [header, ...body] = rows
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])))
}

export function download(filename: string, content: string, mime = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export const SECTIONS = ['grammar', 'reading', 'listening', 'writing', 'speaking'] as const
export const QUESTION_TYPES = ['qcm', 'qcm_multiple', 'gap_fill', 'ordering', 'audio_qcm'] as const
export const STATUSES = ['draft', 'published', 'archived'] as const
