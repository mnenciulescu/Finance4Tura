import { useState } from "react";
import { Alert, Button, FieldRow, List, ListRow, ListSection, Notice, SegmentedControl, TextField, Toggle, useToast } from "../../../ui";
import { usePv2AiConfig, useUpdatePv2AiConfig } from "../../portfolio-v2/data";
import s from "./Admin.module.css";

/**
 * Admin → App Settings → Portfolio v2 AI: the Anthropic API key (write-only;
 * stored encrypted in AWS SSM, never shown again), the model, the search
 * budget per asset, and an on/off switch for the agent.
 */
/** The models offered; a stored id outside this list still shows, as "Other". */
const MODELS = [
  { value: "claude-opus-5-5", label: "Opus 5.5" },
  { value: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { value: "claude-haiku-5-5", label: "Haiku 5.5" },
] as const;

export function PortfolioAiSection() {
  const cfg = usePv2AiConfig();
  const update = useUpdatePv2AiConfig();
  const toast = useToast();
  const [key, setKey] = useState("");
  // Draft; null = show the saved value.
  const [searchesDraft, setSearches] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searches = searchesDraft ?? (cfg.data ? String(cfg.data.maxSearches) : "");

  const fail = (e: any) => setError(e?.response?.data?.message || e?.message || "Could not save.");

  const saveKey = () => {
    setError(null);
    update.mutate({ apiKey: key.trim() }, {
      onSuccess: () => { setKey(""); toast.show({ message: "AI key saved", tone: "positive" }); },
      onError: fail,
    });
  };
  const saveSettings = () => {
    setError(null);
    update.mutate({ maxSearches: Number(searches) }, {
      onSuccess: () => { setSearches(null); toast.show({ message: "AI settings saved", tone: "positive" }); },
      onError: fail,
    });
  };
  const clearKey = () => {
    setConfirmClear(false);
    update.mutate({ clearKey: true }, { onSuccess: () => toast.show({ message: "AI key removed", icon: "trash" }), onError: fail });
  };

  const c = cfg.data;
  const settingsDirty = !!c && Number(searches) !== c.maxSearches;
  // The model saves as soon as it is picked, like the switch above.
  const pickModel = (m: string) => {
    setError(null);
    update.mutate({ model: m }, {
      onSuccess: () => toast.show({ message: `Model: ${MODELS.find(x => x.value === m)?.label ?? m}`, tone: "positive" }),
      onError: fail,
    });
  };
  const known = MODELS.some(x => x.value === c?.model);

  return (
    <ListSection
      header="Portfolio v2 AI"
      footer="The agent looks up asset prices for Portfolio v2 snapshots (One-Page). The key is stored encrypted in AWS and is never shown again; each lookup is billed to that key's Anthropic account."
    >
      {cfg.isError && <Notice>Could not load the AI settings.</Notice>}
      {error && <Notice>{error}</Notice>}
      <List aria-label="Portfolio v2 AI">
        <ListRow
          title="API key"
          subtitle={c?.configured ? `Set · updated ${new Date(c.keyUpdatedAt!).toLocaleString()}` : "Not set"}
          trailing={c?.configured ? <Button variant="destructiveTinted" size="small" onClick={() => setConfirmClear(true)}>Remove</Button> : undefined}
        />
        <TextField
          label={c?.configured ? "Replace key" : "New key"}
          value={key}
          onChange={setKey}
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
        />
        <FieldRow label="Agent on">
          <Toggle
            label="Agent on"
            isSelected={!!c?.enabled}
            isDisabled={!c || update.isPending}
            onChange={v => update.mutate({ enabled: v }, { onError: fail })}
          />
        </FieldRow>
        <ListRow title="Model" subtitle={c && !known ? `Other: ${c.model}` : c?.model}>
          <SegmentedControl
            label="Model"
            value={known ? c!.model : ""}
            options={MODELS.map(x => ({ value: x.value, label: x.label }))}
            onChange={pickModel}
            isDisabled={!c || update.isPending}
            className={s.modelPick}
          />
        </ListRow>
        <TextField label="Searches per asset" value={searches} onChange={v => setSearches(v.replace(/\D/g, ""))} inputMode="numeric" align="end" />
      </List>
      <div className={s.actionsRow}>
        <Button variant="tinted" size="small" disabled={!settingsDirty} loading={update.isPending && settingsDirty} onClick={saveSettings}>Save Searches</Button>
        <Button variant="filled" size="small" icon="key" disabled={key.trim().length < 20} loading={update.isPending && !!key} onClick={saveKey}>Save Key</Button>
      </div>
      <Alert
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Remove the AI key?"
        message="Portfolio v2 snapshots cannot be generated until a new key is saved."
        actions={[
          { label: "Cancel", style: "cancel", onAction: () => setConfirmClear(false) },
          { label: "Remove", style: "destructive", onAction: clearKey },
        ]}
      />
    </ListSection>
  );
}
