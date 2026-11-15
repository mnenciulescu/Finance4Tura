import { useMemo, useState } from "react";
import { FieldRow, FormSheet, List, Notice, Picker, TextField, Toggle, useToast } from "../../ui";
import { useOnline } from "../../app/useOnline";
import { parseAmount, sanitizeAmountInput } from "../../utils/parseAmount";
import { SUPPORTED_CURRENCIES } from "../../utils/money";
import type { Pv2Asset, Pv2AssetType } from "../../types";
import { useSavePv2Asset } from "./data";
import { TYPE_LABEL } from "./pv2Math";
import f from "../money/forms/Forms.module.css";
import s from "./PortfolioV2.module.css";

const TYPES: Pv2AssetType[] = ["MutualFund", "ETF", "Stock", "Crypto", "Bond", "Other"];
const TYPE_OPTIONS = TYPES.map(t => ({ value: t, label: TYPE_LABEL[t] }));
const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map(c => ({ value: c as string, label: c }));
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

interface Form {
  platform: string; type: Pv2AssetType; symbol: string; name: string; units: string; isin: string;
  currency: string; sources: string; notes: string; active: boolean;
}

export function AssetSheet({ target, platforms, onClose }: { target: { asset?: Pv2Asset; platform?: string } | null; platforms: string[]; onClose: () => void }) {
  return <AssetForm key={target ? target.asset?.assetId ?? `new-${target.platform ?? ""}` : "closed"} target={target} platforms={platforms} onClose={onClose} />;
}

function AssetForm({ target, platforms, onClose }: { target: { asset?: Pv2Asset; platform?: string } | null; platforms: string[]; onClose: () => void }) {
  const asset = target?.asset;
  const isTotal = asset?.type === "Total";
  const initial = useMemo<Form>(() => asset ? {
    platform: asset.platform, type: asset.type, symbol: asset.symbol ?? "", name: asset.name, units: asset.units != null ? String(asset.units) : "",
    isin: asset.isin ?? "", currency: asset.currency, sources: (asset.preferredSources ?? []).join("\n"), notes: asset.notes ?? "", active: asset.active !== false,
  } : {
    platform: target?.platform ?? "", type: "ETF", symbol: "", name: "", units: "", isin: "", currency: "EUR", sources: "", notes: "", active: true,
  }, [asset, target?.platform]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = useSavePv2Asset();
  const toast = useToast();
  const online = useOnline();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.platform.trim()) errs.platform = "Required";
    if (!isTotal) {
      if (!form.name.trim()) errs.name = "Required";
      const units = parseAmount(form.units);
      if (!(units > 0)) errs.units = "Must be greater than 0";
      if (form.isin && !ISIN_RE.test(form.isin.trim().toUpperCase())) errs.isin = "Not a valid ISIN";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    const body: Partial<Pv2Asset> = isTotal
      ? { type: "Total", platform: asset!.platform, name: form.name.trim(), notes: form.notes.trim() || null }
      : {
        platform: form.platform.trim(), type: form.type, symbol: form.symbol.trim() || null, name: form.name.trim(),
        units: parseAmount(form.units), isin: form.isin.trim().toUpperCase() || null, currency: form.currency,
        preferredSources: form.sources.split(/\n|,\s*/).map(x => x.trim()).filter(Boolean),
        notes: form.notes.trim() || null, active: form.active,
      };
    try {
      await save.mutateAsync({ id: asset?.assetId, body });
      toast.show({ message: asset ? "Asset saved" : "Asset added", tone: "positive" });
      onClose();
    } catch (e: any) {
      const server = e?.response?.data;
      if (server?.errors) setErrors(server.errors);
      setError(server?.message || "Could not save the asset.");
    }
  };

  const platformSuggestions = platforms.filter(p => p.toLowerCase() !== form.platform.trim().toLowerCase()).slice(0, 6);

  return (
    <FormSheet
      isOpen={!!target}
      onClose={onClose}
      title={asset ? (isTotal ? "Edit Platform Total" : "Edit Asset") : "New Asset"}
      submitLabel={asset ? "Save" : "Add"}
      onSubmit={submit}
      canSubmit={online}
      submitting={save.isPending}
      isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
    >
      <div className={f.groups}>
        {error && <Notice>{error}</Notice>}
        {isTotal && <Notice tone="info">A platform Total is computed from the platform's assets after every snapshot run; only its name and notes are editable.</Notice>}
        <List aria-label="Asset">
          <TextField label="Platform" value={form.platform} onChange={v => set("platform", v)} placeholder="e.g. Broker" error={errors.platform} isDisabled={isTotal} />
          {!isTotal && platformSuggestions.length > 0 && !asset && (
            <FieldRow label="Existing">
              <span className={s.suggestions}>
                {platformSuggestions.map(p => (
                  <button key={p} type="button" className={s.suggestion} onClick={() => set("platform", p)}>{p}</button>
                ))}
              </span>
            </FieldRow>
          )}
          {!isTotal && <Picker label="Type" value={form.type} options={TYPE_OPTIONS} onChange={v => set("type", v)} />}
          <TextField label="Name" value={form.name} onChange={v => set("name", v)} placeholder="Full name" error={errors.name} />
          {!isTotal && (
            <>
              <TextField label="Symbol" value={form.symbol} onChange={v => set("symbol", v.toUpperCase())} placeholder="Ticker (optional)" />
              <TextField label="ISIN" value={form.isin} onChange={v => set("isin", v.toUpperCase())} placeholder="Optional" error={errors.isin} />
              <TextField label="Units" value={form.units} onChange={v => set("units", sanitizeAmountInput(v))} inputMode="decimal" align="end" placeholder="0" error={errors.units} />
              <Picker label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={v => set("currency", v)} />
            </>
          )}
        </List>
        {!isTotal && (
          <List aria-label="Agent hints">
            <TextField label="Preferred sources" value={form.sources} onChange={v => set("sources", v)} placeholder="URLs or source names, one per line" multiline />
          </List>
        )}
        <List aria-label="Notes">
          <TextField label="Notes" value={form.notes} onChange={v => set("notes", v)} placeholder="Optional" multiline />
          {!isTotal && asset && (
            <FieldRow label="Active">
              <Toggle label="Active" isSelected={form.active} onChange={v => set("active", v)} />
            </FieldRow>
          )}
        </List>
      </div>
    </FormSheet>
  );
}
