import { lazy, Suspense } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../app/Screen";
import { Button, EmptyState, IconButton, ListSection, Notice, ScreenSkeleton, Skeleton } from "../../ui";
import { keys } from "../../data/queries";
import { useHqEntries, useHqLocations, useHqTemplates } from "../../data/hq";
import type { HqEntry, HqLocation, HqTemplate } from "../../types";
import { byDateDesc, isWaterTemplate } from "./hqMath";
import { TemplateSection } from "./TemplateSection";
import { ReadList } from "./ReadList";
import s from "./Hq.module.css";

const WaterChart = lazy(() => import("./WaterChart"));

/**
 * HQ (proposal §8.9): a chip bar — Overview · one chip per location — with
 * HQ Settings behind the ··· button. Chip switches replace the history entry.
 */
export default function HqScreen() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const locations = useHqLocations();
  const templates = useHqTemplates();
  const entries = useHqEntries();

  const locs = locations.data ?? [];
  const active = locationId ? locs.find(l => l.hqId === locationId) : null;
  const loading = locations.isPending || templates.isPending || entries.isPending;

  if (locationId && locations.isSuccess && !active) return <Navigate to="/hq" replace />;

  return (
    <Screen
      title="HQ"
      onRefresh={() => Promise.all([keys.hqLocations, keys.hqTemplates, keys.hqEntries].map(k => qc.invalidateQueries({ queryKey: k })))}
      actions={<IconButton icon="ellipsisCircle" label="HQ Settings" onClick={() => navigate("/hq/settings")} />}
      accessory={
        <div className={s.chips} role="tablist" aria-label="HQ views">
          {[{ id: "", name: "Overview" }, ...locs.map(l => ({ id: l.hqId, name: l.name }))].map(chip => {
            const selected = (locationId ?? "") === chip.id;
            return (
              <button
                key={chip.id || "overview"}
                type="button"
                role="tab"
                aria-selected={selected}
                className={[s.chip, selected ? s.chipOn : ""].join(" ")}
                onClick={() => navigate(chip.id ? `/hq/${chip.id}` : "/hq", { replace: true })}
              >
                {chip.name}
              </button>
            );
          })}
        </div>
      }
    >
      {(locations.isError || templates.isError || entries.isError) && <Notice>Could not load HQ data.</Notice>}
      {loading ? (
        <ScreenSkeleton blocks={2} />
      ) : active ? (
        <LocationView location={active} templates={templates.data ?? []} entries={entries.data ?? []} />
      ) : (
        <Overview locations={locs} templates={templates.data ?? []} entries={entries.data ?? []} />
      )}
    </Screen>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────────── */

function Overview({ locations, templates, entries }: { locations: HqLocation[]; templates: HqTemplate[]; entries: HqEntry[] }) {
  const navigate = useNavigate();
  if (locations.length === 0) {
    return (
      <EmptyState
        icon="building"
        title="No locations yet"
        message="Add a location and a tracker template in HQ Settings."
        action={<Button variant="tinted" onClick={() => navigate("/hq/settings")}>Open HQ Settings</Button>}
      />
    );
  }
  return (
    <>
      {locations.map(loc => {
        const locTemplates = templates.filter(t => t.hqId === loc.hqId);
        return (
          <ListSection key={loc.hqId} header={loc.name} bare>
            <div className={s.stack}>
              {locTemplates.length === 0 && <p className={s.muted}>No templates for this location.</p>}
              {locTemplates.map(tpl => (
                <section key={tpl.templateId} className={s.card} aria-label={tpl.name}>
                  <h3 className={s.cardTitle}>{tpl.name}</h3>
                  {isWaterTemplate(tpl) ? (
                    <Suspense fallback={<Skeleton height={210} />}>
                      <WaterChart template={tpl} entries={entries} />
                    </Suspense>
                  ) : (
                    <ReadList template={tpl} entries={entries} />
                  )}
                </section>
              ))}
            </div>
          </ListSection>
        );
      })}
    </>
  );
}

/* ── One location ─────────────────────────────────────────────────────────── */

function LocationView({ location, templates, entries }: { location: HqLocation; templates: HqTemplate[]; entries: HqEntry[] }) {
  const navigate = useNavigate();
  const locTemplates = templates.filter(t => t.hqId === location.hqId);
  if (locTemplates.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="No templates"
        message={`Add a tracker template for ${location.name} in HQ Settings.`}
        action={<Button variant="tinted" onClick={() => navigate("/hq/settings")}>Open HQ Settings</Button>}
      />
    );
  }
  return (
    <>
      {locTemplates.map(tpl => (
        <TemplateSection
          key={tpl.templateId}
          template={tpl}
          hqId={location.hqId}
          entries={entries.filter(e => e.templateId === tpl.templateId).sort(byDateDesc)}
        />
      ))}
    </>
  );
}
