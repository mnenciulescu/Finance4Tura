import { useState } from "react";
import { Button, EmptyState, IconButton, Notice, Sheet, Skeleton } from "../../../ui";
import { useHqEntries, useHqLocations, useHqTemplates } from "../../../data/hq";
import { byDateDesc, defaultLocation } from "../../hq/hqMath";
import { TemplateSection } from "../../hq/TemplateSection";
import { HqSettingsContent } from "../../hq/HqSettings";
import { Block, ChipTabs } from "../Block";
import { useParam } from "../state";

/**
 * HQ (One-Page §7.6): one tab per location (no Overview), opening on
 * Mosoaia (see defaultLocation); ⚙ opens HQ Settings as a dialog. Entries show 3 at a time; editing stays inline with
 * auto-save, exactly as on the phone.
 */
export function HqBlock() {
  const locations = useHqLocations();
  const templates = useHqTemplates();
  const entries = useHqEntries();
  const [tab, setTab] = useParam("hq", "");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const locs = locations.data ?? [];
  const tpls = templates.data ?? [];
  const all = entries.data ?? [];
  const active = locs.find(l => l.hqId === tab) ?? defaultLocation(locs);
  const loading = locations.isPending || templates.isPending || entries.isPending;

  return (
    <Block
      id="hq"
      title="HQ"
      actions={<IconButton icon="gear" label="HQ Settings" onClick={() => setSettingsOpen(true)} />}
      tabs={locs.length > 0 && (
        <ChipTabs
          label="HQ views"
          value={active?.hqId ?? ""}
          onChange={v => setTab(v === defaultLocation(locs)?.hqId ? null : v)}
          options={locs.map(l => ({ value: l.hqId, label: l.name }))}
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
      ) : active && (
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
      )}

      <Sheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="HQ Settings" detent="large" surface="grouped">
        <HqSettingsContent />
      </Sheet>
    </Block>
  );
}
