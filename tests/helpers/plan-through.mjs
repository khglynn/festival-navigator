// The open plan cut after one night, for the sweeps that read a single
// night's rows from planDays (plan-text.test.mjs, plan-stop-ends.test.mjs).
// planDays lands on `from`, draws it, then draws every later night under its
// own head; a sweep that keeps only `data-night === from` threw those away,
// and drawing them was most of its run (2026-11-27: 62 s of plan-stop-ends'
// 85 s of drawing on Kevin's Air). The nights before stay, so the Earlier
// line is the same, and a night's rows end at the next night's head
// (plan-rows.js markEnds flushes there), so the night read is drawn exactly
// as the whole list draws it. planDays is the only reader of `nights` in
// the drawing; the rest of the plan is the same object's.
export function through(plan, id) {
  const at = plan.nights.findIndex((n) => n.id === id);
  return at < 0 ? plan : { ...plan, nights: plan.nights.slice(0, at + 1) };
}
