import { useState, useEffect } from "react";
import {
  listTemplates, listResults, getKids,
} from "../../api/practiceTests";
import TemplatesTab from "./TemplatesTab";
import ResultsTab from "./ResultsTab";
import StatisticsTab from "./StatisticsTab";
import KidsTab from "./KidsTab";
import s from "./styles";

const TABS = ["Statistics", "Tests", "Templates", "Kids"];

export default function PracticeTests() {
  const [tab, setTab]             = useState("Statistics");
  const [templates, setTemplates] = useState([]);
  const [results, setResults]     = useState([]);
  const [kids, setKids]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listTemplates(), listResults(), getKids()])
      .then(([tpls, res, kd]) => {
        setTemplates(tpls);
        setResults(res);
        setKids(kd.kids || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.center}>Loading…</div>;
  if (error)   return <div style={{ ...s.center, color: "var(--danger)" }}>{error}</div>;

  return (
    <div style={s.root}>
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {tab === "Templates"  && (
          <TemplatesTab templates={templates} setTemplates={setTemplates} />
        )}
        {tab === "Tests"    && (
          <ResultsTab
            templates={templates}
            results={results} setResults={setResults}
            kids={kids} setKids={setKids}
          />
        )}
        {tab === "Statistics" && (
          <StatisticsTab templates={templates} results={results} kids={kids} />
        )}
        {tab === "Kids" && (
          <KidsTab kids={kids} setKids={setKids} />
        )}
      </div>
    </div>
  );
}
