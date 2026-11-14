import { useMemo, useState } from "react";
import { Screen } from "../../app/Screen";
import {
  ActionSheet, Button, FormSheet, Icon, IconButton, List, ListButtonRow, ListRow, ListSection, Notice, Picker, ScreenSkeleton,
  TextField, useToast,
} from "../../ui";
import { useDeleteLocation, useDeleteTemplate, useHqLocations, useHqTemplates, useSaveLocation, useSaveTemplate } from "../../data/hq";
import { useOnline } from "../../app/useOnline";
import type { HqLocation, HqParameter, HqTemplate } from "../../types";
import f from "../money/forms/Forms.module.css";
import s from "./Hq.module.css";

const MAX_PARAMS = 30;

/** HQ Settings (proposal §8.9): locations and tracker templates. */
export default function HqSettings() {
  const locations = useHqLocations();
  const templates = useHqTemplates();
  const [locForm, setLocForm] = useState<{ loc?: HqLocation } | null>(null);
  const [tplForm, setTplForm] = useState<{ tpl?: HqTemplate } | null>(null);
  const locs = locations.data ?? [];
  const tpls = templates.data ?? [];
  const unassigned = tpls.filter(t => !locs.some(l => l.hqId === t.hqId));

  return (
    <Screen title="HQ Settings" large={false} back={{ label: "HQ", to: "/hq" }}>
      {(locations.isError || templates.isError) && <Notice>Could not load HQ settings.</Notice>}
      {locations.isPending || templates.isPending ? (
        <ScreenSkeleton blocks={2} />
      ) : (
        <>
          <ListSection header="Locations">
            <List>
              {locs.map(loc => (
                <ListRow
                  key={loc.hqId}
                  leading={<Icon name="location" size={20} />}
                  title={loc.name}
                  subtitle={loc.address || undefined}
                  trailing={<span>{tpls.filter(t => t.hqId === loc.hqId).length} templates</span>}
                  onPress={() => setLocForm({ loc })}
                />
              ))}
              <ListButtonRow icon="plus" onPress={() => setLocForm({})}>Add Location</ListButtonRow>
            </List>
          </ListSection>

          <ListSection header="Tracker templates" footer={locs.length === 0 ? "Add a location first." : undefined}>
            {locs.map(loc => {
              const list = tpls.filter(t => t.hqId === loc.hqId);
              if (list.length === 0) return null;
              return (
                <div key={loc.hqId} className={s.tplGroup}>
                  <p className={s.groupLabel}>{loc.name}</p>
                  <List>
                    {list.map(t => (
                      <ListRow key={t.templateId} title={t.name} subtitle={`${t.parameters.length} parameter${t.parameters.length === 1 ? "" : "s"}`} onPress={() => setTplForm({ tpl: t })} />
                    ))}
                  </List>
                </div>
              );
            })}
            {unassigned.length > 0 && (
              <div className={s.tplGroup}>
                <p className={s.groupLabel}>No location</p>
                <List>
                  {unassigned.map(t => <ListRow key={t.templateId} title={t.name} onPress={() => setTplForm({ tpl: t })} />)}
                </List>
              </div>
            )}
            <div className={s.tplGroup}>
              <List>
                <ListButtonRow icon="plus" onPress={() => setTplForm({})} disabled={locs.length === 0}>Add Template</ListButtonRow>
              </List>
            </div>
          </ListSection>
        </>
      )}

      <LocationSheet target={locForm} templates={tpls} onClose={() => setLocForm(null)} />
      <TemplateSheet target={tplForm} locations={locs} onClose={() => setTplForm(null)} />
    </Screen>
  );
}

/* ── Location sheet ───────────────────────────────────────────────────────── */

function LocationSheet({ target, templates, onClose }: { target: { loc?: HqLocation } | null; templates: HqTemplate[]; onClose: () => void }) {
  return <LocationForm key={target ? target.loc?.hqId ?? "new" : "closed"} target={target} templates={templates} onClose={onClose} />;
}

