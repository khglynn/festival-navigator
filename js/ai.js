// AI features (server key preferred, client key fallback).
import * as state from './state.js';
import { escapeHtml, sleep } from './util.js';
import { geminiApiKey, openApiKeyModal, openInfoModal } from './ui.js';

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  let delay = 1000;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
      if (r.ok) { const j = await r.json(); return j.candidates[0].content.parts[0].text; }
      if (r.status === 429) { await sleep(delay); delay *= 2; continue; }
      const e = await r.json(); throw new Error(e?.error?.message || r.statusText);
    } catch (err) { if (i === 3) return `Error: ${err.message}.`; await sleep(delay); delay *= 2; }
  }
}

// Run a Gemini prompt: shared server key first (no per-user setup), client key as fallback.
// Returns null only when the server is unavailable AND no client key is set.
async function geminiText(prompt) {
  try {
    const r = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    if (r.ok) { const j = await r.json(); if (j.text) return j.text; }
  } catch (e) { /* fall through to client key */ }
  if (!geminiApiKey) return null;
  return await callGemini(prompt);
}

export async function getArtistInfo(artistName) {
  openInfoModal(`<div class="text-center"><h3 class="text-2xl font-bold mb-2 accent-text">${escapeHtml(artistName)}</h3><p class="text-gray-300">Getting info... ✨</p></div>`);
  // Try server endpoint first (no key needed for the user).
  try {
    const r = await fetch('/api/artist-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artistName }) });
    if (r.ok) {
      const j = await r.json();
      if (j.artistInfo) { openInfoModal(`<h3 class="text-2xl font-bold mb-3 accent-text">${escapeHtml(artistName)}</h3>${j.artistInfo.replace(/<p>/g, '<p class="text-gray-200 mb-2">')}`); return; }
    }
  } catch (e) { /* fall through to client key */ }
  if (!geminiApiKey) { openApiKeyModal(() => getArtistInfo(artistName)); return; }
  const prompt = `You are a music expert. Give a short, exciting 3-4 sentence summary for "${artistName}" — genre, vibe, and what their live show is known for. Format as simple HTML <p> tags.`;
  const text = await callGemini(prompt);
  openInfoModal(`<h3 class="text-2xl font-bold mb-3 accent-text">${escapeHtml(artistName)}</h3>${text.replace(/<p>/g, '<p class="text-gray-200 mb-2">')}`);
}

export async function solveConflicts() {
  const computed = state.getDayArtists(state.currentDay);
  const forDay = {};
  computed.forEach(a => {
    const sel = state.selections()[a.name];
    if (sel && Object.values(sel).some(l => l > 0)) {
      forDay[a.name] = { time: a.startStr, stage: a.stage, people: sel };
    }
  });
  if (!Object.keys(forDay).length) { openInfoModal(`<p>No picks for ${escapeHtml(state.currentDay)} yet. Tap some artists first!</p>`); return; }
  openInfoModal(`<div class="text-center"><h3 class="text-2xl font-bold mb-2 accent-text">Optimizing ✨</h3><p class="text-gray-300">Analyzing schedules...</p></div>`);
  const prompt = `You are a festival planner for a group at ${state.fest().name} on ${state.currentDay}. Selections: ${JSON.stringify(forDay)}. Levels: 1 Nice, 2 Highlight, 3 Must See. Identify the top 2-3 conflicts involving Must See sets and propose creative compromises. Then give a chronological "Suggested Group Plan". Format clean HTML with <h2>,<h3>,<p>,<ul>,<li>,<strong>.`;
  const text = await geminiText(prompt);
  if (text == null) { openApiKeyModal(() => solveConflicts()); return; }
  openInfoModal(text.replace(/<h2>/g, '<h2 class="text-xl font-bold accent-text mt-4 mb-2 border-b border-gray-600 pb-1">').replace(/<h3>/g, '<h3 class="text-lg font-semibold text-gray-100 mt-3">').replace(/<p>/g, '<p class="text-gray-300 mb-2">'));
}
