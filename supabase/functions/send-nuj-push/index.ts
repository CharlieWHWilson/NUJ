import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignJWT } from 'npm:jose@5'

// Expected secrets (configure in Dashboard > Edge Functions > Secrets)
// APNS_TEAM_ID (string)
// APNS_KEY_ID (string)
// APNS_PRIVATE_KEY (string) - full contents of your .p8 (between BEGIN/END)
// APNS_TOPIC (string) - e.g. 'social.nuj.app'
// APNS_ENV (string) - 'development' or 'production'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS')
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!SUPABASE_SECRET_KEYS_RAW) throw new Error('Missing SUPABASE_SECRET_KEYS')

const SUPABASE_SECRET_KEYS = JSON.parse(SUPABASE_SECRET_KEYS_RAW)
const ADMIN_KEY = SUPABASE_SECRET_KEYS['default']
if (!ADMIN_KEY) throw new Error('Missing SUPABASE_SECRET_KEYS["default"]')

const apnsTeamId = Deno.env.get('APNS_TEAM_ID')
const apnsKeyId = Deno.env.get('APNS_KEY_ID')
const apnsPrivateKey = Deno.env.get('APNS_PRIVATE_KEY')
const apnsTopic = Deno.env.get('APNS_TOPIC')
const apnsEnv = Deno.env.get('APNS_ENV')

if (!apnsTeamId) throw new Error('Missing APNS_TEAM_ID')
if (!apnsKeyId) throw new Error('Missing APNS_KEY_ID')
if (!apnsPrivateKey) throw new Error('Missing APNS_PRIVATE_KEY')
if (!apnsTopic) throw new Error('Missing APNS_TOPIC')
if (!apnsEnv) throw new Error('Missing APNS_ENV')

const APNS_HOST = apnsEnv === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
const APNS_AUDIENCE = 'https://api.push.apple.com'

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders,
    },
  })
}

function buildApnsPrivateKey(p8: string) {
  // Accept either full PEM (with BEGIN/END), escaped newlines, or raw base64 body.
  const normalized = p8.replace(/\\n/g, '\n').trim()
  const trimmed = normalized
  if (trimmed.includes('BEGIN PRIVATE KEY')) return trimmed
  return `-----BEGIN PRIVATE KEY-----\n${trimmed}\n-----END PRIVATE KEY-----\n`
}

async function getApnsJwt() {
  // APNs auth uses a short-lived token (max 60 minutes; typical 20-30 min).
  const pem = buildApnsPrivateKey(apnsPrivateKey)

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 25 * 60

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: apnsKeyId })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setAudience(APNS_AUDIENCE)
    .setIssuer(apnsTeamId)
    .sign(pem)

  return token
}

const supabaseAdmin = createClient(SUPABASE_URL, ADMIN_KEY)

interface PushRequestBody {
  recipientUserId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

type ApnsSendResult = {
  token: string
  success: boolean
  removed?: boolean
  apnsReason?: string
}

function apnsErrorToRemoved(reason: string | undefined) {
  // Reason codes indicating token is no longer valid.
  if (!reason) return false
  return [
    'BadDeviceToken',
    'Unregistered',
    'DeviceTokenNotForTopic',
    'InvalidProviderToken',
    'TopicDisallowed',
  ].includes(reason)
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'MethodNotAllowed' }, 405)
    }

    let payload: PushRequestBody
    try {
      payload = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'InvalidJSON' }, 400)
    }

    const { recipientUserId, title, body, data } = payload ?? {}
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return jsonResponse({ success: false, error: 'recipientUserId is required' }, 400)
    }
    if (!title || typeof title !== 'string') {
      return jsonResponse({ success: false, error: 'title is required' }, 400)
    }
    if (!body || typeof body !== 'string') {
      return jsonResponse({ success: false, error: 'body is required' }, 400)
    }

    const { data: tokensRows, error } = await supabaseAdmin
      .from('push_tokens')
      .select('id, token, platform')
      .eq('user_id', recipientUserId)
      .eq('platform', 'ios')

    if (error) {
      return jsonResponse({ success: false, error: 'DBError', details: error.message }, 500)
    }

    const tokens = (tokensRows ?? [])
    if (tokens.length === 0) {
      return jsonResponse({ success: true, sent: 0, failed: 0, removedInvalidTokens: 0 })
    }

    let apnsJwt: string
    try {
      apnsJwt = await getApnsJwt()
    } catch (err) {
      const details = err instanceof Error ? err.message : 'Unknown APNs JWT error'
      console.error('APNs JWT generation failed', details)
      return jsonResponse({ success: false, error: 'APNSAuthError', details }, 500)
    }

    // APNs endpoint expects a single token per request.
    // We keep it simple + reliable; you can batch later if needed.
    let sent = 0
    let failed = 0
    let removedInvalidTokens = 0

    const removedIds: string[] = []

    for (const row of tokens) {
      const deviceToken = row.token
      if (!deviceToken) continue

      const apnsBody = {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
        },
        ...(data ? { data } : {}),
      }

      const url = `https://${APNS_HOST}/3/device/${deviceToken}`

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apnsJwt}`,
          'apns-topic': apnsTopic,
          'content-type': 'application/json',
        },
        body: JSON.stringify(apnsBody),
      })

      if (res.ok) {
        sent += 1
        continue
      }

      // Attempt to parse APNs error.
      let reason: string | undefined
      try {
        const errJson = await res.json()
        reason = errJson?.reason
      } catch {
        // ignore
      }

      const shouldRemove = apnsErrorToRemoved(reason)
      if (shouldRemove) {
        removedIds.push(row.id)
        removedInvalidTokens += 1
      }
      failed += 1
    }

    if (removedIds.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('push_tokens')
        .delete()
        .in('id', removedIds)

      // If cleanup fails, still return success so caller can proceed.
      if (delErr) {
        console.warn('Failed removing invalid tokens', delErr.message)
      }
    }

    return jsonResponse({
      success: true,
      sent,
      failed,
      removedInvalidTokens,
    })
  } catch (err) {
    const details = err instanceof Error ? err.message : 'Unhandled send-nuj-push error'
    console.error('Unhandled send-nuj-push error', details)
    return jsonResponse({ success: false, error: 'InternalError', details }, 500)
  }
})
