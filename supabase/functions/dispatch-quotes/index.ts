// dispatch-quotes: sends due daily quotes to every registered device through FCM (HTTP v1),
// then deletes photo cards 24 hours after they were sent.
//
// Invoked every minute by pg_cron (only when something is due) and by the admin screen for
// "Send now". It takes no input and only ever acts on rows that are already due or expired,
// so it is safe to deploy with verify_jwt = false.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'quote-cards'
const CHANNEL_ID = 'tally-quote'
const SMALL_ICON = 'ic_stat_tally'
const ACCENT = '#D94F2D'
const HOUR = 3_600_000
const LATE_LIMIT_MS = 12 * HOUR // a quote more than 12h overdue is marked failed, not sent at a silly time
const CARD_TTL_MS = 24 * HOUR
const ORPHAN_AGE_MS = 48 * HOUR
const STUCK_MS = 10 * 60_000
const BATCH = 25

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

interface QuoteRow {
  id: string
  quote: string
  author: string
  card_path: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing')
  let sa: ServiceAccount
  try {
    sa = JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON')
  }
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is incomplete')
  }
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n')
  return sa
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))
  const unsigned =
    enc({ alg: 'RS256', typ: 'JWT' }) +
    '.' +
    enc({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(new Uint8Array(sig))}`,
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Google auth failed: ${data.error_description ?? data.error ?? res.status}`)
  }
  return data.access_token as string
}

type SendResult = 'ok' | 'dead' | 'error'

async function sendOne(
  projectId: string,
  accessToken: string,
  token: string,
  q: QuoteRow,
  imageUrl: string | null,
): Promise<SendResult> {
  const quoteText = q.quote.length > 220 ? q.quote.slice(0, 217).trimEnd() + '...' : q.quote
  const message = {
    token,
    notification: {
      title: 'Quote of the day',
      body: `\u201C${quoteText}\u201D \u2014 ${q.author}`,
      ...(imageUrl ? { image: imageUrl } : {}),
    },
    data: { type: 'quote', quoteId: q.id, path: '/quote' },
    android: {
      priority: 'HIGH',
      ttl: '86400s',
      notification: { channel_id: CHANNEL_ID, icon: SMALL_ICON, color: ACCENT },
    },
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        },
      )
      if (res.ok) return 'ok'
      const body = await res.text()
      // Only remove a device token when FCM says the token itself is no longer valid.
      if (
        res.status === 404 ||
        body.includes('UNREGISTERED') ||
        body.includes('SENDER_ID_MISMATCH') ||
        (res.status === 400 && body.includes('registration token'))
      ) {
        return 'dead'
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      console.error('FCM error', res.status, body.slice(0, 300))
      return 'error'
    } catch (e) {
      console.error('FCM request failed', String(e))
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  return 'error'
}

async function loadTokens(): Promise<string[]> {
  const tokens: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('push_tokens')
      .select('token')
      .order('token')
      .range(from, from + 999)
    if (error) throw new Error(`push_tokens: ${error.message}`)
    tokens.push(...(data ?? []).map((r) => r.token as string))
    if (!data || data.length < 1000) break
  }
  return tokens
}

async function deliver(q: QuoteRow, tokens: string[], sa: ServiceAccount, accessToken: string) {
  const imageUrl = q.card_path
    ? db.storage.from(BUCKET).getPublicUrl(q.card_path).data.publicUrl
    : null
  let ok = 0
  const dead: string[] = []
  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH)
    const results = await Promise.all(
      chunk.map((t) => sendOne(sa.project_id, accessToken, t, q, imageUrl)),
    )
    results.forEach((r, idx) => {
      if (r === 'ok') ok++
      else if (r === 'dead') dead.push(chunk[idx])
    })
  }
  if (dead.length > 0) await db.from('push_tokens').delete().in('token', dead)
  return { ok, removedTokens: dead.length }
}

