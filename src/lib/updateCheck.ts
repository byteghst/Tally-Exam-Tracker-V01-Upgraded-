import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Updates are published as GitHub Releases by the Android workflow: every
// build creates a release tagged `build-<run number>` with the APK attached
// as `tally.apk`. The repo is public, so this needs no login or token.
const REPO = 'byteghst/Tally-Exam-Tracker-V01-Upgraded-';
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
// Fallback source. The API allows only 60 anonymous requests per hour per IP,
// and phones on mobile data share IPs, so it often answers 403. The release
// feed has no such limit.
const RELEASES_FEED = `https://github.com/${REPO}/releases.atom`;

// Permanent link that always serves the APK from the newest release.
export const APK_DOWNLOAD_URL = `https://github.com/${REPO}/releases/latest/download/tally.apk`;

const LAST_CHECK_KEY = 'tally.update.lastCheck';
const SKIPPED_KEY = 'tally.update.skippedBuild';
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export const INSTALLED_BUILD: number = __APP_BUILD__;

export interface UpdateInfo {
  build: number;
  notes: string;
  publishedAt: string;
}

export type CheckResult =
  | { status: 'available'; update: UpdateInfo }
  | { status: 'current' }
  | { status: 'skipped' } // an automatic check ran too recently, so nothing was fetched
  | { status: 'error' };

// Only the installed Android app checks: the web/PWA version updates itself
// through its service worker, and local dev builds have no build number.
export function canCheckForUpdates(): boolean {
  return Capacitor.isNativePlatform() && INSTALLED_BUILD > 0;
}

function readNumber(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable — the check just runs more often
  }
}

export function isSkipped(build: number): boolean {
  return readNumber(SKIPPED_KEY) === build;
}

export function skipBuild(build: number): void {
  writeNumber(SKIPPED_KEY, build);
}

/** Newest release according to the GitHub API, or null if it can't be read. */
async function latestFromApi(): Promise<UpdateInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(LATEST_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; body?: string; published_at?: string };
    const match = /^build-(\d+)$/.exec(String(data.tag_name ?? ''));
    if (!match) return null;
    return {
      build: Number(match[1]),
      notes: String(data.body ?? '').trim(),
      publishedAt: String(data.published_at ?? '')
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Newest release according to the public release feed, or null. Uses the
 * native HTTP client so the browser's cross-origin rules don't apply.
 */
async function latestFromFeed(): Promise<UpdateInfo | null> {
  try {
    const res = await CapacitorHttp.get({
      url: RELEASES_FEED,
      connectTimeout: REQUEST_TIMEOUT_MS,
      readTimeout: REQUEST_TIMEOUT_MS
    });
    if (res.status < 200 || res.status >= 300 || typeof res.data !== 'string') return null;

    let best: UpdateInfo | null = null;
    for (const entry of res.data.split('<entry>').slice(1)) {
      const tag = /\/releases\/tag\/build-(\d+)/.exec(entry);
      if (!tag) continue;
      const build = Number(tag[1]);
      if (best && build <= best.build) continue;
      best = { build, notes: '', publishedAt: /<updated>([^<]+)<\/updated>/.exec(entry)?.[1] ?? '' };
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Asks GitHub for the newest release and compares its build number with the
 * installed one. Automatic checks are throttled to once every few hours;
 * `force` (the manual "Check for updates" button) always hits the network.
 */
export async function checkForUpdate(opts: { force?: boolean } = {}): Promise<CheckResult> {
  if (!canCheckForUpdates()) return { status: 'current' };

  const now = Date.now();
  if (!opts.force && now - readNumber(LAST_CHECK_KEY) < AUTO_CHECK_INTERVAL_MS) {
    return { status: 'skipped' };
  }

  const latest = (await latestFromApi()) ?? (await latestFromFeed());
  if (!latest) return { status: 'error' };

  writeNumber(LAST_CHECK_KEY, now);
  if (latest.build <= INSTALLED_BUILD) return { status: 'current' };
  return { status: 'available', update: latest };
}

// Opens the APK link in the phone's browser, which downloads it; tapping the
// finished download then starts the normal Android install-over-existing flow.
export function openDownload(): void {
  window.open(APK_DOWNLOAD_URL, '_blank');
}
