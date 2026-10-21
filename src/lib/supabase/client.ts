import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const isMisconfigured = !url || !key;

if (isMisconfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  );

  // createClient() throws synchronously on an empty/invalid URL, which
  // crashes the whole app before React ever renders anything — a silent
  // blank white screen with no clue why. That's exactly what happened when
  // .env didn't make it into a CI build. Showing a real, visible message
  // here instead means a future misconfiguration is loud and diagnosable
  // instead of invisible.
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'padding:24px;background:#fff;color:#111;font-family:system-ui,sans-serif;text-align:center;';
    banner.innerHTML =
      '<div style="max-width:420px"><h1 style="font-size:18px;margin-bottom:8px;">Configuration error</h1>' +
      '<p style="font-size:14px;color:#555;">Tally can\u2019t reach its database: the Supabase URL/key are ' +
      'missing from this build. If you just deployed this, make sure a valid .env file was present at ' +
      'build time.</p></div>';
    document.body.appendChild(banner);
  });
}

const resolvedUrl = isMisconfigured ? 'https://placeholder.supabase.co' : (url as string);

/**
 * Single Supabase client for the whole app. Auth session is persisted to
 * localStorage by the SDK itself (just the session token, not app data) so
 * the user stays logged in between visits/app launches.
 *
 * A syntactically-valid placeholder URL is used when misconfigured so
 * createClient() itself never throws — the banner above is the actual
 * signal to the person looking at the screen; every real request against
 * this placeholder client will simply fail, which is fine since nothing
 * useful could have happened anyway without real credentials.
 */
export const supabase = createClient(resolvedUrl, isMisconfigured ? 'placeholder-anon-key' : (key as string), {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/** The localStorage key the SDK saves the session under: `sb-<project ref>-auth-token`. */
function savedSessionKey(): string | null {
  try {
    return `sb-${new URL(resolvedUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Reads the saved login straight from the device, with no network call.
 *
 * The SDK's own getSession() tries to refresh an expired access token first,
 * and offline that retry loop can take ~30 seconds — which is what kept the app
 * on "Loading" with no connection. The saved copy lets the app open instantly;
 * the SDK still refreshes the token in the background once a connection exists.
 */
export function readStoredSession(): Session | null {
  try {
    const storageKey = savedSessionKey();
    if (!storageKey) return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (parsed && typeof parsed.access_token === 'string' && typeof parsed.refresh_token === 'string' && parsed.user) {
      return parsed as Session;
    }
  } catch {
    /* unreadable or unavailable: treat as signed out */
  }
  return null;
}

/** Removes the saved login from the device (used on sign-out, which may happen offline). */
export function clearStoredSession(): void {
  try {
    const storageKey = savedSessionKey();
    if (storageKey) localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}
