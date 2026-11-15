import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../app/Screen";
import { useAccountBack } from "../../../app/useAccountBack";
import {
  Alert, Badge, Button, FieldRow, Icon, List, ListRow, ListSection, Notice, ScreenSkeleton, Sheet, Toggle, useToast,
} from "../../../ui";
import { useAuth } from "../../../context/AuthContext";
import { useAppSettings, type AppSettings } from "../../../context/AppSettingsContext";
import { listUsers, updateUserRole, deleteUser } from "../../../api/admin";
import { updateFxRates } from "../../../api/fxRates";
import { keys, useFxRates } from "../../../data/queries";
import { SUPPORTED_CURRENCIES } from "../../../utils/money";
import type { AdminUser } from "../../../types";
import { BackupSheet } from "./BackupSheet";
import { PortfolioAiSection } from "./PortfolioAiSection";
import s from "./Admin.module.css";


const SETTINGS: { key: keyof AppSettings; label: string; desc: string }[] = [
  { key: "backstageEnabled", label: "Backstage", desc: "Show Backstage in the account sheet for all users" },
  { key: "googleLoginEnabled", label: "Google Sign-In", desc: "Allow signing in with a Google account" },
  { key: "createAccountEnabled", label: "Create Account", desc: "Allow new users to register from the login screen" },
];