async function removeCards(rows: { id: string; card_path: string | null }[]) {
  const paths = rows.map((r) => r.card_path).filter((p): p is string => !!p)
  if (paths.length === 0) return 0
  const { error } = await db.storage.from(BUCKET).remove(paths)
  if (error) {
    console.error('card removal failed', error.message)
    return 0
  }
  await db
    .from('daily_quotes')
    .update({ card_path: null })
    .in('id', rows.map((r) => r.id))
  return paths.length
}

async function cleanup() {
  const now = Date.now()
  const cutoff = new Date(now - CARD_TTL_MS).toISOString()
  let removed = 0

  const { data: sentOld } = await db
    .from('daily_quotes')
    .select('id, card_path')
    .eq('status', 'sent')
    .not('card_path', 'is', null)
    .lt('sent_at', cutoff)
    .limit(200)
  removed += await removeCards(sentOld ?? [])

  const { data: failedOld } = await db
    .from('daily_quotes')
    .select('id, card_path')
    .eq('status', 'failed')
    .not('card_path', 'is', null)
    .lt('created_at', cutoff)
    .limit(200)
  removed += await removeCards(failedOld ?? [])

  // Orphans: files that no row points to any more (e.g. a draft that was never saved).
  const { data: files } = await db.storage.from(BUCKET).list('', { limit: 1000 })
  if (files && files.length > 0) {
    const { data: refs } = await db
      .from('daily_quotes')
      .select('card_path')
      .not('card_path', 'is', null)
    const used = new Set((refs ?? []).map((r) => r.card_path as string))
    const orphans = files
      .filter(
        (f) =>
          f.name &&
          !used.has(f.name) &&
          f.created_at &&
          now - new Date(f.created_at).getTime() > ORPHAN_AGE_MS,
      )
      .map((f) => f.name)
    if (orphans.length > 0) {
      const { error } = await db.storage.from(BUCKET).remove(orphans)
      if (!error) removed += orphans.length
    }
  }
  return removed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const report: Record<string, unknown> = { sent: [], failed: [], cardsDeleted: 0 }
  try {
    const now = Date.now()
    const nowIso = new Date(now).toISOString()

    // Housekeeping: a run that died mid-send, and quotes that are far too late to send.
    await db
      .from('daily_quotes')
      .update({ status: 'failed' })
      .eq('status', 'sending')
      .lt('claimed_at', new Date(now - STUCK_MS).toISOString())
    await db
      .from('daily_quotes')
      .update({ status: 'failed' })
      .eq('status', 'scheduled')
      .lt('scheduled_at', new Date(now - LATE_LIMIT_MS).toISOString())

    // Claim due quotes. The status filter makes this atomic: two overlapping runs cannot both win a row.
    const { data: claimed, error: claimErr } = await db
      .from('daily_quotes')
      .update({ status: 'sending', claimed_at: nowIso })
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .select('id, quote, author, card_path, scheduled_at')
    if (claimErr) throw new Error(`claim: ${claimErr.message}`)
    // PostgREST cannot order an UPDATE ... RETURNING, so oldest-first is done here.
    claimed?.sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))

    if (claimed && claimed.length > 0) {
      let sa: ServiceAccount
      let accessToken: string
      let tokens: string[]
      try {
        sa = loadServiceAccount()
        accessToken = await getAccessToken(sa)
        tokens = await loadTokens()
      } catch (e) {
        await db
          .from('daily_quotes')
          .update({ status: 'failed' })
          .in('id', claimed.map((c) => c.id))
        throw e
      }
      for (const q of claimed as QuoteRow[]) {
        try {
          const r = await deliver(q, tokens, sa, accessToken)
          await db
            .from('daily_quotes')
            .update({ status: 'sent', sent_at: new Date().toISOString(), recipients: r.ok })
            .eq('id', q.id)
          ;(report.sent as unknown[]).push({ id: q.id, ...r, devices: tokens.length })
        } catch (e) {
          await db.from('daily_quotes').update({ status: 'failed' }).eq('id', q.id)
          ;(report.failed as unknown[]).push({ id: q.id, error: String(e) })
        }
      }
    }

    report.cardsDeleted = await cleanup()
    return json(report)
  } catch (e) {
    console.error('dispatch-quotes failed', String(e))
    return json({ ...report, error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
