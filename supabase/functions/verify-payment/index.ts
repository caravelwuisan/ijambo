// Edge Function : POST /verify-payment — appelée exclusivement par n8n (§9).
// Auth : header `x-webhook-secret` comparé au secret partagé (à définir :
//   supabase secrets set VERIFY_PAYMENT_SECRET=...)
// Corps attendu (parsing SMS fait côté n8n) :
//   { amount_bif: number, payer_phone?: string, operator_ref?: string,
//     motif?: string, sms_raw: string }
// Réponse : { matched: boolean, status: 'verified'|'manual_review', payment_id? }

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = Deno.env.get('VERIFY_PAYMENT_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service_role : jamais côté client
  )

  let body: {
    amount_bif?: number
    payer_phone?: string
    operator_ref?: string
    motif?: string
    sms_raw?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const amount = Number(body.amount_bif)
  const smsRaw = body.sms_raw ?? ''
  if (!amount || !smsRaw) {
    return Response.json({ error: 'amount_bif et sms_raw requis' }, { status: 400 })
  }

  const log = async (action: string, entityId: string | null, payload: unknown) => {
    await supabase.from('audit_log').insert({
      actor_id: null,
      action,
      entity: 'payments',
      entity_id: entityId,
      payload,
    })
  }

  // 1) Correspondance par code de référence à 6 caractères dans le motif ou le SMS brut
  const refMatch = `${body.motif ?? ''} ${smsRaw}`
    .toUpperCase()
    .match(/\b[A-HJ-NP-Z2-9]{6}\b/g)

  if (refMatch) {
    for (const ref of refMatch) {
      const { data: byRef } = await supabase
        .from('payments')
        .select('id, amount_bif, status')
        .eq('reference', ref)
        .eq('status', 'pending')
        .maybeSingle()
      if (byRef && byRef.amount_bif === amount) {
        await supabase
          .from('payments')
          .update({ status: 'verified', sms_raw: smsRaw })
          .eq('id', byRef.id)
        await log('webhook_payment_verified_by_ref', byRef.id, { ref, amount })
        return Response.json({ matched: true, status: 'verified', payment_id: byRef.id })
      }
    }
  }

  // 2) Repli : montant exact + fenêtre 30 min + correspondance UNIQUE
  const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: candidates } = await supabase
    .from('payments')
    .select('id')
    .eq('status', 'pending')
    .eq('amount_bif', amount)
    .gte('created_at', windowStart)

  if (candidates && candidates.length === 1) {
    const id = candidates[0].id
    await supabase.from('payments').update({ status: 'verified', sms_raw: smsRaw }).eq('id', id)
    await log('webhook_payment_verified_by_amount', id, { amount })
    return Response.json({ matched: true, status: 'verified', payment_id: id })
  }

  // 3) Ambiguïté ou absence → manual_review sur tous les candidats de la fenêtre,
  //    SMS brut conservé pour l'admin (§9.3)
  if (candidates && candidates.length > 1) {
    for (const c of candidates) {
      await supabase
        .from('payments')
        .update({ status: 'manual_review', sms_raw: smsRaw })
        .eq('id', c.id)
    }
    await log('webhook_payment_ambiguous', null, { amount, count: candidates.length, sms_raw: smsRaw })
    return Response.json({ matched: false, status: 'manual_review', candidates: candidates.length })
  }

  await log('webhook_payment_unmatched', null, { amount, sms_raw: smsRaw })
  return Response.json({ matched: false, status: 'manual_review' })
})
