// AI features (server key preferred, client key fallback).
import * as state from './state.js';
import { escapeHtml, sleep } from './util.js';
import { geminiApiKey, openApiKeyModal, openInfoModal } from './ui.js';

// LLM output goes into innerHTML, and its inputs include crew-controlled
// strings (person names) — allow only inert formatting tags, no attributes.
function sanitizeAiHtml(html) {
  return String(html)
    .replace(/<(?!\/?(p|h2|h3|ul|ol|li|strong|em|br)\b)[^>]*>/gi, '')
    .replace(/<(\/?)(p|h2|h3|ul|ol|li|strong|em|br)\b[^>]*>/gi, '<$1$2>');
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  let delay = 1000;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
      if (r.ok) {
        const j = await r.json();
        // Gemini can 200 with no candidates (safety filtering) — degrade politely.
        const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || 'The AI declined to answer that one — try again or rephrase.';
      }
      if (r.status === 429) { await sleep(delay); delay *= 2; continue; }
      const e = await r.json(); throw new Error(e?.error?.message || r.statusText);
    } catch (err) { if (i === 3) return `Error: ${err.message}.`; await sleep(delay); delay *= 2; }
  }
}

export async function getArtistInfo(artistName) {
  openInfoModal(`<div class="text-center"><h3 class="text-2xl font-bold mb-2 accent-text">${escapeHtml(artistName)}</h3><p class="text-gray-300">Getting info... ✨</p></div>`);
  // Try server endpoint first (no key needed for the user). GET so the CDN
  // actually caches per artist.
  try {
    const r = await fetch(`/api/artist-info?artist=${encodeURIComponent(artistName)}`);
    if (r.ok) {
      const j = await r.json();
      if (j.artistInfo) {
        openInfoModal(`<h3 class="text-2xl font-bold mb-3 accent-text">${escapeHtml(artistName)}</h3>${sanitizeAiHtml(j.artistInfo).replace(/<p>/g, '<p class="text-gray-200 mb-2">')}`);
        return;
      }
    }
  } catch (e) { /* fall through to client key */ }
  if (!geminiApiKey) { openApiKeyModal(() => getArtistInfo(artistName)); return; }
  const prompt = `You are a music expert. Give a short, exciting 3-4 sentence summary for "${artistName}" — genre, vibe, and what their live show is known for. Format as simple HTML <p> tags.`;
  const text = await callGemini(prompt);
  openInfoModal(`<h3 class="text-2xl font-bold mb-3 accent-text">${escapeHtml(artistName)}</h3>${sanitizeAiHtml(text).replace(/<p>/g, '<p class="text-gray-200 mb-2">')}`);
}

export async function solveConflicts() {
  if (!state.fest().days || !state.currentDay) {
    openInfoModal(`<p class="text-gray-300">The optimizer needs set times — this festival has no stage schedule yet. Make picks in the list and come back when times drop!</p>`);
    return;
  }
  const computed = state.getDayArtists(state.currentDay);
  const picks = {};
  computed.forEach(a => {
    const sel = state.selections()[a.name];
    if (!sel) return;
    const people = {};
    for (const [p, lvl] of Object.entries(sel)) {
      if (lvl > 0 && state.isActivePerson(state.people()[p])) people[p] = lvl;
    }
    if (Object.keys(people).length) picks[a.name] = { time: a.startStr, stage: a.stage, people };
  });
  if (!Object.keys(picks).length) { openInfoModal(`<p>No picks for ${escapeHtml(state.currentDay)} yet. Tap some artists first!</p>`); return; }
  openInfoModal(`<div class="text-center"><h3 class="text-2xl font-bold mb-2 accent-text">Optimizing ✨</h3><p class="text-gray-300">Analyzing schedules...</p></div>`);

  // Server endpoint takes STRUCTURED picks (never raw prompts). Client-key
  // fallback builds the equivalent prompt locally.
  let text = null;
  try {
    const r = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ festivalName: state.fest().name, day: state.currentDay, picks }),
    });
    if (r.ok) { const j = await r.json(); text = j.text || null; }
  } catch (e) { /* fall through to client key */ }
  if (text == null) {
    if (!geminiApiKey) { openApiKeyModal(() => solveConflicts()); return; }
    const prompt = `You are a festival planner for a group at ${state.fest().name} on ${state.currentDay}. Selections: ${JSON.stringify(picks)}. Levels: 1 Nice, 2 Highlight, 3 Must See. Identify the top 2-3 conflicts involving Must See sets and propose creative compromises. Then give a chronological "Suggested Group Plan". Format clean HTML with <h2>,<h3>,<p>,<ul>,<li>,<strong>.`;
    text = await callGemini(prompt);
  }
  openInfoModal(sanitizeAiHtml(text)
    .replace(/<h2>/g, '<h2 class="text-xl font-bold accent-text mt-4 mb-2 border-b border-gray-600 pb-1">')
    .replace(/<h3>/g, '<h3 class="text-lg font-semibold text-gray-100 mt-3">')
    .replace(/<p>/g, '<p class="text-gray-300 mb-2">'));
}
