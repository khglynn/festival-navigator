export const meta = {
  name: 'design-audit',
  description: 'Walk every user flow at 3 viewports, review with design lenses, adversarially verify, synthesize a ranked UX backlog',
  phases: [
    { title: 'Recon', detail: '3 viewport walkers + 4 code finders' },
    { title: 'Review', detail: 'flow-group reviewers + cross-cutting lenses' },
    { title: 'Verify', detail: 'dedupe then adversarial skeptics' },
    { title: 'Synthesize', detail: 'ranked backlog' },
  ],
}

const REPO = args.repo
const LINK = args.link
const BASE = args.base
const SHOTS = args.shotDir
const TS = args.ts

const FINDING = {
  type: 'object', required: ['severity', 'title', 'description'], additionalProperties: false,
  properties: {
    severity: { enum: ['P0', 'P1', 'P2', 'P3'] },
    title: { type: 'string' },
    flow: { type: 'string' },
    file: { type: 'string' },
    viewport: { type: 'string' },
    evidence: { type: 'string' },
    description: { type: 'string' },
  },
}
const FINDINGS_SCHEMA = { type: 'object', required: ['findings'], properties: { findings: { type: 'array', items: FINDING } } }
const WALK_SCHEMA = {
  type: 'object', required: ['flowsWalked', 'shotDirUsed'],
  properties: {
    shotDirUsed: { type: 'string' },
    flowsWalked: { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, shots: { type: 'integer' }, anomalies: { type: 'array', items: { type: 'string' } }, skipped: { type: 'string' } } } },
  },
}
const VERDICT_SCHEMA = { type: 'object', required: ['real', 'why'], properties: { real: { type: 'boolean' }, severity: { enum: ['P0', 'P1', 'P2', 'P3'] }, why: { type: 'string' } } }

const COMMON = `You are part of a design/UX audit of Festival Navigator, a vanilla-JS PWA for festival crews, live at ${BASE}. Repo: ${REPO}. The spec is ${REPO}/docs/user-flows.md — Read it first. The audit crew is "Audit Rig" (throwaway test data, safe to mutate): ${LINK} — NEVER navigate to any other crew token. Your final text is data for an orchestrator, not prose for a human. Report what IS, including what you could not do — never fake a step.`

function walkerPrompt(vw, w, h, server) {
  return `${COMMON}
You are the ${vw} walker. Use ONLY the ${server} MCP browser (load its tools via ToolSearch, e.g. "select:mcp__${server}__browser_navigate,mcp__${server}__browser_take_screenshot" plus resize/click/evaluate/snapshot/navigate_back/wait_for as needed). Resize the browser to ${w}x${h} FIRST and keep it there.

Walk EVERY flow F1-F16 from the spec, screenshotting each meaningful state. Rules:
- Screenshots: save as ${SHOTS}/${vw}/F<flow>-<step>-<slug>.png. After your FIRST screenshot, verify with Bash ls that the file exists at that path; if the MCP server saved it elsewhere, find it, and from then on record the real paths. Append one line per step to ${SHOTS}/${vw}/walk-log.md AS YOU GO (step, url, shot path, anomalies observed) — bank incrementally, never rewrite.
- Before every screenshot, inject once per page load via evaluate: a <style> with * { animation: none !important; transition: none !important; } (the app has animated gradients that stall screenshots).
- F1/F2: open ${BASE} bare (no hash). Walk the create flow but DO NOT click the final Create button (no extra crews). Screenshot each state including a fest selected + name typed.
- F3: open ${LINK} fresh; on the join screen, join as the EXISTING member "Auditor". Screenshot before/after.
- F4 (Portola lineup): screenshot the wall top; use search; open the sort control (focus it and screenshot — if the popup is OS-native and invisible to screenshots, SAY SO in the log, that itself is evidence); tap an artist card and screenshot before/after the pick change; tap a must (level 4) down to 0 to catch the undo toast.
- F5 (Electric Forest, scheduled): find your way to it from the wall via Settings (record HOW hard it is to find — that is evidence). Screenshot the set-times grid, scroll horizontally, screenshot the list below the grid if any. Then TAP one artist card inside the time grid and screenshot before/after — report exactly what happens to the card.
- F6 notes: long-press an artist card ~600ms (if the click tool cannot hold, dispatch pointerdown, wait 600ms, pointerup via evaluate). Screenshot the sheet. Add one note ("audit ${vw}"). Screenshot.
- F7/F8: day-note and fest-note composers (scroll to find them), the Notes chip view — screenshot its content and empty areas. Add nothing more; just capture.
- F9: capture whatever day navigation exists at your viewport (dock? tabs? nothing?) — absence is evidence.
- F10: after opening Settings, press the BROWSER back (navigate_back). Record where you land. Repeat after opening a sheet. This is a spec-critical test.
- F11: walk Settings fully — every door and drill — screenshot each.
- F12: open Add a festival, type "Coachella 2025", run the research, screenshot the preview, then CANCEL — DO NOT save.
- F13: open the Spotify drill, screenshot every state you can reach; click Connect and screenshot whatever page results (do NOT log in to Spotify); browser-back to the app.
- F14: open export/download tools, screenshot; attempt Download-as-PNG, note what happens.
- F15: skip actual offline testing; note skipped.
- F16: open ${BASE}/definitely-not-a-page and ${BASE}/#g=badtoken1234567890123456 — screenshot both.
- Log anomalies liberally: anything broken, confusing, ugly, misaligned, mis-sized, or unintentional-looking AT YOUR VIEWPORT. You are the eyes; reviewers only see your screenshots and logs.
- When finished, close the browser tab you used.
Return via schema: shotDirUsed (real dir), flowsWalked with shot counts, anomalies (one line each), skipped reasons.`
}

