// Client side of the Spotify allowlist request flow (see api/access.js).
// Only surfaces for crews using the deployment owner's Spotify app — other
// crews bring their own app, and their owner isn't on this Slack.

const LS_EMAIL = 'fn_access_email_v1';
const LS_STATUS = 'fn_access_status_v1';

let configCache = null;
export async function accessConfig() {
  if (configCache) return configCache;
  try {
    const r = await fetch('/api/access?config=1');
    configCache = r.ok ? await r.json() : { enabled: false, ownerClientId: '' };
  } catch { configCache = { enabled: false, ownerClientId: '' }; }
  return configCache;
}

export function storedRequest() {
  const email = localStorage.getItem(LS_EMAIL);
  return email ? { email, status: localStorage.getItem(LS_STATUS) || 'pending' } : null;
}

export async function requestAccess(email) {
  const r = await fetch('/api/access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed: ' + r.status);
  localStorage.setItem(LS_EMAIL, email);
  localStorage.setItem(LS_STATUS, j.status);
  return j; // {status, notified}
}

export async function checkStatus(email) {
  const r = await fetch(`/api/access?email=${encodeURIComponent(email)}`);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.status && j.status !== 'none') localStorage.setItem(LS_STATUS, j.status);
  return j.status;
}
