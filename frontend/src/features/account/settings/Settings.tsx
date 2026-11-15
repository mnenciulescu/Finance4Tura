import { useState } from "react";
import { Screen } from "../../../app/Screen";
import { FieldRow, List, ListRow, ListSection, Toggle } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import { THEME_SETTINGS, type ThemeSetting } from "../../../theme/themes";
import { usePrivacy } from "../../../context/PrivacyContext";
import { hapticsEnabled, hapticsSupported, setHapticsEnabled, haptic } from "../../../app/haptics";
import { useInstall } from "../../../app/install";
import { formatRemaining, useSessionRemaining } from "../../../app/AccountSheet";
import { InstallInstructionsSheet } from "./InstallInstructions";
import { useAccountBack } from "../../../app/useAccountBack";
import { ONE_PAGE_MIN_WIDTH, readOnePageDefault, writeOnePageDefault } from "../../../app/onePage";
import s from "./Settings.module.css";

const LABEL: Record<ThemeSetting, string> = { auto: "Automatic", light: "Light", dark: "Dark" };

/** A miniature of the app, painted with the theme's own tokens. */
function ThemePreview({ theme }: { theme: "light" | "dark" }) {
  return (
    <span className={s.preview} data-theme={theme} aria-hidden="true">
      <span className={s.previewBar} />
      <span className={s.previewCard}>
        <span className={s.previewLine} />
        <span className={[s.previewLine, s.short].join(" ")} />
        <span className={s.previewTint} />
      </span>
      <span className={s.previewTabs} />
    </span>
  );
}

/** Settings (proposal §8.10). Changes apply immediately. */
export default function Settings() {
  const { setting, setSetting } = useTheme();
  const { incomeVisible, setIncomeVisible, shieldEnabled, setShieldEnabled } = usePrivacy();
  const [haptics, setHaptics] = useState(hapticsEnabled);
  const install = useInstall();
  const remaining = useSessionRemaining();
  const [instructions, setInstructions] = useState(false);
  const back = useAccountBack();
  const [onePage, setOnePage] = useState(readOnePageDefault);
  const wide = typeof window !== "undefined" && window.innerWidth >= ONE_PAGE_MIN_WIDTH;

  return (
    <Screen title="Settings" large={false} back={back}>
      <ListSection header="Appearance" bare>
        <div className={s.themes} role="radiogroup" aria-label="Theme">
          {THEME_SETTINGS.map(id => {
            const selected = setting === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={[s.themeOption, selected ? s.themeSelected : ""].join(" ")}
                onClick={() => { haptic("light"); setSetting(id); }}
              >
                {id === "auto" ? (
                  <span className={s.split}>
                    <span className={s.half}><ThemePreview theme="light" /></span>
                    <span className={[s.half, s.right].join(" ")}><ThemePreview theme="dark" /></span>
                  </span>
                ) : (
                  <ThemePreview theme={id} />
                )}
                <span className={s.themeLabel}>{LABEL[id]}</span>
                <span className={[s.radio, selected ? s.radioOn : ""].join(" ")} />
              </button>
            );
          })}
        </div>
      </ListSection>

      {wide && (
        <ListSection header="Desktop" footer="Opens One-Page — Money, Library and HQ on one screen — when this browser starts the app on a large screen.">
          <List>
            <FieldRow label="Open One-Page on this computer">
              <Toggle label="Open One-Page on this computer" isSelected={onePage} onChange={v => { writeOnePageDefault(v); setOnePage(v); }} />
            </FieldRow>
          </List>
        </ListSection>
      )}

      <ListSection header="Privacy" footer="Income amounts can also be shown or hidden from the eye button on Budget.">
        <List>
          <FieldRow label="Show income amounts">
            <Toggle label="Show income amounts by default" isSelected={incomeVisible} onChange={setIncomeVisible} />
          </FieldRow>
          <FieldRow label="Hide in app switcher">
            <Toggle label="Hide content in app switcher" isSelected={shieldEnabled} onChange={setShieldEnabled} />
          </FieldRow>
        </List>
      </ListSection>

      {hapticsSupported() && (
        <ListSection header="Feedback">
          <List>
            <FieldRow label="Haptics">
              <Toggle label="Haptics" isSelected={haptics} onChange={v => { setHapticsEnabled(v); setHaptics(v); if (v) haptic("light"); }} />
            </FieldRow>
          </List>
        </ListSection>
      )}

      <ListSection header="About">
        <List>
          <ListRow title="Version" trailing={<span className={s.mono}>{__APP_VERSION__}</span>} />
          {remaining != null && <ListRow title="Session" trailing={formatRemaining(remaining)} />}
          {install.mode && (
            <ListRow
              title="Install App"
              onPress={() => (install.mode === "prompt" ? install.prompt() : setInstructions(true))}
            />
          )}
        </List>
      </ListSection>

      <InstallInstructionsSheet isOpen={instructions} onClose={() => setInstructions(false)} />
    </Screen>
  );
}
