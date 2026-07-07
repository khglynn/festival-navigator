// Spotify allowlist requests — the recordOS-style Slack flow, ported.
//
// Spotify dev-mode apps require the OWNER to manually add each user's Spotify
// email in the developer dashboard, and owners rarely know friends' emails.
// This flow: friend submits their email in-app -> owner gets a Slack message
// with an approve button -> approving flips the row here AND redirects the
// owner to the Spotify dashboard to paste the email (the REAL gate) -> the
// friend's app polls its way to "approved" and offers the connect button.
//
//   GET  /api/access?config=1                     -> { enabled, ownerClientId }
//   POST /api/access            { email }         -> { status }  (+ Slack ping)
//   GET  /api/access?email=x                      -> { status }  (polled)
//   GET  /api/access?approve=1&email=x&token=y    -> 302 to Spotify dashboard
//
// Enabled only when SLACK_WEBHOOK_URL + APPROVE_SECRET + OWNER_SPOTIFY_CLIENT_ID
// are set; the client shows the flow only for crews using the owner's app —
// other crews bring their own Spotify apps and their owners aren't on this Slack.
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { rateLimited, crossSite } from './_lib/guard.mjs';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const enabled = () =>
  !!(process.env.SLACK_WEBHOOK_URL && process.env.APPROVE_SECRET && process.env.OWNER_SPOTIFY_CLIENT_ID);

function tokensMatch(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

async function notifySlack(email, baseUrl) {
  const approveUrl = `${baseUrl}/api/access?approve=1&email=${encodeURIComponent(email)}&token=${encodeURIComponent(process.env.APPROVE_SECRET)}`;
  const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🎪 Festival Navigator — Spotify access request' } },
        { type: 'section', text: { type: 'mrkdwn', text: `*${email}* wants to connect Spotify.\nApproving opens the Spotify dashboard — paste their email under User Management there (that's the real gate).` } },
        { type: 'actions', elements: [{ type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Approve + open Spotify dashboard' }, url: approveUrl }] },
      ],
    }),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });

  // Config probe works even when disabled, so the client can hide the UI.
  if (req.method === 'GET' && req.query.config) {
    return res.status(200).json({ enabled: enabled(), ownerClientId: process.env.OWNER_SPOTIFY_CLIENT_ID || '' });
  }
  if (!enabled()) return res.status(503).json({ error: 'Access requests are not enabled on this deployment' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'Store not configured' });
  const sql = neon(process.env.DATABASE_URL);

  // ---- owner approval (the Slack button) ----
  if (req.method === 'GET' && req.query.approve) {
    const { email, token } = req.query;
    if (!token || !tokensMatch(token, process.env.APPROVE_SECRET)) {
      return res.status(403).json({ error: 'Bad approval token' });
    }
    const rows = await sql`
      UPDATE access_requests SET status = 'approved', approved_at = now()
      WHERE email = ${String(email).toLowerCase()} RETURNING email`;
    if (!rows.length) return res.status(404).json({ error: 'No such request' });
    res.setHeader('Location', `https://developer.spotify.com/dashboard/${process.env.OWNER_SPOTIFY_CLIENT_ID}/users`);
    return res.status(302).end();
  }

  // ---- status poll ----
  if (req.method === 'GET') {
    if (rateLimited(req, 'access-poll', 120, 10 * 60 * 1000)) return res.status(429).json({ error: 'Polling too fast' });
    const email = String(req.query.email || '').toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Invalid email' });
    const rows = await sql`SELECT status FROM access_requests WHERE email = ${email}`;
    return res.status(200).json({ status: rows.length ? rows[0].status : 'none' });
  }

  // ---- new request ----
  if (req.method === 'POST') {
    if (rateLimited(req, 'access-request', 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many requests — try again later' });
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'That does not look like an email address' });

    // Already approved? Skip straight there (returning member, new device).
    const rows = await sql`
      INSERT INTO access_requests (email) VALUES (${email})
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING status`;
    const status = rows[0].status;
    let notified = false;
    if (status === 'pending') {
      const proto = (req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0];
      const baseUrl = `${proto}://${req.headers.host}`;
      try { notified = await notifySlack(email, baseUrl); } catch (e) { console.error('slack notify failed:', e); }
    }
    return res.status(200).json({ status, notified });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