const CODE_FINDERS = [
  { key: 'handlers', prompt: `${COMMON}
Code finder: event handlers + re-render integrity. Read js/v3/wall.js, js/v3/app.js, js/v3/notes.js, js/v3/settings.js, js/sync.js. Hunt: nodes replaced losing inline styles/positioning or listeners; repaint races vs async polls; stale closures over detached DOM; long-press/click conflicts; anything where a user action leaves the DOM wrong. Findings via schema with file:line evidence.` },
  { key: 'css', prompt: `${COMMON}
Code finder: CSS system. Read index.html's <style> block, assets/v3.css, assets/v3-tokens.css, gallery.html. Hunt: dead/unused rules; single-breakpoint gaps (what SHOULD change at desktop but does not); fixed-px type that ignores viewport; containers with no vertical centering; missing focus states; contrast risks; inconsistent spacing values doing the same job. Findings via schema.` },
  { key: 'data', prompt: `${COMMON}
Code finder: data-vs-renderer contracts. Read data/festivals/*.json (structure-skim each), api/_lib/festival-rules.mjs, js/festivals.js, the renderers in js/v3/wall.js. Hunt: fields present in data but rendered nowhere; fields renderers expect but data lacks; per-festival oddities (empty strings, combined day strings, activities shape, weekend flags); validator rules that disagree with renderer behavior. Findings via schema.` },
  { key: 'states', prompt: `${COMMON}
Code finder: error/empty/offline states. Read js/sync.js, js/state.js, js/crew.js, service-worker.js, js/spotify.js, spotify-callback.html, js/v3/app.js boot paths. Hunt: unhandled fetch failures; dead-end error states (user stuck with no path forward); bad-token handling; OAuth failure handling; localStorage fallbacks that can serve stale silently; sync-status visibility. Findings via schema.` },
]

phase('Recon')
const reconResults = await parallel([
  () => agent(walkerPrompt('390', 390, 844, 'playwright-1'), { label: 'walk:390', phase: 'Recon', schema: WALK_SCHEMA, model: 'sonnet' }),
  () => agent(walkerPrompt('768', 768, 1024, 'playwright-2'), { label: 'walk:768', phase: 'Recon', schema: WALK_SCHEMA, model: 'sonnet' }),
  () => agent(walkerPrompt('1440', 1440, 900, 'playwright-3'), { label: 'walk:1440', phase: 'Recon', schema: WALK_SCHEMA, model: 'sonnet' }),
  ...CODE_FINDERS.map((f) => () => agent(f.prompt, { label: `code:${f.key}`, phase: 'Recon', schema: FINDINGS_SCHEMA, model: 'sonnet' })),
])
const walks = reconResults.slice(0, 3).filter(Boolean)
const codeFindings = reconResults.slice(3).filter(Boolean).flatMap((r) => r.findings)
log(`Recon done: ${walks.length}/3 walks, ${codeFindings.length} code findings`)

const walkSummary = walks.map((w, i) => `${['390','768','1440'][i] || i}: dir=${w.shotDirUsed} flows=${w.flowsWalked.map((f) => `${f.id}(${f.shots || 0}${f.skipped ? ' SKIPPED:' + f.skipped : ''})`).join(' ')}`).join('\n')

const FLOW_GROUPS = [
  { key: 'entry', flows: 'F1 F2 F3', hint: 'landing, create, join' },
  { key: 'lineup', flows: 'F4', hint: 'the wall lineup view: grid, search, sort, pick cycle' },
  { key: 'settimes', flows: 'F5', hint: 'scheduled set-times view: stage grid, lanes, the below-grid list, tap behavior' },
  { key: 'notes', flows: 'F6 F7 F8', hint: 'notes at artist/day/fest scope + the all-notes view' },
  { key: 'nav', flows: 'F9 F10', hint: 'day navigation per viewport + browser back/forward' },
  { key: 'settings', flows: 'F11 F12', hint: 'settings doors + add-a-festival research flow' },
  { key: 'spotify', flows: 'F13', hint: 'spotify connect/scan states' },
  { key: 'edges', flows: 'F14 F15 F16', hint: 'export tools, offline, 404/bad-token' },
]

