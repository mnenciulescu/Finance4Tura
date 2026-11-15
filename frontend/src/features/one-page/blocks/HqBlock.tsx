import { useState } from "react";
import { Button, EmptyState, IconButton, Notice, Sheet, Skeleton } from "../../../ui";
import { useHqEntries, useHqLocations, useHqTemplates } from "../../../data/hq";
import { byDateDesc, isWaterTemplate } from "../../hq/hqMath";
import { ReadList } from "../../hq/ReadList";
import { TemplateSection } from "../../hq/TemplateSection";
import { HqSettingsContent } from "../../hq/HqSettings";
import { Block, ChipTabs, LinkButton } from "../Block";
import { useOnePage, useParam } from "../state";
import h from "../../hq/Hq.module.css";
import s from "../OnePage.module.css";

const OVERVIEW = "overview";

/**
 * HQ (One-Page §7.6): Overview · one tab per location; ⚙ opens HQ Settings
 * as a dialog. Entries show 3 at a time; editing stays inline with
 * auto-save, exactly as on the phone.
 */
export function HqBlock() {
  const locations = useHqLocations();
  const templates = useHqTemplates();
  const entries = useHqEntries();
  const { focusBlock } = useOnePage();
  const [tab, setTab] = useParam("hq", OVERVIEW);
  const [, setStats] = useParam("stats", "budget");
  const [, setChartLoc] = useParam("hqchart", "");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const locs = locations.data ?? [];
  const tpls = templates.data ?? [];
  const all = entries.data ?? [];
  const active = locs.find(l => l.hqId === tab);
  const loading = locations.isPending || templates.isPending || entries.isPending;

  const viewChart = (hqId: string) => { setChartLoc(hqId); setStats("hq"); focusBlock("stats"); };

  return (
    <Block
      id="hq"
      title="HQ"
      actions={<IconButton icon="gear" label="HQ Settings" onClick={() => setSettingsOpen(true)} />}
      tabs={locs.length > 0 && (
        <ChipTabs
          label="HQ views"
          value={active ? active.hqId : OVERVIEW}
          onChange={setTab}
          options={[{ value: OVERVIEW, label: "Overview" }, ...locs.map(l => ({ value: l.hqId, label: l.name }))]}
        />
      )}
    >
      {(locations.isError || templates.isError || entries.isError) && <Notice>Could not load HQ data.</Notice>}
      {loading ? (
        <Skeleton height={180} />
      ) : locs.length === 0 ? (
        <EmptyState
          icon="building"
          title="No locations yet"
          message="Add a location and a tracker template in HQ Settings."
          action={<Button variant="tinted" onClick={() => setSettingsOpen(true)}>Open HQ Settings</Button>}
        />
      ) : active ? (
        tpls.filter(t => t.hqId === active.hqId).length === 0 ? (
          <EmptyState
            icon="list"
            title="No templates"
            message={`Add a tracker template for ${active.name} in HQ Settings.`}
            action={<Button variant="tinted" onClick={() => setSettingsOpen(true)}>Open HQ Settings</Button>}
          />
        ) : (
          tpls.filter(t => t.hqId === active.hqId).map(tpl => (
            <TemplateSection
              key={tpl.templateId}
              template={tpl}
              hqId={active.hqId}
              entries={all.filter(e => e.templateId === tpl.templateId).sort(byDateDesc)}
              limit={3}
            />
          ))
        )
      ) : (
        <div className={s.stack}>
          {locs.map(loc => {
            const locTemplates = tpls.filter(t => t.hqId === loc.hqId);
            return (
              <section key={loc.hqId} className={s.group} aria-label={loc.name}>
                <h3 className={s.subhead}>{loc.name}</h3>
                {locTemplates.length === 0 && <p className={s.muted}>No templates for this location.</p>}
                {locTemplates.map(tpl => (
                  <div key={tpl.templateId} className={h.card}>
                    <div className={s.captionRow}>
                      <h4 className={h.cardTitle}>{tpl.name}</h4>
                      {isWaterTemplate(tpl) && <LinkButton onClick={() => viewChart(loc.hqId)}>View chart →</LinkButton>}
                    </div>
                    <ReadList template={tpl} entries={all} limit={3} />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <Sheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="HQ Settings" detent="large" surface="grouped">
        <HqSettingsContent />
      </Sheet>
    </Block>
  );
}
