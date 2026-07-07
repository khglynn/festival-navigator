// Time math for festival schedules. Pure functions — covered by tests/time.test.mjs.

// Minutes from midnight; any AM time is treated as "after midnight"
// (festivals here start in the afternoon) so it sorts after PM sets.
export function timeToMinutes(timeStr) {
  const parts = timeStr.trim().split(' ');
  const period = parts[1];
  let [hours, minutes] = parts[0].split(':').map(Number);
  minutes = minutes || 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  let total = hours * 60 + minutes;
  if (period === 'AM') total += 24 * 60; // after-midnight
  return total;
}

export function absMinToLabel(absMin) {
  const m = absMin % (24 * 60);
  let h = Math.floor(m / 60);
  const period = h >= 12 ? 'PM' : 'AM';
  let hr = h % 12; if (hr === 0) hr = 12;
  return `${hr}:00 ${period}`;
}

// The festival "day" runs ~9 AM -> 5 AM next morning, so a pre-9 AM time
// reads as after-midnight (sorts to the end), unlike a morning workshop.
export function activityMinutes(timeStr) {
  const parts = timeStr.trim().split(' ');
  let [h, m] = parts[0].split(':').map(Number); m = m || 0;
  const period = parts[1];
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  let total = h * 60 + m;
  if (total < 9 * 60) total += 24 * 60;
  return total;
}

// Resolve a day's raw {name, stage, time} sets into {name, stage, startStr,
// startMin, endMin}. Missing ends are filled from the next set on the same
// stage (clamped 30..120 min); a stage's last set defaults to 75 min.
export function computeDayArtists(dayData) {
  const raw = dayData.artists.map((a) => {
    let startStr = a.time, endStr = null;
    if (a.time.includes(' - ')) { [startStr, endStr] = a.time.split(' - '); }
    if (endStr && endStr.toLowerCase().trim() === 'close') endStr = null;
    const startMin = timeToMinutes(startStr);
    let endMin = endStr ? timeToMinutes(endStr) : null;
    return { name: a.name, stage: a.stage, startStr: startStr.trim(), startMin, endMin };
  });
  const byStage = {};
  raw.forEach((a) => { (byStage[a.stage] = byStage[a.stage] || []).push(a); });
  Object.values(byStage).forEach((list) => {
    list.sort((x, y) => x.startMin - y.startMin);
    list.forEach((a, i) => {
      if (a.endMin != null) return;
      const next = list[i + 1];
      if (next) {
        const gap = next.startMin - a.startMin;
        a.endMin = a.startMin + Math.min(Math.max(gap, 30), 120);
      } else {
        a.endMin = a.startMin + 75;
      }
    });
  });
  return raw;
}
