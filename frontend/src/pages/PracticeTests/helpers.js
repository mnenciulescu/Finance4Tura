import { GROUP_PALETTE, calcTotal } from "./constants";

export function computeTopicPassRate(template, resultsForTemplate) {
  const topics = template.topics || [];
  const uniqueGroups = [];
  topics.forEach(t => {
    const g = t.group || "";
    if (!uniqueGroups.includes(g)) uniqueGroups.push(g);
  });
  const groupInfo = topics.map((t, i) => {
    const g = t.group || "";
    const isStart = i === 0 || g !== (topics[i - 1].group || "");
    const isEnd   = i === topics.length - 1 || g !== (topics[i + 1].group || "");
    const palette = g ? GROUP_PALETTE[uniqueGroups.indexOf(g) % GROUP_PALETTE.length] : null;
    return { isStart, isEnd, palette };
  });
  const groupSpans = [];
  topics.forEach((t, i) => {
    const g = t.group || "";
    const { palette } = groupInfo[i] || {};
    if (groupSpans.length === 0 || groupSpans[groupSpans.length - 1].group !== g) {
      groupSpans.push({ group: g, count: 1, palette });
    } else {
      groupSpans[groupSpans.length - 1].count++;
    }
  });
  const valid = resultsForTemplate.filter(r => {
    if (!r.topicScores || r.topicScores.length === 0) return false;
    const computed = calcTotal(r.freePoints || 0, r.topicScores);
    return Math.abs(computed - (r.totalScore || 0)) < 0.1;
  });
  const byKid = {};
  for (const r of valid) {
    if (!byKid[r.kidName]) byKid[r.kidName] = [];
    byKid[r.kidName].push(r);
  }
  const kidRows = Object.entries(byKid).sort(([a], [b]) => a.localeCompare(b)).map(([kidName, kidResults]) => {
    const percs = topics.map(topic => {
      const scores = kidResults.flatMap(r =>
        (r.topicScores || []).filter(ts => ts.topicId === topic.topicId)
      );
      if (scores.length === 0 || topic.defaultPoints === 0) return null;
      const avg = scores.reduce((s, ts) => s + (ts.points || 0), 0) / scores.length;
      return Math.round((avg / topic.defaultPoints) * 100);
    });
    return { kidName, percs, count: kidResults.length };
  });
  return { topicCols: topics, groupInfo, groupSpans, kidRows };
}
