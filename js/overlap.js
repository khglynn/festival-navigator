// Same-stage overlap handling (pure, DOM-free — tests/overlap.test.mjs).
//
// The schedule grid gives each stage one column; two sets playing at the same
// time on the same stage used to render on top of each other (the bug that
// spawned the old fixed "also happening" list). This module assigns each set
// a lane within its stage column: overlapping sets get side-by-side lanes,
// non-overlapping sets keep the full column width.
//
// Input: the computed day artists ({stage, startMin, endMin, ...}).
// Output: a Map from the artist OBJECT to {lane, lanes} where lanes is the
// width-divisor for that set's overlap cluster.
export function computeLanes(computed) {
  const out = new Map();
  const byStage = {};
  computed.forEach((a) => { (byStage[a.stage] = byStage[a.stage] || []).push(a); });

  for (const sets of Object.values(byStage)) {
    sets.sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin);
    // Build clusters: a set joins the current cluster if it overlaps the
    // cluster's running max end; otherwise a new cluster starts.
    let cluster = [], clusterEnd = -Infinity;
    const flush = () => {
      if (!cluster.length) return;
      // Greedy lane assignment inside the cluster.
      const laneEnds = [];
      const assigned = [];
      for (const s of cluster) {
        let lane = laneEnds.findIndex((end) => end <= s.startMin);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = s.endMin;
        assigned.push([s, lane]);
      }
      const lanes = laneEnds.length;
      for (const [s, lane] of assigned) out.set(s, { lane, lanes });
      cluster = []; clusterEnd = -Infinity;
    };
    for (const s of sets) {
      if (s.startMin >= clusterEnd) flush();
      cluster.push(s);
      clusterEnd = Math.max(clusterEnd, s.endMin);
    }
    flush();
  }
  return out;
}
