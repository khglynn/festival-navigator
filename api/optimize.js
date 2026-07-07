// Group-plan optimizer. Takes STRUCTURED picks and builds the prompt
// server-side — this replaced /api/gemini, which accepted raw prompts and was
// therefore a free LLM proxy for anyone who found the URL.
//
// POST { festivalName, day, picks: {artist: {time, stage, people: {name: level}}} } -> { text }
import { rateLimited, crossSite, callGemini } from './_lib/guard.mjs';

const MAX_ARTISTS = 120;
const MAX_PEOPLE_PER_ARTIST = 24; // mirrors the crew's active-people cap
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SHORT = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n && !/[\x00-\x1f]/.test(v) && !FORBIDDEN_KEYS.has(v);

function validate(body) {
  if (!body || typeof body !== 'object') return null;
  const { festivalName, day, picks } = body;
  if (!SHORT(festivalName, 80) || !SHORT(day, 40)) return null;
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) return null;
  const entries = Object.entries(picks);
  if (entries.length === 0 || entries.length > MAX_ARTISTS) return null;
  const clean = {};
  for (const [artist, info] of entries) {
    if (!SHORT(artist, 100) || !info || typeof info !== 'object') return null;
    if (!SHORT(info.time, 30) || !SHORT(info.stage, 60)) return null;
    if (!info.people || typeof info.people !== 'object') return null;
    const peopleEntries = Object.entries(info.people);
    if (peopleEntries.length > MAX_PEOPLE_PER_ARTIST) return null;
    const people = {};
    for (const [name, level] of peopleEntries) {
      if (!SHORT(name, 24) || !Number.isInteger(level) || level < 1 || level > 3) return null;
      people[name] = level;
    }
    clean[artist] = { time: info.time, stage: info.stage, people };
  }
  return { festivalName, day, picks: clean };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
  if (rateLimited(req, 'optimize', 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Slow down a little — try again in a few minutes' });
  }

  const input = validate(req.body);
  if (!input) return res.status(400).json({ error: 'Invalid picks payload' });

  const prompt = `You are a festival planner for a group at ${input.festivalName} on ${input.day}. Selections: ${JSON.stringify(input.picks)}. Levels: 1 Nice, 2 Highlight, 3 Must See. Identify the top 2-3 conflicts involving Must See sets and propose creative compromises. Then give a chronological "Suggested Group Plan". Format clean HTML with <h2>,<h3>,<p>,<ul>,<li>,<strong>.`;

  try {
    const result = await callGemini(prompt);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ text: result.text });
  } catch (error) {
    console.error('optimize error:', error);
    return res.status(500).json({ error: 'Failed to generate' });
  }
}