function LocationForm({ target, templates, onClose }: { target: { loc?: HqLocation } | null; templates: HqTemplate[]; onClose: () => void }) {
  const loc = target?.loc;
  const initial = useMemo(() => ({ name: loc?.name ?? "", address: loc?.address ?? "", order: String(loc?.order ?? 0) }), [loc]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const save = useSaveLocation();
  const del = useDeleteLocation();
  const toast = useToast();
  const online = useOnline();
  const hasTemplates = !!loc && templates.some(t => t.hqId === loc.hqId);

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) { setError("Name is required"); return; }
    try {
      await save.mutateAsync({ id: loc?.hqId, body: { name: form.name.trim(), address: form.address.trim(), order: Number(form.order) || 0 } });
      toast.show({ message: loc ? "Location saved" : "Location added", tone: "positive" });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Error saving");
    }
  };

  return (
    <>
      <FormSheet
        isOpen={!!target}
        onClose={onClose}
        title={loc ? "Edit Location" : "New Location"}
        submitLabel={loc ? "Save" : "Add"}
        onSubmit={submit}
        canSubmit={online}
        submitting={save.isPending}
        isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
      >
        <div className={f.groups}>
          {error && <Notice>{error}</Notice>}
          <List aria-label="Location">
            <TextField label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Main House" autoCapitalize="words" />
            <TextField label="Address" value={form.address} onChange={v => setForm(p => ({ ...p, address: v }))} placeholder="Optional" />
            <TextField label="Order" value={form.order} onChange={v => setForm(p => ({ ...p, order: v.replace(/\D/g, "") }))} inputMode="numeric" align="end" />
          </List>
          {loc && (
            <div className={f.deleteWrap}>
              <Button variant="destructiveTinted" size="large" block icon="trash" disabled={hasTemplates} onClick={() => setConfirm(true)}>
                Delete Location
              </Button>
              {hasTemplates && <p className={s.footnote}>A location with templates cannot be deleted. Delete its templates first.</p>}
            </div>
          )}
        </div>
      </FormSheet>
      <ActionSheet
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete “${loc?.name}”?`}
        actions={[{
          label: "Delete Location", destructive: true, onAction: () => {
            setConfirm(false);
            if (!loc) return;
            del.mutate(loc.hqId, {
              onSuccess: () => { toast.show({ message: "Location deleted", icon: "trash" }); onClose(); },
              onError: (e: any) => setError(e?.response?.data?.message || e?.message || "Delete failed"),
            });
          },
        }]}
      />
    </>
  );
}

/* ── Template sheet ───────────────────────────────────────────────────────── */

const TYPE_OPTIONS = [
  { value: "number" as const, label: "Number" },
  { value: "text" as const, label: "Text" },
  { value: "boolean" as const, label: "Yes / No" },
];

function TemplateSheet({ target, locations, onClose }: { target: { tpl?: HqTemplate } | null; locations: HqLocation[]; onClose: () => void }) {
  return <TemplateForm key={target ? target.tpl?.templateId ?? "new" : "closed"} target={target} locations={locations} onClose={onClose} />;
}

function TemplateForm({ target, locations, onClose }: { target: { tpl?: HqTemplate } | null; locations: HqLocation[]; onClose: () => void }) {
  const tpl = target?.tpl;
  const initial = useMemo(() => tpl
    ? { hqId: tpl.hqId, name: tpl.name, parameters: tpl.parameters.map(p => ({ ...p, unit: p.unit || "" })) }
    : { hqId: locations[0]?.hqId ?? "", name: "", parameters: [{ title: "", type: "number" as const, unit: "" }] as HqParameter[] },
  [tpl, locations]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const toast = useToast();
  const online = useOnline();

  const setParam = (i: number, patch: Partial<HqParameter>) =>
    setForm(p => ({ ...p, parameters: p.parameters.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, dir: -1 | 1) => setForm(p => {
    const j = i + dir;
    if (j < 0 || j >= p.parameters.length) return p;
    const arr = [...p.parameters];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...p, parameters: arr };
  });

  const submit = async () => {
    setError(null);
    if (!form.hqId) { setError("Location is required"); return; }
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (form.parameters.length === 0) { setError("At least 1 parameter required"); return; }
    if (form.parameters.some(p => !p.title.trim())) { setError("All parameters must have a title"); return; }
    const body = {
      hqId: form.hqId,
      name: form.name.trim(),
      parameters: form.parameters.map((p, i) => ({
        ...(p.parameterId ? { parameterId: p.parameterId } : {}),
        title: p.title.trim(),
        type: p.type,
        unit: (p.unit || "").trim(),
        order: i,
      })),
    };
    try {
      await save.mutateAsync({ id: tpl?.templateId, body });
      toast.show({ message: tpl ? "Template saved" : "Template added", tone: "positive" });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Error saving");
    }
  };

  return (
    <>
      <FormSheet
        isOpen={!!target}
        onClose={onClose}
        title={tpl ? "Edit Template" : "New Template"}
        submitLabel={tpl ? "Save" : "Add"}
        onSubmit={submit}
        canSubmit={online}
        submitting={save.isPending}
        isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
      >
        <div className={f.groups}>
          {error && <Notice>{error}</Notice>}
          <List aria-label="Template">
            <Picker
              label="Location"
              value={form.hqId}
              options={locations.map(l => ({ value: l.hqId, label: l.name }))}
              onChange={v => setForm(p => ({ ...p, hqId: v }))}
              isDisabled={!!tpl}
            />
            <TextField label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Water Consumption" />
          </List>

          <ListSection header={`Parameters · ${form.parameters.length}/${MAX_PARAMS}`}>
            <div className={s.params}>
              {form.parameters.map((p, i) => (
                <div key={p.parameterId ?? `new-${i}`} className={s.param}>
                  <div className={s.paramHead}>
                    <span className={s.paramIndex}>{i + 1}</span>
                    <span className={s.flex} />
                    <IconButton icon="chevronUp" label={`Move parameter ${i + 1} up`} size={18} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton icon="chevronDown" label={`Move parameter ${i + 1} down`} size={18} disabled={i === form.parameters.length - 1} onClick={() => move(i, 1)} />
                    <IconButton icon="trash" label={`Remove parameter ${i + 1}`} size={18} onClick={() => setForm(x => ({ ...x, parameters: x.parameters.filter((_, idx) => idx !== i) }))} />
                  </div>
                  <List variant="plain" aria-label={`Parameter ${i + 1}`}>
                    <TextField label="Title" value={p.title} onChange={v => setParam(i, { title: v })} placeholder={`Parameter ${i + 1}`} />
                    <Picker label="Type" value={p.type} options={TYPE_OPTIONS} onChange={v => setParam(i, { type: v })} />
                    <TextField label="Unit" value={p.unit || ""} onChange={v => setParam(i, { unit: v })} placeholder="Optional, e.g. m³" />
                  </List>
                </div>
              ))}
              <Button
                variant="tinted"
                size="large"
                block
                icon="plus"
                disabled={form.parameters.length >= MAX_PARAMS}
                onClick={() => setForm(p => ({ ...p, parameters: [...p.parameters, { title: "", type: "number", unit: "" }] }))}
              >
                Add Parameter
              </Button>
            </div>
          </ListSection>

          {tpl && (
            <div className={f.deleteWrap}>
              <Button variant="destructiveTinted" size="large" block icon="trash" onClick={() => setConfirm(true)}>Delete Template</Button>
            </div>
          )}
        </div>
      </FormSheet>
      <ActionSheet
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete “${tpl?.name}”?`}
        message="Its entries are deleted too."
        actions={[{
          label: "Delete Template", destructive: true, onAction: () => {
            setConfirm(false);
            if (!tpl) return;
            del.mutate(tpl.templateId, {
              onSuccess: () => { toast.show({ message: "Template deleted", icon: "trash" }); onClose(); },
              onError: (e: any) => setError(e?.response?.data?.message || e?.message || "Delete failed"),
            });
          },
        }]}
      />
    </>
  );
}