/** Admin (proposal §8.12). */
export default function Admin() {
  const back = useAccountBack();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { settings, saveSettings } = useAppSettings();
  const fx = useFxRates();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [detail, setDetail] = useState<AdminUser | null>(null);

  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers() as Promise<AdminUser[]>,
    meta: { persist: false },
    retry: false,
  });

  const fxUpdate = useMutation({
    mutationFn: () => updateFxRates(),
    onSuccess: (data: any) => {
      qc.setQueryData(keys.fx, { rates: data.rates, updatedAt: data.updatedAt });
      toast.show({ message: "FX rates updated", tone: "positive" });
    },
    onError: (e: any) => toast.show({ message: e?.response?.data?.message || e?.message || "Update failed", tone: "negative" }),
  });

  const toggleSetting = async (key: keyof AppSettings) => {
    setSavingKey(key);
    try { await saveSettings({ [key]: !settings[key] }); }
    catch { toast.show({ message: "Failed to save setting.", tone: "negative" }); }
    finally { setSavingKey(null); }
  };

  const usersError = users.error as any;
  const usersErrorText = !usersError ? null
    : usersError?.response?.status === 401 || usersError?.response?.status === 403
      ? "Session does not include admin permissions yet. Please sign out and sign back in, then try again."
      : `Failed to load users (HTTP ${usersError?.response?.status ?? "none"}: ${usersError?.response?.data?.message || usersError?.message || "unknown"})`;

  const rates = fx.data?.rates as Record<string, Record<string, number>> | null | undefined;
  // Every currency the stored matrix has, in the app's order (new ones appear after an update).
  const FX = rates ? [...SUPPORTED_CURRENCIES.filter(c => rates[c]), ...Object.keys(rates).filter(c => !(SUPPORTED_CURRENCIES as readonly string[]).includes(c))] : [];

  return (
    <Screen title="Admin" large={false} back={back}>
      <ListSection header="App settings">
        <List>
          {SETTINGS.map(({ key, label, desc }) => (
            <ListRow
              key={key}
              title={label}
              subtitle={desc}
              trailing={<Toggle label={label} isSelected={!!settings[key]} isDisabled={savingKey === key} onChange={() => toggleSetting(key)} />}
            />
          ))}
        </List>
      </ListSection>

      <ListSection
        header="FX rates"
        footer={`Conversion rates between ${SUPPORTED_CURRENCIES.join(", ")} used across the app for all users. Update fetches the latest rates and stores every combination.`}
      >
        <div className={s.card}>
          {rates?.EUR ? (
            <div className={s.fxWrap}>
            <table className={s.fx} aria-label="FX rate matrix">
              <thead>
                <tr><th scope="col"><span className="visually-hidden">From</span></th>{FX.map(c => <th key={c} scope="col">{c}</th>)}</tr>
              </thead>
              <tbody>
                {FX.map(from => (
                  <tr key={from}>
                    <th scope="row">{from}</th>
                    {FX.map(to => <td key={to}>{rates[from]?.[to] ?? "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className={s.muted}>No FX rates stored yet.</p>
          )}
          <div className={s.cardFoot}>
            <span className={s.muted}>{fx.data?.updatedAt ? `Updated ${new Date(fx.data.updatedAt).toLocaleString()}` : ""}</span>
            <Button variant="tinted" size="small" icon="refresh" loading={fxUpdate.isPending} onClick={() => fxUpdate.mutate()}>
              Update FX Rates
            </Button>
          </div>
        </div>
      </ListSection>

      <PortfolioAiSection />

      <ListSection header="Database backup" footer="Exports every DynamoDB table to CSV in a dated Google Drive folder.">
        <div className={s.padded}>
          <Button variant="filled" size="large" block icon="database" onClick={() => setBackupOpen(true)}>Back Up All Tables</Button>
        </div>
      </ListSection>

      <ListSection header={users.data ? `Users · ${users.data.length}` : "Users"}>
        {usersErrorText && <Notice>{usersErrorText}</Notice>}
        {users.isPending ? <ScreenSkeleton blocks={1} /> : users.data && (
          <List>
            {users.data.map(u => (
              <ListRow
                key={u.username}
                leading={<span className={s.avatar}>{u.username.slice(0, 2).toUpperCase()}</span>}
                title={<span className={s.userTitle}>{u.username}{u.username === user?.username && <span className={s.you}> (you)</span>}</span>}
                subtitle={`${u.email ?? "—"} · ${u.incomes} incomes · ${u.expenses} expenses`}
                trailing={
                  <span className={s.badges}>
                    {u.role === "admin" && <Badge color="var(--status-negative)">Admin</Badge>}
                    {!u.enabled && <Badge color="var(--label-secondary)">Disabled</Badge>}
                  </span>
                }
                onPress={() => setDetail(u)}
              />
            ))}
          </List>
        )}
      </ListSection>

      <BackupSheet isOpen={backupOpen} onClose={() => setBackupOpen(false)} />
      <UserSheet user={detail} selfName={user?.username} onClose={() => setDetail(null)} />
    </Screen>
  );
}

/* ── User detail ──────────────────────────────────────────────────────────── */

function UserSheet({ user, selfName, onClose }: { user: AdminUser | null; selfName?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { verifyPassword } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSelf = user?.username === selfName;

  const role = useMutation({
    mutationFn: (u: AdminUser) => updateUserRole(u.username, u.role === "admin" ? "normal" : "admin"),
    onSuccess: (_d, u) => {
      const next = u.role === "admin" ? "normal" : "admin";
      qc.setQueryData<AdminUser[]>(["admin", "users"], old => old?.map(x => (x.username === u.username ? { ...x, role: next } : x)));
      onClose();
      toast.show({ message: `${u.username} is now ${next === "admin" ? "an admin" : "a normal user"}`, tone: "positive" });
    },
    onError: () => toast.show({ message: "Failed to update role.", tone: "negative" }),
  });

  const closeConfirm = () => { setConfirm(false); setPassword(""); setError(null); };

  const doDelete = async () => {
    if (!user) return;
    if (!password) { setError("Please enter your password."); return; }
    setBusy(true);
    setError(null);
    try { await verifyPassword(password); } catch { setError("Wrong password. Please try again."); setBusy(false); return; }
    try {
      await deleteUser(user.username);
      qc.setQueryData<AdminUser[]>(["admin", "users"], old => old?.filter(x => x.username !== user.username));
      closeConfirm();
      onClose();
      toast.show({ message: `${user.username} deleted`, icon: "trash" });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to delete user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet isOpen={!!user && !confirm} onClose={onClose} title={user?.username ?? "User"} surface="grouped">
        {user && (
          <div className={s.sheetBody}>
            <div className={s.profile}>
              <span className={[s.avatar, s.bigAvatar].join(" ")}>{user.username.slice(0, 2).toUpperCase()}</span>
              <div>
                <p className={s.name}>{user.username}</p>
                <p className={s.muted}>{user.email ?? "—"} · {user.enabled ? "Active" : "Disabled"}</p>
                <p className={s.muted}>{user.incomes} incomes · {user.expenses} expenses</p>
              </div>
            </div>
            <List>
              <FieldRow label="Admin role">
                <Toggle
                  label="Admin role"
                  isSelected={user.role === "admin"}
                  isDisabled={isSelf || role.isPending}
                  onChange={() => role.mutate(user)}
                />
              </FieldRow>
            </List>
            {isSelf && <p className={s.note}>You cannot change your own role or delete yourself.</p>}
            {!isSelf && (
              <div className={s.padded}>
                <Button variant="destructiveTinted" size="large" block icon="trash" onClick={() => setConfirm(true)}>
                  Delete User and All Data
                </Button>
              </div>
            )}
          </div>
        )}
      </Sheet>
      <Alert
        isOpen={confirm}
        onClose={closeConfirm}
        title={`Delete ${user?.username}?`}
        message={<>This deletes the user and <strong>all their data</strong>. Enter your password to confirm.</>}
        error={error}
        actions={[
          { label: "Cancel", style: "cancel", onAction: closeConfirm },
          { label: busy ? "Deleting…" : "Delete", style: "destructive", onAction: doDelete, disabled: busy },
        ]}
      >
        <label className={s.passwordField}>
          <Icon name="key" size={18} />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            aria-label="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") doDelete(); }}
          />
        </label>
      </Alert>
    </>
  );
}
