import dayjs from "dayjs";

export function calcTotal(freePoints, topicScores) {
  const sum = (Number(freePoints) || 0) +
    (topicScores || []).reduce((s, t) => s + (Number(t.points) || 0), 0);
  return Math.round(sum * 10) / 10;
}

export const today = () => dayjs().format("YYYY-MM-DD");

export const CHART_COLORS = ["#86efac", "#60a5fa", "#f9a8d4", "#fcd34d", "#a78bfa", "#34d399", "#fb923c"];

export const GROUP_PALETTE = [
  { bg: "rgba(134,239,172,0.10)", border: "rgba(134,239,172,0.55)", solid: "#16a34a" },
  { bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.55)",  solid: "#2563eb" },
  { bg: "rgba(249,168,212,0.10)", border: "rgba(249,168,212,0.55)", solid: "#db2777" },
  { bg: "rgba(252,211,77,0.10)",  border: "rgba(252,211,77,0.55)",  solid: "#d97706" },
  { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.55)", solid: "#7c3aed" },
  { bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.55)",  solid: "#059669" },
  { bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.55)",  solid: "#ea580c" },
];

export function topicBg(val, maxPts) {
  const n = Number(val) || 0;
  if (n === 0)            return "rgba(239,68,68,0.18)";
  if (n < Number(maxPts)) return "rgba(250,204,21,0.35)";
  return undefined;
}