const LENSES = [
  { key: 'responsive', prompt: `Cross-cutting lens: RESPONSIVENESS AS A SYSTEM. Compare the same screens across ${SHOTS}/390, ${SHOTS}/768, ${SHOTS}/1440 (Read the images + walk-log.md files). Judge: does desktop look DESIGNED or like stretched mobile? Dead space, floating content, type that stays phone-sized, surfaces that should change shape (sheets, menus, grids) but do not. Cite shot filenames as evidence.` },
  { key: 'copy-a11y', prompt: `Cross-cutting lens: COPY + ACCESSIBILITY. Read the walk logs and screenshots across all three dirs under ${SHOTS}, plus index.html markup. Judge: microcopy clarity (does each state explain itself?), jargon, empty-state guidance, focus/keyboard reachability of interactive controls, aria on custom controls, touch-target sizes. Cite evidence.` },
  { key: 'firstuse', prompt: `Cross-cutting lens: FIRST-TIME USER. Using the screenshots + logs under ${SHOTS} and the spec, simulate a brand-new crew member who got a link: what would confuse them in the first 3 minutes? Where does the app assume knowledge it never taught? Rank by how early in the journey the confusion hits. Cite evidence.` },
]

phase('Review')
const reviewResults = await parallel([
  ...FLOW_GROUPS.map((g) => () => agent(`${COMMON}
Flow reviewer for ${g.flows} (${g.hint}). Read the spec sections for your flows in docs/user-flows.md, then Read the relevant screenshots + walk-log.md in ${SHOTS}/390, ${SHOTS}/768, ${SHOTS}/1440 (files starting with your flow ids). Walker summary:\n${walkSummary}\nAlso read the code behind your flows where evidence points there. Judge against the spec AND against good product design: spec mismatches, ugly/unintentional layouts at any viewport, confusing affordances, missing states. Every finding needs evidence (shot filename, log line, or file:line). Findings via schema.`, { label: `review:${g.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, model: 'sonnet' })),
  ...LENSES.map((l) => () => agent(`${COMMON}\n${l.prompt}\nFindings via schema.`, { label: `lens:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA, model: 'sonnet' })),
])
const reviewFindings = reviewResults.filter(Boolean).flatMap((r) => r.findings)
const walkAnomalies = walks.flatMap((w, i) => w.flowsWalked.flatMap((f) => (f.anomalies || []).map((a) => ({ severity: 'P2', title: a.slice(0, 90), flow: f.id, viewport: ['390','768','1440'][i], evidence: 'walker observation', description: a }))))
const all = [...codeFindings, ...reviewFindings, ...walkAnomalies]
log(`Review done: ${reviewFindings.length} review + ${codeFindings.length} code + ${walkAnomalies.length} walker anomalies = ${all.length} raw`)

phase('Verify')
const deduped = await agent(`${COMMON}
You are the dedupe/merge judge. Below are ${all.length} raw findings from independent auditors (JSON). Merge duplicates (same underlying problem = one finding, keep the best evidence from each source and note how many sources reported it in evidence), drop non-findings (praise, questions, pure speculation with no evidence), normalize severity (P0 = broken/data-wrong for users, P1 = flow-blocking or badly confusing, P2 = clearly wrong but survivable, P3 = polish). Return the canonical list via schema.
RAW FINDINGS:\n${JSON.stringify(all)}`, { label: 'dedupe', phase: 'Verify', schema: FINDINGS_SCHEMA, model: 'opus' })
const canon = (deduped?.findings || [])
log(`Deduped to ${canon.length} canonical findings; verifying each`)

const verified = await parallel(canon.map((f, i) => () =>
  agent(`${COMMON}
Adversarial skeptic. Try to REFUTE this finding — check the actual code and/or the screenshots it cites yourself (Read them). A finding is real only if the evidence genuinely supports a user-visible or code-verifiable problem. If real, confirm or adjust severity. Finding:\n${JSON.stringify(f)}`, { label: `verify:${i}`, phase: 'Verify', schema: VERDICT_SCHEMA, model: 'opus' })
    .then((v) => (v && v.real ? { ...f, severity: v.severity || f.severity, verifiedWhy: v.why } : null))
))
const confirmed = verified.filter(Boolean)
log(`${confirmed.length}/${canon.length} findings survived adversarial verification`)

phase('Synthesize')
const synthesis = await agent(`${COMMON}
Synthesizer. Write the final audit backlog to ${SHOTS}/backlog.md (Write tool): title "Design audit — ${TS}", findings ranked P0 first, grouped into problem CLASSES (name each class by its root pattern, not by symptom), each finding with severity/flow/viewport/evidence/description, and a closing section "Coverage gaps" listing flows any walker skipped. Confirmed findings JSON:\n${JSON.stringify(confirmed)}\nWalker coverage:\n${walkSummary}\nReturn a JSON summary via schema.`, {
  label: 'synthesize', phase: 'Synthesize', model: 'opus',
  schema: { type: 'object', required: ['counts', 'classes', 'top'], properties: { counts: { type: 'object', properties: { P0: { type: 'integer' }, P1: { type: 'integer' }, P2: { type: 'integer' }, P3: { type: 'integer' } } }, classes: { type: 'array', items: { type: 'string' } }, top: { type: 'array', items: { type: 'string' } } } },
})

return { summary: synthesis, confirmedCount: confirmed.length, rawCount: all.length, backlog: `${SHOTS}/backlog.md`, confirmed }